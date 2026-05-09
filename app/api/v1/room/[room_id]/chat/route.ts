import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

/**
 * POST /api/v1/room/[room_id]/chat
 * Store a chat message (fire-and-forget from client).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    const { room_id } = await params;
    const body = await request.json();
    const { sender_name, message_text, sent_at } = body as {
      sender_name: string;
      message_text: string;
      sent_at?: string;
    };

    if (!message_text || !sender_name) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing sender_name or message_text' }, { status: 400 });
    }

    if (message_text.length > 500) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Message too long' }, { status: 400 });
    }

    await db.query(
      `INSERT INTO room_chat_messages (room_id, sender_email, sender_name, sender_role, message_text, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [room_id, user.id, sender_name, user.role, message_text, sent_at || new Date().toISOString()]
    );

    return NextResponse.json<ApiResponse>({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[room/chat] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/v1/room/[room_id]/chat
 * Retrieve chat history for a room (post-session review).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    const { room_id } = await params;

    // Teachers, AOs, coordinators, owners, and students in the room can view chat
    const allowedRoles = ['teacher', 'student', 'academic_operator', 'batch_coordinator', 'academic', 'owner'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = await db.query(
      `SELECT sender_email, sender_name, sender_role, message_text, sent_at
       FROM room_chat_messages
       WHERE room_id = $1
       ORDER BY sent_at ASC`,
      [room_id]
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { messages: result.rows, count: result.rows.length },
    });
  } catch (err) {
    console.error('[room/chat] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
