// ═══════════════════════════════════════════════════════════════
// Teacher Live Salary API — /api/v1/teacher/salary-live
// Real-time salary calculation for current month from rooms data
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getTeacherLiveSalary } from '@/lib/payroll';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || user.role !== 'teacher') {
      return NextResponse.json({ success: false, error: 'Teacher access only' }, { status: 403 });
    }

    const data = await getTeacherLiveSalary(user.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[teacher/salary-live] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
