// ═══════════════════════════════════════════════════════════════
// Owner — Teachers Overview API
// GET /api/v1/owner/teachers
// Returns all teachers with stats: classes, attendance, schedule
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'owner')
      return NextResponse.json<ApiResponse>({ success: false, error: 'Forbidden' }, { status: 403 });

    // 1. All teachers from portal_users + profiles
    const teachersRes = await db.query(`
      SELECT u.email, u.full_name, u.is_active, u.last_login_at, u.created_at,
             u.profile_image,
             up.phone, up.whatsapp, up.subjects, up.qualification,
             up.experience_years, up.assigned_region
      FROM portal_users u
      LEFT JOIN user_profiles up ON up.email = u.email
      WHERE u.portal_role = 'teacher'
      ORDER BY u.full_name ASC
    `);

    // 2. Per-teacher class stats
    const statsRes = await db.query(`
      SELECT r.teacher_email,
             COUNT(*)::int AS total_classes,
             COUNT(*) FILTER (WHERE r.status = 'live')::int AS live_classes,
             COUNT(*) FILTER (WHERE r.status = 'scheduled' AND r.scheduled_start > NOW())::int AS upcoming_classes,
             COUNT(*) FILTER (WHERE r.status = 'ended' OR (r.status = 'scheduled' AND r.scheduled_start + r.duration_minutes * INTERVAL '1 minute' < NOW()))::int AS completed_classes,
             COUNT(*) FILTER (WHERE r.status = 'cancelled')::int AS cancelled_classes,
             COUNT(*) FILTER (WHERE DATE(r.scheduled_start AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata') AND r.status != 'cancelled')::int AS today_classes
      FROM rooms r
      WHERE r.teacher_email IS NOT NULL
      GROUP BY r.teacher_email
    `);

    // 3. Teacher-initiated cancellation requests (pending)
    const cancelRes = await db.query(`
      SELECT cr.requested_by, COUNT(*)::int AS pending_cancellations
      FROM cancellation_requests cr
      WHERE cr.requester_role = 'teacher'
        AND cr.status NOT IN ('approved', 'rejected')
      GROUP BY cr.requested_by
    `);

    // Build lookup maps
    const statsMap: Record<string, Record<string, number>> = {};
    for (const row of statsRes.rows) {
      statsMap[row.teacher_email as string] = row as Record<string, number>;
    }
    const cancelMap: Record<string, number> = {};
    for (const row of cancelRes.rows) {
      cancelMap[row.requested_by as string] = row.pending_cancellations as number;
    }

    // Merge
    const teachers = teachersRes.rows.map((t: Record<string, unknown>) => {
      const email = t.email as string;
      const stats = statsMap[email] || {};
      return {
        email,
        name: t.full_name,
        profile_image: t.profile_image ?? null,
        is_active: t.is_active,
        last_login_at: t.last_login_at,
        created_at: t.created_at,
        phone: t.phone,
        whatsapp: t.whatsapp,
        subjects: t.subjects,
        qualification: t.qualification,
        experience_years: t.experience_years,
        assigned_region: t.assigned_region,
        total_classes: stats.total_classes || 0,
        live_classes: stats.live_classes || 0,
        upcoming_classes: stats.upcoming_classes || 0,
        completed_classes: stats.completed_classes || 0,
        cancelled_classes: stats.cancelled_classes || 0,
        today_classes: stats.today_classes || 0,
        pending_cancellations: cancelMap[email] || 0,
      };
    });

    // Summary
    const summary = {
      total_teachers: teachers.length,
      active_teachers: teachers.filter((t: Record<string, unknown>) => t.is_active).length,
      teaching_today: teachers.filter((t: Record<string, unknown>) => (t.today_classes as number) > 0).length,
      total_live_classes: teachers.reduce((sum: number, t: Record<string, unknown>) => sum + (t.live_classes as number), 0),
      total_pending_cancellations: teachers.reduce((sum: number, t: Record<string, unknown>) => sum + (t.pending_cancellations as number), 0),
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { teachers, summary },
    });
  } catch (err) {
    console.error('[owner/teachers] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
