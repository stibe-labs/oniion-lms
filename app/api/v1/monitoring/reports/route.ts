// ═══════════════════════════════════════════════════════════════
// Monitoring Reports API
// GET  /api/v1/monitoring/reports   — List reports
// POST /api/v1/monitoring/reports   — Generate report
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import {
  listMonitoringReports,
  generateStudentReport,
  generateTeacherReport,
  type ReportType,
  type ReportPeriod,
} from '@/lib/monitoring-reports';

const ALLOWED_ROLES = ['batch_coordinator', 'academic_operator', 'owner', 'teacher'];

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const report_type = (url.searchParams.get('report_type') || undefined) as ReportType | undefined;
  const report_period = (url.searchParams.get('report_period') || undefined) as ReportPeriod | undefined;
  const target_email = url.searchParams.get('target_email') || undefined;
  const target_role = (url.searchParams.get('target_role') || undefined) as 'student' | 'teacher' | undefined;
  const batch_id = url.searchParams.get('batch_id') || undefined;
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  try {
    const result = await listMonitoringReports({
      report_type,
      report_period,
      target_email,
      target_role,
      batch_id,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('Report listing error:', err);
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
    const body = await req.json();
    const { target_email, target_role, period, period_start, period_end, batch_id } = body as {
      target_email: string;
      target_role: 'student' | 'teacher';
      period: ReportPeriod;
      period_start: string;
      period_end: string;
      batch_id?: string;
    };

    if (!target_email || !target_role || !period || !period_start || !period_end) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: target_email, target_role, period, period_start, period_end',
      }, { status: 400 });
    }

    let reportId: string;
    if (target_role === 'student') {
      reportId = await generateStudentReport({
        student_email: target_email,
        period,
        period_start,
        period_end,
        batch_id,
      });
    } else {
      reportId = await generateTeacherReport({
        teacher_email: target_email,
        period,
        period_start,
        period_end,
      });
    }

    return NextResponse.json({
      success: true,
      data: { report_id: reportId },
      message: `${target_role} ${period} report generated successfully`,
    });
  } catch (err) {
    console.error('Report generation error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
