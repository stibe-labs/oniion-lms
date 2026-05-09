// ═══════════════════════════════════════════════════════════════
// stibe Portal — Monitoring Reports Library
// ═══════════════════════════════════════════════════════════════
// Generates daily, weekly, monthly reports for students + teachers.
// Parent monthly report includes MediaPipe AI attention summary.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type ReportType =
  | 'student_daily'
  | 'student_weekly'
  | 'student_monthly'
  | 'teacher_daily'
  | 'teacher_weekly'
  | 'teacher_monthly';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface StudentReportMetrics {
  attendance_rate: number;
  avg_attention_score: number;
  total_classes: number;
  classes_attended: number;
  time_in_class_minutes: number;
  looking_away_minutes: number;
  eyes_closed_minutes: number;
  not_in_frame_minutes: number;
  distracted_minutes: number;
  phone_detected_minutes: number;
  tab_switched_minutes: number;
  yawning_minutes: number;
  inactive_minutes: number;
  head_turned_minutes: number;
  tab_switch_count: number;
  hand_raises: number;
  alerts_count: number;
  // v3 — positive/neutral engagement buckets (not distractions)
  writing_notes_minutes: number;
  brief_absence_minutes: number;
  low_visibility_minutes: number;
  engaged_total_minutes: number;      // attentive + writing_notes
  // Late join stats
  late_join_count: number;
  avg_late_minutes: number;
  // Leave request stats
  leave_requests: number;
  leave_approved: number;
  leave_denied: number;
  // Mic/Camera discipline
  mic_off_count: number;
  camera_off_count: number;
  // Connection stability
  rejoin_count: number;
  // Contact violations
  contact_violations: number;
  // Feedback
  avg_feedback_rating: number;
  feedback_count: number;
  // Alert breakdown
  alert_breakdown: Record<string, number>;
  // Trends
  engagement_trend: number[];     // daily scores array
  top_subjects: string[];
  weak_subjects: string[];
  overall_summary: string;        // AI behavior summary for parent
}

export interface TeacherReportMetrics {
  sessions_conducted: number;
  sessions_cancelled: number;
  sessions_scheduled: number;
  avg_start_delay_minutes: number;
  on_time_rate: number;
  avg_class_duration_minutes: number;
  avg_student_engagement: number;
  camera_off_incidents: number;
  total_teaching_hours: number;
  late_starts: number;
  late_by_total_minutes: number;
  batches: string[];
  overall_summary: string;
}

export interface MonitoringReport {
  [key: string]: unknown;
  id: string;
  report_type: ReportType;
  report_period: ReportPeriod;
  period_start: string;
  period_end: string;
  target_email: string;
  target_role: string;
  target_name: string | null;
  batch_id: string | null;
  batch_name: string | null;
  grade: string | null;
  section: string | null;
  metrics: StudentReportMetrics | TeacherReportMetrics;
  sent_to_parent: boolean;
  parent_email: string | null;
  sent_at: string | null;
  generated_by: string;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════════
   STUDENT REPORT GENERATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a student report for a given period.
 * Aggregates monitoring events, attendance, and alerts.
 */
export async function generateStudentReport(params: {
  student_email: string;
  period: ReportPeriod;
  period_start: string;   // YYYY-MM-DD
  period_end: string;      // YYYY-MM-DD
  batch_id?: string;
}): Promise<string> {
  const { student_email, period, period_start, period_end, batch_id } = params;

  // Get student info
  const userResult = await db.query<{ full_name: string; email: string }>(
    `SELECT full_name, email FROM portal_users WHERE email = $1`,
    [student_email]
  );
  const studentName = userResult.rows[0]?.full_name || student_email.split('@')[0];

  // Get batch info if available
  let batchName: string | null = null;
  let grade: string | null = null;
  let section: string | null = null;
  if (batch_id) {
    const batchResult = await db.query<{ name: string; grade: string; section: string }>(
      `SELECT name, grade, section FROM batches WHERE id = $1`,
      [batch_id]
    );
    if (batchResult.rows[0]) {
      batchName = batchResult.rows[0].name;
      grade = batchResult.rows[0].grade;
      section = batchResult.rows[0].section;
    }
  }

  // Monitoring events aggregation
  const eventsAgg = await db.query<{
    total_events: string;
    attentive_sec: string;
    looking_away_sec: string;
    eyes_closed_sec: string;
    not_in_frame_sec: string;
    distracted_sec: string;
    hand_raises: string;
    phone_detected_sec: string;
    tab_switched_sec: string;
    yawning_sec: string;
    inactive_sec: string;
    head_turned_sec: string;
    tab_switch_count: string;
    writing_notes_sec: string;
    brief_absence_sec: string;
    low_visibility_sec: string;
    thinking_sec: string;
    reading_material_sec: string;
  }>(
    `SELECT
       COUNT(*)::TEXT AS total_events,
       COALESCE(SUM(CASE WHEN event_type = 'attentive' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS attentive_sec,
       COALESCE(SUM(CASE WHEN event_type = 'looking_away' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS looking_away_sec,
       COALESCE(SUM(CASE WHEN event_type = 'eyes_closed' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS eyes_closed_sec,
       COALESCE(SUM(CASE WHEN event_type = 'not_in_frame' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS not_in_frame_sec,
       COALESCE(SUM(CASE WHEN event_type = 'distracted' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS distracted_sec,
       COALESCE(SUM(CASE WHEN event_type = 'hand_raised' THEN 1 ELSE 0 END), 0)::TEXT AS hand_raises,
       COALESCE(SUM(CASE WHEN event_type = 'phone_detected' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS phone_detected_sec,
       COALESCE(SUM(CASE WHEN event_type = 'tab_switched' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS tab_switched_sec,
       COALESCE(SUM(CASE WHEN event_type = 'yawning' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS yawning_sec,
       COALESCE(SUM(CASE WHEN event_type = 'inactive' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS inactive_sec,
       COALESCE(SUM(CASE WHEN event_type = 'head_turned' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS head_turned_sec,
       COALESCE(SUM(CASE WHEN event_type = 'writing_notes' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS writing_notes_sec,
       COALESCE(SUM(CASE WHEN event_type = 'brief_absence' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS brief_absence_sec,
       COALESCE(SUM(CASE WHEN event_type = 'low_visibility' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS low_visibility_sec,
       COALESCE(SUM(CASE WHEN event_type = 'thinking' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS thinking_sec,
       COALESCE(SUM(CASE WHEN event_type = 'reading_material' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS reading_material_sec,
       COALESCE(SUM(CASE WHEN event_type = 'tab_switched' AND (details->>'switch_count')::int > 0 THEN (details->>'switch_count')::int ELSE 0 END), 0)::TEXT AS tab_switch_count
     FROM class_monitoring_events
     WHERE student_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  const agg = eventsAgg.rows[0];
  const attentiveSec = parseInt(agg?.attentive_sec || '0', 10);
  const lookingAwaySec = parseInt(agg?.looking_away_sec || '0', 10);
  const eyesClosedSec = parseInt(agg?.eyes_closed_sec || '0', 10);
  const notInFrameSec = parseInt(agg?.not_in_frame_sec || '0', 10);
  const distractedSec = parseInt(agg?.distracted_sec || '0', 10);
  const phoneDetectedSec = parseInt(agg?.phone_detected_sec || '0', 10);
  const tabSwitchedSec = parseInt(agg?.tab_switched_sec || '0', 10);
  const yawningSec = parseInt(agg?.yawning_sec || '0', 10);
  // inactiveSec (mouse/keyboard) is no longer used — see awayFromClassSec below
  const headTurnedSec = parseInt(agg?.head_turned_sec || '0', 10);
  const writingNotesSec = parseInt(agg?.writing_notes_sec || '0', 10);
  const briefAbsenceSec = parseInt(agg?.brief_absence_sec || '0', 10);
  const lowVisibilitySec = parseInt(agg?.low_visibility_sec || '0', 10);
  const thinkingSec = parseInt(agg?.thinking_sec || '0', 10);
  const readingMaterialSec = parseInt(agg?.reading_material_sec || '0', 10);
  const tabSwitchCount = parseInt(agg?.tab_switch_count || '0', 10);
  // v3.1 — "engaged" includes attentive + writing_notes + thinking + reading_material
  const engagedSec = attentiveSec + writingNotesSec + thinkingSec + readingMaterialSec;

  // v4 Weighted attention formula:
  // Tab-switching and not-in-frame penalized heavily; looking_away/head_turned barely penalized
  // (real students glance around — that's completely normal; continuous tab-switch is not)
  const penaltyWeighted =
    tabSwitchedSec * 1.5 +       // heaviest: clearly disengaged from class
    notInFrameSec * 1.3 +        // heavy: not physically at screen
    eyesClosedSec * 1.1 +        // moderate: sustained = sleeping risk
    distractedSec * 0.7 +        // light: general inattention
    // inactiveSec removed: mouse/keyboard inactivity is normal during live class (listening)
    lookingAwaySec * 0.2 +       // very light: completely normal behavior
    headTurnedSec * 0.15 +       // very light: reaching, adjusting, talking to family
    yawningSec * 0.05;            // almost none: normal tiredness
  // inactive = total time "away from class" (tab switched + not in frame)
  const awayFromClassSec = tabSwitchedSec + notInFrameSec;
  const totalWeighted = engagedSec + penaltyWeighted;
  const avgAttention = totalWeighted > 0 ? Math.round((engagedSec / totalWeighted) * 100) : 0;

  // Attendance from attendance_sessions (includes late join + mic/camera counts)
  const attendance = await db.query<{
    total_sessions: string;
    sessions_present: string;
    total_time_min: string;
    late_join_count: string;
    avg_late_sec: string;
    mic_off_total: string;
    camera_off_total: string;
  }>(
    `SELECT
       COUNT(*)::TEXT AS total_sessions,
       COUNT(CASE WHEN status IN ('present','late') THEN 1 END)::TEXT AS sessions_present,
       COALESCE(SUM(total_duration_sec / 60.0), 0)::TEXT AS total_time_min,
       COUNT(CASE WHEN late_join = true THEN 1 END)::TEXT AS late_join_count,
       COALESCE(AVG(CASE WHEN late_join = true THEN late_by_sec END), 0)::TEXT AS avg_late_sec,
       COALESCE(SUM(mic_off_count), 0)::TEXT AS mic_off_total,
       COALESCE(SUM(camera_off_count), 0)::TEXT AS camera_off_total
     FROM attendance_sessions
     WHERE participant_email = $1
       AND participant_role = 'student'
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  const totalSessions = parseInt(attendance.rows[0]?.total_sessions || '0', 10);
  const sessionsPresent = parseInt(attendance.rows[0]?.sessions_present || '0', 10);
  const attendanceRate = totalSessions > 0 ? Math.round((sessionsPresent / totalSessions) * 100) : 0;
  const timeInClass = Math.round(parseFloat(attendance.rows[0]?.total_time_min || '0'));

  // Alerts count
  const alertsCount = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::TEXT AS cnt FROM monitoring_alerts
     WHERE target_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  // Alert breakdown by type
  const alertBreakdownResult = await db.query<{ alert_type: string; cnt: string }>(
    `SELECT alert_type, COUNT(*)::TEXT AS cnt
     FROM monitoring_alerts
     WHERE target_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')
     GROUP BY alert_type`,
    [student_email, period_start, period_end]
  );
  const alertBreakdown: Record<string, number> = {};
  for (const row of alertBreakdownResult.rows) {
    alertBreakdown[row.alert_type] = parseInt(row.cnt, 10);
  }

  // Leave requests from attendance_logs
  const leaveResult = await db.query<{
    leave_requests: string;
    leave_approved: string;
    leave_denied: string;
    rejoin_count: string;
  }>(
    `SELECT
       COUNT(CASE WHEN event_type = 'leave_request' THEN 1 END)::TEXT AS leave_requests,
       COUNT(CASE WHEN event_type = 'leave_approved' THEN 1 END)::TEXT AS leave_approved,
       COUNT(CASE WHEN event_type = 'leave_denied' THEN 1 END)::TEXT AS leave_denied,
       COUNT(CASE WHEN event_type = 'rejoin' THEN 1 END)::TEXT AS rejoin_count
     FROM attendance_logs
     WHERE participant_email = $1
       AND event_at >= $2::DATE
       AND event_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  // Contact violations
  const contactResult = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::TEXT AS cnt FROM contact_violations
     WHERE sender_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  // Student feedback
  const feedbackResult = await db.query<{ avg_rating: string; feedback_count: string }>(
    `SELECT
       COALESCE(AVG(rating), 0)::TEXT AS avg_rating,
       COUNT(*)::TEXT AS feedback_count
     FROM student_feedback
     WHERE student_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [student_email, period_start, period_end]
  );

  // Daily engagement trend (for weekly/monthly reports)
  const trendResult = await db.query<{ day: string; score: string }>(
    `SELECT
       DATE(created_at) AS day,
       CASE
         WHEN SUM(duration_seconds) > 0
         THEN ROUND((SUM(CASE WHEN event_type IN ('attentive','writing_notes','thinking','reading_material') THEN duration_seconds ELSE 0 END)::NUMERIC
                      / NULLIF(SUM(duration_seconds), 0)) * 100)
         ELSE 0
       END::TEXT AS score
     FROM class_monitoring_events
     WHERE student_email = $1
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')
     GROUP BY DATE(created_at)
     ORDER BY day`,
    [student_email, period_start, period_end]
  );
  const engagementTrend = trendResult.rows.map((r) => parseInt(r.score, 10));

  // Parse new aggregate values
  const lateJoinCount = parseInt(attendance.rows[0]?.late_join_count || '0', 10);
  const avgLateSec = parseFloat(attendance.rows[0]?.avg_late_sec || '0');
  const micOffTotal = parseInt(attendance.rows[0]?.mic_off_total || '0', 10);
  const cameraOffTotal = parseInt(attendance.rows[0]?.camera_off_total || '0', 10);
  const leaveRequests = parseInt(leaveResult.rows[0]?.leave_requests || '0', 10);
  const leaveApproved = parseInt(leaveResult.rows[0]?.leave_approved || '0', 10);
  const leaveDenied = parseInt(leaveResult.rows[0]?.leave_denied || '0', 10);
  const rejoinCount = parseInt(leaveResult.rows[0]?.rejoin_count || '0', 10);
  const contactViolations = parseInt(contactResult.rows[0]?.cnt || '0', 10);
  const avgFeedbackRating = parseFloat(parseFloat(feedbackResult.rows[0]?.avg_rating || '0').toFixed(1));
  const feedbackCount = parseInt(feedbackResult.rows[0]?.feedback_count || '0', 10);

  // Generate overall summary for parent
  const overallSummary = generateStudentSummaryText({
    name: studentName,
    attendanceRate,
    avgAttention,
    eyesClosedMin: Math.round(eyesClosedSec / 60),
    lookingAwayMin: Math.round(lookingAwaySec / 60),
    distractedMin: Math.round(distractedSec / 60),
    handRaises: parseInt(agg?.hand_raises || '0', 10),
    totalSessions,
    sessionsPresent,
    phoneDetectedMin: Math.round(phoneDetectedSec / 60),
    lateJoinCount,
    avgLateMin: Math.round(avgLateSec / 60),
    leaveRequests,
    micOffCount: micOffTotal,
    cameraOffCount: cameraOffTotal,
    contactViolations,
    avgFeedbackRating,
    tabSwitchedMin: Math.round(tabSwitchedSec / 60),
    tabSwitchCount,
    yawningMin: Math.round(yawningSec / 60),
    inactiveMin: Math.round(awayFromClassSec / 60),
    headTurnedMin: Math.round(headTurnedSec / 60),
  });

  const metrics: StudentReportMetrics = {
    attendance_rate: attendanceRate,
    avg_attention_score: avgAttention,
    total_classes: totalSessions,
    classes_attended: sessionsPresent,
    time_in_class_minutes: timeInClass,
    looking_away_minutes: Math.round(lookingAwaySec / 60),
    eyes_closed_minutes: Math.round(eyesClosedSec / 60),
    not_in_frame_minutes: Math.round(notInFrameSec / 60),
    distracted_minutes: Math.round(distractedSec / 60),
    phone_detected_minutes: Math.round(phoneDetectedSec / 60),
    tab_switched_minutes: Math.round(tabSwitchedSec / 60),
    yawning_minutes: Math.round(yawningSec / 60),
    // inactive_minutes is redefined as total "away from class" time (tab switched + not in frame)
    // This matches the engagement alert thresholds used in StudentView (30s alert, 3min penalty, 20min exit)
    inactive_minutes: Math.round(awayFromClassSec / 60),
    head_turned_minutes: Math.round(headTurnedSec / 60),
    tab_switch_count: tabSwitchCount,
    // v3 — positive/neutral buckets
    writing_notes_minutes: Math.round(writingNotesSec / 60),
    brief_absence_minutes: Math.round(briefAbsenceSec / 60),
    low_visibility_minutes: Math.round(lowVisibilitySec / 60),
    engaged_total_minutes: Math.round(engagedSec / 60),
    hand_raises: parseInt(agg?.hand_raises || '0', 10),
    alerts_count: parseInt(alertsCount.rows[0]?.cnt || '0', 10),
    engagement_trend: engagementTrend,
    top_subjects: [],
    weak_subjects: [],
    overall_summary: overallSummary,
    late_join_count: lateJoinCount,
    avg_late_minutes: Math.round(avgLateSec / 60),
    leave_requests: leaveRequests,
    leave_approved: leaveApproved,
    leave_denied: leaveDenied,
    mic_off_count: micOffTotal,
    camera_off_count: cameraOffTotal,
    rejoin_count: rejoinCount,
    contact_violations: contactViolations,
    avg_feedback_rating: avgFeedbackRating,
    feedback_count: feedbackCount,
    alert_breakdown: alertBreakdown,
  };

  const reportType: ReportType = `student_${period}` as ReportType;

  // Upsert — replace existing report for same period
  const result = await db.query<{ id: string }>(
    `INSERT INTO monitoring_reports
      (report_type, report_period, period_start, period_end,
       target_email, target_role, target_name,
       batch_id, batch_name, grade, section, metrics, generated_by)
     VALUES ($1, $2, $3::DATE, $4::DATE, $5, 'student', $6, $7, $8, $9, $10, $11, 'system')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      reportType, period, period_start, period_end,
      student_email, studentName,
      batch_id || null, batchName, grade, section,
      JSON.stringify(metrics),
    ]
  );

  // Fallback if ON CONFLICT skips: just insert with new ID
  if (result.rows.length === 0) {
    const insertResult = await db.query<{ id: string }>(
      `INSERT INTO monitoring_reports
        (report_type, report_period, period_start, period_end,
         target_email, target_role, target_name,
         batch_id, batch_name, grade, section, metrics, generated_by)
       VALUES ($1, $2, $3::DATE, $4::DATE, $5, 'student', $6, $7, $8, $9, $10, $11, 'system')
       RETURNING id`,
      [
        reportType, period, period_start, period_end,
        student_email, studentName,
        batch_id || null, batchName, grade, section,
        JSON.stringify(metrics),
      ]
    );
    return insertResult.rows[0]?.id || 'unknown';
  }

  return result.rows[0]?.id || 'unknown';
}

/* ═══════════════════════════════════════════════════════════════
   TEACHER REPORT GENERATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Generate a teacher report for the given period.
 * Tracks: sessions conducted, cancelled, late starts, camera off, student engagement.
 */
export async function generateTeacherReport(params: {
  teacher_email: string;
  period: ReportPeriod;
  period_start: string;
  period_end: string;
}): Promise<string> {
  const { teacher_email, period, period_start, period_end } = params;

  // Get teacher info
  const userResult = await db.query<{ full_name: string }>(
    `SELECT full_name FROM portal_users WHERE email = $1`,
    [teacher_email]
  );
  const teacherName = userResult.rows[0]?.full_name || teacher_email.split('@')[0];

  // Sessions from rooms table (teacher is assigned)
  const sessionsResult = await db.query<{
    total_scheduled: string;
    total_live_or_ended: string;
    total_cancelled: string;
    total_duration_min: string;
    late_starts: string;
    late_by_total_sec: string;
  }>(
    `SELECT
       COUNT(*)::TEXT AS total_scheduled,
       COUNT(CASE WHEN r.status IN ('live','ended') THEN 1 END)::TEXT AS total_live_or_ended,
       COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END)::TEXT AS total_cancelled,
       COALESCE(SUM(CASE WHEN r.status IN ('live','ended') THEN r.duration_minutes ELSE 0 END), 0)::TEXT AS total_duration_min,
       COUNT(CASE WHEN re_late.id IS NOT NULL THEN 1 END)::TEXT AS late_starts,
       COALESCE(SUM(EXTRACT(EPOCH FROM (re_join.created_at - r.scheduled_start))), 0)::TEXT AS late_by_total_sec
     FROM rooms r
     LEFT JOIN room_assignments ra ON ra.room_id = r.room_id AND ra.participant_type = 'teacher'
     LEFT JOIN room_events re_late ON re_late.room_id = r.room_id AND re_late.event_type = 'monitoring_alert'
       AND re_late.payload->>'alert_type' = 'class_started_late'
     LEFT JOIN room_events re_join ON re_join.room_id = r.room_id AND re_join.event_type = 'participant_joined'
       AND re_join.participant_email = $1
     WHERE ra.participant_email = $1
       AND r.scheduled_start >= $2::DATE
       AND r.scheduled_start < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  const sr = sessionsResult.rows[0];
  const totalScheduled = parseInt(sr?.total_scheduled || '0', 10);
  const sessionsConducted = parseInt(sr?.total_live_or_ended || '0', 10);
  const sessionsCancelled = parseInt(sr?.total_cancelled || '0', 10);
  const totalDurationMin = parseInt(sr?.total_duration_min || '0', 10);
  const lateStarts = parseInt(sr?.late_starts || '0', 10);
  const lateTotalSec = parseInt(sr?.late_by_total_sec || '0', 10);
  const onTimeRate = totalScheduled > 0 ? Math.round(((totalScheduled - lateStarts) / totalScheduled) * 100) : 100;

  // Camera off incidents
  const cameraOffResult = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::TEXT AS cnt FROM monitoring_alerts
     WHERE target_email = $1
       AND alert_type = 'teacher_camera_off'
       AND created_at >= $2::DATE
       AND created_at < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  // Average student engagement in this teacher's rooms
  const engagementResult = await db.query<{ avg_engagement: string }>(
    `SELECT
       CASE
         WHEN SUM(cme.duration_seconds) > 0
         THEN ROUND((SUM(CASE WHEN cme.event_type = 'attentive' THEN cme.duration_seconds ELSE 0 END)::NUMERIC
                      / NULLIF(SUM(cme.duration_seconds), 0)) * 100)
         ELSE 0
       END::TEXT AS avg_engagement
     FROM class_monitoring_events cme
     JOIN rooms r ON cme.room_id = r.room_id
     JOIN room_assignments ra ON ra.room_id = r.room_id AND ra.participant_type = 'teacher' AND ra.participant_email = $1
     WHERE cme.created_at >= $2::DATE
       AND cme.created_at < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  // Batches taught
  const batchesResult = await db.query<{ batch_name: string }>(
    `SELECT DISTINCT b.batch_name AS batch_name
     FROM batches b
     JOIN rooms r ON r.batch_id = b.batch_id::TEXT
     JOIN room_assignments ra ON ra.room_id = r.room_id AND ra.participant_type = 'teacher' AND ra.participant_email = $1
     WHERE r.scheduled_start >= $2::DATE
       AND r.scheduled_start < ($3::DATE + INTERVAL '1 day')`,
    [teacher_email, period_start, period_end]
  );

  const overallSummary = generateTeacherSummaryText({
    name: teacherName,
    sessionsConducted,
    sessionsCancelled,
    lateStarts,
    onTimeRate,
    totalHours: Math.round(totalDurationMin / 60 * 10) / 10,
    avgEngagement: parseInt(engagementResult.rows[0]?.avg_engagement || '0', 10),
  });

  const metrics: TeacherReportMetrics = {
    sessions_conducted: sessionsConducted,
    sessions_cancelled: sessionsCancelled,
    sessions_scheduled: totalScheduled,
    avg_start_delay_minutes: sessionsConducted > 0 ? Math.round(lateTotalSec / sessionsConducted / 60) : 0,
    on_time_rate: onTimeRate,
    avg_class_duration_minutes: sessionsConducted > 0 ? Math.round(totalDurationMin / sessionsConducted) : 0,
    avg_student_engagement: parseInt(engagementResult.rows[0]?.avg_engagement || '0', 10),
    camera_off_incidents: parseInt(cameraOffResult.rows[0]?.cnt || '0', 10),
    total_teaching_hours: Math.round(totalDurationMin / 60 * 10) / 10,
    late_starts: lateStarts,
    late_by_total_minutes: Math.round(lateTotalSec / 60),
    batches: batchesResult.rows.map((r) => r.batch_name),
    overall_summary: overallSummary,
  };

  const reportType: ReportType = `teacher_${period}` as ReportType;

  const result = await db.query<{ id: string }>(
    `INSERT INTO monitoring_reports
      (report_type, report_period, period_start, period_end,
       target_email, target_role, target_name, metrics, generated_by)
     VALUES ($1, $2, $3::DATE, $4::DATE, $5, 'teacher', $6, $7, 'system')
     RETURNING id`,
    [
      reportType, period, period_start, period_end,
      teacher_email, teacherName, JSON.stringify(metrics),
    ]
  );

  return result.rows[0]?.id || 'unknown';
}

/* ═══════════════════════════════════════════════════════════════
   REPORT QUERIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * List monitoring reports with filtering.
 */
export async function listMonitoringReports(opts: {
  report_type?: ReportType;
  report_period?: ReportPeriod;
  target_email?: string;
  target_role?: 'student' | 'teacher';
  batch_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ reports: MonitoringReport[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.report_type) {
    conditions.push(`report_type = $${idx++}`);
    params.push(opts.report_type);
  }
  if (opts.report_period) {
    conditions.push(`report_period = $${idx++}`);
    params.push(opts.report_period);
  }
  if (opts.target_email) {
    conditions.push(`target_email = $${idx++}`);
    params.push(opts.target_email);
  }
  if (opts.target_role) {
    conditions.push(`target_role = $${idx++}`);
    params.push(opts.target_role);
  }
  if (opts.batch_id) {
    conditions.push(`batch_id = $${idx++}`);
    params.push(opts.batch_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const [dataResult, countResult] = await Promise.all([
    db.query<MonitoringReport>(
      `SELECT * FROM monitoring_reports ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    db.query<{ cnt: string }>(
      `SELECT COUNT(*)::TEXT AS cnt FROM monitoring_reports ${where}`,
      params
    ),
  ]);

  return {
    reports: dataResult.rows,
    total: parseInt(countResult.rows[0]?.cnt || '0', 10),
  };
}

/**
 * Get a single report by ID.
 */
export async function getMonitoringReport(reportId: string): Promise<MonitoringReport | null> {
  const result = await db.query<MonitoringReport>(
    `SELECT * FROM monitoring_reports WHERE id = $1`,
    [reportId]
  );
  return result.rows[0] || null;
}

/**
 * Mark a report as sent to parent.
 */
export async function markReportSentToParent(reportId: string, parentEmail: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE monitoring_reports
     SET sent_to_parent = true, parent_email = $2, sent_at = NOW()
     WHERE id = $1`,
    [reportId, parentEmail]
  );
  return (result.rowCount ?? 0) > 0;
}

/* ═══════════════════════════════════════════════════════════════
   SUMMARY TEXT GENERATORS
   ═══════════════════════════════════════════════════════════════ */

function generateStudentSummaryText(data: {
  name: string;
  attendanceRate: number;
  avgAttention: number;
  eyesClosedMin: number;
  lookingAwayMin: number;
  distractedMin: number;
  handRaises: number;
  totalSessions: number;
  sessionsPresent: number;
  phoneDetectedMin: number;
  lateJoinCount: number;
  avgLateMin: number;
  leaveRequests: number;
  micOffCount: number;
  cameraOffCount: number;
  contactViolations: number;
  avgFeedbackRating: number;
  tabSwitchedMin?: number;
  tabSwitchCount?: number;
  yawningMin?: number;
  inactiveMin?: number;
  headTurnedMin?: number;
}): string {
  const parts: string[] = [];

  parts.push(`${data.name} attended ${data.sessionsPresent} of ${data.totalSessions} classes (${data.attendanceRate}% attendance).`);

  if (data.avgAttention >= 80) {
    parts.push(`Overall attention level is excellent (${data.avgAttention}%).`);
  } else if (data.avgAttention >= 60) {
    parts.push(`Overall attention level is good (${data.avgAttention}%) with room for improvement.`);
  } else if (data.avgAttention >= 40) {
    parts.push(`Attention level needs improvement (${data.avgAttention}%). Student shows signs of disengagement during class.`);
  } else {
    parts.push(`Attention level is concerning (${data.avgAttention}%). Student frequently appears disengaged or distracted.`);
  }

  if (data.eyesClosedMin > 5) {
    parts.push(`Student appeared drowsy/sleeping for approximately ${data.eyesClosedMin} minutes total.`);
  }
  if (data.lookingAwayMin > 10) {
    parts.push(`Student was looking away from the screen for approximately ${data.lookingAwayMin} minutes.`);
  }
  if (data.distractedMin > 10) {
    parts.push(`Student showed signs of distraction for approximately ${data.distractedMin} minutes.`);
  }
  if (data.phoneDetectedMin > 0) {
    parts.push(`Phone usage detected for approximately ${data.phoneDetectedMin} minutes.`);
  }
  if ((data.tabSwitchedMin ?? 0) > 2) {
    parts.push(`Student switched away from class tab for ${data.tabSwitchedMin} minutes (${data.tabSwitchCount ?? 0} switches).`);
  }
  if ((data.yawningMin ?? 0) > 3) {
    parts.push(`Frequent yawning detected (${data.yawningMin} minutes), indicating possible fatigue.`);
  }
  if ((data.inactiveMin ?? 0) > 5) {
    parts.push(`Student was away from the class (tab switched or not on screen) for a total of ${data.inactiveMin} minutes.`);
  }
  if ((data.headTurnedMin ?? 0) > 5) {
    parts.push(`Student had head turned away from screen for ${data.headTurnedMin} minutes.`);
  }
  if (data.handRaises > 0) {
    parts.push(`Student raised hand ${data.handRaises} time${data.handRaises > 1 ? 's' : ''}, showing active participation.`);
  }

  // Punctuality
  if (data.lateJoinCount > 0) {
    parts.push(`Joined late ${data.lateJoinCount} time${data.lateJoinCount > 1 ? 's' : ''} (avg ${data.avgLateMin} min late).`);
  } else if (data.sessionsPresent > 0) {
    parts.push(`Punctuality is excellent — always joined on time.`);
  }

  // Leave & discipline
  if (data.leaveRequests > 0) {
    parts.push(`Requested to leave class ${data.leaveRequests} time${data.leaveRequests > 1 ? 's' : ''}.`);
  }
  if (data.micOffCount > 3) {
    parts.push(`Mic was turned off ${data.micOffCount} times.`);
  }
  if (data.cameraOffCount > 3) {
    parts.push(`Camera was turned off ${data.cameraOffCount} times.`);
  }

  // Safety & feedback
  if (data.contactViolations > 0) {
    parts.push(`⚠️ ${data.contactViolations} contact violation${data.contactViolations > 1 ? 's' : ''} detected — requires attention.`);
  }
  if (data.avgFeedbackRating > 0) {
    parts.push(`Average session feedback rating: ${data.avgFeedbackRating}/5.`);
  }

  return parts.join(' ');
}

function generateTeacherSummaryText(data: {
  name: string;
  sessionsConducted: number;
  sessionsCancelled: number;
  lateStarts: number;
  onTimeRate: number;
  totalHours: number;
  avgEngagement: number;
}): string {
  const parts: string[] = [];

  parts.push(`${data.name} conducted ${data.sessionsConducted} session${data.sessionsConducted !== 1 ? 's' : ''} totaling ${data.totalHours} teaching hours.`);

  if (data.sessionsCancelled > 0) {
    parts.push(`${data.sessionsCancelled} session${data.sessionsCancelled > 1 ? 's were' : ' was'} cancelled.`);
  }

  if (data.lateStarts > 0) {
    parts.push(`${data.lateStarts} session${data.lateStarts > 1 ? 's' : ''} started late. On-time rate: ${data.onTimeRate}%.`);
  } else {
    parts.push(`All sessions started on time (${data.onTimeRate}% punctuality).`);
  }

  if (data.avgEngagement >= 75) {
    parts.push(`Average student engagement was excellent at ${data.avgEngagement}%.`);
  } else if (data.avgEngagement >= 50) {
    parts.push(`Average student engagement was ${data.avgEngagement}%, moderate level.`);
  } else if (data.avgEngagement > 0) {
    parts.push(`Average student engagement was low at ${data.avgEngagement}%.`);
  }

  return parts.join(' ');
}
