import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';

/**
 * POST /api/v1/demo-invite/[token]/accept
 * Teacher submits their preferred time from the /demo-invite/[token] page.
 *
 * Atomic acceptance: only the first teacher to POST wins.
 * On success: creates room, fires CRM webhook, sends WA to student + other teachers.
 * On race: returns 409 with already_accepted_by.
 *
 * Body: { scheduled_start: ISO string, duration_minutes?: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { scheduled_start, duration_minutes: rawDuration } = body as {
      scheduled_start?: string;
      duration_minutes?: number;
    };

    if (!scheduled_start) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing scheduled_start' }, { status: 400 });
    }

    const schedStart = new Date(scheduled_start);
    if (isNaN(schedStart.getTime()) || schedStart < new Date()) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid or past scheduled_start' }, { status: 400 });
    }

    const durationMinutes = rawDuration || 30;

    // ── Atomic acceptance transaction ──────────────────────
    // UPDATE returns 0 rows if already accepted/expired → race condition safe
    let acceptedTeacherEmail: string | null = null;
    let demoRequestId: string | null = null;

    const acceptResult = await db.withTransaction(async (client) => {
      // Lock the invitation row and attempt to claim it
      const claim = await client.query<{
        id: string; teacher_email: string; demo_request_id: string; status: string; expires_at: Date;
      }>(
        `UPDATE demo_invitations SET status = 'accepted', accepted_at = NOW()
         WHERE invite_token = $1 AND status = 'pending' AND expires_at > NOW()
         RETURNING id, teacher_email, demo_request_id, status, expires_at`,
        [token],
      );

      if (claim.rows.length === 0) {
        // Already accepted or expired — find who took it
        const existing = await client.query<{ teacher_email: string; full_name: string; status: string }>(
          `SELECT di.teacher_email, pu.full_name, di.status
           FROM demo_invitations di
           JOIN portal_users pu ON pu.email = di.teacher_email
           WHERE di.invite_token = $1`,
          [token],
        );
        return { claimed: false, existing: existing.rows[0] || null };
      }

      return { claimed: true, invitation: claim.rows[0] };
    });

    if (!acceptResult.claimed) {
      // Race lost
      const who = acceptResult.existing;
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Demo already accepted by another teacher',
        data: { already_accepted_by: who?.full_name || 'another teacher' },
      }, { status: 409 });
    }

    acceptedTeacherEmail = (acceptResult as { claimed: true; invitation: { teacher_email: string; demo_request_id: string } }).invitation.teacher_email;
    demoRequestId = (acceptResult as { claimed: true; invitation: { teacher_email: string; demo_request_id: string } }).invitation.demo_request_id;

    // ── Fetch full demo_request + teacher profile ──────────
    const [demoResult, teacherResult] = await Promise.all([
      db.query(
        `SELECT id, student_name, student_phone, student_email, student_grade,
                crm_lead_id, crm_tenant_id, agent_email, agent_name, agent_phone, subject as demo_subject
         FROM demo_requests WHERE id = $1`,
        [demoRequestId],
      ),
      db.query(
        `SELECT pu.email, pu.full_name, up.phone
         FROM portal_users pu
         LEFT JOIN user_profiles up ON up.email = pu.email
         WHERE pu.email = $1`,
        [acceptedTeacherEmail],
      ),
    ]);

    if (demoResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo request not found' }, { status: 404 });
    }

    const demo = demoResult.rows[0] as {
      id: string;
      student_name: string; student_phone: string; student_email: string | null; student_grade: string | null;
      crm_lead_id: string | null; crm_tenant_id: string | null;
      agent_email: string | null; agent_name: string | null; agent_phone: string | null;
      demo_subject: string | null;
    };

    const teacherRow = teacherResult.rows[0] as {
      email: string; full_name: string; phone: string | null;
    };
    const teacherName = teacherRow.full_name;
    const resolvedSubject = demo.demo_subject || 'Demo Session';

    // ── Create room ────────────────────────────────────────
    const { ensureRoom } = await import('@/lib/livekit');
    const roomId = 'demo_' + crypto.randomUUID().slice(0, 12);
    const roomName = `Demo: ${resolvedSubject} — ${demo.student_name}`;
    const openAt = new Date(schedStart.getTime() - 10 * 60 * 1000);
    const expiresAt = new Date(schedStart.getTime() + durationMinutes * 60 * 1000 + 15 * 60 * 1000);
    const maxParticipants = 3;

    const teacherJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const studentJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const agentJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const agentEmail = demo.agent_email || 'crm-agent@stibe.local';
    const agentName = demo.agent_name || 'CRM Agent';

    await db.withTransaction(async (client) => {
      // Create room
      await client.query(
        `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, status, scheduled_start,
                            duration_minutes, open_at, expires_at, batch_type, max_participants, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, 'one_to_one', $10, 'crm-agent', NOW(), NOW())`,
        [roomId, roomName, acceptedTeacherEmail, resolvedSubject, demo.student_grade || null,
         schedStart.toISOString(), durationMinutes, openAt.toISOString(), expiresAt.toISOString(), maxParticipants],
      );

      // Update demo_request
      await client.query(
        `UPDATE demo_requests SET
           status = 'accepted', teacher_email = $2, teacher_name = $3,
           room_id = $4, scheduled_start = $5, duration_minutes = $6,
           subject = $7,
           teacher_join_url = $8, student_join_url = $9, agent_join_url = $10,
           join_links_sent = FALSE,
           updated_at = NOW()
         WHERE id = $1`,
        [
          demoRequestId, acceptedTeacherEmail, teacherName, roomId,
          schedStart.toISOString(), durationMinutes, resolvedSubject,
          `${BASE_URL}/join/${roomId}?token=${teacherJoinCode}`,
          `${BASE_URL}/join/${roomId}?token=${studentJoinCode}`,
          `${BASE_URL}/join/${roomId}?token=${agentJoinCode}`,
        ],
      );

      // Room assignments
      await client.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, join_token, payment_status)
         VALUES ($1, 'teacher', $2, $3, $4, 'exempt'),
                ($1, 'student', $5, $6, $7, 'exempt'),
                ($1, 'demo_agent', $8, $9, $10, 'exempt')`,
        [
          roomId,
          acceptedTeacherEmail, teacherName, teacherJoinCode,
          demo.student_email || `demo_${demo.id.slice(0, 8)}@stibe.tmp`, demo.student_name, studentJoinCode,
          agentEmail, agentName, agentJoinCode,
        ],
      );

      // Room event
      await client.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, payload)
         VALUES ($1, 'room_created', 'crm-agent', $2)`,
        [roomId, JSON.stringify({ is_demo: true, demo_request_id: demoRequestId, scheduled_by: 'teacher_broadcast' })],
      );

      // Expire all other PENDING invitations for this demo_request
      await client.query(
        `UPDATE demo_invitations SET status = 'expired'
         WHERE demo_request_id = $1 AND status = 'pending'`,
        [demoRequestId],
      );
    });

    // Ensure LiveKit room
    await ensureRoom(roomId, JSON.stringify({ room_name: roomName, portal_room_id: roomId, is_demo: true }));

    const timeStr = schedStart.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    const studentJoinUrl = `${BASE_URL}/join/${roomId}?token=${studentJoinCode}`;
    const teacherJoinUrl = `${BASE_URL}/join/${roomId}?token=${teacherJoinCode}`;

    // ── Notify student (WA + email) ────────────────────────
    const cleanPhone = demo.student_phone.replace(/\D/g, '');
    const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    await fireWhatsApp(
      `demo_student_${demo.id}`,
      `Your demo is confirmed`,
      undefined,
      'stibe_alert',
      [demo.student_name, `Your demo class is confirmed! Subject: ${resolvedSubject}, Teacher: ${teacherName}, Time: ${timeStr}. Join here: ${studentJoinUrl}`],
      normalizedPhone,
    );

    if (demo.student_email) {
      try {
        const { demoStudentAcceptedTemplate } = await import('@/lib/email-templates');
        const { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } = await import('@/lib/email');
        const content = demoStudentAcceptedTemplate({
          studentName: demo.student_name, teacherName, subject: resolvedSubject,
          scheduledStart: schedStart.toISOString(), joinLink: studentJoinUrl,
          durationMinutes, recipientEmail: demo.student_email,
        });
        const logId = await logEmailQueued(roomId, demo.student_email, 'demo_accepted', content.subject);
        const emailResult = await sendEmail({ to: demo.student_email, subject: content.subject, html: content.html, text: content.text, priority: 'high' });
        if (emailResult.success) await logEmailSent(logId, emailResult.messageId);
        else await logEmailFailed(logId, emailResult.error || 'Unknown');
      } catch (e) { console.error('[demo-invite/accept] Student email error:', e); }
    }

    // ── Confirm to teacher ──────────────────────────────────
    const teacherPhone = teacherRow.phone;
    await fireWhatsApp(
      acceptedTeacherEmail,
      `Demo confirmed`,
      undefined,
      'stibe_alert',
      [teacherName, `Demo confirmed! Student: ${demo.student_name}, Subject: ${resolvedSubject}, Time: ${timeStr}. Join as host (no login needed): ${teacherJoinUrl}`],
      teacherPhone || undefined,
    );

    // ── Notify other teachers that lost the race ───────────
    const otherInvitationsResult = await db.query(
       `SELECT di.teacher_email, pu.full_name, up.phone
       FROM demo_invitations di
       JOIN portal_users pu ON pu.email = di.teacher_email
       LEFT JOIN user_profiles up ON up.email = pu.email
       WHERE di.demo_request_id = $1 AND di.status = 'expired' AND di.teacher_email != $2`,
      [demoRequestId, acceptedTeacherEmail],
    );

    // Fire-and-forget to other teachers
    for (const other of otherInvitationsResult.rows as { teacher_email: string; full_name: string; phone: string | null }[]) {
      const otherPhone = other.phone;
      fireWhatsApp(
        other.teacher_email,
        `Demo taken`,
        undefined,
        'stibe_alert',
        [other.full_name, `The demo session for ${demo.student_name} (${resolvedSubject}) was accepted by ${teacherName}. We'll send you the next opportunity!`],
        otherPhone || undefined,
      ).catch(e => console.error(`[demo-invite/accept] WA to other teacher ${other.teacher_email}:`, e));
    }

    // ── CRM webhook ────────────────────────────────────────
    if (demo.crm_lead_id && demo.crm_tenant_id) {
      import('@/lib/crm-webhook').then(({ notifyCRM }) =>
        notifyCRM({
          event: 'demo_scheduled',
          crm_lead_id: demo.crm_lead_id!,
          crm_tenant_id: demo.crm_tenant_id!,
          demo_request_id: demoRequestId!,
          scheduled_start: schedStart.toISOString(),
          teacher_name: teacherName,
          teacher_email: acceptedTeacherEmail!,
          room_id: roomId,
          agent_join_url: `${BASE_URL}/join/${roomId}?token=${agentJoinCode}`,
          source: 'teacher_broadcast',
        })
      ).catch(e => console.error('[demo-invite/accept] CRM webhook error:', e));
    }

    console.log(`[demo-invite/accept] token ${token} → teacher ${acceptedTeacherEmail} → room ${roomId} at ${timeStr}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        room_id: roomId,
        scheduled_start: schedStart.toISOString(),
        teacher_name: teacherName,
      },
      message: 'Demo accepted and scheduled successfully',
    });
  } catch (err) {
    console.error('[demo-invite/accept] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
