// ═══════════════════════════════════════════════════════════════
// Credit Check — GET /api/v1/batch-sessions/credit-check
//
// Preview each student's prepaid credit status for a schedule group
// before generating invoices. Shows who has credits, who needs to pay.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getStudentSessionCredits, getEnrollmentFeeRate, getStudentRegionGroup, formatAmount } from '@/lib/payment';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const scheduleGroupId = req.nextUrl.searchParams.get('schedule_group_id');
    if (!scheduleGroupId) {
      return NextResponse.json({ success: false, error: 'schedule_group_id is required' }, { status: 400 });
    }

    // 1. Fetch sessions in this schedule group
    const sessionsRes = await db.query(
      `SELECT s.session_id, s.batch_id, s.subject,
              b.batch_name, b.grade, b.batch_type, b.board
       FROM batch_sessions s
       JOIN batches b ON b.batch_id = s.batch_id
       WHERE s.schedule_group_id = $1
       ORDER BY s.scheduled_date, s.start_time`,
      [scheduleGroupId],
    );
    if (sessionsRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No sessions found for this schedule group' }, { status: 404 });
    }

    const sessions = sessionsRes.rows as Array<Record<string, unknown>>;
    const batchId = sessions[0].batch_id as string;
    const batchType = sessions[0].batch_type as string;
    const batchGrade = sessions[0].grade as string | null;

    // Scope: AO/BC can only check credits for batches they own
    if (user.role === 'academic_operator' || user.role === 'batch_coordinator') {
      const col = user.role === 'academic_operator' ? 'academic_operator_email' : 'coordinator_email';
      const ownRes = await db.query(
        `SELECT 1 FROM batches WHERE batch_id = $1 AND ${col} = $2`,
        [batchId, user.id]
      );
      if (ownRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Schedule group is not in your batches' }, { status: 403 });
      }
    }

    // Count sessions per subject
    const subjectCounts = new Map<string, number>();
    for (const s of sessions) {
      const subj = s.subject as string;
      subjectCounts.set(subj, (subjectCounts.get(subj) || 0) + 1);
    }

    // Get total calendar sessions for annual fee proration
    let totalCalendarSessions = 0;
    const calRunRes = await db.query(
      `SELECT c.id AS calendar_id
       FROM calendar_schedule_runs csr
       JOIN academic_calendars c ON c.id = csr.calendar_id
       WHERE csr.schedule_group_id = $1 LIMIT 1`,
      [scheduleGroupId],
    );
    if (calRunRes.rows.length > 0) {
      const calId = (calRunRes.rows[0] as Record<string, unknown>).calendar_id as string;
      const countRes = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM academic_calendar_sessions
         WHERE calendar_id = $1
           AND session_type IN ('session', 'special_class', 'exam_special', 'new_batch')`,
        [calId],
      );
      totalCalendarSessions = Number((countRes.rows[0] as Record<string, unknown>).cnt) || 0;
    }

    // 2. Fetch all students in the batch
    const studentsRes = await db.query(
      `SELECT bs.student_email, bs.parent_email,
              COALESCE(u.full_name, bs.student_email) AS student_name
       FROM batch_students bs
       LEFT JOIN portal_users u ON u.email = bs.student_email
       WHERE bs.batch_id = $1`,
      [batchId],
    );

    // 3. Build per-student credit preview
    const studentPreviews: Array<{
      student_email: string;
      student_name: string;
      has_enrollment: boolean;
      credits_available: number;
      sessions_scheduled: number;
      sessions_covered: number;
      sessions_billable: number;
      billable_amount_paise: number;
      per_session_rate_paise: number;
      currency: string;
      status: 'fully_covered' | 'partially_covered' | 'no_credits' | 'no_rate';
    }> = [];

    for (const row of studentsRes.rows) {
      const student = row as { student_email: string; parent_email: string | null; student_name: string };

      // Check if already invoiced
      const existingInv = await db.query(
        `SELECT id FROM invoices WHERE schedule_group_id = $1 AND student_email = $2`,
        [scheduleGroupId, student.student_email],
      );
      if (existingInv.rows.length > 0) continue; // already invoiced, skip

      const profile = await getStudentRegionGroup(student.student_email);
      // Prefer batchGrade (already normalized, e.g. '8') over profile.grade which may
      // be free-text like 'Class 8'. Also normalize: strip any non-numeric prefix.
      const rawGrade = batchGrade || profile.grade || '10';
      const grade = rawGrade.replace(/[^0-9a-zA-Z]/g, ' ').trim().split(' ').pop() || rawGrade;

      // Lookup enrollment fee rate
      const enrollmentRate = await getEnrollmentFeeRate({
        regionGroup: profile.regionGroup,
        board: profile.board,
        batchType,
        grade,
      });

      let perSessionPaise = 0;
      let feeCurrency = 'INR';
      if (enrollmentRate) {
        if (enrollmentRate.feeUnit === 'session' || enrollmentRate.feeUnit === 'per_class') {
          perSessionPaise = enrollmentRate.feePaise;
        } else if (enrollmentRate.feeUnit === 'year' && totalCalendarSessions > 0) {
          perSessionPaise = Math.ceil(enrollmentRate.feePaise / totalCalendarSessions);
        } else if (enrollmentRate.feeUnit === 'annual' && totalCalendarSessions > 0) {
          perSessionPaise = Math.ceil(enrollmentRate.feePaise / totalCalendarSessions);
        }
        feeCurrency = enrollmentRate.currency;
      }

      if (perSessionPaise <= 0) {
        studentPreviews.push({
          student_email: student.student_email,
          student_name: student.student_name,
          has_enrollment: false,
          credits_available: 0,
          sessions_scheduled: sessions.length,
          sessions_covered: 0,
          sessions_billable: 0,
          billable_amount_paise: 0,
          per_session_rate_paise: 0,
          currency: feeCurrency,
          status: 'no_rate',
        });
        continue;
      }

      // Check credits
      const credits = await getStudentSessionCredits(student.student_email, batchType);
      const totalCredits = credits.reduce((sum, c) => sum + c.remaining, 0);

      const totalSessions = sessions.length;
      const covered = Math.min(totalCredits, totalSessions);
      const billable = totalSessions - covered;
      const billableAmount = billable * perSessionPaise;

      studentPreviews.push({
        student_email: student.student_email,
        student_name: student.student_name,
        has_enrollment: totalCredits > 0,
        credits_available: totalCredits,
        sessions_scheduled: totalSessions,
        sessions_covered: covered,
        sessions_billable: billable,
        billable_amount_paise: billableAmount,
        per_session_rate_paise: perSessionPaise,
        currency: feeCurrency,
        status: covered >= totalSessions
          ? 'fully_covered'
          : covered > 0
            ? 'partially_covered'
            : 'no_credits',
      });
    }

    // Summarize
    const fullyCovered = studentPreviews.filter(s => s.status === 'fully_covered').length;
    const partiallyCovered = studentPreviews.filter(s => s.status === 'partially_covered').length;
    const noCredits = studentPreviews.filter(s => s.status === 'no_credits').length;
    const noRate = studentPreviews.filter(s => s.status === 'no_rate').length;
    const totalBillable = studentPreviews.reduce((s, p) => s + p.billable_amount_paise, 0);
    const currency = studentPreviews[0]?.currency || 'INR';

    return NextResponse.json({
      success: true,
      data: {
        students: studentPreviews,
        summary: {
          total_students: studentPreviews.length,
          fully_covered: fullyCovered,
          partially_covered: partiallyCovered,
          no_credits: noCredits,
          no_rate: noRate,
          total_sessions: sessions.length,
          total_billable_paise: totalBillable,
          currency,
          formatted_billable: formatAmount(totalBillable, currency),
        },
        subject_counts: Object.fromEntries(subjectCounts),
      },
    });
  } catch (err) {
    console.error('[credit-check] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
