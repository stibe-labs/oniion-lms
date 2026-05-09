import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PortalRole, PortalUser } from '@/types';
import { db } from '@/lib/db';
import { ensureRoom, createLiveKitToken } from '@/lib/livekit';
import { generatePayToken } from '@/lib/pay-token';
import { generateInvoiceNumber } from '@/lib/payment';
import { signSession, COOKIE_NAME } from '@/lib/session';
import { notifyCRM } from '@/lib/crm-webhook';

/** Lazy-update: sync OC room from linked batch_session if it has gone live. */
async function syncBatchSessionRoom(classroom: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (classroom.livekit_room_name || !classroom.batch_session_id) return classroom;
  try {
    const bs = await db.query(
      `SELECT livekit_room_name, status FROM batch_sessions WHERE session_id = $1 LIMIT 1`,
      [classroom.batch_session_id]
    );
    if (bs.rows.length === 0) return classroom;
    const { livekit_room_name, status } = bs.rows[0] as { livekit_room_name: string | null; status: string };
    if (status === 'live' && livekit_room_name) {
      await db.query(
        `UPDATE open_classrooms SET status = 'live', livekit_room_name = $1, room_id = $1 WHERE id = $2`,
        [livekit_room_name, classroom.id]
      );
      return { ...classroom, status: 'live', livekit_room_name, room_id: livekit_room_name };
    }
  } catch { /* ignore */ }
  return classroom;
}

/**
 * POST /api/v1/open-classroom/[token]/join — Join an open classroom
 * Body: { name: string, email?: string, phone?: string, sid?: string }
 *
 * For paid classrooms:
 *   - If participant hasn't paid → returns { requires_payment: true, payment_url }
 *   - If participant already paid → returns LiveKit token
 * For free classrooms:
 *   - Returns LiveKit token directly
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    let name = (body.name as string || '').trim();
    const email = (body.email as string || '').trim().toLowerCase() || null;
    const phone = (body.phone as string || '').trim() || null;
    const sid = (body.sid as string || '').trim();
    const device = (body.device as string || 'primary').trim(); // 'primary' or 'screen'

    // Lookup name from share record if empty
    if (!name && sid) {
      const shareRes = await db.query(
        `SELECT name FROM open_classroom_shares WHERE id = $1 LIMIT 1`,
        [sid]
      );
      if (shareRes.rows.length > 0) name = String(shareRes.rows[0].name || '').trim();
    }

    if (!name) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Determine role from token
    let classroom: Record<string, unknown> | null = null;
    let role: 'teacher' | 'student' = 'student';

    const hostRes = await db.query(
      `SELECT oc.*, pu.full_name AS teacher_name
       FROM open_classrooms oc
       LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
       WHERE oc.host_token = $1 LIMIT 1`,
      [token]
    );
    if (hostRes.rows.length > 0) {
      classroom = hostRes.rows[0] as Record<string, unknown>;
      role = 'teacher';
    } else {
      const joinRes = await db.query(
        `SELECT oc.*, pu.full_name AS teacher_name
         FROM open_classrooms oc
         LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
         WHERE oc.join_token = $1 LIMIT 1`,
        [token]
      );
      if (joinRes.rows.length > 0) {
        classroom = joinRes.rows[0] as Record<string, unknown>;
        role = 'student';
      }
    }

    if (!classroom) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }

    // Lazy-sync: if OC was pre-created for a scheduled batch_session, update room when session goes live
    classroom = await syncBatchSessionRoom(classroom);

    if (classroom.status === 'ended') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'This classroom has ended' }, { status: 410 });
    }
    if (classroom.status === 'cancelled') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'This classroom has been cancelled' }, { status: 410 });
    }

    // ── If OC is not live yet and role is student, return waiting state ──
    if (role === 'student' && classroom.status === 'created') {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          waiting: true,
          title: classroom.title,
          teacher_name: classroom.teacher_name || null,
          status: 'created',
        },
      });
    }

    // Time gate for scheduled classrooms (students only)
    if (role === 'student' && classroom.classroom_type === 'scheduled' && classroom.scheduled_at) {
      const scheduledTime = new Date(String(classroom.scheduled_at)).getTime();
      const earlyLobby = scheduledTime - 5 * 60 * 1000;
      if (Date.now() < earlyLobby) {
        const minsLeft = Math.ceil((earlyLobby - Date.now()) / 60000);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `Classroom opens in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}. Lobby opens 5 minutes before the scheduled time.`,
        }, { status: 425 });
      }
    }

    // ── Join Approval Gate (students only, if auto_approve_joins is off) ──
    if (role === 'student' && classroom.auto_approve_joins === false) {
      // Check if already approved
      const approvalCheck = await db.query(
        `SELECT id, approval_status FROM open_classroom_participants
         WHERE classroom_id = $1 AND name = $2 AND approval_status IN ('approved', 'auto_approved')
         LIMIT 1`,
        [classroom.id, name]
      );
      if (approvalCheck.rows.length === 0) {
        // Create or update pending record
        await db.query(
          `INSERT INTO open_classroom_participants (classroom_id, name, email, phone, role, payment_status, approval_status)
           VALUES ($1, $2, $3, $4, 'student', 'exempt', 'pending')
           ON CONFLICT DO NOTHING`,
          [classroom.id, name, email, phone]
        );
        // Also update if already exists with different status
        await db.query(
          `UPDATE open_classroom_participants SET approval_status = 'pending'
           WHERE classroom_id = $1 AND name = $2 AND approval_status NOT IN ('approved', 'auto_approved', 'pending')`,
          [classroom.id, name]
        );
        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            waiting_approval: true,
            title: classroom.title,
            teacher_name: classroom.teacher_name || null,
            name,
          },
        });
      }
    }

    // ── Payment Gate (students only, if payment enabled) ──
    if (role === 'student' && classroom.payment_enabled) {
      if (!email) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Email is required for paid classrooms' }, { status: 400 });
      }

      // Check if this participant already paid
      const existingPart = await db.query(
        `SELECT id, payment_status, invoice_id FROM open_classroom_participants
         WHERE classroom_id = $1 AND email = $2 AND payment_status = 'paid'
         LIMIT 1`,
        [classroom.id, email]
      );

      if (existingPart.rows.length === 0) {
        // Not paid yet — create invoice + participant record
        const pricePaise = Number(classroom.price_paise) || 0;
        const currency = String(classroom.currency || 'INR');

        // Check if there's already a pending participant/invoice
        const pendingPart = await db.query(
          `SELECT p.id, p.invoice_id, i.id AS inv_id
           FROM open_classroom_participants p
           LEFT JOIN invoices i ON i.id = p.invoice_id AND i.status = 'pending'
           WHERE p.classroom_id = $1 AND p.email = $2 AND p.payment_status = 'pending'
           LIMIT 1`,
          [classroom.id, email]
        );

        let invoiceId: string;
        if (pendingPart.rows.length > 0 && pendingPart.rows[0].inv_id) {
          // Reuse existing pending invoice
          invoiceId = String(pendingPart.rows[0].inv_id);
        } else {
          // Create new invoice
          const invoiceNumber = await generateInvoiceNumber();
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setDate(periodEnd.getDate() + 1);

          const invResult = await db.query(
            `INSERT INTO invoices
               (invoice_number, student_email, description, billing_period,
                period_start, period_end, amount_paise, currency, status, due_date)
             VALUES ($1, $2, $3, 'one_time', $4, $5, $6, $7, 'pending', NOW() + INTERVAL '7 days')
             RETURNING id`,
            [invoiceNumber, email, `Open Classroom: ${classroom.title}`,
             now.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0],
             pricePaise, currency]
          );
          invoiceId = String(invResult.rows[0].id);

          // Create participant record with pending payment
          await db.query(
            `INSERT INTO open_classroom_participants (classroom_id, name, email, phone, role, payment_status, invoice_id)
             VALUES ($1, $2, $3, $4, 'student', 'pending', $5)
             ON CONFLICT DO NOTHING`,
            [classroom.id, name, email, phone, invoiceId]
          );
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';
        const payToken = generatePayToken(invoiceId);

        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            requires_payment: true,
            invoice_id: invoiceId,
            amount_paise: pricePaise,
            currency,
            payment_url: `${baseUrl}/pay/${invoiceId}?t=${payToken}&returnUrl=${encodeURIComponent(`/open-classroom/${token}?paid=1&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`)}`,
          },
        });
      }

      // Already paid — fall through to generate LiveKit token
    }

    // ── Create/join LiveKit room ──
    const roomName = classroom.livekit_room_name
      ? String(classroom.livekit_room_name)
      : `oc_${String(classroom.id).replace(/-/g, '').slice(0, 16)}`;

    try {
      await ensureRoom(roomName, JSON.stringify({
        open_classroom_id: classroom.id,
        title: classroom.title,
        teacher_email: classroom.teacher_email,
      }));
    } catch (lkErr) {
      const msg = lkErr instanceof Error ? lkErr.message : String(lkErr);
      const isUnreachable = msg.includes('EHOSTUNREACH') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed');
      console.error('[open-classroom/join] LiveKit ensureRoom failed:', msg);
      return NextResponse.json<ApiResponse>(
        { success: false, error: isUnreachable ? 'Media server is temporarily unavailable. Please try again in a few minutes.' : 'Failed to create classroom room. Please try again.' },
        { status: 503 }
      );
    }

    // Update classroom with room name if first join (but DON'T go live — teacher must click Go Live)
    if (!classroom.livekit_room_name) {
      await db.query(
        `UPDATE open_classrooms SET livekit_room_name = $1, room_id = $1 WHERE id = $2`,
        [roomName, classroom.id]
      );
    }

    // ── Ensure rooms table row exists (so all /api/v1/room/* APIs work) ──
    try {
      const scheduledStart = classroom.scheduled_at || classroom.started_at || new Date().toISOString();
      // duration_minutes = 0 means "unlimited" — rooms table has CHECK duration_minutes > 0,
      // so use 9999 as a sentinel for unlimited-duration open classrooms.
      const rawDuration = classroom.duration_minutes != null ? Number(classroom.duration_minutes) : 60;
      const durationMins = rawDuration > 0 ? rawDuration : 9999;
      const roomStatus = classroom.status === 'live' ? 'live' : 'scheduled';
      await db.query(
        `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, section, batch_type, status,
                            scheduled_start, duration_minutes, created_by, created_at, updated_at${roomStatus === 'live' ? ', go_live_at' : ''})
         VALUES ($1, $2, $3, $4, $5, NULL, 'one_to_many', $6, $7, $8, 'open_classroom', NOW(), NOW()${roomStatus === 'live' ? ', NOW()' : ''})
         ON CONFLICT (room_id) DO UPDATE SET updated_at = NOW()`,
        [roomName, String(classroom.title), classroom.teacher_email || null,
         classroom.subject || 'Open Classroom', classroom.grade || null,
         roomStatus, scheduledStart, durationMins]
      );
    } catch (err) {
      console.warn('[open-classroom/join] rooms upsert warning:', err);
    }

    // Record participant (or update existing)
    let participantId: string;
    if (email) {
      const upsert = await db.query(
        `INSERT INTO open_classroom_participants (classroom_id, name, email, phone, role, payment_status, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [classroom.id, name, email, phone, role, role === 'teacher' ? 'exempt' : (classroom.payment_enabled ? 'paid' : 'exempt')]
      );
      if (upsert.rows.length > 0) {
        participantId = String(upsert.rows[0].id);
      } else {
        // Already exists — update joined_at
        const existing = await db.query(
          `UPDATE open_classroom_participants SET joined_at = NOW(), left_at = NULL, name = $1
           WHERE classroom_id = $2 AND email = $3 RETURNING id`,
          [name, classroom.id, email]
        );
        participantId = String(existing.rows[0]?.id || crypto.randomUUID());
      }
    } else {
      const ins = await db.query(
        `INSERT INTO open_classroom_participants (classroom_id, name, email, phone, role, payment_status, joined_at)
         VALUES ($1, $2, $3, $4, $5, 'exempt', NOW())
         RETURNING id`,
        [classroom.id, name, email, phone, role]
      );
      participantId = String(ins.rows[0].id);
    }

    // Generate LiveKit token with REAL classroom roles
    const isScreenDevice = device === 'screen' && role === 'teacher';
    const identity = isScreenDevice ? `${role}_${participantId}_screen` : `${role}_${participantId}`;
    const portalRole: PortalRole = role; // 'teacher' or 'student' — matches real classroom grants
    const effectiveRole: string = isScreenDevice ? 'teacher_screen' : role;

    const metadata = JSON.stringify({
      open_classroom_id: classroom.id,
      portal_role: portalRole,
      portal_user_id: email || participantId,
      effective_role: effectiveRole,
      participant_id: participantId,
      room_name: roomName,
      device: isScreenDevice ? 'screen' : 'primary',
      is_guest: classroom.classroom_type === 'guest_session',
    });

    // ── Create room_assignments entry (so attendance/enhanced-attendance works) ──
    try {
      await db.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status, created_at)
         VALUES ($1, $2, $3, $4, 'exempt', NOW())
         ON CONFLICT DO NOTHING`,
        [roomName, role, email || participantId, name]
      );
    } catch (err) {
      console.warn('[open-classroom/join] room_assignments insert warning:', err);
    }

    const livekitToken = await createLiveKitToken({
      roomName,
      participantIdentity: identity,
      participantName: isScreenDevice ? `${name} (Screen)` : name,
      role: (isScreenDevice ? 'teacher_screen' : portalRole) as PortalRole,
      metadata,
      ttl: '8h',
    }).catch((lkErr: unknown) => {
      const msg = lkErr instanceof Error ? lkErr.message : String(lkErr);
      console.error('[open-classroom/join] createLiveKitToken failed:', msg);
      return null;
    });

    if (!livekitToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Media server is temporarily unavailable. Please try again in a few minutes.' },
        { status: 503 }
      );
    }

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

    const response = NextResponse.json<ApiResponse>({
      success: true,
      data: {
        requires_payment: false,
        livekit_token: livekitToken,
        livekit_url: livekitUrl,
        room_id: roomName,
        room_name: String(classroom.title),
        role,
        participant_name: name,
        participant_identity: identity,
        // 0 = unlimited — return 9999 so the classroom header shows a long countdown instead of immediate overtime
        duration_minutes: (Number(classroom.duration_minutes) || 0) > 0 ? Number(classroom.duration_minutes) : 9999,
        scheduled_start: classroom.scheduled_at || classroom.started_at || new Date().toISOString(),
        room_status: classroom.status === 'live' ? 'live' : 'scheduled',
      },
    });

    // ── Set portal session cookie so all in-classroom APIs (/room/*, /monitoring-tuning, etc.) work ──
    // Teachers get a long-lived cookie; students get an 8h cookie matching the LiveKit token TTL.
    const cookieUserId = role === 'teacher' && classroom.teacher_email
      ? String(classroom.teacher_email)
      : email || `oc_${participantId}`;
    const cookieRole: PortalRole = role === 'teacher' ? 'teacher' : 'student';
    const cookieName = role === 'teacher'
      ? String(classroom.teacher_name || name)
      : name;
    const cookieMaxAge = role === 'teacher' ? 31536000 : 60 * 60 * 8; // 1 year for teacher, 8h for student

    try {
      const ocUser: PortalUser = { id: cookieUserId, name: cookieName, role: cookieRole, is_guest: role === 'student' };
      const sessionToken = await signSession(ocUser);
      response.cookies.set(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: cookieMaxAge,
        path: '/',
      });
    } catch (cookieErr) {
      console.warn('[open-classroom/join] session cookie warning:', cookieErr);
    }

    // ── Fire CRM webhook if this is a CRM-linked guest session (fire-and-forget, once) ──
    if (
      role === 'student' &&
      classroom.classroom_type === 'guest_session' &&
      classroom.crm_lead_id &&
      classroom.crm_tenant_id &&
      !classroom.crm_guest_joined_at
    ) {
      // Mark joined so we don't fire duplicate webhooks on reconnects
      db.query(
        `UPDATE open_classrooms SET crm_guest_joined_at = NOW() WHERE id = $1 AND crm_guest_joined_at IS NULL`,
        [classroom.id]
      ).catch(e => console.error('[open-classroom/join] crm_guest_joined_at update failed:', e));

      notifyCRM({
        event: 'oc_guest_joined',
        crm_lead_id: String(classroom.crm_lead_id),
        crm_tenant_id: String(classroom.crm_tenant_id),
        participant_name: name,
        session_subject: classroom.subject || null,
        open_classroom_id: classroom.id,
      }).catch(e => console.error('[open-classroom/join] CRM webhook fire failed:', e));
    }

    return response;
  } catch (err) {
    console.error('[open-classroom/join]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
