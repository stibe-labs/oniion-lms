// ═══════════════════════════════════════════════════════════════
// Attention API — Store and retrieve attention data
// POST: Store attention update (from webhook/cron)
// GET: Retrieve attention data for a room
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const body = await req.json();
    const { roomId, studentEmail, attentionScore, isAttentive, faceDetected } = body;

    if (!roomId || !studentEmail) {
      return NextResponse.json({ success: false, error: 'roomId, studentEmail required' }, { status: 400 });
    }

    // Store as room event with attention_update type
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'attention_update', $2, $3::jsonb)`,
      [roomId, studentEmail, JSON.stringify({
        attention_score: attentionScore,
        is_attentive: isAttentive,
        face_detected: faceDetected,
        timestamp: Date.now(),
      })]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[attention] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'owner', 'batch_coordinator', 'ghost', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(req.url);
    const roomId = url.searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ success: false, error: 'roomId required' }, { status: 400 });
    }

    // Get latest attention event per student
    const result = await db.query(
      `SELECT DISTINCT ON (participant_email)
              participant_email, payload, created_at
       FROM room_events
       WHERE room_id = $1 AND event_type = 'attention_update'
       ORDER BY participant_email, created_at DESC`,
      [roomId]
    );

    const attentionData = result.rows.map((row: Record<string, unknown>) => {
      const payload = row.payload as Record<string, unknown>;
      return {
        studentEmail: row.participant_email,
        attentionScore: payload.attention_score,
        isAttentive: payload.is_attentive,
        faceDetected: payload.face_detected,
        lastUpdate: row.created_at,
      };
    });

    // Calculate room average
    const scores = attentionData.map((d) => Number(d.attentionScore) || 0).filter((s) => s > 0);
    const roomAverage = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 100;

    return NextResponse.json({
      success: true,
      data: {
        students: attentionData,
        roomAverage,
        totalStudents: attentionData.length,
        attentiveCount: attentionData.filter((d) => !!d.isAttentive).length,
      },
    });
  } catch (err) {
    console.error('[attention] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
