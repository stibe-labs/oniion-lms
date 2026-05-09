import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';
import { getPlatformName } from '@/lib/platform-config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';

/**
 * POST /api/v1/demo/send-link
 * Sends a demo registration link to a WhatsApp number.
 * Body: { phone: string, demo_link_id: string }
 * Auth: AO / owner / batch_coordinator only.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !['academic_operator', 'owner', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { phone, demo_link_id } = body as { phone?: string; demo_link_id?: string };

    if (!phone || !demo_link_id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Missing phone or demo_link_id' }, { status: 400 });
    }

    // Validate phone: strip non-digits, check length
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid phone number' }, { status: 400 });
    }

    // Verify the demo link exists
    const result = await db.query(
      `SELECT id, demo_link_id, status FROM demo_requests WHERE demo_link_id = $1`,
      [demo_link_id],
    );
    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Demo link not found' }, { status: 404 });
    }

    const demoLink = `${BASE_URL}/demo/${demo_link_id}`;
    const platformName = await getPlatformName();
    const waMessage = `🎓 *${platformName} Classes — Free Demo Session*\n\nHi! You've been invited to a free 30-minute live demo class.\n\nRegister here to get started:\n${demoLink}\n\nYou'll experience a real interactive class with a qualified teacher. Completely free — no obligations!\n\n— ${platformName} Classes`;

    // Send WA via fireWhatsApp — uses stibe_alert template (works outside 24h window) + free-form fallback
    const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    await fireWhatsApp(
      `wa_demo_${demo_link_id}`,   // pseudo-email for logging
      waMessage,                    // free-form text fallback
      undefined,                    // no legacy email template type
      'stibe_alert',              // Meta-approved template (works outside 24h)
      ['Student', `You're invited to a free demo class at ${platformName}! Register here: ${demoLink}`],
      normalizedPhone,              // override phone — skip DB lookup
    );

    // Log the send
    console.log(`[demo/send-link] AO ${user.id} sent demo link ${demo_link_id} to ${normalizedPhone}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `Demo link sent to ${phone} via WhatsApp`,
    });
  } catch (err) {
    console.error('[demo/send-link] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
