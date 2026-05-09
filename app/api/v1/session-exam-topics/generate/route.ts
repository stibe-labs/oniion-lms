// ---------------------------------------------------------------
// Generate Exam Questions API — /api/v1/session-exam-topics/generate
// POST: trigger AI generation for a topic's uploaded files
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { generateQuestionsFromFiles, ProgressStage } from '@/lib/ai-exam-generator';

const AO_ROLES = ['academic_operator', 'owner', 'batch_coordinator', 'teacher'];

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);
  if (!AO_ROLES.includes(session.role)) return fail('Permission denied', 403);

  let body: { topic_id?: string; count?: number; page_numbers?: string };
  try { body = await req.json(); }
  catch { return fail('Invalid JSON body'); }

  const topicId = body.topic_id;
  if (!topicId) return fail('topic_id is required');

  // Parse page_numbers (e.g. "1-5,8,10-12")
  const pageNumbers = body.page_numbers?.trim() || null;

  // 1. Fetch topic
  const topicResult = await db.query(
    `SELECT id, title, subject, grade, category, chapter_name, topic_name
     FROM session_exam_topics WHERE id = $1`,
    [topicId],
  );
  if (topicResult.rows.length === 0) return fail('Topic not found', 404);
  const topic = topicResult.rows[0] as Record<string, string | null>;

  const isQuestionPaper = topic.category === 'question_paper';
  // QPs: extract all questions (up to 200); topics: default 10
  const defaultCount = isQuestionPaper ? 200 : 10;
  const count = isQuestionPaper ? 200 : Math.min(Math.max(body.count || defaultCount, 5), 50);

  // 2. Fetch uploaded files
  const filesResult = await db.query(
    `SELECT file_url, file_name, mime_type FROM exam_topic_files WHERE topic_id = $1 ORDER BY created_at`,
    [topicId],
  );
  if (filesResult.rows.length === 0) return fail('No files found for this topic');

  // 3. Resolve file paths on disk
  const filePaths: string[] = [];
  for (const row of filesResult.rows) {
    const fileUrl = row.file_url as string;
    if (fileUrl.startsWith('/uploads/')) {
      filePaths.push(path.join(process.cwd(), 'public', fileUrl));
    }
  }
  if (filePaths.length === 0) return fail('No processable files found');

  // 4. Mark as generating
  await db.query(
    `UPDATE session_exam_topics SET status = 'generating', error_message = NULL, updated_at = NOW() WHERE id = $1`,
    [topicId],
  );

  // 5. Build topic title for prompt
  const topicTitle = [topic.chapter_name, topic.topic_name, topic.title]
    .filter(Boolean).join(' — ');

  // 6. Fire generation in background (don't await — takes 3-5 min on CPU)
  runGenerationInBackground(topicId, filePaths, topic.subject!, topic.grade!, topicTitle, isQuestionPaper, count, pageNumbers);

  return NextResponse.json({
    success: true,
    data: { topic_id: topicId, status: 'generating', message: 'Generation started. This may take a few minutes.' },
  });
}

// ── Background generation (not awaited by the request) ───────
async function runGenerationInBackground(
  topicId: string, filePaths: string[], subject: string, grade: string,
  topicTitle: string, isQuestionPaper: boolean, count: number, pageNumbers: string | null,
) {
  const updateProgress = (stage: ProgressStage) => {
    db.query(
      `UPDATE session_exam_topics SET generation_progress = $2, updated_at = NOW() WHERE id = $1`,
      [topicId, stage],
    ).catch(() => {});
  };

  try {
    const questions = await generateQuestionsFromFiles(
      filePaths, subject, grade, topicTitle, isQuestionPaper, count, updateProgress, topicId, pageNumbers,
    );

    // Check if cancelled while generating
    const check = await db.query(`SELECT status FROM session_exam_topics WHERE id = $1`, [topicId]);
    if (check.rows[0]?.status !== 'generating') {
      console.log(`[generate] Topic ${topicId} was cancelled, discarding ${questions.length} questions`);
      return;
    }

    // Delete any existing questions for this topic (re-generation)
    await db.query(`DELETE FROM session_exam_questions WHERE topic_id = $1`, [topicId]);

    // Insert new questions
    for (const q of questions) {
      await db.query(`
        INSERT INTO session_exam_questions
          (topic_id, question_text, options, correct_answer, marks, difficulty, sort_order, image_url, solution_steps)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [topicId, q.question_text, q.options, q.correct_answer, q.marks, q.difficulty, q.sort_order, q.image_url || null, q.solution_steps || null]);
    }

    // Update topic status
    await db.query(
      `UPDATE session_exam_topics
       SET status = 'ready', question_count = $2, error_message = NULL, generation_progress = NULL, updated_at = NOW()
       WHERE id = $1`,
      [topicId, questions.length],
    );
    console.log(`[generate] Success: ${questions.length} questions for topic ${topicId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    console.error('[generate] Error:', msg);

    await db.query(
      `UPDATE session_exam_topics SET status = 'error', error_message = $2, generation_progress = NULL, updated_at = NOW() WHERE id = $1`,
      [topicId, msg],
    ).catch(() => {});
  }
}
