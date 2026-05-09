import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';
import { getPlatformName } from '@/lib/platform-config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * POST /api/v1/external/schedule-demo
 * Called by CRM AFTER student has registered via demo link.
 * Takes an existing demo_request_id and assigns teacher + time.
 * Creates room, sends join links to student + teacher.
 *
 * Body: { demo_request_id, teacher_email, scheduled_start, subject, duration_minutes? }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const {
      demo_request_id,
      teacher_email,
      scheduled_start,
      subject,
      duration_minutes: rawDuration,
      agent_email: bodyAgentEmail,
      agent_name: bodyAgentName,
      reschedule,
      crm_lead_id: bodyCrmLeadId,
      crm_tenant_id: bodyCrmTenantId,
    } = body as {
      demo_request_id?: string;
      teacher_email?: string;
      scheduled_start?: string;
      subject?: string;
      duration_minutes?: number;
      agent_email?: string;
      agent_name?: string;
      reschedule?: boolean;
      crm_lead_id?: string;
      crm_tenant_id?: string;
    };

    if (!demo_request_id || !teacher_email || !scheduled_start || !subject) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: demo_request_id, teacher_email, scheduled_start, subject' },
        { status: 400 },
      );
    }

    const durationMinutes = rawDuration || 30;
    const schedStart = new Date(scheduled_start);
    if (isNaN(schedStart.getTime())) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid scheduled_start' }, { status: 400 });
    }

    // Fetch current demo_request — try by ID first, then fall back to crm_lead_id
    let demoRow = await db.query(
      `SELECT id, demo_link_id, status, student_name, student_phone, student_email, student_grade,
              crm_lead_id, crm_tenant_id, agent_email, agent_name, agent_phone, room_id
       FROM demo_requests WHERE id = $1`,
      [demo_request_id],
    );

    // Fallback: look up by crm_lead_id if primary lookup failed
    if (demoRow.rows.length === 0 && bodyCrmLeadId) {
      demoRow = await db.query(
        `SELECT id, demo_link_id, status, student_name, student_phone, student_email, student_grade,
                crm_lead_id, crm_tenant_id, agent_email, agent_name, agent_phone, room_id
         FROM demo_requests WHERE crm_lead_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [bodyCrmLeadId],
      );
      if (demoRow.rows.length > 0) {
        console.log(`[external/schedule-demo] demo_request_id ${demo_request_id} not found — fell back to crm_lead_id ${bodyCrmLeadId} → found ${(demoRow.rows[0] as {id:string}).id}`);
      }
    }

    if (demoRow.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo request not found' }, { status: 404 });
    }
    const demo = demoRow.rows[0] as {
      id: string; demo_link_id: string; status: string;
      student_name: string; student_phone: string; student_email: string | null; student_grade: string | null;
      crm_lead_id: string | null; crm_tenant_id: string | null;
      agent_email: string | null; agent_name: string | null; agent_phone: string | null;
      room_id: string | null;
    };

    if (demo.status === 'accepted' && !reschedule) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo already scheduled. Pass reschedule=true to reschedule.' }, { status: 409 });
    }

    // If rescheduling, cancel the old room
    const oldRoomId = demo.room_id as string | null;
    if (reschedule && oldRoomId) {
      await db.query(`UPDATE rooms SET status = 'ended', updated_at = NOW() WHERE room_id = $1 AND status IN ('scheduled','live')`, [oldRoomId]);
      await db.query(`DELETE FROM room_assignments WHERE room_id = $1`, [oldRoomId]);
    }

    // Validate teacher
    const teacherRow = await db.query(
      `SELECT email, full_name FROM portal_users WHERE email = $1 AND portal_role = 'teacher' AND is_active = true`,
      [teacher_email],
    );
    if (teacherRow.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Teacher not found or inactive' }, { status: 404 });
    }
    const teacherName = (teacherRow.rows[0] as { full_name: string }).full_name;

    // Always allow agent slot — use body params, demo_request, or generic fallback
    const agentEmail = bodyAgentEmail || demo.agent_email || 'crm-agent@stibe.local';
    const agentName = bodyAgentName || demo.agent_name || 'CRM Agent';
    const maxParticipants = 3;
    const roomId = 'demo_' + crypto.randomUUID().slice(0, 12);
    const roomName = `Demo: ${subject} — ${demo.student_name}`;
    const openAt = new Date(schedStart.getTime() - 10 * 60 * 1000);
    const expiresAt = new Date(schedStart.getTime() + durationMinutes * 60 * 1000 + 15 * 60 * 1000);

    // 1-6. Create room, update demo_request, create assignments — all in transaction
    const { ensureRoom, createLiveKitToken } = await import('@/lib/livekit');
    const teacherJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const studentJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    let agentJoinCode: string | null = null;

    await db.withTransaction(async (client) => {
      // Create room
      await client.query(
        `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, status, scheduled_start, duration_minutes, open_at, expires_at, batch_type, max_participants, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, 'one_to_one', $10, 'crm-agent', NOW(), NOW())`,
        [roomId, roomName, teacher_email, subject, demo.student_grade || null,
         schedStart.toISOString(), durationMinutes, openAt.toISOString(), expiresAt.toISOString(), maxParticipants],
      );

      // Update demo_request to accepted
      await client.query(
        `UPDATE demo_requests SET
          status = 'accepted', subject = $2, teacher_email = $3, teacher_name = $4,
          room_id = $5, scheduled_start = $6, duration_minutes = $7, updated_at = NOW()
         WHERE id = $1`,
        [demo_request_id, subject, teacher_email, teacherName, roomId, schedStart.toISOString(), durationMinutes],
      );

      // Room assignments
      await client.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, join_token, payment_status)
         VALUES ($1, 'teacher', $2, $3, $4, 'exempt'),
                ($1, 'student', $5, $6, $7, 'exempt')`,
        [roomId, teacher_email, teacherName, teacherJoinCode,
         demo.student_email || `demo_${demo.demo_link_id}@stibe.tmp`, demo.student_name, studentJoinCode],
      );

      // Agent assignment — always created for CRM-originated demos
      agentJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
      await client.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, join_token, payment_status)
           VALUES ($1, 'demo_agent', $2, $3, $4, 'exempt')`,
        [roomId, agentEmail, agentName, agentJoinCode],
      );

      // Room event
      await client.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, payload)
         VALUES ($1, 'room_created', 'crm-agent', $2)`,
        [roomId, JSON.stringify({ is_demo: true, demo_request_id: demo.id, scheduled_by: 'crm_agent' })],
      );
    });

    // Ensure LiveKit room (outside transaction — external service call)
    await ensureRoom(roomId, JSON.stringify({ room_name: roomName, portal_room_id: roomId, is_demo: true }));

    // Read back actual stored tokens from DB to guarantee URL matches DB (defensive against any edge cases)
    const storedTokens = await db.query<{ participant_type: string; join_token: string }>(
      `SELECT participant_type, join_token FROM room_assignments WHERE room_id = $1`,
      [roomId],
    );
    const tokenMap = new Map(storedTokens.rows.map(r => [r.participant_type, r.join_token]));
    const actualStudentToken = tokenMap.get('student') || studentJoinCode;
    const actualTeacherToken = tokenMap.get('teacher') || teacherJoinCode;
    const actualAgentToken = tokenMap.get('demo_agent') || agentJoinCode;

    const studentJoinUrl = `${BASE_URL}/join/${roomId}?token=${actualStudentToken}`;
    const teacherJoinUrl = `${BASE_URL}/join/${roomId}?token=${actualTeacherToken}`;
    const agentJoinUrl = actualAgentToken ? `${BASE_URL}/join/${roomId}?token=${actualAgentToken}` : null;
    const timeStr = schedStart.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    const cleanPhone = demo.student_phone.replace(/\D/g, '');
    const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const schedLabel = reschedule ? 'Rescheduled' : 'Scheduled';

    // 9. WhatsApp join link to student
    const platformName = await getPlatformName();
    await fireWhatsApp(
      `wa_demo_sched_${demo.demo_link_id}`,
      `🎓 *${platformName} Classes — Demo Session ${schedLabel}!*\n\nHi ${demo.student_name}! Your free demo class has been ${reschedule ? 'rescheduled' : 'scheduled'}.\n\n📅 *${timeStr}*\n📚 *${subject}*\n👩‍🏫 Teacher: ${teacherName}\n⏱ Duration: ${durationMinutes} minutes\n\nJoin here when it's time:\n${studentJoinUrl}\n\n— ${platformName} Classes`,
      undefined,
      'stibe_demo_confirm',
      [demo.student_name, subject, teacherName, timeStr, studentJoinUrl],
      normalizedPhone,
    );

    // 10. Email to student
    if (demo.student_email) {
      try {
        const { demoStudentAcceptedTemplate } = await import('@/lib/email-templates');
        const { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } = await import('@/lib/email');
        const content = demoStudentAcceptedTemplate({
          studentName: demo.student_name, teacherName, subject,
          scheduledStart: schedStart.toISOString(), joinLink: studentJoinUrl,
          durationMinutes, recipientEmail: demo.student_email,
        });
        const logId = await logEmailQueued(roomId, demo.student_email, 'demo_accepted', content.subject);
        const emailResult = await sendEmail({ to: demo.student_email, subject: content.subject, html: content.html, text: content.text, priority: 'high' });
        if (emailResult.success) await logEmailSent(logId, emailResult.messageId);
        else await logEmailFailed(logId, emailResult.error || 'Unknown');
      } catch (e) { console.error('[schedule-demo] Student email error:', e); }
    }

    // 11. Email to teacher (informational)
    try {
      const { demoTeacherAssignedTemplate } = await import('@/lib/email-templates');
      const { sendEmail: sendT } = await import('@/lib/email');
      const tContent = demoTeacherAssignedTemplate({
        teacherName, studentName: demo.student_name, subject,
        scheduledStart: schedStart.toISOString(), joinLink: teacherJoinUrl,
        durationMinutes, recipientEmail: teacher_email,
        studentGrade: demo.student_grade || undefined,
      });
      await sendT({
        to: teacher_email, subject: tContent.subject, html: tContent.html, text: tContent.text, priority: 'high',
        waTemplate: 'stibe_alert',
        waParams: [teacherName, `Demo assigned: ${subject} with ${demo.student_name} at ${timeStr}. Join: ${teacherJoinUrl}`],
      });
    } catch (e) { console.error('[schedule-demo] Teacher notification error:', e); }

    // 12. Email to agent (skip generic fallback email)
    if (agentEmail && agentEmail !== 'crm-agent@stibe.local' && agentJoinUrl) {
      try {
        const { demoAgentJoinTemplate } = await import('@/lib/email-templates');
        const { sendEmail: sendA } = await import('@/lib/email');
        const aContent = demoAgentJoinTemplate({
          agentName: agentName, teacherName, studentName: demo.student_name, subject,
          scheduledStart: schedStart.toISOString(), joinLink: agentJoinUrl,
          durationMinutes, recipientEmail: agentEmail,
        });
        await sendA({
          to: agentEmail, subject: aContent.subject, html: aContent.html, text: aContent.text, priority: 'high',
          waTemplate: 'stibe_alert',
          waParams: [agentName, `Demo session scheduled! Join: ${agentJoinUrl}`],
          recipientPhone: demo.agent_phone || undefined,
        });
      } catch (e) { console.error('[schedule-demo] Agent notification error:', e); }
    }

    // 13. CRM webhook
    if (demo.crm_lead_id && demo.crm_tenant_id) {
      import('@/lib/crm-webhook').then(({ notifyCRM }) =>
        notifyCRM({
          event: 'demo_scheduled',
          crm_lead_id: demo.crm_lead_id!,
          crm_tenant_id: demo.crm_tenant_id!,
          demo_request_id: demo.id,
          scheduled_start: schedStart.toISOString(),
          teacher_name: teacherName,
        })
      ).catch(e => console.error('[schedule-demo] CRM webhook error:', e));
    }

    console.log(`[external/schedule-demo] demo ${demo_request_id} → room ${roomId} → ${teacher_email} at ${timeStr}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        demo_request_id: demo.id,
        room_id: roomId,
        student_join_url: studentJoinUrl,
        teacher_join_url: teacherJoinUrl,
        agent_join_url: agentJoinUrl,
        scheduled_start: schedStart.toISOString(),
      },
      message: 'Demo scheduled — room created, notifications sent',
    }, { status: 200 });
  } catch (err) {
    console.error('[external/schedule-demo] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
