// ---------------------------------------------------------------
// GET  /api/v1/session-exam-topics/questions?topic_id=xxx
// PATCH /api/v1/session-exam-topics/questions  — regenerate one question
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const ALLOWED_ROLES = ['academic_operator', 'owner', 'batch_coordinator', 'teacher'];

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TEXT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);
  if (!ALLOWED_ROLES.includes(session.role)) return fail('Permission denied', 403);

  const topicId = req.nextUrl.searchParams.get('topic_id');
  if (!topicId) return fail('topic_id is required');

  const result = await db.query(
    `SELECT id, question_text, options, correct_answer, marks, difficulty, sort_order, image_url, solution_steps
     FROM session_exam_questions
     WHERE topic_id = $1
     ORDER BY sort_order, created_at`,
    [topicId],
  );

  return NextResponse.json({ success: true, data: result.rows });
}

// ── PATCH: Regenerate a single question via AI ────────────────
export async function PATCH(req: NextRequest) {
  console.log('[questions/PATCH] Regenerate request received');
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);
  if (!ALLOWED_ROLES.includes(session.role)) return fail('Permission denied', 403);

  let body: { question_id?: string };
  try { body = await req.json(); }
  catch { return fail('Invalid JSON body'); }

  const questionId = body.question_id;
  if (!questionId) return fail('question_id is required');
  console.log('[questions/PATCH] question_id:', questionId, 'by:', session.id);

  // Fetch the existing question + topic context
  const qRes = await db.query(
    `SELECT q.id, q.topic_id, q.question_text, q.options, q.correct_answer, q.marks, q.difficulty, q.sort_order,
            t.subject, t.grade, t.title AS topic_title
     FROM session_exam_questions q
     JOIN session_exam_topics t ON t.id = q.topic_id
     WHERE q.id = $1`,
    [questionId],
  );
  if (qRes.rows.length === 0) return fail('Question not found', 404);
  const old = qRes.rows[0] as {
    id: string; topic_id: string; question_text: string; options: string[];
    correct_answer: number; marks: number; difficulty: string; sort_order: number;
    subject: string; grade: string; topic_title: string;
  };

  // Fetch sibling questions to avoid duplicates (INCLUDE the current question being replaced)
  const siblingsRes = await db.query(
    `SELECT question_text FROM session_exam_questions WHERE topic_id = $1`,
    [old.topic_id],
  );
  const existingQuestions = (siblingsRes.rows as { question_text: string }[])
    .map(r => r.question_text).join('\n- ');

  // Call Groq to generate a replacement
  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey) return fail('AI generation not configured', 500);

  const prompt = `You are an expert exam question generator for ${old.subject}, Grade ${old.grade}.
Topic: ${old.topic_title}

Generate exactly 1 NEW and ORIGINAL MCQ question with 4 options.

IMPORTANT — FORBIDDEN QUESTIONS: The following questions already exist. You MUST NOT generate any of these or anything similar. Generate something completely different:
- ${existingQuestions || 'None'}

Requirements:
- Topic: ${old.topic_title}
- Difficulty: ${old.difficulty}
- Worth ${old.marks} mark(s)
- Exactly 4 options with one clearly correct answer
- Must test a DIFFERENT concept or aspect of the topic than ALL existing questions above
- Use plain text (no LaTeX)
- Be creative and find a unique angle on this topic

[Unique request ID: ${crypto.randomUUID()}]

Respond with ONLY valid JSON:
{"question_text": "...", "options": ["A", "B", "C", "D"], "correct_answer": 0, "marks": ${old.marks}, "difficulty": "${old.difficulty}"}

Where correct_answer is the 0-based index of the correct option.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [
          { role: 'system', content: 'You are an expert exam question generator. Always respond with valid JSON. Never use LaTeX notation. Be creative and generate unique questions every time.' },
          { role: 'user', content: prompt },
        ],
        temperature: 1.0,
        max_tokens: 1024,
        seed: Math.floor(Math.random() * 2147483647),
        response_format: { type: 'json_object' },
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return fail(`AI generation failed: ${err}`, 500);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content) as {
      question_text: string; options: string[]; correct_answer: number;
      marks?: number; difficulty?: string;
    };

    if (!parsed.question_text || !Array.isArray(parsed.options) || parsed.options.length < 4) {
      return fail('AI returned invalid question format', 500);
    }

    // Guard: if AI returned the same question text, reject and use a forced fallback
    const existingSet = new Set((siblingsRes.rows as { question_text: string }[]).map(r => r.question_text.trim().toLowerCase()));
    if (existingSet.has(parsed.question_text.trim().toLowerCase())) {
      // Retry once with even stronger instruction
      const retryRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_TEXT_MODEL,
          messages: [
            { role: 'system', content: 'Generate a COMPLETELY NEW exam question. Do NOT repeat any provided questions.' },
            { role: 'user', content: `Topic: ${old.topic_title}, Subject: ${old.subject}, Grade ${old.grade}, Difficulty: ${old.difficulty}.\n\nDo NOT use any of these questions:\n- ${existingQuestions}\n\nGenerate 1 unique MCQ with 4 options. Respond with JSON: {"question_text":"...","options":["A","B","C","D"],"correct_answer":0,"marks":${old.marks},"difficulty":"${old.difficulty}"}` },
          ],
          temperature: 1.2,
          max_tokens: 1024,
          seed: Math.floor(Math.random() * 2147483647),
          response_format: { type: 'json_object' },
        }),
      });
      if (retryRes.ok) {
        const retryData = (await retryRes.json()) as { choices: Array<{ message: { content: string } }> };
        const retryContent = retryData.choices?.[0]?.message?.content || '';
        const retryParsed = JSON.parse(retryContent);
        if (retryParsed.question_text && Array.isArray(retryParsed.options) && retryParsed.options.length >= 4) {
          parsed.question_text = retryParsed.question_text;
          parsed.options = retryParsed.options;
          parsed.correct_answer = retryParsed.correct_answer;
        }
      }
    }

    // Update in DB
    console.log('[questions/PATCH] Old question:', old.question_text.substring(0, 60));
    console.log('[questions/PATCH] New question:', parsed.question_text.substring(0, 60));
    await db.query(
      `UPDATE session_exam_questions
       SET question_text = $2, options = $3, correct_answer = $4, marks = $5, difficulty = $6
       WHERE id = $1`,
      [questionId, parsed.question_text, parsed.options, parsed.correct_answer, parsed.marks || old.marks, parsed.difficulty || old.difficulty],
    );

    // Return the updated question
    const updated = await db.query(
      `SELECT id, question_text, options, correct_answer, marks, difficulty, sort_order, image_url, solution_steps
       FROM session_exam_questions WHERE id = $1`,
      [questionId],
    );

    console.log('[questions/PATCH] Regeneration successful for', questionId);
    return NextResponse.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[questions/PATCH] Regenerate failed:', msg);
    return fail(`Regeneration failed: ${msg}`, 500);
  }
}
