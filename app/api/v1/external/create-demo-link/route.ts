import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';
import { getPlatformName } from '@/lib/platform-config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * POST /api/v1/external/create-demo-link
 * External API (called by Stibe CRM) to create a demo link and send WhatsApp.
 * Auth: X-API-Key header.
 * Creates a link_created demo_request, sends WhatsApp to student with registration URL.
 * After student registers, CRM calls /api/v1/external/schedule-demo to assign teacher.
 */
export async function POST(request: NextRequest) {
  try {
    // API key auth
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const {
      crm_lead_id,
      crm_tenant_id,
      student_name,
      student_phone,
      student_email,
      student_grade,
      agent_email,
      agent_name,
      agent_phone,
      resend_demo_link_id,
    } = body as {
      crm_lead_id?: string;
      crm_tenant_id?: string;
      student_name?: string;
      student_phone?: string;
      student_email?: string;
      student_grade?: string;
      agent_email?: string;
      agent_name?: string;
      agent_phone?: string;
      resend_demo_link_id?: string;
    };

    if (!crm_lead_id || !crm_tenant_id || !student_name || !student_phone) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: crm_lead_id, crm_tenant_id, student_name, student_phone' },
        { status: 400 },
      );
    }

    const cleanPhone = student_phone.replace(/\D/g, '');
    const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    // ── Resend existing demo link ──
    if (resend_demo_link_id) {
      const existing = await db.query(
        `SELECT id, demo_link_id FROM demo_requests WHERE demo_link_id = $1 LIMIT 1`,
        [resend_demo_link_id],
      );

      let linkId: string;
      let requestId: string;

      if (existing.rows.length > 0) {
        // Found existing record — reuse same link
        const row = existing.rows[0] as { id: string; demo_link_id: string };
        linkId = row.demo_link_id;
        requestId = row.id;
      } else {
        // Original record gone (expired/cleaned) — create a fresh one
        linkId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        const ins = await db.query(
          `INSERT INTO demo_requests (
            demo_link_id, ao_email, status, expires_at,
            student_name, student_phone, student_email, student_grade,
            crm_lead_id, crm_tenant_id,
            agent_email, agent_name, agent_phone,
            created_at, updated_at
          ) VALUES ($1, 'crm-integration', 'link_created', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING id, demo_link_id`,
          [linkId, expiresAt.toISOString(), student_name, student_phone,
           student_email || null, student_grade || null, crm_lead_id, crm_tenant_id,
           agent_email || null, agent_name || null, agent_phone || null],
        );
        requestId = (ins.rows[0] as { id: string }).id;
        console.log(`[external/create-demo-link] RESEND fallback: old link ${resend_demo_link_id} not found — created new link ${linkId}`);
      }

      const demoUrl = `${BASE_URL}/demo/${linkId}`;

      const platformName = await getPlatformName();
      await fireWhatsApp(
        `wa_crm_demo_resend_${linkId}_${Date.now()}`,
        `🎓 *${platformName} Classes — Free Demo Session*\n\nHi ${student_name}! Here's your demo class registration link:\n${demoUrl}\n\nRegister to join a free 30-minute live class with a qualified teacher. No obligations!\n\n— ${platformName} Classes`,
        undefined,
        'stibe_alert',
        [student_name, `Here's your demo link: ${demoUrl}`],
        normalizedPhone,
      );

      console.log(`[external/create-demo-link] RESEND CRM lead ${crm_lead_id} → demo link ${linkId} → WA sent to ${normalizedPhone}`);

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          demo_link_id: linkId,
          demo_url: demoUrl,
          demo_request_id: requestId,
        },
        message: 'Demo link resent via WhatsApp',
      });
    }

    // ── Create new demo link ──
    const linkId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);

    // Create demo_request and send registration link
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const result = await db.query(
      `INSERT INTO demo_requests (
        demo_link_id, ao_email, status, expires_at,
        student_name, student_phone, student_email, student_grade,
        crm_lead_id, crm_tenant_id,
        agent_email, agent_name, agent_phone,
        created_at, updated_at
      ) VALUES ($1, 'crm-integration', 'link_created', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id, demo_link_id`,
      [linkId, expiresAt.toISOString(), student_name, student_phone,
       student_email || null, student_grade || null, crm_lead_id, crm_tenant_id,
       agent_email || null, agent_name || null, agent_phone || null],
    );

    const demoRequest = result.rows[0] as { id: string; demo_link_id: string };
    const demoUrl = `${BASE_URL}/demo/${linkId}`;

    const platformNameNew = await getPlatformName();
    await fireWhatsApp(
      `wa_crm_demo_${linkId}`,
      `🎓 *${platformNameNew} Classes — Free Demo Session*\n\nHi ${student_name}! You've been invited to a free 30-minute live demo class.\n\nRegister here to get started:\n${demoUrl}\n\nYou'll experience a real interactive class with a qualified teacher. Completely free — no obligations!\n\n— ${platformNameNew} Classes`,
      undefined,
      'stibe_alert',
      [student_name, `You're invited to a free demo class at ${platformNameNew}! Register here: ${demoUrl}`],
      normalizedPhone,
    );

    console.log(`[external/create-demo-link] CRM lead ${crm_lead_id} → demo link ${linkId} → WA sent to ${normalizedPhone}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        demo_link_id: linkId,
        demo_url: demoUrl,
        demo_request_id: demoRequest.id,
      },
      message: 'Demo link created and WhatsApp sent',
    }, { status: 201 });
  } catch (err) {
    console.error('[external/create-demo-link] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
