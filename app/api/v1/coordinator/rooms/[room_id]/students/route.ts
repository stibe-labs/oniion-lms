// ═══════════════════════════════════════════════════════════════
// Room Students API
// GET  /api/v1/coordinator/rooms/[room_id]/students — List
// POST /api/v1/coordinator/rooms/[room_id]/students — Add students
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

// List students assigned to a room
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const actualRoomId = await resolveRoomId(room_id);
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const result = await db.query(
    `SELECT id, participant_email, participant_name, payment_status,
            notification_sent_at, joined_at, left_at, created_at
     FROM room_assignments
     WHERE room_id = $1 AND participant_type = 'student'
     ORDER BY participant_name`,
    [actualRoomId]
  );

  return NextResponse.json({ success: true, data: { students: result.rows } });
}

// Add students to a room (bulk)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const actualRoomId = await resolveRoomId(room_id);
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const students: Array<{ email: string; name: string; payment_status?: string }> =
    body.students || [];

  if (students.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Provide students array with email and name' },
      { status: 400 }
    );
  }

  // Verify room exists and is in an appropriate status
  const roomCheck = await db.query(
    'SELECT room_id, status, max_participants FROM rooms WHERE room_id = $1',
    [actualRoomId]
  );
  if (roomCheck.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }
  const room = roomCheck.rows[0] as Record<string, unknown>;
  if (room.status === 'cancelled' || room.status === 'ended') {
    return NextResponse.json(
      { success: false, error: `Cannot add students to a ${room.status} room` },
      { status: 400 }
    );
  }

  // Check max_participants limit
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS cnt FROM room_assignments WHERE room_id = $1 AND participant_type = 'student'`,
    [actualRoomId]
  );
  const currentCount = Number(countResult.rows[0]?.cnt ?? 0);
  const maxParticipants = Number(room.max_participants); // 0 = unlimited
  if (maxParticipants > 0 && currentCount + students.length > maxParticipants) {
    return NextResponse.json(
      { success: false, error: `Cannot add ${students.length} students — room limit is ${maxParticipants} (currently ${currentCount} assigned)` },
      { status: 400 }
    );
  }

  let added = 0;
  const errors: string[] = [];

  for (const s of students) {
    if (!s.email || !s.name) {
      errors.push(`Missing email/name: ${JSON.stringify(s)}`);
      continue;
    }
    try {
      await db.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status)
         VALUES ($1, 'student', $2, $3, $4)
         ON CONFLICT (room_id, participant_email) DO UPDATE SET participant_name = $3`,
        [actualRoomId, s.email, s.name, s.payment_status || 'unknown']
      );
      added++;
    } catch (err) {
      errors.push(`${s.email}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    success: true,
    data: { added, errors: errors.length, errorDetails: errors },
  });
}

// ── DELETE — Remove a student from a room ──────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const actualRoomId = await resolveRoomId(room_id);
  const user = await getCoordinator(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { email } = body as { email?: string };

  if (!email) {
    return NextResponse.json({ success: false, error: 'Missing email' }, { status: 400 });
  }

  const result = await db.query(
    `DELETE FROM room_assignments
     WHERE room_id = $1 AND participant_email = $2 AND participant_type = 'student'
     RETURNING id`,
    [actualRoomId, email]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ success: false, error: 'Student not found in this room' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { message: 'Student removed' } });
}
