import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp';
import type { ApiResponse } from '@/types';

/**
 * POST /api/v1/conference/share — Bulk WhatsApp share conference links
 * Body: {
 *   conference_id: string,
 *   link_type: 'admin' | 'user',
 *   recipients: Array<{ name: string; phone: string; email?: string }>
 * }
 */

const ALLOWED_ROLES = ['owner', 'academic_operator', 'academic'];

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const conferenceId = body.conference_id as string;
    const linkType = body.link_type as 'admin' | 'user';
    const recipients = body.recipients as Array<{ name: string; phone: string; email?: string }>;

    if (!conferenceId || !linkType || !recipients?.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'conference_id, link_type, and recipients are required' }, { status: 400 });
    }

    // Fetch conference
    const confRes = await db.query(
      `SELECT id, title, admin_token, user_token, scheduled_at, duration_minutes, conference_type
       FROM conferences WHERE id = $1`,
      [conferenceId]
    );
    if (confRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conference not found' }, { status: 404 });
    }

    const conf = confRes.rows[0];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';
    const confToken = linkType === 'admin' ? conf.admin_token : conf.user_token;

    // Build message
    let timeInfo = '';
    if (conf.conference_type === 'scheduled' && conf.scheduled_at) {
      const dt = new Date(String(conf.scheduled_at));
      timeInfo = `\n📅 ${dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })} at ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`;
      if (conf.duration_minutes) timeInfo += ` (${conf.duration_minutes} min)`;
    }

    const roleLbl = linkType === 'admin' ? 'Host' : 'Participant';

    // Send to each recipient with a unique personalized link
    const results: Array<{ name: string; phone: string; success: boolean; error?: string }> = [];

    for (const r of recipients) {
      const phone = r.phone.startsWith('+') ? r.phone : `+${r.phone}`;

      // Insert share record first to get unique ID for personalized link
      let shareId: string | null = null;
      try {
        const shareRes = await db.query(
          `INSERT INTO conference_shares (conference_id, name, phone, email, link_type)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [conferenceId, r.name, phone, r.email || null, linkType]
        );
        shareId = String(shareRes.rows[0]?.id || '');
      } catch { /* continue without personalized link */ }

      // Build personalized link with sid for auto name
      const sidParam = shareId ? `sid=${shareId}` : '';
      const link = linkType === 'admin'
        ? `${baseUrl}/conference/${confToken}?role=admin${sidParam ? `&${sidParam}` : ''}`
        : `${baseUrl}/conference/${confToken}${sidParam ? `?${sidParam}` : ''}`;

      const message = `You're invited to join the conference *${conf.title}* as ${roleLbl}.${timeInfo}\n\n🔗 Join here: ${link}`;

      try {
        const res = await sendWhatsApp({
          to: phone,
          template: 'general',
          templateData: { recipientName: r.name, message },
          recipientEmail: r.email,
        });
        results.push({ name: r.name, phone: r.phone, success: res.success, error: res.error });
      } catch (err) {
        results.push({ name: r.name, phone: r.phone, success: false, error: String(err) });
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { sent, failed, total: results.length, results },
    });
  } catch (err) {
    console.error('[conference/share]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
