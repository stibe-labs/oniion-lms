import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PortalUser, PortalRole } from '@/types';
import { verifySession, signSession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { createLiveKitToken, ensureRoom, ghostIdentity, listParticipants } from '@/lib/livekit';
import { isGhostRole } from '@/lib/utils';
import { calculateSessionFee, checkSessionPayment, checkBatchSessionPayment } from '@/lib/payment';

async function isFreeRejoinEnabled(): Promise<boolean> {
  try {
    const { rows } = await db.query(
      `SELECT setting_values FROM academic_settings WHERE setting_key = 'teacher_controls'`,
    );
    const row = rows[0] as { setting_values?: string[] } | undefined;
    if (row?.setting_values?.[0]) {
      const parsed = JSON.parse(row.setting_values[0]) as Record<string, boolean>;
      return parsed.free_rejoin === true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * POST /api/v1/room/join
 * Called by browser to get a LiveKit access token for a room.
 *
 * Auth (one of):
 *   1. Session cookie — normal logged-in user
 *   2. email_token in body — email invite link (no login needed)
 *
 * Body: { room_id, role?, device?, email_token? }
 *   device: 'primary' (default) | 'screen' (tablet screen-share device)
 *   email_token: LiveKit JWT from email link — used when user is NOT logged in
 *
 * Returns: { livekit_token, livekit_url, room_id, role, participant_name, device }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Parse body ───────────────────────────────────────────
    const body = await request.json();
    const { room_id, role: roleOverride, device: deviceParam, email_token } = body as {
      room_id?: string;
      role?: PortalRole;
      device?: 'primary' | 'screen';
      email_token?: string;
    };

    if (!room_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required field: room_id' },
        { status: 400 }
      );
    }

    // ── Auth: session cookie OR email_token ───────────────────
    let user: PortalUser | null = null;
    let needsSessionCookie = false; // true if user authed via email_token (no session cookie)

    // Try session cookie first
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (sessionToken) {
      user = await verifySession(sessionToken);
    }

    // Fallback: email_token — verify against room_assignments DB
    if (!user && email_token) {
      const assignResult = await db.query(
        `SELECT participant_email, participant_name, participant_type
         FROM room_assignments
         WHERE room_id = $1 AND join_token = $2
         LIMIT 1`,
        [room_id, email_token]
      );
      if (assignResult.rows.length > 0) {
        const row = assignResult.rows[0] as Record<string, string>;
        user = {
          id: row.participant_email,
          name: row.participant_name,
          role: row.participant_type as PortalRole,
        };
        needsSessionCookie = true;
      } else {
        // Fallback: session_join_tokens (token generated at schedule time, room may use different ID)
        const sjtResult = await db.query(
          `SELECT participant_email, participant_name, participant_type
           FROM session_join_tokens
           WHERE join_token = $1
           LIMIT 1`,
          [email_token]
        );
        if (sjtResult.rows.length > 0) {
          const row = sjtResult.rows[0] as Record<string, string>;
          user = {
            id: row.participant_email,
            name: row.participant_name,
            role: row.participant_type as PortalRole,
          };
          needsSessionCookie = true;
        }
      }
    }

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Device defaults to 'primary'; only teachers can use 'screen'
    const device = (deviceParam === 'screen' && (user.role === 'teacher' || user.role === 'teacher_screen')) ? 'screen' : 'primary';

    // ── teacher_screen: join via open-classroom host token ───────────
    // The Flutter app passes the open-classroom UUID as room_id.
    // We look it up in open_classrooms, ensure the LiveKit room exists,
    // and return a teacher-role token so the screen-share works.
    if (user.role === 'teacher_screen') {
      const ocRes = await db.query(
        `SELECT oc.*, COALESCE(pu.full_name, oc.teacher_name_manual) AS resolved_teacher_name
         FROM open_classrooms oc
         LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
         WHERE oc.id::text = $1 OR oc.teacher_email = $2
         ORDER BY oc.created_at DESC LIMIT 1`,
        [room_id, user.id]
      );

      if (ocRes.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Open classroom not found' }, { status: 404 });
      }

      const oc = ocRes.rows[0] as Record<string, unknown>;

      if (oc.status === 'ended' || oc.status === 'cancelled') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'This classroom has ended' }, { status: 410 });
      }

      // Ensure LiveKit room exists (creates it if needed)
      const ocRoomId = String(oc.livekit_room_name || oc.room_id || `oc_${oc.id}`);
      await ensureRoom(ocRoomId, JSON.stringify({ room_name: oc.title, portal_room_id: oc.id }));

      // If classroom wasn't live yet, mark it live now
      if (oc.status !== 'live') {
        await db.query(
          `UPDATE open_classrooms SET status = 'live', livekit_room_name = $1, room_id = $1 WHERE id = $2`,
          [ocRoomId, oc.id]
        );
      }

      const teacherName = String(oc.resolved_teacher_name || user.name || 'Teacher');
      const participantIdentity = `teacher_screen_${user.id}`;
      const metadata = JSON.stringify({
        portal_user_id: user.id,
        portal_role: 'teacher_screen',
        effective_role: 'teacher_screen',
        room_name: oc.title,
        device: 'screen',
      });

      const livekit_token = await createLiveKitToken({
        roomName: ocRoomId,
        participantIdentity,
        participantName: `${teacherName} (Screen)`,
        role: 'teacher_screen',
        metadata,
        batchType: undefined,
      });

      const livekit_url = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          livekit_token,
          livekit_url,
          room_id: ocRoomId,
          room_name: String(oc.title || ''),
          role: 'teacher_screen',
          participant_name: `${teacherName} (Screen)`,
          device: 'screen',
          room_status: String(oc.status || 'live'),
        },
      });
    }

    // ── Verify room exists in DB ─────────────────────────────
    // Support both livekit_room_name (room_id) and batch session_id as room identifier
    const roomResult = await db.query(
      `SELECT r.room_id, r.status, r.room_name, r.scheduled_start, r.duration_minutes,
              r.open_at, r.expires_at, r.batch_session_id, r.batch_type,
              bs.topic AS session_topic
       FROM rooms r
       LEFT JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
       WHERE r.room_id = $1 OR r.batch_session_id = $1 LIMIT 1`,
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];
    const actualRoomId = String(room.room_id);

    // Prevent joining cancelled rooms
    if (room.status === 'cancelled') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This room has been cancelled' },
        { status: 410 }
      );
    }

    // Prevent joining ended rooms
    if (room.status === 'ended') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This class has already ended' },
        { status: 410 }
      );
    }

    // ── Fee payment gating (students only) ───────────────────
    // Gate rules by batch type:
    //   one_to_one / one_to_three  → credit-based gate (pay per class)
    //   all other batch types       → no payment gate (enrolled = already paid)
    //   any batch type (quarterly)  → if quarterly_due_date is in the past, block
    //
    // Demo rooms and teachers always bypass all gates.
    const isDemoRoom = actualRoomId.startsWith('demo_');
    const batchType = String(room.batch_type || '');
    const isPerClassBatch = batchType === 'one_to_one' || batchType === 'one_to_three';

    if (user.role === 'student' && !isDemoRoom) {
      // ── Quarterly payment due date gate (all batch types) ──
      try {
        const qRes = await db.query<{ quarterly_due_date: string | null; skip_payment_gate: boolean }>(
          `SELECT bs.quarterly_due_date, bs.skip_payment_gate
           FROM batch_students bs
           JOIN batches b ON b.batch_id = bs.batch_id
           LEFT JOIN rooms r ON r.batch_id = b.batch_id
           LEFT JOIN batch_sessions ses ON ses.batch_id = b.batch_id
           WHERE bs.student_email = $1
             AND (r.room_id = $2 OR ses.session_id = $3
                  OR b.batch_id IN (
                    SELECT batch_id FROM rooms WHERE room_id = $2
                    UNION
                    SELECT batch_id FROM batch_sessions WHERE session_id = $3
                  ))
           ORDER BY bs.skip_payment_gate DESC
           LIMIT 1`,
          [user.id, actualRoomId, String(room.batch_session_id ?? '')]
        );
        if (qRes.rows.length > 0) {
          const row = qRes.rows[0];
          // skip_payment_gate = true → bypass all checks for this student
          if (row.skip_payment_gate === true) {
            // fall through to room join
          } else if (row.quarterly_due_date) {
            const dueDate = new Date(row.quarterly_due_date);
            dueDate.setHours(23, 59, 59, 999); // end of due day
            if (dueDate < new Date()) {
              return NextResponse.json<ApiResponse>(
                {
                  success: false,
                  error: 'QUARTERLY_PAYMENT_DUE',
                  message: `Your quarterly payment was due on ${new Date(row.quarterly_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Please contact the coordinator to process your payment and regain access.`,
                },
                { status: 402 }
              );
            }
          }
        }
      } catch {
        // batch_students columns may not exist yet — skip
      }

      // ── Per-class batch: credit + payment checks (1:1 and 1:3 only) ──
      if (isPerClassBatch) {
        // room_assignment payment_status check
        try {
          const payResult = await db.query(
            `SELECT payment_status FROM room_assignments
             WHERE room_id = $1 AND participant_email = $2
             LIMIT 1`,
            [actualRoomId, user.id]
          );
          if (payResult.rows.length > 0) {
            const paymentStatus = String(payResult.rows[0].payment_status || 'not_required');
            if (paymentStatus === 'overdue') {
              return NextResponse.json<ApiResponse>(
                { success: false, error: 'FEE_OVERDUE', message: 'Your fee payment is overdue. Please contact the coordinator to resolve outstanding fees before joining.' },
                { status: 402 }
              );
            }
            if (paymentStatus === 'pending') {
              return NextResponse.json<ApiResponse>(
                { success: false, error: 'FEE_PENDING', message: 'Fee payment is pending confirmation. Please complete payment or wait for verification.' },
                { status: 402 }
              );
            }
          }
        } catch {
          // payment_status column may not exist yet — skip
        }

        // ── Session credit consumption (prepaid credit plan) ──
        // If student has available credits, consume one and skip per-session invoice checks.
        let creditConsumed = false;
        try {
          const bsId = room.batch_session_id as string | null;
          // Idempotency: if already consumed for this batch session, count it as consumed
          if (bsId) {
            const ledgerRes = await db.query(
              `SELECT id FROM session_credit_ledger
               WHERE student_email = $1 AND $2 = ANY(batch_session_ids)
               LIMIT 1`,
              [user.id, bsId]
            );
            if (ledgerRes.rows.length > 0) creditConsumed = true;
          }
          if (!creditConsumed) {
            // Find oldest active credit row with remaining > 0 (gate check only — do NOT consume here)
            const creditRow = await db.query<{ id: string }>(
              `SELECT id FROM student_session_credits
               WHERE student_email = $1 AND is_active = true
                 AND (total_sessions - used_sessions) > 0
               ORDER BY created_at ASC LIMIT 1`,
              [user.id]
            );
            if (creditRow.rows.length > 0) {
              const creditId = creditRow.rows[0].id;
              // NOTE: used_sessions is NOT incremented here.
              // It is incremented only when the session ends (via deductSessionCreditsOnEnd).
              if (bsId) {
                await db.query(
                  `INSERT INTO session_credit_ledger
                     (credit_id, student_email, subject, sessions_consumed, batch_session_ids, note)
                   VALUES ($1, $2, 'general', 1, ARRAY[$3::text], 'Joined class (credit to be deducted on session end)')
                   ON CONFLICT DO NOTHING`,
                  [creditId, user.id, bsId]
                );
              }
              creditConsumed = true;
            }
          }
        } catch {
          // credits table may not exist — skip
        }

        // Per-session fee enforcement (only when no prepaid credit was consumed)
        if (!creditConsumed) {
          const batchSessionId = room.batch_session_id as string | null;
          let isPaid = false;

          if (batchSessionId) {
            const batchPaid = await checkBatchSessionPayment(batchSessionId, user.id);
            isPaid = batchPaid.paid;
            if (batchPaid.invoiceId && !isPaid) {
              return NextResponse.json<ApiResponse>(
                { success: false, error: 'PAYMENT_REQUIRED', message: 'Please complete the session fee payment before joining. Use the payment option on the join page.' },
                { status: 402 }
              );
            }
          }

          if (!isPaid) {
            const fee = await calculateSessionFee(actualRoomId);
            if (fee && fee.amountPaise > 0) {
              const paid = await checkSessionPayment(actualRoomId, user.id);
              if (!paid.paid) {
                return NextResponse.json<ApiResponse>(
                  { success: false, error: 'PAYMENT_REQUIRED', message: 'Please complete the session fee payment before joining. Use the payment option on the join page.' },
                  { status: 402 }
                );
              }
            }
          }
        }

        // Extension fee gate (per-class batches only)
        try {
          const extDueRes = await db.query(
            `SELECT i.id, i.invoice_number, i.amount_paise, i.currency
             FROM session_extension_requests ser
             JOIN invoices i ON i.id = ser.invoice_id
             WHERE ser.student_email = $1
               AND ser.status = 'approved'
               AND i.status = 'overdue'
             LIMIT 1`,
            [user.id]
          );
          if (extDueRes.rows.length > 0) {
            const due = extDueRes.rows[0] as { invoice_number: string; amount_paise: number; currency: string };
            const amount = `₹${(due.amount_paise / 100).toFixed(0)}`;
            return NextResponse.json<ApiResponse>(
              { success: false, error: 'EXTENSION_FEE_DUE', message: `You have an unpaid extra time fee of ${amount} (Invoice: ${due.invoice_number}). Please clear this due before joining your next session.` },
              { status: 402 }
            );
          }
        } catch {
          // extension tables may not exist — skip
        }

        // Session credits exhaustion gate (per-class batches only)
        try {
          const creditsRes = await db.query(
            `SELECT COALESCE(SUM(total_sessions), 0)::int AS total_allotted,
                    COALESCE(SUM(used_sessions), 0)::int AS total_used
             FROM student_session_credits
             WHERE student_email = $1 AND is_active = true`,
            [user.id]
          );
          const row = creditsRes.rows[0] as { total_allotted: number; total_used: number };
          if (row.total_allotted > 0 && row.total_allotted <= row.total_used) {
            return NextResponse.json<ApiResponse>(
              { success: false, error: 'CREDITS_EXHAUSTED', message: 'All your prepaid session credits have been used. Please renew your session package to continue attending classes.' },
              { status: 402 }
            );
          }
        } catch {
          // credits table may not exist — skip
        }
      }
      // ── Group batches (1:15, 1:30, 1:M, lecture): overdue invoice gate ──
      // Per-class credit system doesn't apply, but if the student has an
      // overdue invoice, block classroom entry until fees are cleared.
      if (!isPerClassBatch) {
        try {
          // Check skip_payment_gate first
          const gateRes = await db.query<{ skip_payment_gate: boolean }>(
            `SELECT bs.skip_payment_gate
             FROM batch_students bs
             JOIN batches b ON b.batch_id = bs.batch_id
             WHERE bs.student_email = $1
               AND b.batch_id IN (
                 SELECT batch_id FROM rooms WHERE room_id = $2
                 UNION
                 SELECT batch_id FROM batch_sessions WHERE session_id = $3
               )
             ORDER BY bs.skip_payment_gate DESC
             LIMIT 1`,
            [user.id, actualRoomId, String(room.batch_session_id ?? '')]
          );
          const skipGate = gateRes.rows[0]?.skip_payment_gate === true;

          if (!skipGate) {
            const overdueRes = await db.query<{ count: string }>(
              `SELECT COUNT(*)::int AS count
               FROM invoices
               WHERE student_email = $1
                 AND status = 'overdue'
                 AND hidden_from_owner = FALSE`,
              [user.id]
            );
            const overdueCount = Number(overdueRes.rows[0]?.count ?? 0);
            if (overdueCount > 0) {
              return NextResponse.json<ApiResponse>(
                {
                  success: false,
                  error: 'INVOICE_OVERDUE',
                  message: `You have ${overdueCount} overdue invoice${overdueCount > 1 ? 's' : ''}. Please clear your outstanding fees to continue attending classes.`,
                },
                { status: 402 }
              );
            }
          }
        } catch {
          // invoice table may not be accessible — skip gate
        }
      }
    }

    // ── Role-based status gating ─────────────────────────────
    // Teachers can join scheduled rooms (they need to set up before going live).
    // Students and others can only join LIVE rooms.
    const isTeacher = user.role === 'teacher';
    const isGhost = isGhostRole(user.role);

    if (room.status === 'scheduled' && !isTeacher && !isGhost) {
      // Students are now allowed to join scheduled rooms and wait for teacher inside the classroom.
      // Optionally, still record lobby presence for analytics.
      db.query(
        `INSERT INTO lobby_presence (room_id, user_email, last_seen)
         VALUES ($1, $2, NOW())
         ON CONFLICT (room_id, user_email) DO UPDATE SET last_seen = NOW()`,
        [actualRoomId, user.id]
      ).catch(() => {});
      // Do not block; let student proceed to classroom.
    }

    // ── Demo room: ordered admission (teacher → agent → student) ──
    // If this demo room has a CRM agent assigned, enforce join order:
    //   1. Teacher joins first (handled by CLASS_NOT_LIVE gate above)
    //   2. Agent can join once room is live (teacher started)
    //   3. Student must wait until agent has connected
    // This only applies when agent_email IS NOT NULL on the demo_request.
    // EXCEPTION: once the room is 'live', allow the student in even if the
    // agent hasn't joined — the teacher is actively teaching and shouldn't
    // be blocked waiting for the agent.
    if (isDemoRoom && user.role === 'student' && room.status !== 'live') {
      try {
        const agentCheck = await db.query(
          `SELECT ra.participant_email FROM room_assignments ra
           WHERE ra.room_id = $1 AND ra.participant_type = 'demo_agent'
           LIMIT 1`,
          [actualRoomId]
        );
        if (agentCheck.rows.length > 0) {
          // Agent is assigned — check if agent has connected
          const agentEmail = String(agentCheck.rows[0].participant_email);
          const participants = await listParticipants(actualRoomId);
          const agentConnected = participants.some(
            (p) => p.identity === `demo_agent_${agentEmail}`
          );
          if (!agentConnected) {
            return NextResponse.json<ApiResponse>(
              {
                success: false,
                error: 'AGENT_NOT_JOINED',
                message: 'Your sales agent has not joined yet. Please wait — the page will update automatically.',
              },
              { status: 403 }
            );
          }
        }
      } catch {
        // Non-critical — allow join if check fails
      }
    }

    // ── Time window validation ───────────────────────────────
    const now = new Date();

    // Students can enter lobby 15 minutes before scheduled start.
    // The CLASS_NOT_LIVE gate above already prevents actual room entry
    // until the teacher clicks Go Live.
    if (!isTeacher && !isGhost && room.scheduled_start) {
      const scheduledStart = new Date(String(room.scheduled_start));
      const lobbyOpenTime = new Date(scheduledStart.getTime() - 15 * 60 * 1000);
      if (now < lobbyOpenTime) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'SESSION_NOT_STARTED',
            message: 'The session has not started yet. The lobby opens 15 minutes before the scheduled start time.',
          },
          { status: 425 }
        );
      }
    }

    // Check if room has expired (expires_at in past)
    // Demo rooms: skip time-based expiry while the room is still active (scheduled/live).
    // A demo link only "expires" when the teacher explicitly ends the class (status → ended).
    const demoStillActive = isDemoRoom && ['scheduled', 'live'].includes(String(room.status));
    if (!demoStillActive && room.expires_at && new Date(String(room.expires_at)) < now) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This room link has expired' },
        { status: 410 }
      );
    }

    // Check if class time has ended (scheduled_start + duration_minutes)
    // Skip for teachers and ghost roles — they can enter until teacher manually ends class.
    // Skip for live rooms — everyone is allowed in (teacher is actively teaching).
    if (!isTeacher && !isGhost && room.status !== 'live' && room.scheduled_start && room.duration_minutes) {
      const classEnd = new Date(String(room.scheduled_start)).getTime() + Number(room.duration_minutes) * 60 * 1000;
      if (!isNaN(classEnd) && now.getTime() >= classEnd) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'This class has ended. The scheduled time has passed.' },
          { status: 410 }
        );
      }
    }

    // Check if room hasn't opened yet (open_at in future)
    // Allow 15 minutes early for lobby
    if (room.open_at) {
      const openAt = new Date(String(room.open_at));
      const earlyAccessMs = 15 * 60 * 1000; // 15 min early access
      if (now < new Date(openAt.getTime() - earlyAccessMs)) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: `This room opens at ${openAt.toISOString()}. You can join 15 minutes before.`,
          },
          { status: 425 }
        );
      }
    }

    // ── Rejoin detection for students ─────────────────────────
    let is_rejoin = false;
    if (user.role === 'student') {
      // Block re-entry if student already submitted feedback (attendance + rating)
      try {
        const fbRes = await db.query(
          `SELECT id FROM student_feedback
           WHERE room_id = $1 AND student_email = $2
           LIMIT 1`,
          [actualRoomId, user.id],
        );
        if (fbRes.rows.length > 0) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'SESSION_COMPLETED', message: 'You have already completed this session (attendance confirmed and feedback submitted). You cannot rejoin.' },
            { status: 403 }
          );
        }
      } catch {
        // student_feedback table may not exist — skip
      }

      try {
        const attRes = await db.query(
          `SELECT join_count FROM attendance_sessions
           WHERE room_id = $1 AND participant_email = $2
           LIMIT 1`,
          [actualRoomId, user.id],
        );
        if (attRes.rows.length > 0 && Number(attRes.rows[0].join_count) > 0) {
          // Only gate the student if free_rejoin is NOT enabled globally
          const freeRejoin = await isFreeRejoinEnabled();
          if (!freeRejoin) is_rejoin = true;
        }
      } catch {
        // attendance table may not exist yet — ignore
      }
    }

    // ── Determine role and identity ──────────────────────────
    // Room-assignment override: if the user's portal role is a ghost/observer role (e.g. parent)
    // but room_assignments records them as 'student' or 'teacher', honour that assignment.
    // This handles the case where a student's portal account is created with role='parent'
    // (common in family-shared accounts) but the student is enrolled in the batch.
    let resolvedUserRole: PortalRole = user.role;
    if (isGhostRole(user.role) && user.role !== 'batch_coordinator' && user.role !== 'academic_operator') {
      try {
        const raCheck = await db.query(
          `SELECT participant_type FROM room_assignments
           WHERE room_id = $1 AND participant_email = $2 LIMIT 1`,
          [actualRoomId, user.id],
        );
        if (raCheck.rows.length > 0) {
          const assignedType = String(raCheck.rows[0].participant_type);
          if (assignedType === 'student' || assignedType === 'teacher') {
            resolvedUserRole = assignedType as PortalRole;
            console.log(`[room/join] Role override for ${user.id}: portal=${user.role} → assigned=${assignedType}`);
          }
        }
      } catch { /* non-critical */ }
    }

    // Only allow ghost role override if the user's NATIVE role is already a ghost-eligible role
    const effectiveRole = roleOverride && isGhostRole(roleOverride) && isGhostRole(resolvedUserRole)
      ? roleOverride
      : resolvedUserRole;

    // Auto-detect dual-device: if teacher joins without device=screen but
    // their primary identity is already in the room, promote to screen device
    let resolvedDevice: 'primary' | 'screen' = device;
    if (resolvedUserRole === 'teacher' && resolvedDevice === 'primary') {
      try {
        const primaryIdentity = `${resolvedUserRole}_${user.id}`;
        const participants = await listParticipants(actualRoomId);
        const alreadyConnected = participants.some(
          (p) => p.identity === primaryIdentity
        );
        if (alreadyConnected) {
          resolvedDevice = 'screen';
          console.log(`[room/join] Teacher ${user.id} already connected as primary, auto-promoting to screen device`);
        }
      } catch {
        // Room may not exist yet on LiveKit — ignore, keep primary
      }
    }

    let participantIdentity: string;
    if (isGhostRole(effectiveRole) && effectiveRole !== resolvedUserRole) {
      // Ghost mode override — generate unique ghost identity
      participantIdentity = ghostIdentity(effectiveRole, user.name);
    } else if (isGhostRole(resolvedUserRole)) {
      // Native ghost role
      participantIdentity = ghostIdentity(resolvedUserRole, user.name);
    } else if (resolvedDevice === 'screen') {
      // Teacher's screen-share device (tablet) — distinct identity
      participantIdentity = `${resolvedUserRole}_${user.id}_screen`;
    } else {
      participantIdentity = `${resolvedUserRole}_${user.id}`;
    }

    // ── Metadata attached to participant ─────────────────────
    // Check if student is a returning student (was discontinued/on_break, now rejoined)
    let isReturningStudent = false;
    if (effectiveRole === 'student' && room.batch_session_id) {
      try {
        const bsCheck = await db.query(
          `SELECT bs2.student_status FROM batch_sessions bsess
           JOIN batch_students bs2 ON bs2.batch_id = bsess.batch_id AND bs2.student_email = $2
           WHERE bsess.session_id = $1 LIMIT 1`,
          [room.batch_session_id, user.id]
        );
        if (bsCheck.rows.length > 0 && (bsCheck.rows[0] as Record<string, unknown>).student_status === 'rejoined') {
          isReturningStudent = true;
        }
      } catch { /* non-critical */ }
    }

    // ── Determine token role: screen device gets restricted grants ──
    // Teacher 'screen' device: can only screen share, no camera/mic/admin
    const tokenRole = (resolvedDevice === 'screen') ? 'teacher_screen' as PortalRole : effectiveRole;

    const metadata = JSON.stringify({
      portal_user_id: user.id,
      portal_role: resolvedUserRole,
      effective_role: resolvedDevice === 'screen' ? 'teacher_screen' : effectiveRole,
      room_name: room.room_name,
      device: resolvedDevice, // 'primary' or 'screen'
      ...(isReturningStudent && { is_returning_student: true }),
      ...(is_rejoin && { is_rejoin: true }),
    });

    // ── Ensure LiveKit room exists ───────────────────────────
    await ensureRoom(actualRoomId, JSON.stringify({
      room_name: room.room_name,
      portal_room_id: room.room_id,
    }));

    // ── Generate LiveKit token ───────────────────────────────
    const livekit_token = await createLiveKitToken({
      roomName: actualRoomId,
      participantIdentity,
      participantName: resolvedDevice === 'screen' ? `${user.name} (Screen)` : user.name,
      role: tokenRole,
      metadata,
      batchType: (room.batch_type as string) || undefined,
    });

    const livekit_url = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

    const response = NextResponse.json<ApiResponse<{
      livekit_token: string;
      livekit_url: string;
      room_id: string;
      room_name: string;
      role: PortalRole;
      participant_name: string;
      participant_identity: string;
      device: 'primary' | 'screen';
      scheduled_start: string;
      duration_minutes: number;
      room_status: string;
      is_rejoin: boolean;
      topic: string;
    }>>(
      {
        success: true,
        data: {
          livekit_token,
          livekit_url,
          room_id: actualRoomId,
          room_name: String(room.room_name || actualRoomId),
          role: effectiveRole,
          participant_name: user.name,
          participant_identity: participantIdentity,
          device: resolvedDevice,
          scheduled_start: room.scheduled_start ? new Date(String(room.scheduled_start)).toISOString() : new Date().toISOString(),
          duration_minutes: Number(room.duration_minutes) || 60,
          room_status: String(room.status),
          is_rejoin,
          topic: String(room.session_topic || ''),
        },
      },
      { status: 200 }
    );

    // ── Set session cookie for email-token users ─────────────
    // Demo/email-link students have no session cookie, which causes
    // downstream API calls (monitoring events, etc.) to fail with 401.
    // Issue a short-lived session cookie so all in-classroom APIs work.
    if (needsSessionCookie && user) {
      try {
        const jwt = await signSession(user);
        response.cookies.set(COOKIE_NAME, jwt, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 4, // 4 hours — enough for any session
        });
      } catch (e) {
        console.warn('[room/join] Failed to set session cookie for email-token user:', e);
      }
    }

    return response;
  } catch (err) {
    console.error('[room/join] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
