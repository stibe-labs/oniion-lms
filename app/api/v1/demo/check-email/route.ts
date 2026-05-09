import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';

/**
 * GET /api/v1/demo/check-email?email=<email>
 * Public — no auth required. Checks whether an email is already in the system.
 *
 * Returns:
 *   - is_existing_student: true if the email belongs to an active student in portal_users
 *   - has_pending_demo: true if the email has an active (non-terminal) demo request
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // 1. Check if email belongs to an existing student in the system
    const studentResult = await db.query(
      `SELECT email, full_name, portal_role FROM portal_users
       WHERE email = $1 AND is_active = true
       LIMIT 1`,
      [email]
    );
    const isExistingStudent = studentResult.rows.length > 0;
    const existingRole = isExistingStudent
      ? (studentResult.rows[0] as { portal_role: string }).portal_role
      : null;

    // 2. Check if email has a pending/active demo request
    // Exclude 'link_created' — link exists but student hasn't registered yet
    const demoResult = await db.query(
      `SELECT id, status, subject, created_at FROM demo_requests
       WHERE student_email = $1
         AND status IN ('submitted', 'pending_teacher', 'accepted', 'live')
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );
    const hasPendingDemo = demoResult.rows.length > 0;
    const pendingDemoStatus = hasPendingDemo
      ? (demoResult.rows[0] as { status: string }).status
      : null;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        is_existing_student: isExistingStudent,
        existing_role: existingRole,
        has_pending_demo: hasPendingDemo,
        pending_demo_status: pendingDemoStatus,
      },
    });
  } catch (err) {
    console.error('[demo/check-email] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
