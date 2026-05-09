import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * POST /api/v1/external/invite-teacher
 * Called by Stibe CRM when agent selects a specific teacher to invite for a demo.
 * Auth: X-API-Key header.
 *
 * Creates a single demo_invitation for the given teacher and sends WhatsApp.
 * The teacher clicks the link → /demo-invite/{token} → picks their time.
 *
 * Body: { demo_request_id, teacher_email, crm_lead_id?, crm_tenant_id?, subject?, agent_name? }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { demo_request_id, teacher_email, crm_lead_id, subject, agent_name } = body as {
      demo_request_id?: string;
      teacher_email?: string;
      crm_lead_id?: string;
      subject?: string;
      agent_name?: string;
    };

    if (!teacher_email) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing teacher_email' }, { status: 400 });
    }
    if (!demo_request_id && !crm_lead_id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing demo_request_id or crm_lead_id' }, { status: 400 });
    }

    // Fetch demo_request
    let demoRow = demo_request_id
      ? await db.query(
          `SELECT id, status, student_name, student_grade, subject as demo_subject
           FROM demo_requests WHERE id = $1`,
          [demo_request_id],
        )
      : { rows: [] };

    if (demoRow.rows.length === 0 && crm_lead_id) {
      demoRow = await db.query(
        `SELECT id, status, student_name, student_grade, subject as demo_subject
         FROM demo_requests WHERE crm_lead_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [crm_lead_id],
      );
    }

    if (demoRow.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo request not found' }, { status: 404 });
    }

    const demo = demoRow.rows[0] as {
      id: string;
      status: string;
      student_name: string;
      student_grade: string | null;
      demo_subject: string | null;
    };

    if (demo.status === 'accepted') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo already accepted by a teacher' }, { status: 409 });
    }

    // Fetch teacher profile
    const teacherResult = await db.query(
      `SELECT pu.email, pu.full_name, up.phone
       FROM portal_users pu
       LEFT JOIN user_profiles up ON up.email = pu.email
       WHERE pu.email = $1 AND pu.portal_role = 'teacher' AND pu.is_active = true`,
      [teacher_email],
    );

    if (teacherResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Teacher not found or inactive' }, { status: 404 });
    }

    const teacher = teacherResult.rows[0] as {
      email: string;
      full_name: string;
      phone: string | null;
    };

    const resolvedSubject = subject || demo.demo_subject || 'the subject';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);

    // Expire any existing pending invitation for THIS teacher for this demo (idempotent re-invite)
    await db.query(
      `UPDATE demo_invitations SET status = 'expired'
       WHERE demo_request_id = $1 AND teacher_email = $2 AND status = 'pending'`,
      [demo.id, teacher_email],
    );

    // Create new invitation
    await db.query(
      `INSERT INTO demo_invitations (demo_request_id, teacher_email, invite_token, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [demo.id, teacher_email, token, expiresAt.toISOString()],
    );

    // Send WhatsApp
    const gradeStr = demo.student_grade ? `Grade ${demo.student_grade}` : 'N/A';
    const acceptUrl = `${BASE_URL}/demo-invite/${token}`;
    const phone = teacher.phone;

    let sent = false;
    if (phone) {
      try {
        const inviteMsg = `You have a demo class request for ${demo.student_name} (${gradeStr}) — Subject: ${resolvedSubject}. Click to accept your preferred time: ${acceptUrl}`;
        await fireWhatsApp(
          teacher.email,
          inviteMsg,
          undefined,
          'stibe_alert',
          [teacher.full_name, inviteMsg],
          undefined,
        );
        sent = true;
      } catch (e) {
        console.error(`[invite-teacher] WA failed for ${teacher_email}:`, e);
      }
    }

    const callerLabel = agent_name ? ` by ${agent_name}` : '';
    console.log(`[external/invite-teacher] demo ${demo.id} → ${teacher.full_name} (${teacher_email}) invited${callerLabel}, WA ${sent ? 'sent' : 'skipped (no phone)'}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        demo_request_id: demo.id,
        teacher_email,
        teacher_name: teacher.full_name,
        sent_count: sent ? 1 : 0,
        phone_missing: !phone,
      },
      message: sent
        ? `Invitation sent to ${teacher.full_name} via WhatsApp`
        : `Invitation created for ${teacher.full_name} (no phone on file)`,
    }, { status: 201 });
  } catch (err) {
    console.error('[external/invite-teacher] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
