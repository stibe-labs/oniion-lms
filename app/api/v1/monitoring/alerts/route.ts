// ═══════════════════════════════════════════════════════════════
// Monitoring Alerts API — GET /api/v1/monitoring/alerts
// POST /api/v1/monitoring/alerts (dismiss)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getActiveAlerts, getAlertHistory, dismissAlert } from '@/lib/monitoring';

const ALLOWED_ROLES = ['batch_coordinator', 'academic_operator', 'owner', 'teacher'];

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') || 'active'; // 'active' or 'history'
  const room_id = url.searchParams.get('room_id') || undefined;
  const batch_id = url.searchParams.get('batch_id') || undefined;
  const alert_type = url.searchParams.get('alert_type') || undefined;
  const target_email = url.searchParams.get('target_email') || undefined;
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  try {
    if (mode === 'history') {
      const result = await getAlertHistory({ room_id, batch_id, alert_type, target_email, limit, offset });
      return NextResponse.json({ success: true, data: result });
    }

    const role = user.role as 'batch_coordinator' | 'academic_operator';
    const alerts = await getActiveAlerts({
      role: ['batch_coordinator', 'academic_operator'].includes(role) ? role : 'batch_coordinator',
      caller_email: user.id,
      room_id,
      batch_id,
      target_email,
      limit,
    });

    return NextResponse.json({ success: true, data: { alerts } });
  } catch (err) {
    console.error('Monitoring alerts error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, alert_id } = await req.json();

    if (action === 'dismiss' && alert_id) {
      const dismissed = await dismissAlert(alert_id, user.id);
      return NextResponse.json({ success: dismissed, message: dismissed ? 'Alert dismissed' : 'Alert not found or already dismissed' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Alert action error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
