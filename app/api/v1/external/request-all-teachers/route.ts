import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * POST /api/v1/external/request-all-teachers
 * Called by Stibe CRM when agent clicks "Request All Teachers" for a demo.
 * Auth: X-API-Key header.
 *
 * For each active teacher, creates a demo_invitation row with a unique token
 * and sends a WhatsApp message with the acceptance link.
 * Teachers click the link → /demo-invite/{token} → see student info + time picker.
 *
 * Body: { demo_request_id, crm_lead_id, crm_tenant_id, subject?, agent_name? }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { demo_request_id, crm_lead_id, crm_tenant_id, subject, agent_name } = body as {
      demo_request_id?: string;
      crm_lead_id?: string;
      crm_tenant_id?: string;
      subject?: string;
      agent_name?: string;
    };

    if (!demo_request_id && !crm_lead_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing demo_request_id or crm_lead_id' },
        { status: 400 },
      );
    }

    // Fetch demo_request — by ID first, then by crm_lead_id
    let demoRow = demo_request_id
      ? await db.query(
          `SELECT id, status, student_name, student_grade, student_email, student_phone, subject as demo_subject
           FROM demo_requests WHERE id = $1`,
          [demo_request_id],
        )
      : { rows: [] };

    if (demoRow.rows.length === 0 && crm_lead_id) {
      demoRow = await db.query(
        `SELECT id, status, student_name, student_grade, student_email, student_phone, subject as demo_subject
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
      student_email: string | null;
      student_phone: string;
      demo_subject: string | null;
    };

    const resolvedSubject = subject || demo.demo_subject || 'the subject';
    const resolvedDemoId = demo.id;

    // Fetch all active teachers (with their phone numbers from user_profiles)
    const teacherResult = await db.query(
      `SELECT pu.email, pu.full_name, up.phone, up.subjects
       FROM portal_users pu
       LEFT JOIN user_profiles up ON up.email = pu.email
       WHERE pu.portal_role = 'teacher' AND pu.is_active = true
       ORDER BY pu.full_name`,
    );

    const teachers = teacherResult.rows as {
      email: string;
      full_name: string;
      phone: string | null;
      subjects: string[] | null;
    }[];

    if (teachers.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No active teachers found' }, { status: 404 });
    }

    // Expire any existing pending invitations for this demo_request (re-broadcast)
    await db.query(
      `UPDATE demo_invitations SET status = 'expired' WHERE demo_request_id = $1 AND status = 'pending'`,
      [resolvedDemoId],
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h window

    // Build invitation rows in a single transaction
    const invitations: { email: string; fullName: string; token: string; phone: string | null }[] = [];

    await db.withTransaction(async (client) => {
      for (const teacher of teachers) {
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        await client.query(
          `INSERT INTO demo_invitations (demo_request_id, teacher_email, invite_token, status, expires_at)
           VALUES ($1, $2, $3, 'pending', $4)
           ON CONFLICT (invite_token) DO NOTHING`,
          [resolvedDemoId, teacher.email, token, expiresAt.toISOString()],
        );
        const phone = teacher.phone;
        invitations.push({ email: teacher.email, fullName: teacher.full_name, token, phone });
      }
    });

    // Send WhatsApp to each teacher (fire-and-forget, do not block response)
    const gradeStr = demo.student_grade ? `Grade ${demo.student_grade}` : 'N/A';
    let sentCount = 0;
    const sendPromises = invitations.map(async (inv) => {
      if (!inv.phone) return; // No phone on file — skip
      const acceptUrl = `${BASE_URL}/demo-invite/${inv.token}`;
      try {
        await fireWhatsApp(
          inv.email,
          `Demo request for ${demo.student_name}`,
          undefined,
          'stibe_demo_invite',
          [inv.fullName, demo.student_name, gradeStr, resolvedSubject, acceptUrl],
          undefined,
        );
        sentCount++;
      } catch (e) {
        console.error(`[request-all-teachers] WA failed for ${inv.email}:`, e);
      }
    });

    // Wait for all WA sends (with a max 8s timeout per the HTTP request window)
    await Promise.allSettled(sendPromises);

    console.log(`[external/request-all-teachers] demo ${resolvedDemoId} → ${invitations.length} invitations created, ${sentCount} WA sent`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        demo_request_id: resolvedDemoId,
        invitation_count: invitations.length,
        sent_count: sentCount,
      },
      message: `Broadcast sent to ${invitations.length} teachers`,
    }, { status: 201 });
  } catch (err) {
    console.error('[external/request-all-teachers] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
