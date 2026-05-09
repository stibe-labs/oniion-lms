// ═══════════════════════════════════════════════════════════════
// Daily Timetable Email API
// POST /api/v1/batch-sessions/daily-timetable
//
// Sends a morning timetable email to all participants who have
// sessions scheduled today (students, parents, teachers, and
// batch coordinators). Uses a deduplication flag in Redis or
// a DB column to avoid sending duplicates if called more than
// once per day.
//
// Called by AO dashboard polling every 60s — the endpoint
// internally checks if today's timetable has already been sent.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendEmail } from '@/lib/email';
import { dailyTimetableTemplate, type SessionInfo } from '@/lib/email-templates';
import { localize12hTime, REGION_TZ_LABELS } from '@/lib/region-timezone';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator'].includes(user.role)) return null;
  return user;
}

// ── Helper: format time from HH:MM:SS to 12h ────────────────
function fmtTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

// ── Helper: format date to readable string ───────────────────
function fmtDateReadable(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // ── Check if timetable already sent today ──────────────
    // Use a simple approach: check a daily_email_log table or use
    // a convention-key in batch_sessions' notes. We'll use a simpler
    // approach: check if we already logged 'daily_timetable' type
    // emails for today's date.
    const todayISO = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    ).toISOString().slice(0, 10);

    // Check if we already sent timetable today using email_log
    const alreadySent = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM email_log
       WHERE template_type = 'daily_timetable'
         AND created_at::date = $1::date`,
      [todayISO]
    );
    if ((alreadySent.rows[0] as { cnt: number }).cnt > 0) {
      return NextResponse.json({
        success: true,
        data: { sent: 0 },
        message: 'Daily timetable already sent today',
      });
    }

    // ── Fetch today's sessions ────────────────────────────
    const sessionsRes = await db.query(`
      SELECT s.session_id, s.batch_id, s.subject, s.teacher_email, s.teacher_name,
             s.start_time, s.duration_minutes, s.topic, s.scheduled_date,
             b.batch_name, b.coordinator_email, b.academic_operator_email, b.grade
      FROM batch_sessions s
      JOIN batches b ON b.batch_id = s.batch_id
      WHERE s.status = 'scheduled'
        AND s.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY s.start_time ASC
    `);

    if (sessionsRes.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { sent: 0 },
        message: 'No sessions scheduled today',
      });
    }

    const sessions = sessionsRes.rows as Array<{
      session_id: string; batch_id: string; subject: string; teacher_email: string;
      teacher_name: string; start_time: string; duration_minutes: number;
      topic: string | null; scheduled_date: string; batch_name: string;
      coordinator_email: string; academic_operator_email: string; grade: string;
    }>;

    const dateStr = fmtDateReadable(sessions[0].scheduled_date);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.stibelearning.online';
    const loginUrl = `${baseUrl}/login`;

    // ── Build per-recipient session lists ─────────────────
    // Teachers: sessions where they teach
    // Students: sessions in batches they belong to
    // Parents: sessions in batches their child belongs to
    // Coordinators: sessions in batches they coordinate

    type Recipient = {
      email: string;
      name: string;
      role: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
      sessions: SessionInfo[];
      childName?: string;
      region?: string | null;
    };

    const recipientMap = new Map<string, Recipient>();

    // Helper to add a session to a recipient
    const addSession = (
      email: string, name: string,
      role: 'teacher' | 'student' | 'parent' | 'batch_coordinator',
      session: SessionInfo,
      childName?: string,
      region?: string | null
    ) => {
      const key = `${email}__${role}`;
      if (!recipientMap.has(key)) {
        recipientMap.set(key, { email, name, role, sessions: [], childName, region });
      }
      recipientMap.get(key)!.sessions.push(session);
    };

    // Gather all batch_ids for one query
    const batchIds = [...new Set(sessions.map(s => s.batch_id))];

    // Fetch students + parents for all relevant batches
    const studentsRes = await db.query(`
      SELECT bs.batch_id, bs.student_email, bs.parent_email,
             u.full_name AS student_name, pu.full_name AS parent_name,
             sp.assigned_region AS student_region
      FROM batch_students bs
      LEFT JOIN portal_users u ON u.email = bs.student_email
      LEFT JOIN portal_users pu ON pu.email = bs.parent_email
      LEFT JOIN user_profiles sp ON sp.email = bs.student_email
      WHERE bs.batch_id = ANY($1)
    `, [batchIds]);

    const studentsByBatch = new Map<string, Array<{
      student_email: string; student_name: string;
      parent_email: string | null; parent_name: string | null;
      student_region: string | null;
    }>>();

    for (const row of studentsRes.rows) {
      const s = row as { batch_id: string; student_email: string; student_name: string; parent_email: string | null; parent_name: string | null; student_region: string | null };
      if (!studentsByBatch.has(s.batch_id)) studentsByBatch.set(s.batch_id, []);
      studentsByBatch.get(s.batch_id)!.push(s);
    }

    // Process each session
    for (const s of sessions) {
      const sessionInfo: SessionInfo = {
        subject: s.subject,
        teacherName: s.teacher_name || 'TBA',
        startTime: fmtTime12(s.start_time),
        duration: `${s.duration_minutes} min`,
        batchName: s.batch_name,
        topic: s.topic || undefined,
      };

      // Teacher
      if (s.teacher_email) {
        const tName = s.teacher_name || s.teacher_email;
        addSession(s.teacher_email, tName, 'teacher', sessionInfo);
      }

      // Coordinator
      if (s.coordinator_email) {
        const coordRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [s.coordinator_email]);
        const coordName = coordRes.rows.length > 0 ? (coordRes.rows[0] as { full_name: string }).full_name : 'Coordinator';
        addSession(s.coordinator_email, coordName, 'batch_coordinator', sessionInfo);
      }

      // Students & Parents
      const batchStudents = studentsByBatch.get(s.batch_id) || [];
      for (const st of batchStudents) {
        addSession(st.student_email, st.student_name || st.student_email, 'student', sessionInfo, undefined, st.student_region);

        if (st.parent_email) {
          addSession(st.parent_email, st.parent_name || st.parent_email, 'parent', sessionInfo, st.student_name || st.student_email, st.student_region);
        }
      }
    }

    // ── Send emails ──────────────────────────────────────
    let sentCount = 0;
    const errors: string[] = [];

    for (const [, recipient] of recipientMap) {
      try {
        // For non-IST recipients, add local times as secondary info
        let recipientSessions = recipient.sessions;
        let localTz: string | undefined;
        if (recipient.region && recipient.region !== 'India' && REGION_TZ_LABELS[recipient.region]) {
          localTz = REGION_TZ_LABELS[recipient.region];
          recipientSessions = recipient.sessions.map(s => ({
            ...s,
            localStartTime: localize12hTime(s.startTime, recipient.region!),
          }));
        }

        const { subject, html, text } = dailyTimetableTemplate({
          recipientName: recipient.name,
          recipientRole: recipient.role,
          date: dateStr,
          sessions: recipientSessions,
          childName: recipient.childName,
          loginUrl,
          recipientEmail: recipient.email,
          localTimezone: localTz,
        });

        // Log to email_log table
        const logRes = await db.query<{ id: string }>(
          `INSERT INTO email_log (room_id, recipient_email, template_type, subject, status)
           VALUES (NULL, $1, 'daily_timetable', $2, 'queued') RETURNING id`,
          [recipient.email, subject]
        );
        const logId = logRes.rows[0].id;

        const sessText = recipientSessions.map((s: { subject: string; startTime: string; localStartTime?: string }) => `${s.subject} ${s.localStartTime || s.startTime}`).join(', ');
        const result = await sendEmail({
          to: recipient.email,
          subject,
          html,
          text,
          priority: 'normal',
          waTemplate: 'stibe_daily_schedule',
          waParams: [recipient.name, dateStr, sessText || 'See email for details'],
        });

        if (result.success) {
          await db.query(`UPDATE email_log SET status = 'sent', smtp_message_id = $1, sent_at = NOW() WHERE id = $2`, [result.messageId || null, logId]);
          sentCount++;
        } else {
          await db.query(`UPDATE email_log SET status = 'failed', error_message = $1 WHERE id = $2`, [result.error || 'Unknown', logId]);
          errors.push(`${recipient.email}: ${result.error}`);
        }
      } catch (err) {
        console.error(`[daily-timetable] Failed to email ${recipient.email}:`, err);
        errors.push(`${recipient.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: sentCount,
        total_recipients: recipientMap.size,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: sentCount > 0
        ? `Sent daily timetable to ${sentCount} recipient${sentCount > 1 ? 's' : ''}`
        : 'No emails sent',
    });

  } catch (err) {
    console.error('[daily-timetable] Error:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to send daily timetable emails',
    }, { status: 500 });
  }
}
