import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { getDemoExamQuestions } from '@/lib/demo-exam-questions';

/**
 * GET /api/v1/demo/exam?demo_request_id=<uuid>
 * Public (no auth) — returns exam questions for a demo session.
 * Validates the demo request exists and is in accepted/live status.
 *
 * POST /api/v1/demo/exam
 * Public (no auth) — submits and grades a demo exam.
 * Body: { demo_request_id, answers: [{ question_index, selected_option, time_taken }] }
 */

export async function GET(request: NextRequest) {
  try {
    const demoRequestId = request.nextUrl.searchParams.get('demo_request_id');
    if (!demoRequestId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'demo_request_id is required' },
        { status: 400 }
      );
    }

    // Verify demo request
    const demoResult = await db.query(
      `SELECT id, student_name, student_email, student_grade, subject, status, room_id,
              teacher_email, teacher_name
       FROM demo_requests WHERE id = $1`,
      [demoRequestId]
    );
    if (demoResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Demo request not found' },
        { status: 404 }
      );
    }

    const demo = demoResult.rows[0] as Record<string, unknown>;

    // Check if exam already taken
    const existingExam = await db.query(
      `SELECT id FROM demo_exam_results WHERE demo_request_id = $1`,
      [demoRequestId]
    );
    if (existingExam.rows.length > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Exam has already been taken for this demo session' },
        { status: 409 }
      );
    }

    // Only allow exam for accepted/live/completed demos (completed means room just ended)
    const allowedStatuses = ['accepted', 'live', 'completed'];
    if (!allowedStatuses.includes(demo.status as string)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Demo session is not eligible for exam' },
        { status: 400 }
      );
    }

    // Get questions for the demo subject (grade-aware)
    const subject = (demo.subject as string) || 'Mathematics';
    const studentGrade = (demo.student_grade as string) || '';
    const questions = getDemoExamQuestions(subject, studentGrade);

    // Return questions WITHOUT correct answers
    const safeQuestions = questions.map((q, i) => ({
      index: i,
      question_text: q.question_text,
      options: q.options,
      marks: q.marks,
      topic: q.topic,
    }));

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        demo_request_id: demoRequestId,
        subject,
        student_name: demo.student_name,
        student_grade: demo.student_grade,
        total_questions: safeQuestions.length,
        total_marks: safeQuestions.reduce((s, q) => s + q.marks, 0),
        duration_seconds: 300, // 5 minutes
        time_per_question: 30,
        questions: safeQuestions,
        // Store in server memory for grading (questions with answers)
        // We pass the question texts to verify answers on submit
      },
    });
  } catch (err) {
    console.error('[demo/exam] GET error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { demo_request_id, answers, time_taken_seconds } = body as {
      demo_request_id: string;
      answers: Array<{ question_index: number; selected_option: number | null; time_taken: number }>;
      time_taken_seconds?: number;
    };

    if (!demo_request_id || !answers) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'demo_request_id and answers are required' },
        { status: 400 }
      );
    }

    // Get demo request details
    const demoResult = await db.query(
      `SELECT id, student_name, student_email, student_phone, student_grade,
              subject, room_id, teacher_email, teacher_name, status
       FROM demo_requests WHERE id = $1`,
      [demo_request_id]
    );
    if (demoResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Demo request not found' },
        { status: 404 }
      );
    }

    const demo = demoResult.rows[0] as Record<string, unknown>;

    // Check if exam already taken
    const existingExam = await db.query(
      `SELECT id FROM demo_exam_results WHERE demo_request_id = $1`,
      [demo_request_id]
    );
    if (existingExam.rows.length > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Exam has already been submitted for this demo session' },
        { status: 409 }
      );
    }

    // Re-generate questions (same subject, but we need fresh copy with correct answers)
    // Since questions are preset per subject, the index mapping works as long as
    // we use the same subject. The student sends question_index which maps to the
    // questions they received. We regenerate and grade.
    // 
    // IMPORTANT: We can't re-shuffle because the student had a specific order.
    // Solution: Store questions in the result for verification, and grade purely
    // by checking the student's selected_option against correct_answer for each
    // question they answered.
    const subject = (demo.subject as string) || 'Mathematics';
    const studentGrade = (demo.student_grade as string) || '';
    const allQuestions = getDemoExamQuestions(subject, studentGrade);

    // Grade the answers
    let score = 0;
    let answered = 0;
    let skipped = 0;
    const totalQuestions = allQuestions.length;
    const totalMarks = allQuestions.reduce((s, q) => s + q.marks, 0);

    const gradedAnswers = allQuestions.map((q, i) => {
      const studentAnswer = answers.find(a => a.question_index === i);
      const selectedOption = studentAnswer?.selected_option ?? null;
      const isCorrect = selectedOption !== null && selectedOption === q.correct_answer;
      const marksAwarded = isCorrect ? q.marks : 0;
      
      if (selectedOption !== null) {
        answered++;
      } else {
        skipped++;
      }
      score += marksAwarded;

      return {
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        selected_option: selectedOption,
        is_correct: isCorrect,
        marks: q.marks,
        marks_awarded: marksAwarded,
        time_taken: studentAnswer?.time_taken ?? 0,
        topic: q.topic,
      };
    });

    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
    const gradeLetter = getGradeLetter(percentage);

    // Insert demo exam result
    const insertResult = await db.query(
      `INSERT INTO demo_exam_results (
         demo_request_id, room_id,
         student_email, student_name, student_phone, student_grade,
         teacher_email, teacher_name,
         subject, total_questions, answered, skipped,
         score, total_marks, percentage, grade_letter,
         time_taken_seconds, answers, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
       RETURNING *`,
      [
        demo_request_id, demo.room_id,
        demo.student_email, demo.student_name, demo.student_phone, demo.student_grade,
        demo.teacher_email, demo.teacher_name,
        subject, totalQuestions, answered, skipped,
        score, totalMarks, percentage.toFixed(2), gradeLetter,
        time_taken_seconds || null, JSON.stringify(gradedAnswers),
      ]
    );

    const examResult = insertResult.rows[0] as Record<string, unknown>;

    // Update demo_requests with exam result reference and outcome
    // Only update if status is still active (don't overwrite cancelled/rejected)
    await db.query(
      `UPDATE demo_requests
       SET exam_result_id = $1, outcome = 'completed_with_exam', status = 'completed', updated_at = NOW()
       WHERE id = $2 AND status IN ('accepted', 'live', 'completed')`,
      [examResult.id, demo_request_id]
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: examResult.id,
        score,
        total_marks: totalMarks,
        percentage: Number(percentage.toFixed(2)),
        grade_letter: gradeLetter,
        answered,
        skipped,
        total_questions: totalQuestions,
        answers: gradedAnswers,
      },
    });
  } catch (err) {
    console.error('[demo/exam] POST error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getGradeLetter(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 75) return 'A';
  if (percentage >= 60) return 'B+';
  if (percentage >= 45) return 'B';
  if (percentage >= 30) return 'C+';
  return 'C';
}
