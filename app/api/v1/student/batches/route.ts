// ═══════════════════════════════════════════════════════════════
// Student Batches API — GET /api/v1/student/batches
// Returns batch memberships for the logged-in student,
// including batch info, per-subject teachers, and coordinator
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['student', 'owner'].includes(user.role))
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const studentEmail = user.id;

    // ── Batches the student belongs to ───────────────────────
    const batchesResult = await db.query(
      `SELECT
         b.batch_id AS id,
         b.batch_name AS name,
         b.batch_type AS type,
         b.grade,
         b.section,
         b.subjects,
         b.status,
         b.max_students,
         b.notes,
         b.created_at,
         bs.added_at,
         coord.full_name AS coordinator_name,
         coord.email AS coordinator_email,
         ao.full_name AS ao_name
       FROM batch_students bs
       JOIN batches b ON b.batch_id = bs.batch_id
       LEFT JOIN portal_users coord ON coord.email = b.coordinator_email
       LEFT JOIN portal_users ao ON ao.email = b.academic_operator_email
       WHERE bs.student_email = $1
         AND b.status != 'archived'
       ORDER BY bs.added_at DESC`,
      [studentEmail]
    );

    const batches = [];

    for (const batch of batchesResult.rows) {
      // Per-batch teacher list
      const teachersResult = await db.query(
        `SELECT
           bt.subject,
           t.full_name AS teacher_name,
           t.email AS teacher_email,
           t.profile_image AS teacher_image
         FROM batch_teachers bt
         JOIN portal_users t ON t.email = bt.teacher_email
         WHERE bt.batch_id = $1
         ORDER BY bt.subject`,
        [batch.id]
      );

      // Session counts for this batch
      const sessionStats = await db.query<{
        total: string;
        completed: string;
        upcoming: string;
      }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'ended') AS completed,
           COUNT(*) FILTER (WHERE status = 'scheduled') AS upcoming
         FROM batch_sessions
         WHERE batch_id = $1`,
        [batch.id]
      );

      // Student's attendance for this batch — uses batch_sessions → rooms path
      // so absent sessions (where student never joined) are correctly counted
      const attendanceStats = await db.query<{
        total: string;
        present: string;
        absent: string;
        late: string;
      }>(
        `SELECT
           COUNT(DISTINCT r.room_id) AS total,
           COUNT(a.room_id) FILTER (WHERE a.status = 'present') AS present,
           COUNT(DISTINCT r.room_id) FILTER (WHERE a.room_id IS NULL) AS absent,
           COUNT(a.room_id) FILTER (WHERE a.late_join = true) AS late
         FROM batch_sessions bsess
         JOIN rooms r ON r.room_id = bsess.livekit_room_name
         LEFT JOIN attendance_sessions a ON a.room_id = r.room_id AND a.participant_email = $1
         WHERE bsess.batch_id = $2
           AND r.status = 'ended'`,
        [studentEmail, batch.id]
      );

      const stats = sessionStats.rows[0];
      const att = attendanceStats.rows[0];
      const attTotal = Number(att?.total || 0);
      const attPresent = Number(att?.present || 0);

      batches.push({
        id: batch.id,
        name: batch.name,
        type: batch.type,
        grade: batch.grade,
        section: batch.section,
        subjects: batch.subjects,
        status: batch.status,
        max_students: batch.max_students,
        notes: batch.notes,
        enrolled_at: batch.added_at,
        coordinator: {
          name: batch.coordinator_name,
          email: batch.coordinator_email,
        },
        ao_name: batch.ao_name,
        teachers: teachersResult.rows,
        stats: {
          total_sessions: Number(stats?.total || 0),
          completed_sessions: Number(stats?.completed || 0),
          upcoming_sessions: Number(stats?.upcoming || 0),
        },
        attendance: {
          total: attTotal,
          present: attPresent,
          absent: Number(att?.absent || 0),
          late: Number(att?.late || 0),
          rate: attTotal > 0 ? Number(((attPresent / attTotal) * 100).toFixed(1)) : 0,
        },
      });
    }

    return NextResponse.json({ success: true, data: { batches } });
  } catch (err) {
    console.error('[student/batches] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
