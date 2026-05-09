import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

/**
 * GET /api/v1/teacher/exam-summary
 *
 * Returns all session exam data for the teacher:
 *   - exam_list: grouped by topic_id (each exam with aggregated stats)
 *   - student_results: all individual results
 *   - batch_map: batch_id → batch_name for grouping
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid session' }, { status: 401 });
    }
    if (!['teacher', 'owner'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const teacherEmail = user.id;

    // ── 1. All individual results for this teacher ──
    // Match by ser.teacher_email OR by rooms.teacher_email (for older records
    // where teacher_email was not stored on the result row)
    const resultsRes = await db.query(
      `SELECT
         ser.id,
         ser.topic_id,
         ser.session_id,
         ser.room_id,
         ser.student_email,
         ser.student_name,
         ser.subject,
         ser.topic_title,
         ser.total_questions,
         ser.answered,
         ser.skipped,
         ser.score,
         ser.total_marks,
         ser.percentage,
         ser.grade_letter,
         ser.time_taken_seconds,
         ser.tab_switch_count,
         ser.auto_submitted,
         ser.completed_at,
         ser.created_at,
         COALESCE(r.batch_id, bs_r.batch_id) AS batch_id,
         COALESCE(ser.session_id, r.batch_session_id) AS effective_session_id
       FROM session_exam_results ser
       LEFT JOIN rooms r ON r.room_id = ser.room_id
       LEFT JOIN batch_sessions bs ON bs.session_id = ser.session_id
       LEFT JOIN rooms bs_r ON bs_r.batch_session_id = bs.session_id
       WHERE ser.teacher_email = $1 OR r.teacher_email = $1
       ORDER BY ser.completed_at DESC`,
      [teacherEmail],
    );

    // ── 2. Exam-level summaries (grouped by topic_id) ──
    const examListRes = await db.query(
      `SELECT
         ser.topic_id,
         ser.topic_title,
         ser.subject,
         MAX(ser.total_questions) AS total_questions,
         MAX(ser.total_marks) AS total_marks,
         COUNT(*)::int AS student_count,
         ROUND(AVG(ser.percentage), 1) AS avg_percentage,
         MAX(ser.percentage) AS highest_percentage,
         MIN(ser.percentage) AS lowest_percentage,
         COUNT(*) FILTER (WHERE ser.percentage >= 40)::int AS pass_count,
         MIN(ser.completed_at) AS first_taken,
         MAX(ser.completed_at) AS last_taken,
         set_t.grade AS topic_grade,
         set_t.category AS topic_category
       FROM session_exam_results ser
       LEFT JOIN session_exam_topics set_t ON set_t.id = ser.topic_id
       LEFT JOIN rooms r ON r.room_id = ser.room_id
       WHERE ser.teacher_email = $1 OR r.teacher_email = $1
       GROUP BY COALESCE(ser.topic_id::text, ser.topic_title), ser.topic_id, ser.topic_title, ser.subject, set_t.grade, set_t.category
       ORDER BY MAX(ser.completed_at) DESC`,
      [teacherEmail],
    );

    // ── 3. Batch map for grouping ──
    const batchMapRes = await db.query(
      `SELECT DISTINCT b.batch_id, b.batch_name, b.grade, b.section, b.subjects
       FROM session_exam_results ser
       LEFT JOIN rooms r ON r.room_id = ser.room_id
       LEFT JOIN batch_sessions bs ON bs.session_id = ser.session_id
       LEFT JOIN batches b ON b.batch_id = COALESCE(r.batch_id, (
         SELECT r2.batch_id FROM rooms r2 WHERE r2.batch_session_id = bs.session_id LIMIT 1
       ))
       WHERE (ser.teacher_email = $1 OR r.teacher_email = $1) AND b.batch_id IS NOT NULL`,
      [teacherEmail],
    );

    // ── 4. Monthly aggregates ──
    const monthlyRes = await db.query(
      `SELECT
         TO_CHAR(ser.completed_at, 'YYYY-MM') AS month,
         COUNT(DISTINCT COALESCE(ser.topic_id::text, ser.topic_title))::int AS exam_count,
         COUNT(*)::int AS result_count,
         ROUND(AVG(ser.percentage), 1) AS avg_percentage
       FROM session_exam_results ser
       LEFT JOIN rooms r ON r.room_id = ser.room_id
       WHERE (ser.teacher_email = $1 OR r.teacher_email = $1) AND ser.completed_at IS NOT NULL
       GROUP BY TO_CHAR(ser.completed_at, 'YYYY-MM')
       ORDER BY month DESC`,
      [teacherEmail],
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        results: resultsRes.rows,
        exam_list: examListRes.rows,
        batches: batchMapRes.rows,
        monthly: monthlyRes.rows,
      },
    });
  } catch (err) {
    console.error('[teacher/exam-summary] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
