// ═══════════════════════════════════════════════════════════════
// Exams API — GET + POST /api/v1/exams
// GET: List exams (filtered by role)
// POST: Create exam (teacher/operator/owner)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { createExam, getTeacherExams, getStudentExams } from '@/lib/exam';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (user.role === 'student') {
      const exams = await getStudentExams(user.id);
      return NextResponse.json({ success: true, data: { exams } });
    }

    if (user.role === 'teacher') {
      const exams = await getTeacherExams(user.id);
      return NextResponse.json({ success: true, data: { exams } });
    }

    // Owner, batch_coordinator, academic_operator see all
    if (['owner', 'batch_coordinator', 'academic_operator'].includes(user.role)) {
      const result = await db.query(
        `SELECT e.*,
                (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) AS question_count,
                (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id) AS attempt_count,
                u.full_name AS creator_name
         FROM exams e
         LEFT JOIN portal_users u ON u.email = e.created_by
         ORDER BY e.created_at DESC LIMIT 200`
      );
      return NextResponse.json({ success: true, data: { exams: result.rows } });
    }

    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  } catch (err) {
    console.error('[exams] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'academic_operator', 'owner'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { title, subject, grade, exam_type, duration_minutes, passing_marks, total_marks, scheduled_at, ends_at, questions, batch_ids } = body;

    if (!title || !subject || !grade || !duration_minutes || !questions || questions.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields: title, subject, grade, duration_minutes, questions' }, { status: 400 });
    }

    const exam = await createExam({
      title, subject, grade,
      examType: exam_type,
      durationMinutes: duration_minutes,
      passingMarks: passing_marks || 0,
      totalMarks: total_marks || 0,
      scheduledAt: scheduled_at,
      endsAt: ends_at,
      createdBy: user.id,
      questions,
      batchIds: batch_ids,
    });

    return NextResponse.json({ success: true, data: exam });
  } catch (err) {
    console.error('[exams] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
