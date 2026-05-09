import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db, resolveRoomId } from '@/lib/db';
import { deleteRoom as deleteLiveKitRoom } from '@/lib/livekit';
import { stopRecording } from '@/lib/recording';
import { sendDemoSummaryNotifications } from '@/lib/demo-summary';
import { consumeOneGeneralCredit } from '@/lib/payment';

/**
 * GET /api/v1/room/[room_id]
 * Returns room status + go_live_at. Lightweight check used by the classroom
 * to detect if the session is already live (e.g. after a page refresh).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    const actualRoomId = await resolveRoomId(room_id);
    const result = await db.query(
      `SELECT r.room_id, r.status, r.go_live_at, r.room_name, r.subject,
              COALESCE(NULLIF(r.grade,''), b.grade) AS grade,
              r.batch_session_id, r.recording_status, r.duration_minutes, r.original_duration_minutes
       FROM rooms r
       LEFT JOIN batches b ON b.batch_id = r.batch_id
       WHERE r.room_id = $1`,
      [actualRoomId],
    );
    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Room not found' }, { status: 404 });
    }
    const room = result.rows[0] as Record<string, unknown>;
    return NextResponse.json<ApiResponse>({
      success: true,
      data: { room_id: room.room_id, status: room.status, go_live_at: room.go_live_at, room_name: room.room_name, subject: room.subject, grade: room.grade, batch_session_id: room.batch_session_id, recording_status: room.recording_status, duration_minutes: room.duration_minutes, original_duration_minutes: room.original_duration_minutes },
    });
  } catch (err) {
    console.error('[room/get] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/room/[room_id]
 * Update class portion (topics covered) and/or remarks after a session.
 * Auth: teacher (assigned to room), coordinator, academic_operator, owner.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);

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
    const roomResult = await db.query(
      'SELECT room_id, teacher_email FROM rooms WHERE room_id = $1',
      [actualRoomId]
    );
    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];
    const adminRoles = ['batch_coordinator', 'academic_operator', 'academic', 'owner'];
    const isTeacherOfRoom = user.role === 'teacher' && room.teacher_email === user.id;
    const isAdmin = adminRoles.includes(user.role);

    if (!isTeacherOfRoom && !isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the assigned teacher or admin roles can update class details' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { class_portion, class_remarks } = body as {
      class_portion?: string;
      class_remarks?: string;
    };

    if (!class_portion && !class_remarks) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Provide class_portion and/or class_remarks' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (class_portion !== undefined) {
      values.push(class_portion);
      updates.push(`class_portion = $${values.length}`);
    }
    if (class_remarks !== undefined) {
      values.push(class_remarks);
      updates.push(`class_remarks = $${values.length}`);
    }

    updates.push('updated_at = NOW()');
    values.push(actualRoomId);

    await db.query(
      `UPDATE rooms SET ${updates.join(', ')} WHERE room_id = $${values.length}`,
      values
    );

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'class_portion_updated', $2, $3)`,
      [actualRoomId, user.id, JSON.stringify({ class_portion, class_remarks, updated_by: user.name })]
    );

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'Class details updated successfully' },
      { status: 200 }
    );
  } catch (err) {
    console.error('[room/patch] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/room/[room_id]
 * Ends a class: deletes the LiveKit room (disconnects all participants)
 * and marks the room as 'ended' in the DB.
 * Auth: teacher (who is assigned to the room), coordinator, academic_operator, owner.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  try {
    const { room_id } = await params;

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

    // Verify room exists — support both livekit_room_name and batch session_id
    const roomResult = await db.query(
      `SELECT room_id, status, room_name, teacher_email, batch_session_id
       FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0] as Record<string, string | null>;
    const actualRoomId = room.room_id as string;
    const batchSessionId = room.batch_session_id;

    // Authorization: teacher of this room, or admin roles
    const adminRoles = ['batch_coordinator', 'academic_operator', 'academic', 'owner'];
    const isTeacherOfRoom = user.role === 'teacher' && room.teacher_email === user.id;
    const isAdmin = adminRoles.includes(user.role);

    if (!isTeacherOfRoom && !isAdmin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the assigned teacher or admin roles can end a class' },
        { status: 403 }
      );
    }

    // Stop recording if active (before deleting the LiveKit room)
    try {
      await stopRecording(actualRoomId);
    } catch (e) {
      console.warn(`[room/delete] stopRecording warning for ${actualRoomId}:`, e);
    }

    // Record explicit-end marker so the LiveKit webhook's room_finished handler
    // recognizes this as a genuine teacher-initiated end (not an idle auto-close).
    await db.query(
      `INSERT INTO room_events (room_id, event_type, payload)
       VALUES ($1, 'room_end_requested', $2)`,
      [actualRoomId, JSON.stringify({ ended_by: user.id, role: user.role })]
    ).catch(e => console.warn('[room/delete] end-requested event insert warning:', e));

    // Delete the LiveKit room (disconnects all participants instantly)
    try {
      await deleteLiveKitRoom(actualRoomId);
    } catch (e) {
      // Room may already be gone from LiveKit — that's okay
      console.warn(`[room/delete] LiveKit room delete warning for ${actualRoomId}:`, e);
    }

    // Update DB status to ended
    await db.query(
      `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW()
       WHERE room_id = $1`,
      [actualRoomId]
    );

    // Sync batch_session status to 'ended'
    if (batchSessionId) {
      await db.query(
        `UPDATE batch_sessions SET status = 'ended', ended_at = COALESCE(ended_at, NOW())
         WHERE session_id = $1 AND status IN ('live', 'scheduled')`,
        [batchSessionId]
      ).catch(e => console.warn('[room/delete] batch_session sync warning:', e));

      // Deduct 1 invoice_payment credit per enrolled student (fire-and-forget)
      void (async () => {
        try {
          const batchRes = await db.query(
            `SELECT s.batch_id, b.batch_type
             FROM batch_sessions s
             JOIN batches b ON b.batch_id = s.batch_id
             WHERE s.session_id = $1`,
            [batchSessionId],
          );
          if (batchRes.rows.length > 0) {
            const { batch_id, batch_type } = batchRes.rows[0] as { batch_id: string; batch_type: string };
            const studentsRes = await db.query(
              `SELECT student_email FROM batch_students WHERE batch_id = $1`,
              [batch_id],
            );
            for (const row of studentsRes.rows as Array<{ student_email: string }>) {
              await consumeOneGeneralCredit({
                studentEmail: row.student_email,
                batchType: batch_type,
                sessionId: batchSessionId,
                source: 'invoice_payment',
              }).catch(e => console.warn(`[room/delete] credit deduct warning for ${row.student_email}:`, e));
            }
          }
        } catch (e) {
          console.warn('[room/delete] session-end credit deduction error:', e);
        }
      })();
    }

    // If this is a demo room, mark the demo request as completed with outcome
    if (actualRoomId.startsWith('demo_')) {
      try {
        // Check if student ever joined (look at room_events for a student participant_joined)
        const studentJoined = await db.query(
          `SELECT 1 FROM room_events
           WHERE room_id = $1 AND event_type = 'participant_joined'
             AND participant_role = 'student'
           LIMIT 1`,
          [actualRoomId]
        );
        const hasExam = await db.query(
          `SELECT 1 FROM demo_exam_results WHERE room_id = $1 LIMIT 1`,
          [actualRoomId]
        );
        // Determine outcome — only mark 'cancelled_by_teacher' if ended
        // significantly early (< 70% of scheduled duration elapsed)
        let outcome: string;
        if (studentJoined.rows.length === 0) {
          outcome = 'student_no_show';
        } else if (hasExam.rows.length > 0) {
          outcome = 'completed_with_exam';
        } else if (isTeacherOfRoom) {
          // Check if teacher ended early vs normal completion
          const roomTiming = await db.query(
            `SELECT scheduled_start, duration_minutes FROM rooms WHERE room_id = $1`,
            [actualRoomId]
          );
          const rt = roomTiming.rows[0];
          if (rt) {
            const start = new Date(String(rt.scheduled_start)).getTime();
            const durationMs = (Number(rt.duration_minutes) || 30) * 60 * 1000;
            const elapsed = Date.now() - start;
            outcome = elapsed < durationMs * 0.7 ? 'cancelled_by_teacher' : 'completed';
          } else {
            outcome = 'completed';
          }
        } else {
          outcome = 'completed';
        }
        await db.query(
          `UPDATE demo_requests SET status = 'completed', outcome = $2, updated_at = NOW()
           WHERE room_id = $1 AND status IN ('accepted', 'live')`,
          [actualRoomId, outcome]
        );
      } catch (e) {
        console.warn('[room/delete] demo_requests completion update warning:', e);
      }
    }

    // Log event
    const eventType = actualRoomId.startsWith('demo_') && isTeacherOfRoom
      ? 'demo_ended_by_teacher'
      : 'room_ended_by_teacher';
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, $2, $3, $4)`,
      [actualRoomId, eventType, user.id, JSON.stringify({ ended_by: user.name, role: user.role })]
    );

    // Fire-and-forget demo summary notifications (teacher, AO, student)
    // Use 5s delay to allow DB writes to settle; feedback trigger may send first
    if (actualRoomId.startsWith('demo_')) {
      sendDemoSummaryNotifications(actualRoomId, 5000).catch(e =>
        console.error('[room/delete] Demo summary notification error:', e)
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: `Class "${room.room_name}" has been ended. All participants disconnected.`,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[room/delete] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
