// ---------------------------------------------------------------
// Session Exam Results API — /api/v1/session-exam/results
// GET → fetch exam results for a room/session/student
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);

  const url = req.nextUrl;
  const roomId = url.searchParams.get('room_id');
  const sessionId = url.searchParams.get('session_id');
  const topicId = url.searchParams.get('topic_id');
  const studentEmail = url.searchParams.get('student_email');

  let where = 'WHERE 1=1';
  const params: string[] = [];

  if (roomId) { params.push(roomId); where += ` AND r.room_id = $${params.length}`; }
  if (sessionId) { params.push(sessionId); where += ` AND r.session_id = $${params.length}`; }
  if (topicId) { params.push(topicId); where += ` AND r.topic_id = $${params.length}`; }
  if (studentEmail) { params.push(studentEmail); where += ` AND r.student_email = $${params.length}`; }

  if (params.length === 0) return fail('At least one filter is required');

  const result = await db.query(`
    SELECT r.id, r.topic_id, r.session_id, r.room_id,
           r.student_email, r.student_name, r.student_grade, r.parent_email,
           r.teacher_email, r.teacher_name,
           r.subject, r.topic_title, r.total_questions, r.answered, r.skipped,
           r.score, r.total_marks, r.percentage, r.grade_letter,
           r.time_taken_seconds, r.answers,
           r.violations, r.tab_switch_count, r.auto_submitted,
           r.started_at, r.completed_at, r.created_at
    FROM   session_exam_results r
    ${where}
    ORDER BY r.created_at DESC
  `, params);

  return NextResponse.json({ success: true, data: result.rows });
}
