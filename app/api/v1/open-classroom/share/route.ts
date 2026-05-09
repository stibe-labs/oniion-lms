import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp';
import type { ApiResponse } from '@/types';

/**
 * POST /api/v1/open-classroom/share — Bulk WhatsApp share open classroom links
 * Body: { classroom_id, recipients: [{ name, phone, email? }] }
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
    const classroomId = body.classroom_id as string;
    const recipients = body.recipients as Array<{ name: string; phone: string; email?: string }>;

    if (!classroomId || !recipients?.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'classroom_id and recipients are required' }, { status: 400 });
    }

    const confRes = await db.query(
      `SELECT oc.*, pu.full_name AS teacher_name, pu.portal_role AS teacher_role
       FROM open_classrooms oc
       LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
       WHERE oc.id = $1`,
      [classroomId]
    );
    if (confRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Classroom not found' }, { status: 404 });
    }

    const oc = confRes.rows[0];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';

    let timeInfo = '';
    if (oc.classroom_type === 'scheduled' && oc.scheduled_at) {
      const dt = new Date(String(oc.scheduled_at));
      timeInfo = `\n📅 ${dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })} at ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`;
      if (oc.duration_minutes) timeInfo += ` (${oc.duration_minutes} min)`;
    }

    const rawTeacherName = oc.teacher_name || 'our teacher';
    const teacherName = oc.teacher_role === 'owner'
      ? `Chairman ${rawTeacherName}`
      : rawTeacherName;
    const pricePaise = Number(oc.price_paise) || 0;
    const paymentInfo = oc.payment_enabled && pricePaise > 0
      ? `\n💰 Entry Fee: ₹${(pricePaise / 100).toFixed(0)}`
      : '\n🆓 Free entry';

    const results: Array<{ name: string; phone: string; success: boolean; error?: string }> = [];

    for (const r of recipients) {
      const phone = r.phone.startsWith('+') ? r.phone : `+${r.phone}`;

      // Insert share record
      let shareId: string | null = null;
      try {
        const shareRes = await db.query(
          `INSERT INTO open_classroom_shares (classroom_id, name, phone, email)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [classroomId, r.name, phone, r.email || null]
        );
        shareId = String(shareRes.rows[0]?.id || '');
      } catch { /* continue */ }

      const sidParam = shareId ? `?sid=${shareId}` : '';
      const link = `${baseUrl}/open-classroom/${oc.join_token}${sidParam}`;

      const message = `You're invited to an Open Classroom *${oc.title}* with ${teacherName}.${timeInfo}${paymentInfo}\n\n🔗 Join here: ${link}`;

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
    console.error('[open-classroom/share]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
