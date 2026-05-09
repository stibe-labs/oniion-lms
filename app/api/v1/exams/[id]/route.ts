// ═══════════════════════════════════════════════════════════════
// Exam Detail API — GET, PUT /api/v1/exams/[id]
// Also: /api/v1/exams/[id]/start (POST) and /api/v1/exams/[id]/submit (POST)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getExamWithQuestions, startExamAttempt, submitAndGradeExam, getExamResults } from '@/lib/exam';
import { db } from '@/lib/db';
import { sendExamNotifications } from '@/lib/exam-notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/v1/exams/[id] — Get exam detail
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get results
    if (action === 'results') {
      if (!['teacher', 'owner', 'batch_coordinator', 'academic_operator'].includes(user.role)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
      const results = await getExamResults(id);
      return NextResponse.json({ success: true, data: results });
    }

    // Student review — returns their attempt with questions + answers + correct answers
    if (action === 'student-review') {
      if (user.role !== 'student' && user.role !== 'parent' && user.role !== 'owner') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
      const studentEmail = url.searchParams.get('student') || user.id;
      // Students can only view their own results
      if (user.role === 'student' && studentEmail !== user.id) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      // Fetch attempt
      const attemptResult = await db.query(
        `SELECT * FROM exam_attempts WHERE exam_id = $1 AND student_email = $2 ORDER BY created_at DESC LIMIT 1`,
        [id, studentEmail]
      );
      if (attemptResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No attempt found' }, { status: 404 });
      }
      const attempt = attemptResult.rows[0] as Record<string, unknown>;

      // Fetch exam info
      const examResult = await db.query(
        `SELECT id, title, subject, grade, total_marks, passing_marks, duration_minutes, scheduled_at, results_published FROM exams WHERE id = $1`,
        [id]
      );
      if (examResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
      }
      const exam = examResult.rows[0] as Record<string, unknown>;

      // Fetch questions with student's answers
      const answersResult = await db.query(
        `SELECT eq.id AS question_id, eq.question_text, eq.question_type, eq.options, eq.marks,
                eq.correct_answer, eq.topic, eq.difficulty, eq.sort_order,
                ea.selected_option, ea.is_correct, ea.marks_awarded, ea.text_answer
         FROM exam_questions eq
         LEFT JOIN exam_answers ea ON ea.question_id = eq.id AND ea.attempt_id = $2
         WHERE eq.exam_id = $1
         ORDER BY eq.sort_order ASC, eq.created_at ASC`,
        [id, attempt.id]
      );

      // Rank among all graded attempts
      const rankResult = await db.query(
        `SELECT student_email, percentage FROM exam_attempts WHERE exam_id = $1 AND status = 'graded' ORDER BY percentage DESC NULLS LAST`,
        [id]
      );
      const allAttempts = rankResult.rows as Array<Record<string, unknown>>;
      const rank = allAttempts.findIndex(a => a.student_email === studentEmail) + 1;

      return NextResponse.json({
        success: true,
        data: {
          exam,
          attempt,
          questions: answersResult.rows,
          rank,
          total_students: allAttempts.length,
        },
      });
    }

    // Include correct answers only for creators
    const includeAnswers = ['teacher', 'owner', 'academic_operator'].includes(user.role);
    const exam = await getExamWithQuestions(id, includeAnswers);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: exam });
  } catch (err) {
    console.error('[exams/[id]] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/v1/exams/[id] — Update exam (publish, update details)
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'owner', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { published, results_published, title, scheduled_at, ends_at } = body;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (published !== undefined) {
      params.push(published);
      updates.push(`published = $${params.length}`);
    }
    if (results_published !== undefined) {
      params.push(results_published);
      updates.push(`results_published = $${params.length}`);
    }
    if (title) {
      params.push(title);
      updates.push(`title = $${params.length}`);
    }
    if (scheduled_at) {
      params.push(scheduled_at);
      updates.push(`scheduled_at = $${params.length}`);
    }
    if (ends_at) {
      params.push(ends_at);
      updates.push(`ends_at = $${params.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    const result = await db.query(
      `UPDATE exams SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    const exam = result.rows[0] as Record<string, unknown>;

    // Fire-and-forget: send notifications when exam is published or results released
    if (published === true) {
      sendExamNotifications(exam, 'exam_scheduled').catch(err =>
        console.error('[exams] exam_scheduled notification failed:', err));
    }
    if (results_published === true) {
      sendExamNotifications(exam, 'results_published').catch(err =>
        console.error('[exams] results_published notification failed:', err));
    }

    return NextResponse.json({ success: true, data: exam });
  } catch (err) {
    console.error('[exams/[id]] PUT error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/exams/[id] — Start attempt or submit answers
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json();
    const { action, attempt_id, answers } = body;

    // Start attempt
    if (action === 'start') {
      if (user.role !== 'student' && user.role !== 'owner') {
        return NextResponse.json({ success: false, error: 'Only students can start exams' }, { status: 403 });
      }
      try {
        const attempt = await startExamAttempt(id, user.id, user.name);
        return NextResponse.json({ success: true, data: attempt });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start exam';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }

    // Submit answers
    if (action === 'submit') {
      if (!attempt_id || !answers) {
        return NextResponse.json({ success: false, error: 'attempt_id and answers required' }, { status: 400 });
      }
      try {
        const result = await submitAndGradeExam(attempt_id, answers);
        return NextResponse.json({ success: true, data: result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to submit exam';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Use "start" or "submit"' }, { status: 400 });
  } catch (err) {
    console.error('[exams/[id]] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
