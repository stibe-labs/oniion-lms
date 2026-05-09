// ---------------------------------------------------------------
// Session Exam API — /api/v1/session-exam
// GET  → fetch questions for student (no correct_answer)
// POST → submit answers, grade, store results
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getPlatformName } from '@/lib/platform-config';

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

function getGradeLetter(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B+';
  if (pct >= 45) return 'B';
  if (pct >= 30) return 'C+';
  return 'C';
}

// ── GET: Fetch questions for a topic (student-facing) ────────
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const topicId = url.searchParams.get('topic_id');
  const sessionId = url.searchParams.get('session_id');
  const studentEmail = url.searchParams.get('student_email');
  const studentName = url.searchParams.get('student_name');
  const roomId = url.searchParams.get('room_id');

  if (!topicId) return fail('topic_id is required');

  // Verify topic exists and is ready
  const topicResult = await db.query(
    `SELECT id, title, subject, grade, question_count FROM session_exam_topics WHERE id = $1 AND status = 'ready'`,
    [topicId],
  );
  if (topicResult.rows.length === 0) return fail('Exam topic not found or not ready', 404);
  const topic = topicResult.rows[0];

  // (Retakes allowed — previous result is overwritten on re-submit)

  const questionsResult = await db.query(`
    SELECT id, question_text, options, marks, difficulty, sort_order, image_url
    FROM   session_exam_questions
    WHERE  topic_id = $1
    ORDER BY sort_order
  `, [topicId]);

  // Shuffle questions using Fisher-Yates
  const questions = questionsResult.rows.map((q: Record<string, unknown>, idx: number) => ({
    index: idx,
    question_text: q.question_text,
    options: q.options,
    marks: q.marks,
    image_url: q.image_url || null,
    topic: topic.title,
    _id: q.id, // internal ref for grading
  }));

  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  // Re-index after shuffle
  const shuffled = questions.map((q: Record<string, unknown>, idx: number) => ({
    ...q,
    index: idx,
  }));

  return NextResponse.json({
    success: true,
    data: {
      topic_id: topic.id,
      subject: topic.subject,
      topic_title: topic.title,
      student_name: studentName || '',
      student_grade: topic.grade,
      total_questions: shuffled.length,
      total_marks: shuffled.reduce((s: number, q: Record<string, unknown>) => s + (q.marks as number), 0),
      duration_seconds: shuffled.length * 60, // 60s per question
      questions: shuffled.map((q: Record<string, unknown>) => ({
        index: q.index,
        question_text: q.question_text,
        options: q.options,
        marks: q.marks,
        image_url: q.image_url || null,
        topic: q.topic,
      })),
      // Internal: keep question IDs for grading (sent but not exposed to client rendering)
      _question_ids: shuffled.map((q: Record<string, unknown>) => q._id),
    },
  });
}

// ── POST: Submit answers and grade ───────────────────────────
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body');
  }

  const {
    topic_id,
    session_id,
    room_id,
    student_email: body_email,
    student_name: body_name,
    student_grade,
    parent_email,
    teacher_email,
    teacher_name,
    answers,
    time_taken_seconds,
    question_ids, // ordered question DB IDs matching the shuffled order
    violations,
    tab_switch_count,
    auto_submitted,
  } = body as {
    topic_id: string;
    session_id?: string;
    room_id?: string;
    student_email: string;
    student_name: string;
    student_grade?: string;
    parent_email?: string;
    teacher_email?: string;
    teacher_name?: string;
    answers: Array<{ question_index: number; selected_option: number | null; time_taken: number }>;
    time_taken_seconds?: number;
    question_ids: string[];
    violations?: Array<{ type: string; timestamp: number; detail?: string }>;
    tab_switch_count?: number;
    auto_submitted?: boolean;
  };

  // Resolve student identity — body values may be empty if async fetch didn't complete;
  // fall back to JWT cookie (authoritative source)
  let student_email = body_email;
  let student_name = body_name;
  if (!student_email || !student_name) {
    try {
      const token = req.cookies.get(COOKIE_NAME)?.value;
      if (token) {
        const session = await verifySession(token);
        if (session?.id) student_email = student_email || session.id;
        if (session?.name) student_name = student_name || session.name;
      }
    } catch { /* cookie missing or invalid — continue with body values */ }
  }

  if (!topic_id || !student_email || !student_name || !Array.isArray(answers) || !Array.isArray(question_ids)) {
    console.error('[session-exam] Validation fail:', { topic_id: !!topic_id, student_email: !!student_email, student_name: !!student_name, answers: Array.isArray(answers), question_ids: Array.isArray(question_ids) });
    return fail('Missing required fields: topic_id, student_email, student_name, answers, question_ids');
  }

  // Resolve teacher_email from rooms table if not provided
  let resolved_teacher_email = (teacher_email as string) || null;
  let resolved_teacher_name = (teacher_name as string) || null;
  if (!resolved_teacher_email && room_id) {
    try {
      const roomRes = await db.query(
        `SELECT teacher_email FROM rooms WHERE room_id = $1`,
        [room_id],
      );
      if (roomRes.rows.length > 0 && roomRes.rows[0].teacher_email) {
        resolved_teacher_email = roomRes.rows[0].teacher_email as string;
      }
    } catch { /* room lookup failed — continue without teacher_email */ }
  }

  // Verify topic
  const topicResult = await db.query(
    `SELECT id, title, subject, grade FROM session_exam_topics WHERE id = $1`,
    [topic_id],
  );
  if (topicResult.rows.length === 0) return fail('Topic not found', 404);
  const topic = topicResult.rows[0] as { id: string; title: string; subject: string; grade: string };

  // Delete any previous attempt for this student+topic+session so retakes get fresh results.
  // This also handles the beacon+normal-submit race: the second write simply overwrites.
  if (session_id) {
    await db.query(
      `DELETE FROM session_exam_results WHERE topic_id = $1 AND session_id = $2 AND student_email = $3`,
      [topic_id, session_id, student_email],
    ).catch(() => {}); // non-fatal
  }

  // Fetch correct answers for the questions in order
  const questionsResult = await db.query(`
    SELECT id, question_text, options, correct_answer, marks
    FROM   session_exam_questions
    WHERE  topic_id = $1
  `, [topic_id]);

  // Build question lookup by ID
  const qMap = new Map<string, Record<string, unknown>>();
  for (const q of questionsResult.rows) {
    qMap.set(q.id as string, q);
  }

  // Grade each answer
  let score = 0;
  let totalMarks = 0;
  let answeredCount = 0;
  let skippedCount = 0;
  const gradedAnswers: Array<Record<string, unknown>> = [];

  for (let i = 0; i < question_ids.length; i++) {
    const qId = question_ids[i];
    const q = qMap.get(qId);
    if (!q) continue;

    totalMarks += q.marks as number;
    const answer = answers.find((a: { question_index: number }) => a.question_index === i);
    const selectedOption = answer?.selected_option ?? null;
    const isCorrect = selectedOption !== null && selectedOption === q.correct_answer;
    const marksAwarded = isCorrect ? (q.marks as number) : 0;

    if (selectedOption !== null) answeredCount++;
    else skippedCount++;

    if (isCorrect) score += q.marks as number;

    gradedAnswers.push({
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      selected_option: selectedOption,
      is_correct: isCorrect,
      marks: q.marks,
      marks_awarded: marksAwarded,
      time_taken: answer?.time_taken ?? 0,
      topic: topic.title,
    });
  }

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0;
  const gradeLetter = getGradeLetter(percentage);

  // Insert result (handle duplicate gracefully — beacon + normal submit race)
  let insertResult;
  try {
    insertResult = await db.query(`
      INSERT INTO session_exam_results
        (topic_id, session_id, room_id,
         student_email, student_name, student_grade, parent_email,
         teacher_email, teacher_name,
         subject, topic_title, total_questions, answered, skipped,
         score, total_marks, percentage, grade_letter, time_taken_seconds,
         answers, violations, tab_switch_count, auto_submitted, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
      RETURNING id
    `, [
      topic_id, session_id || null, room_id || null,
      student_email, student_name, student_grade || null, parent_email || null,
      resolved_teacher_email, resolved_teacher_name,
      topic.subject, topic.title, question_ids.length, answeredCount, skippedCount,
      score, totalMarks, percentage, gradeLetter, time_taken_seconds || null,
      JSON.stringify(gradedAnswers),
      violations ? JSON.stringify(violations) : null,
      tab_switch_count || 0,
      auto_submitted || false,
    ] as unknown[]);
  } catch (err: unknown) {
    // Handle unique constraint violation (duplicate submit from beacon + normal race)
    const pgErr = err as { code?: string; detail?: string; message?: string };
    console.error('[session-exam] INSERT failed:', pgErr.code, pgErr.message, pgErr.detail);
    if (pgErr.code === '23505') {
      // Already saved — fetch the existing result and return success
      const existing = await db.query(
        `SELECT id, score, total_marks, percentage, grade_letter, answered, skipped, total_questions, answers
         FROM session_exam_results WHERE topic_id = $1 AND session_id = $2 AND student_email = $3`,
        [topic_id, session_id || null, student_email],
      );
      if (existing.rows.length > 0) {
        const r = existing.rows[0] as Record<string, unknown>;
        return NextResponse.json({
          success: true,
          data: {
            id: r.id,
            score: r.score,
            total_marks: r.total_marks,
            percentage: r.percentage,
            grade_letter: r.grade_letter,
            answered: r.answered,
            skipped: r.skipped,
            total_questions: r.total_questions,
            answers: r.answers || gradedAnswers,
          },
        });
      }
      return fail('Exam already submitted');
    }
    // FK violation or any other DB error — return meaningful error instead of 500
    if (pgErr.code === '23503') {
      console.error('[session-exam] FK violation — room_id or session_id not found in referenced table');
      // Retry without FK-constrained fields
      try {
        const retryResult = await db.query(`
          INSERT INTO session_exam_results
            (topic_id, session_id, room_id,
             student_email, student_name, student_grade, parent_email,
             teacher_email, teacher_name,
             subject, topic_title, total_questions, answered, skipped,
             score, total_marks, percentage, grade_letter, time_taken_seconds,
             answers, violations, tab_switch_count, auto_submitted, completed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
          RETURNING id
        `, [
          topic_id, null, null,
          student_email, student_name, student_grade || null, parent_email || null,
          resolved_teacher_email, resolved_teacher_name,
          topic.subject, topic.title, question_ids.length, answeredCount, skippedCount,
          score, totalMarks, percentage, gradeLetter, time_taken_seconds || null,
          JSON.stringify(gradedAnswers),
          violations ? JSON.stringify(violations) : null,
          tab_switch_count || 0,
          auto_submitted || false,
        ] as unknown[]);
        insertResult = retryResult;
      } catch (retryErr) {
        console.error('[session-exam] Retry INSERT also failed:', retryErr);
        return fail('Failed to save exam result');
      }
    } else {
      return fail(`Failed to save exam result: ${pgErr.message || 'unknown error'}`);
    }
  }

  // ── Send parent notification (fire-and-forget) ─────────
  notifyParent(student_email, student_name, topic.subject, topic.title, score, totalMarks, percentage, gradeLetter, parent_email).catch(() => {});

  return NextResponse.json({
    success: true,
    data: {
      id: insertResult.rows[0].id,
      score,
      total_marks: totalMarks,
      percentage,
      grade_letter: gradeLetter,
      answered: answeredCount,
      skipped: skippedCount,
      total_questions: question_ids.length,
      answers: gradedAnswers,
    },
  });
}

// ── Parent notification helper ───────────────────────────────
async function notifyParent(
  studentEmail: string, studentName: string,
  subject: string, topicTitle: string,
  score: number, totalMarks: number, percentage: number, gradeLetter: string,
  providedParentEmail?: string,
) {
  // Resolve parent email from batch_students if not provided
  let parentEmail = providedParentEmail;
  if (!parentEmail) {
    const res = await db.query(
      `SELECT parent_email FROM batch_students WHERE student_email = $1 AND parent_email IS NOT NULL LIMIT 1`,
      [studentEmail],
    );
    if (res.rows.length > 0) parentEmail = res.rows[0].parent_email as string;
  }
  if (!parentEmail) return; // no parent email available

  const platformName = await getPlatformName();
  const emailSubject = `Session Exam Result: ${studentName} scored ${score}/${totalMarks} in ${subject}`;
  const text = [
    `Dear Parent,`,
    ``,
    `Your child ${studentName} has completed a session exam.`,
    ``,
    `Subject: ${subject}`,
    `Topic: ${topicTitle}`,
    `Score: ${score}/${totalMarks} (${percentage}%)`,
    `Grade: ${gradeLetter}`,
    ``,
    `Thank you,`,
    `${platformName} Online Classes`,
  ].join('\n');

  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
      <h2 style="color:#059669;margin:0 0 16px">Session Exam Result</h2>
      <p>Dear Parent,</p>
      <p>Your child <strong>${studentName}</strong> has completed a session exam.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Subject</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${subject}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Topic</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${topicTitle}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Score</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${score}/${totalMarks}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Percentage</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${percentage}%</td></tr>
        <tr><td style="padding:8px;color:#6b7280">Grade</td><td style="padding:8px;font-weight:700;font-size:1.2em;color:#059669">${gradeLetter}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:0.85em">${platformName} Online Classes</p>
    </div>
  `;

  await sendEmail({ to: parentEmail, subject: emailSubject, html, text });
}
