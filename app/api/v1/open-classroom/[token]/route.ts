import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { deleteRoom, listParticipants } from '@/lib/livekit';
import { sendWhatsApp } from '@/lib/whatsapp';
import { verifySession, COOKIE_NAME } from '@/lib/session';

/**
 * GET    /api/v1/open-classroom/[token] — Get classroom info (public)
 * DELETE /api/v1/open-classroom/[token] — End classroom (host/AO only)
 * PATCH  /api/v1/open-classroom/[token] — Edit / cancel / reschedule
 */

async function findByToken(token: string) {
  let result = await db.query(
    `SELECT oc.*, pu.full_name AS teacher_name, pu.portal_role AS teacher_portal_role
     FROM open_classrooms oc
     LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
     WHERE oc.host_token = $1 LIMIT 1`,
    [token]
  );
  if (result.rows.length > 0) return { classroom: result.rows[0], role: 'teacher' as const };

  result = await db.query(
    `SELECT oc.*, pu.full_name AS teacher_name, pu.portal_role AS teacher_portal_role
     FROM open_classrooms oc
     LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
     WHERE oc.join_token = $1 LIMIT 1`,
    [token]
  );
  if (result.rows.length > 0) return { classroom: result.rows[0], role: 'student' as const };

  return null;
}

/**
 * Lazy-update: if an OC is linked to a batch session and has no room yet,
 * check whether the batch session has gone live and auto-link the room.
 * Returns the (possibly updated) classroom row.
 */
async function syncBatchSessionRoom(classroom: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (classroom.livekit_room_name || !classroom.batch_session_id) return classroom;
  try {
    const bs = await db.query(
      `SELECT livekit_room_name, status FROM batch_sessions WHERE session_id = $1 LIMIT 1`,
      [classroom.batch_session_id]
    );
    if (bs.rows.length === 0) return classroom;
    const { livekit_room_name, status } = bs.rows[0] as { livekit_room_name: string | null; status: string };
    if ((status === 'live') && livekit_room_name) {
      await db.query(
        `UPDATE open_classrooms
         SET status = 'live', livekit_room_name = $1, room_id = $1
         WHERE id = $2`,
        [livekit_room_name, classroom.id]
      );
      return { ...classroom, status: 'live', livekit_room_name, room_id: livekit_room_name };
    }
  } catch { /* ignore — return original */ }
  return classroom;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const found = await findByToken(token);
    if (!found) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }

    const { classroom: rawClassroom, role } = found;
    // If this OC was pre-created for a scheduled batch session, sync room if it has gone live
    const classroom = await syncBatchSessionRoom(rawClassroom as Record<string, unknown>);

    // Look up share name if sid provided
    let shareName: string | null = null;
    let sharePhone: string | null = null;
    let shareEmail: string | null = null;
    const sid = request.nextUrl.searchParams.get('sid');
    if (sid) {
      const shareRes = await db.query(
        `SELECT name, phone, email FROM open_classroom_shares WHERE id = $1 AND classroom_id = $2 LIMIT 1`,
        [sid, classroom.id]
      );
      if (shareRes.rows.length > 0) {
        shareName = String(shareRes.rows[0].name || '');
        sharePhone = String(shareRes.rows[0].phone || '');
        shareEmail = String(shareRes.rows[0].email || '');
      }
    }

    // Participant counts — use live LiveKit count when room is active for accuracy
    const countRes = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE role = 'teacher') AS teacher_count,
              COUNT(*) FILTER (WHERE role = 'student') AS student_count
       FROM open_classroom_participants
       WHERE classroom_id = $1 AND left_at IS NULL`,
      [classroom.id]
    );
    let counts = countRes.rows[0] || { total: 0, teacher_count: 0, student_count: 0 };

    // For live classrooms, override with real-time LiveKit participant count
    const roomName = classroom.livekit_room_name || classroom.room_id;
    if (classroom.status === 'live' && roomName) {
      try {
        const lkParticipants = await listParticipants(String(roomName));
        const lkStudentCount = lkParticipants.filter(p => !p.identity.startsWith('teacher_')).length;
        const lkTeacherCount = lkParticipants.filter(p => p.identity.startsWith('teacher_')).length;
        counts = {
          total: lkParticipants.length,
          teacher_count: lkTeacherCount,
          student_count: lkStudentCount,
        };
      } catch {
        // LiveKit unreachable — fall back to DB count
      }
    }

    // Time gate for scheduled classrooms
    let canJoin = true;
    let opensAt: string | null = null;
    if (classroom.classroom_type === 'scheduled' && classroom.scheduled_at) {
      const scheduledTime = new Date(String(classroom.scheduled_at)).getTime();
      const earlyLobby = scheduledTime - 5 * 60 * 1000;
      if (role === 'teacher') {
        canJoin = true;
      } else {
        canJoin = Date.now() >= earlyLobby;
      }
      opensAt = new Date(earlyLobby).toISOString();
    }
    if (classroom.status === 'ended' || classroom.status === 'cancelled') canJoin = false;
    // Capacity gate: if max_participants > 0, check current student count
    const maxPart = Number(classroom.max_participants) || 0;
    if (canJoin && maxPart > 0 && Number(counts.student_count) >= maxPart) canJoin = false;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: classroom.id,
        title: classroom.title,
        description: classroom.description,
        teacher_name: classroom.teacher_name,
        status: classroom.status,
        role,
        classroom_type: classroom.classroom_type || 'instant',
        scheduled_at: classroom.scheduled_at,
        duration_minutes: classroom.duration_minutes,
        payment_enabled: classroom.payment_enabled,
        price_paise: classroom.price_paise,
        currency: classroom.currency,
        max_participants: classroom.max_participants,
        can_join: canJoin,
        opens_at: opensAt,
        participant_count: Number(counts.total),
        teacher_count: Number(counts.teacher_count),
        student_count: Number(counts.student_count),
        share_name: shareName,
        share_phone: sharePhone,
        share_email: shareEmail,
        // Return teacher details when role=teacher so client can auto-join
        teacher_portal_role: classroom.teacher_portal_role || null,
        ...(role === 'teacher' && {
          auth_name: classroom.teacher_name,
          auth_email: classroom.teacher_email,
        }),
        created_at: classroom.created_at,
        started_at: classroom.started_at,
      },
    });
  } catch (err) {
    console.error('[open-classroom/get]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Check host token first
    let result = await db.query(
      `SELECT * FROM open_classrooms WHERE host_token = $1 LIMIT 1`,
      [token]
    );

    // If not host token, check if logged-in AO/owner
    if (result.rows.length === 0) {
      const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
      if (!sessionToken) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Not found or not authorized' }, { status: 404 });
      }
      const user = await verifySession(sessionToken);
      if (!user || !['owner', 'academic_operator', 'academic'].includes(user.role)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Not authorized' }, { status: 403 });
      }
      // Try by join token for AO management
      result = await db.query(
        `SELECT * FROM open_classrooms WHERE join_token = $1 LIMIT 1`,
        [token]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }

    const classroom = result.rows[0];
    if (classroom.status === 'ended') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom already ended' }, { status: 410 });
    }

    // Destroy LiveKit room
    if (classroom.livekit_room_name) {
      // Record explicit-end marker so the LiveKit webhook recognizes this as a
      // genuine end (not an idle auto-close).
      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'room_end_requested', $2)`,
        [String(classroom.livekit_room_name), JSON.stringify({ via: 'open-classroom-end' })]
      ).catch(e => console.warn('[open-classroom/end] end-requested event insert warning:', e));
      try { await deleteRoom(String(classroom.livekit_room_name)); } catch { /* room may be gone */ }
    }

    await db.query(
      `UPDATE open_classrooms SET status = 'ended', ended_at = NOW() WHERE id = $1`,
      [classroom.id]
    );
    await db.query(
      `UPDATE open_classroom_participants SET left_at = NOW() WHERE classroom_id = $1 AND left_at IS NULL`,
      [classroom.id]
    );

    // Also end the rooms table entry so classroom UI detects end
    if (classroom.livekit_room_name) {
      await db.query(
        `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE room_id = $1`,
        [classroom.livekit_room_name]
      ).catch(e => console.warn('[open-classroom/end] rooms update warning:', e));
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Classroom ended' } });
  } catch (err) {
    console.error('[open-classroom/end]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Only host token or authenticated AO/owner can edit
    let result = await db.query(
      `SELECT * FROM open_classrooms WHERE host_token = $1 LIMIT 1`,
      [token]
    );

    if (result.rows.length === 0) {
      const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
      if (sessionToken) {
        const user = await verifySession(sessionToken);
        if (user && ['owner', 'academic_operator', 'academic'].includes(user.role)) {
          result = await db.query(`SELECT * FROM open_classrooms WHERE join_token = $1 LIMIT 1`, [token]);
        }
      }
    }

    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not found or not authorized' }, { status: 404 });
    }

    const classroom = result.rows[0];
    if (classroom.status === 'ended' || classroom.status === 'cancelled') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom is already ended or cancelled' }, { status: 410 });
    }

    const body = await request.json();
    const action = body.action as string;
    const notify = body.notify !== false;

    if (action === 'cancel') {
      if (classroom.livekit_room_name) {
        try { await deleteRoom(String(classroom.livekit_room_name)); } catch { /* */ }
      }
      await db.query(
        `UPDATE open_classrooms SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
        [classroom.id]
      );
      await db.query(
        `UPDATE open_classroom_participants SET left_at = NOW() WHERE classroom_id = $1 AND left_at IS NULL`,
        [classroom.id]
      );
      if (notify) await notifyRecipients(String(classroom.id), String(classroom.title), 'cancelled', null, null);
      return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Classroom cancelled', notified: notify } });
    }

    if (action === 'reschedule') {
      const newScheduledAt = body.scheduled_at ? new Date(body.scheduled_at as string) : null;
      const newDuration = body.duration_minutes ? Number(body.duration_minutes) : Number(classroom.duration_minutes);
      if (!newScheduledAt) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'scheduled_at is required' }, { status: 400 });
      }
      await db.query(
        `UPDATE open_classrooms SET scheduled_at = $1, duration_minutes = $2, classroom_type = 'scheduled' WHERE id = $3`,
        [newScheduledAt, newDuration, classroom.id]
      );
      if (notify) await notifyRecipients(String(classroom.id), String(classroom.title), 'rescheduled', newScheduledAt, newDuration);
      const updated = await db.query(`SELECT * FROM open_classrooms WHERE id = $1`, [classroom.id]);
      return NextResponse.json<ApiResponse>({ success: true, data: { ...updated.rows[0], notified: notify } });
    }

    if (action === 'edit') {
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (typeof body.title === 'string' && body.title.trim()) {
        sets.push(`title = $${idx}`); values.push(body.title.trim()); idx++;
      }
      if (typeof body.description === 'string') {
        sets.push(`description = $${idx}`); values.push(body.description.trim() || null); idx++;
      }
      if (body.scheduled_at !== undefined) {
        sets.push(`scheduled_at = $${idx}`); values.push(body.scheduled_at ? new Date(body.scheduled_at as string) : null); idx++;
        sets.push(`classroom_type = 'scheduled'`);
      }
      if (body.duration_minutes !== undefined) {
        sets.push(`duration_minutes = $${idx}`); values.push(Number(body.duration_minutes)); idx++;
      }
      if (body.payment_enabled !== undefined) {
        sets.push(`payment_enabled = $${idx}`); values.push(Boolean(body.payment_enabled)); idx++;
      }
      if (body.price_paise !== undefined) {
        sets.push(`price_paise = $${idx}`); values.push(Math.max(0, Math.round(Number(body.price_paise)))); idx++;
      }

      if (sets.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'No fields to update' }, { status: 400 });
      }

      values.push(classroom.id);
      await db.query(`UPDATE open_classrooms SET ${sets.join(', ')} WHERE id = $${idx}`, values);

      if (notify && body.scheduled_at !== undefined) {
        const c = (await db.query(`SELECT * FROM open_classrooms WHERE id = $1`, [classroom.id])).rows[0];
        await notifyRecipients(String(c.id), String(c.title), 'updated', c.scheduled_at ? new Date(String(c.scheduled_at)) : null, c.duration_minutes ? Number(c.duration_minutes) : null);
      }

      const updated = await db.query(`SELECT * FROM open_classrooms WHERE id = $1`, [classroom.id]);
      return NextResponse.json<ApiResponse>({ success: true, data: updated.rows[0] });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action. Use: edit, cancel, reschedule' }, { status: 400 });
  } catch (err) {
    console.error('[open-classroom/patch]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/* ── Notify shared recipients ── */
async function notifyRecipients(
  classroomId: string, title: string,
  changeType: 'cancelled' | 'rescheduled' | 'updated',
  scheduledAt: Date | null, durationMinutes: number | null,
) {
  try {
    const shares = await db.query(
      `SELECT DISTINCT ON (phone) name, phone, email FROM open_classroom_shares WHERE classroom_id = $1 ORDER BY phone, shared_at DESC`,
      [classroomId]
    );
    if (shares.rows.length === 0) return;

    let message = '';
    if (changeType === 'cancelled') {
      message = `The Open Classroom *${title}* has been *cancelled*.\n\nIf you had this scheduled, please disregard previous joining links.`;
    } else if (changeType === 'rescheduled' && scheduledAt) {
      const dateStr = scheduledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const timeStr = scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      message = `The Open Classroom *${title}* has been *rescheduled*.\n\n📅 New time: ${dateStr} at ${timeStr}${durationMinutes ? ` (${durationMinutes} min)` : ''}\n\nYour joining link remains the same.`;
    } else {
      message = `The Open Classroom *${title}* has been *updated*.\n\nPlease check the latest details. Your joining link remains the same.`;
    }

    for (const r of shares.rows) {
      const phone = String(r.phone).startsWith('+') ? String(r.phone) : `+${r.phone}`;
      try {
        await sendWhatsApp({ to: phone, template: 'general', templateData: { recipientName: String(r.name), message }, recipientEmail: r.email ? String(r.email) : undefined });
      } catch { /* best effort */ }
    }
  } catch (err) {
    console.error('[open-classroom/notify]', err);
  }
}
