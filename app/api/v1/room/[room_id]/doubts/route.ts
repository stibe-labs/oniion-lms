import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import type { ApiResponse } from '@/types';

/**
 * GET  /api/v1/room/[room_id]/doubts — list doubts for a session
 * POST /api/v1/room/[room_id]/doubts — student raises a doubt / teacher replies
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { room_id } = await params;

    const result = await db.query(
      `SELECT id, student_email, student_name, subject, doubt_text,
              status, teacher_reply, replied_by, replied_at, created_at
       FROM session_doubts
       WHERE room_id = $1
       ORDER BY created_at ASC`,
      [room_id],
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { doubts: result.rows },
    });
  } catch (err) {
    console.error('[doubts] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { room_id } = await params;
    const body = await request.json();

    // ── Student raising a doubt ──────────────────────────
    if (body.action === 'raise') {
      const doubtText = String(body.doubt_text || '').trim();
      if (!doubtText || doubtText.length > 2000) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Doubt text required (max 2000 chars)' },
          { status: 400 },
        );
      }

      // Get room subject
      const roomRes = await db.query(
        `SELECT subject, batch_id FROM rooms WHERE room_id = $1`,
        [room_id],
      );
      const room = roomRes.rows[0];

      const result = await db.query(
        `INSERT INTO session_doubts (room_id, batch_id, student_email, student_name, subject, doubt_text)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, student_email, student_name, subject, doubt_text, status, created_at`,
        [
          room_id,
          room?.batch_id || null,
          user.id,
          user.name || user.id,
          room?.subject || body.subject || '',
          doubtText,
        ],
      );

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { doubt: result.rows[0] },
      });
    }

    // ── Teacher replying to a doubt ──────────────────────
    if (body.action === 'reply') {
      const { doubt_id, reply_text, status } = body;
      if (!doubt_id) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'doubt_id required' },
          { status: 400 },
        );
      }

      const newStatus = status || 'answered';
      const replyText = String(reply_text || '').trim();

      const result = await db.query(
        `UPDATE session_doubts
         SET teacher_reply = COALESCE($1, teacher_reply),
             status = $2,
             replied_by = $3,
             replied_at = NOW(),
             updated_at = NOW()
         WHERE id = $4 AND room_id = $5
         RETURNING *`,
        [replyText || null, newStatus, user.id, doubt_id, room_id],
      );

      if (result.rows.length === 0) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Doubt not found' },
          { status: 404 },
        );
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { doubt: result.rows[0] },
      });
    }

    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid action — use "raise" or "reply"' },
      { status: 400 },
    );
  } catch (err) {
    console.error('[doubts] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
