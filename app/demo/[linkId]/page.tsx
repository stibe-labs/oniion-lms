import DemoRegistrationClient from './DemoRegistrationClient';
import LoginSlideshow from '@/components/auth/LoginSlideshow';
import { getPlatformName } from '@/lib/platform-config';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Free Demo Session · ${n}` };
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = await params;

  return (
    <main className="relative min-h-screen w-screen bg-white sm:h-screen sm:overflow-hidden sm:bg-black">
      {/* ── Decorative emerald accent bar — mobile only ── */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 to-teal-500 z-50 sm:hidden" />

      {/* ── Logo — top-left on desktop ── */}
      <div className="absolute top-6 left-8 z-40 hidden sm:block">
        <img src="/logo/full.png" alt="Logo" className="h-10 object-contain drop-shadow-lg" />
      </div>

      {/* ── Fullscreen image slideshow — desktop only ── */}
      <div className="hidden sm:block">
        <LoginSlideshow />
      </div>

      {/* ── Desktop: right-side panel overlay ── */}
      <div className="hidden sm:flex absolute inset-y-0 right-0 z-30 w-120 md:w-130">
        <div className="absolute inset-0 bg-linear-to-b from-emerald-900/60 via-emerald-950/65 to-teal-950/70 backdrop-blur-xl" />
        <div className="absolute inset-y-0 left-0 w-px bg-emerald-400/10" />
        <div className="relative z-10 w-full overflow-y-auto px-12 py-10">
          <DemoRegistrationClient linkId={linkId} />
        </div>
      </div>

      {/* ── Mobile: natural scroll layout (matches auth feel) ── */}
      <div className="sm:hidden px-6 pt-8 pb-12">
        <DemoRegistrationClient linkId={linkId} />
      </div>
    </main>
  );
}
