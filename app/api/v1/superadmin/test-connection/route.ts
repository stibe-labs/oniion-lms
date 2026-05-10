import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { testLiveKitConnectivity } from '@/lib/livekit';
import { getIntegrationConfig } from '@/lib/integration-config';

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const service = req.nextUrl.searchParams.get('service');

  if (service === 'livekit') {
    try {
      const result = await testLiveKitConnectivity();
      const passed = result.steps.filter(s => s.pass).length;
      const failed = result.steps.filter(s => !s.pass);
      if (result.reachable) {
        return NextResponse.json({ success: true, message: `Connected — ${passed}/${result.steps.length} checks passed` });
      }
      const firstFail = failed[0];
      return NextResponse.json({ success: false, message: `${firstFail?.name}: ${firstFail?.error || 'failed'}` });
    } catch (err) {
      return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Connection failed' });
    }
  }

  if (service === 'email') {
    try {
      const cfg = await getIntegrationConfig();
      const { smtpHost, smtpPort, smtpUser, smtpPass } = cfg.email;
      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json({ success: false, message: 'SMTP not configured (missing host, user, or password)' });
      }
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: cfg.email.smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
      });
      await transporter.verify();
      return NextResponse.json({ success: true, message: `SMTP verified — ${smtpHost}:${smtpPort}` });
    } catch (err) {
      return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'SMTP connection failed' });
    }
  }

  if (service === 'whatsapp') {
    try {
      const cfg = await getIntegrationConfig();
      const { apiToken, phoneNumberId } = cfg.whatsapp;
      if (!apiToken || !phoneNumberId) {
        return NextResponse.json({ success: false, message: 'WhatsApp not configured (missing token or phone ID)' });
      }
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        return NextResponse.json({ success: false, message: err?.error?.message || `HTTP ${res.status}` });
      }
      const data = await res.json();
      return NextResponse.json({ success: true, message: `Connected — ${data.display_phone_number || phoneNumberId}` });
    } catch (err) {
      return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'WhatsApp API unreachable' });
    }
  }

  return NextResponse.json({ success: false, error: 'Unknown service' }, { status: 400 });
}
