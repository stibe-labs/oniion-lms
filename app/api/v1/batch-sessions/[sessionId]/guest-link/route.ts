import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * POST /api/v1/batch-sessions/[sessionId]/guest-link
 *
 * Generate (or retrieve existing) a guest join link for a LIVE batch session.
 * The link opens /open-classroom/[token] where anyone can enter their name and join
 * the same LiveKit room as the batch session — without being enrolled in the batch.
 *
 * Only usable when the session is live. Creates an `open_classrooms` record that
 * shares the same livekit_room_name as the batch session.
 */

const ALLOWED_ROLES = ['owner', 'academic_operator', 'academic', 'batch_coordinator'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { sessionId } = await params;

    // Fetch the batch session — also get room status from the rooms table
    const sessionRes = await db.query(
      `SELECT bs.session_id, bs.subject, bs.teacher_email, bs.livekit_room_name,
              bs.scheduled_date, bs.start_time, bs.duration_minutes, bs.status, b.grade,
              b.batch_name, b.batch_id,
              pu.full_name AS teacher_name,
              rm.status AS room_status
       FROM batch_sessions bs
       LEFT JOIN batches b ON b.batch_id = bs.batch_id
       LEFT JOIN portal_users pu ON pu.email = bs.teacher_email
       LEFT JOIN rooms rm ON rm.room_id = bs.livekit_room_name
       WHERE bs.session_id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const session = sessionRes.rows[0] as Record<string, unknown>;

    const isLive = session.status === 'live' || session.room_status === 'live';
    if (!isLive) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Guest links can only be generated for live sessions' }, { status: 400 });
    }

    if (!session.livekit_room_name) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session room not ready' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';
    const roomName = String(session.livekit_room_name);

    // Check if a guest open-classroom already exists for this room
    const existing = await db.query(
      `SELECT id, join_token, host_token FROM open_classrooms
       WHERE livekit_room_name = $1 AND classroom_type = 'guest_session'
       LIMIT 1`,
      [roomName]
    );

    let joinToken: string;

    if (existing.rows.length > 0) {
      // Reuse existing guest classroom (ensure it's live)
      joinToken = String(existing.rows[0].join_token);
      await db.query(
        `UPDATE open_classrooms SET status = 'live' WHERE id = $1`,
        [existing.rows[0].id]
      );
    } else {
      // Create a new guest open-classroom entry linked to this room
      const hostToken = crypto.randomBytes(6).toString('hex');
      joinToken = crypto.randomBytes(6).toString('hex');

      const title = `${String(session.subject)} — ${String(session.batch_name || session.batch_id)} (Guest)`;
      // Append IST offset so PostgreSQL TIMESTAMPTZ stores the correct UTC equivalent
      const scheduledStart = `${String(session.scheduled_date)}T${String(session.start_time)}+05:30`;

      await db.query(
        `INSERT INTO open_classrooms
           (title, description, created_by, teacher_email, host_token, join_token,
            classroom_type, scheduled_at, duration_minutes, status,
            payment_enabled, price_paise, currency, max_participants, subject, grade,
            auto_approve_joins, livekit_room_name, room_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'guest_session', $7, $8, 'live',
                 false, 0, 'INR', 500, $9, $10,
                 true, $11, $11)`,
        [
          title,
          `Guest access for live batch session: ${String(session.subject)}`,
          user.id,
          session.teacher_email || null,
          hostToken,
          joinToken,
          scheduledStart,
          Number(session.duration_minutes) || 60,
          session.subject || null,
          session.grade || null,
          roomName,
        ]
      );
    }

    const joinLink = `${baseUrl}/open-classroom/${joinToken}`;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        join_link: joinLink,
        join_token: joinToken,
        room_name: roomName,
      },
    });
  } catch (err) {
    console.error('[batch-sessions/guest-link]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
