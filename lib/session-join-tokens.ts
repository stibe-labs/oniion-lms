// ═══════════════════════════════════════════════════════════════
// Session Join Token Generator
// Called when a batch session is scheduled to pre-generate
// direct-join tokens. WhatsApp links are sent later by the
// session-reminder cron (15 min before class).
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';

interface SessionInfo {
  session_id: string;
  batch_id: string;
  teacher_email: string | null;
  teacher_name: string | null;
}

/**
 * Generate join tokens for all participants and store in session_join_tokens.
 * Tokens are used later by the session-reminder to build direct-join URLs.
 * Fire-and-forget — errors are logged, never thrown.
 */
export async function generateSessionJoinLinks(session: SessionInfo): Promise<void> {
  try {
    const { session_id, batch_id, teacher_email, teacher_name } = session;

    // ── Fetch batch info ────────────────────────────────────
    const batchRes = await db.query(
      `SELECT coordinator_email FROM batches WHERE batch_id = $1`,
      [batch_id],
    );
    const batch = batchRes.rows[0] as { coordinator_email: string | null } | undefined;
    const coordinatorEmail = batch?.coordinator_email || null;

    // ── Fetch students + parents ────────────────────────────
    const studentsRes = await db.query(
      `SELECT bs.student_email,
              COALESCE(pu.full_name, bs.student_email) AS student_name,
              bs.parent_email,
              COALESCE(pp.full_name, bs.parent_email) AS parent_name
       FROM batch_students bs
       LEFT JOIN portal_users pu ON pu.email = bs.student_email
       LEFT JOIN portal_users pp ON pp.email = bs.parent_email
       WHERE bs.batch_id = $1`,
      [batch_id],
    );
    const students = studentsRes.rows as {
      student_email: string; student_name: string;
      parent_email: string | null; parent_name: string | null;
    }[];

    // ── Fetch coordinator name ──────────────────────────────
    let coordName = 'Coordinator';
    if (coordinatorEmail) {
      const cRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [coordinatorEmail]);
      if (cRes.rows.length > 0) coordName = (cRes.rows[0] as { full_name: string }).full_name || 'Coordinator';
    }

    // ── Generate tokens and insert ──────────────────────────
    const participants: { email: string; name: string; type: string; token: string }[] = [];

    // Teacher
    if (teacher_email) {
      const token = randomUUID();
      participants.push({ email: teacher_email, name: teacher_name || 'Teacher', type: 'teacher', token });
    }

    // Students + their parents
    for (const s of students) {
      const stoken = randomUUID();
      participants.push({ email: s.student_email, name: s.student_name, type: 'student', token: stoken });
      if (s.parent_email) {
        const ptoken = randomUUID();
        participants.push({
          email: s.parent_email,
          name: s.parent_name || s.parent_email,
          type: 'parent',
          token: ptoken,
        });
      }
    }

    // Batch Coordinator
    if (coordinatorEmail) {
      const token = randomUUID();
      participants.push({ email: coordinatorEmail, name: coordName, type: 'batch_coordinator', token });
    }

    // Bulk insert
    for (const p of participants) {
      await db.query(
        `INSERT INTO session_join_tokens (session_id, participant_email, participant_name, participant_type, join_token)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (session_id, participant_email) DO UPDATE SET join_token = $5, participant_name = $3`,
        [session_id, p.email, p.name, p.type, p.token],
      );
    }

    console.log(`[session-tokens] Generated ${participants.length} join tokens for session ${session_id}`);
  } catch (err) {
    console.error('[session-tokens] Error generating join links:', err);
  }
}

/**
 * Backfill session_join_tokens and room_assignments for newly added students.
 * Called after inserting students into batch_students to ensure they receive
 * reminder emails and appear in pre-created room assignments.
 * Fire-and-forget safe — uses ON CONFLICT DO NOTHING throughout.
 */
export async function backfillStudentSessions(batchId: string, emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  try {
    // Find all active (scheduled or live) sessions for this batch
    const sessRes = await db.query(
      `SELECT session_id FROM batch_sessions WHERE batch_id = $1 AND status IN ('scheduled', 'live')`,
      [batchId],
    );
    if (sessRes.rows.length === 0) return;

    for (const email of emails) {
      // Get student display name
      const uRes = await db.query(`SELECT full_name FROM portal_users WHERE email = $1`, [email]);
      const studentName = (uRes.rows[0] as { full_name: string } | undefined)?.full_name || email;

      for (const row of sessRes.rows as { session_id: string }[]) {
        // Insert session_join_token (skip if already exists)
        await db.query(
          `INSERT INTO session_join_tokens (session_id, participant_email, participant_name, participant_type, join_token)
           VALUES ($1, $2, $3, 'student', $4)
           ON CONFLICT (session_id, participant_email) DO NOTHING`,
          [row.session_id, email, studentName, randomUUID()],
        );

        // Insert room_assignments for any pre-created rooms for this session
        await db.query(
          `INSERT INTO room_assignments (room_id, participant_type, participant_email, participant_name, payment_status)
           SELECT r.room_id, 'student', $2, $3, 'unknown'
           FROM rooms r
           WHERE r.batch_session_id = $1 AND r.status NOT IN ('ended', 'cancelled')
           ON CONFLICT (room_id, participant_email) DO NOTHING`,
          [row.session_id, email, studentName],
        );
      }
    }
    console.log(`[session-tokens] Backfilled ${emails.length} student(s) across ${sessRes.rows.length} session(s) in batch ${batchId}`);
  } catch (err) {
    console.warn('[session-tokens] backfillStudentSessions warning:', err);
  }
}

/**
 * Look up a pre-generated join token for a participant.
 * Returns the direct-join URL or null if no token exists.
 */
export async function getJoinUrl(sessionId: string, email: string): Promise<string | null> {
  try {
    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
    const res = await db.query(
      `SELECT join_token FROM session_join_tokens WHERE session_id = $1 AND participant_email = $2 LIMIT 1`,
      [sessionId, email],
    );
    if (res.rows.length > 0) {
      const token = (res.rows[0] as { join_token: string }).join_token;
      return `${BASE_URL}/join/${sessionId}?token=${token}`;
    }
    return null;
  } catch {
    return null;
  }
}
