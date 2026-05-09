import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * GET /api/v1/conference — List conferences for the current user
 * POST /api/v1/conference — Create a new conference
 */

const ALLOWED_ROLES = ['owner', 'batch_coordinator', 'academic_operator', 'academic', 'hr', 'teacher'];

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    // Owner sees all, others see their own
    const isOwner = user.role === 'owner';
    const result = await db.query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM conference_participants cp WHERE cp.conference_id = c.id) AS participant_count
       FROM conferences c
       ${isOwner ? '' : 'WHERE c.created_by = $1'}
       ORDER BY c.created_at DESC
       LIMIT 100`,
      isOwner ? [] : [user.id]
    );

    return NextResponse.json<ApiResponse>({ success: true, data: result.rows });
  } catch (err) {
    console.error('[conference/list]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const title = (body.title as string || '').trim();
    if (!title) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at as string) : null;
    const durationMinutes = body.duration_minutes ? Number(body.duration_minutes) : 60;
    const conferenceType = scheduledAt ? 'scheduled' : 'instant';

    const adminToken = crypto.randomBytes(6).toString('hex'); // 12 chars
    const userToken = crypto.randomBytes(6).toString('hex');

    const result = await db.query(
      `INSERT INTO conferences (title, created_by, admin_token, user_token, scheduled_at, duration_minutes, conference_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, user.id, adminToken, userToken, scheduledAt, durationMinutes, conferenceType]
    );

    const conference = result.rows[0];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...conference,
        admin_link: `${baseUrl}/conference/${adminToken}?role=admin`,
        user_link: `${baseUrl}/conference/${userToken}`,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[conference/create]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
