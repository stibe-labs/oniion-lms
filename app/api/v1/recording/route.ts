// ═══════════════════════════════════════════════════════════════
// Recording API — POST /api/v1/recording/start, stop, status
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { startRecording, stopRecording, getRecordingStatus, listRecordings } from '@/lib/recording';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'owner', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { action, roomId, roomName } = body;

    if (action === 'start') {
      if (!roomName || !roomId) {
        return NextResponse.json({ success: false, error: 'roomName and roomId required' }, { status: 400 });
      }
      const result = await startRecording(roomName, roomId);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'stop') {
      if (!roomId) {
        return NextResponse.json({ success: false, error: 'roomId required' }, { status: 400 });
      }
      const result = await stopRecording(roomId);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'status') {
      if (!roomId) {
        return NextResponse.json({ success: false, error: 'roomId required' }, { status: 400 });
      }
      const result = await getRecordingStatus(roomId);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Invalid action (start/stop/status)' }, { status: 400 });
  } catch (err) {
    console.error('[recording] API error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const url = new URL(req.url);
    const recordings = await listRecordings({
      subject: url.searchParams.get('subject') || undefined,
      grade: url.searchParams.get('grade') || undefined,
      limit: Number(url.searchParams.get('limit')) || 50,
    });

    return NextResponse.json({ success: true, data: { recordings } });
  } catch (err) {
    console.error('[recording] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
