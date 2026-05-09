// ═══════════════════════════════════════════════════════════════
// Cascade Cleanup — Proper data cleanup for permanent deletes
// Handles all related data that lacks ON DELETE CASCADE FKs
// ═══════════════════════════════════════════════════════════════

import { PoolClient } from 'pg';

/**
 * Clean up ALL related data for the given batch session IDs.
 * Must be called within a transaction, BEFORE deleting batch_sessions.
 *
 * NOTE: Payment data (invoices, receipts, session_payments) is PRESERVED
 * so student payment history survives grade/batch transitions.
 * Payment data is only deleted when permanently deleting a user.
 */
export async function cleanupSessionData(client: PoolClient, sessionIds: string[]) {
  if (sessionIds.length === 0) return;

  // Find all rooms for these sessions
  const roomsRes = await client.query(
    `SELECT room_id FROM rooms WHERE batch_session_id = ANY($1::text[])`,
    [sessionIds]
  );
  const roomIds = roomsRes.rows.map((r: Record<string, string>) => r.room_id);

  // ── Phase 1: Tables with NO FK constraints (safe to delete in any order) ──
  if (roomIds.length > 0) {
    await client.query(`DELETE FROM class_monitoring_events WHERE room_id = ANY($1::text[])`, [roomIds]);
    await client.query(`DELETE FROM monitoring_alerts WHERE room_id = ANY($1::text[])`, [roomIds]);
    await client.query(`DELETE FROM room_chat_messages WHERE room_id = ANY($1::text[])`, [roomIds]);
    await client.query(`DELETE FROM cancellation_requests WHERE room_id = ANY($1::text[])`, [roomIds]);
    await client.query(`DELETE FROM teacher_reports WHERE room_id = ANY($1::text[])`, [roomIds]);
  }
  await client.query(`DELETE FROM session_requests WHERE batch_session_id = ANY($1::text[])`, [sessionIds]);
  // session_exam_results: FK SET NULL to rooms/sessions — delete explicitly to avoid orphans
  await client.query(`DELETE FROM session_exam_results WHERE session_id = ANY($1::text[])`, [sessionIds]);
  // homework_assignments: FK SET NULL on room_id, CASCADE to questions/submissions
  if (roomIds.length > 0) {
    await client.query(`DELETE FROM homework_assignments WHERE room_id = ANY($1::text[])`, [roomIds]);
  }

  // ── Phase 2: Nullify payment FK references (preserve payment data) ──
  await client.query(`UPDATE session_payments SET batch_session_id = NULL WHERE batch_session_id = ANY($1::text[])`, [sessionIds]);
  await client.query(`UPDATE invoices SET batch_session_id = NULL WHERE batch_session_id = ANY($1::text[])`, [sessionIds]);

  // ── Phase 3: FK-constrained tables (must go before rooms/sessions) ──
  // Nullify invoice FK on extension requests first (invoice preserved, extension deleted)
  await client.query(`UPDATE session_extension_requests SET invoice_id = NULL WHERE batch_session_id = ANY($1::text[])`, [sessionIds]);
  await client.query(`DELETE FROM session_extension_requests WHERE batch_session_id = ANY($1::text[])`, [sessionIds]);
  await client.query(`DELETE FROM leave_session_actions WHERE batch_session_id = ANY($1::text[])`, [sessionIds]);
  if (roomIds.length > 0) {
    await client.query(`DELETE FROM rejoin_requests WHERE room_id = ANY($1::text[])`, [roomIds]);
    await client.query(`DELETE FROM teacher_session_earnings WHERE room_id = ANY($1::text[])`, [roomIds]);
    // Nullify room FK refs in payments so room deletion isn't blocked
    await client.query(`UPDATE session_payments SET room_id = NULL WHERE room_id = ANY($1::text[])`, [roomIds]);
  }

  // ── Phase 4: Delete rooms (CASCADE: attendance_sessions, room_events, room_assignments, student_feedback) ──
  if (roomIds.length > 0) {
    await client.query(`DELETE FROM rooms WHERE room_id = ANY($1::text[])`, [roomIds]);
  }
}

/**
 * Clean up batch-level data that isn't tied to specific sessions.
 * Call AFTER cleanupSessionData, BEFORE deleting the batch.
 */
export async function cleanupBatchData(client: PoolClient, batchId: string) {
  // Batch-level homework (may have NULL room_id)
  await client.query(`DELETE FROM homework_assignments WHERE batch_id = $1`, [batchId]);
  // NOTE: monitoring_alerts.batch_id is UUID type — room-level alerts already cleaned via room_id in cleanupSessionData
  // Student availability preferences
  await client.query(`DELETE FROM student_availability WHERE batch_id = $1`, [batchId]);
  // Session requests scoped to batch
  await client.query(`DELETE FROM session_requests WHERE batch_id = $1`, [batchId]);
  // Extension requests referencing batch_id (FK to batches, blocks CASCADE)
  await client.query(`DELETE FROM session_extension_requests WHERE batch_id = $1`, [batchId]);
  // Calendar schedule run history (FK to batches, blocks CASCADE)
  await client.query(`DELETE FROM calendar_schedule_runs WHERE batch_id = $1`, [batchId]);
}

/**
 * Clean up all data for a student being permanently deleted.
 */
export async function cleanupStudentData(client: PoolClient, studentEmail: string) {
  // Monitoring data (no FK)
  await client.query(`DELETE FROM class_monitoring_events WHERE student_email = $1`, [studentEmail]);
  await client.query(`DELETE FROM monitoring_alerts WHERE target_email = $1`, [studentEmail]);

  // Attendance
  await client.query(`DELETE FROM attendance_sessions WHERE participant_email = $1`, [studentEmail]);

  // Rejoin requests (FK to rooms, no CASCADE)
  await client.query(`DELETE FROM rejoin_requests WHERE student_email = $1`, [studentEmail]);

  // Room assignments (FK to rooms with CASCADE, but clean student-specific)
  await client.query(`DELETE FROM room_assignments WHERE participant_email = $1`, [studentEmail]);

  // Session exam results
  await client.query(`DELETE FROM session_exam_results WHERE student_email = $1`, [studentEmail]);

  // Homework submissions
  await client.query(`DELETE FROM homework_submissions WHERE student_email = $1`, [studentEmail]);

  // Session credits + ledger — must go before invoices (student_session_credits.invoice_id → invoices.id)
  await client.query(`DELETE FROM session_credit_ledger WHERE credit_id IN (SELECT id FROM student_session_credits WHERE student_email = $1)`, [studentEmail]);
  await client.query(`DELETE FROM student_session_credits WHERE student_email = $1`, [studentEmail]);

  // Invoice dependents
  const invoiceRes = await client.query(`SELECT id FROM invoices WHERE student_email = $1`, [studentEmail]);
  const invoiceIds = invoiceRes.rows.map((r: Record<string, string>) => r.id);
  if (invoiceIds.length > 0) {
    await client.query(`DELETE FROM payment_receipts WHERE invoice_id = ANY($1::uuid[])`, [invoiceIds]);
  }

  // Extension requests (FK to rooms, sessions, invoices)
  await client.query(`DELETE FROM session_extension_requests WHERE student_email = $1`, [studentEmail]);

  // Session payments
  await client.query(`DELETE FROM session_payments WHERE student_email = $1`, [studentEmail]);

  // Invoices
  await client.query(`DELETE FROM invoices WHERE student_email = $1`, [studentEmail]);

  // Teacher reports about student
  await client.query(`DELETE FROM teacher_reports WHERE student_email = $1`, [studentEmail]);

  // Student feedback
  await client.query(`DELETE FROM student_feedback WHERE student_email = $1`, [studentEmail]);

  // Student availability
  await client.query(`DELETE FROM student_availability WHERE student_email = $1`, [studentEmail]);

  // Session requests
  await client.query(`DELETE FROM session_requests WHERE requester_email = $1`, [studentEmail]);

  // Parent complaints about this student (no FK, would orphan)
  await client.query(`DELETE FROM parent_complaints WHERE student_email = $1`, [studentEmail]);

  // Enrollment links for this student (nullify student_email — the link record itself is a CRM artifact)
  await client.query(`UPDATE enrollment_links SET student_email = NULL WHERE student_email = $1`, [studentEmail]);

  // Batch students (all batches)
  await client.query(`DELETE FROM batch_students WHERE student_email = $1`, [studentEmail]);

  // Video access requests (FK → portal_users on both student_email and reviewed_by)
  await client.query(`DELETE FROM video_access_requests WHERE student_email = $1`, [studentEmail]);
}

/**
 * Clean up teacher-specific data when permanently deleting a teacher.
 */
export async function cleanupTeacherData(client: PoolClient, teacherEmail: string) {
  // Teacher session earnings (FK to rooms, no CASCADE)
  await client.query(`DELETE FROM teacher_session_earnings WHERE teacher_email = $1`, [teacherEmail]);

  // Payslips
  await client.query(`DELETE FROM payslips WHERE teacher_email = $1`, [teacherEmail]);

  // Teacher reports filed by teacher
  await client.query(`DELETE FROM teacher_reports WHERE teacher_email = $1`, [teacherEmail]);

  // Room chat messages from teacher
  await client.query(`DELETE FROM room_chat_messages WHERE sender_email = $1`, [teacherEmail]);
}
