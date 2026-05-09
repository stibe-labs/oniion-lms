// ═══════════════════════════════════════════════════════════════
// Session Reminder Email API — single lobby-open notification
// POST /api/v1/batch-sessions/session-reminder
//
// Sends ONE reminder per session, 15 minutes before start.
// The reminder contains a no-login direct-join link that stays
// active from lobby-open until the teacher manually ends the class.
//
// Dedup: email_log subject contains [SID:<sessionId>:15]
//   so the reminder fires at most once per session per day.
//
// Called by AO dashboard polling every 60s.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendEmail } from '@/lib/email';
import { ensureRoom, createLiveKitToken } from '@/lib/livekit';
import { getJoinUrl } from '@/lib/session-join-tokens';
import { fireWhatsApp } from '@/lib/whatsapp';
import { sessionReminderTemplate } from '@/lib/email-templates';
import { istToRegionTime } from '@/lib/region-timezone';
import type { PortalRole } from '@/types';

// Auth: accept either an authenticated AO/owner cookie OR the CRON_SECRET bearer token
const CRON_SECRET = process.env.CRON_SECRET || 'stibe-cron-2026';

async function getCaller(req: NextRequest): Promise<boolean> {
  // Cron auth (server-side scheduled call)
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  if (
    authHeader === `Bearer ${CRON_SECRET}` ||
    url.searchParams.get('secret') === CRON_SECRET
  ) {
    return true;
  }
  // Cookie auth (browser-based AO/owner poll)
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const user = await verifySession(token);
  return !!(user && ['owner', 'academic_operator'].includes(user.role));
}

// ── Helper: format time from HH:MM:SS to 12h ────────────────
function fmtTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

export async function POST(req: NextRequest) {
  const authorized = await getCaller(req);
  if (!authorized) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // ── Single reminder window: 15 minutes before start ─────
  // Window: [start_time - 17.5min, start_time - 12.5min) to guarantee
  // at least one 60-second polling tick falls inside.
  // The link we send is a persistent no-login token URL that remains
  // valid through the entire live session until teacher ends it.
  const windows = [
    { label: '15', minutesBefore: 15, requireLive: false },
  ] as const;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.stibelearning.online';
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stibelearning.online';
  let totalSent = 0;
  let sessionsNotified = 0;

  try {
    for (const win of windows) {
      const statusFilter = win.requireLive
        ? `AND s.status = 'live'`
        : `AND s.status IN ('scheduled', 'live')`;

      // Window: [start_time - minutesBefore - 2.5min, start_time - minutesBefore + 2.5min)
      const loBound = win.minutesBefore + 2.5;  // minutes BEFORE start
      const hiBound = win.minutesBefore - 2.5;  // minutes BEFORE start (can be negative for :start)

      const sessionsRes = await db.query(`
        SELECT s.session_id, s.batch_id, s.subject, s.teacher_email, s.teacher_name,
               s.livekit_room_name, s.start_time, s.duration_minutes, s.topic,
               s.scheduled_date, s.status,
               b.batch_name, b.coordinator_email, b.academic_operator_email
        FROM batch_sessions s
        JOIN batches b ON b.batch_id = s.batch_id
        WHERE ${statusFilter.replace('AND ', '')}
          AND s.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time
                >= (s.start_time - interval '${loBound} minutes')
          AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time
                <  (s.start_time - interval '${hiBound} minutes')
        ORDER BY s.start_time ASC
      `);

      if (sessionsRes.rows.length === 0) continue;

      // ── Dedup: skip sessions already notified for THIS window ──
      const sessionIds = sessionsRes.rows.map(r => (r as { session_id: string }).session_id);
      const alreadyReminded = await db.query(
        `SELECT DISTINCT substring(subject from 'SID:([a-z0-9_-]+):${win.label}') AS session_id
         FROM email_log
         WHERE template_type = 'session_reminder'
           AND created_at::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
           AND subject LIKE '%SID:%:${win.label}%'
           AND substring(subject from 'SID:([a-z0-9_-]+):${win.label}') = ANY($1)`,
        [sessionIds]
      );
      const remindedSet = new Set(
        alreadyReminded.rows.map(r => (r as { session_id: string }).session_id)
      );

      const sessionsToNotify = sessionsRes.rows.filter(
        r => !remindedSet.has((r as { session_id: string }).session_id)
      );

      if (sessionsToNotify.length === 0) continue;

      for (const row of sessionsToNotify) {
        const session = row as {
          session_id: string; batch_id: string; subject: string; teacher_email: string;
          teacher_name: string; livekit_room_name: string; start_time: string;
          duration_minutes: number; topic: string | null; scheduled_date: string;
          status: string; batch_name: string; coordinator_email: string;
          academic_operator_email: string;
        };

        try {
          const roomName = session.livekit_room_name;
          const startTime12 = fmtTime12(session.start_time);

          // Ensure LiveKit room exists for token generation
          await ensureRoom(roomName, JSON.stringify({
            session_id: session.session_id,
            batch_id: session.batch_id,
            subject: session.subject,
            batch_name: session.batch_name,
          }));

          // ── Build recipients list ──────────────────────────
          type Recipient = {
            email: string; name: string;
            role: PortalRole;
            displayRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
            childName?: string;
            region?: string | null;
          };
          const recipients: Recipient[] = [];

          // Teacher
          if (session.teacher_email) {
            recipients.push({
              email: session.teacher_email,
              name: session.teacher_name || 'Teacher',
              role: 'teacher' as PortalRole,
              displayRole: 'teacher',
            });
          }

          // Coordinator
          if (session.coordinator_email) {
            const coordRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [session.coordinator_email]);
            const coordName = coordRes.rows.length > 0 ? (coordRes.rows[0] as { full_name: string }).full_name : 'Coordinator';
            recipients.push({
              email: session.coordinator_email,
              name: coordName,
              role: 'batch_coordinator' as PortalRole,
              displayRole: 'batch_coordinator',
            });
          }

          // Students & Parents (with region for timezone-aware notifications)
          const studentsRes = await db.query(`
            SELECT bs.student_email, bs.parent_email,
                   u.full_name AS student_name, pu.full_name AS parent_name,
                   sp.assigned_region AS student_region
            FROM batch_students bs
            LEFT JOIN portal_users u ON u.email = bs.student_email
            LEFT JOIN portal_users pu ON pu.email = bs.parent_email
            LEFT JOIN user_profiles sp ON sp.email = bs.student_email
            WHERE bs.batch_id = $1
          `, [session.batch_id]);

          for (const sRow of studentsRes.rows) {
            const st = sRow as { student_email: string; student_name: string; parent_email: string | null; parent_name: string | null; student_region: string | null };
            recipients.push({
              email: st.student_email,
              name: st.student_name || st.student_email,
              role: 'student' as PortalRole,
              displayRole: 'student',
              region: st.student_region,
            });

            if (st.parent_email) {
              recipients.push({
                email: st.parent_email,
                name: st.parent_name || st.parent_email,
                role: 'parent' as PortalRole,
                displayRole: 'parent',
                childName: st.student_name || st.student_email,
                region: st.student_region,
              });
            }
          }

          // ── Generate token and send email per recipient ──────
          for (const recipient of recipients) {
            try {
              // Prefer direct-join token from session_join_tokens (no login needed)
              let joinUrl = await getJoinUrl(session.session_id, recipient.email);

              if (!joinUrl) {
                // Fallback: generate LiveKit token directly
                const token = await createLiveKitToken({
                  roomName,
                  participantIdentity: recipient.email,
                  participantName: recipient.name,
                  role: recipient.role,
                });
                joinUrl = `${baseUrl}/classroom/${session.session_id}?token=${encodeURIComponent(token)}&ws=${encodeURIComponent(wsUrl)}`;
              }

              // Compute recipient's local time based on their region
              const localTime = recipient.region && recipient.region !== 'India'
                ? istToRegionTime(session.start_time, recipient.region)
                : undefined;

              const { subject, html, text } = sessionReminderTemplate({
                recipientName: recipient.name,
                recipientRole: recipient.displayRole,
                subject: session.subject,
                teacherName: session.teacher_name || 'TBA',
                batchName: session.batch_name,
                startTime: startTime12,
                localTime,
                localTimezone: recipient.region && recipient.region !== 'India' ? recipient.region : undefined,
                duration: `${session.duration_minutes} min`,
                topic: session.topic || undefined,
                childName: recipient.childName,
                joinUrl,
                recipientEmail: recipient.email,
                minutesBefore: win.minutesBefore,
              });

              // Dedup tag: [SID:<sessionId>:<windowLabel>]
              const subjectWithId = `${subject} [SID:${session.session_id}:${win.label}]`;

              const logRes = await db.query<{ id: string }>(
                `INSERT INTO email_log (room_id, recipient_email, template_type, subject, status)
                 VALUES (NULL, $1, 'session_reminder', $2, 'queued') RETURNING id`,
                [recipient.email, subjectWithId]
              );
              const logId = logRes.rows[0].id;

              const result = await sendEmail({
                to: recipient.email,
                subject,
                html,
                text,
                priority: 'high',
                waTemplate: 'stibe_class_reminder',
                waParams: [recipient.name, session.subject as string || 'Class', localTime ? `${localTime} ${recipient.region}${` (${startTime12} IST)`}` : `${startTime12} IST`, session.teacher_name as string || 'Teacher', session.batch_name as string || 'Batch'],
              });

              if (result.success) {
                await db.query(`UPDATE email_log SET status = 'sent', smtp_message_id = $1, sent_at = NOW() WHERE id = $2`, [result.messageId || null, logId]);
                totalSent++;

                // Send direct-join link via stibe_class_live template (APPROVED, works outside 24h window)
                if (joinUrl) {
                  fireWhatsApp(
                    recipient.email,
                    `📚 *Join your ${session.subject as string} class (no login needed):*\n${joinUrl}`,
                    undefined,
                    'stibe_class_live',
                    [recipient.name, session.subject as string || 'Class', session.teacher_name as string || 'Teacher', joinUrl],
                  ).catch(() => {});
                }
              } else {
                await db.query(`UPDATE email_log SET status = 'failed', error_message = $1 WHERE id = $2`, [result.error || 'Unknown', logId]);
              }
            } catch (err) {
              console.error(`[session-reminder:${win.label}] Failed to email ${recipient.email} for session ${session.session_id}:`, err);
            }
          }

          sessionsNotified++;
        } catch (err) {
          console.error(`[session-reminder:${win.label}] Failed to process session ${session.session_id}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { sent: totalSent, sessions_notified: sessionsNotified },
      message: totalSent > 0
        ? `Sent ${totalSent} reminder${totalSent > 1 ? 's' : ''} for ${sessionsNotified} session${sessionsNotified > 1 ? 's' : ''}`
        : 'No reminders sent',
    });

  } catch (err) {
    console.error('[session-reminder] Error:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to send session reminder emails',
    }, { status: 500 });
  }
}

// GET handler — identical logic, used by server crontab so no body is needed
export async function GET(req: NextRequest) {
  return POST(req);
}
