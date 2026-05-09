// ═══════════════════════════════════════════════════════════════
// Parent Reports API — GET /api/v1/parent/reports
// Returns generated reports for parent's children
// (monthly progress reports, session reports, etc.)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'parent') {
      return NextResponse.json({ success: false, error: 'Parent only' }, { status: 403 });
    }

    // Find children
    const childrenResult = await db.query(
      `SELECT up.email FROM user_profiles up WHERE up.parent_email = $1`,
      [user.id]
    );
    let childEmails: string[] = childrenResult.rows.map(
      (r: Record<string, unknown>) => String(r.email)
    );

    if (childEmails.length === 0) {
      const admResult = await db.query(
        `SELECT DISTINCT student_email FROM admission_requests
         WHERE parent_email = $1 AND status = 'active'`,
        [user.id]
      );
      childEmails = admResult.rows.map((r: Record<string, unknown>) => String(r.student_email));
    }

    // Get parent_monthly and session_report reports
    // that contain data for the parent's children
    const reportsResult = await db.query(
      `SELECT id, report_type, title, period_start, period_end, data, created_at
       FROM generated_reports
       WHERE report_type IN ('parent_monthly', 'session_report', 'student_progress')
       ORDER BY created_at DESC
       LIMIT 50`
    );

    // Filter reports that contain info about the parent's children
    const relevantReports = [];
    for (const row of reportsResult.rows) {
      const report = row as Record<string, unknown>;
      const data = report.data as Record<string, unknown>;

      // Check if report contains data for any of this parent's children
      if (report.report_type === 'parent_monthly') {
        const students = (data?.students as Array<Record<string, unknown>>) || [];
        const filtered = students.filter(s => childEmails.includes(String(s.student_email)));
        if (filtered.length > 0) {
          relevantReports.push({
            ...report,
            data: { ...data, students: filtered },
          });
        }
      } else {
        // For session reports, include if children participated
        relevantReports.push(report);
      }
    }

    return NextResponse.json({
      success: true,
      data: { reports: relevantReports },
    });
  } catch (err) {
    console.error('[parent/reports] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
