import { db } from '@/lib/db';

/**
 * Attendance management helpers.
 *
 * Core operations:
 *   - recordJoin()    — called when participant connects
 *   - recordLeave()   — called when participant disconnects
 *   - getAttendance() — returns full attendance for a room
 *   - getJoinLogs()   — returns detailed join/leave/rejoin timeline
 */

// ── Record a join event ──────────────────────────────────────
export async function recordJoin(
  roomId: string,
  email: string,
  name: string,
  role: string,
  scheduledStart: string | null,
): Promise<void> {
  const now = new Date();

  // Calculate if late (5-minute grace period)
  const LATE_GRACE_SEC = 5 * 60;
  let isLate = false;
  let lateBySec = 0;
  if (scheduledStart && role === 'student') {
    const start = new Date(scheduledStart);
    if (!isNaN(start.getTime())) {
      const diffSec = Math.floor((now.getTime() - start.getTime()) / 1000);
      if (diffSec > LATE_GRACE_SEC) {
        isLate = true;
        lateBySec = diffSec;
      }
    }
  }

  // Single round-trip: upsert + log via CTE.
  // `xmax = 0` is the Postgres trick to detect whether the ON CONFLICT path
  // performed an INSERT (xmax=0, fresh row) or UPDATE (xmax!=0, existing row).
  // This correctly distinguishes 'join' (first time) from 'rejoin' WITHOUT
  // the previous bug of reading join_count after it had already been
  // incremented by the upsert.
  await db.query(
    `WITH upsert AS (
       INSERT INTO attendance_sessions (
         room_id, participant_email, participant_name, participant_role,
         first_join_at, join_count, status, late_join, late_by_sec
       )
       VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8)
       ON CONFLICT (room_id, participant_email) DO UPDATE SET
         join_count = attendance_sessions.join_count + 1,
         status = CASE
           WHEN attendance_sessions.status = 'absent' THEN $6
           ELSE attendance_sessions.status
         END,
         late_join = CASE
           WHEN attendance_sessions.first_join_at IS NULL THEN $7
           ELSE attendance_sessions.late_join
         END,
         late_by_sec = CASE
           WHEN attendance_sessions.first_join_at IS NULL THEN $8
           ELSE attendance_sessions.late_by_sec
         END,
         first_join_at = COALESCE(attendance_sessions.first_join_at, $5),
         updated_at = NOW()
       RETURNING (xmax = 0) AS inserted
     ),
     join_log AS (
       INSERT INTO attendance_logs (
         room_id, participant_email, participant_name, participant_role,
         event_type, event_at
       )
       SELECT $1, $2, $3, $4,
         CASE WHEN (SELECT inserted FROM upsert) THEN 'join' ELSE 'rejoin' END,
         $5
       RETURNING 1
     )
     INSERT INTO attendance_logs (
       room_id, participant_email, participant_name, participant_role,
       event_type, event_at, payload
     )
     SELECT $1, $2, $3, $4, 'late_join', $5, $9::jsonb
     WHERE $7::boolean = true AND (SELECT inserted FROM upsert) = true`,
    [
      roomId, email, name, role, now,
      isLate ? 'late' : 'present', isLate, lateBySec,
      JSON.stringify({ late_by_sec: lateBySec }),
    ],
  );
}

// ── Record a leave event ─────────────────────────────────────
export async function recordLeave(
  roomId: string,
  email: string,
  name: string,
  role: string,
  roomEnded = false,
): Promise<void> {
  const now = new Date();

  // Update session: set last_leave_at + compute duration
  // If student leaves while room is still live → mark as left_early
  await db.query(
    `UPDATE attendance_sessions SET
       last_leave_at = $3,
       total_duration_sec = total_duration_sec + COALESCE(
         EXTRACT(EPOCH FROM ($3::timestamptz - COALESCE(
           (SELECT event_at FROM attendance_logs
            WHERE room_id = $1 AND participant_email = $2
            AND event_type IN ('join', 'rejoin')
            ORDER BY event_at DESC LIMIT 1),
           first_join_at
         )))::integer, 0
       ),
       status = CASE
         WHEN $4 = false AND participant_role = 'student'
              AND status IN ('present', 'late')
         THEN 'left_early'
         ELSE status
       END,
       updated_at = NOW()
     WHERE room_id = $1 AND participant_email = $2`,
    [roomId, email, now, roomEnded],
  );

  // Log the leave
  await db.query(
    `INSERT INTO attendance_logs (room_id, participant_email, participant_name, participant_role, event_type, event_at)
     VALUES ($1, $2, $3, $4, 'leave', $5)`,
    [roomId, email, name, role, now],
  );
}

// ── Record leave request/approval/denial ─────────────────────
export async function recordLeaveAction(
  roomId: string,
  email: string,
  action: 'leave_request' | 'leave_approved' | 'leave_denied',
  payload?: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO attendance_logs (room_id, participant_email, event_type, event_at, payload)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [roomId, email, action, payload ? JSON.stringify(payload) : null],
  );

  if (action === 'leave_request') {
    await db.query(
      `UPDATE attendance_sessions SET
         leave_request_count = COALESCE(leave_request_count, 0) + 1,
         updated_at = NOW()
       WHERE room_id = $1 AND participant_email = $2`,
      [roomId, email],
    );
  }

  if (action === 'leave_approved') {
    await db.query(
      `UPDATE attendance_sessions SET
         leave_approved = true,
         status = 'left_early',
         updated_at = NOW()
       WHERE room_id = $1 AND participant_email = $2`,
      [roomId, email],
    );
  }
}

// ── Get attendance for a room ────────────────────────────────
export interface AttendanceRecord {
  participant_email: string;
  participant_name: string;
  participant_role: string;
  status: string;
  first_join_at: string | null;
  last_leave_at: string | null;
  total_duration_sec: number;
  join_count: number;
  late_join: boolean;
  late_by_sec: number;
  leave_approved: boolean | null;
  teacher_remarks: string | null;
  attention_avg: number;
}

export async function getAttendance(roomId: string): Promise<AttendanceRecord[]> {
  const result = await db.query(
    `SELECT participant_email, participant_name, participant_role,
            status, first_join_at, last_leave_at, total_duration_sec,
            join_count, late_join, late_by_sec, leave_approved, teacher_remarks,
            COALESCE(attention_avg, 0) AS attention_avg
     FROM attendance_sessions
     WHERE room_id = $1
     ORDER BY first_join_at ASC NULLS LAST`,
    [roomId],
  );
  return result.rows as unknown as AttendanceRecord[];
}

// ── Get join logs timeline ───────────────────────────────────
export interface JoinLogEntry {
  participant_email: string;
  participant_name: string | null;
  participant_role: string | null;
  event_type: string;
  event_at: string;
  payload: Record<string, unknown> | null;
}

export async function getJoinLogs(roomId: string): Promise<JoinLogEntry[]> {
  const result = await db.query(
    `SELECT participant_email, participant_name, participant_role,
            event_type, event_at, payload
     FROM attendance_logs
     WHERE room_id = $1
     ORDER BY event_at ASC`,
    [roomId],
  );
  return result.rows as unknown as JoinLogEntry[];
}

// ── Enhanced attendance for BC/teacher — includes unjoined + contact info ──
export interface EnhancedAttendanceRecord extends AttendanceRecord {
  student_phone: string | null;
  student_whatsapp: string | null;
  parent_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_whatsapp: string | null;
  is_guest: boolean;
}

export async function getEnhancedAttendance(roomId: string): Promise<EnhancedAttendanceRecord[]> {
  const result = await db.query(
    `WITH enrolled AS (
       -- From room_assignments
       SELECT ra.participant_email, ra.participant_name
       FROM room_assignments ra
       WHERE ra.room_id = $1 AND ra.participant_type = 'student'
       UNION
       -- From batch_students (fallback for older sessions without room_assignments)
       SELECT bs.student_email, COALESCE(pu.full_name, bs.student_email)
       FROM batch_students bs
       JOIN rooms r ON r.batch_id = bs.batch_id AND r.room_id = $1
       LEFT JOIN portal_users pu ON pu.email = bs.student_email
     )
     SELECT
       e.participant_email,
       e.participant_name,
       'student' AS participant_role,
       COALESCE(att.status, 'not_joined') AS status,
       att.first_join_at,
       att.last_leave_at,
       COALESCE(att.total_duration_sec, 0) AS total_duration_sec,
       COALESCE(att.join_count, 0) AS join_count,
       COALESCE(att.late_join, false) AS late_join,
       COALESCE(att.late_by_sec, 0) AS late_by_sec,
       att.leave_approved,
       att.teacher_remarks,
       up.phone AS student_phone,
       up.whatsapp AS student_whatsapp,
       up.parent_email,
       pparent.full_name AS parent_name,
       upp.phone AS parent_phone,
       upp.whatsapp AS parent_whatsapp,
       CASE WHEN pu_check.email IS NULL THEN true ELSE false END AS is_guest
     FROM enrolled e
     LEFT JOIN attendance_sessions att ON att.room_id = $1 AND att.participant_email = e.participant_email
     LEFT JOIN user_profiles up ON up.email = e.participant_email
     LEFT JOIN portal_users pparent ON pparent.email = up.parent_email
     LEFT JOIN user_profiles upp ON upp.email = up.parent_email
     LEFT JOIN portal_users pu_check ON pu_check.email = e.participant_email
     ORDER BY att.first_join_at ASC NULLS LAST`,
    [roomId],
  );
  return result.rows as unknown as EnhancedAttendanceRecord[];
}

// ── Mark all absent students who never joined ────────────────
export async function finalizeAttendance(roomId: string): Promise<void> {
  // Get all assigned students (room_assignments + batch_students fallback)
  const assigned = await db.query(
    `SELECT participant_email, participant_name FROM room_assignments
     WHERE room_id = $1 AND participant_type = 'student'
     UNION
     SELECT bs.student_email, COALESCE(pu.full_name, bs.student_email)
     FROM batch_students bs
     JOIN rooms r ON r.batch_id = bs.batch_id AND r.room_id = $1
     LEFT JOIN portal_users pu ON pu.email = bs.student_email`,
    [roomId],
  );

  for (const row of assigned.rows) {
    const r = row as { participant_email: string; participant_name: string };
    await db.query(
      `INSERT INTO attendance_sessions (room_id, participant_email, participant_name, participant_role, status)
       VALUES ($1, $2, $3, 'student', 'absent')
       ON CONFLICT (room_id, participant_email) DO NOTHING`,
      [roomId, r.participant_email, r.participant_name],
    );
  }

  // Compute attention_avg from class_monitoring_events for each student
  await db.query(
    `UPDATE attendance_sessions a SET attention_avg = sub.score
     FROM (
       SELECT student_email,
         CASE WHEN SUM(duration_seconds) > 0
           THEN ROUND(SUM(CASE WHEN event_type = 'attentive' THEN duration_seconds ELSE 0 END)::numeric
                       / SUM(duration_seconds) * 100)
           ELSE NULL END AS score
       FROM class_monitoring_events WHERE room_id = $1
       GROUP BY student_email
     ) sub
     WHERE a.room_id = $1 AND a.participant_email = sub.student_email AND sub.score IS NOT NULL`,
    [roomId],
  );
}

// ── Record a media event (mic/camera off/on) ─────────────────
export async function recordMediaEvent(
  roomId: string,
  email: string,
  eventType: 'mic_off' | 'mic_on' | 'camera_off' | 'camera_on',
  payload?: Record<string, unknown>,
): Promise<void> {
  // Log the event
  await db.query(
    `INSERT INTO attendance_logs (room_id, participant_email, event_type, event_at, payload)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [roomId, email, eventType, payload ? JSON.stringify(payload) : null],
  );

  // Increment counters on attendance_sessions
  if (eventType === 'mic_off') {
    await db.query(
      `UPDATE attendance_sessions SET mic_off_count = COALESCE(mic_off_count, 0) + 1, updated_at = NOW()
       WHERE room_id = $1 AND participant_email = $2`,
      [roomId, email],
    );
  } else if (eventType === 'camera_off') {
    await db.query(
      `UPDATE attendance_sessions SET camera_off_count = COALESCE(camera_off_count, 0) + 1, updated_at = NOW()
       WHERE room_id = $1 AND participant_email = $2`,
      [roomId, email],
    );
  }
}

// ── Record leave request count increment ─────────────────────
export async function incrementLeaveRequestCount(
  roomId: string,
  email: string,
): Promise<void> {
  await db.query(
    `UPDATE attendance_sessions SET leave_request_count = COALESCE(leave_request_count, 0) + 1, updated_at = NOW()
     WHERE room_id = $1 AND participant_email = $2`,
    [roomId, email],
  );
}

// ── Record attention report (MediaPipe) ──────────────────────
export async function recordAttentionReport(
  roomId: string,
  email: string,
  score: number,
  details?: Record<string, unknown>,
): Promise<void> {
  // Log the attention data
  await db.query(
    `INSERT INTO attendance_logs (room_id, participant_email, event_type, event_at, payload)
     VALUES ($1, $2, 'attention_report', NOW(), $3)`,
    [roomId, email, JSON.stringify({ score, ...details })],
  );

  // Update average attention score on the session
  await db.query(
    `UPDATE attendance_sessions SET attention_avg = $3, updated_at = NOW()
     WHERE room_id = $1 AND participant_email = $2`,
    [roomId, email, Math.round(score)],
  );
}
