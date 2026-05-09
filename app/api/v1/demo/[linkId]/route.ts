import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { ELIGIBLE_GRADES, ENROLLMENT_BOARDS, STUDENT_REGIONS } from '@/lib/enrollment-fee';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';

/**
 * GET /api/v1/demo/[linkId]
 * Public — no auth required. Fetches demo link info for the registration page.
 * Returns: link status, available subjects (from free teachers for 2 hours), sample portions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const { linkId } = await params;

    const linkResult = await db.query(
      `SELECT * FROM demo_requests WHERE demo_link_id = $1`,
      [linkId]
    );
    if (linkResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo link not found' }, { status: 404 });
    }

    const demo = linkResult.rows[0] as Record<string, unknown>;

    // Check expiry
    if (demo.expires_at && new Date(demo.expires_at as string) < new Date()) {
      await db.query(`UPDATE demo_requests SET status = 'expired', updated_at = NOW() WHERE id = $1`, [demo.id]);
      return NextResponse.json<ApiResponse>({ success: false, error: 'This demo link has expired' }, { status: 410 });
    }

    // If already submitted/used, return status info
    if (demo.status !== 'link_created') {
      // For CRM-scheduled (accepted) demos: return extra details for confirmation page
      const responseData: Record<string, unknown> = {
        status: demo.status,
        student_name: demo.student_name,
        subject: demo.subject,
        message: demo.status === 'submitted' ? 'Your registration is being processed. We will email you soon!'
          : demo.status === 'pending_teacher' ? 'We are confirming teacher availability. You will receive an email shortly.'
          : demo.status === 'accepted' ? 'Your demo session has been scheduled! Check your email for the join link.'
          : demo.status === 'completed' ? 'This demo session has ended. Thank you for attending!'
          : demo.status === 'live' ? 'Your demo session is currently in progress. Check your email for the join link.'
          : demo.status === 'cancelled' ? 'This demo session has been cancelled.'
          : demo.status === 'rejected' ? 'Unfortunately, no teacher is available at this time. Please try again later.'
          : `Current status: ${demo.status}`,
      };

      // For accepted demos, include schedule details
      if (demo.status === 'accepted' && demo.scheduled_start) {
        responseData.teacher_name = demo.teacher_name;
        responseData.scheduled_start = demo.scheduled_start;
        responseData.duration_minutes = demo.duration_minutes;
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: responseData,
      });
    }

    // Link is fresh — return form data for registration
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Count available teachers (for "X teachers available now" badge)
    const roomConflicts = await db.query(
      `SELECT DISTINCT teacher_email FROM rooms
       WHERE status IN ('scheduled', 'live') AND teacher_email IS NOT NULL
         AND scheduled_start < $1
         AND (scheduled_start + (duration_minutes || ' minutes')::interval) > $2`,
      [windowEnd.toISOString(), now.toISOString()]
    );
    const busyTeachers = new Set(roomConflicts.rows.map((r: Record<string, unknown>) => r.teacher_email));

    const bsConflicts = await db.query(
      `SELECT DISTINCT teacher_email FROM batch_sessions
       WHERE status IN ('scheduled', 'live') AND teacher_email IS NOT NULL
         AND (scheduled_date + start_time) < $1::timestamptz
         AND (scheduled_date + start_time + (duration_minutes || ' minutes')::interval) > $2::timestamptz`,
      [windowEnd.toISOString(), now.toISOString()]
    );
    bsConflicts.rows.forEach((r: Record<string, unknown>) => busyTeachers.add(r.teacher_email as string));

    const allTeachers = await db.query(
      `SELECT email FROM portal_users WHERE portal_role = 'teacher' AND is_active = true`,
    );
    const availableCount = (allTeachers.rows as { email: string }[]).filter(t => !busyTeachers.has(t.email)).length;

    const grades = ELIGIBLE_GRADES;
    const boards = ENROLLMENT_BOARDS;
    const regions = STUDENT_REGIONS;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        status: 'link_created',
        grades,
        boards,
        regions,
        available_teacher_count: availableCount,
        // Pre-fill data from CRM (if created via external API)
        prefill_name: (demo.student_name as string) || undefined,
        prefill_phone: (demo.student_phone as string) || undefined,
        prefill_email: (demo.student_email as string) || undefined,
        prefill_grade: (demo.student_grade as string) || undefined,
      },
    });
  } catch (err) {
    console.error('[demo/[linkId] GET] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/demo/[linkId]
 * Public — student registers for a demo session.
 * Body: { student_email, student_name, student_phone, student_grade, subject, portions, sample_portions? }
 *
 * On submit:
 *   1. Updates demo_requests with student info → status 'submitted'
 *   2. Matches a free teacher for that subject
 *   3. Sets status to 'pending_teacher'
 *   4. Sends email to teacher
 *   5. Sends confirmation email to student
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const { linkId } = await params;

    // Validate link
    const linkResult = await db.query(
      `SELECT * FROM demo_requests WHERE demo_link_id = $1`,
      [linkId]
    );
    if (linkResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo link not found' }, { status: 404 });
    }
    const demo = linkResult.rows[0] as Record<string, unknown>;

    if (demo.status !== 'link_created') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'This link has already been used' }, { status: 400 });
    }
    if (demo.expires_at && new Date(demo.expires_at as string) < new Date()) {
      await db.query(`UPDATE demo_requests SET status = 'expired', updated_at = NOW() WHERE id = $1`, [demo.id]);
      return NextResponse.json<ApiResponse>({ success: false, error: 'This demo link has expired' }, { status: 410 });
    }

    const body = await request.json();
    const { student_email, student_name, student_phone, student_grade, student_board, student_region } = body as {
      student_email: string;
      student_name: string;
      student_phone: string;
      student_grade: string;
      student_board?: string;
      student_region?: string;
    };

    if (!student_email || !student_name || !student_phone || !student_grade) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: student_email, student_name, student_phone, student_grade',
      }, { status: 400 });
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student_email)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    // Phone validation (Indian format)
    const cleanPhone = student_phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid phone number' }, { status: 400 });
    }

    // Find a free teacher (any subject, 2-hour window)
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const roomConflicts = await db.query(
      `SELECT DISTINCT teacher_email FROM rooms
       WHERE status IN ('scheduled', 'live') AND teacher_email IS NOT NULL
         AND scheduled_start < $1
         AND (scheduled_start + (duration_minutes || ' minutes')::interval) > $2`,
      [windowEnd.toISOString(), now.toISOString()]
    );
    const busyTeachers = new Set(roomConflicts.rows.map((r: Record<string, unknown>) => r.teacher_email));

    const bsConflicts = await db.query(
      `SELECT DISTINCT teacher_email FROM batch_sessions
       WHERE status IN ('scheduled', 'live') AND teacher_email IS NOT NULL
         AND (scheduled_date + start_time) < $1::timestamptz
         AND (scheduled_date + start_time + (duration_minutes || ' minutes')::interval) > $2::timestamptz`,
      [windowEnd.toISOString(), now.toISOString()]
    );
    bsConflicts.rows.forEach((r: Record<string, unknown>) => busyTeachers.add(r.teacher_email as string));

    // Find any available teacher
    const matchResult = await db.query(
      `SELECT pu.email, pu.full_name
       FROM portal_users pu
       WHERE pu.portal_role = 'teacher' AND pu.is_active = true
       ORDER BY pu.full_name`,
    );
    const matchedTeacher = (matchResult.rows as { email: string; full_name: string }[])
      .find(t => !busyTeachers.has(t.email));

    // Update demo request with student info
    if (matchedTeacher) {
      const updateResult = await db.query(
        `UPDATE demo_requests
         SET student_email = $2, student_name = $3, student_phone = $4, student_grade = $5,
             teacher_email = $6, teacher_name = $7,
             student_board = $8, student_region = $9,
             status = 'pending_teacher', updated_at = NOW()
         WHERE id = $1 AND status = 'link_created'
         RETURNING id`,
        [demo.id, student_email, student_name, cleanPhone, student_grade,
         matchedTeacher.email, matchedTeacher.full_name,
         student_board || null, student_region || null]
      );
      if (updateResult.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'This link has already been used' }, { status: 409 });
      }

      // Send email to teacher
      const { demoTeacherRequestTemplate } = await import('@/lib/email-templates');
      const { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } = await import('@/lib/email');

      const content = demoTeacherRequestTemplate({
        teacherName: matchedTeacher.full_name,
        studentName: student_name,
        studentGrade: student_grade,
        subject: 'Demo Session',
        portions: 'To be decided with student',
        recipientEmail: matchedTeacher.email,
      });

      const logId = await logEmailQueued(null, matchedTeacher.email, 'demo_teacher_request', content.subject);
      const emailResult = await sendEmail({
        to: matchedTeacher.email, subject: content.subject, html: content.html, text: content.text, priority: 'high',
        waTemplate: 'stibe_demo_req',
        waParams: [matchedTeacher.full_name, student_name, student_grade, 'Demo Session'],
      });
      if (emailResult.success) await logEmailSent(logId, emailResult.messageId);
      else await logEmailFailed(logId, emailResult.error || 'Unknown');

    } else {
      const updateResult = await db.query(
        `UPDATE demo_requests
         SET student_email = $2, student_name = $3, student_phone = $4, student_grade = $5,
             student_board = $6, student_region = $7,
             status = 'submitted', updated_at = NOW()
         WHERE id = $1 AND status = 'link_created'
         RETURNING id`,
        [demo.id, student_email, student_name, cleanPhone, student_grade,
         student_board || null, student_region || null]
      );
      if (updateResult.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'This link has already been used' }, { status: 409 });
      }

      // Notify AO/owner
      try {
        const { sendEmail: sendAO } = await import('@/lib/email');
        const aoResult = await db.query(
          `SELECT email, full_name FROM portal_users WHERE portal_role IN ('owner', 'academic_operator') AND is_active = true LIMIT 3`
        );
        for (const ao of aoResult.rows as { email: string; full_name: string }[]) {
          sendAO({
            to: ao.email,
            subject: `⚠️ Demo: No teacher available for ${student_name}`,
            html: `<p>Hi ${ao.full_name},</p>
              <p>A student registered for a demo but <strong>no teacher was auto-matched</strong>.</p>
              <ul>
                <li><strong>Student:</strong> ${student_name} (${student_email})</li>
                <li><strong>Grade:</strong> ${student_grade}</li>
                <li><strong>Phone:</strong> ${cleanPhone}</li>
              </ul>
              <p>Please go to the <a href="${BASE_URL}/academic-operator#demo">Demo tab</a> and manually assign a teacher.</p>`,
            text: `Demo: No teacher auto-matched for ${student_name} (Grade ${student_grade}). Please assign manually at ${BASE_URL}/academic-operator#demo`,
            priority: 'high',
            waTemplate: 'stibe_alert',
            waParams: [ao.full_name, `Demo registration from ${student_name} (Grade ${student_grade}) needs manual teacher assignment. Please check the Demo tab.`],
          }).catch(e => console.warn('[demo/submit] AO notification error:', e));
        }
      } catch (e) {
        console.warn('[demo/submit] Failed to notify AO:', e);
      }
    }

    // Send confirmation email to student
    const { demoStudentSearchingTemplate } = await import('@/lib/email-templates');
    const { sendEmail: send, logEmailQueued: logQ, logEmailSent: logS, logEmailFailed: logF } = await import('@/lib/email');
    
    const studentContent = demoStudentSearchingTemplate({
      studentName: student_name,
      subject: 'Demo Session',
      recipientEmail: student_email,
    });

    const sLogId = await logQ(null, student_email, 'demo_student_searching', studentContent.subject);
    const sResult = await send({
      to: student_email, subject: studentContent.subject, html: studentContent.html, text: studentContent.text, priority: 'normal',
      waTemplate: 'stibe_demo_waiting',
      waParams: [student_name, 'Demo Session'],
      recipientPhone: cleanPhone,
    });
    if (sResult.success) await logS(sLogId, sResult.messageId);
    else await logF(sLogId, sResult.error || 'Unknown');

    // Notify CRM if this demo was created from CRM
    const crmLeadId = demo.crm_lead_id as string | null;
    const crmTenantId = demo.crm_tenant_id as string | null;
    if (crmLeadId && crmTenantId) {
      import('@/lib/crm-webhook').then(({ notifyCRM }) =>
        notifyCRM({
          event: 'demo_registered',
          crm_lead_id: crmLeadId,
          crm_tenant_id: crmTenantId,
          demo_request_id: demo.id as string,
          student_name,
          student_email,
          student_phone: cleanPhone,
          student_grade,
          student_board: student_board || undefined,
          student_region: student_region || undefined,
        })
      ).catch(e => console.error('[demo/register] CRM webhook error:', e));
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: matchedTeacher
        ? 'Registration complete! We are confirming teacher availability and will email you shortly.'
        : 'Registration complete! We are searching for an available teacher and will email you soon.',
      data: {
        status: matchedTeacher ? 'pending_teacher' : 'submitted',
        teacher_found: !!matchedTeacher,
      },
    });
  } catch (err) {
    console.error('[demo/[linkId] POST] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
