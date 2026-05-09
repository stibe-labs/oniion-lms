// ═══════════════════════════════════════════════════════════════
// Batch Session Auto-Start API
// POST /api/v1/batch-sessions/auto-start
//
// Checks for scheduled sessions whose prep window has opened
// (current time >= start_time - prep_buffer_minutes) on today's
// date and automatically starts them, creating LiveKit rooms
// and generating participant tokens.
//
// Called periodically by the AO dashboard (every 60s) so that
// teachers & students can enter the lobby during prep time.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { ensureRoom, createLiveKitToken } from '@/lib/livekit';
import type { PortalRole } from '@/types';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // Find sessions that should be auto-started:
    // - status = 'scheduled'
    // - scheduled_date = today (IST)
    // - current time (IST) >= start_time - prep_buffer_minutes
    const sessionsRes = await db.query(`
      SELECT s.session_id, s.batch_id, s.subject, s.teacher_email, s.teacher_name,
             s.livekit_room_name, s.start_time, s.prep_buffer_minutes,
             s.scheduled_date, s.duration_minutes,
             b.batch_name, b.coordinator_email, b.academic_operator_email,
             b.grade, b.section, b.batch_type
      FROM batch_sessions s
      JOIN batches b ON b.batch_id = s.batch_id
      WHERE s.status = 'scheduled'
        AND s.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= (s.start_time - (s.prep_buffer_minutes || ' minutes')::interval)
    `);

    if (sessionsRes.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { started: 0, sessions: [] },
        message: 'No sessions to auto-start',
      });
    }

    const startedSessions: { session_id: string; subject: string; batch_name: string; participant_count: number }[] = [];

    for (const row of sessionsRes.rows) {
      const session = row as Record<string, unknown>;
      const sessionId = session.session_id as string;
      const roomName = session.livekit_room_name as string;

      try {
        // 1. Create LiveKit room
        await ensureRoom(roomName, JSON.stringify({
          session_id: sessionId,
          batch_id: session.batch_id,
          subject: session.subject,
          batch_name: session.batch_name,
        }));

        // 2. Room enters prep mode — teacher joins lobby, students wait.
        // batch_session stays 'scheduled' until teacher explicitly clicks Go Live.
        // (go-live route changes room + batch_session to 'live' when teacher starts class)

        // 2b. Bridge to rooms table so ghost/coordinator systems see this session.
        // Use +05:30 so the timestamp is stored as IST in UTC-normalised form
        // scheduled_date is a plain "YYYY-MM-DD" string (type parser set in db.ts)
        // start_time is a plain "HH:MM:SS" string — slice to HH:MM for safety
        const rawDate = typeof session.scheduled_date === 'object'
          ? (session.scheduled_date as Date).toISOString().slice(0, 10)
          : (session.scheduled_date as string).slice(0, 10);
        const rawTime = (session.start_time as string).slice(0, 5);
        const scheduledStart = new Date(`${rawDate}T${rawTime}+05:30`);
        const durationMins = Number(session.duration_minutes) || 90;
        // Insert as 'scheduled' — teacher must click Go Live to change to 'live'
        await db.query(
          `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, section, batch_type, status,
                              scheduled_start, duration_minutes, batch_id, batch_session_id, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $10, $11, 'system', NOW(), NOW())
           ON CONFLICT (room_id) DO UPDATE SET
             batch_id = EXCLUDED.batch_id, batch_session_id = EXCLUDED.batch_session_id,
             teacher_email = COALESCE(EXCLUDED.teacher_email, rooms.teacher_email), updated_at = NOW()`,
          [roomName, `${session.batch_name} — ${session.subject}`, session.teacher_email || null,
           session.subject || null, session.grade || null, session.section || null,
           session.batch_type || 'one_to_many', scheduledStart.toISOString(), durationMins,
           session.batch_id, sessionId]
        );

        // 3. Generate tokens for all participants
        let participantCount = 0;

        // Teacher
        if (session.teacher_email) {
          await createLiveKitToken({
            roomName,
            participantIdentity: session.teacher_email as string,
            participantName: (session.teacher_name as string) || 'Teacher',
            role: 'teacher' as PortalRole,
          });
          participantCount++;
        }

        // Students + Parents
        const students = await db.query(
          `SELECT bs.student_email, bs.parent_email, u.full_name AS student_name,
                  pu.full_name AS parent_name
           FROM batch_students bs
           LEFT JOIN portal_users u ON u.email = bs.student_email
           LEFT JOIN portal_users pu ON pu.email = bs.parent_email
           WHERE bs.batch_id = $1`,
          [session.batch_id]
        );

        for (const s of students.rows) {
          const student = s as { student_email: string; student_name: string; parent_email: string | null; parent_name: string | null };

          await createLiveKitToken({
            roomName,
            participantIdentity: student.student_email,
            participantName: student.student_name || student.student_email,
            role: 'student' as PortalRole,
          });
          participantCount++;

          if (student.parent_email) {
            await createLiveKitToken({
              roomName,
              participantIdentity: student.parent_email,
              participantName: student.parent_name || student.parent_email,
              role: 'parent' as PortalRole,
            });
            participantCount++;
          }
        }

        // Coordinator
        if (session.coordinator_email) {
          const coordRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [session.coordinator_email]);
          const coordName = coordRes.rows.length > 0 ? (coordRes.rows[0] as { full_name: string }).full_name : 'Coordinator';
          await createLiveKitToken({
            roomName,
            participantIdentity: session.coordinator_email as string,
            participantName: coordName,
            role: 'batch_coordinator' as PortalRole,
          });
          participantCount++;
        }

        // Academic Operator
        if (session.academic_operator_email) {
          const aoRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [session.academic_operator_email]);
          const aoName = aoRes.rows.length > 0 ? (aoRes.rows[0] as { full_name: string }).full_name : 'Academic Operator';
          await createLiveKitToken({
            roomName,
            participantIdentity: session.academic_operator_email as string,
            participantName: aoName,
            role: 'academic_operator' as PortalRole,
          });
          participantCount++;
        }

        startedSessions.push({
          session_id: sessionId,
          subject: session.subject as string,
          batch_name: session.batch_name as string,
          participant_count: participantCount,
        });

      } catch (err) {
        console.error(`[auto-start] Failed to start session ${sessionId}:`, err);
        // Continue with next session even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        started: startedSessions.length,
        sessions: startedSessions,
      },
      message: startedSessions.length > 0
        ? `Auto-started ${startedSessions.length} session${startedSessions.length > 1 ? 's' : ''}`
        : 'No sessions needed starting',
    });

  } catch (err) {
    console.error('[auto-start] Error:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to check for auto-start sessions',
    }, { status: 500 });
  }
}
