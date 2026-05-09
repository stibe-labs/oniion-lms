// ═══════════════════════════════════════════════════════════════
// Add Student to Batch — POST /api/v1/batches/[batchId]/students
// Adds a single student to an existing batch.
// Body: { email: string, parent_email?: string }
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

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const parentEmail = typeof body.parent_email === 'string' ? body.parent_email.trim().toLowerCase() : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Valid student email required' }, { status: 400 });
    }

    // Verify batch exists and caller has access
    const batchRes = await db.query(
      `SELECT batch_id, batch_type, max_students, academic_operator_email, coordinator_email FROM batches WHERE batch_id = $1 AND status = 'active'`,
      [batchId],
    );
    if (batchRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found or not active' }, { status: 404 });
    }
    const batch = batchRes.rows[0] as Record<string, unknown>;

    if (user.role === 'academic_operator' && batch.academic_operator_email !== user.id) {
      return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
    }
    if (user.role === 'batch_coordinator' && batch.coordinator_email !== user.id) {
      return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
    }

    // Verify student exists
    const studentRes = await db.query(
      `SELECT email, full_name FROM portal_users WHERE email = $1 AND portal_role = 'student'`,
      [email],
    );
    if (studentRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Student not found in system' }, { status: 404 });
    }
    const studentName = (studentRes.rows[0] as { full_name: string }).full_name;

    // Check already enrolled
    const alreadyIn = await db.query(
      `SELECT id FROM batch_students WHERE batch_id = $1 AND student_email = $2`,
      [batchId, email],
    );
    if (alreadyIn.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Student is already in this batch' }, { status: 400 });
    }

    // Capacity check
    const countRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM batch_students WHERE batch_id = $1 AND student_status = 'active'`,
      [batchId],
    );
    const current = parseInt((countRes.rows[0] as { cnt: string }).cnt, 10);
    const maxStudents = Number(batch.max_students || 999);
    if (current >= maxStudents) {
      return NextResponse.json({ success: false, error: `Batch is full (${current}/${maxStudents} students)` }, { status: 400 });
    }

    // Resolve parent email from user_profiles if not provided
    let resolvedParentEmail = parentEmail;
    if (!resolvedParentEmail) {
      const profileRes = await db.query(
        `SELECT parent_email FROM user_profiles WHERE email = $1`,
        [email],
      );
      if (profileRes.rows.length > 0) {
        resolvedParentEmail = (profileRes.rows[0] as { parent_email: string | null }).parent_email;
      }
    }

    // Insert
    await db.query(
      `INSERT INTO batch_students (batch_id, student_email, parent_email)
       VALUES ($1, $2, $3)
       ON CONFLICT (batch_id, student_email) DO NOTHING`,
      [batchId, email, resolvedParentEmail],
    );

    // Backfill session join tokens (fire-and-forget)
    backfillStudentSessions(batchId, [email]).catch((err) => {
      console.warn('[students/add] backfill warning:', err);
    });

    // Generate invoices/credits for any already-scheduled sessions in this batch
    backfillSessionInvoicesForStudents(batchId, [email]).catch((err) => {
      console.warn('[students/add] invoice backfill warning:', err);
    });

    return NextResponse.json({
      success: true,
      message: `${studentName} added to batch successfully`,
      data: { email, studentName },
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to add student';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
