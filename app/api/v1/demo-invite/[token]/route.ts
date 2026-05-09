import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';

/**
 * GET /api/v1/demo-invite/[token]
 * Public route — returns invitation info for the teacher acceptance page.
 * Reveals only the info the teacher needs (student name/grade/subject + their own name).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const result = await db.query(
      `SELECT
          di.id, di.status, di.accepted_at, di.expires_at,
          di.teacher_email,
          pu.full_name AS teacher_name,
          dr.student_name, dr.student_grade, dr.subject AS demo_subject,
          dr.scheduled_start, dr.duration_minutes,
          -- Find who accepted (if expired taken by someone else)
          winner.full_name AS accepted_by_name
       FROM demo_invitations di
       JOIN portal_users pu ON pu.email = di.teacher_email
       JOIN demo_requests dr ON dr.id = di.demo_request_id
       LEFT JOIN demo_invitations winning_inv
           ON winning_inv.demo_request_id = di.demo_request_id
           AND winning_inv.status = 'accepted'
           AND winning_inv.teacher_email != di.teacher_email
       LEFT JOIN portal_users winner ON winner.email = winning_inv.teacher_email
       WHERE di.invite_token = $1`,
      [token],
    );

    if (result.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invitation not found or expired' }, { status: 404 });
    }

    const row = result.rows[0] as {
      id: string;
      status: string;
      accepted_at: Date | null;
      expires_at: Date;
      teacher_email: string;
      teacher_name: string;
      student_name: string;
      student_grade: string | null;
      demo_subject: string | null;
      scheduled_start: Date | null;
      duration_minutes: number | null;
      accepted_by_name: string | null;
    };

    // Auto-expire if past expires_at
    const now = new Date();
    if (row.status === 'pending' && new Date(row.expires_at) < now) {
      await db.query(`UPDATE demo_invitations SET status = 'expired' WHERE id = $1`, [row.id]);
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          status: 'expired',
          teacher_name: row.teacher_name,
          student_name: row.student_name,
          student_grade: row.student_grade,
          subject: row.demo_subject,
        },
      });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        status: row.status,
        teacher_name: row.teacher_name,
        student_name: row.student_name,
        student_grade: row.student_grade,
        subject: row.demo_subject,
        accepted_by_name: row.accepted_by_name || undefined,
        // Only sent back if this teacher themselves accepted
        scheduled_start: row.status === 'accepted' && !row.accepted_by_name
          ? row.scheduled_start?.toISOString()
          : undefined,
        duration_minutes: row.status === 'accepted' && !row.accepted_by_name
          ? row.duration_minutes
          : undefined,
      },
    });
  } catch (err) {
    console.error('[demo-invite/GET] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
