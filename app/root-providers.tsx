'use client';
import { PlatformProvider } from '@/components/providers/PlatformProvider';
export default function RootProviders({ children }: { children: React.ReactNode }) {
  return <PlatformProvider>{children}</PlatformProvider>;
}
