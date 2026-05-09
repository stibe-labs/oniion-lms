import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';
import { getPlatformName } from '@/lib/platform-config';

const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * POST /api/v1/external/guest-link
 *
 * External API (called by Stibe CRM) — generates a guest join link for a live
 * batch session, linked to a CRM lead so that when the guest joins the classroom,
 * stibe automatically fires an `oc_guest_joined` webhook back to the CRM.
 *
 * Auth: X-API-Key header.
 *
 * Body:
 *   session_id    — stibe batch session ID (from live-sessions endpoint)
 *   crm_lead_id   — CRM lead UUID
 *   crm_tenant_id — CRM tenant ID
 *   lead_name     — Display name for the guest (used in classroom)
 *   lead_phone    — Phone number of the lead (stored for reference)
 *
 * Returns:
 *   join_link     — Full URL the lead should open to join
 *   join_token    — Short token (also part of the URL)
 *   room_name     — LiveKit room name
 *   session_id    — Echo of the requested session_id
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json() as {
      session_id?: string;
      crm_lead_id?: string;
      crm_tenant_id?: string;
      lead_name?: string;
      lead_phone?: string;
    };

    const { session_id, crm_lead_id, crm_tenant_id, lead_name, lead_phone } = body;

    if (!session_id || !crm_lead_id || !crm_tenant_id || !lead_name) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: session_id, crm_lead_id, crm_tenant_id, lead_name',
      }, { status: 400 });
    }

    // Fetch the batch session and verify it is live
    const sessionRes = await db.query(
      `SELECT bs.session_id, bs.subject, bs.teacher_email, bs.livekit_room_name,
              bs.scheduled_date, bs.start_time, bs.duration_minutes, bs.status,
              b.grade, b.batch_name, b.batch_id,
              pu.full_name AS teacher_name,
              rm.status AS room_status
       FROM batch_sessions bs
       LEFT JOIN batches b ON b.batch_id = bs.batch_id
       LEFT JOIN portal_users pu ON pu.email = bs.teacher_email
       LEFT JOIN rooms rm ON rm.room_id = bs.livekit_room_name
       WHERE bs.session_id = $1`,
      [session_id]
    );

    if (sessionRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const session = sessionRes.rows[0] as Record<string, unknown>;

    const isLive = session.status === 'live' || session.room_status === 'live';
    const isScheduled = session.status === 'scheduled';

    if (!isLive && !isScheduled) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Session is not live or scheduled',
      }, { status: 400 });
    }

    // For live sessions the room must exist; for scheduled it may not yet
    const roomName = isLive ? String(session.livekit_room_name) : null;
    if (isLive && !roomName) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session room not ready' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';

    // Check if a CRM-linked guest open-classroom already exists for this lead + session
    // For live sessions: match by room name. For scheduled: match by batch_session_id.
    const existing = roomName
      ? await db.query(
          `SELECT id, join_token FROM open_classrooms
           WHERE livekit_room_name = $1
             AND classroom_type = 'guest_session'
             AND crm_lead_id = $2
           LIMIT 1`,
          [roomName, crm_lead_id]
        )
      : await db.query(
          `SELECT id, join_token FROM open_classrooms
           WHERE batch_session_id = $1
             AND classroom_type = 'guest_session'
             AND crm_lead_id = $2
           LIMIT 1`,
          [session_id, crm_lead_id]
        );

    let joinToken: string;
    let ocId: string;

    if (existing.rows.length > 0) {
      // Reuse the CRM-linked guest classroom for this lead
      joinToken = String(existing.rows[0].join_token);
      ocId = String(existing.rows[0].id);
      // Update CRM context + status based on current live state
      await db.query(
        `UPDATE open_classrooms
         SET status         = $2,
             livekit_room_name = COALESCE($3, livekit_room_name),
             room_id           = COALESCE($3, room_id),
             crm_lead_id    = $4,
             crm_tenant_id  = $5,
             crm_lead_name  = $6,
             crm_lead_phone = $7
         WHERE id = $1`,
        [ocId, isLive ? 'live' : 'created', roomName, crm_lead_id, crm_tenant_id, lead_name, lead_phone || null]
      );
    } else {
      // Create a new CRM-linked guest open-classroom
      const hostToken = crypto.randomBytes(6).toString('hex');
      joinToken = crypto.randomBytes(6).toString('hex');

      const title = `${String(session.subject)} — ${String(session.batch_name || session.batch_id)} (Guest)`;
      const scheduledStart = `${String(session.scheduled_date)}T${String(session.start_time)}+05:30`;
      // Live sessions start immediately; scheduled ones are 'created' (waiting for live)
      const ocStatus = isLive ? 'live' : 'created';

      const insertRes = await db.query(
        `INSERT INTO open_classrooms
           (title, description, created_by, teacher_email, host_token, join_token,
            classroom_type, scheduled_at, duration_minutes, status,
            payment_enabled, price_paise, currency, max_participants, subject, grade,
            auto_approve_joins, livekit_room_name, room_id,
            crm_lead_id, crm_tenant_id, crm_lead_name, crm_lead_phone,
            batch_session_id)
         VALUES ($1, $2, 'crm-external', $3, $4, $5, 'guest_session', $6, $7, $8,
                 false, 0, 'INR', 1, $9, $10,
                 true, $11, $11,
                 $12, $13, $14, $15,
                 $16)
         RETURNING id`,
        [
          title,
          `CRM guest access for ${isLive ? 'live' : 'scheduled'} batch session: ${String(session.subject)} — Lead: ${lead_name}`,
          session.teacher_email || null,
          hostToken,
          joinToken,
          scheduledStart,
          Number(session.duration_minutes) || 60,
          ocStatus,
          session.subject || null,
          session.grade || null,
          roomName,              // null for scheduled sessions
          crm_lead_id,
          crm_tenant_id,
          lead_name,
          lead_phone || null,
          session_id,            // batch_session_id — enables lazy-update when session goes live
        ]
      );
      ocId = String(insertRes.rows[0].id);
    }

    const joinLink = `${baseUrl}/open-classroom/${joinToken}`;

    // Send WhatsApp to the lead with the guest join link (same pattern as demo link)
    const teacherName = String(session.teacher_name || 'your teacher');
    const subjectLabel = String(session.subject || 'class');
    const platformName = await getPlatformName();
    const waMessage = isLive
      ? `🎓 *${platformName} Classes — Live Class Link*\n\nHi ${lead_name}! Your teacher is live right now!\n\nJoin the *${subjectLabel}* class here:\n${joinLink}\n\nTap the link to enter as a guest. The session is already in progress!\n\n— ${platformName} Classes`
      : `🎓 *${platformName} Classes — Upcoming Class Link*\n\nHi ${lead_name}! Your *${subjectLabel}* class with ${teacherName} is starting soon.\n\nYour personal join link:\n${joinLink}\n\nOpen the link before class time — you'll be let in automatically when the session starts.\n\n— ${platformName} Classes`;

    // Fire-and-forget — don't let WA failure block the response
    if (lead_phone) {
      fireWhatsApp(
        `wa_crm_guest_${joinToken}`,
        waMessage,
        undefined,
        'stibe_alert',
        [lead_name, isLive ? `Join your live ${subjectLabel} class: ${joinLink}` : `Your ${subjectLabel} class link: ${joinLink}`],
        lead_phone,
      ).catch(e => console.warn('[external/guest-link] WA send failed:', e));
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        join_link: joinLink,
        join_token: joinToken,
        room_name: roomName,
        session_id,
        open_classroom_id: ocId,
      },
    });
  } catch (err) {
    console.error('[external/guest-link]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
