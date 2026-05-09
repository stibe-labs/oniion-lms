import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════
// GET — All pending go-live requests for the BC's batches
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    const allowedRoles = ['batch_coordinator', 'academic_operator', 'owner'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    let sql = `
      SELECT s.session_id, s.subject, s.teacher_email, s.teacher_name,
             s.scheduled_date::text AS scheduled_date, s.start_time::text AS start_time,
             s.duration_minutes, s.go_live_requested_at,
             b.batch_name, b.batch_id, b.grade, b.section
      FROM batch_sessions s
      JOIN batches b ON b.batch_id = s.batch_id
      WHERE s.go_live_status = 'pending'
        AND s.status = 'scheduled'
    `;
    const params: unknown[] = [];

    // BC can only see their own batches
    if (user.role === 'batch_coordinator') {
      params.push(user.id);
      sql += ` AND b.coordinator_email = $${params.length}`;
    }

    sql += ` ORDER BY s.go_live_requested_at ASC`;

    const result = await db.query(sql, params);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { requests: result.rows },
    });
  } catch (err) {
    console.error('[go-live-requests] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
