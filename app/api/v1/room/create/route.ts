import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { ensureRoom } from '@/lib/livekit';

/**
 * POST /api/v1/room/create
 * Creates a new room in the database and ensures it exists on LiveKit.
 * Auth: requires coordinator, academic_operator, academic, or owner role.
 *
 * Body: { room_id, room_name, teacher_email?, subject?, grade?, scheduled_start?, duration_minutes?, open_at?, expires_at? }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // Only batch coordinators, academic staff, and owners can create rooms
    const allowedRoles = ['batch_coordinator', 'academic_operator', 'academic', 'owner'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Insufficient permissions — room creation requires batch coordinator or academic role' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      room_id,
      room_name,
      teacher_email,
      subject,
      grade,
      section,
      batch_type,
      scheduled_start,
      duration_minutes,
      open_at,
      expires_at,
      batch_id,
      batch_session_id,
    } = body as {
      room_id: string;
      room_name: string;
      teacher_email?: string;
      subject?: string;
      grade?: string;
      section?: string;
      batch_type?: string;
      scheduled_start?: string;
      duration_minutes?: number;
      open_at?: string;
      expires_at?: string;
      batch_id?: string;
      batch_session_id?: string;
    };

    if (!room_id || !room_name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: room_id, room_name' },
        { status: 400 }
      );
    }

    // Validate batch_type
    const validBatchTypes = [
      'one_to_one', 'one_to_three', 'one_to_five',
      'one_to_fifteen', 'one_to_many', 'one_to_thirty',
      'lecture', 'improvement_batch', 'custom',
    ];
    const resolvedBatchType = batch_type && validBatchTypes.includes(batch_type) ? batch_type : 'one_to_many';

    // Get session config (limits & defaults)
    const configResult = await db.query('SELECT * FROM session_config LIMIT 1');
    const sessionConfig = configResult.rows[0] as Record<string, unknown> | undefined;
    const maxSessionsPerDay = Number(sessionConfig?.max_sessions_per_day) || 4;
    const defaultDuration = Number(sessionConfig?.default_duration_minutes) || 90;
    const resolvedDuration = duration_minutes || defaultDuration;

    // Max participants based on batch type (0 = unlimited at portal level)
    const batchMaxMap: Record<string, number> = {
      one_to_one: 1, one_to_three: 3, one_to_five: 5,
      one_to_fifteen: 15, one_to_many: 0, one_to_thirty: 30,
      lecture: 0, improvement_batch: 0, custom: 0,
    };
    const batchMaxParticipants = batchMaxMap[resolvedBatchType] ?? 0;

    // Enforce teacher session limit (max per day)
    if (teacher_email && scheduled_start) {
      const schedDate = new Date(scheduled_start);
      const dayStart = new Date(schedDate); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(schedDate); dayEnd.setHours(23, 59, 59, 999);
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM rooms
         WHERE teacher_email = $1 AND scheduled_start >= $2 AND scheduled_start <= $3
         AND status NOT IN ('cancelled')`,
        [teacher_email, dayStart.toISOString(), dayEnd.toISOString()]
      );
      const dailyCount = Number(countResult.rows[0]?.cnt) || 0;
      if (dailyCount >= maxSessionsPerDay) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: `Teacher already has ${maxSessionsPerDay} sessions on this day (limit reached)` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate
    const existing = await db.query('SELECT room_id FROM rooms WHERE room_id = $1', [room_id]);
    if (existing.rows.length > 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room already exists with this ID' },
        { status: 409 }
      );
    }

    // Calculate open_at and expires_at defaults
    const scheduledDate = scheduled_start ? new Date(scheduled_start) : new Date();
    const defaultOpenAt = open_at || new Date(scheduledDate.getTime() - 15 * 60 * 1000).toISOString(); // 15 min before
    const defaultExpiresAt = expires_at || new Date(scheduledDate.getTime() + resolvedDuration * 60 * 1000 + 30 * 60 * 1000).toISOString(); // duration + 30 min buffer

    // Resolve coordinator_email and grade from batch if not provided
    let coordinatorEmail = user.id; // default to creator
    let resolvedGrade = grade || null;
    if (batch_id) {
      const batchRow = await db.query('SELECT coordinator_email, grade FROM batches WHERE batch_id = $1', [batch_id]);
      if (batchRow.rows[0]?.coordinator_email) coordinatorEmail = batchRow.rows[0].coordinator_email as string;
      if (!resolvedGrade && batchRow.rows[0]?.grade) resolvedGrade = batchRow.rows[0].grade as string;
    }
    if (user.role === 'batch_coordinator') coordinatorEmail = user.id;

    // Insert room into database
    const result = await db.query(
      `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, section, batch_type, max_participants, status, scheduled_start, duration_minutes, open_at, expires_at, batch_id, batch_session_id, coordinator_email, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
       RETURNING *`,
      [room_id, room_name, teacher_email || null, subject || null, resolvedGrade, section || null, resolvedBatchType, batchMaxParticipants, scheduledDate.toISOString(), resolvedDuration, defaultOpenAt, defaultExpiresAt, batch_id || null, batch_session_id || null, coordinatorEmail, user.id]
    );

    // Ensure the room exists on LiveKit server
    const livekitRoom = await ensureRoom(room_id, JSON.stringify({
      room_name,
      portal_room_id: room_id,
      created_by: user.id,
    }));

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'room_created', $2, $3)`,
      [room_id, user.id, JSON.stringify({ room_name, livekit_sid: livekitRoom.sid })]
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          room: result.rows[0],
          livekit_sid: livekitRoom.sid,
        },
        message: 'Room created successfully',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[room/create] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
