// ═══════════════════════════════════════════════════════════════
// Parent Rooms API — GET /api/v1/parent/rooms
// Parents see rooms their children are assigned to.
// Returns UNION of:
//   1. Active LiveKit rooms (live/ended) from rooms table
//   2. Upcoming scheduled sessions from batch_sessions table
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['parent', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Find children linked via batch_students (primary), user_profiles, or admission_requests
  let childEmails: string[] = [];

  const bsResult = await db.query(
    `SELECT DISTINCT student_email FROM batch_students WHERE parent_email = $1`,
    [user.id]
  );
  childEmails = bsResult.rows.map((r: Record<string, unknown>) => String(r.student_email));

  if (childEmails.length === 0) {
    const upResult = await db.query(
      `SELECT email FROM user_profiles WHERE parent_email = $1`,
      [user.id]
    );
    childEmails = upResult.rows.map((r: Record<string, unknown>) => String(r.email));
  }

  if (childEmails.length === 0) {
    const admResult = await db.query(
      `SELECT DISTINCT student_email FROM admission_requests
       WHERE parent_email = $1 AND status = 'active'`,
      [user.id]
    );
    childEmails = admResult.rows.map((r: Record<string, unknown>) => String(r.student_email));
  }

  if (childEmails.length === 0) {
    return NextResponse.json({ success: true, data: { rooms: [] } });
  }

  // 1. Live / ended rooms from rooms table (real-time classroom sessions)
  const roomsResult = await db.query(
    `SELECT DISTINCT
       r.room_id,
       r.room_name,
       r.subject,
       r.grade,
       r.section,
       r.teacher_email,
       r.status,
       r.scheduled_start,
       r.duration_minutes,
       ra.participant_email AS student_email,
       COALESCE(pu.full_name, ra.participant_email) AS student_name,
       r.batch_id,
       NULL::text AS batch_session_id
     FROM rooms r
     JOIN room_assignments ra ON ra.room_id = r.room_id
     LEFT JOIN portal_users pu ON pu.email = ra.participant_email
     WHERE ra.participant_email = ANY($1)
       AND ra.participant_type = 'student'
       AND r.status IN ('live', 'ended')
     ORDER BY r.scheduled_start DESC
     LIMIT 60`,
    [childEmails]
  );

  // 2. Upcoming batch_sessions (next 30 days) — includes scheduled sessions without rooms
  const sessionsResult = await db.query(
    `SELECT DISTINCT
       COALESCE(r.room_id, s.livekit_room_name, s.session_id::text) AS room_id,
       COALESCE(r.room_name, b.batch_name || ' — ' || s.subject) AS room_name,
       s.subject,
       b.grade,
       b.section,
       s.teacher_email,
       CASE
         WHEN r.status IN ('live', 'ended') THEN r.status
         WHEN s.status = 'cancelled' THEN 'cancelled'
         ELSE 'scheduled'
       END AS status,
       (s.scheduled_date + s.start_time)::timestamptz AT TIME ZONE 'Asia/Kolkata' AS scheduled_start,
       s.duration_minutes,
       bs.student_email,
       COALESCE(pu.full_name, bs.student_email) AS student_name,
       b.batch_id,
       s.session_id::text AS batch_session_id
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     JOIN batch_students bs ON bs.batch_id = s.batch_id AND bs.student_email = ANY($1)
     LEFT JOIN portal_users pu ON pu.email = bs.student_email
     LEFT JOIN rooms r ON r.room_id = s.livekit_room_name
     WHERE s.status IN ('scheduled', 'live', 'prep')
       AND s.scheduled_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 1
       AND s.scheduled_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date + 30
     ORDER BY scheduled_start ASC
     LIMIT 60`,
    [childEmails]
  );

  // Merge: deduplicate by room_id, prefer live rooms over scheduled sessions
  const seen = new Set<string>();
  const merged: Record<string, unknown>[] = [];

  for (const row of roomsResult.rows) {
    const key = String(row.room_id);
    if (!seen.has(key)) { seen.add(key); merged.push(row); }
  }
  for (const row of sessionsResult.rows) {
    const key = String(row.room_id);
    if (!seen.has(key)) { seen.add(key); merged.push(row); }
  }

  // Sort: live first, then by scheduled_start desc
  merged.sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    return new Date(b.scheduled_start as string).getTime() - new Date(a.scheduled_start as string).getTime();
  });

  return NextResponse.json({ success: true, data: { rooms: merged } });
}
