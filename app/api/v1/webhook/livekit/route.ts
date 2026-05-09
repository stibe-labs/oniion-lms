import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { webhookReceiver } from '@/lib/livekit';
import { db } from '@/lib/db';
import { recordJoin, recordLeave, finalizeAttendance } from '@/lib/attendance';
import { autoGenerateSessionReport } from '@/lib/reports';
import { sendDemoSummaryNotifications } from '@/lib/demo-summary';
import { notifyEarlyExit } from '@/lib/early-exit-alert';
import { updateRecordingUrl, stopRecording } from '@/lib/recording';
import { recordSessionEarning } from '@/lib/payroll';
import { adjustInvoicesForAbsentStudents, deductSessionCreditsOnEnd } from '@/lib/payment';

/**
 * POST /api/v1/webhook/livekit
 * Receives LiveKit server webhook events.
 * Auth: verified using WebhookReceiver (checks Authorization header).
 *
 * Events handled:
 * - room_started  → mark room as Live in DB
 * - room_finished → mark room as Completed
 * - participant_joined → log join event
 * - participant_left   → log leave event
 */
export async function POST(request: NextRequest) {
  try {
    // ── Read raw body + auth header ──────────────────────────
    const body = await request.text();
    const authHeader = request.headers.get('authorization') || '';

    // ── Verify webhook signature ─────────────────────────────
    let event;
    try {
      event = await webhookReceiver.receive(body, authHeader);
    } catch (err) {
      console.error('[webhook/livekit] Signature verification failed:', err);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const eventType = event.event;
    const room = event.room;
    const participant = event.participant;

    console.log(`[webhook/livekit] Event: ${eventType}, Room: ${room?.name || 'N/A'}`);

    // ── Handle: room_started ─────────────────────────────────
    // Note: We no longer auto-set status to 'live' here.
    // The teacher explicitly triggers "Go Live" via /api/v1/room/[room_id]/go-live.
    // We only log the event.
    if (eventType === 'room_started' && room) {
      // Only insert if the room exists in our DB (guard against phantom LiveKit rooms)
      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         SELECT $1, 'room_started', $2
         WHERE EXISTS (SELECT 1 FROM rooms WHERE room_id = $1)`,
        [room.name, safeStringify({ sid: room.sid })]
      );
    }

    // ── Handle: room_finished ────────────────────────────────
    if (eventType === 'room_finished' && room) {
      // IMPORTANT: LiveKit fires `room_finished` both when the teacher explicitly
      // ends the class (DELETE /api/v1/room/[room_id] → deleteLiveKitRoom) and
      // when the room auto-closes after `emptyTimeout`. We only want to mark the
      // DB as ended when the teacher explicitly ended — never from idle timeouts.
      //
      // We detect an explicit teacher-end by looking for a `room_end_requested`
      // event in the last 5 minutes (inserted by the DELETE route before it
      // calls deleteLiveKitRoom). If no such event exists, this is an idle
      // auto-close — we IGNORE it and leave the room in `live` status so the
      // teacher can rejoin and continue.
      const explicitEnd = await db.query(
        `SELECT 1 FROM room_events
         WHERE room_id = $1
           AND event_type = 'room_end_requested'
           AND created_at >= NOW() - INTERVAL '5 minutes'
         LIMIT 1`,
        [room.name]
      );

      if (explicitEnd.rows.length === 0) {
        console.warn(
          `[webhook/livekit] room_finished for ${room.name} but no recent ` +
          `room_end_requested event — treating as idle auto-close, NOT ending DB room.`
        );
        await db.query(
          `INSERT INTO room_events (room_id, event_type, payload)
           SELECT $1, 'livekit_idle_close_ignored', $2
           WHERE EXISTS (SELECT 1 FROM rooms WHERE room_id = $1)`,
          [room.name, safeStringify({ sid: room.sid })]
        );
        return NextResponse.json<ApiResponse>({ success: true });
      }

      // Auto-stop recording if active (stops LiveKit egress + ends YouTube broadcast)
      try { await stopRecording(room.name); } catch (e) {
        console.warn('[webhook/livekit] Auto-stop recording warning:', e);
      }

      // Only end rooms that were actually 'live' (teacher went live).
      const endResult = await db.query(
        `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW()
         WHERE room_id = $1 AND status = 'live'`,
        [room.name]
      );

      // If room was still 'scheduled', skip all post-end logic
      if ((endResult.rowCount ?? 0) === 0) {
        const check = await db.query(
          `SELECT status FROM rooms WHERE room_id = $1 LIMIT 1`,
          [room.name]
        );
        const roomStatus = (check.rows[0] as Record<string, string>)?.status;
        if (roomStatus === 'scheduled') {
          console.warn(`[webhook/livekit] room_finished for SCHEDULED room ${room.name} — ignoring (session never started)`);
          return NextResponse.json<ApiResponse>({ success: true });
        }
      }

      // Sync batch_sessions status → 'ended' (only if it was live)
      const batchSessionSync = await db.query<{ session_id: string }>(
        `UPDATE batch_sessions SET status = 'ended', ended_at = COALESCE(ended_at, NOW())
         WHERE session_id = (
           SELECT batch_session_id FROM rooms WHERE room_id = $1 LIMIT 1
         ) AND status = 'live'
         RETURNING session_id`,
        [room.name]
      ).catch(e => { console.warn('[webhook/livekit] batch_session sync warning:', e); return null; });

      // Deduct one session credit per enrolled student (fire-and-forget, non-critical)
      if (batchSessionSync && batchSessionSync.rows.length > 0) {
        const endedSessionId = batchSessionSync.rows[0].session_id;
        deductSessionCreditsOnEnd(endedSessionId).catch(e =>
          console.warn('[webhook/livekit] deductSessionCreditsOnEnd warning:', e)
        );
      }

      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'room_ended_by_teacher', $2)`,
        [room.name, safeStringify({ sid: room.sid })]
      );

      // If this is a demo room, mark the demo request as completed with proper outcome
      if (room.name.startsWith('demo_')) {
        try {
          const studentJoined = await db.query(
            `SELECT 1 FROM room_events
             WHERE room_id = $1 AND event_type = 'participant_joined'
               AND participant_role = 'student'
             LIMIT 1`,
            [room.name]
          );
          const hasExam = await db.query(
            `SELECT 1 FROM demo_exam_results WHERE room_id = $1 LIMIT 1`,
            [room.name]
          );
          const outcome = studentJoined.rows.length === 0
            ? 'student_no_show'
            : hasExam.rows.length > 0
              ? 'completed_with_exam'
              : 'completed';
          await db.query(
            `UPDATE demo_requests SET status = 'completed', outcome = COALESCE(outcome, $2), updated_at = NOW()
             WHERE room_id = $1 AND status IN ('accepted', 'live')`,
            [room.name, outcome]
          );

          // Notify CRM if this demo was created from CRM
          try {
            const demoRow = await db.query(
              `SELECT id, crm_lead_id, crm_tenant_id, duration_minutes FROM demo_requests WHERE room_id = $1 LIMIT 1`,
              [room.name]
            );
            const dr = demoRow.rows[0] as Record<string, unknown> | undefined;
            if (dr?.crm_lead_id && dr?.crm_tenant_id) {
              const { notifyCRM } = await import('@/lib/crm-webhook');
              await notifyCRM({
                event: 'demo_completed',
                crm_lead_id: dr.crm_lead_id as string,
                crm_tenant_id: dr.crm_tenant_id as string,
                demo_request_id: dr.id as string,
                outcome,
                duration_minutes: (dr.duration_minutes as number) || 30,
              });
            }
          } catch (crmErr) {
            console.warn('[webhook/livekit] CRM webhook error:', crmErr);
          }
        } catch (e) {
          console.warn('[webhook/livekit] demo_requests completion update warning:', e);
        }
      }

      // Finalize attendance — mark all unjoined students as absent
      try { await finalizeAttendance(room.name); } catch (e) {
        console.error('[webhook/livekit] Failed to finalize attendance:', e);
      }

      // Auto-adjust invoices for absent students (cancel or reduce)
      try {
        const adj = await adjustInvoicesForAbsentStudents(room.name);
        if (adj.cancelled > 0 || adj.reduced > 0) {
          console.log(`[webhook/livekit] Invoice adjustments for ${room.name}: ${adj.cancelled} cancelled, ${adj.reduced} reduced`);
        }
      } catch (e) {
        console.error('[webhook/livekit] Failed to adjust invoices for absent students:', e);
      }

      // Auto-generate session report
      try { await autoGenerateSessionReport(room.name); } catch (e) {
        console.error('[webhook/livekit] Failed to auto-generate session report:', e);
      }

      // Auto-record teacher session earning (salary calculation)
      try { await recordSessionEarning(room.name); } catch (e) {
        console.error('[webhook/livekit] Failed to record session earning:', e);
      }

      // Fire-and-forget demo summary notifications (covers LiveKit timeout case)
      // Use delay + dedup — room DELETE handler or feedback trigger may send first
      if (room.name.startsWith('demo_')) {
        sendDemoSummaryNotifications(room.name, 15000).catch(e =>
          console.error('[webhook/livekit] Demo summary notification error:', e)
        );
      }
    }

    // ── Handle: participant_joined ───────────────────────────
    if (eventType === 'participant_joined' && room && participant) {
      const metadata = safeParseJson(participant.metadata);
      const role = String(metadata?.effective_role || metadata?.portal_role || 'unknown');

      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
         VALUES ($1, 'participant_joined', $2, $3, $4)`,
        [
          room.name,
          participant.identity,
          role,
          safeStringify({
            name: participant.name,
            sid: participant.sid,
            metadata: participant.metadata,
          }),
        ]
      );

      // Log ghost mode entry for audit/compliance
      if (participant.identity.startsWith('ghost_')) {
        const ghostEmail = extractEmail(participant.identity, metadata);
        await db.query(
          `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
           VALUES ($1, 'ghost_mode_entry', $2, $3, $4)`,
          [
            room.name,
            ghostEmail,
            role,
            safeStringify({ name: participant.name, identity: participant.identity, sid: participant.sid }),
          ]
        );
      }

      // ── Reset left_at for OC participants when they rejoin ──
      if (room.name.startsWith('oc_') && (role === 'student' || role === 'teacher')) {
        const ocParticipantId = participant.identity
          .replace(/_screen$/, '')
          .replace(/^(student|teacher)_/, '');
        db.query(
          `UPDATE open_classroom_participants SET left_at = NULL WHERE id = $1`,
          [ocParticipantId],
        ).catch(e => console.warn('[webhook/livekit] OC rejoin left_at clear warning:', e));
      }

      // Record attendance join (get scheduled_start for late detection)
      if (role === 'student' || role === 'teacher') {
        const email = extractEmail(participant.identity, metadata);
        try {
          const roomRow = await db.query(
            `SELECT scheduled_start FROM rooms WHERE room_id = $1`,
            [room.name],
          );
          const scheduledStart = roomRow.rows[0]?.scheduled_start
            ? new Date(String(roomRow.rows[0].scheduled_start)).toISOString()
            : null;
          await recordJoin(
            room.name,
            email,
            participant.name || email,
            role,
            scheduledStart,
          );
        } catch (e) {
          console.error('[webhook/livekit] Attendance recordJoin failed:', e);
        }
      }
    }

    // ── Handle: participant_left ─────────────────────────────
    if (eventType === 'participant_left' && room && participant) {
      const metadata = safeParseJson(participant.metadata);
      const role = String(metadata?.effective_role || metadata?.portal_role || 'unknown');

      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
         VALUES ($1, 'participant_left', $2, $3, $4)`,
        [
          room.name,
          participant.identity,
          role,
          safeStringify({
            name: participant.name,
            sid: participant.sid,
            joinedAt: participant.joinedAt,
          }),
        ]
      );

      // Log ghost mode exit for audit/compliance
      if (participant.identity.startsWith('ghost_')) {
        const ghostEmail = extractEmail(participant.identity, metadata);
        await db.query(
          `INSERT INTO room_events (room_id, event_type, participant_email, participant_role, payload)
           VALUES ($1, 'ghost_mode_exit', $2, $3, $4)`,
          [
            room.name,
            ghostEmail,
            role,
            safeStringify({ name: participant.name, identity: participant.identity, joinedAt: participant.joinedAt }),
          ]
        );
      }

      // Record attendance leave
      if (role === 'student' || role === 'teacher') {
        const email = extractEmail(participant.identity, metadata);
        try {
          // Check if room already ended (don't mark as left_early if room finished normally)
          const roomStatus = await db.query(
            `SELECT status FROM rooms WHERE room_id = $1`,
            [room.name],
          );
          const roomEnded = roomStatus.rows.length > 0
            && (roomStatus.rows[0] as { status: string }).status === 'ended';
          await recordLeave(
            room.name,
            email,
            participant.name || email,
            role,
            roomEnded,
          );
        } catch (e) {
          console.error('[webhook/livekit] Attendance recordLeave failed:', e);
        }

        // ── Early exit detection — notify parent & coordinator ──
        if (role === 'student') {
          notifyEarlyExit(room.name, email, participant.name || email).catch(e =>
            console.error('[webhook/livekit] Early exit notification failed:', e)
          );
        }
      }

      // ── Update open_classroom_participants.left_at for OC rooms ──
      // OC participant identity: "student_{uuid}" or "teacher_{uuid}" or "*_screen"
      if (room.name.startsWith('oc_') && (role === 'student' || role === 'teacher')) {
        const ocParticipantId = participant.identity
          .replace(/_screen$/, '')
          .replace(/^(student|teacher)_/, '');
        db.query(
          `UPDATE open_classroom_participants SET left_at = NOW() WHERE id = $1`,
          [ocParticipantId],
        ).catch(e => console.warn('[webhook/livekit] OC left_at update warning:', e));
      }
    }

    // ── Handle: egress_ended ─────────────────────────────────
    // When LiveKit RTMP egress stops, mark recording as completed.
    // The YouTube watch URL is already stored when recording started.
    if (eventType === 'egress_ended' && event.egressInfo) {
      const egressId = event.egressInfo.egressId;
      console.log(`[webhook/livekit] Egress ended: ${egressId}`);

      // Look up the room to get the already-stored YouTube URL
      const roomRow = await db.query(
        `SELECT room_id, recording_url, youtube_broadcast_id FROM rooms WHERE egress_id = $1`,
        [egressId]
      );

      if (roomRow.rows.length > 0) {
        const recordingUrl = roomRow.rows[0].recording_url as string;
        if (recordingUrl) {
          await updateRecordingUrl(egressId, recordingUrl);
        } else {
          // Fallback — just mark as completed
          await db.query(
            `UPDATE rooms SET recording_status = 'completed' WHERE egress_id = $1`,
            [egressId]
          );
        }

        await db.query(
          `INSERT INTO room_events (room_id, event_type, participant_email, payload)
           VALUES ($1, 'egress_ended', 'system', $2::jsonb)`,
          [roomRow.rows[0].room_id, safeStringify({
            egress_id: egressId,
            youtube_broadcast_id: roomRow.rows[0].youtube_broadcast_id,
          })]
        );
      }
    }

    return NextResponse.json<ApiResponse>({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[webhook/livekit] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────

/** BigInt-safe JSON stringify — converts BigInt values to Number */
function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  );
}

function safeParseJson(str?: string): Record<string, unknown> | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Extract the real email from a LiveKit identity string.
 * Identity format: {role}_{email} (e.g., student_john@example.com)
 * Also handles: teacher_email@x.com_screen
 * Falls back to metadata.portal_user_id or raw identity.
 */
function extractEmail(identity: string, metadata: Record<string, unknown> | null): string {
  // 1. Prefer metadata.portal_user_id (set on all new tokens)
  if (metadata?.portal_user_id && typeof metadata.portal_user_id === 'string') {
    return metadata.portal_user_id;
  }

  // 2. Parse from identity by stripping role prefix and _screen suffix
  let id = identity;
  if (id.endsWith('_screen')) id = id.slice(0, -7);

  const knownPrefixes = ['academic_operator_', 'batch_coordinator_', 'teacher_', 'student_', 'parent_', 'owner_', 'ghost_', 'hr_'];
  for (const prefix of knownPrefixes) {
    if (id.startsWith(prefix)) {
      return id.slice(prefix.length);
    }
  }

  // 3. Fallback: return identity as-is (legacy tokens without role prefix)
  return identity;
}
