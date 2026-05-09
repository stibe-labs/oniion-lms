import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { autoGenerateSessionReport } from '@/lib/reports';

/**
 * GET /api/v1/room/[room_id]/report
 * Returns the session report for a room.
 * If already generated → returns cached. Otherwise generates on-the-fly.
 * Accessible by: teacher (own rooms), batch_coordinator, academic_operator, owner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    // Resolve room_id (support batch_session_id too)
    const roomResult = await db.query(
      `SELECT room_id, teacher_email, status FROM rooms
       WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );
    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Room not found' }, { status: 404 });
    }
    const room = roomResult.rows[0] as Record<string, unknown>;
    const resolvedRoomId = room.room_id as string;

    // Authorization
    const allowedRoles = ['batch_coordinator', 'academic_operator', 'academic', 'owner', 'hr'];
    const isTeacherOfRoom = user.role === 'teacher' && room.teacher_email === user.id;
    if (!isTeacherOfRoom && !allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    // Check for existing cached report (skip if ?refresh=1)
    const refresh = request.nextUrl.searchParams.get('refresh') === '1';
    const existingReport = refresh ? { rows: [] } : await db.query(
      `SELECT * FROM generated_reports
       WHERE report_type = 'session_report'
         AND data->>'sessions' IS NOT NULL
         AND data->'sessions'->0->>'room_id' = $1
       ORDER BY created_at DESC LIMIT 1`,
      [resolvedRoomId]
    );

    if (existingReport.rows.length > 0) {
      // If cached report has all-null attention_avg, discard it and regenerate
      const cached = existingReport.rows[0] as Record<string, unknown>;
      const cachedData = cached.data as Record<string, unknown>;
      const sessions = (cachedData?.sessions as Record<string, unknown>[]) || [];
      const sess0 = sessions[0] as Record<string, unknown> | undefined;
      const details: Record<string, unknown>[] = (sess0?.attendance as Record<string, unknown>)?.details as Record<string, unknown>[] || [];
      const allNullAttention = details.length > 0 && details.every(d => d.attention_avg == null);
      // Invalidate cache if newer fields are missing (recording, exam_summary, materials, doubts.list)
      const missingNewFields = sess0 && (
        sess0.recording === undefined ||
        sess0.materials === undefined ||
        sess0.exam_summary === undefined ||
        ((sess0.doubts as Record<string, unknown>)?.list === undefined)
      );
      if (!allNullAttention && !missingNewFields) {
        return NextResponse.json<ApiResponse>({
          success: true,
          data: existingReport.rows[0],
        });
      }
      // Delete the stale cached report so it regenerates below
      await db.query(`DELETE FROM generated_reports WHERE id = $1`, [(cached as Record<string, unknown>).id]);
    }

    // Room must be ended to generate a report
    if (room.status !== 'ended') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session has not ended yet — report will be generated after the class ends.',
      }, { status: 400 });
    }

    // Generate on-the-fly
    const report = await autoGenerateSessionReport(resolvedRoomId);
    if (!report) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to generate report' }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: report });
  } catch (err) {
    console.error('[session-report] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
