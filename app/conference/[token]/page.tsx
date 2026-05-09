import ConferenceWrapper from '@/components/conference/ConferenceWrapper';
import { getPlatformName } from '@/lib/platform-config';

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `${n} Conference` };
}

export default async function ConferencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950">
      <ConferenceWrapper token={token} />
    </div>
  );
}
