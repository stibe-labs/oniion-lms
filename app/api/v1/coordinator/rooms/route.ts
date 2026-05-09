// ═══════════════════════════════════════════════════════════════
// Coordinator Rooms API — GET + POST
// GET  /api/v1/coordinator/rooms           — List rooms
// POST /api/v1/coordinator/rooms           — Create room
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendCreationNotifications } from '@/lib/room-notifications';

// ── Auth helper ─────────────────────────────────────────────
async function getCoordinator(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user) return null;
  if (!['batch_coordinator', 'academic_operator', 'owner'].includes(user.role)) return null;
  return user;
}

function generateRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = 'room_';
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── GET — List all rooms for this coordinator ───────────────
export async function GET(req: NextRequest) {
  const user = await getCoordinator(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  let whereSql = ' WHERE 1=1';
  const params: unknown[] = [];

  // Owner sees all rooms; batch_coordinator sees only their own
  if (user.role === 'batch_coordinator') {
    params.push(user.id);
    whereSql += ` AND r.coordinator_email = $${params.length}`;
  }

  if (status && status !== 'all') {
    params.push(status);
    whereSql += ` AND r.status = $${params.length}`;
  }

  // Count total matching rows for proper pagination
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM rooms r ${whereSql}`,
    params
  );
  const total = countResult.rows[0]?.total ?? 0;

  const sql = `
    SELECT r.room_id, r.room_name, r.subject, r.grade, r.section,
           r.coordinator_email, r.teacher_email, r.status,
           r.scheduled_start, r.duration_minutes, r.max_participants,
           r.fee_paise, r.notes_for_teacher, r.open_at, r.expires_at,
           r.livekit_room_id, r.created_at, r.updated_at, r.go_live_at,
           (SELECT COUNT(*) FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count,
           (SELECT ra.participant_name FROM room_assignments ra WHERE ra.room_id = r.room_id AND ra.participant_type = 'teacher' LIMIT 1) AS teacher_name
    FROM rooms r
    ${whereSql}
    ORDER BY r.scheduled_start DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  params.push(limit, offset);

  const result = await db.query(sql, params);

  return NextResponse.json({
    success: true,
    data: { rooms: result.rows, total },
  });
}

// ── POST — Create a new room ────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCoordinator(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    room_name,
    subject,
    grade,
    section,
    scheduled_start,
    duration_minutes,
    max_participants = 400,
    fee_paise = 0,
    notes_for_teacher,
    teacher_email,
    coordinator_email: bodyCoordinatorEmail, // Optional: override coordinator
    students, // Optional: [{ email, name }]
  } = body;

  // Validation
  if (!room_name || !subject || !grade || !scheduled_start || !duration_minutes) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: room_name, subject, grade, scheduled_start, duration_minutes' },
      { status: 400 }
    );
  }

  if (!teacher_email) {
    return NextResponse.json(
      { success: false, error: 'Teacher assignment is required' },
      { status: 400 }
    );
  }

  // Trim and validate room_name is not whitespace-only
  const trimmedName = String(room_name).trim();
  if (!trimmedName) {
    return NextResponse.json(
      { success: false, error: 'Room name cannot be empty' },
      { status: 400 }
    );
  }

  // Validate duration and max_participants ranges
  const dur = Number(duration_minutes);
  const maxPart = Number(max_participants); // 0 = unlimited
  if (!dur || dur < 10 || dur > 600) {
    return NextResponse.json(
      { success: false, error: 'Duration must be between 10 and 600 minutes' },
      { status: 400 }
    );
  }
  if (maxPart < 0) {
    return NextResponse.json(
      { success: false, error: 'Max participants must be 0 (unlimited) or a positive number' },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduled_start);
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json(
      { success: false, error: 'Invalid scheduled_start date' },
      { status: 400 }
    );
  }

  // Ensure scheduled_start is in the future (at least 5 min from now)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (scheduledDate < fiveMinFromNow) {
    return NextResponse.json(
      { success: false, error: 'Scheduled start must be at least 5 minutes in the future' },
      { status: 400 }
    );
  }

  // Derive open_at (15 min before) and expires_at (end + 15 min grace)
  const earlyJoinMs = 15 * 60 * 1000;
  const graceMs = 15 * 60 * 1000;
  const openAt = new Date(scheduledDate.getTime() - earlyJoinMs);
  const expiresAt = new Date(
    scheduledDate.getTime() + dur * 60 * 1000 + graceMs
  );

  const roomId = generateRoomId();

  // Determine coordinator: use body override if provided (academic_operator can assign), else logged-in user
  const coordinatorEmail = bodyCoordinatorEmail || user.id;

  try {
    // Look up teacher name from portal_users if teacher_email provided
    let teacherName: string | null = null;
    if (teacher_email) {
      const teacherResult = await db.query(
        'SELECT full_name FROM portal_users WHERE email = $1 LIMIT 1',
        [teacher_email]
      );
      teacherName = teacherResult.rows[0]?.full_name || teacher_email;
    }

    const insertResult = await db.withTransaction(async (client) => {
      // Insert room
      const result = await client.query(
        `INSERT INTO rooms (
          room_id, room_name, subject, grade, section,
          coordinator_email, teacher_email, status,
          scheduled_start, duration_minutes, open_at, expires_at,
          max_participants, fee_paise, notes_for_teacher
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [
          roomId,
          trimmedName,
          subject,
          grade,
          section || null,
          coordinatorEmail,
          teacher_email || null,
          scheduledDate.toISOString(),
          dur,
          openAt.toISOString(),
          expiresAt.toISOString(),
          maxPart,
          fee_paise,
          notes_for_teacher || null,
        ]
      );

      // Audit event
      await client.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
         VALUES ($1, 'room_created', $2, 'batch_coordinator', $3)`,
        [roomId, user.id, JSON.stringify({ room_name: trimmedName, subject, grade, teacher_email })]
      );

      // If teacher assigned, create room_assignment with their real name
      if (teacher_email) {
        await client.query(
          `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status)
           VALUES ($1, 'teacher', $2, $3, 'exempt')
           ON CONFLICT (room_id, participant_email) DO NOTHING`,
          [roomId, teacher_email, teacherName]
        );
      }

      // Add students if provided
      const studentList = Array.isArray(students) ? students : [];
      for (const s of studentList) {
        if (s.email && s.name) {
          await client.query(
            `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status)
             VALUES ($1, 'student', $2, $3, 'unpaid')
             ON CONFLICT (room_id, participant_email) DO NOTHING`,
            [roomId, s.email, s.name]
          );
        }
      }

      return result.rows[0];
    });

    // Fire-and-forget: send creation notification emails to all participants
    sendCreationNotifications({
      room_id: roomId,
      room_name: trimmedName,
      subject,
      grade,
      scheduled_start: scheduledDate.toISOString(),
      duration_minutes: dur,
      notes_for_teacher: notes_for_teacher || null,
    }).catch(err => console.error('[coordinator/rooms] Notification error:', err));

    return NextResponse.json({
      success: true,
      data: { room: insertResult },
    }, { status: 201 });
  } catch (err) {
    console.error('[coordinator/rooms] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
