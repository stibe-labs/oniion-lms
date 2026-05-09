import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import type { ApiResponse } from '@/types';

/**
 * GET /api/v1/room/[room_id]/exams — upcoming exams for this room's batch/subject
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { room_id } = await params;

    // Get upcoming published exams assigned to this room OR matching the room's subject+grade
    const result = await db.query(
      `SELECT DISTINCT e.id, e.title, e.subject, e.grade, e.exam_type,
              e.duration_minutes, e.total_marks, e.scheduled_at, e.ends_at
       FROM exams e
       LEFT JOIN exam_batch_assignments eba ON eba.exam_id = e.id
       LEFT JOIN rooms r ON r.room_id = $1
       WHERE e.published = true
         AND e.scheduled_at > NOW()
         AND (eba.room_id = $1 OR (e.subject = r.subject AND e.grade = r.grade))
       ORDER BY e.scheduled_at ASC
       LIMIT 5`,
      [room_id],
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { exams: result.rows },
    });
  } catch (err) {
    console.error('[room-exams] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
