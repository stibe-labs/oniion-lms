// ═══════════════════════════════════════════════════════════════
// stibe Portal — Core Monitoring Library
// ═══════════════════════════════════════════════════════════════
// Handles: event ingestion, alert generation, threshold checking,
// real-time session monitoring queries.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type MonitoringEventType =
  | 'attentive'
  | 'looking_away'
  | 'eyes_closed'
  | 'not_in_frame'
  | 'low_engagement'
  | 'hand_raised'
  | 'speaking'
  | 'distracted'
  | 'phone_detected'
  | 'multiple_faces'
  | 'tab_switched'
  | 'yawning'
  | 'inactive'
  | 'head_turned'
  // v3 — writing-aware positive/neutral states (count as engaged time)
  | 'writing_notes'
  | 'brief_absence'
  | 'low_visibility'
  | 'in_exam'
  // v3.1 additions
  | 'thinking'
  | 'reading_material';

export type AlertType =
  | 'teacher_absent'
  | 'teacher_camera_off'
  | 'class_started_late'
  | 'class_cancelled'
  | 'low_attendance'
  | 'student_sleeping'
  | 'student_not_looking'
  | 'student_left_frame'
  | 'student_distracted'
  | 'class_disruption'
  | 'contact_violation'
  | 'phone_detected'
  | 'unusual_leave'
  | 'tab_switching'
  | 'student_yawning'
  | 'student_inactive'
  | 'head_turned'
  | 'multiple_faces_detected';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'dismissed' | 'resolved' | 'escalated';

export interface MonitoringEvent {
  room_id: string;
  session_id?: string;
  student_email: string;
  student_name?: string;
  event_type: MonitoringEventType;
  confidence?: number;
  duration_seconds?: number;
  details?: Record<string, unknown>;
}

export interface MonitoringAlert {
  [key: string]: unknown;
  id: string;
  room_id: string | null;
  session_id: string | null;
  batch_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  target_email: string | null;
  notify_coordinator: boolean;
  notify_ao: boolean;
  notify_teacher: boolean;
  status: AlertStatus;
  dismissed_by: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface SessionMonitoringSummary {
  room_id: string;
  total_events: number;
  students: StudentMonitoringState[];
  alerts: MonitoringAlert[];
  class_engagement_score: number;
  started_at: string | null;
}

export interface StudentMonitoringState {
  email: string;
  name: string;
  current_state: MonitoringEventType;
  attention_score: number;         // 0-100
  looking_away_minutes: number;
  eyes_closed_minutes: number;
  not_in_frame_minutes: number;
  distracted_minutes: number;
  tab_switched_minutes: number;
  yawning_minutes: number;
  inactive_minutes: number;
  head_turned_minutes: number;
  total_attentive_minutes: number;
  last_event_at: string;
  active_alerts: number;
}

/* ═══════════════════════════════════════════════════════════════
   ALERT THRESHOLDS (configurable)
   ═══════════════════════════════════════════════════════════════ */

// v4 LIBERAL THRESHOLDS — alerts only for truly sustained, real-life issues
// All thresholds represent "continuously in this state for N seconds"
// (checked via event-density in a window, not just accumulated total)
export const ALERT_THRESHOLDS = {
  student_sleeping_seconds: 180,       // 3 min continuous eyes closed (was 5 min)
  student_not_looking_seconds: 480,    // 8 min looking away — glancing around is normal (was 5 min)
  student_left_frame_seconds: 180,     // 3 min not in frame — real absence (was 5 min)
  student_distracted_seconds: 600,     // 10 min distracted
  teacher_absent_seconds: 300,         // 5 min teacher absent
  low_attendance_percent: 50,
  low_attendance_wait_seconds: 600,
  class_disruption_threshold: 0.5,
  phone_detected_seconds: 120,         // 2 min phone visible (was 3 min)
  tab_switching_seconds: 180,          // 3 min continuous tab switch — clear signal (was 5 min)
  student_yawning_seconds: 1200,       // 20 min yawning — extremely liberal (was 10 min)
  student_inactive_seconds: 900,       // 15 min no input (was 10 min)
  head_turned_seconds: 900,            // 15 min head turned — very liberal (was 10 min)
  multiple_faces_seconds: 180,         // 3 min multiple faces
};

/* ═══════════════════════════════════════════════════════════════
   EVENT INGESTION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ingest a batch of monitoring events from a student's MediaPipe client.
 * Called every 30 seconds from the student's browser.
 */
export async function ingestMonitoringEvents(events: MonitoringEvent[]): Promise<{ inserted: number; alerts_generated: number }> {
  if (events.length === 0) return { inserted: 0, alerts_generated: 0 };

  let inserted = 0;
  let alertsGenerated = 0;

  for (const evt of events) {
    // Insert event
    await db.query(
      `INSERT INTO class_monitoring_events
        (room_id, session_id, student_email, student_name, event_type, confidence, duration_seconds, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        evt.room_id,
        evt.session_id || null,
        evt.student_email,
        evt.student_name || null,
        evt.event_type,
        evt.confidence ?? 100,
        evt.duration_seconds ?? 0,
        JSON.stringify(evt.details || {}),
      ]
    );
    inserted++;

    // Check if alert should be generated based on accumulated duration
    const alertResult = await checkAndCreateAlert(evt);
    if (alertResult) alertsGenerated++;
  }

  return { inserted, alerts_generated: alertsGenerated };
}

/* ═══════════════════════════════════════════════════════════════
   ALERT GENERATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Check accumulated event duration and generate alerts if thresholds exceeded.
 * Only creates one alert per type per student per session (avoids spam).
 */
async function checkAndCreateAlert(evt: MonitoringEvent): Promise<boolean> {
  // Only generate alerts for negative events
  if (evt.event_type === 'attentive' || evt.event_type === 'hand_raised' || evt.event_type === 'speaking') {
    return false;
  }
  // v3 — positive/neutral states never generate alerts
  if (evt.event_type === 'writing_notes' || evt.event_type === 'brief_absence'
      || evt.event_type === 'low_visibility' || evt.event_type === 'in_exam'
      || evt.event_type === 'thinking' || evt.event_type === 'reading_material') {
    return false;
  }

  // Determine alert type and threshold
  let alertType: AlertType | null = null;
  let threshold = 0;
  let severity: AlertSeverity = 'warning';

  switch (evt.event_type) {
    case 'eyes_closed':
      alertType = 'student_sleeping';
      threshold = ALERT_THRESHOLDS.student_sleeping_seconds;
      severity = 'critical';
      break;
    case 'looking_away':
      alertType = 'student_not_looking';
      threshold = ALERT_THRESHOLDS.student_not_looking_seconds;
      severity = 'warning';
      break;
    case 'not_in_frame':
      alertType = 'student_left_frame';
      threshold = ALERT_THRESHOLDS.student_left_frame_seconds;
      severity = 'warning';
      break;
    case 'distracted':
      alertType = 'student_distracted';
      threshold = ALERT_THRESHOLDS.student_distracted_seconds;
      severity = 'warning';
      break;
    case 'phone_detected':
      alertType = 'phone_detected';
      threshold = ALERT_THRESHOLDS.phone_detected_seconds;
      severity = 'warning';
      break;
    case 'tab_switched':
      alertType = 'tab_switching';
      threshold = ALERT_THRESHOLDS.tab_switching_seconds;
      severity = 'critical';
      break;
    case 'yawning':
      alertType = 'student_yawning';
      threshold = ALERT_THRESHOLDS.student_yawning_seconds;
      severity = 'info';
      break;
    case 'inactive':
      alertType = 'student_inactive';
      threshold = ALERT_THRESHOLDS.student_inactive_seconds;
      severity = 'warning';
      break;
    case 'head_turned':
      alertType = 'head_turned';
      threshold = ALERT_THRESHOLDS.head_turned_seconds;
      severity = 'warning';
      break;
    case 'multiple_faces':
      alertType = 'multiple_faces_detected';
      threshold = ALERT_THRESHOLDS.multiple_faces_seconds;
      severity = 'warning';
      break;
    default:
      return false;
  }

  if (!alertType) return false;

  // v4 CONTINUOUS-STATE CHECK:
  // An alert fires only if the student is CURRENTLY in this bad state AND has been
  // continuously in it for ≥ threshold seconds.
  // "Continuous" = in the last (threshold + 60s) window, ≥70% of their events are
  // this event type AND at least one event arrived in the last 45 seconds (active now).
  //
  // This prevents alerting on historical accumulation (e.g. was distracted 2h ago)
  // and instead catches genuine sustained problems happening RIGHT NOW.
  const windowSec = Math.min(threshold + 60, 600);
  const minMatchEvents = Math.max(3, Math.ceil(threshold / 30));

  const continuityResult = await db.query<{ matching: string; total: string; recent: string }>(
    `SELECT
       COUNT(CASE WHEN event_type = $3 THEN 1 END)::TEXT AS matching,
       COUNT(*)::TEXT AS total,
       COUNT(CASE WHEN event_type = $3 AND created_at >= NOW() - INTERVAL '45 seconds' THEN 1 END)::TEXT AS recent
     FROM class_monitoring_events
     WHERE room_id = $1
       AND student_email = $2
       AND created_at >= NOW() - ($4 || ' seconds')::INTERVAL`,
    [evt.room_id, evt.student_email, evt.event_type, windowSec]
  );

  const matching = parseInt(continuityResult.rows[0]?.matching || '0', 10);
  const total = parseInt(continuityResult.rows[0]?.total || '0', 10);
  const recentCount = parseInt(continuityResult.rows[0]?.recent || '0', 10);

  // Must be: currently active (recent event) + sustained (≥70% of window events are this type)
  if (recentCount === 0 || matching < minMatchEvents || total < 2 || matching / total < 0.70) {
    return false;
  }

  // Check if we already generated this alert recently (30 min cooldown)
  const existing = await db.query(
    `SELECT id FROM monitoring_alerts
     WHERE room_id = $1
       AND target_email = $2
       AND alert_type = $3
       AND status = 'active'
       AND created_at >= NOW() - INTERVAL '30 minutes'`,
    [evt.room_id, evt.student_email, alertType]
  );

  if (existing.rows.length > 0) return false;

  // Generate alert
  const name = evt.student_name || evt.student_email.split('@')[0];
  const minutes = Math.round(threshold / 60);

  const messages: Record<string, string> = {
    student_sleeping: `${name} appears to be sleeping (eyes closed for ${minutes} minutes)`,
    student_not_looking: `${name} not looking at class for ${minutes} minutes`,
    student_left_frame: `${name} left the camera frame for ${minutes} minutes`,
    student_distracted: `${name} showing distracted behavior for ${minutes} minutes`,
    phone_detected: `${name} appears to be using phone in class`,
    tab_switching: `${name} switched to another tab/app for ${minutes} minutes`,
    student_yawning: `${name} has been yawning frequently (${minutes} min)`,
    student_inactive: `${name} appears inactive — no input for ${minutes} minutes`,
    head_turned: `${name} is looking away from screen (head turned for ${minutes} min)`,
    multiple_faces_detected: `Multiple faces detected at ${name}'s workstation`,
  };

  const titles: Record<string, string> = {
    student_sleeping: `Student Sleeping — ${name}`,
    student_not_looking: `Not Paying Attention — ${name}`,
    student_left_frame: `Student Left Frame — ${name}`,
    student_distracted: `Student Distracted — ${name}`,
    phone_detected: `Phone Detected — ${name}`,
    tab_switching: `Tab Switched — ${name}`,
    student_yawning: `Frequent Yawning — ${name}`,
    student_inactive: `Student Inactive — ${name}`,
    head_turned: `Head Turned Away — ${name}`,
    multiple_faces_detected: `Multiple Faces — ${name}`,
  };

  await db.query(
    `INSERT INTO monitoring_alerts
      (room_id, session_id, alert_type, severity, title, message, target_email,
       notify_coordinator, notify_ao, notify_teacher)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, true)`,
    [
      evt.room_id,
      evt.session_id || null,
      alertType,
      severity,
      titles[alertType] || `Alert: ${alertType}`,
      messages[alertType] || `Monitoring alert for ${name}`,
      evt.student_email,
    ]
  );

  // Also log as room_event
  await db.query(
    `INSERT INTO room_events (room_id, event_type, participant_email, payload)
     VALUES ($1, 'monitoring_alert', $2, $3)`,
    [
      evt.room_id,
      evt.student_email,
      JSON.stringify({ alert_type: alertType, severity, message: messages[alertType] }),
    ]
  );

  return true;
}

/**
 * Create a teacher-specific alert (late start, camera off, absent, etc.)
 */
export async function createTeacherAlert(params: {
  room_id: string;
  session_id?: string;
  batch_id?: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  teacher_email: string;
  teacher_name?: string;
  message: string;
}): Promise<string | null> {
  const { room_id, session_id, batch_id, alert_type, severity, teacher_email, teacher_name, message } = params;

  // Check for duplicate active alert
  const existing = await db.query(
    `SELECT id FROM monitoring_alerts
     WHERE room_id = $1
       AND alert_type = $2
       AND status = 'active'
       AND created_at >= NOW() - INTERVAL '30 minutes'`,
    [room_id, alert_type]
  );
  if (existing.rows.length > 0) return null;

  const name = teacher_name || teacher_email.split('@')[0];
  const title = `Teacher Alert — ${name}`;

  const result = await db.query<{ id: string }>(
    `INSERT INTO monitoring_alerts
      (room_id, session_id, batch_id, alert_type, severity, title, message, target_email,
       notify_coordinator, notify_ao, notify_teacher)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true, false)
     RETURNING id`,
    [room_id, session_id || null, batch_id || null, alert_type, severity, title, message, teacher_email]
  );

  return result.rows[0]?.id || null;
}

/* ═══════════════════════════════════════════════════════════════
   SESSION MONITORING QUERIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get live monitoring summary for a session/room.
 * Aggregates recent events per student and computes engagement scores.
 */
export async function getSessionMonitoringSummary(roomId: string): Promise<SessionMonitoringSummary> {
  // Get per-student aggregated state from last 10 minutes
  // v4: GREATEST(duration_seconds, 2) treats every event as at least 2s so that
  // ratio-based attention score is meaningful even when client sends duration=0
  const studentStates = await db.query<{
    student_email: string;
    student_name: string;
    total_events: string;
    attentive_sec: string;
    looking_away_sec: string;
    eyes_closed_sec: string;
    not_in_frame_sec: string;
    distracted_sec: string;
    tab_switched_sec: string;
    yawning_sec: string;
    inactive_sec: string;
    head_turned_sec: string;
    last_event_type: string;
    last_event_at: string;
  }>(
    `SELECT
       student_email,
       COALESCE(student_name, split_part(student_email, '@', 1)) AS student_name,
       COUNT(*)::TEXT AS total_events,
       COALESCE(SUM(CASE WHEN event_type = 'attentive' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS attentive_sec,
       COALESCE(SUM(CASE WHEN event_type = 'looking_away' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS looking_away_sec,
       COALESCE(SUM(CASE WHEN event_type = 'eyes_closed' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS eyes_closed_sec,
       COALESCE(SUM(CASE WHEN event_type = 'not_in_frame' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS not_in_frame_sec,
       COALESCE(SUM(CASE WHEN event_type = 'distracted' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS distracted_sec,
       COALESCE(SUM(CASE WHEN event_type = 'tab_switched' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS tab_switched_sec,
       COALESCE(SUM(CASE WHEN event_type = 'yawning' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS yawning_sec,
       COALESCE(SUM(CASE WHEN event_type = 'inactive' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS inactive_sec,
       COALESCE(SUM(CASE WHEN event_type = 'head_turned' THEN GREATEST(duration_seconds, 2) ELSE 0 END), 0)::TEXT AS head_turned_sec,
       (ARRAY_AGG(event_type ORDER BY created_at DESC))[1] AS last_event_type,
       MAX(created_at)::TEXT AS last_event_at
     FROM class_monitoring_events
     WHERE room_id = $1
       AND created_at >= NOW() - INTERVAL '10 minutes'
     GROUP BY student_email, student_name`,
    [roomId]
  );

  const students: StudentMonitoringState[] = studentStates.rows.map((row) => {
    const attentiveSec = parseInt(row.attentive_sec, 10);
    const lookingAwaySec = parseInt(row.looking_away_sec, 10);
    const eyesClosedSec = parseInt(row.eyes_closed_sec, 10);
    const notInFrameSec = parseInt(row.not_in_frame_sec, 10);
    const distractedSec = parseInt(row.distracted_sec, 10);
    const tabSwitchedSec = parseInt(row.tab_switched_sec, 10);
    const yawningSec = parseInt(row.yawning_sec, 10);
    const inactiveSec = parseInt(row.inactive_sec, 10);
    const headTurnedSec = parseInt(row.head_turned_sec, 10);

    // v4 Weighted attention score:
    // Tab-switching and not-in-frame heavily penalize; looking_away/head_turned barely penalize
    // (glancing around and head movement are normal real-life classroom behaviors)
    const penaltyWeighted =
      tabSwitchedSec * 1.5 +      // heaviest: clearly disengaged
      notInFrameSec * 1.3 +       // heavy: not physically present
      eyesClosedSec * 1.1 +       // moderate: might be sleeping
      distractedSec * 0.7 +       // light: general distraction
      inactiveSec * 0.5 +         // light: might just be still
      lookingAwaySec * 0.2 +      // very light: normal classroom behavior
      headTurnedSec * 0.15 +      // very light: normal — reaching, adjusting
      yawningSec * 0.05;           // almost none: completely normal
    const totalWeighted = attentiveSec + penaltyWeighted;
    const attentionScore = totalWeighted > 0 ? Math.round((attentiveSec / totalWeighted) * 100) : 50;

    return {
      email: row.student_email,
      name: row.student_name,
      current_state: row.last_event_type as MonitoringEventType,
      attention_score: attentionScore,
      looking_away_minutes: Math.round(lookingAwaySec / 60 * 10) / 10,
      eyes_closed_minutes: Math.round(eyesClosedSec / 60 * 10) / 10,
      not_in_frame_minutes: Math.round(notInFrameSec / 60 * 10) / 10,
      distracted_minutes: Math.round(distractedSec / 60 * 10) / 10,
      tab_switched_minutes: Math.round(tabSwitchedSec / 60 * 10) / 10,
      yawning_minutes: Math.round(yawningSec / 60 * 10) / 10,
      inactive_minutes: Math.round(inactiveSec / 60 * 10) / 10,
      head_turned_minutes: Math.round(headTurnedSec / 60 * 10) / 10,
      total_attentive_minutes: Math.round(attentiveSec / 60 * 10) / 10,
      last_event_at: row.last_event_at,
      active_alerts: 0,
    };
  });

  // Get active alerts for this room
  const alertsResult = await db.query<MonitoringAlert>(
    `SELECT * FROM monitoring_alerts
     WHERE room_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [roomId]
  );

  // Count active alerts per student
  for (const alert of alertsResult.rows) {
    const student = students.find((s) => s.email === alert.target_email);
    if (student) student.active_alerts++;
  }

  // Compute class engagement score
  const classScore = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.attention_score, 0) / students.length)
    : 0;

  // Total events count
  const totalEvents = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::TEXT AS cnt FROM class_monitoring_events WHERE room_id = $1`,
    [roomId]
  );

  return {
    room_id: roomId,
    total_events: parseInt(totalEvents.rows[0]?.cnt || '0', 10),
    students,
    alerts: alertsResult.rows,
    class_engagement_score: classScore,
    started_at: null,
  };
}

/**
 * Get all active alerts for coordinator or AO (filterable by role).
 */
export async function getActiveAlerts(opts: {
  role: 'batch_coordinator' | 'academic_operator';
  caller_email?: string;
  batch_id?: string;
  room_id?: string;
  target_email?: string;
  limit?: number;
}): Promise<MonitoringAlert[]> {
  const conditions = ['status = \'active\''];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.role === 'batch_coordinator') {
    conditions.push(`notify_coordinator = true`);
  } else {
    conditions.push(`notify_ao = true`);
  }

  // AO data isolation: only show alerts from AO's batches
  if (opts.role === 'academic_operator' && opts.caller_email) {
    conditions.push(`batch_id::text IN (SELECT batch_id FROM batches WHERE academic_operator_email = $${idx++})`);
    params.push(opts.caller_email);
  }

  if (opts.batch_id) {
    conditions.push(`batch_id::text = $${idx++}`);
    params.push(opts.batch_id);
  }
  if (opts.room_id) {
    conditions.push(`room_id = $${idx++}`);
    params.push(opts.room_id);
  }
  if (opts.target_email) {
    conditions.push(`target_email = $${idx++}`);
    params.push(opts.target_email);
  }

  const limit = opts.limit || 50;
  const result = await db.query<MonitoringAlert>(
    `SELECT * FROM monitoring_alerts
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT ${limit}`,
    params
  );

  return result.rows;
}

/**
 * Dismiss an alert.
 */
export async function dismissAlert(alertId: string, dismissedBy: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE monitoring_alerts
     SET status = 'dismissed', dismissed_by = $2, dismissed_at = NOW()
     WHERE id::text = $1 AND status = 'active'`,
    [alertId, dismissedBy]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Resolve an alert (auto-resolved when condition clears).
 */
export async function resolveAlert(alertId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE monitoring_alerts
     SET status = 'resolved'
     WHERE id::text = $1 AND status = 'active'`,
    [alertId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get recent alerts (last 24h) for all roles with pagination.
 */
export async function getAlertHistory(opts: {
  room_id?: string;
  batch_id?: string;
  alert_type?: string;
  target_email?: string;
  offset?: number;
  limit?: number;
}): Promise<{ alerts: MonitoringAlert[]; total: number }> {
  const conditions = ['created_at >= NOW() - INTERVAL \'24 hours\''];
  const params: unknown[] = [];
  let idx = 1;

  if (opts.room_id) {
    conditions.push(`room_id = $${idx++}`);
    params.push(opts.room_id);
  }
  if (opts.batch_id) {
    conditions.push(`batch_id = $${idx++}`);
    params.push(opts.batch_id);
  }
  if (opts.alert_type) {
    conditions.push(`alert_type = $${idx++}`);
    params.push(opts.alert_type);
  }
  if (opts.target_email) {
    conditions.push(`target_email = $${idx++}`);
    params.push(opts.target_email);
  }

  const where = conditions.join(' AND ');
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const [dataResult, countResult] = await Promise.all([
    db.query<MonitoringAlert>(
      `SELECT * FROM monitoring_alerts WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    db.query<{ cnt: string }>(
      `SELECT COUNT(*)::TEXT AS cnt FROM monitoring_alerts WHERE ${where}`,
      params
    ),
  ]);

  return {
    alerts: dataResult.rows,
    total: parseInt(countResult.rows[0]?.cnt || '0', 10),
  };
}

/**
 * Get teacher alerts for live room display.
 */
export async function getTeacherAlerts(roomId: string): Promise<MonitoringAlert[]> {
  const result = await db.query<MonitoringAlert>(
    `SELECT * FROM monitoring_alerts
     WHERE room_id = $1
       AND notify_teacher = true
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 20`,
    [roomId]
  );
  return result.rows;
}
