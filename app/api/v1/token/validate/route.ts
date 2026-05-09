import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { ApiResponse, PortalRole, PortalUser } from '@/types';
import { signSession, COOKIE_NAME } from '@/lib/session';
import { ensureRoom } from '@/lib/livekit';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

/**
 * POST /api/v1/token/validate
 * Validates a join token (JWT in the URL).
 * No session required — the token itself is the auth.
 *
 * Body: { token }
 * Returns: { valid, payload?, error? }
 *
 * On success:
 * - Sets a portal session cookie
 * - Ensures the LiveKit room exists
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing token' },
        { status: 400 }
      );
    }

    // ── Decode + verify the token ────────────────────────────
    let payload: {
      sub: string;
      name: string;
      role: PortalRole;
      room_id: string;
      batch_id?: string;
      permissions?: Record<string, boolean>;
    };

    try {
      const verified = await jwtVerify(token, secret);
      payload = verified.payload as unknown as typeof payload;
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Join link has expired or is invalid' },
        { status: 401 }
      );
    }

    // ── Validate required fields ─────────────────────────────
    if (!payload.sub || !payload.room_id || !payload.role) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Token missing required fields (sub, room_id, role)' },
        { status: 401 }
      );
    }

    // ── Ensure room exists (creates if missing) ──────────────
    await ensureRoom(payload.room_id);

    // ── Sign a portal session for this user ──────────────────
    const sessionUser: PortalUser = {
      id: payload.sub,
      name: payload.name || payload.sub,
      role: payload.role,
    };

    const sessionToken = await signSession(sessionUser);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 28800, // 8 hours
      path: '/',
    });

    return NextResponse.json<ApiResponse<{
      valid: boolean;
      payload: typeof payload;
    }>>(
      {
        success: true,
        data: {
          valid: true,
          payload,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[token/validate] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
