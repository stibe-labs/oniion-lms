// ═══════════════════════════════════════════════════════════════
// Student Reports API — /api/v1/student-reports
// GET: Comprehensive student report combining exams, attendance,
//      and AI monitoring data. Supports daily/weekly/overall views.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

const ALLOWED_ROLES = ['student', 'teacher', 'batch_coordinator', 'academic_operator', 'owner', 'parent', 'hr'];

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return fail('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user || !ALLOWED_ROLES.includes(user.role)) return fail('Unauthorized', 403);

  const url = new URL(req.url);
  let studentEmail = url.searchParams.get('student_email') || '';
  const batchId = url.searchParams.get('batch_id') || '';
  const period = url.searchParams.get('period') || 'overall'; // daily | weekly | overall
  const dateStr = url.searchParams.get('date') || ''; // for daily: specific date

  // Students can only view their own reports
  if (user.role === 'student') studentEmail = user.id;
  // Parents can only view their children's reports
  if (user.role === 'parent') {
    if (!studentEmail) return fail('student_email is required');
    const childCheck = await db.query(
      `SELECT 1 FROM batch_students WHERE student_email = $1 AND parent_email = $2 LIMIT 1`,
      [studentEmail, user.id],
    );
    if (childCheck.rows.length === 0) return fail('Not authorized for this student', 403);
  }

  if (!studentEmail) return fail('student_email is required');

  // Date range
  let dateFrom: string;
  let dateTo: string;
  const now = new Date();

  if (period === 'daily') {
    const d = dateStr ? new Date(dateStr) : now;
    dateFrom = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    dateTo = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
  } else if (period === 'weekly') {
    const d = dateStr ? new Date(dateStr) : now;
    const dayOfWeek = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);
    dateFrom = monday.toISOString();
    dateTo = sunday.toISOString();
  } else {
    // Overall: last 90 days
    dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    dateTo = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    // === 1. Exam Results ===
    const examQ = `
      SELECT ser.id, ser.topic_title, ser.subject, ser.score, ser.total_marks,
             ser.percentage, ser.grade_letter, ser.answered, ser.skipped,
             ser.total_questions, ser.time_taken_seconds, ser.tab_switch_count,
             ser.auto_submitted, ser.completed_at,
             ser.violations
      FROM session_exam_results ser
      WHERE ser.student_email = $1
        AND ser.completed_at >= $2 AND ser.completed_at < $3
      ORDER BY ser.completed_at DESC
    `;
    const examRes = await db.query(examQ, [studentEmail, dateFrom, dateTo]);

    // Exam summary
    const exams = examRes.rows;
    const examCount = exams.length;
    const avgScore = examCount > 0
      ? Math.round(exams.reduce((s: number, e: Record<string, unknown>) => s + (Number(e.percentage) || 0), 0) / examCount * 100) / 100
      : 0;
    const totalTabSwitches = exams.reduce((s: number, e: Record<string, unknown>) => s + (Number(e.tab_switch_count) || 0), 0);
    const autoSubmittedCount = exams.filter((e: Record<string, unknown>) => e.auto_submitted).length;

    // === 2. Attendance ===
    const attQ = `
      SELECT a.room_id, a.status, a.total_duration_sec AS duration_seconds,
             a.engagement_score, a.attention_avg,
             a.first_join_at AS joined_at, a.last_leave_at AS left_at,
             r.subject, r.room_name, r.scheduled_start, r.duration_minutes
      FROM attendance_sessions a
      JOIN rooms r ON r.room_id = a.room_id
      WHERE a.participant_email = $1 AND a.participant_role = 'student'
        AND a.first_join_at >= $2 AND a.first_join_at < $3
        ${batchId ? 'AND r.batch_id = $4' : ''}
      ORDER BY a.first_join_at DESC
    `;
    const attParams = batchId ? [studentEmail, dateFrom, dateTo, batchId] : [studentEmail, dateFrom, dateTo];
    const attRes = await db.query(attQ, attParams);

    const attendanceRecords = attRes.rows;
    const totalClasses = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((a: Record<string, unknown>) =>
      a.status === 'present' || a.status === 'late'
    ).length;
    const lateCount = attendanceRecords.filter((a: Record<string, unknown>) => a.status === 'late').length;
    const absentCount = totalClasses - presentCount;
    const attendanceRate = totalClasses > 0 ? Math.round(presentCount / totalClasses * 10000) / 100 : 0;
    const avgEngagement = totalClasses > 0
      ? Math.round(attendanceRecords.reduce((s: number, a: Record<string, unknown>) => s + (Number(a.engagement_score) || 0), 0) / totalClasses)
      : 0;
    const avgAttention = totalClasses > 0
      ? Math.round(attendanceRecords.reduce((s: number, a: Record<string, unknown>) => s + (Number(a.attention_avg) || 0), 0) / totalClasses)
      : 0;

    // Per-subject attendance
    const subjectAttendance: Record<string, { total: number; present: number; avgAttention: number }> = {};
    for (const a of attendanceRecords) {
      const sub = (a.subject as string) || 'Unknown';
      if (!subjectAttendance[sub]) subjectAttendance[sub] = { total: 0, present: 0, avgAttention: 0 };
      subjectAttendance[sub].total++;
      if (a.status === 'present' || a.status === 'late') subjectAttendance[sub].present++;
      subjectAttendance[sub].avgAttention += Number(a.attention_avg) || 0;
    }
    for (const sub of Object.keys(subjectAttendance)) {
      subjectAttendance[sub].avgAttention = subjectAttendance[sub].total > 0
        ? Math.round(subjectAttendance[sub].avgAttention / subjectAttendance[sub].total)
        : 0;
    }

    // === 3. AI Monitoring Events ===
    const monQ = `
      SELECT cme.event_type, COUNT(*)::int AS count,
             ROUND(SUM(cme.duration_seconds)::numeric / 60, 1)::float AS total_minutes,
             ROUND(AVG(cme.confidence)::numeric, 2)::float AS avg_confidence
      FROM class_monitoring_events cme
      WHERE cme.student_email = $1
        AND cme.created_at >= $2 AND cme.created_at < $3
      GROUP BY cme.event_type
      ORDER BY total_minutes DESC
    `;
    const monRes = await db.query(monQ, [studentEmail, dateFrom, dateTo]);
    const monitoringBreakdown = monRes.rows;

    // === 4. Monitoring Alerts ===
    const alertQ = `
      SELECT alert_type, COUNT(*)::int AS count
      FROM monitoring_alerts
      WHERE target_email = $1
        AND created_at >= $2 AND created_at < $3
      GROUP BY alert_type
      ORDER BY count DESC
    `;
    const alertRes = await db.query(alertQ, [studentEmail, dateFrom, dateTo]);
    const alertBreakdown = alertRes.rows;
    const totalAlerts = alertBreakdown.reduce((s: number, a: Record<string, unknown>) => s + (Number(a.count) || 0), 0);

    // === 5. Daily trend (for weekly/overall) ===
    let dailyTrend: Array<{ date: string; attendance: number; attention: number; exams: number; alerts: number }> = [];
    if (period !== 'daily') {
      const trendQ = `
        SELECT d::date AS date,
          (SELECT COUNT(*)::int FROM attendance_sessions a2
           WHERE a2.participant_email = $1 AND a2.participant_role = 'student'
             AND a2.first_join_at >= d AND a2.first_join_at < d + interval '1 day'
             AND (a2.status = 'present' OR a2.status = 'late')) AS attendance,
          (SELECT COALESCE(AVG(a2.attention_avg), 0)::int FROM attendance_sessions a2
           WHERE a2.participant_email = $1 AND a2.participant_role = 'student'
             AND a2.first_join_at >= d AND a2.first_join_at < d + interval '1 day') AS attention,
          (SELECT COUNT(*)::int FROM session_exam_results e2
           WHERE e2.student_email = $1 AND e2.completed_at >= d AND e2.completed_at < d + interval '1 day') AS exams,
          (SELECT COUNT(*)::int FROM monitoring_alerts ma2
           WHERE ma2.target_email = $1 AND ma2.created_at >= d AND ma2.created_at < d + interval '1 day') AS alerts
        FROM generate_series($2::date, ($3::date - interval '1 day')::date, interval '1 day') AS d
        ORDER BY d
      `;
      const trendRes = await db.query(trendQ, [studentEmail, dateFrom, dateTo]);
      dailyTrend = trendRes.rows.map((r: Record<string, unknown>) => ({
        date: String(r.date).slice(0, 10),
        attendance: Number(r.attendance) || 0,
        attention: Number(r.attention) || 0,
        exams: Number(r.exams) || 0,
        alerts: Number(r.alerts) || 0,
      }));
    }

    // === 6. Student info ===
    const studentQ = `
      SELECT pu.full_name AS student_name, bs.student_email, bs.parent_email,
             COALESCE(bs.student_status, 'active') AS student_status,
             b.batch_name, b.grade, b.subjects, b.batch_id
      FROM batch_students bs
      JOIN batches b ON b.batch_id = bs.batch_id
      LEFT JOIN portal_users pu ON pu.email = bs.student_email
      WHERE bs.student_email = $1
      ORDER BY b.created_at DESC
    `;
    const studentRes = await db.query(studentQ, [studentEmail]);
    const studentInfo = studentRes.rows[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        student: studentInfo ? {
          name: studentInfo.student_name,
          email: studentInfo.student_email,
          parent_email: studentInfo.parent_email,
          batch_name: studentInfo.batch_name,
          grade: studentInfo.grade,
          subjects: studentInfo.subjects,
          batch_id: studentInfo.batch_id,
        } : { name: '', email: studentEmail },
        period,
        date_from: dateFrom,
        date_to: dateTo,
        exam_summary: {
          total_exams: examCount,
          avg_percentage: avgScore,
          total_tab_switches: totalTabSwitches,
          auto_submitted_count: autoSubmittedCount,
          exams: exams.map((e: Record<string, unknown>) => ({
            id: e.id,
            topic_title: e.topic_title,
            subject: e.subject,
            score: e.score,
            total_marks: e.total_marks,
            percentage: Number(e.percentage),
            grade_letter: e.grade_letter,
            answered: e.answered,
            skipped: e.skipped,
            total_questions: e.total_questions,
            time_taken_seconds: e.time_taken_seconds,
            tab_switch_count: e.tab_switch_count,
            auto_submitted: e.auto_submitted,
            completed_at: e.completed_at,
          })),
        },
        attendance_summary: {
          total_classes: totalClasses,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          attendance_rate: attendanceRate,
          avg_engagement: avgEngagement,
          avg_attention: avgAttention,
          by_subject: subjectAttendance,
        },
        monitoring_summary: {
          total_alerts: totalAlerts,
          alert_breakdown: alertBreakdown,
          behavior_breakdown: monitoringBreakdown.map((m: Record<string, unknown>) => ({
            event_type: m.event_type,
            count: m.count,
            total_minutes: m.total_minutes,
            avg_confidence: m.avg_confidence,
          })),
        },
        daily_trend: dailyTrend,
      },
    });
  } catch (err) {
    console.error('[student-reports] Error:', err);
    return fail('Internal server error', 500);
  }
}
