import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

/**
 * GET /api/v1/demo/available-teachers
 * Returns ALL active teachers with their schedule and availability status.
 * Query params:
 *   hours — lookahead window (default: 4, max: 12)
 *   subject — optional filter by subject
 *
 * Auth: academic_operator, owner, batch_coordinator, or public (with link_id param for demo registration)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = Math.min(Number(searchParams.get('hours')) || 4, 12);
    const subject = searchParams.get('subject');
    const linkId = searchParams.get('link_id'); // public access for demo registration

    // If no link_id, require auth
    if (!linkId) {
      const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
      if (!sessionToken) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
      }
      const user = await verifySession(sessionToken);
      if (!user || !['academic_operator', 'owner', 'batch_coordinator'].includes(user.role)) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }
    } else {
      // Validate link_id exists and is not expired
      const linkResult = await db.query(
        `SELECT id FROM demo_requests WHERE demo_link_id = $1 AND status IN ('link_created','submitted') AND (expires_at IS NULL OR expires_at > NOW())`,
        [linkId]
      );
      if (linkResult.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid or expired demo link' }, { status: 403 });
      }
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);

    // Find all teachers
    let teacherQuery = `
      SELECT pu.email, pu.full_name, up.subjects, up.qualification, up.grade
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
    const allTeachers = teacherResult.rows as {
      email: string;
      full_name: string;
      subjects: string[] | null;
      qualification: string | null;
      grade: string | null;
    }[];

    if (allTeachers.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { teachers: [], freeCount: 0, totalCount: 0 },
      });
    }

    // For public queries, return only free teachers with limited info (old behaviour)
    if (linkId) {
      const roomConflicts = await db.query(
        `SELECT DISTINCT teacher_email FROM rooms
         WHERE status IN ('scheduled', 'live')
           AND teacher_email IS NOT NULL
           AND scheduled_start < $1
           AND (scheduled_start + (duration_minutes || ' minutes')::interval) > $2`,
        [windowEnd.toISOString(), now.toISOString()]
      );
      const busyFromRooms = new Set(roomConflicts.rows.map((r: Record<string, unknown>) => r.teacher_email));

      const bsConflicts = await db.query(
        `SELECT DISTINCT teacher_email FROM batch_sessions
         WHERE status IN ('scheduled', 'live')
           AND teacher_email IS NOT NULL
           AND (scheduled_date + start_time) < $1::timestamptz
           AND (scheduled_date + start_time + (duration_minutes || ' minutes')::interval) > $2::timestamptz`,
        [windowEnd.toISOString(), now.toISOString()]
      );
      const busyFromBS = new Set(bsConflicts.rows.map((r: Record<string, unknown>) => r.teacher_email));

      const freeTeachers = allTeachers
        .filter(t => !busyFromRooms.has(t.email) && !busyFromBS.has(t.email))
        .map(t => ({ name: t.full_name, subjects: t.subjects || [] }));

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { teachers: freeTeachers, count: freeTeachers.length },
      });
    }

    // ── Authenticated: return ALL teachers with schedule info ──

    const teacherEmails = allTeachers.map(t => t.email);

    // Get upcoming room sessions for these teachers
    const roomSessions = await db.query(
      `SELECT r.teacher_email, r.scheduled_start, r.duration_minutes, r.status,
              r.room_name, r.room_id,
              dr.student_name AS demo_student_name
       FROM rooms r
       LEFT JOIN demo_requests dr ON dr.room_id = r.room_id
       WHERE r.teacher_email = ANY($1)
         AND r.status IN ('scheduled', 'live')
         AND (r.scheduled_start + (r.duration_minutes || ' minutes')::interval) > $2
         AND r.scheduled_start < $3
       ORDER BY r.scheduled_start`,
      [teacherEmails, now.toISOString(), windowEnd.toISOString()]
    );

    // Get upcoming batch sessions for these teachers
    const batchSessions = await db.query(
      `SELECT bs.teacher_email, bs.scheduled_date, bs.start_time, bs.duration_minutes,
              bs.status, bs.subject, b.batch_name as batch_name
       FROM batch_sessions bs
       LEFT JOIN batches b ON b.batch_id = bs.batch_id
       WHERE bs.teacher_email = ANY($1)
         AND bs.status IN ('scheduled', 'live')
         AND (bs.scheduled_date + bs.start_time + (bs.duration_minutes || ' minutes')::interval) > $2::timestamptz
         AND (bs.scheduled_date + bs.start_time) < $3::timestamptz
       ORDER BY bs.scheduled_date, bs.start_time`,
      [teacherEmails, now.toISOString(), windowEnd.toISOString()]
    );

    // Build schedule map per teacher
    type SessionInfo = { start: string; end: string; duration: number; type: string; label: string; status: string };
    const scheduleMap = new Map<string, SessionInfo[]>();

    for (const r of roomSessions.rows as { teacher_email: string; scheduled_start: string; duration_minutes: number; status: string; room_name: string; room_id: string; demo_student_name: string | null }[]) {
      const start = new Date(r.scheduled_start);
      const end = new Date(start.getTime() + (r.duration_minutes || 30) * 60000);
      const isDemo = r.room_id?.startsWith('demo_');
      const list = scheduleMap.get(r.teacher_email) || [];
      list.push({
        start: start.toISOString(),
        end: end.toISOString(),
        duration: r.duration_minutes || 30,
        type: isDemo ? 'demo' : 'room',
        label: r.demo_student_name ? `Demo: ${r.demo_student_name}` : (r.room_name || 'Session'),
        status: r.status,
      });
      scheduleMap.set(r.teacher_email, list);
    }

    for (const bs of batchSessions.rows as { teacher_email: string; scheduled_date: string; start_time: string; duration_minutes: number; status: string; subject: string | null; batch_name: string | null }[]) {
      const start = new Date(`${bs.scheduled_date}T${bs.start_time}`);
      const end = new Date(start.getTime() + (bs.duration_minutes || 45) * 60000);
      const list = scheduleMap.get(bs.teacher_email) || [];
      list.push({
        start: start.toISOString(),
        end: end.toISOString(),
        duration: bs.duration_minutes || 45,
        type: 'batch',
        label: bs.batch_name ? `${bs.subject || 'Batch'} — ${bs.batch_name}` : (bs.subject || 'Batch Session'),
        status: bs.status,
      });
      scheduleMap.set(bs.teacher_email, list);
    }

    // Build response with availability status
    const responseTeachers = allTeachers.map(t => {
      const sessions = (scheduleMap.get(t.email) || []).sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      // Check if currently busy (any session overlapping NOW)
      const currentSession = sessions.find(s => {
        const sStart = new Date(s.start).getTime();
        const sEnd = new Date(s.end).getTime();
        return sStart <= now.getTime() && sEnd > now.getTime();
      });

      const isFree = !currentSession;

      // Find when teacher will be free (end of current/chained sessions)
      let freeAfter: string | null = null;
      if (currentSession) {
        // Walk through consecutive sessions to find the actual free time
        let chainEnd = new Date(currentSession.end).getTime();
        for (const s of sessions) {
          const sStart = new Date(s.start).getTime();
          const sEnd = new Date(s.end).getTime();
          // If next session starts within 5 min of chain end, extend the chain
          if (sStart <= chainEnd + 5 * 60000 && sEnd > chainEnd) {
            chainEnd = sEnd;
          }
        }
        freeAfter = new Date(chainEnd).toISOString();
      }

      return {
        email: t.email,
        name: t.full_name,
        subjects: t.subjects || [],
        qualification: t.qualification,
        isFree,
        freeAfter,
        currentSession: currentSession ? { label: currentSession.label, end: currentSession.end, status: currentSession.status } : null,
        schedule: sessions,
      };
    });

    // Sort: free teachers first, then by name
    responseTeachers.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.name.localeCompare(b.name);
    });

    const freeCount = responseTeachers.filter(t => t.isFree).length;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        teachers: responseTeachers,
        freeCount,
        totalCount: responseTeachers.length,
        window_hours: hours,
      },
    });
  } catch (err) {
    console.error('[demo/available-teachers GET] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
