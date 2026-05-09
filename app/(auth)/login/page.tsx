import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';
import BujiChatbot from '@/components/auth/BujiChatbot';
import { getBujiEnabled } from '@/lib/platform-config';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const user = await verifySession(token);
    if (user) redirect('/batch-coordinator');
  }

  const bujiEnabled = await getBujiEnabled();

  return (
    <>
      <AuthShell>
        <LoginForm />
      </AuthShell>
      <BujiChatbot enabled={bujiEnabled} />
    </>
  );
}
