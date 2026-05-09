import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { COOKIE_NAME } from '@/lib/session';

/**
 * POST /api/v1/auth/logout
 * Clears the session cookie.
 */
export async function POST() {
  const response = NextResponse.json<ApiResponse>(
    { success: true, message: 'Logged out' },
    { status: 200 }
  );

  response.cookies.delete(COOKIE_NAME);

  return response;
}
