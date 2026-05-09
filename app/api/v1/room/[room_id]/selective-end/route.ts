import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db, resolveRoomId } from '@/lib/db';
import { roomService, listParticipants } from '@/lib/livekit';

/**
 * POST /api/v1/room/[room_id]/selective-end
 *
 * Called at the original scheduled end time when extensions are active.
 * Removes non-extension students from the LiveKit room while keeping
 * extension students and the teacher connected.
 *
 * Auth: teacher assigned to the room
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Auth required' },
        { status: 401 },
      );
    }
    const user = await verifySession(token);
    if (!user || user.role !== 'teacher') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the teacher can trigger selective end' },
        { status: 403 },
      );
    }

    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);

    // 1. Verify room is live and has extensions
    const roomRes = await db.query(
      `SELECT room_id, status, original_duration_minutes, duration_minutes
       FROM rooms WHERE room_id = $1`,
      [actualRoomId],
    );
    if (roomRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 },
      );
    }
    const room = roomRes.rows[0] as {
      room_id: string;
      status: string;
      original_duration_minutes: number | null;
      duration_minutes: number;
    };
    if (room.status !== 'live') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room is not live' },
        { status: 400 },
      );
    }
    if (!room.original_duration_minutes) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No extensions active — use normal end instead' },
        { status: 400 },
      );
    }

    // 2. Get approved extension student emails for this room
    const extRes = await db.query(
      `SELECT DISTINCT student_email
       FROM session_extension_requests
       WHERE room_id = $1 AND status = 'approved'`,
      [actualRoomId],
    );
    const extensionStudents = new Set(
      (extRes.rows as Array<{ student_email: string }>).map(r => r.student_email),
    );

    // 3. List current LiveKit participants
    let participants: { identity: string }[] = [];
    try {
      participants = await listParticipants(actualRoomId);
    } catch {
      // Room may have already ended in LiveKit
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { removed: [], kept: [], message: 'No LiveKit room found' },
      });
    }

    // 4. Remove non-extension students
    // Identity format: student_{email} or student_{email}@domain
    const removed: string[] = [];
    const kept: string[] = [];
    const protectedPrefixes = ['teacher', 'coordinator', 'owner', 'academic', 'parent', 'ghost'];

    for (const p of participants) {
      const identity = p.identity;

      // Skip protected roles (teacher, coordinator, etc.)
      if (protectedPrefixes.some(prefix => identity.startsWith(`${prefix}_`))) {
        kept.push(identity);
        continue;
      }

      // Parse student email from identity: "student_email@domain.com"
      const studentEmail = identity.replace(/^student_/, '');

      if (extensionStudents.has(studentEmail)) {
        // This student has an approved extension — keep them
        kept.push(identity);
      } else {
        // No extension — remove from LiveKit
        try {
          await roomService.removeParticipant(actualRoomId, identity);
          removed.push(identity);
        } catch (err) {
          console.error(`[selective-end] Failed to remove ${identity}:`, err);
        }
      }
    }

    // 5. Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'selective_end', $2, $3)`,
      [actualRoomId, user.id, JSON.stringify({
        removed: removed.length,
        kept: kept.length,
        extension_students: Array.from(extensionStudents),
      })],
    );

    console.log(
      `[selective-end] Room ${actualRoomId}: removed ${removed.length}, kept ${kept.length}`,
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { removed, kept },
    });
  } catch (err) {
    console.error('[selective-end] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to process selective end' },
      { status: 500 },
    );
  }
}
