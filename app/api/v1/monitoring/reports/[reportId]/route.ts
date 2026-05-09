// ═══════════════════════════════════════════════════════════════
// Monitoring Report Detail API — GET /api/v1/monitoring/reports/[reportId]
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getMonitoringReport } from '@/lib/monitoring-reports';

const ALLOWED_ROLES = ['batch_coordinator', 'academic_operator', 'owner', 'parent'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { reportId } = await params;
    const report = await getMonitoringReport(reportId);

    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    // Parents can only see their children's monthly reports
    if (user.role === 'parent') {
      if (report.report_period !== 'monthly' || report.target_role !== 'student') {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    console.error('Report detail error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
