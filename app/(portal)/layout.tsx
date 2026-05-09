import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import PortalProviders from './providers';

/**
 * Portal layout — wraps all authenticated portal routes.
 * Redirects to /login if no valid session cookie exists.
 *
 * Routes under (portal): /dev, /classroom/*, /coordinator/*
 * Exception: /join/* routes bypass auth here (handled in their own page.tsx via email token).
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware sets x-join-route header for /join/* paths — let them through
  const headerStore = await headers();
  if (headerStore.get('x-join-route')) {
    return <>{children}</>;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) redirect('/login');

  const user = await verifySession(token);
  if (!user) redirect('/login');

  return <PortalProviders>{children}</PortalProviders>;
}
