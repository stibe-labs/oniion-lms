// ═══════════════════════════════════════════════════════════════
// Room Detail + Update + Delete
// GET    /api/v1/coordinator/rooms/[room_id] — Room details
// PATCH  /api/v1/coordinator/rooms/[room_id] — Update room
// DELETE /api/v1/coordinator/rooms/[room_id] — Cancel room
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db, resolveRoomId } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getCoordinator(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['batch_coordinator', 'academic_operator', 'owner'].includes(user.role)) return null;
  return user;
}

// ── GET — Room detail with assignments ──────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const actualRoomId = await resolveRoomId(room_id);
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const roomResult = await db.query('SELECT * FROM rooms WHERE room_id = $1', [actualRoomId]);
  if (roomResult.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }

  const assignResult = await db.query(
    `SELECT id, participant_type, participant_email, participant_name,
            join_token, device_preference, notification_sent_at,
            joined_at, left_at, payment_status, created_at
     FROM room_assignments WHERE room_id = $1
     ORDER BY participant_type, participant_email`,
    [actualRoomId]
  );

  const eventsResult = await db.query(
    `SELECT event_type, participant_email, participant_role, payload, created_at
     FROM room_events WHERE room_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [actualRoomId]
  );

  return NextResponse.json({
    success: true,
    data: {
      room: roomResult.rows[0],
      assignments: assignResult.rows,
      events: eventsResult.rows,
    },
  });
}

// ── PATCH — Update room fields ──────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const actualRoomId = await resolveRoomId(room_id);
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Verify room exists and is editable
  const roomCheck = await db.query('SELECT status, teacher_email FROM rooms WHERE room_id = $1', [actualRoomId]);
  if (roomCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }
  const currentRoom = roomCheck.rows[0] as Record<string, unknown>;
  if (currentRoom.status !== 'scheduled') {
    return NextResponse.json(
      { success: false, error: `Cannot edit a ${currentRoom.status} room` },
      { status: 400 }
    );
  }

  const body = await req.json();
  const allowed = [
    'room_name', 'subject', 'grade', 'section', 'teacher_email',
    'scheduled_start', 'duration_minutes', 'max_participants',
    'fee_paise', 'notes_for_teacher',
  ];

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  for (const key of allowed) {
    if (key in body) {
      // Trim room_name
      const value = key === 'room_name' ? String(body[key]).trim() : body[key];
      sets.push(`${key} = $${i}`);
      vals.push(value);
      i++;
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }

  // Recalculate open_at / expires_at if schedule changed
  if (body.scheduled_start || body.duration_minutes) {
    const cur = currentRoom;
    const startStr = body.scheduled_start || cur.scheduled_start;
    const dur = body.duration_minutes || cur.duration_minutes;
    const start = new Date(startStr as string);
    const earlyMs = 15 * 60 * 1000;
    const graceMs = 15 * 60 * 1000;

    sets.push(`open_at = $${i}`);
    vals.push(new Date(start.getTime() - earlyMs).toISOString());
    i++;
    sets.push(`expires_at = $${i}`);
    vals.push(new Date(start.getTime() + (dur as number) * 60 * 1000 + graceMs).toISOString());
    i++;
  }

  // If teacher_email changed, sync room_assignments
  const teacherChanged = 'teacher_email' in body && body.teacher_email !== currentRoom.teacher_email;

  vals.push(actualRoomId);
  const sql = `UPDATE rooms SET ${sets.join(', ')} WHERE room_id = $${i} RETURNING *`;

  try {
    let result;
    if (teacherChanged) {
      result = await db.withTransaction(async (client) => {
        const res = await client.query(sql, vals);

        // Remove old teacher assignment
        if (currentRoom.teacher_email) {
          await client.query(
            `DELETE FROM room_assignments WHERE room_id = $1 AND participant_email = $2 AND participant_type = 'teacher'`,
            [actualRoomId, currentRoom.teacher_email]
          );
        }

        // Add new teacher assignment with real name
        if (body.teacher_email) {
          const teacherLookup = await client.query(
            'SELECT full_name FROM portal_users WHERE email = $1 LIMIT 1',
            [body.teacher_email]
          );
          const teacherName = teacherLookup.rows[0]?.full_name || body.teacher_email;
          await client.query(
            `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status)
             VALUES ($1, 'teacher', $2, $3, 'exempt')
             ON CONFLICT (room_id, participant_email) DO UPDATE SET participant_name = $3`,
            [actualRoomId, body.teacher_email, teacherName]
          );
        }

        return res;
      });
    } else {
      result = await db.query(sql, vals);
    }

    return NextResponse.json({ success: true, data: { room: result.rows[0] } });
  } catch (err) {
    console.error('[coordinator/rooms] PATCH error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update room' }, { status: 500 });
  }
}

// ── DELETE — Cancel room ────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const actualRoomId = await resolveRoomId(room_id);
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Verify room exists and check current status
  const roomCheck = await db.query('SELECT status FROM rooms WHERE room_id = $1', [actualRoomId]);
  if (roomCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }
  const currentStatus = (roomCheck.rows[0] as Record<string, string>).status;
  if (currentStatus === 'cancelled') {
    return NextResponse.json({ success: false, error: 'Room is already cancelled' }, { status: 400 });
  }
  if (currentStatus === 'ended') {
    return NextResponse.json({ success: false, error: 'Cannot cancel an ended room' }, { status: 400 });
  }

  await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE rooms SET status = 'cancelled' WHERE room_id = $1`,
      [actualRoomId]
    );
    await client.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
       VALUES ($1, 'room_cancelled', $2, 'batch_coordinator', '{}')`,
      [actualRoomId, user.id]
    );
  });

  return NextResponse.json({ success: true, data: { message: 'Room cancelled' } });
}
