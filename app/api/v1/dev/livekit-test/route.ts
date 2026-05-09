import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { testLiveKitConnectivity } from '@/lib/livekit';

/**
 * GET /api/v1/dev/livekit-test
 * DEV-ONLY: Runs a LiveKit connectivity test.
 * Creates a test room, lists it, deletes it, generates a test token.
 */
function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_PAGE === 'true';
}

export async function GET() {
  if (!isDevMode()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  try {
    const result = await testLiveKitConnectivity();

    return NextResponse.json<ApiResponse<{
      steps: { name: string; pass: boolean; error?: string }[];
      reachable: boolean;
      livekit_url: string;
    }>>(
      {
        success: true,
        data: {
          ...result,
          livekit_url: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[dev/livekit-test] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: `LiveKit connectivity test failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
