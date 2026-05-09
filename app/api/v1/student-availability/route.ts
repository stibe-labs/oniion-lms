// ═══════════════════════════════════════════════════════════════
// Student Availability API — /api/v1/student-availability
// Students submit their available time slots
// AO/Coordinators can view for scheduling
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

interface AvailabilitySlot {
  id: string;
  student_email: string;
  batch_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  preference: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  student_name?: string;
  [key: string]: unknown;
}

const ok = (data: unknown) => NextResponse.json({ success: true, data });
const err = (msg: string, status = 400) => NextResponse.json({ success: false, error: msg }, { status });

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ─── GET: List availability slots ────────────────────── */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const role = String(user.role);
  const email = String(user.id);
  const url = new URL(req.url);
  const batchId = url.searchParams.get('batch_id');
  const studentEmail = url.searchParams.get('student_email');

  let query: string;
  let params: unknown[];

  if (['academic_operator', 'owner', 'hr', 'batch_coordinator'].includes(role)) {
    // Staff can view any student's availability
    if (studentEmail) {
      query = `SELECT sa.*, pu.full_name AS student_name FROM student_availability sa
               LEFT JOIN portal_users pu ON pu.email = sa.student_email
               WHERE sa.student_email = $1 AND sa.is_active = TRUE
               ORDER BY sa.day_of_week, sa.start_time`;
      params = [studentEmail];
    } else if (batchId) {
      query = `SELECT sa.*, pu.full_name AS student_name FROM student_availability sa
               LEFT JOIN portal_users pu ON pu.email = sa.student_email
               WHERE sa.batch_id = $1 AND sa.is_active = TRUE
               ORDER BY sa.student_email, sa.day_of_week, sa.start_time`;
      params = [batchId];
    } else {
      query = `SELECT sa.*, pu.full_name AS student_name FROM student_availability sa
               LEFT JOIN portal_users pu ON pu.email = sa.student_email
               WHERE sa.is_active = TRUE
               ORDER BY sa.student_email, sa.day_of_week, sa.start_time
               LIMIT 500`;
      params = [];
    }
  } else if (role === 'parent') {
    // Parents see their children's availability
    query = `SELECT sa.*, pu.full_name AS student_name FROM student_availability sa
             LEFT JOIN portal_users pu ON pu.email = sa.student_email
             WHERE sa.student_email IN (
               SELECT student_email FROM batch_students WHERE parent_email = $1
             ) AND sa.is_active = TRUE
             ORDER BY sa.student_email, sa.day_of_week, sa.start_time`;
    params = [email];
  } else {
    // Students see their own
    query = `SELECT * FROM student_availability WHERE student_email = $1 AND is_active = TRUE
             ORDER BY day_of_week, start_time`;
    params = [email];
  }

  const { rows } = await db.query<AvailabilitySlot>(query, params);

  // Group by day for convenience
  const byDay: Record<string, AvailabilitySlot[]> = {};
  for (const slot of rows) {
    const day = DAY_NAMES[slot.day_of_week];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(slot);
  }

  return ok({ slots: rows, byDay, dayNames: DAY_NAMES });
}

/* ─── POST: Create/update/delete availability ─────────── */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const role = String(user.role);
  const email = String(user.id);
  const body = await req.json();

  // Parents can submit on behalf of children
  let targetEmail = email;
  if (role === 'parent' && body.student_email) {
    const { rows } = await db.query(
      `SELECT 1 FROM batch_students WHERE parent_email = $1 AND student_email = $2`,
      [email, body.student_email]
    );
    if (rows.length === 0) return err('Not your child', 403);
    targetEmail = body.student_email;
  } else if (!['student', 'parent'].includes(role)) {
    return err('Only students/parents can submit availability', 403);
  }

  // ─── Delete slot ────────────────────────────────────
  if (body.action === 'delete') {
    if (!body.slot_id) return err('slot_id required');
    await db.query(
      `UPDATE student_availability SET is_active = FALSE WHERE id = $1 AND student_email = $2`,
      [body.slot_id, targetEmail]
    );
    return ok({ deleted: true });
  }

  // ─── Bulk replace ──────────────────────────────────
  if (body.action === 'bulk_replace' && Array.isArray(body.slots)) {
    // Deactivate all existing slots for this student (optionally scoped to batch)
    if (body.batch_id) {
      await db.query(
        `UPDATE student_availability SET is_active = FALSE WHERE student_email = $1 AND batch_id = $2`,
        [targetEmail, body.batch_id]
      );
    } else {
      await db.query(
        `UPDATE student_availability SET is_active = FALSE WHERE student_email = $1 AND batch_id IS NULL`,
        [targetEmail]
      );
    }

    // Insert new slots
    for (const slot of body.slots as Array<{ day_of_week: number; start_time: string; end_time: string; preference?: string; notes?: string }>) {
      await db.query(
        `INSERT INTO student_availability (student_email, batch_id, day_of_week, start_time, end_time, preference, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [targetEmail, body.batch_id || null, slot.day_of_week, slot.start_time, slot.end_time,
         slot.preference || 'available', slot.notes || null]
      );
    }

    return ok({ saved: body.slots.length });
  }

  // ─── Single slot add/update ────────────────────────
  const { day_of_week, start_time, end_time, preference, notes, batch_id } = body;
  if (day_of_week == null || !start_time || !end_time) {
    return err('day_of_week, start_time, end_time required');
  }

  if (body.slot_id) {
    // Update existing
    await db.query(
      `UPDATE student_availability SET day_of_week = $3, start_time = $4, end_time = $5,
       preference = $6, notes = $7, batch_id = $8
       WHERE id = $1 AND student_email = $2`,
      [body.slot_id, targetEmail, day_of_week, start_time, end_time,
       preference || 'available', notes || null, batch_id || null]
    );
    return ok({ updated: true });
  }

  // Insert new
  const { rows: inserted } = await db.query<AvailabilitySlot>(
    `INSERT INTO student_availability (student_email, batch_id, day_of_week, start_time, end_time, preference, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [targetEmail, batch_id || null, day_of_week, start_time, end_time,
     preference || 'available', notes || null]
  );

  return ok({ slot: inserted[0] });
}
