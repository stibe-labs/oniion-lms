import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import type { ApiResponse } from '@/types';

/**
 * GET /api/v1/open-classroom/[token]/details
 * Returns complete classroom details: participants, monitoring, attendance, exams
 * Requires authenticated AO/owner/teacher
 */

const ALLOWED = ['owner', 'academic_operator', 'academic', 'teacher'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !ALLOWED.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { token } = await params;

    // Find classroom by host_token
    const ocRes = await db.query(
      `SELECT oc.*, pu.full_name AS teacher_name, pu.portal_role AS teacher_role
       FROM open_classrooms oc
       LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
       WHERE oc.host_token = $1 OR oc.id::text = $1
       LIMIT 1`,
      [token]
    );
    if (ocRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Not found' }, { status: 404 });
    }
    const oc = ocRes.rows[0];
    const roomId = oc.livekit_room_name;

    // 1. Participants
    const participantsRes = await db.query(
      `SELECT id, name, email, phone, role, payment_status, invoice_id, paid_at, joined_at, left_at
       FROM open_classroom_participants
       WHERE classroom_id = $1
       ORDER BY joined_at ASC NULLS LAST`,
      [oc.id]
    );

    // 2. Shares
    const sharesRes = await db.query(
      `SELECT id, name, phone, email, shared_at
       FROM open_classroom_shares
       WHERE classroom_id = $1
       ORDER BY shared_at DESC`,
      [oc.id]
    );

    // If no room was ever created, return basic info only
    if (!roomId) {
      const earlyBase = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          classroom: {
            ...oc,
            host_link: `${earlyBase}/open-classroom/${oc.host_token}`,
            join_link: `${earlyBase}/open-classroom/${oc.join_token}`,
          },
          participants: participantsRes.rows,
          shares: sharesRes.rows,
          monitoring_events: [],
          monitoring_summary: [],
          monitoring_alerts: [],
          attention_summary: [],
          attendance_sessions: [],
          attendance_logs: [],
          exam_results: [],
          revenue: { paid_count: 0, total_revenue_paise: 0 },
        },
      });
    }

    // 3. Monitoring events — aggregate per student
    const monitoringSummaryRes = await db.query(
      `SELECT student_email,
              event_type,
              COUNT(*) AS event_count,
              SUM(duration_seconds) AS total_duration_sec,
              AVG(confidence) AS avg_confidence
       FROM class_monitoring_events
       WHERE room_id = $1
       GROUP BY student_email, event_type
       ORDER BY student_email, event_count DESC`,
      [roomId]
    );

    // 4. Monitoring alerts
    const alertsRes = await db.query(
      `SELECT id, target_email, alert_type, title, message, severity, status, created_at
       FROM monitoring_alerts
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [roomId]
    );

    // 5. Attendance sessions
    const attendanceSessionsRes = await db.query(
      `SELECT participant_email, participant_name, participant_role,
              first_join_at, last_leave_at, total_duration_sec,
              join_count, status, late_by_sec
       FROM attendance_sessions
       WHERE room_id = $1
       ORDER BY first_join_at ASC NULLS LAST`,
      [roomId]
    );

    // 6. Attendance logs (join/leave timeline)
    const attendanceLogsRes = await db.query(
      `SELECT participant_email, event_type, payload, event_at AS created_at
       FROM attendance_logs
       WHERE room_id = $1
       ORDER BY event_at ASC
       LIMIT 500`,
      [roomId]
    );

    // 7. Exam results — try session_exam_results first (batch sessions use this)
    const examRes = await db.query(
      `SELECT student_email, student_name, topic_id, score, total_questions,
              percentage, started_at, completed_at, answers
       FROM session_exam_results
       WHERE room_id = $1
       ORDER BY completed_at DESC NULLS LAST`,
      [roomId]
    );

    // 8. Per-student attention summary (derived from monitoring)
    const attentionRes = await db.query(
      `SELECT student_email,
              SUM(CASE WHEN event_type = 'attentive' THEN duration_seconds ELSE 0 END) AS attentive_sec,
              SUM(CASE WHEN event_type != 'attentive' THEN duration_seconds ELSE 0 END) AS distracted_sec,
              SUM(duration_seconds) AS total_tracked_sec,
              COUNT(*) FILTER (WHERE event_type = 'eyes_closed') AS eyes_closed_count,
              COUNT(*) FILTER (WHERE event_type = 'looking_away') AS looking_away_count,
              COUNT(*) FILTER (WHERE event_type = 'phone_detected') AS phone_count,
              COUNT(*) FILTER (WHERE event_type = 'sleeping') AS sleeping_count
       FROM class_monitoring_events
       WHERE room_id = $1
       GROUP BY student_email`,
      [roomId]
    );

    // Revenue
    const revenueRes = await db.query(
      `SELECT COUNT(*) AS paid_count,
              COALESCE(SUM(oc2.price_paise), 0) AS total_revenue_paise
       FROM open_classroom_participants p
       JOIN open_classrooms oc2 ON oc2.id = p.classroom_id
       WHERE p.classroom_id = $1 AND p.payment_status = 'paid'`,
      [oc.id]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';

    // Post-process attendance sessions: compute missing last_leave_at / total_duration_sec from logs
    type LogRow = { participant_email: string; event_type: string; created_at: string };
    const logsByEmail = new Map<string, LogRow[]>();
    for (const row of attendanceLogsRes.rows) {
      const log = row as LogRow;
      if (!logsByEmail.has(log.participant_email)) logsByEmail.set(log.participant_email, []);
      logsByEmail.get(log.participant_email)!.push(log);
    }
    const patchedSessions = attendanceSessionsRes.rows.map(sessionRow => {
      const session = sessionRow as Record<string, unknown>;
      const email = session.participant_email as string;
      const logs = logsByEmail.get(email) || [];
      // Compute last_leave_at from logs if DB column is null
      let lastLeaveAt = session.last_leave_at as string | null;
      if (!lastLeaveAt) {
        const leaveLogs = logs.filter(l => l.event_type === 'leave' || l.event_type === 'disconnect');
        if (leaveLogs.length > 0) lastLeaveAt = leaveLogs[leaveLogs.length - 1].created_at;
      }
      // Compute total_duration_sec from logs when DB value is 0 or null
      let durationSec = Number(session.total_duration_sec) || 0;
      if (durationSec === 0 && logs.length >= 1) {
        let totalMs = 0;
        let joinTime: Date | null = null;
        for (const log of logs) {
          if (log.event_type === 'join' || log.event_type === 'rejoin') {
            joinTime = new Date(log.created_at);
          } else if ((log.event_type === 'leave' || log.event_type === 'disconnect') && joinTime) {
            totalMs += new Date(log.created_at).getTime() - joinTime.getTime();
            joinTime = null;
          }
        }
        if (joinTime && lastLeaveAt) {
          totalMs += new Date(lastLeaveAt).getTime() - joinTime.getTime();
        }
        durationSec = Math.max(0, Math.round(totalMs / 1000));
      }
      return { ...session, last_leave_at: lastLeaveAt, total_duration_sec: durationSec };
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        classroom: {
          ...oc,
          host_link: `${baseUrl}/open-classroom/${oc.host_token}`,
          join_link: `${baseUrl}/open-classroom/${oc.join_token}`,
        },
        participants: participantsRes.rows,
        shares: sharesRes.rows,
        monitoring_summary: monitoringSummaryRes.rows,
        monitoring_alerts: alertsRes.rows,
        attention_summary: attentionRes.rows,
        attendance_sessions: patchedSessions,
        attendance_logs: attendanceLogsRes.rows,
        exam_results: examRes.rows,
        revenue: revenueRes.rows[0] || { paid_count: 0, total_revenue_paise: 0 },
      },
    });
  } catch (err) {
    console.error('[open-classroom/details]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
