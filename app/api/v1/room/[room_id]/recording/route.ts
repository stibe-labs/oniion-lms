import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { cookies } from 'next/headers';
import { startRecording, stopRecording, getRecordingStatus } from '@/lib/recording';
import { db } from '@/lib/db';

async function getRoomRecordingAccess(roomIdOrSessionId: string) {
  const roomResult = await db.query(
    `SELECT room_id, room_name, teacher_email, batch_session_id
     FROM rooms
     WHERE room_id = $1 OR batch_session_id = $1
     LIMIT 1`,
    [roomIdOrSessionId]
  );

  if (!roomResult.rows[0]) return null;

  const room = roomResult.rows[0] as {
    room_id: string;
    room_name: string;
    teacher_email: string | null;
    batch_session_id: string | null;
  };

  let effectiveTeacherEmail = room.teacher_email?.trim().toLowerCase() || null;
  if (!effectiveTeacherEmail && room.batch_session_id) {
    const sessionResult = await db.query(
      `SELECT teacher_email FROM batch_sessions WHERE session_id = $1`,
      [room.batch_session_id]
    );
    effectiveTeacherEmail =
      ((sessionResult.rows[0] as { teacher_email?: string | null } | undefined)?.teacher_email || '')
        .trim()
        .toLowerCase() || null;

    if (effectiveTeacherEmail) {
      db.query(
        `UPDATE rooms SET teacher_email = $1 WHERE room_id = $2`,
        [effectiveTeacherEmail, room.room_id]
      ).catch(() => {});
    }
  }

  return {
    roomId: room.room_id,
    roomName: room.room_name,
    teacherEmail: effectiveTeacherEmail,
  };
}

// GET — recording status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const room = await getRoomRecordingAccess(room_id);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const status = await getRecordingStatus(room.roomId);
  if (!status) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: {
      recording_status: status.recording_status,
      egress_id: status.egress_id,
    },
  });
}

// POST — start recording
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const room = await getRoomRecordingAccess(room_id);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const sessionEmail = session.id.trim().toLowerCase();
  const isAdmin = ['owner', 'academic_operator', 'batch_coordinator'].includes(session.role);
  const isAssignedTeacher = session.role === 'teacher' && room.teacherEmail === sessionEmail;
  if (!isAssignedTeacher && !isAdmin) {
    return NextResponse.json({ error: 'Only the assigned teacher can record' }, { status: 403 });
  }

  if (session.role === 'teacher') {
    try {
      const controlsResult = await db.query(
        `SELECT setting_values FROM academic_settings WHERE setting_key = 'teacher_controls'`
      );
      const raw = (controlsResult.rows[0] as { setting_values?: string[] } | undefined)?.setting_values?.[0];
      if (raw) {
        const controls = JSON.parse(raw) as { allow_recording?: boolean };
        if (controls.allow_recording === false) {
          return NextResponse.json({ error: 'Recording is currently disabled for teachers' }, { status: 403 });
        }
      }
    } catch {
      // Fall back to allowing recording if controls cannot be loaded.
    }
  }

  try {
    const result = await startRecording(room.roomName, room.roomId);
    if ((result as { alreadyRecording?: boolean }).alreadyRecording) {
      return NextResponse.json({ success: true, message: 'Already recording' });
    }
    return NextResponse.json({ success: true, message: 'Recording started' });
  } catch (err) {
    console.error('[recording-api] Start failed:', err);
    return NextResponse.json({ error: 'Failed to start recording' }, { status: 500 });
  }
}

// DELETE — stop recording
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const room = await getRoomRecordingAccess(room_id);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const sessionEmail = session.id.trim().toLowerCase();
  const isAdmin = ['owner', 'academic_operator', 'batch_coordinator'].includes(session.role);
  const isAssignedTeacher = session.role === 'teacher' && room.teacherEmail === sessionEmail;
  if (!isAssignedTeacher && !isAdmin) {
    return NextResponse.json({ error: 'Only the assigned teacher can stop recording' }, { status: 403 });
  }

  try {
    const result = await stopRecording(room.roomId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: 'Recording stopped' });
  } catch (err) {
    console.error('[recording-api] Stop failed:', err);
    return NextResponse.json({ error: 'Failed to stop recording' }, { status: 500 });
  }
}
