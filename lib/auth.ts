import { NextRequest } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import type { PortalUser } from '@/types';

/**
 * Quick auth helper for API routes — extracts cookie + verifies JWT.
 * Returns user or null.
 */
export async function verifyAuth(request: NextRequest): Promise<PortalUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
