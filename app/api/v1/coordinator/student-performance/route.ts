// ═══════════════════════════════════════════════════════════════
// GET /api/v1/coordinator/student-performance
// Returns student performance data for the coordinator's batches
// Query params: ?batch_id=... (optional filter)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || user.role !== 'batch_coordinator') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const batchId = req.nextUrl.searchParams.get('batch_id');

  try {
    // Get students from coordinator's batches
    const studentsResult = await db.query(`
      SELECT
        bs.student_email,
        bs.batch_id,
        b.batch_name AS batch_name,
        b.grade,
        b.section,
        u.full_name AS student_name,
        -- Attendance stats
        (SELECT COUNT(*) FROM batch_sessions sess WHERE sess.batch_id = bs.batch_id AND sess.status = 'ended') AS total_sessions,
        (SELECT COUNT(*) FROM attendance_sessions a
          JOIN rooms r ON r.room_id = a.room_id
          JOIN batch_sessions sess ON sess.livekit_room_name = r.livekit_room_id AND sess.batch_id = bs.batch_id
          WHERE a.participant_email = bs.student_email AND a.status = 'present'
        ) AS sessions_present,
        -- Exam stats
        (SELECT COUNT(*) FROM exam_attempts ea
          JOIN exams e ON e.id = ea.exam_id
          WHERE ea.student_email = bs.student_email AND ea.status = 'graded'
          AND e.grade = b.grade
        ) AS exams_taken,
        (SELECT ROUND(AVG(ea.percentage)::numeric, 1) FROM exam_attempts ea
          JOIN exams e ON e.id = ea.exam_id
          WHERE ea.student_email = bs.student_email AND ea.status = 'graded'
          AND e.grade = b.grade
        ) AS avg_exam_score
      FROM batch_students bs
      JOIN batches b ON b.batch_id = bs.batch_id
      LEFT JOIN portal_users u ON u.email = bs.student_email
      WHERE b.coordinator_email = $1
        ${batchId ? 'AND bs.batch_id = $2' : ''}
      ORDER BY b.batch_name, u.full_name
    `, batchId ? [user.id, batchId] : [user.id]);

    // Get batch-level summary
    const batchesResult = await db.query(`
      SELECT
        b.batch_id AS id,
        b.batch_name AS name,
        b.grade,
        b.section,
        b.status,
        (SELECT COUNT(*) FROM batch_students bs WHERE bs.batch_id = b.batch_id) AS student_count,
        (SELECT COUNT(*) FROM batch_sessions sess WHERE sess.batch_id = b.batch_id AND sess.status = 'ended') AS completed_sessions
      FROM batches b
      WHERE b.coordinator_email = $1
        AND b.status = 'active'
        ${batchId ? 'AND b.batch_id = $2' : ''}
      ORDER BY b.batch_name
    `, batchId ? [user.id, batchId] : [user.id]);

    const students = studentsResult.rows.map((r: Record<string, unknown>) => ({
      email: r.student_email,
      name: r.student_name ?? r.student_email,
      batch_id: r.batch_id,
      batch_name: r.batch_name,
      grade: r.grade,
      section: r.section,
      total_sessions: Number(r.total_sessions) || 0,
      sessions_present: Number(r.sessions_present) || 0,
      attendance_rate: Number(r.total_sessions) > 0
        ? Math.round((Number(r.sessions_present) / Number(r.total_sessions)) * 100)
        : 0,
      exams_taken: Number(r.exams_taken) || 0,
      avg_exam_score: r.avg_exam_score != null ? Number(r.avg_exam_score) : null,
    }));

    const batches = batchesResult.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      grade: r.grade,
      section: r.section,
      status: r.status,
      student_count: Number(r.student_count) || 0,
      completed_sessions: Number(r.completed_sessions) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: { students, batches },
    });
  } catch (err) {
    console.error('[Coordinator] student performance error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
