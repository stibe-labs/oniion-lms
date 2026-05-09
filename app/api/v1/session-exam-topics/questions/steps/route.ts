// ---------------------------------------------------------------
// POST /api/v1/session-exam-topics/questions/steps
// Generate step-by-step solution for a question using Groq AI
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TEXT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const ALLOWED_ROLES = ['academic_operator', 'owner', 'batch_coordinator', 'teacher'];

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);
  if (!ALLOWED_ROLES.includes(session.role)) return fail('Permission denied', 403);

  let body: { question_id?: string };
  try { body = await req.json(); }
  catch { return fail('Invalid JSON body'); }

  const questionId = body.question_id;
  if (!questionId) return fail('question_id is required');

  // Fetch question
  const result = await db.query(
    `SELECT id, question_text, options, correct_answer, difficulty, solution_steps
     FROM session_exam_questions WHERE id = $1`,
    [questionId],
  );
  if (result.rows.length === 0) return fail('Question not found', 404);
  const q = result.rows[0];

  // Return cached steps if available
  if (q.solution_steps) {
    return NextResponse.json({ success: true, data: { steps: q.solution_steps } });
  }

  // Generate steps via Groq
  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey) return fail('AI service not configured', 500);

  const options = (q.options as string[]);
  const correctAnswer = q.correct_answer as number;
  const correctLetter = String.fromCharCode(65 + correctAnswer);
  const correctOption = options[correctAnswer];

  const prompt = `You are an expert teacher. A student needs help understanding this exam question.

Question: ${q.question_text}

Options:
A) ${options[0]}
B) ${options[1]}
C) ${options[2]}
D) ${options[3]}

Correct Answer: ${correctLetter}) ${correctOption}
Difficulty: ${q.difficulty}

Provide a clear step-by-step solution. Explain:
1. What the question is asking
2. The key concept/formula needed
3. Step-by-step working (show calculations if math)
4. Why the correct answer is right
5. Common mistakes to avoid

Keep it concise but thorough. Use plain text for math (no LaTeX). Each step on a new line. Number each step.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        messages: [
          { role: 'system', content: 'You are an expert teacher providing step-by-step exam solutions. Write in plain text, no LaTeX. Number each step.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return fail(`AI generation failed: ${err}`, 500);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const stepsText = data.choices?.[0]?.message?.content?.trim() || '';

    if (!stepsText) return fail('AI returned empty response', 500);

    // Cache in DB
    await db.query(
      `UPDATE session_exam_questions SET solution_steps = $2 WHERE id = $1`,
      [questionId, stepsText],
    ).catch(() => {});

    return NextResponse.json({ success: true, data: { steps: stepsText } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate steps';
    return fail(msg, 500);
  }
}
