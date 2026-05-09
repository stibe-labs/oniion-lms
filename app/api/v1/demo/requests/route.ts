import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';

/**
 * GET /api/v1/demo/requests
 * Lists demo requests. Role-filtered:
 *   - academic_operator / owner: all requests
 *   - teacher: own pending requests
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomIdParam = searchParams.get('room_id');

    // Special case: room_id lookup (used by classroom DemoExamDialog + TeacherView exam results)
    // This is a limited public endpoint — returns id, student_name, subject, status + exam score
    if (roomIdParam && roomIdParam.startsWith('demo_')) {
      const result = await db.query(
        `SELECT dr.id, dr.student_name, dr.student_email, dr.subject, dr.status, dr.room_id, dr.exam_result_id,
                der.score AS exam_score, der.total_marks AS exam_total_marks,
                der.percentage AS exam_percentage, der.grade_letter AS exam_grade
         FROM demo_requests dr
         LEFT JOIN demo_exam_results der ON der.id = dr.exam_result_id
         WHERE dr.room_id = $1 LIMIT 1`,
        [roomIdParam]
      );
      return NextResponse.json<ApiResponse>({ success: true, data: result.rows });
    }

    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    const status = searchParams.get('status');
    const teacherEmail = searchParams.get('teacher_email');

    // Lazy cleanup: expire stale link_created (48h) and pending_teacher (2h) records
    await db.query(
      `UPDATE demo_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'link_created' AND expires_at IS NOT NULL AND expires_at < NOW()`
    ).catch(() => {});
    await db.query(
      `UPDATE demo_requests SET status = 'expired', updated_at = NOW()
       WHERE status = 'pending_teacher' AND updated_at < NOW() - INTERVAL '2 hours'`
    ).catch(() => {});

    // Auto-cancel demo rooms where teacher never joined within 24h of scheduled_start.
    // Detects teacher no-show by checking room_events for a teacher participant_joined
    // event. Marks both demo_requests and the rooms row as cancelled.
    await db.query(`
      UPDATE demo_requests dr
      SET status = 'cancelled', updated_at = NOW(),
          outcome = COALESCE(outcome, 'teacher_no_show')
      WHERE dr.status IN ('accepted', 'live')
        AND dr.scheduled_start IS NOT NULL
        AND dr.scheduled_start < NOW() - INTERVAL '24 hours'
        AND dr.room_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM room_events re
          WHERE re.room_id = dr.room_id
            AND re.event_type = 'participant_joined'
            AND re.payload::text ILIKE '%teacher%'
        )
    `).catch(() => {});
    // Also cancel the corresponding rooms row so the join page shows 'cancelled'
    await db.query(`
      UPDATE rooms r SET status = 'cancelled', updated_at = NOW()
      FROM demo_requests dr
      WHERE r.room_id = dr.room_id
        AND dr.status = 'cancelled'
        AND dr.outcome = 'teacher_no_show'
        AND r.status IN ('scheduled', 'live')
    `).catch(() => {});

    let query = `
      SELECT dr.*,
             der.score        AS exam_score,
             der.total_marks  AS exam_total_marks,
             der.percentage   AS exam_percentage,
             der.grade_letter AS exam_grade,
             der.answered     AS exam_answered,
             der.skipped      AS exam_skipped,
             der.time_taken_seconds AS exam_time_taken,
             sf.rating        AS feedback_rating,
             sf.feedback_text AS feedback_text,
             sf.tags          AS feedback_tags
      FROM demo_requests dr
      LEFT JOIN demo_exam_results der ON der.id = dr.exam_result_id
      LEFT JOIN student_feedback sf ON sf.room_id = dr.room_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (user.role === 'teacher') {
      params.push(user.id);
      conditions.push(`dr.teacher_email = $${params.length}`);
    } else if (!['academic_operator', 'owner', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    if (status) {
      params.push(status);
      conditions.push(`dr.status = $${params.length}`);
    }
    if (teacherEmail && user.role !== 'teacher') {
      params.push(teacherEmail);
      conditions.push(`dr.teacher_email = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY dr.created_at DESC LIMIT 100';

    const result = await db.query(query, params);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('[demo/requests GET] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/demo/requests
 * AO generates a new demo link.
 * Body: {} (empty — just creates a link)
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    if (!['academic_operator', 'owner', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Generate a short unique link ID (clean hex, no prefix — route is already /demo/)
    const linkId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const result = await db.query(
      `INSERT INTO demo_requests (demo_link_id, ao_email, status, expires_at, created_at, updated_at)
       VALUES ($1, $2, 'link_created', $3, NOW(), NOW())
       RETURNING *`,
      [linkId, user.id, expiresAt.toISOString()]
    );

    const demoUrl = `${BASE_URL}/demo/${linkId}`;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...result.rows[0],
        demo_url: demoUrl,
      },
      message: 'Demo link generated',
    }, { status: 201 });
  } catch (err) {
    console.error('[demo/requests POST] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/demo/requests
 * Teacher accepts or rejects a demo request.
 * Body: { request_id, action: 'accept' | 'reject', note?, scheduled_start? }
 *
 * On accept:
 *   1. Creates a room (30 min demo)
 *   2. Creates room_assignments for teacher + student
 *   3. Generates LiveKit tokens
 *   4. Sends email to student with join link
 *   5. Updates demo_requests status to 'accepted'
 */
export async function PATCH(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }

    const body = await request.json();
    const { request_id, action, note, scheduled_start, teacher_email: assignTeacherEmail } = body as {
      request_id: string;
      action: 'accept' | 'reject' | 'cancel' | 'assign_teacher';
      note?: string;
      scheduled_start?: string;
      teacher_email?: string;
    };

    if (!request_id || !action) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing request_id or action' }, { status: 400 });
    }

    // Fetch the demo request
    const reqResult = await db.query('SELECT * FROM demo_requests WHERE id = $1', [request_id]);
    if (reqResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo request not found' }, { status: 404 });
    }
    const demoReq = reqResult.rows[0] as Record<string, unknown>;

    // ── CANCEL (AO action) ──
    if (action === 'cancel') {
      if (!['academic_operator', 'owner', 'batch_coordinator'].includes(user.role)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Only AO/owner can cancel' }, { status: 403 });
      }
      // Guard: cannot cancel completed or already-cancelled demos
      const currentStatus = demoReq.status as string;
      if (['completed', 'cancelled'].includes(currentStatus)) {
        return NextResponse.json<ApiResponse>({ success: false, error: `Cannot cancel a ${currentStatus} demo` }, { status: 400 });
      }
      await db.query(
        `UPDATE demo_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [request_id]
      );

      // Notify student if they had already registered
      const cancelStudentEmail = demoReq.student_email as string | null;
      if (cancelStudentEmail) {
        try {
          const { demoStudentRejectedTemplate } = await import('@/lib/email-templates');
          const { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } = await import('@/lib/email');
          const content = demoStudentRejectedTemplate({
            studentName: (demoReq.student_name as string) || 'Student',
            subject: (demoReq.subject as string) || 'Demo Session',
            reason: note || undefined,
            recipientEmail: cancelStudentEmail,
          });
          const logId = await logEmailQueued(null, cancelStudentEmail, 'demo_cancelled', content.subject);
          const emailResult = await sendEmail({
            to: cancelStudentEmail, subject: content.subject, html: content.html, text: content.text, priority: 'normal',
            waTemplate: 'stibe_alert',
            waParams: [
              (demoReq.student_name as string) || 'Student',
              `Your demo session request for ${(demoReq.subject as string) || 'our subject'} could not be accommodated at this time. Our team will contact you to reschedule.`,
            ],
            recipientPhone: (demoReq.student_phone as string) || undefined,
          });
          if (emailResult.success) await logEmailSent(logId, emailResult.messageId);
          else await logEmailFailed(logId, emailResult.error || 'Unknown');
        } catch (notifErr) {
          console.error('[demo/cancel] Failed to send student notification:', notifErr);
        }
      }

      return NextResponse.json<ApiResponse>({ success: true, message: 'Demo request cancelled' });
    }

    // ── ASSIGN TEACHER (AO action for submitted/rejected/pending_teacher demos) ──
    if (action === 'assign_teacher') {
      if (!['academic_operator', 'owner'].includes(user.role)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Only AO/owner can assign teachers' }, { status: 403 });
      }
      const currentStatus = demoReq.status as string;
      if (!['submitted', 'rejected', 'pending_teacher'].includes(currentStatus)) {
        return NextResponse.json<ApiResponse>({ success: false, error: `Cannot assign teacher for ${currentStatus} demo` }, { status: 400 });
      }
      if (!assignTeacherEmail) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Missing teacher_email' }, { status: 400 });
      }
      // Validate teacher exists and is active
      const teacherResult = await db.query(
        `SELECT email, full_name FROM portal_users WHERE email = $1 AND portal_role = 'teacher' AND is_active = true`,
        [assignTeacherEmail]
      );
      if (teacherResult.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Teacher not found or inactive' }, { status: 404 });
      }
      const teacher = teacherResult.rows[0] as { email: string; full_name: string };

      await db.query(
        `UPDATE demo_requests
         SET teacher_email = $2, teacher_name = $3, status = 'pending_teacher',
             teacher_responded_at = NULL, teacher_note = NULL, updated_at = NOW()
         WHERE id = $1`,
        [request_id, teacher.email, teacher.full_name]
      );

      // Notify the new teacher
      try {
        const { demoTeacherRequestTemplate } = await import('@/lib/email-templates');
        const { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } = await import('@/lib/email');
        const content = demoTeacherRequestTemplate({
          teacherName: teacher.full_name,
          studentName: (demoReq.student_name as string) || 'Student',
          studentGrade: (demoReq.student_grade as string) || '',
          subject: (demoReq.subject as string) || 'Demo Session',
          portions: (demoReq.portions as string) || 'Not specified',
          recipientEmail: teacher.email,
        });
        const logId = await logEmailQueued(null, teacher.email, 'demo_teacher_request', content.subject);
        const emailResult = await sendEmail({
          to: teacher.email, subject: content.subject, html: content.html, text: content.text, priority: 'high',
          waTemplate: 'stibe_demo_req',
          waParams: [teacher.full_name, (demoReq.student_name as string) || 'Student', (demoReq.student_grade as string) || '', `${(demoReq.subject as string) || 'Demo'} — ${(demoReq.portions as string) || 'Not specified'}`],
        });
        if (emailResult.success) await logEmailSent(logId, emailResult.messageId);
        else await logEmailFailed(logId, emailResult.error || 'Unknown');
      } catch (notifErr) {
        console.error('[demo/assign_teacher] Failed to send teacher notification:', notifErr);
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        message: `Teacher ${teacher.full_name} assigned and notified`,
        data: { status: 'pending_teacher', teacher_email: teacher.email, teacher_name: teacher.full_name },
      });
    }

    // ── TEACHER actions ──
    if (user.role !== 'teacher' && !['academic_operator', 'owner'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Only teachers can accept/reject' }, { status: 403 });
    }

    if (demoReq.status !== 'pending_teacher') {
      return NextResponse.json<ApiResponse>({ success: false, error: `Cannot ${action} request in status: ${demoReq.status}` }, { status: 400 });
    }

    if (user.role === 'teacher' && demoReq.teacher_email !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not your request to review' }, { status: 403 });
    }

    // ── REJECT ──
    if (action === 'reject') {
      await db.query(
        `UPDATE demo_requests SET status = 'rejected', teacher_responded_at = NOW(), teacher_note = $2, updated_at = NOW() WHERE id = $1`,
        [request_id, note || null]
      );

      // Notify student
      const rejectStudentEmail = demoReq.student_email as string | null;
      if (rejectStudentEmail) {
        try {
          const { demoStudentRejectedTemplate } = await import('@/lib/email-templates');
          const { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } = await import('@/lib/email');
          const content = demoStudentRejectedTemplate({
            studentName: (demoReq.student_name as string) || 'Student',
            subject: (demoReq.subject as string) || 'Demo Session',
            reason: note || undefined,
            recipientEmail: rejectStudentEmail,
          });
          const logId = await logEmailQueued(null, rejectStudentEmail, 'demo_rejected', content.subject);
          const emailResult = await sendEmail({
            to: rejectStudentEmail, subject: content.subject, html: content.html, text: content.text, priority: 'normal',
            waTemplate: 'stibe_alert',
            waParams: [
              (demoReq.student_name as string) || 'Student',
              `Your demo session request for ${(demoReq.subject as string) || 'our subject'} could not be accommodated at this time. Our team will contact you to reschedule.`,
            ],
            recipientPhone: (demoReq.student_phone as string) || undefined,
          });
          if (emailResult.success) await logEmailSent(logId, emailResult.messageId);
          else await logEmailFailed(logId, emailResult.error || 'Unknown');
        } catch (notifErr) {
          console.error('[demo/reject] Failed to send student notification:', notifErr);
        }
      }

      return NextResponse.json<ApiResponse>({ success: true, message: 'Demo request rejected', data: { status: 'rejected' } });
    }

    // ── ACCEPT ──
    if (action === 'accept') {
      const schedStart = scheduled_start ? new Date(scheduled_start) : new Date(Date.now() + 10 * 60 * 1000); // default: 10 min from now
      const durationMinutes = Number(demoReq.duration_minutes) || 30;
      const roomId = 'demo_' + crypto.randomUUID().slice(0, 12);
      const roomName = `Demo: ${demoReq.subject || 'Session'} — ${demoReq.student_name || 'Student'}`;
      const openAt = new Date(schedStart.getTime() - 10 * 60 * 1000); // 10 min before
      const expiresAt = new Date(schedStart.getTime() + durationMinutes * 60 * 1000 + 15 * 60 * 1000); // +15 min buffer

      // Agent info (optional — only present for CRM-originated demos)
      const agentEmail = demoReq.agent_email as string | null;
      const agentName = demoReq.agent_name as string || 'Sales Agent';
      const hasAgent = !!agentEmail;
      const maxParticipants = hasAgent ? 3 : 2;

      // Import livekit functions
      const { ensureRoom, createLiveKitToken } = await import('@/lib/livekit');

      // 1. Create room in DB
      await db.query(
        `INSERT INTO rooms (room_id, room_name, teacher_email, subject, grade, status, scheduled_start, duration_minutes, open_at, expires_at, batch_type, max_participants, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, 'one_to_one', $10, $11, NOW(), NOW())`,
        [roomId, roomName, demoReq.teacher_email, demoReq.subject || null, demoReq.student_grade || null,
         schedStart.toISOString(), durationMinutes, openAt.toISOString(), expiresAt.toISOString(), maxParticipants, user.id]
      );

      // 2. Ensure LiveKit room
      await ensureRoom(roomId, JSON.stringify({
        room_name: roomName,
        portal_room_id: roomId,
        is_demo: true,
      }));

      // 3. Generate tokens
      const teacherEmail = demoReq.teacher_email as string;
      const teacherName = demoReq.teacher_name as string || 'Teacher';
      const studentEmail = demoReq.student_email as string;
      const studentName = demoReq.student_name as string || 'Student';

      const teacherToken = await createLiveKitToken({
        roomName: roomId,
        participantIdentity: `teacher_${teacherEmail}`,
        participantName: teacherName,
        role: 'teacher',
        metadata: JSON.stringify({ is_demo: true }),
      });

      // Short join code for student — stored in DB for identity lookup, no JWT needed
      const studentJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);

      // 4. Create room_assignments (payment exempt for demo)
      await db.query(
        `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, join_token, payment_status)
         VALUES ($1, 'teacher', $2, $3, $4, 'exempt'),
                ($1, 'student', $5, $6, $7, 'exempt')`,
        [roomId, teacherEmail, teacherName, teacherToken, studentEmail, studentName, studentJoinCode]
      );

      // 4b. Agent room assignment (if CRM agent is assigned)
      let agentJoinCode: string | null = null;
      if (hasAgent) {
        agentJoinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
        await db.query(
          `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, join_token, payment_status)
           VALUES ($1, 'demo_agent', $2, $3, $4, 'exempt')`,
          [roomId, agentEmail, agentName, agentJoinCode]
        );
      }

      // 5. Log room event
      await db.query(
        `INSERT INTO room_events (room_id, event_type, participant_email, payload)
         VALUES ($1, 'room_created', $2, $3)`,
        [roomId, user.id, JSON.stringify({ is_demo: true, demo_request_id: request_id })]
      );

      // 6. Update demo_requests
      await db.query(
        `UPDATE demo_requests
         SET status = 'accepted', room_id = $2, scheduled_start = $3,
             teacher_responded_at = NOW(), teacher_note = $4, updated_at = NOW()
         WHERE id = $1`,
        [request_id, roomId, schedStart.toISOString(), note || null]
      );

      // 7. Send email to student
      const { demoStudentAcceptedTemplate } = await import('@/lib/email-templates');
      const { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } = await import('@/lib/email');

      // Read back actual stored token from DB to guarantee URL matches what was stored
      const storedStudentRow = await db.query<{ join_token: string }>(
        `SELECT join_token FROM room_assignments WHERE room_id = $1 AND participant_type = 'student' LIMIT 1`,
        [roomId],
      );
      const actualStudentJoinCode = storedStudentRow.rows[0]?.join_token || studentJoinCode;

      const joinUrl = `${BASE_URL}/join/${roomId}?token=${actualStudentJoinCode}`;
      const content = demoStudentAcceptedTemplate({
        studentName,
        teacherName,
        subject: (demoReq.subject as string) || 'Demo Session',
        scheduledStart: schedStart.toISOString(),
        joinLink: joinUrl,
        durationMinutes,
        recipientEmail: studentEmail,
      });

      const logId = await logEmailQueued(roomId, studentEmail, 'demo_accepted', content.subject);
      const studentPhone = demoReq.student_phone as string | null;
      const emailResult = await sendEmail({
        to: studentEmail, subject: content.subject, html: content.html, text: content.text, priority: 'high',
        waTemplate: 'stibe_demo_confirm',
        waParams: [studentName, (demoReq.subject as string) || 'Demo Session', teacherName, schedStart.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }), joinUrl],
        recipientPhone: studentPhone || undefined,
      });
      if (emailResult.success) await logEmailSent(logId, emailResult.messageId);
      else await logEmailFailed(logId, emailResult.error || 'Unknown');

      // 8. Notify AO that teacher accepted
      const aoEmail = demoReq.ao_email as string | null;
      if (aoEmail) {
        try {
          const { demoAOAcceptedTemplate } = await import('@/lib/email-templates');
          const aoContent = demoAOAcceptedTemplate({
            teacherName,
            studentName,
            subject: (demoReq.subject as string) || 'Demo Session',
            studentGrade: (demoReq.student_grade as string) || '',
            scheduledStart: schedStart.toISOString(),
            durationMinutes,
            recipientEmail: aoEmail,
          });
          const aoLogId = await logEmailQueued(roomId, aoEmail, 'demo_ao_accepted', aoContent.subject);
          const aoResult = await sendEmail({
            to: aoEmail, subject: aoContent.subject, html: aoContent.html, text: aoContent.text, priority: 'normal',
            waTemplate: 'stibe_alert',
            waParams: [
              'Academic Operator',
              `Demo accepted! ${teacherName} will teach ${studentName} (${(demoReq.subject as string) || 'Demo'}) on ${schedStart.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}.`,
            ],
          });
          if (aoResult.success) await logEmailSent(aoLogId, aoResult.messageId);
          else await logEmailFailed(aoLogId, aoResult.error || 'Unknown');
        } catch (aoErr) {
          console.error('[demo/accept] AO notification failed:', aoErr);
        }
      }

      // 9. Notify agent if assigned
      if (hasAgent && agentEmail && agentJoinCode) {
        try {
          const { demoAgentJoinTemplate } = await import('@/lib/email-templates');
          const agentJoinUrl = `${BASE_URL}/join/${roomId}?token=${agentJoinCode}`;
          const agentContent = demoAgentJoinTemplate({
            agentName,
            teacherName,
            studentName,
            subject: (demoReq.subject as string) || 'Demo Session',
            scheduledStart: schedStart.toISOString(),
            joinLink: agentJoinUrl,
            durationMinutes,
            recipientEmail: agentEmail,
          });
          const agentLogId = await logEmailQueued(roomId, agentEmail, 'demo_agent_join', agentContent.subject);
          const agentPhone = demoReq.agent_phone as string | null;
          const agentResult = await sendEmail({
            to: agentEmail, subject: agentContent.subject, html: agentContent.html, text: agentContent.text, priority: 'high',
            waTemplate: 'stibe_alert',
            waParams: [agentName, `Demo session scheduled! Join as sales agent: ${agentJoinUrl}`],
            recipientPhone: agentPhone || undefined,
          });
          if (agentResult.success) await logEmailSent(agentLogId, agentResult.messageId);
          else await logEmailFailed(agentLogId, agentResult.error || 'Unknown');
        } catch (agentErr) {
          console.error('[demo/accept] Agent notification failed:', agentErr);
        }
      }

      // Notify CRM if this demo was created from CRM
      const crmLeadId = demoReq.crm_lead_id as string | null;
      const crmTenantId = demoReq.crm_tenant_id as string | null;
      if (crmLeadId && crmTenantId) {
        import('@/lib/crm-webhook').then(({ notifyCRM }) =>
          notifyCRM({
            event: 'demo_scheduled',
            crm_lead_id: crmLeadId,
            crm_tenant_id: crmTenantId,
            demo_request_id: request_id,
            scheduled_start: schedStart.toISOString(),
            teacher_name: teacherName,
          })
        ).catch(e => console.error('[demo/accept] CRM webhook error:', e));
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'Demo accepted — room created, student & AO notified',
        data: {
          status: 'accepted',
          room_id: roomId,
          room_name: roomName,
          scheduled_start: schedStart.toISOString(),
        },
      });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[demo/requests PATCH] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/demo/requests
 * Bulk-delete demo requests by IDs.
 * Body: { ids: string[] }
 * Only AO / owner / batch_coordinator can delete.
 * Deletes associated demo_exam_results first (FK constraint).
 */
export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });
    }
    if (!['academic_operator', 'owner', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const ids = body.ids as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing ids array' }, { status: 400 });
    }
    if (ids.length > 50) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Max 50 at a time' }, { status: 400 });
    }

    // Build parameterized placeholders
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');

    // Collect room_ids from these demo requests (for cascade cleanup)
    const roomResult = await db.query(
      `SELECT room_id FROM demo_requests WHERE id IN (${placeholders}) AND room_id IS NOT NULL`,
      ids
    );
    const roomIds = roomResult.rows.map((r: Record<string, unknown>) => r.room_id as string).filter(Boolean);

    // Cascade: clean up room-related records
    if (roomIds.length > 0) {
      const rPlaceholders = roomIds.map((_, i) => `$${i + 1}`).join(', ');
      await db.query(`DELETE FROM room_events WHERE room_id IN (${rPlaceholders})`, roomIds).catch(e =>
        console.warn('[demo/delete] room_events cleanup warning:', e)
      );
      await db.query(`DELETE FROM room_assignments WHERE room_id IN (${rPlaceholders})`, roomIds).catch(e =>
        console.warn('[demo/delete] room_assignments cleanup warning:', e)
      );
      await db.query(`DELETE FROM student_feedback WHERE room_id IN (${rPlaceholders})`, roomIds).catch(e =>
        console.warn('[demo/delete] student_feedback cleanup warning:', e)
      );
      await db.query(`DELETE FROM attendance_sessions WHERE room_id IN (${rPlaceholders})`, roomIds).catch(e =>
        console.warn('[demo/delete] attendance_sessions cleanup warning:', e)
      );
      await db.query(`DELETE FROM class_monitoring_events WHERE room_id IN (${rPlaceholders})`, roomIds).catch(e =>
        console.warn('[demo/delete] monitoring_events cleanup warning:', e)
      );
      await db.query(`DELETE FROM monitoring_alerts WHERE room_id IN (${rPlaceholders})`, roomIds).catch(e =>
        console.warn('[demo/delete] monitoring_alerts cleanup warning:', e)
      );
      await db.query(`DELETE FROM rooms WHERE room_id IN (${rPlaceholders})`, roomIds).catch(e =>
        console.warn('[demo/delete] rooms cleanup warning:', e)
      );
    }

    // Delete exam results (FK)
    await db.query(
      `DELETE FROM demo_exam_results WHERE demo_request_id IN (${placeholders})`,
      ids
    );

    // Delete the demo requests
    const result = await db.query(
      `DELETE FROM demo_requests WHERE id IN (${placeholders}) RETURNING id`,
      ids
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Deleted ${result.rowCount} demo request(s)`,
      data: { deleted: result.rowCount },
    });
  } catch (err) {
    console.error('[demo/requests DELETE] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}