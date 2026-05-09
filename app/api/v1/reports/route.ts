// ═══════════════════════════════════════════════════════════════
// Reports API — /api/v1/reports
// Generate and retrieve reports
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { generateReport, getReports, getReport, type ReportType } from '@/lib/reports';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'hr', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(req.url);
    const reportId = url.searchParams.get('id');

    if (reportId) {
      const report = await getReport(reportId);
      if (!report) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: report });
    }

    const reports = await getReports({
      reportType: url.searchParams.get('type') || undefined,
      limit: Number(url.searchParams.get('limit')) || 50,
    });

    return NextResponse.json({ success: true, data: { reports } });
  } catch (err) {
    console.error('[reports] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'hr', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Owner/HR/Academic only' }, { status: 403 });
    }

    const body = await req.json();
    const { reportType, periodStart, periodEnd, filters } = body;

    if (!reportType || !periodStart || !periodEnd) {
      return NextResponse.json({
        success: false,
        error: 'reportType, periodStart, periodEnd required',
      }, { status: 400 });
    }

    const validTypes: ReportType[] = [
      'attendance', 'revenue', 'teacher_performance',
      'student_progress', 'batch_summary', 'exam_analytics', 'payroll_summary',
      'session_report', 'parent_monthly', 'daily_business', 'weekly_sales',
    ];
    if (!validTypes.includes(reportType)) {
      return NextResponse.json({
        success: false,
        error: `Invalid report type. Valid: ${validTypes.join(', ')}`,
      }, { status: 400 });
    }

    const report = await generateReport(reportType, periodStart, periodEnd, user.id, filters);
    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    console.error('[reports] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
