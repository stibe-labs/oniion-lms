// ---------------------------------------------------------------
// POST /api/v1/session-exam-topics/generate/cancel
// Cancel an in-progress generation
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const AO_ROLES = ['academic_operator', 'owner', 'batch_coordinator', 'teacher'];

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return fail('Not authenticated', 401);
  if (!AO_ROLES.includes(session.role)) return fail('Permission denied', 403);

  let body: { topic_id?: string };
  try { body = await req.json(); }
  catch { return fail('Invalid JSON body'); }

  const topicId = body.topic_id;
  if (!topicId) return fail('topic_id is required');

  // Set status to 'ready' so background generation knows to discard results
  // (background checks for status !== 'generating' before saving)
  const result = await db.query(
    `UPDATE session_exam_topics
     SET status = 'ready', generation_progress = NULL, updated_at = NOW()
     WHERE id = $1 AND status = 'generating'
     RETURNING id`,
    [topicId],
  );

  if (result.rows.length === 0) return fail('Topic is not currently generating', 404);

  return NextResponse.json({ success: true, data: { topic_id: topicId, status: 'ready' } });
}
