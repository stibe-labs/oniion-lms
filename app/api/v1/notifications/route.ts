// ═══════════════════════════════════════════════════════════════
// Notifications API — WhatsApp + general notifications
// POST: Send notifications
// GET: List sent notifications
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import {
  sendWhatsApp, sendClassReminders, sendPaymentReminders,
  getNotificationLogs, type TemplateName,
} from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'batch_coordinator', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Owner/Batch Coordinator only' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // Bulk class reminders
    if (action === 'class_reminders') {
      const { roomId } = body;
      if (!roomId) return NextResponse.json({ success: false, error: 'roomId required' }, { status: 400 });
      const result = await sendClassReminders(roomId);
      return NextResponse.json({ success: true, data: result });
    }

    // Bulk payment reminders
    if (action === 'payment_reminders') {
      const result = await sendPaymentReminders();
      return NextResponse.json({ success: true, data: result });
    }

    // Single notification
    if (action === 'send') {
      const { to, template, templateData, recipientEmail } = body;
      if (!to || !template) {
        return NextResponse.json({ success: false, error: 'to, template required' }, { status: 400 });
      }
      const result = await sendWhatsApp({
        to,
        template: template as TemplateName,
        templateData: templateData || {},
        recipientEmail,
      });
      return NextResponse.json({ success: result.success, data: result });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[notifications] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'batch_coordinator', 'academic_operator', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(req.url);
    const logs = await getNotificationLogs({
      channel: url.searchParams.get('channel') || undefined,
      recipient: url.searchParams.get('recipient') || undefined,
      limit: Number(url.searchParams.get('limit')) || 100,
    });

    return NextResponse.json({ success: true, data: { logs } });
  } catch (err) {
    console.error('[notifications] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
