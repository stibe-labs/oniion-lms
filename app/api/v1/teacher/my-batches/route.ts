// ═══════════════════════════════════════════════════════════════
// Teacher My-Batches API
// GET /api/v1/teacher/my-batches
//
// Returns all batches assigned to the logged-in teacher via
// the batch_teachers table, with student counts and session stats.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !['teacher', 'owner'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const teacherEmail = user.id; // email

  // Batches where this teacher is assigned (via batch_teachers)
  const batchesRes = await db.query(
    `SELECT
       b.batch_id, b.batch_name, b.batch_type, b.grade, b.section,
       b.subjects, b.board, b.status, b.notes, b.created_at,
       b.coordinator_email, b.academic_operator_email,
       bt.subject AS assigned_subject,
       COALESCE(sc.student_count, 0)::int AS student_count,
       COALESCE(ss.total_sessions, 0)::int AS total_sessions,
       COALESCE(ss.completed_sessions, 0)::int AS completed_sessions,
       COALESCE(ss.upcoming_sessions, 0)::int AS upcoming_sessions,
       COALESCE(ss.live_sessions, 0)::int AS live_sessions,
       COALESCE(ss.cancelled_sessions, 0)::int AS cancelled_sessions
     FROM batch_teachers bt
     JOIN batches b ON b.batch_id = bt.batch_id
     LEFT JOIN (
       SELECT batch_id, COUNT(*) AS student_count FROM batch_students GROUP BY batch_id
     ) sc ON sc.batch_id = b.batch_id
     LEFT JOIN (
       SELECT
         batch_id,
         COUNT(*) AS total_sessions,
         COUNT(*) FILTER (WHERE status = 'ended') AS completed_sessions,
         COUNT(*) FILTER (WHERE status = 'scheduled') AS upcoming_sessions,
         COUNT(*) FILTER (WHERE status = 'live') AS live_sessions,
         COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_sessions
       FROM batch_sessions
       WHERE teacher_email = $1
       GROUP BY batch_id
     ) ss ON ss.batch_id = b.batch_id
     WHERE bt.teacher_email = $1
     ORDER BY b.status ASC, b.created_at DESC`,
    [teacherEmail]
  );

  // Get students for each batch (for expanded view)
  const batchIds = batchesRes.rows.map((r: Record<string, unknown>) => r.batch_id);

  let students: Record<string, unknown>[] = [];
  if (batchIds.length > 0) {
    const studentsRes = await db.query(
      `SELECT
         bs.batch_id, bs.student_email, bs.parent_email,
         u.full_name AS student_name, u.is_active
       FROM batch_students bs
       LEFT JOIN portal_users u ON u.email = bs.student_email
       WHERE bs.batch_id = ANY($1::text[])
       ORDER BY u.full_name`,
      [batchIds]
    );
    students = studentsRes.rows as Record<string, unknown>[];
  }

  // Group students by batch
  const studentsByBatch: Record<string, Record<string, unknown>[]> = {};
  for (const s of students) {
    const bid = s.batch_id as string;
    if (!studentsByBatch[bid]) studentsByBatch[bid] = [];
    studentsByBatch[bid].push(s);
  }

  const batches = batchesRes.rows.map((b: Record<string, unknown>) => ({
    ...b,
    students: studentsByBatch[b.batch_id as string] || [],
  }));

  return NextResponse.json({
    success: true,
    data: {
      batches,
      summary: {
        total_batches: batches.length,
        active_batches: batches.filter((b: Record<string, unknown>) => b.status === 'active').length,
      },
    },
  });
}
