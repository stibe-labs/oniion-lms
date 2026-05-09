// ═══════════════════════════════════════════════════════════════
// Session Monitoring API — GET /api/v1/monitoring/session/[roomId]
// Live monitoring data for a specific room/session
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { resolveRoomId } from '@/lib/db';
import { getSessionMonitoringSummary, getTeacherAlerts } from '@/lib/monitoring';

const ALLOWED_ROLES = ['batch_coordinator', 'academic_operator', 'owner', 'teacher', 'ghost'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = await params;
    const actualRoomId = await resolveRoomId(roomId);
    const summary = await getSessionMonitoringSummary(actualRoomId);

    // Teachers only see their own alerts, not full student details
    if (user.role === 'teacher') {
      const teacherAlerts = await getTeacherAlerts(actualRoomId);
      return NextResponse.json({
        success: true,
        data: {
          room_id: actualRoomId,
          class_engagement_score: summary.class_engagement_score,
          student_count: summary.students.length,
          alerts: teacherAlerts,
          // Provide attention scores per student but not full details
          students: summary.students.map((s) => ({
            email: s.email,
            name: s.name,
            attention_score: s.attention_score,
            current_state: s.current_state,
            active_alerts: s.active_alerts,
          })),
        },
      });
    }

    // Coordinators and AO get full data
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    console.error('Session monitoring error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
