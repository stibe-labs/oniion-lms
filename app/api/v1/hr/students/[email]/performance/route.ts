// ═══════════════════════════════════════════════════════════════
// HR Student Performance API — GET /api/v1/hr/students/[email]/performance
// Returns batch memberships, attendance stats, exam results for
// a specific student — viewable by hr, owner, academic_operator,
// batch_coordinator, ghost_observer
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

const ALLOWED_ROLES = ['owner', 'hr_associate', 'hr', 'academic_operator', 'batch_coordinator', 'ghost_observer'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !ALLOWED_ROLES.includes(user.role))
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { email: rawEmail } = await params;
    const studentEmail = decodeURIComponent(rawEmail).toLowerCase();

    // ── Batch memberships + per-batch stats ───────────────────
    const batchesResult = await db.query(
      `SELECT
         b.batch_id AS id,
         b.batch_name AS name,
         b.batch_type AS type,
         b.grade,
         b.section,
         b.subjects,
         b.status,
         bs.added_at,
         coord.full_name AS coordinator_name,
         -- Session counts
         (SELECT COUNT(*)           FROM batch_sessions bss WHERE bss.batch_id = b.batch_id) AS total_sessions,
         (SELECT COUNT(*) FILTER (WHERE bss.status = 'completed')
                                    FROM batch_sessions bss WHERE bss.batch_id = b.batch_id) AS done_sessions,
         -- Attendance for this student in this batch's rooms
         (SELECT COUNT(a.*)
            FROM attendance_sessions a
            JOIN batch_sessions bss2 ON bss2.livekit_room_name = a.room_id
           WHERE a.participant_email = $1
             AND a.participant_role = 'student'
             AND bss2.batch_id = b.batch_id
             AND a.status IN ('present', 'late'))   AS present,
         (SELECT COUNT(a2.*)
            FROM attendance_sessions a2
            JOIN batch_sessions bss3 ON bss3.livekit_room_name = a2.room_id
           WHERE a2.participant_email = $1
             AND a2.participant_role = 'student'
             AND bss3.batch_id = b.batch_id)        AS att_total
       FROM batch_students bs
       JOIN batches b ON b.batch_id = bs.batch_id
       LEFT JOIN portal_users coord ON coord.email = b.coordinator_email
       WHERE bs.student_email = $1
         AND b.status != 'archived'
       ORDER BY bs.added_at DESC`,
      [studentEmail]
    );

    // ── Overall attendance summary ────────────────────────────
    const attResult = await db.query<{
      total: string; present: string; late: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE a.status IN ('present','late'))::text AS present,
         COUNT(*) FILTER (WHERE a.late_join = true)::text AS late
       FROM attendance_sessions a
       WHERE a.participant_email = $1
         AND a.participant_role = 'student'`,
      [studentEmail]
    );

    // ── Exam results ──────────────────────────────────────────
    const examsResult = await db.query(
      `SELECT
         e.id,
         e.title,
         e.subject,
         e.total_marks,
         e.passing_marks,
         ea.score,
         ea.percentage,
         ea.status AS attempt_status,
         ea.submitted_at
       FROM exam_attempts ea
       JOIN exams e ON e.id = ea.exam_id
       WHERE ea.student_email = $1
         AND ea.status IN ('graded', 'submitted')
       ORDER BY ea.submitted_at DESC
       LIMIT 10`,
      [studentEmail]
    );

    const att = attResult.rows[0];
    const total    = Number(att?.total   ?? 0);
    const present  = Number(att?.present ?? 0);

    const batches = batchesResult.rows.map(b => ({
      id:           b.id,
      name:         b.name,
      type:         b.type,
      grade:        b.grade,
      section:      b.section,
      subjects:     b.subjects ?? [],
      status:       b.status,
      enrolled_at:  b.added_at,
      coordinator:  b.coordinator_name ?? null,
      stats: {
        total_sessions: Number(b.total_sessions ?? 0),
        done_sessions:  Number(b.done_sessions  ?? 0),
        att_total:      Number(b.att_total ?? 0),
        present:        Number(b.present   ?? 0),
        rate: Number(b.att_total ?? 0) > 0
          ? Number(((Number(b.present ?? 0) / Number(b.att_total ?? 0)) * 100).toFixed(1))
          : 0,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        batches,
        attendance: {
          total_classes:   total,
          present,
          absent:          total - present,
          late:            Number(att?.late ?? 0),
          attendance_rate: total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0,
        },
        exams: examsResult.rows.map(e => ({
          id:             e.id,
          title:          e.title,
          subject:        e.subject,
          total_marks:    e.total_marks,
          passing_marks:  e.passing_marks,
          score:          e.score,
          percentage:     e.percentage ? Number(e.percentage) : null,
          attempt_status: e.attempt_status,
          submitted_at:   e.submitted_at,
        })),
      },
    });
  } catch (err) {
    console.error('[hr/students/performance] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
