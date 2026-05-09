import { NextRequest, NextResponse } from 'next/server';
import type { PortalUser, ApiResponse } from '@/types';
import { signSession, COOKIE_NAME } from '@/lib/session';
import { upsertUser } from '@/lib/users';
import { dbLogin } from '@/lib/auth-db';

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Authenticates against PostgreSQL portal_users table.
 * Returns: { success, data: { user } } + sets session cookie
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Authenticate via PostgreSQL portal_users table.
    const result = await dbLogin(email.trim().toLowerCase(), password);
    if (result.error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    const user: PortalUser | null = result.user ?? null;

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Sync user to portal_users table on every login
    try {
      await upsertUser(user);
    } catch (syncErr) {
      console.warn('[Login] Failed to sync user to DB:', syncErr);
      // Non-blocking — login still succeeds
    }

    // Sign session JWT and set cookie
    const token = await signSession(user);

    const response = NextResponse.json<ApiResponse<{ user: PortalUser }>>(
      {
        success: true,
        data: { user: { ...user, token } },
      },
      { status: 200 }
    );

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 31536000, // 1 year
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
