// ═══════════════════════════════════════════════════════════════
// GET /api/v1/auth/revoke-session
// Clears the session cookie and redirects to /login.
// Called when a user's account has been deleted or deactivated
// while they still held a valid JWT session cookie.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/session';

export async function GET(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(COOKIE_NAME);
  return response;
}
