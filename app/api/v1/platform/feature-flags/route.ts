import { NextResponse } from 'next/server';
import { getFeatureFlags } from '@/lib/feature-flags';

export async function GET() {
  const flags = await getFeatureFlags();
  return NextResponse.json({ success: true, data: flags });
}
