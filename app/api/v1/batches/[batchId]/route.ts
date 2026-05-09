// ═══════════════════════════════════════════════════════════════
// Batches API — Single batch operations
// GET    /api/v1/batches/[batchId]  — Batch detail with students
// PATCH  /api/v1/batches/[batchId]  — Update batch
// DELETE /api/v1/batches/[batchId]  — Archive or delete batch
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { cleanupSessionData, cleanupBatchData } from '@/lib/cascade-cleanup';
import { backfillStudentSessions } from '@/lib/session-join-tokens';
import { backfillSessionInvoicesForStudents } from '@/lib/payment';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator', 'teacher'].includes(user.role)) return null;
  return user;
}

// ── GET — Batch detail ──────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;

  // Teachers can only access batches they're assigned to
  if (caller.role === 'teacher') {
    const check = await db.query(
      `SELECT 1 FROM batch_teachers WHERE batch_id = $1 AND teacher_email = $2 LIMIT 1`,
      [batchId, caller.id]
    );
    if (check.rows.length === 0) return NextResponse.json({ success: false, error: 'Not authorized for this batch' }, { status: 403 });
  }

  const batchRes = await db.query(
    `SELECT b.*, c.full_name AS coordinator_name, ao.full_name AS academic_operator_name
     FROM batches b
     LEFT JOIN portal_users c ON c.email = b.coordinator_email
     LEFT JOIN portal_users ao ON ao.email = b.academic_operator_email
     WHERE b.batch_id = $1`,
    [batchId]
  );
  if (batchRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }

  const studentsRes = await db.query(
    `SELECT
       bs.student_email,
       bs.parent_email,
       bs.added_at,
       su.full_name AS student_name,
       pu.full_name AS parent_name,
       pp.phone     AS parent_phone,
       sp.assigned_region AS student_region,
       -- Per-student attendance stats for this batch
       COUNT(ra.room_id) FILTER (
         WHERE r.status = 'ended'
       ) AS total_classes,
       COUNT(a.*) FILTER (
         WHERE a.status = 'present'
       ) AS present,
       CASE
         WHEN COUNT(ra.room_id) FILTER (WHERE r.status = 'ended') > 0
         THEN ROUND(
           (COUNT(a.*) FILTER (WHERE a.status = 'present')::numeric /
            COUNT(ra.room_id) FILTER (WHERE r.status = 'ended')) * 100, 1
         )
         ELSE 0
       END AS attendance_rate
     FROM batch_students bs
     LEFT JOIN portal_users su ON su.email = bs.student_email
     LEFT JOIN portal_users pu ON pu.email = bs.parent_email
     LEFT JOIN user_profiles sp ON sp.email = bs.student_email
     LEFT JOIN user_profiles pp ON pp.email = bs.parent_email
     -- Join rooms only for this batch's sessions
     LEFT JOIN batch_sessions bss ON bss.batch_id = bs.batch_id
     LEFT JOIN rooms r ON r.room_id = bss.livekit_room_name
     LEFT JOIN room_assignments ra
       ON ra.room_id = r.room_id
       AND ra.participant_email = bs.student_email
       AND ra.participant_type = 'student'
     LEFT JOIN attendance_sessions a
       ON a.room_id = r.room_id
       AND a.participant_email = bs.student_email
       AND a.participant_role = 'student'
     WHERE bs.batch_id = $1
     GROUP BY
       bs.student_email, bs.parent_email, bs.added_at,
       su.full_name, pu.full_name, pp.phone, sp.assigned_region
     ORDER BY bs.added_at`,
    [batchId]
  );

  const teachersRes = await db.query(
    `SELECT bt.teacher_email, bt.subject, bt.added_at,
            u.full_name AS teacher_name
     FROM batch_teachers bt
     LEFT JOIN portal_users u ON u.email = bt.teacher_email
     WHERE bt.batch_id = $1
     ORDER BY bt.subject`,
    [batchId]
  );

  // ── Per-student attendance aggregates (detailed) ──
  const attendanceRes = await db.query(
    `WITH per_session AS (
       SELECT DISTINCT ON (bs_st.student_email, s.session_id)
         bs_st.student_email,
         s.session_id,
         COALESCE(att.status, 'not_joined') AS status,
         COALESCE(att.attention_avg, 0) AS attention_avg,
         COALESCE(att.total_duration_sec, 0) AS total_duration_sec
       FROM batch_students bs_st
       CROSS JOIN batch_sessions s
       LEFT JOIN rooms r ON r.batch_session_id = s.session_id
       LEFT JOIN attendance_sessions att ON att.room_id = r.room_id
         AND att.participant_email = bs_st.student_email
         AND att.participant_role = 'student'
       WHERE bs_st.batch_id = $1 AND s.batch_id = $1 AND s.status = 'ended'
       ORDER BY bs_st.student_email, s.session_id,
         CASE COALESCE(att.status, 'not_joined')
           WHEN 'present' THEN 1 WHEN 'late' THEN 2
           WHEN 'left_early' THEN 3 WHEN 'absent' THEN 4
           ELSE 5
         END
     )
     SELECT
       ps.student_email,
       pu.full_name AS student_name,
       COUNT(*) AS total_sessions,
       COUNT(*) FILTER (WHERE ps.status = 'present') AS present,
       COUNT(*) FILTER (WHERE ps.status = 'late') AS late,
       COUNT(*) FILTER (WHERE ps.status = 'absent') AS absent,
       COUNT(*) FILTER (WHERE ps.status = 'left_early') AS left_early,
       COUNT(*) FILTER (WHERE ps.status = 'not_joined') AS not_joined,
       COALESCE(ROUND(AVG(ps.attention_avg) FILTER (WHERE ps.status IN ('present','late')), 1), 0) AS avg_attention,
       COALESCE(SUM(ps.total_duration_sec), 0)::int AS total_duration_sec
     FROM per_session ps
     JOIN portal_users pu ON pu.email = ps.student_email
     GROUP BY ps.student_email, pu.full_name
     ORDER BY pu.full_name`,
    [batchId]
  );

  return NextResponse.json({
    success: true,
    data: {
      batch: batchRes.rows[0],
      students: studentsRes.rows,
      teachers: teachersRes.rows,
      attendance: attendanceRes.rows,
    },
  });
}

// ── PATCH — Update batch ────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const updateableFields = ['batch_name', 'subjects', 'grade', 'section', 'board', 'coordinator_email', 'academic_operator_email', 'max_students', 'status', 'notes'];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of updateableFields) {
    if (field in body) {
      values.push(body[field] ?? null);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (sets.length === 0 && !Array.isArray(body.students) && !Array.isArray(body.teachers)) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }

  try {
  await db.withTransaction(async (client) => {
    if (sets.length > 0) {
      values.push(batchId);
      const sql = `UPDATE batches SET ${sets.join(', ')} WHERE batch_id = $${values.length} RETURNING batch_id`;
      const result = await client.query(sql, values);
      if (result.rows.length === 0) {
        throw new Error('Batch not found');
      }
    }

    // Handle teacher-subject assignments update
    if (Array.isArray(body.teachers)) {
      const teacherList = body.teachers as { email: string; subject: string }[];
      await client.query('DELETE FROM batch_teachers WHERE batch_id = $1', [batchId]);
      for (const t of teacherList) {
        if (t.email && t.subject) {
          await client.query(
            `INSERT INTO batch_teachers (batch_id, teacher_email, subject)
             VALUES ($1, $2, $3)
             ON CONFLICT (batch_id, teacher_email, subject) DO NOTHING`,
            [batchId, t.email.trim().toLowerCase(), t.subject.trim()]
          );
        }
      }
    }

    // Handle student list update (preserve enrollment status for existing students)
    if (Array.isArray(body.students)) {
      const studentList = body.students as { email: string; parent_email?: string }[];
      const newEmails = studentList.map(s => s.email.trim().toLowerCase());

      // Remove students not in the new list (only active ones — keep discontinued/on_break records)
      if (newEmails.length > 0) {
        await client.query(
          `DELETE FROM batch_students WHERE batch_id = $1 AND student_email != ALL($2::text[]) AND student_status = 'active'`,
          [batchId, newEmails]
        );
      } else {
        await client.query(
          `DELETE FROM batch_students WHERE batch_id = $1 AND student_status = 'active'`,
          [batchId]
        );
      }

      // Upsert new students (existing ones keep their status)
      for (const s of studentList) {
        await client.query(
          `INSERT INTO batch_students (batch_id, student_email, parent_email)
           VALUES ($1, $2, $3)
           ON CONFLICT (batch_id, student_email) DO UPDATE SET parent_email = COALESCE(EXCLUDED.parent_email, batch_students.parent_email)`,
          [batchId, s.email.trim().toLowerCase(), s.parent_email || null]
        );
      }
    }
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update batch';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  // Backfill session_join_tokens + room_assignments for newly added students
  // (fire-and-forget — safe due to ON CONFLICT DO NOTHING)
  if (Array.isArray(body.students)) {
    const emails = (body.students as { email: string }[]).map(s => s.email.trim().toLowerCase());
    backfillStudentSessions(batchId, emails).catch((err) => {
      console.warn('[batch/patch] backfill warning:', err);
    });
    // Generate invoices/credits for any already-scheduled sessions
    backfillSessionInvoicesForStudents(batchId, emails).catch((err) => {
      console.warn('[batch/patch] invoice backfill warning:', err);
    });
  }

  return NextResponse.json({ success: true, message: 'Batch updated' });
}

// ── DELETE — Archive batch ──────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const caller = await getOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { batchId } = await params;
  const url = new URL(req.url);
  const permanent = url.searchParams.get('permanent') === 'true';

  if (permanent) {
    // Permanently delete — clean all related data in proper order
    const deleted = await db.withTransaction(async (client) => {
      // Check batch exists
      const check = await client.query('SELECT batch_id FROM batches WHERE batch_id = $1', [batchId]);
      if (check.rows.length === 0) return false;

      // Get all session IDs for this batch
      const sessRes = await client.query(
        `SELECT session_id FROM batch_sessions WHERE batch_id = $1`,
        [batchId]
      );
      const sessionIds = sessRes.rows.map((r: Record<string, string>) => r.session_id);

      // Phase 1: Clean all session-related data (rooms, monitoring, exams, invoices, etc.)
      await cleanupSessionData(client, sessionIds);

      // Phase 2: Clean batch-level data (homework, alerts, availability, extension requests)
      await cleanupBatchData(client, batchId);

      // Phase 3: Delete batch (CASCADE: batch_students, batch_teachers, batch_sessions)
      await client.query('DELETE FROM batches WHERE batch_id = $1', [batchId]);
      return true;
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Batch permanently deleted' });
  } else {
    // Archive
    const result = await db.query(
      `UPDATE batches SET status = 'archived' WHERE batch_id = $1 RETURNING batch_id`,
      [batchId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Batch archived' });
  }
}
