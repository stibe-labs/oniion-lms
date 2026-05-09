import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { ensureRoom, createLiveKitToken, deleteRoom } from '@/lib/livekit';
import { sendWhatsApp } from '@/lib/whatsapp';

/**
 * GET  /api/v1/conference/[token] — Get conference info by admin/user token
 * DELETE /api/v1/conference/[token] — End conference (admin only)
 */

async function findConferenceByToken(token: string) {
  // Check admin token first, then user token
  let result = await db.query(
    `SELECT * FROM conferences WHERE admin_token = $1 LIMIT 1`,
    [token]
  );
  if (result.rows.length > 0) {
    return { conference: result.rows[0], role: 'admin' as const };
  }

  result = await db.query(
    `SELECT * FROM conferences WHERE user_token = $1 LIMIT 1`,
    [token]
  );
  if (result.rows.length > 0) {
    return { conference: result.rows[0], role: 'user' as const };
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const found = await findConferenceByToken(token);

    if (!found) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conference not found' }, { status: 404 });
    }

    const { conference, role } = found;

    // Look up share name if sid provided
    let shareName: string | null = null;
    const sid = _request.nextUrl.searchParams.get('sid');
    if (sid) {
      const shareRes = await db.query(
        `SELECT name FROM conference_shares WHERE id = $1 AND conference_id = $2 LIMIT 1`,
        [sid, conference.id]
      );
      if (shareRes.rows.length > 0) {
        shareName = String(shareRes.rows[0].name || '');
      }
    }

    // Get participant count
    const countRes = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE role = 'admin') AS admin_count,
              COUNT(*) FILTER (WHERE role = 'user') AS user_count
       FROM conference_participants
       WHERE conference_id = $1 AND left_at IS NULL`,
      [conference.id]
    );
    const counts = countRes.rows[0] || { total: 0, admin_count: 0, user_count: 0 };

    // Compute can_join for scheduled conferences
    let canJoin = true;
    let opensAt: string | null = null;
    if (conference.conference_type === 'scheduled' && conference.scheduled_at) {
      const scheduledTime = new Date(String(conference.scheduled_at)).getTime();
      const earlyLobby = scheduledTime - 5 * 60 * 1000; // 5 min before
      const now = Date.now();
      if (role === 'admin') {
        canJoin = true; // admins can always join
      } else {
        canJoin = now >= earlyLobby;
      }
      opensAt = new Date(earlyLobby).toISOString();
    }
    if (conference.status === 'ended') canJoin = false;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: conference.id,
        title: conference.title,
        status: conference.status,
        role,
        created_by: conference.created_by,
        created_at: conference.created_at,
        started_at: conference.started_at,
        scheduled_at: conference.scheduled_at,
        duration_minutes: conference.duration_minutes,
        conference_type: conference.conference_type || 'instant',
        can_join: canJoin,
        opens_at: opensAt,
        participant_count: Number(counts.total),
        admin_count: Number(counts.admin_count),
        user_count: Number(counts.user_count),
        share_name: shareName,
      },
    });
  } catch (err) {
    console.error('[conference/get]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Only admin token can end
    const result = await db.query(
      `SELECT * FROM conferences WHERE admin_token = $1 LIMIT 1`,
      [token]
    );
    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not found or not authorized' }, { status: 404 });
    }

    const conference = result.rows[0];

    if (conference.status === 'ended') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conference already ended' }, { status: 410 });
    }

    // Destroy LiveKit room
    if (conference.livekit_room_name) {
      try {
        await deleteRoom(String(conference.livekit_room_name));
      } catch {
        // Room might already be gone
      }
    }

    // Update status
    await db.query(
      `UPDATE conferences SET status = 'ended', ended_at = NOW() WHERE id = $1`,
      [conference.id]
    );

    // Mark all participants as left
    await db.query(
      `UPDATE conference_participants SET left_at = NOW() WHERE conference_id = $1 AND left_at IS NULL`,
      [conference.id]
    );

    return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Conference ended' } });
  } catch (err) {
    console.error('[conference/end]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/conference/[token] — Edit, cancel, or reschedule conference (admin token only)
 * Body: { action: 'edit' | 'cancel' | 'reschedule', title?, scheduled_at?, duration_minutes?, notify?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Only admin token can edit
    const result = await db.query(
      `SELECT * FROM conferences WHERE admin_token = $1 LIMIT 1`,
      [token]
    );
    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not found or not authorized' }, { status: 404 });
    }

    const conference = result.rows[0];

    if (conference.status === 'ended' || conference.status === 'cancelled') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conference is already ended or cancelled' }, { status: 410 });
    }

    const body = await request.json();
    const action = body.action as string;
    const notify = body.notify !== false; // default true

    if (action === 'cancel') {
      // Cancel the conference
      if (conference.livekit_room_name) {
        try { await deleteRoom(String(conference.livekit_room_name)); } catch { /* room might be gone */ }
      }

      await db.query(
        `UPDATE conferences SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
        [conference.id]
      );
      await db.query(
        `UPDATE conference_participants SET left_at = NOW() WHERE conference_id = $1 AND left_at IS NULL`,
        [conference.id]
      );

      // Notify shared recipients
      if (notify) {
        await notifyRecipients(String(conference.id), String(conference.title), 'cancelled', null, null);
      }

      return NextResponse.json<ApiResponse>({ success: true, data: { message: 'Conference cancelled', notified: notify } });
    }

    if (action === 'reschedule') {
      const newScheduledAt = body.scheduled_at ? new Date(body.scheduled_at as string) : null;
      const newDuration = body.duration_minutes ? Number(body.duration_minutes) : Number(conference.duration_minutes);

      if (!newScheduledAt) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'scheduled_at is required for reschedule' }, { status: 400 });
      }

      await db.query(
        `UPDATE conferences SET scheduled_at = $1, duration_minutes = $2, conference_type = 'scheduled' WHERE id = $3`,
        [newScheduledAt, newDuration, conference.id]
      );

      if (notify) {
        await notifyRecipients(String(conference.id), String(conference.title), 'rescheduled', newScheduledAt, newDuration);
      }

      const updated = await db.query(`SELECT * FROM conferences WHERE id = $1`, [conference.id]);
      return NextResponse.json<ApiResponse>({ success: true, data: { ...updated.rows[0], notified: notify } });
    }

    if (action === 'edit') {
      const newTitle = typeof body.title === 'string' ? body.title.trim() : null;
      const newScheduledAt = body.scheduled_at ? new Date(body.scheduled_at as string) : undefined;
      const newDuration = body.duration_minutes ? Number(body.duration_minutes) : undefined;

      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (newTitle) {
        sets.push(`title = $${idx}`); values.push(newTitle); idx++;
      }
      if (newScheduledAt !== undefined) {
        sets.push(`scheduled_at = $${idx}`); values.push(newScheduledAt); idx++;
        sets.push(`conference_type = 'scheduled'`);
      }
      if (newDuration !== undefined) {
        sets.push(`duration_minutes = $${idx}`); values.push(newDuration); idx++;
      }

      if (sets.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'No fields to update' }, { status: 400 });
      }

      values.push(conference.id);
      await db.query(`UPDATE conferences SET ${sets.join(', ')} WHERE id = $${idx}`, values);

      // Notify if schedule/title changed
      if (notify && (newScheduledAt !== undefined || newTitle)) {
        const updatedConf = await db.query(`SELECT * FROM conferences WHERE id = $1`, [conference.id]);
        const c = updatedConf.rows[0];
        await notifyRecipients(String(c.id), String(c.title), 'updated', c.scheduled_at ? new Date(String(c.scheduled_at)) : null, c.duration_minutes ? Number(c.duration_minutes) : null);
      }

      const updated = await db.query(`SELECT * FROM conferences WHERE id = $1`, [conference.id]);
      return NextResponse.json<ApiResponse>({ success: true, data: updated.rows[0] });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action. Use: edit, cancel, reschedule' }, { status: 400 });
  } catch (err) {
    console.error('[conference/patch]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/* ── Notify all shared recipients about conference changes ── */
async function notifyRecipients(
  conferenceId: string,
  title: string,
  changeType: 'cancelled' | 'rescheduled' | 'updated',
  scheduledAt: Date | null,
  durationMinutes: number | null,
) {
  try {
    const shares = await db.query(
      `SELECT DISTINCT ON (phone) name, phone, email FROM conference_shares WHERE conference_id = $1 ORDER BY phone, shared_at DESC`,
      [conferenceId]
    );
    if (shares.rows.length === 0) return;

    let message = '';
    if (changeType === 'cancelled') {
      message = `The conference *${title}* has been *cancelled*.\n\nIf you had this scheduled, please disregard previous joining links.`;
    } else if (changeType === 'rescheduled' && scheduledAt) {
      const dt = scheduledAt;
      const dateStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      message = `The conference *${title}* has been *rescheduled*.\n\n📅 New time: ${dateStr} at ${timeStr}${durationMinutes ? ` (${durationMinutes} min)` : ''}\n\nYour joining link remains the same.`;
    } else {
      message = `The conference *${title}* has been *updated*.\n\nPlease check the latest details. Your joining link remains the same.`;
    }

    for (const r of shares.rows) {
      const phone = String(r.phone).startsWith('+') ? String(r.phone) : `+${r.phone}`;
      try {
        await sendWhatsApp({
          to: phone,
          template: 'general',
          templateData: { recipientName: String(r.name), message },
          recipientEmail: r.email ? String(r.email) : undefined,
        });
      } catch {
        // best effort, don't fail the main operation
      }
    }
  } catch (err) {
    console.error('[conference/notify]', err);
  }
}
