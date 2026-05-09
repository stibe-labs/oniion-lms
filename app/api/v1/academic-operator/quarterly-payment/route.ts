// POST /api/v1/academic-operator/quarterly-payment
// AO manages quarterly payment dates for group-batch students.
//
// Actions:
//   set    — set initial quarterly_due_date (first time enrollment on quarterly plan)
//   advance — advance due date by 3 months (after student pays quarterly installment)
//   clear  — clear quarterly_due_date (switch student to OTP/annual, remove recurring gate)

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { advanceQuarterlyDueDate, setQuarterlyDueDate } from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['academic_operator', 'owner'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { action, batch_id, student_email, due_date } = await req.json() as {
      action: 'set' | 'advance' | 'clear';
      batch_id: string;
      student_email: string;
      due_date?: string; // ISO date string, required for 'set' action
    };

    if (!action || !batch_id || !student_email) {
      return NextResponse.json({ success: false, error: 'action, batch_id and student_email are required' }, { status: 400 });
    }

    // Verify student is in this batch
    const memberCheck = await db.query(
      `SELECT id FROM batch_students WHERE batch_id = $1 AND student_email = $2`,
      [batch_id, student_email]
    );
    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Student not found in this batch' }, { status: 404 });
    }

    if (action === 'set') {
      if (!due_date) {
        return NextResponse.json({ success: false, error: 'due_date is required for set action' }, { status: 400 });
      }
      const parsed = new Date(due_date);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid due_date format' }, { status: 400 });
      }
      await setQuarterlyDueDate(batch_id, student_email, parsed);
      return NextResponse.json({
        success: true,
        data: { quarterly_due_date: parsed.toISOString().split('T')[0], message: 'Quarterly payment date set' },
      });
    }

    if (action === 'advance') {
      const newDate = await advanceQuarterlyDueDate(batch_id, student_email);
      return NextResponse.json({
        success: true,
        data: {
          quarterly_due_date: newDate.toISOString().split('T')[0],
          message: 'Quarterly payment date advanced by 3 months',
        },
      });
    }

    if (action === 'clear') {
      await db.query(
        `UPDATE batch_students SET quarterly_due_date = NULL WHERE batch_id = $1 AND student_email = $2`,
        [batch_id, student_email]
      );
      return NextResponse.json({
        success: true,
        data: { quarterly_due_date: null, message: 'Quarterly payment plan removed — student on OTP/annual plan' },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[quarterly-payment] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/v1/academic-operator/quarterly-payment?batch_id=&student_email=
// Returns current quarterly_due_date and gate status for a student
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['academic_operator', 'owner', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batch_id');
    const studentEmail = searchParams.get('student_email');

    if (!batchId || !studentEmail) {
      return NextResponse.json({ success: false, error: 'batch_id and student_email required' }, { status: 400 });
    }

    const res = await db.query<{
      quarterly_due_date: string | null;
      skip_payment_gate: boolean;
    }>(
      `SELECT quarterly_due_date, skip_payment_gate FROM batch_students
       WHERE batch_id = $1 AND student_email = $2`,
      [batchId, studentEmail]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Student not found in batch' }, { status: 404 });
    }

    const row = res.rows[0];
    const isOverdue = row.quarterly_due_date
      ? (() => {
          const d = new Date(row.quarterly_due_date);
          d.setHours(23, 59, 59, 999);
          return d < new Date();
        })()
      : false;

    return NextResponse.json({
      success: true,
      data: {
        quarterly_due_date: row.quarterly_due_date,
        skip_payment_gate: row.skip_payment_gate,
        is_overdue: isOverdue,
        gate_active: row.quarterly_due_date !== null && !row.skip_payment_gate,
      },
    });
  } catch (err) {
    console.error('[quarterly-payment] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
