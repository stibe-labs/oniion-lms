// ═══════════════════════════════════════════════════════════════
// GET /api/v1/room/[room_id]/coordinator-status
// Checks if the batch coordinator is online via heartbeat
// (BC doesn't join the teacher's LiveKit room — they're on the
//  Live Monitor page which pings a heartbeat every 15s)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const HEARTBEAT_STALE_SECONDS = 45;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // Look up the coordinator for this room and check their heartbeat.
    // rooms.coordinator_email may be empty — fall back to batches.coordinator_email
    // The room_id param may be either the actual room_id or a batch_session_id
    // (several navigation paths use session_id directly in /classroom/ URLs)
    const result = await db.query(
      `SELECT u.last_heartbeat_at
       FROM rooms r
       LEFT JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
       LEFT JOIN batches b ON b.batch_id = bs.batch_id
       LEFT JOIN portal_users u
         ON u.email = COALESCE(NULLIF(r.coordinator_email, ''), b.coordinator_email)
       WHERE r.room_id = $1 OR r.batch_session_id = $1`,
      [room_id]
    );

    if (result.rows.length === 0 || !result.rows[0].last_heartbeat_at) {
      return NextResponse.json({
        success: true,
        data: { coordinator_online: false },
      });
    }

    const lastHeartbeat = new Date(result.rows[0].last_heartbeat_at as string).getTime();
    const ageSeconds = (Date.now() - lastHeartbeat) / 1000;
    const coordinatorOnline = ageSeconds < HEARTBEAT_STALE_SECONDS;

    return NextResponse.json({
      success: true,
      data: { coordinator_online: coordinatorOnline },
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: { coordinator_online: false },
    });
  }
}
