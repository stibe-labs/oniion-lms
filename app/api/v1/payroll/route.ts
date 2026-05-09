// ═══════════════════════════════════════════════════════════════
// Payroll API — /api/v1/payroll
// Manage pay configs, periods, payslips
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import {
  getAllPayConfigs, upsertPayConfig, getPayrollPeriods, createPayrollPeriod,
  generatePayslips, getPayslipsForPeriod, finalizePayroll, markPayrollPaid,
  markPayslipPaid, getTeachersWithRates, syncPayrollPeriods,
  getTeacherPayslips, getTeacherPayConfig, backfillSessionEarnings,
} from '@/lib/payroll';
import { formatAmount } from '@/lib/payment';
import { sendPayslipNotification } from '@/lib/email';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const url = new URL(req.url);
    const resource = url.searchParams.get('resource') || 'periods';

    // Teachers can only view their own payslips
    if (user.role === 'teacher') {
      const payslips = await getTeacherPayslips(user.id);
      const config = await getTeacherPayConfig(user.id);
      // Get per_hour_rate from user_profiles (rupees) and convert to paise for frontend
      const rateResult = await (await import('@/lib/db')).db.query(
        `SELECT per_hour_rate FROM user_profiles WHERE email = $1`,
        [user.id]
      );
      const perHourRateRupees = (rateResult.rows[0] as Record<string, number> | undefined)?.per_hour_rate || 0;
      const mergedConfig = config
        ? { ...config, per_hour_rate: perHourRateRupees * 100 }
        : perHourRateRupees
          ? { teacher_email: user.id, per_hour_rate: perHourRateRupees * 100, incentive_rules: {} }
          : null;
      return NextResponse.json({ success: true, data: { payslips, config: mergedConfig } });
    }

    if (!['owner', 'hr', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (resource === 'configs') {
      const configs = await getAllPayConfigs();
      return NextResponse.json({ success: true, data: { configs } });
    }

    if (resource === 'periods') {
      const periods = await getPayrollPeriods();
      return NextResponse.json({ success: true, data: { periods } });
    }

    if (resource === 'payslips') {
      const periodId = url.searchParams.get('periodId');
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const payslips = await getPayslipsForPeriod(periodId);
      return NextResponse.json({ success: true, data: { payslips } });
    }

    if (resource === 'teacher_rates') {
      const teachers = await getTeachersWithRates();
      return NextResponse.json({ success: true, data: { teachers } });
    }

    return NextResponse.json({ success: false, error: 'Invalid resource' }, { status: 400 });
  } catch (err) {
    console.error('[payroll] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['owner', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Owner/HR only' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // Set teacher pay config
    if (action === 'set_config') {
      const { teacherEmail, ratePerClass, incentiveRules } = body;
      if (!teacherEmail || !ratePerClass) {
        return NextResponse.json({ success: false, error: 'teacherEmail, ratePerClass required' }, { status: 400 });
      }
      const config = await upsertPayConfig(teacherEmail, ratePerClass, incentiveRules);
      return NextResponse.json({ success: true, data: config });
    }

    // Create payroll period
    if (action === 'create_period') {
      const { periodLabel, startDate, endDate } = body;
      if (!periodLabel || !startDate || !endDate) {
        return NextResponse.json({ success: false, error: 'periodLabel, startDate, endDate required' }, { status: 400 });
      }
      const period = await createPayrollPeriod(periodLabel, startDate, endDate);
      return NextResponse.json({ success: true, data: period });
    }

    // Generate payslips for a period
    if (action === 'generate') {
      const { periodId } = body;
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const payslips = await generatePayslips(periodId);

      // Send payslip notification emails (fire-and-forget)
      // Fetch period + full payslips with teacher names for email
      const fullSlips = await getPayslipsForPeriod(periodId);
      for (const ps of fullSlips) {
        const slip = ps as Record<string, unknown>;
        sendPayslipNotification({
          teacherName: String(slip.teacher_name || slip.teacher_email),
          recipientEmail: String(slip.teacher_email),
          periodLabel: String(slip.period_label || ''),
          classesConducted: Number(slip.classes_conducted || 0),
          basePay: formatAmount(Number(slip.base_pay_paise || 0)),
          incentive: formatAmount(Number(slip.incentive_paise || 0)),
          deductions: formatAmount(Number(slip.lop_paise || 0)),
          totalPay: formatAmount(Number(slip.total_paise || 0)),
          status: 'generated',
        }).catch(e => console.error('[payroll] Email failed for', slip.teacher_email, e));
      }

      return NextResponse.json({ success: true, data: { payslips, count: payslips.length } });
    }

    // Finalize payroll
    if (action === 'finalize') {
      const { periodId } = body;
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const result = await finalizePayroll(periodId);
      return NextResponse.json({ success: true, data: result });
    }

    // Mark as paid (bulk — all payslips in period)
    if (action === 'mark_paid') {
      const { periodId } = body;
      if (!periodId) return NextResponse.json({ success: false, error: 'periodId required' }, { status: 400 });
      const result = await markPayrollPaid(periodId, user.id);

      // Notify teachers that salary has been paid
      const paidSlips = await getPayslipsForPeriod(periodId);
      for (const ps of paidSlips) {
        const slip = ps as Record<string, unknown>;
        sendPayslipNotification({
          teacherName: String(slip.teacher_name || slip.teacher_email),
          recipientEmail: String(slip.teacher_email),
          periodLabel: String(slip.period_label || ''),
          classesConducted: Number(slip.classes_conducted || 0),
          basePay: formatAmount(Number(slip.base_pay_paise || 0)),
          incentive: formatAmount(Number(slip.incentive_paise || 0)),
          deductions: formatAmount(Number(slip.lop_paise || 0)),
          totalPay: formatAmount(Number(slip.total_paise || 0)),
          status: 'paid',
        }).catch(e => console.error('[payroll] Paid email failed for', slip.teacher_email, e));
      }

      return NextResponse.json({ success: true, data: result });
    }

    // Mark individual payslip as paid
    if (action === 'mark_slip_paid') {
      const { payslipId, paymentReference } = body;
      if (!payslipId) return NextResponse.json({ success: false, error: 'payslipId required' }, { status: 400 });
      const result = await markPayslipPaid(payslipId, user.id, paymentReference);

      // Notify this teacher
      const slipRes = await (await import('@/lib/db')).db.query(
        `SELECT ps.*, pu.full_name AS teacher_name, pp.period_label
         FROM payslips ps
         LEFT JOIN portal_users pu ON pu.email = ps.teacher_email
         LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
         WHERE ps.id = $1`, [payslipId]
      );
      if (slipRes.rows.length > 0) {
        const slip = slipRes.rows[0] as Record<string, unknown>;
        sendPayslipNotification({
          teacherName: String(slip.teacher_name || slip.teacher_email),
          recipientEmail: String(slip.teacher_email),
          periodLabel: String(slip.period_label || ''),
          classesConducted: Number(slip.classes_conducted || 0),
          basePay: formatAmount(Number(slip.base_pay_paise || 0)),
          incentive: formatAmount(Number(slip.incentive_paise || 0)),
          deductions: formatAmount(Number(slip.lop_paise || 0)),
          totalPay: formatAmount(Number(slip.total_paise || 0)),
          status: 'paid',
        }).catch(e => console.error('[payroll] Paid email failed for', slip.teacher_email, e));
      }

      return NextResponse.json({ success: true, data: result });
    }

    // Resend paid notification for a payslip (e.g. after fixing email constraint)
    if (action === 'resend_notification') {
      const { payslipId } = body;
      if (!payslipId) return NextResponse.json({ success: false, error: 'payslipId required' }, { status: 400 });
      const slipRes = await (await import('@/lib/db')).db.query(
        `SELECT ps.*, pu.full_name AS teacher_name, pp.period_label
         FROM payslips ps
         LEFT JOIN portal_users pu ON pu.email = ps.teacher_email
         LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
         WHERE ps.id = $1`, [payslipId]
      );
      if (slipRes.rows.length === 0) return NextResponse.json({ success: false, error: 'Payslip not found' }, { status: 404 });
      const slip = slipRes.rows[0] as Record<string, unknown>;
      await sendPayslipNotification({
        teacherName: String(slip.teacher_name || slip.teacher_email),
        recipientEmail: String(slip.teacher_email),
        periodLabel: String(slip.period_label || ''),
        classesConducted: Number(slip.classes_conducted || 0),
        basePay: formatAmount(Number(slip.base_pay_paise || 0)),
        incentive: formatAmount(Number(slip.incentive_paise || 0)),
        deductions: formatAmount(Number(slip.lop_paise || 0)),
        totalPay: formatAmount(Number(slip.total_paise || 0)),
        status: String(slip.status || 'paid'),
      });
      return NextResponse.json({ success: true });
    }

    // Auto-sync payroll periods from session earnings
    if (action === 'sync_periods') {
      const result = await syncPayrollPeriods();
      return NextResponse.json({ success: true, data: result });
    }

    // Backfill session earnings for all past sessions
    if (action === 'backfill_earnings') {
      const result = await backfillSessionEarnings();
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[payroll] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
