import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ApiResponse { success: boolean; data?: unknown; error?: string }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const name = request.nextUrl.searchParams.get('name')?.trim();

  if (!name) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Name required' }, { status: 400 });
  }

  try {
    // Find classroom by join_token
    const res = await db.query(
      `SELECT oc.id, oc.auto_approve_joins, oc.status
       FROM open_classrooms oc
       WHERE oc.join_token = $1 LIMIT 1`,
      [token]
    );
    if (res.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not found' }, { status: 404 });
    }
    const classroom = res.rows[0];

    // Check participant approval status
    const partRes = await db.query(
      `SELECT approval_status FROM open_classroom_participants
       WHERE classroom_id = $1 AND name = $2
       ORDER BY created_at DESC LIMIT 1`,
      [classroom.id, name]
    );

    const status = partRes.rows[0]?.approval_status || 'pending';

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        approval_status: status,
        classroom_status: classroom.status,
      },
    });
  } catch (err) {
    console.error('[join-status] error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Server error' }, { status: 500 });
  }
}
