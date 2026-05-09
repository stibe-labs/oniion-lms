import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PortalUser } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';

/**
 * GET /api/v1/auth/me
 * Returns the current user from session cookie.
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const user = await verifySession(sessionCookie);

  if (!user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Session expired' },
      { status: 401 }
    );
  }

  return NextResponse.json<ApiResponse<{ user: PortalUser }>>(
    { success: true, data: { user } },
    { status: 200 }
  );
}
