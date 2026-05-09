// ═══════════════════════════════════════════════════════════════
// Student Session Exam Results — GET /api/v1/student/session-exams
// Returns all live-session exam results for the logged-in student
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Student only' }, { status: 403 });
    }

    const results = await db.query(
      `SELECT ser.id, ser.topic_id, ser.session_id, ser.room_id,
              ser.subject, ser.topic_title,
              ser.total_questions, ser.answered, ser.skipped,
              ser.score, ser.total_marks, ser.percentage, ser.grade_letter,
              ser.time_taken_seconds, ser.tab_switch_count, ser.auto_submitted,
              ser.completed_at, ser.answers,
              ser.teacher_name, ser.teacher_email,
              COALESCE(st.paper_type, '') AS paper_type,
              COALESCE(st.category, 'topic') AS category
       FROM session_exam_results ser
       LEFT JOIN session_exam_topics st ON st.id = ser.topic_id
       WHERE ser.student_email = $1
       ORDER BY ser.completed_at DESC`,
      [user.id]
    );

    // Coerce numeric fields (PG returns numeric/float columns as strings)
    const rows = results.rows.map(r => ({
      ...r,
      total_questions: Number(r.total_questions ?? 0),
      answered: Number(r.answered ?? 0),
      skipped: Number(r.skipped ?? 0),
      score: Number(r.score ?? 0),
      total_marks: Number(r.total_marks ?? 0),
      percentage: Number(r.percentage ?? 0),
      time_taken_seconds: Number(r.time_taken_seconds ?? 0),
      tab_switch_count: Number(r.tab_switch_count ?? 0),
    })) as Array<Record<string, unknown>>;
    const total = rows.length;
    const avgPct = total > 0
      ? Math.round(rows.reduce((s, r) => s + Number(r.percentage || 0), 0) / total)
      : 0;
    const passCount = rows.filter(r => Number(r.percentage || 0) >= 40).length;

    return NextResponse.json({
      success: true,
      data: {
        results: rows,
        summary: { total, avg_percentage: avgPct, pass_count: passCount },
      },
    });
  } catch (err) {
    console.error('[student/session-exams] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
