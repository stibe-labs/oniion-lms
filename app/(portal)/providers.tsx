'use client';

import { ToastProvider, ConfirmProvider } from '@/components/dashboard/shared';
import { PlatformProvider } from '@/components/providers/PlatformProvider';

export default function PortalProviders({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </PlatformProvider>
  );
}
