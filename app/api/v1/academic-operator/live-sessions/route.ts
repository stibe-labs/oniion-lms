// ═══════════════════════════════════════════════════════════════
// GET /api/v1/academic-operator/live-sessions
// Returns ALL live + today's scheduled sessions for the AO
// (no coordinator_email filter — AO sees everything)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { listParticipants } from '@/lib/livekit';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !['academic_operator', 'academic', 'owner'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // All currently live sessions
  const liveResult = await db.query(
    `SELECT s.session_id, s.batch_id, b.batch_name, s.subject,
            s.teacher_email, s.teacher_name, s.livekit_room_name,
            s.status, s.started_at, s.duration_minutes,
            r.room_id, r.scheduled_start,
            b.coordinator_email,
            (SELECT COUNT(*) FROM batch_students bs WHERE bs.batch_id = s.batch_id) AS student_count
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     LEFT JOIN rooms r ON r.batch_session_id = s.session_id AND r.status IN ('live', 'scheduled')
     WHERE s.status = 'live'
     ORDER BY s.started_at`,
    []
  );

  // Today's scheduled sessions (not yet live)
  const scheduledResult = await db.query(
    `SELECT s.session_id, s.batch_id, b.batch_name, s.subject,
            s.teacher_email, s.teacher_name, s.livekit_room_name,
            s.status, s.scheduled_date, s.start_time, s.duration_minutes,
            s.go_live_status, s.go_live_requested_at,
            r.room_id AS room_exists, r.room_id AS room_name,
            b.batch_type, b.coordinator_email,
            (SELECT COUNT(*) FROM batch_students bs WHERE bs.batch_id = s.batch_id) AS student_count
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     LEFT JOIN rooms r ON r.batch_session_id = s.session_id AND r.status = 'scheduled'
     WHERE s.status = 'scheduled'
       AND s.scheduled_date = CURRENT_DATE
     ORDER BY s.start_time`,
    []
  );

  // Get waiting participant counts for scheduled rooms
  const scheduledRows = scheduledResult.rows as Record<string, unknown>[];
  const waitingCounts = new Map<string, number>();
  await Promise.all(scheduledRows.filter(r => r.room_exists).map(async (r) => {
    const roomName = String(r.room_name);
    try {
      const participants = await listParticipants(roomName);
      const studentCount = participants.filter(p => {
        try {
          const m = JSON.parse(p.metadata || '{}');
          return m.portal_role === 'student' || m.effective_role === 'student';
        } catch {
          return p.identity.startsWith('student_');
        }
      }).length;
      waitingCounts.set(String(r.session_id), studentCount);
    } catch { /* room may not exist in LiveKit yet */ }
  }));

  return NextResponse.json({
    success: true,
    data: {
      sessions: liveResult.rows.map((r: Record<string, unknown>) => ({
        session_id: r.session_id,
        batch_id: r.batch_id,
        batch_name: r.batch_name,
        subject: r.subject,
        teacher_email: r.teacher_email,
        teacher_name: r.teacher_name,
        room_name: r.livekit_room_name || r.room_id,
        status: r.status,
        started_at: r.started_at,
        scheduled_start: r.scheduled_start,
        duration_minutes: Number(r.duration_minutes) || 90,
        student_count: Number(r.student_count) || 0,
        coordinator_email: r.coordinator_email || null,
      })),
      scheduled: scheduledRows.map((r) => ({
        session_id: r.session_id,
        batch_id: r.batch_id,
        batch_name: r.batch_name,
        subject: r.subject,
        teacher_email: r.teacher_email,
        teacher_name: r.teacher_name,
        scheduled_date: r.scheduled_date,
        start_time: r.start_time,
        duration_minutes: Number(r.duration_minutes) || 90,
        student_count: Number(r.student_count) || 0,
        room_exists: !!r.room_exists,
        room_name: r.room_name || null,
        go_live_status: r.go_live_status || null,
        go_live_requested_at: r.go_live_requested_at || null,
        batch_type: r.batch_type || null,
        coordinator_email: r.coordinator_email || null,
        waiting_students: waitingCounts.get(String(r.session_id)) ?? 0,
      })),
    },
  });
}
