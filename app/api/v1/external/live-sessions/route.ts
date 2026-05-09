import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';

const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * GET /api/v1/external/live-sessions
 * External API (called by Stibe CRM) — returns currently live batch sessions
 * AND today's upcoming approved scheduled sessions (within next 6 hours).
 * Auth: X-API-Key header.
 *
 * Query params:
 *   subject — optional filter by subject (case-insensitive)
 *   grade   — optional filter by grade
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subjectFilter = searchParams.get('subject')?.trim().toLowerCase() || null;
    const gradeFilter = searchParams.get('grade')?.trim().toLowerCase() || null;

    // Query: live sessions UNION upcoming scheduled sessions (today, next 6 h)
    const result = await db.query(
      `SELECT
         bs.session_id,
         bs.subject,
         bs.teacher_email,
         bs.livekit_room_name,
         bs.scheduled_date,
         bs.start_time,
         bs.duration_minutes,
         bs.topic,
         bs.status AS session_status,
         b.batch_id,
         b.batch_name,
         COALESCE(b.grade, '') AS grade,
         pu.full_name AS teacher_name,
         rm.status AS room_status,
         bs.started_at AS room_started_at
       FROM batch_sessions bs
       LEFT JOIN batches b ON b.batch_id = bs.batch_id
       LEFT JOIN portal_users pu ON pu.email = bs.teacher_email
       LEFT JOIN rooms rm ON rm.room_id = bs.livekit_room_name
       WHERE
         -- Currently live
         ((bs.status = 'live' OR rm.status = 'live') AND bs.livekit_room_name IS NOT NULL)
         OR
         -- Upcoming scheduled today (starts within -30 min to +6 hours from now, not yet ended)
         (
           bs.status = 'scheduled'
           AND (bs.go_live_status IS NULL OR bs.go_live_status = '' OR bs.go_live_status = 'approved')
           AND (bs.scheduled_date::text || ' ' || bs.start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata'
               BETWEEN NOW() - INTERVAL '30 minutes' AND NOW() + INTERVAL '6 hours'
         )
       ORDER BY
         CASE WHEN bs.status = 'live' OR rm.status = 'live' THEN 0 ELSE 1 END,
         bs.scheduled_date ASC, bs.start_time ASC`,
      []
    );

    let rows = result.rows as Record<string, unknown>[];

    // Apply optional filters
    if (subjectFilter) {
      rows = rows.filter(s =>
        typeof s.subject === 'string' && s.subject.toLowerCase().includes(subjectFilter)
      );
    }
    if (gradeFilter) {
      rows = rows.filter(s =>
        typeof s.grade === 'string' && s.grade.toLowerCase().includes(gradeFilter)
      );
    }

    const now = Date.now();
    const mapped = rows.map(s => {
      const isLive = s.session_status === 'live' || s.room_status === 'live';
      const scheduledIso = `${String(s.scheduled_date).split('T')[0]}T${String(s.start_time)}+05:30`;
      const scheduledMs = new Date(scheduledIso).getTime();

      const startedAt = s.room_started_at
        ? new Date(String(s.room_started_at)).getTime()
        : scheduledMs;

      const elapsedMinutes = isLive ? Math.max(0, Math.floor((now - startedAt) / 60000)) : 0;
      const durationMin = Number(s.duration_minutes) || 60;
      const remainingMinutes = isLive ? Math.max(0, durationMin - elapsedMinutes) : durationMin;
      const minutesUntilStart = isLive ? 0 : Math.max(0, Math.ceil((scheduledMs - now) / 60000));

      return {
        session_id: s.session_id,
        subject: s.subject || 'General',
        teacher_name: s.teacher_name || 'Teacher',
        teacher_email: s.teacher_email,
        grade: s.grade || null,
        batch_name: s.batch_name || null,
        topic: s.topic || null,
        livekit_room_name: s.livekit_room_name || null,
        duration_minutes: durationMin,
        elapsed_minutes: elapsedMinutes,
        remaining_minutes: remainingMinutes,
        started_at: s.room_started_at || null,
        scheduled_at: scheduledIso,
        is_overtime: isLive && elapsedMinutes > durationMin,
        status: isLive ? 'live' : 'scheduled',
        minutes_until_start: minutesUntilStart,
      };
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { sessions: mapped, count: mapped.length },
    });
  } catch (err) {
    console.error('[external/live-sessions] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
