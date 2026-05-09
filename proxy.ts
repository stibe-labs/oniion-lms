import { NextRequest, NextResponse } from 'next/server';
import { signSession, verifySession, COOKIE_NAME } from '@/lib/session';

/**
 * stibe Portal Middleware
 * Protects portal routes — redirects to /login if no valid session.
 */

// Routes that do NOT require a session
const PUBLIC_PATHS = ['/login', '/expired', '/api/v1/auth/login', '/api/v1/auth/revoke-session', '/api/v1/health'];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always allow public paths ──────────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Allow uploaded static files (PDFs, images, etc.) ──────
  if (pathname.startsWith('/uploads/')) {
    return NextResponse.next();
  }

  // ── Allow /demo/* and /demo-exam/* — public registration pages ──
  if (pathname.startsWith('/demo')) {
    return NextResponse.next();
  }

  // ── Allow /conference/* — public conference join pages ──
  if (pathname.startsWith('/conference')) {
    return NextResponse.next();
  }

  // ── Allow /open-classroom/* — public open classroom join pages ──
  if (pathname.startsWith('/open-classroom')) {
    return NextResponse.next();
  }

  // ── Allow /enroll/* and /pay/* — public payment pages ──
  if (pathname.startsWith('/enroll') || pathname.startsWith('/pay')) {
    return NextResponse.next();
  }

  // ── Allow /egress-layout — LiveKit Egress headless Chrome (no cookie) ──
  if (pathname.startsWith('/egress-layout')) {
    return NextResponse.next();
  }

  // ── Allow /mediapipe — WASM + model files for background removal ──
  if (pathname.startsWith('/mediapipe')) {
    return NextResponse.next();
  }

  // ── Allow all API routes — each route validates itself ─────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Allow /join/* — token in URL is the auth ───────────────
  if (pathname.startsWith('/join/')) {
    const response = NextResponse.next();
    response.headers.set('x-join-route', '1');
    return response;
  }

  // ── Allow /classroom/* — auth via sessionStorage token ───
  if (pathname.startsWith('/classroom/')) {
    const response = NextResponse.next();
    response.headers.set('x-join-route', '1');
    return response;
  }

  // ── /dev only in development ───────────────────────────────
  if (pathname.startsWith('/dev') && process.env.NODE_ENV !== 'development') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (pathname.startsWith('/dev') && process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // ── All other routes require a valid session cookie ────────
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const user = await verifySession(sessionCookie);

  if (!user) {
    // Invalid or expired token — clear cookie and redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // ── Guest open-classroom participants — no portal dashboard access ──
  // They have a temporary session cookie only for in-classroom API calls.
  // If they navigate to the portal after leaving, clear the cookie and send to /login.
  if ((user as unknown as { is_guest?: boolean }).is_guest) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // ── If logged in user visits /login, redirect to dashboard ──
  if (pathname === '/login') {
    const dashboardUrl = getDashboardUrl(user.role);
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // ── Sliding session: refresh token if older than 7 days ────
  let response = NextResponse.next();
  const iat = (user as unknown as { iat?: number }).iat;
  if (iat && Date.now() / 1000 - iat > 7 * 24 * 60 * 60) {
    const freshToken = await signSession(user);
    response.cookies.set(COOKIE_NAME, freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 31536000,
      path: '/',
    });
  }

  // ── Role-based route protection ────────────────────────────
  // Owner can access everything
  if (user.role === 'owner') return response;

  const routeRoleMap: Record<string, string[]> = {
    '/batch-coordinator':  ['batch_coordinator'],
    '/academic-operator': ['academic_operator', 'academic'], // 'academic' is legacy alias
    '/hr':                ['hr'],
    '/teacher':           ['teacher'],
    '/student':           ['student'],
    '/parent':            ['parent'],
    '/ghost':             ['ghost'],
    '/sales':             ['sales'],
  };

  for (const [prefix, roles] of Object.entries(routeRoleMap)) {
    if (pathname.startsWith(prefix) && !roles.includes(user.role)) {
      return NextResponse.redirect(new URL(getDashboardUrl(user.role), request.url));
    }
  }

  return response;
}

/** Maps portal role to their dashboard URL */
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'batch_coordinator':  return '/batch-coordinator';
    case 'academic_operator': return '/academic-operator';
    case 'academic':          return '/academic-operator'; // legacy alias
    case 'hr':                return '/hr';
    case 'teacher':           return '/teacher';
    case 'student':           return '/student';
    case 'parent':            return '/parent';
    case 'owner':             return '/owner';
    case 'ghost':             return '/ghost';
    case 'sales':             return '/sales';
    default:                  return '/login';
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
