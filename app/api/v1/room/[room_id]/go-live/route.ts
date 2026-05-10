import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { sendGoLiveNotifications } from '@/lib/room-notifications';

/**
 * POST /api/v1/room/[room_id]/go-live
 *
 * Teacher clicks "Go Live" in the classroom UI.
 * Changes room status from 'scheduled' → 'live'.
 * Only the assigned teacher or admin roles can trigger this.
 *
 * After this, students can join the room.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

    // Auth: session cookie required
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

    // Verify room exists
    // Support both livekit_room_name (room_id) and batch session_id as identifiers
    const roomResult = await db.query(
      `SELECT room_id, status, room_name, teacher_email, subject, grade, scheduled_start, duration_minutes,
              batch_session_id
       FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found. Session may not have started yet — please wait for the prep window to open.' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0] as Record<string, unknown>;
    const actualRoomId = room.room_id as string;
    const batchSessionId = room.batch_session_id as string | null;

    // Authorization: teacher of this room, or admin roles
    // If room.teacher_email is null (room created before teacher assigned), fall back to batch_sessions
    const adminRoles = ['batch_coordinator', 'academic_operator', 'academic', 'owner'];
    let effectiveTeacherEmail = room.teacher_email as string | null;
    if (!effectiveTeacherEmail && batchSessionId) {
      const sessTeacher = await db.query(
        `SELECT teacher_email FROM batch_sessions WHERE session_id = $1`,
        [batchSessionId]
      );
      effectiveTeacherEmail = (sessTeacher.rows[0] as Record<string, string | null>)?.teacher_email ?? null;
      // Opportunistically fix the room record
      if (effectiveTeacherEmail) {
        db.query(`UPDATE rooms SET teacher_email = $1 WHERE room_id = $2`, [effectiveTeacherEmail, actualRoomId]).catch(() => {});
      }
    }
    const isTeacherOfRoom = user.role === 'teacher' && effectiveTeacherEmail === user.id;
    const isAdmin = adminRoles.includes(user.role);

    if (!isTeacherOfRoom && !isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the assigned teacher can start the class' },
        { status: 403 }
      );
    }

    // Only scheduled rooms can go live
    if (room.status === 'live') {
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'Room is already live' },
        { status: 200 }
      );
    }

    if (room.status !== 'scheduled') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Cannot go live — room status is "${room.status}"` },
        { status: 400 }
      );
    }

    // Load teacher controls (global toggles managed by AO/Owner)
    let skipCoordinator = false;
    let allowGoLiveBeforeSchedule = false;
    try {
      const ctrlRes = await db.query(
        `SELECT setting_values FROM academic_settings WHERE setting_key = 'teacher_controls'`
      );
      const ctrlRow = ctrlRes.rows[0] as { setting_values?: string[] } | undefined;
      if (ctrlRow?.setting_values?.[0]) {
        const ctrl = JSON.parse(ctrlRow.setting_values[0]) as { go_live_skip_coordinator?: boolean; allow_go_live_before_schedule?: boolean };
        skipCoordinator = ctrl.go_live_skip_coordinator === true;
        allowGoLiveBeforeSchedule = ctrl.allow_go_live_before_schedule === true;
      }
    } catch { /* fallback to defaults */ }

    // Optional time gate: teachers can go live early only when explicitly allowed.
    // A 30-minute prep window is always permitted regardless of the setting.
    // Admin roles can still trigger go-live at any time.
    const isDemoRoom = actualRoomId.startsWith('demo_');
    const schedMs = room.scheduled_start ? new Date(String(room.scheduled_start)).getTime() : NaN;
    const PREP_WINDOW_MS = 30 * 60 * 1000; // 30 min early always allowed
    const beforePrepWindow = !isNaN(schedMs) && Date.now() < schedMs - PREP_WINDOW_MS;
    if (!isAdmin && !isDemoRoom && beforePrepWindow && !allowGoLiveBeforeSchedule) {
      const minsUntilPrep = Math.ceil((schedMs - PREP_WINDOW_MS - Date.now()) / 60000);
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Go Live opens 30 minutes before the scheduled time (${minsUntilPrep} min to go). Contact Academic Operator to allow earlier start.` },
        { status: 403 }
      );
    }

    // Enforce coordinator approval: if batch has a coordinator, go_live_status must be 'approved'
    // UNLESS teacher_controls.go_live_skip_coordinator is enabled
    if (batchSessionId) {
      const approvalCheck = await db.query(
        `SELECT s.go_live_status, b.coordinator_email
         FROM batch_sessions s
         JOIN batches b ON b.batch_id = s.batch_id
         WHERE s.session_id = $1`,
        [batchSessionId]
      );
      if (approvalCheck.rows.length > 0) {
        const sess = approvalCheck.rows[0] as Record<string, string | null>;
        if (sess.coordinator_email && sess.go_live_status !== 'approved') {
          if (!skipCoordinator) {
            return NextResponse.json<ApiResponse>(
              { success: false, error: 'Coordinator approval required before going live.' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Update DB: scheduled → live using resolved room_id
    // Store actual go-live timestamp
    const goLiveAt = new Date().toISOString();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    console.log(`[go-live] room=${actualRoomId} triggered_by=${user.id} role=${user.role} ua=${userAgent}`);

    const updateResult = await db.query(
      `UPDATE rooms SET status = 'live', updated_at = NOW(), go_live_at = NOW()
       WHERE room_id = $1 AND status = 'scheduled'`,
      [actualRoomId]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'Room is already live' },
        { status: 200 }
      );
    }

    // Clear lobby presence — students will now join LiveKit directly
    db.query(`DELETE FROM lobby_presence WHERE room_id = $1`, [actualRoomId]).catch(() => {});

    // Sync batch_session status to 'live' when teacher goes live
    if (batchSessionId) {
      await db.query(
        `UPDATE batch_sessions SET status = 'live', started_at = COALESCE(started_at, NOW())
         WHERE session_id = $1 AND status = 'scheduled'`,
        [batchSessionId]
      ).catch(e => console.warn('[go-live] batch_session sync warning:', e));
    }

    // Sync open_classroom status if this is an OC room
    if (actualRoomId.startsWith('oc_')) {
      await db.query(
        `UPDATE open_classrooms SET status = 'live', started_at = COALESCE(started_at, NOW())
         WHERE (livekit_room_name = $1 OR room_id = $1) AND status IN ('created', 'scheduled')`,
        [actualRoomId]
      ).catch(e => console.warn('[go-live] open_classrooms sync warning:', e));
    }

    // Log event with go_live_at for coordinator reporting
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'room_started', $2, $3)`,
      [actualRoomId, user.id, JSON.stringify({ started_by: user.name, role: user.role, go_live_at: goLiveAt, source: userAgent })]
    );

    // If this is a demo room, set demo_requests.status to 'live'
    if (actualRoomId.startsWith('demo_')) {
      await db.query(
        `UPDATE demo_requests SET status = 'live', updated_at = NOW()
         WHERE room_id = $1 AND status = 'accepted'`,
        [actualRoomId]
      ).catch(e => console.warn('[go-live] demo_requests live update warning:', e));
    }

    // Fire-and-forget: notify students that class has started
    sendGoLiveNotifications({
      room_id: actualRoomId,
      room_name: room.room_name as string,
      subject: room.subject as string || '',
      grade: room.grade as string || '',
      scheduled_start: room.scheduled_start as string || new Date().toISOString(),
      duration_minutes: (room.duration_minutes as number) || 60,
    }).catch(err => console.error('[go-live] Notification error:', err));

    // Recording is now manual — BC starts it from the Live Monitor UI
    // (Removed auto-start recording)

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: `Class "${room.room_name}" is now live!`,
        data: { go_live_at: goLiveAt },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[room/go-live] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
