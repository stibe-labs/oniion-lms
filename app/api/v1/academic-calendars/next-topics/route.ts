// ═══════════════════════════════════════════════════════════════
// Next Topics API — GET /api/v1/academic-calendars/next-topics
//
// Given a batch_id and date, returns the calendar topic for each
// subject on that date (or the next upcoming topic if no exact match).
// Used by the manual Schedule Session wizard to pre-fill topics.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const url = new URL(req.url);
  const batchId = url.searchParams.get('batch_id');
  const date = url.searchParams.get('date'); // YYYY-MM-DD

  if (!batchId || !date) {
    return NextResponse.json({ success: false, error: 'batch_id and date are required' }, { status: 400 });
  }

  // 1. Find linked calendar via calendar_schedule_runs (most recent run)
  let calendarId: string | null = null;
  const runRes = await db.query(
    `SELECT calendar_id FROM calendar_schedule_runs
     WHERE batch_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [batchId]
  );
  if (runRes.rows.length > 0) {
    calendarId = String((runRes.rows[0] as { calendar_id: string }).calendar_id);
  }

  // 2. Fallback: match by batch's grade + board
  if (!calendarId) {
    const batchRes = await db.query('SELECT grade, board FROM batches WHERE batch_id = $1', [batchId]);
    if (batchRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    const batch = batchRes.rows[0] as { grade: string; board: string };
    const calRes = await db.query(
      `SELECT id FROM academic_calendars
       WHERE grade = $1 AND board = $2 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [batch.grade, batch.board]
    );
    if (calRes.rows.length > 0) {
      calendarId = String((calRes.rows[0] as { id: string }).id);
    }
  }

  if (!calendarId) {
    return NextResponse.json({ success: true, data: { topics: {}, calendar_id: null } });
  }

  // 3. For each subject, find the calendar session on the exact date first,
  //    then fall back to the next upcoming session after that date
  const topicsRes = await db.query(
    `SELECT DISTINCT ON (subject) subject, topic, session_date
     FROM academic_calendar_sessions
     WHERE calendar_id = $1
       AND subject IS NOT NULL
       AND session_type = 'session'
       AND session_date >= $2::date
     ORDER BY subject, session_date ASC`,
    [calendarId, date]
  );

  // Also get exact date matches (prefer these)
  const exactRes = await db.query(
    `SELECT subject, topic FROM academic_calendar_sessions
     WHERE calendar_id = $1
       AND subject IS NOT NULL
       AND session_type = 'session'
       AND session_date = $2::date`,
    [calendarId, date]
  );

  // Build topic map: exact match takes priority
  const topics: Record<string, string> = {};
  for (const row of topicsRes.rows as { subject: string; topic: string | null }[]) {
    if (row.topic) topics[row.subject] = row.topic;
  }
  for (const row of exactRes.rows as { subject: string; topic: string | null }[]) {
    if (row.topic) topics[row.subject] = row.topic;
  }

  return NextResponse.json({
    success: true,
    data: { topics, calendar_id: calendarId },
  });
}
