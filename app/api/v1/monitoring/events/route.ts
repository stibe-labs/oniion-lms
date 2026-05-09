// ═══════════════════════════════════════════════════════════════
// Monitoring Events API — POST /api/v1/monitoring/events
// Ingests MediaPipe attention events from student classroom
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { resolveRoomId } from '@/lib/db';
import { ingestMonitoringEvents, type MonitoringEvent } from '@/lib/monitoring';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { events, room_id, session_id } = body as {
      events: Array<{
        event_type: string;
        confidence?: number;
        duration_seconds?: number;
        details?: Record<string, unknown>;
      }>;
      room_id: string;
      session_id?: string;
    };

    if (!events || !Array.isArray(events) || !room_id) {
      return NextResponse.json({ success: false, error: 'Missing events or room_id' }, { status: 400 });
    }

    const actualRoomId = await resolveRoomId(room_id);

    const monitoringEvents: MonitoringEvent[] = events.map((e) => ({
      room_id: actualRoomId,
      session_id: session_id || undefined,
      student_email: user.id,
      student_name: user.name,
      event_type: e.event_type as MonitoringEvent['event_type'],
      confidence: e.confidence,
      duration_seconds: e.duration_seconds,
      details: e.details,
    }));

    const result = await ingestMonitoringEvents(monitoringEvents);

    return NextResponse.json({
      success: true,
      data: {
        inserted: result.inserted,
        alerts_generated: result.alerts_generated,
      },
    });
  } catch (err) {
    console.error('Monitoring events ingestion error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
