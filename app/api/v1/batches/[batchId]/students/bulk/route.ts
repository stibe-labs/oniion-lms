// ═══════════════════════════════════════════════════════════════
// Bulk Student Upload — POST /api/v1/batches/[batchId]/students/bulk
// Accepts CSV (text/csv) with columns: email (required), parent_email (optional)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { backfillStudentSessions } from '@/lib/session-join-tokens';
import { backfillSessionInvoicesForStudents } from '@/lib/payment';

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { batchId } = await context.params;

    // Verify batch exists
    const batchResult = await db.query(
      `SELECT batch_id, batch_name, max_students, academic_operator_email, coordinator_email FROM batches WHERE batch_id = $1`,
      [batchId],
    );
    if (batchResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    const batch = batchResult.rows[0] as Record<string, unknown>;
    if (user.role === 'academic_operator' && batch.academic_operator_email !== user.id) {
      return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
    }
    if (user.role === 'batch_coordinator' && batch.coordinator_email !== user.id) {
      return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
    }

    // Current student count
    const countResult = await db.query(
      `SELECT COUNT(*) AS count FROM batch_students WHERE batch_id = $1 AND student_status = 'active'`,
      [batchId],
    );
    const currentCount = Number((countResult.rows[0] as Record<string, string>).count);
    const maxStudents = Number(batch.max_students || 999);

    // Parse request body as text (CSV)
    const csvText = await req.text();
    if (!csvText.trim()) {
      return NextResponse.json({ success: false, error: 'Empty CSV body' }, { status: 400 });
    }

    const lines = csvText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'CSV must have a header row and at least one data row',
      }, { status: 400 });
    }

    // Parse header
    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map(h => h.trim().replace(/^"?|"?$/g, ''));
    const emailIdx = headers.indexOf('email');
    if (emailIdx === -1) {
      return NextResponse.json({
        success: false,
        error: 'CSV must have an "email" column header',
      }, { status: 400 });
    }
    const parentEmailIdx = headers.indexOf('parent_email');

    const added: string[] = [];
    const skipped: Array<{ row: number; email: string; reason: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"?|"?$/g, ''));
      const email = cols[emailIdx]?.toLowerCase();
      const parentEmail = parentEmailIdx >= 0 ? (cols[parentEmailIdx]?.toLowerCase() || null) : null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped.push({ row: i + 1, email: email || '', reason: 'Invalid email format' });
        continue;
      }

      // Check student exists in portal_users
      const userExists = await db.query(
        `SELECT email FROM portal_users WHERE email = $1 AND portal_role = 'student'`,
        [email],
      );
      if (userExists.rows.length === 0) {
        skipped.push({ row: i + 1, email, reason: 'Student not found in system' });
        continue;
      }

      // Check not already in batch
      const alreadyIn = await db.query(
        `SELECT id FROM batch_students WHERE batch_id = $1 AND student_email = $2`,
        [batchId, email],
      );
      if (alreadyIn.rows.length > 0) {
        skipped.push({ row: i + 1, email, reason: 'Already in this batch' });
        continue;
      }

      // Capacity check
      if (currentCount + added.length >= maxStudents) {
        skipped.push({ row: i + 1, email, reason: 'Batch at max capacity' });
        continue;
      }

      // Insert
      await db.query(
        `INSERT INTO batch_students (batch_id, student_email, parent_email)
         VALUES ($1, $2, $3)
         ON CONFLICT (batch_id, student_email) DO NOTHING`,
        [batchId, email, parentEmail],
      );
      added.push(email);
    }

    // Backfill session_join_tokens + room_assignments for newly added students
    if (added.length > 0) {
      backfillStudentSessions(batchId, added).catch((err) => {
        console.warn('[batches/bulk] backfill warning:', err);
      });
      // Generate invoices/credits for any already-scheduled sessions
      backfillSessionInvoicesForStudents(batchId, added).catch((err) => {
        console.warn('[batches/bulk] invoice backfill warning:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        added: added.length,
        skipped: skipped.length,
        total_rows: lines.length - 1,
        errors: skipped,
        added_emails: added,
      },
    });
  } catch (err) {
    console.error('[batches/bulk] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
