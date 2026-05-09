// ═══════════════════════════════════════════════════════════════
// Weekly Timetable API  (Mon–Sat school-style schedule)
// GET  /api/v1/batch-sessions/weekly-timetable?batch_id=X  — Get timetable pattern
// POST /api/v1/batch-sessions/weekly-timetable             — Send timetable emails
//
// GET returns a deduplicated weekly pattern derived from scheduled sessions.
// E.g. Monday → Physics 9 AM, Chemistry 11 AM … Saturday → …
//
// POST sends the timetable email to all stakeholders:
//   students, parents, teacher(s), and batch coordinator.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendEmail } from '@/lib/email';
import { weeklyTimetableTemplate, type WeeklyTimetableSlot } from '@/lib/email-templates';
import { localize12hTime, REGION_TZ_LABELS } from '@/lib/region-timezone';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) return null;
  return user;
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

/** Derive a unique weekly pattern from raw sessions: deduplicate by (day, start_time, subject, teacher) */
function deriveWeeklySlots(
  sessions: Array<{ subject: string; teacher_name: string; scheduled_date: unknown; start_time: string; duration_minutes: number }>,
): WeeklyTimetableSlot[] {
  const seen = new Set<string>();
  const slots: WeeklyTimetableSlot[] = [];

  for (const s of sessions) {
    const day = getDayName(s.scheduled_date);
    if (!DAY_ORDER.includes(day as typeof DAY_ORDER[number])) continue; // skip Sunday
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

  // Sort by day order then by start_time
  const dayIdx = (d: string) => DAY_ORDER.indexOf(d as typeof DAY_ORDER[number]);
  slots.sort((a, b) => dayIdx(a.day) - dayIdx(b.day) || a.startTime.localeCompare(b.startTime));
  return slots;
}

// ── GET — Fetch weekly timetable (pattern) for a batch ──────
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const batchId = url.searchParams.get('batch_id');
  if (!batchId) return NextResponse.json({ success: false, error: 'batch_id is required' }, { status: 400 });

  // Get batch info
  const batchRes = await db.query(
    `SELECT batch_id, batch_name, batch_type, grade, section, subjects,
            coordinator_email, academic_operator_email
     FROM batches WHERE batch_id = $1`,
    [batchId],
  );
  if (batchRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }

  const batch = batchRes.rows[0] as Record<string, unknown>;

  // Get all scheduled/live sessions
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

  // Group by day for frontend convenience
  const byDay: Record<string, WeeklyTimetableSlot[]> = {};
  for (const s of slots) {
    if (!byDay[s.day]) byDay[s.day] = [];
    byDay[s.day].push(s);
  }

  const sortedDays = [...DAY_ORDER].filter(d => byDay[d]?.length > 0);

  return NextResponse.json({
    success: true,
    data: {
      batch: {
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        grade: batch.grade,
        section: batch.section,
        subjects: batch.subjects,
      },
      slots,
      byDay,
      sortedDays,
      totalSlots: slots.length,
    },
  });
}

// ── POST — Send weekly timetable emails ─────────────────────
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const batchId = body.batch_id as string;
  const isUpdate = Boolean(body.is_update);
  if (!batchId) return NextResponse.json({ success: false, error: 'batch_id is required' }, { status: 400 });

  try {
    // Get batch info
    const batchRes = await db.query(
      `SELECT batch_id, batch_name, batch_type, grade, section, subjects,
              coordinator_email, academic_operator_email
       FROM batches WHERE batch_id = $1`,
      [batchId],
    );
    if (batchRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }

    const batch = batchRes.rows[0] as Record<string, unknown>;
    const batchName = batch.batch_name as string;
    const batchGrade = batch.grade as string;

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.stibelearning.online';
    const loginUrl = `${baseUrl}/login`;

    // ── Collect recipients ──────────────────────────────
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

    // Teachers (unique per batch)
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

    // Deduplicate by email+role
    const seen = new Set<string>();
    const uniqueRecipients = recipients.filter(r => {
      const key = `${r.email}__${r.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Send emails (parallel for speed) ─────────────────
    let sentCount = 0;
    const errors: string[] = [];

    // Prepare all emails first (template + log row)
    const prepared = await Promise.all(
      uniqueRecipients.map(async (recipient) => {
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
          isUpdate,
          localTimezone: localTz,
        });
        const logRes = await db.query<{ id: string }>(
          `INSERT INTO email_log (room_id, recipient_email, template_type, subject, status)
           VALUES (NULL, $1, 'weekly_timetable', $2, 'queued') RETURNING id`,
          [recipient.email, subject],
        );
        return { recipient, subject, html, text, logId: logRes.rows[0].id };
      }),
    );

    // Send all in parallel (batch of 5 at a time to avoid Gmail throttle)
    const BATCH_SIZE = 5;
    for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
      const chunk = prepared.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map(async ({ recipient, subject, html, text, logId }) => {
          const slotsText = prepared.find(p => p.recipient.email === recipient.email)
            ? `See email for full schedule`
            : 'See email for details';
          const result = await sendEmail({
            to: recipient.email, subject, html, text, priority: 'normal',
            waTemplate: 'stibe_weekly_schedule',
            waParams: [recipient.name, `${batchName} (Grade ${batchGrade})`, slotsText],
          });
          if (result.success) {
            await db.query(`UPDATE email_log SET status = 'sent', smtp_message_id = $1, sent_at = NOW() WHERE id = $2`, [result.messageId || null, logId]);
            return { ok: true };
          } else {
            await db.query(`UPDATE email_log SET status = 'failed', error_message = $1 WHERE id = $2`, [result.error || 'Unknown', logId]);
            return { ok: false, err: `${recipient.email}: ${result.error}` };
          }
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) sentCount++;
        else if (r.status === 'fulfilled' && !r.value.ok) errors.push(r.value.err!);
        else if (r.status === 'rejected') errors.push(String(r.reason));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: sentCount,
        total_recipients: uniqueRecipients.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: sentCount > 0
        ? `Sent weekly timetable to ${sentCount} recipient${sentCount > 1 ? 's' : ''}`
        : 'No emails sent',
    });
  } catch (err) {
    console.error('[weekly-timetable] Error:', err);
    return NextResponse.json({ success: false, error: 'Failed to send weekly timetable' }, { status: 500 });
  }
}
