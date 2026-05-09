// ═══════════════════════════════════════════════════════════════
// Academic Calendar Sessions — GET /api/v1/academic-calendars/[id]/sessions
// Returns all sessions for a specific calendar
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  // Get calendar metadata
  const calRes = await db.query('SELECT * FROM academic_calendars WHERE id = $1', [id]);
  if (calRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Calendar not found' }, { status: 404 });
  }

  // Get all sessions
  const sessRes = await db.query(
    `SELECT session_date, day_of_week, subject, topic, session_type, session_order, subject_session_number
     FROM academic_calendar_sessions
     WHERE calendar_id = $1
     ORDER BY session_order`,
    [id]
  );

  return NextResponse.json({
    success: true,
    data: {
      calendar: calRes.rows[0],
      sessions: sessRes.rows,
    },
  });
}
