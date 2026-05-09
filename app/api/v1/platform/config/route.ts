import { NextResponse } from 'next/server';
import { getPlatformName } from '@/lib/platform-config';

export async function GET() {
  const platformName = await getPlatformName();
  return NextResponse.json({ platform_name: platformName });
}
