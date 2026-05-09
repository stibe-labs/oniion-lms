'use client';

import { PlatformProvider } from '@/components/providers/PlatformProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <PlatformProvider>{children}</PlatformProvider>;
}
