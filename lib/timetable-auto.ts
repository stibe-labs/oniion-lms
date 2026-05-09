// ═══════════════════════════════════════════════════════════════
// Timetable Auto-Send Helper  (Mon–Sat weekly pattern)
// Fires an async (non-blocking) timetable email update after
// session changes (create, edit, cancel). Throttled to avoid
// spamming when doing bulk operations — waits 30 seconds and
// deduplicates by batch_id. Also skips if a timetable email
// was already sent for this batch within the last 2 hours.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { weeklyTimetableTemplate, type WeeklyTimetableSlot } from '@/lib/email-templates';
import { localize12hTime, REGION_TZ_LABELS } from '@/lib/region-timezone';

// ── Throttle map: batch_id → timeout ──────────────────────

const pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schedule a timetable update email for a batch. Debounced by 30 seconds
 * per batch so bulk operations (e.g. recurring session creation) only
 * send one email. Also skips if sent within the last 2 hours.
 * Fire-and-forget — does not throw.
 */
export function scheduleTimetableUpdate(batchId: string) {
  const existing = pendingUpdates.get(batchId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingUpdates.delete(batchId);
    sendTimetableUpdate(batchId).catch(err => {
      console.error(`[timetable-auto] Failed for batch ${batchId}:`, err);
    });
  }, 30_000); // 30-second debounce prevents spam during bulk session creates

  pendingUpdates.set(batchId, timer);
}

// ── Helpers ──────────────────────────────────────────────────

function fmtTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function addMinutes(timeStr: string, mins: number): string {
  const [hh, mm] = timeStr.split(':').map(Number);
  const total = hh * 60 + mm + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function toDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function getDayName(dateVal: unknown): string {
  const iso = toDateString(dateVal);
  const d = new Date(iso + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()];
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Derive unique weekly pattern from raw sessions */
function deriveWeeklySlots(
  sessions: Array<{ subject: string; teacher_name: string; scheduled_date: unknown; start_time: string; duration_minutes: number }>,
): WeeklyTimetableSlot[] {
  const seen = new Set<string>();
  const slots: WeeklyTimetableSlot[] = [];

  for (const s of sessions) {
    const day = getDayName(s.scheduled_date);
    if (!DAY_ORDER.includes(day as typeof DAY_ORDER[number])) continue;
    const key = `${day}|${s.start_time}|${s.subject}|${s.teacher_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({
      day,
      subject: s.subject,
      teacherName: s.teacher_name || 'TBA',
      startTime: fmtTime12(s.start_time),
      endTime: fmtTime12(addMinutes(s.start_time, s.duration_minutes)),
      duration: `${s.duration_minutes} min`,
    });
  }

  const dayIdx = (d: string) => DAY_ORDER.indexOf(d as typeof DAY_ORDER[number]);
  slots.sort((a, b) => dayIdx(a.day) - dayIdx(b.day) || a.startTime.localeCompare(b.startTime));
  return slots;
}

// ── Core send logic ─────────────────────────────────────────

async function sendTimetableUpdate(batchId: string) {
  const batchRes = await db.query(
    `SELECT batch_id, batch_name, batch_type, grade, section, subjects,
            coordinator_email, academic_operator_email
     FROM batches WHERE batch_id = $1`,
    [batchId],
  );
  if (batchRes.rows.length === 0) return;

  const batch = batchRes.rows[0] as Record<string, unknown>;
  const batchName = batch.batch_name as string;
  const batchGrade = batch.grade as string;

  // ── 2-hour dedup: skip if we already sent a timetable email for this batch recently ──
  const dedupRes = await db.query(
    `SELECT id FROM email_log
     WHERE template_type = 'weekly_timetable_auto'
       AND subject LIKE $1
       AND created_at > NOW() - INTERVAL '2 hours'
     LIMIT 1`,
    [`%[BID:${batchId}]%`]
  );
  if (dedupRes.rows.length > 0) {
    console.log(`[timetable-auto] Batch ${batchId}: skipping — timetable email sent within last 2 hours`);
    return;
  }

  // Get all scheduled sessions & derive weekly pattern
  const sessionsRes = await db.query(`
    SELECT subject, teacher_name, scheduled_date, start_time, duration_minutes
    FROM batch_sessions
    WHERE batch_id = $1 AND status IN ('scheduled', 'live')
    ORDER BY scheduled_date ASC, start_time ASC
  `, [batchId]);

  const sessions = sessionsRes.rows as Array<{
    subject: string; teacher_name: string;
    scheduled_date: unknown; start_time: string; duration_minutes: number;
  }>;

  const slots = deriveWeeklySlots(sessions);

  // Don't send if there are no upcoming sessions (all cancelled/deleted)
  if (slots.length === 0) {
    console.log(`[timetable-auto] Batch ${batchId}: skipping — no active sessions to show`);
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.stibelearning.online';
  const loginUrl = `${baseUrl}/login`;

  // Collect recipients
  type Recipient = {
    email: string;
    name: string;
    role: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
    childName?: string;
    region?: string | null;
  };
  const recipients: Recipient[] = [];

  // Students & parents
  const studentsRes = await db.query(`
    SELECT bs.student_email, bs.parent_email,
           u.full_name AS student_name, pu.full_name AS parent_name,
           sp.assigned_region AS student_region
    FROM batch_students bs
    LEFT JOIN portal_users u ON u.email = bs.student_email
    LEFT JOIN portal_users pu ON pu.email = bs.parent_email
    LEFT JOIN user_profiles sp ON sp.email = bs.student_email
    WHERE bs.batch_id = $1
  `, [batchId]);

  for (const row of studentsRes.rows) {
    const s = row as { student_email: string; student_name: string; parent_email: string | null; parent_name: string | null; student_region: string | null };
    recipients.push({ email: s.student_email, name: s.student_name || s.student_email, role: 'student', region: s.student_region });
    if (s.parent_email) {
      recipients.push({ email: s.parent_email, name: s.parent_name || s.parent_email, role: 'parent', childName: s.student_name || s.student_email, region: s.student_region });
    }
  }

  // Teachers
  const teachersRes = await db.query(`
    SELECT DISTINCT bt.teacher_email, u.full_name AS teacher_name
    FROM batch_teachers bt
    LEFT JOIN portal_users u ON u.email = bt.teacher_email
    WHERE bt.batch_id = $1
  `, [batchId]);

  for (const row of teachersRes.rows) {
    const t = row as { teacher_email: string; teacher_name: string };
    recipients.push({ email: t.teacher_email, name: t.teacher_name || t.teacher_email, role: 'teacher' });
  }

  // Coordinator
  if (batch.coordinator_email) {
    const coordRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [batch.coordinator_email]);
    const coordName = coordRes.rows.length > 0 ? (coordRes.rows[0] as { full_name: string }).full_name : 'Coordinator';
    recipients.push({ email: batch.coordinator_email as string, name: coordName, role: 'batch_coordinator' });
  }

  // Deduplicate
  const seen = new Set<string>();
  const uniqueRecipients = recipients.filter(r => {
    const key = `${r.email}__${r.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Send emails
  let sentCount = 0;
  for (const recipient of uniqueRecipients) {
    try {
      // For non-IST recipients, add local times as secondary info
      let recipientSlots = slots;
      let localTz: string | undefined;
      if (recipient.region && recipient.region !== 'India' && REGION_TZ_LABELS[recipient.region]) {
        localTz = REGION_TZ_LABELS[recipient.region];
        recipientSlots = slots.map(s => ({
          ...s,
          localStartTime: localize12hTime(s.startTime, recipient.region!),
          localEndTime: localize12hTime(s.endTime, recipient.region!),
        }));
      }

      const { subject, html, text } = weeklyTimetableTemplate({
        recipientName: recipient.name,
        recipientRole: recipient.role,
        batchName,
        batchGrade,
        slots: recipientSlots,
        childName: recipient.childName,
        loginUrl,
        recipientEmail: recipient.email,
        isUpdate: true,
        localTimezone: localTz,
      });

      // Append batch ID tag for dedup tracking in email_log
      const subjectWithTag = `${subject} [BID:${batchId}]`;

      const logRes = await db.query<{ id: string }>(
        `INSERT INTO email_log (room_id, recipient_email, template_type, subject, status)
         VALUES (NULL, $1, 'weekly_timetable_auto', $2, 'queued') RETURNING id`,
        [recipient.email, subjectWithTag],
      );
      const logId = logRes.rows[0].id;

      const slotsText = recipientSlots.map((s: { day: string; subject: string; startTime: string; localStartTime?: string }) => `${s.day}: ${s.subject} ${s.localStartTime || s.startTime}`).join(', ');
      const result = await sendEmail({
        to: recipient.email, subject, html, text, priority: 'normal',
        waTemplate: 'stibe_weekly_schedule',
        waParams: [recipient.name, `${batchName} (Grade ${batchGrade})`, slotsText || 'See email for schedule'],
      });

      if (result.success) {
        await db.query(`UPDATE email_log SET status = 'sent', smtp_message_id = $1, sent_at = NOW() WHERE id = $2`, [result.messageId || null, logId]);
        sentCount++;
      } else {
        await db.query(`UPDATE email_log SET status = 'failed', error_message = $1 WHERE id = $2`, [result.error || 'Unknown', logId]);
      }
    } catch (err) {
      console.error(`[timetable-auto] Failed to email ${recipient.email}:`, err);
    }
  }

  console.log(`[timetable-auto] Batch ${batchId}: sent ${sentCount}/${uniqueRecipients.length} timetable update emails`);
}
