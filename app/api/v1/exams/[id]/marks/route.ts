// ═══════════════════════════════════════════════════════════════
// Offline Exam Marks Entry — POST /api/v1/exams/[id]/marks
// Teachers enter marks for descriptive/offline exam answers.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { submitOfflineMarks, createOfflineAttempt } from '@/lib/exam';
import { db } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/exams/[id]/marks
 * Body:
 *   action: 'grade_attempt' | 'create_offline'
 *
 *   For grade_attempt:
 *     { action: 'grade_attempt', attempt_id, marks: [{ question_id, marks_awarded, feedback? }] }
 *
 *   For create_offline (new attempt for student who took offline exam):
 *     { action: 'create_offline', student_email, student_name, marks: [{ question_id, marks_awarded, feedback? }] }
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = await verifySession(token);
    if (!user || !['teacher', 'batch_coordinator', 'academic_operator', 'owner'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Only teachers and admin roles can enter marks' }, { status: 403 });
    }

    const { id: examId } = await context.params;

    // Verify exam exists
    const examResult = await db.query('SELECT id, exam_type, title FROM exams WHERE id = $1', [examId]);
    if (examResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, attempt_id, student_email, student_name, marks } = body;

    if (!marks || !Array.isArray(marks) || marks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'marks array is required with at least one entry' },
        { status: 400 }
      );
    }

    // Validate each mark entry
    for (const m of marks) {
      if (!m.question_id || m.marks_awarded === undefined || m.marks_awarded === null) {
        return NextResponse.json(
          { success: false, error: 'Each mark entry must have question_id and marks_awarded' },
          { status: 400 }
        );
      }
      if (typeof m.marks_awarded !== 'number' || m.marks_awarded < 0) {
        return NextResponse.json(
          { success: false, error: 'marks_awarded must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    if (action === 'grade_attempt') {
      // Grade an existing attempt (student took online exam with descriptive questions)
      if (!attempt_id) {
        return NextResponse.json({ success: false, error: 'attempt_id required for grade_attempt' }, { status: 400 });
      }
      const result = await submitOfflineMarks(attempt_id, marks, user.id);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'create_offline') {
      // Create a new offline attempt and enter marks
      if (!student_email || !student_name) {
        return NextResponse.json(
          { success: false, error: 'student_email and student_name required for create_offline' },
          { status: 400 }
        );
      }
      try {
        const result = await createOfflineAttempt(examId, student_email, student_name, marks, user.id);
        return NextResponse.json({ success: true, data: result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create offline attempt';
        return NextResponse.json({ success: false, error: msg }, { status: 400 });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "grade_attempt" or "create_offline"' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[exams/marks] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/v1/exams/[id]/marks
 * Get all answers/marks for an exam (for teacher review).
 * Returns per-student breakdown with marks for each question.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = await verifySession(token);
    if (!user || !['teacher', 'batch_coordinator', 'academic_operator', 'owner'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id: examId } = await context.params;

    // Get all attempts with per-question answers
    const result = await db.query(
      `SELECT ea.id AS attempt_id, ea.student_email, ea.student_name,
              ea.score, ea.total_marks, ea.percentage, ea.grade_letter, ea.status,
              json_agg(json_build_object(
                'question_id', ans.question_id,
                'question_text', eq.question_text,
                'question_type', eq.question_type,
                'max_marks', eq.marks,
                'marks_awarded', ans.marks_awarded,
                'is_correct', ans.is_correct,
                'selected_option', ans.selected_option,
                'text_answer', ans.text_answer
              ) ORDER BY eq.sort_order) AS answers
       FROM exam_attempts ea
       LEFT JOIN exam_answers ans ON ans.attempt_id = ea.id
       LEFT JOIN exam_questions eq ON eq.id = ans.question_id
       WHERE ea.exam_id = $1
       GROUP BY ea.id
       ORDER BY ea.student_name`,
      [examId]
    );

    return NextResponse.json({ success: true, data: { attempts: result.rows } });
  } catch (err) {
    console.error('[exams/marks] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
