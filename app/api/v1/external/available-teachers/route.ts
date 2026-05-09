import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';

const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * GET /api/v1/external/available-teachers
 * External API (called by Stibe CRM) — returns all active teachers with schedule.
 * Auth: X-API-Key header.
 *
 * Query params:
 *   date    — ISO date string (default: today)
 *   hours   — lookahead window (default: 8, max: 24)
 *   subject — optional filter by subject
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const hours = Math.min(Number(searchParams.get('hours')) || 8, 24);
    const subject = searchParams.get('subject');
    const dateParam = searchParams.get('date');

    // Window: from dateParam start-of-day (IST) or now, to +hours
    const now = new Date();
    let windowStart = now;
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        // Use start of that date in IST (UTC+5:30)
        const istOffset = 5.5 * 60 * 60 * 1000;
        const startOfDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        windowStart = new Date(startOfDay.getTime() - istOffset); // convert IST to UTC
        if (windowStart < now) windowStart = now; // don't go into the past
      }
    }
    const windowEnd = new Date(windowStart.getTime() + hours * 60 * 60 * 1000);

    // Fetch all teachers
    let teacherQuery = `
      SELECT pu.email, pu.full_name, up.subjects, up.qualification
      FROM portal_users pu
      LEFT JOIN user_profiles up ON up.email = pu.email
      WHERE pu.portal_role = 'teacher' AND pu.is_active = true
    `;
    const teacherParams: unknown[] = [];
    if (subject) {
      teacherParams.push(subject);
      teacherQuery += ` AND $${teacherParams.length} = ANY(up.subjects)`;
    }
    teacherQuery += ` ORDER BY pu.full_name`;
    const teacherResult = await db.query(teacherQuery, teacherParams);
    const allTeachers = teacherResult.rows as { email: string; full_name: string; subjects: string[] | null; qualification: string | null }[];

    if (allTeachers.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true, data: { teachers: [] } });
    }

    const teacherEmails = allTeachers.map(t => t.email);

    // Room sessions in window (demo rooms have no batch_id)
    const roomSessions = await db.query(
      `SELECT teacher_email, scheduled_start, duration_minutes, status, room_name, batch_type, batch_id, subject
       FROM rooms
       WHERE teacher_email = ANY($1)
         AND status IN ('scheduled', 'live')
         AND (scheduled_start + (duration_minutes || ' minutes')::interval) > $2
         AND scheduled_start < $3
       ORDER BY scheduled_start`,
      [teacherEmails, windowStart.toISOString(), windowEnd.toISOString()],
    );

    // Batch sessions in window
    const batchSessions = await db.query(
      `SELECT bs.teacher_email, bs.scheduled_date, bs.start_time, bs.duration_minutes,
              bs.status, bs.subject, b.batch_name
       FROM batch_sessions bs
       LEFT JOIN batches b ON b.batch_id = bs.batch_id
       WHERE bs.teacher_email = ANY($1)
         AND bs.status IN ('scheduled', 'live')
         AND (bs.scheduled_date + bs.start_time + (bs.duration_minutes || ' minutes')::interval) > $2::timestamptz
         AND (bs.scheduled_date + bs.start_time) < $3::timestamptz
       ORDER BY bs.scheduled_date, bs.start_time`,
      [teacherEmails, windowStart.toISOString(), windowEnd.toISOString()],
    );

    // Build schedule map
    type SessionInfo = { room_name: string; start_time: string; end_time: string; subject: string; type: string; duration: number };
    const scheduleMap = new Map<string, SessionInfo[]>();

    for (const r of roomSessions.rows as { teacher_email: string; scheduled_start: string; duration_minutes: number; status: string; room_name: string | null; batch_type: string | null; batch_id: string | null; subject: string | null }[]) {
      const start = new Date(r.scheduled_start);
      const end = new Date(start.getTime() + (r.duration_minutes || 30) * 60000);
      const isDemo = !r.batch_id;
      const list = scheduleMap.get(r.teacher_email) || [];
      list.push({
        room_name: r.room_name || '',
        start_time: start.toISOString(), end_time: end.toISOString(),
        duration: r.duration_minutes || 30,
        type: isDemo ? 'demo' : 'session',
        subject: r.subject || (isDemo ? 'Demo' : 'Session'),
      });
      scheduleMap.set(r.teacher_email, list);
    }

    for (const bs of batchSessions.rows as { teacher_email: string; scheduled_date: string; start_time: string; duration_minutes: number; status: string; subject: string | null; batch_name: string | null }[]) {
      const start = new Date(`${bs.scheduled_date}T${bs.start_time}`);
      const end = new Date(start.getTime() + (bs.duration_minutes || 45) * 60000);
      const list = scheduleMap.get(bs.teacher_email) || [];
      list.push({
        room_name: bs.batch_name || '',
        start_time: start.toISOString(), end_time: end.toISOString(),
        duration: bs.duration_minutes || 45,
        type: 'batch',
        subject: bs.subject || 'Batch Session',
      });
      scheduleMap.set(bs.teacher_email, list);
    }

    // Build response
    const teachers = allTeachers.map(t => {
      const sessions = (scheduleMap.get(t.email) || []).sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );

      const currentSession = sessions.find(s => {
        const sStart = new Date(s.start_time).getTime();
        const sEnd = new Date(s.end_time).getTime();
        return sStart <= now.getTime() && sEnd > now.getTime();
      });
      const is_free = !currentSession;

      let free_after: string | null = null;
      if (currentSession) {
        let chainEnd = new Date(currentSession.end_time).getTime();
        for (const s of sessions) {
          const sStart = new Date(s.start_time).getTime();
          const sEnd = new Date(s.end_time).getTime();
          if (sStart <= chainEnd + 5 * 60000 && sEnd > chainEnd) chainEnd = sEnd;
        }
        free_after = new Date(chainEnd).toISOString();
      }

      return {
        email: t.email,
        full_name: t.full_name,
        subjects: t.subjects || [],
        qualification: t.qualification,
        is_free,
        free_after,
        current_session: currentSession ? { room_name: currentSession.room_name, end_time: currentSession.end_time } : null,
        schedule: sessions,
      };
    });

    // Free first
    teachers.sort((a, b) => {
      if (a.is_free && !b.is_free) return -1;
      if (!a.is_free && b.is_free) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

    return NextResponse.json<ApiResponse>({ success: true, data: { teachers } });
  } catch (err) {
    console.error('[external/available-teachers] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
