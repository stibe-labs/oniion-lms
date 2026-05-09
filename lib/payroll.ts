// ═══════════════════════════════════════════════════════════════
// stibe Portal — Payroll Service
// ═══════════════════════════════════════════════════════════════
// Teacher salary calculation, payslip generation, and management
//
// Usage:
//   import { calculatePayroll, generatePayslips, ... } from '@/lib/payroll';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ── Types ───────────────────────────────────────────────────

export interface TeacherPayConfig {
  teacher_email: string;
  rate_per_class: number;
  incentive_rules: Record<string, unknown>;
}

export interface PayslipInput {
  payrollPeriodId: string;
  teacherEmail: string;
  classesConducted: number;
  classesMissed: number;
  classesCancelled: number;
  ratePerClass: number;
  incentivePaise?: number;
  lopPaise?: number;
}

// ── Teacher Pay Config CRUD ─────────────────────────────────

export async function getTeacherPayConfig(teacherEmail: string) {
  const result = await db.query(
    `SELECT * FROM teacher_pay_config WHERE teacher_email = $1`,
    [teacherEmail]
  );
  return result.rows[0] || null;
}

export async function getAllPayConfigs() {
  const result = await db.query(
    `SELECT tpc.*, pu.full_name AS teacher_name
     FROM teacher_pay_config tpc
     LEFT JOIN portal_users pu ON pu.email = tpc.teacher_email
     ORDER BY pu.full_name`
  );
  return result.rows;
}

export async function upsertPayConfig(teacherEmail: string, ratePerClass: number, incentiveRules?: Record<string, unknown>) {
  const result = await db.query(
    `INSERT INTO teacher_pay_config (teacher_email, rate_per_class, incentive_rules)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (teacher_email) DO UPDATE
     SET rate_per_class = $2, incentive_rules = $3::jsonb, updated_at = NOW()
     RETURNING *`,
    [teacherEmail, ratePerClass, JSON.stringify(incentiveRules || {})]
  );
  return result.rows[0];
}

// ── Payroll Period CRUD ─────────────────────────────────────

export async function createPayrollPeriod(periodLabel: string, startDate: string, endDate: string) {
  const result = await db.query(
    `INSERT INTO payroll_periods (period_label, period_start, period_end, status)
     VALUES ($1, $2, $3, 'draft')
     RETURNING *`,
    [periodLabel, startDate, endDate]
  );
  return result.rows[0];
}

export async function getPayrollPeriods() {
  const result = await db.query(
    `SELECT pp.*,
            (SELECT COUNT(*) FROM payslips WHERE payroll_period_id = pp.id) AS payslip_count,
            (SELECT COALESCE(SUM(total_paise), 0) FROM payslips WHERE payroll_period_id = pp.id) AS total_paise
     FROM payroll_periods pp
     ORDER BY pp.period_start DESC`
  );
  return result.rows;
}

export async function getPayrollPeriod(periodId: string) {
  const result = await db.query(
    `SELECT * FROM payroll_periods WHERE id = $1`,
    [periodId]
  );
  return result.rows[0];
}

// ── Calculate and Generate Payslips ─────────────────────────

export async function generatePayslips(periodId: string) {
  return db.withTransaction(async (client) => {
    // Get period details
    const periodResult = await client.query(
      `SELECT * FROM payroll_periods WHERE id = $1 AND status = 'draft'`,
      [periodId]
    );
    if (periodResult.rows.length === 0) {
      throw new Error('Payroll period not found or already finalized');
    }
    const period = periodResult.rows[0];

    // Get all teachers with pay configs
    const teacherConfigs = await client.query(
      `SELECT up.email AS teacher_email, up.per_hour_rate, pu.full_name AS teacher_name,
              tpc.incentive_rules
       FROM user_profiles up
       INNER JOIN portal_users pu ON pu.email = up.email
       LEFT JOIN teacher_pay_config tpc ON tpc.teacher_email = up.email
       WHERE pu.portal_role = 'teacher' AND up.per_hour_rate IS NOT NULL`
    );

    const payslips = [];

    for (const config of teacherConfigs.rows as Array<Record<string, unknown>>) {
      const teacherEmail = config.teacher_email as string;
      const perHourRatePaise = (config.per_hour_rate as number) * 100; // rupees → paise

      // Count classes conducted in this period
      const classesResult = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE r.status = 'ended') AS conducted,
           COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled,
           COUNT(*) FILTER (WHERE r.status = 'scheduled' AND r.scheduled_start < NOW()) AS missed
         FROM rooms r
         WHERE r.teacher_email = $1
           AND r.scheduled_start >= $2
           AND r.scheduled_start <= $3`,
        [teacherEmail, period.period_start, period.period_end]
      );

      const stats = classesResult.rows[0] as Record<string, string>;
      const classesConducted = parseInt(stats.conducted || '0');
      const classesCancelled = parseInt(stats.cancelled || '0');
      const classesMissed = parseInt(stats.missed || '0');

      // Count approved extensions for this teacher in this period
      const extResult = await client.query(
        `SELECT COUNT(*) AS ext_count,
                COALESCE(SUM(ser.requested_minutes), 0) AS ext_minutes
         FROM session_extension_requests ser
         JOIN rooms r ON r.room_id = ser.room_id
         WHERE ser.teacher_email = $1
           AND ser.status = 'approved'
           AND r.scheduled_start >= $2
           AND r.scheduled_start <= $3`,
        [teacherEmail, period.period_start, period.period_end]
      );
      const extStats = extResult.rows[0] as Record<string, string>;
      const extensionSessions = parseInt(extStats.ext_count || '0');
      const extensionMinutes = parseInt(extStats.ext_minutes || '0');

      // Extension pay: same hourly rate prorated
      const extensionPaise = extensionMinutes > 0 ? Math.round(perHourRatePaise * (extensionMinutes / 60)) : 0;

      // Base pay from stored per-session earnings (accurate, auto-calculated on session end)
      const earningsResult = await client.query(
        `SELECT COALESCE(SUM(base_paise), 0) AS sum_base
         FROM teacher_session_earnings
         WHERE teacher_email = $1
           AND scheduled_date >= $2 AND scheduled_date <= $3`,
        [teacherEmail, period.period_start, period.period_end]
      );
      const basePay = parseInt((earningsResult.rows[0] as Record<string, string>).sum_base || '0');

      // Incentive: extra per class if more than threshold
      const incentiveRules = config.incentive_rules as Record<string, unknown>;
      let incentive = 0;
      const bonusThreshold = (incentiveRules?.bonus_threshold as number) || 20;
      const bonusPerClass = (incentiveRules?.bonus_per_class as number) || 50;
      if (classesConducted > bonusThreshold) {
        incentive = (classesConducted - bonusThreshold) * bonusPerClass;
      }

      // LOP (Loss of Pay) for missed classes — half hour's pay per miss
      const lop = classesMissed * Math.floor(perHourRatePaise * 0.5);

      // Medical leave salary adjustment — restore LOP for confirmed sick leaves with certificate
      const medicalAdjResult = await client.query(
        `SELECT salary_adjustment, affected_sessions
         FROM teacher_leave_requests
         WHERE teacher_email = $1
           AND status = 'confirmed'
           AND leave_type = 'sick'
           AND salary_adjustment IN ('full_pay', 'half_pay')
           AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')`,
        [teacherEmail, period.period_start, period.period_end]
      );
      let medicalAdjPaise = 0;
      for (const leave of medicalAdjResult.rows as Array<{ salary_adjustment: string; affected_sessions: string[] }>) {
        const sessCount = (leave.affected_sessions || []).length;
        const lopPerSession = Math.floor(perHourRatePaise * 0.5);
        if (leave.salary_adjustment === 'full_pay') {
          medicalAdjPaise += sessCount * lopPerSession;
        } else if (leave.salary_adjustment === 'half_pay') {
          medicalAdjPaise += Math.floor(sessCount * lopPerSession * 0.5);
        }
      }
      // Cap adjustment to not exceed total LOP
      medicalAdjPaise = Math.min(medicalAdjPaise, lop);

      const totalPaise = basePay + extensionPaise + incentive - lop + medicalAdjPaise;

      // Insert payslip (rate_per_class stores per_hour_rate_paise for reference)
      const slipResult = await client.query(
        `INSERT INTO payslips (
           payroll_period_id, teacher_email, classes_conducted,
           classes_missed, classes_cancelled, rate_per_class,
           base_pay_paise, incentive_paise, lop_paise,
           extension_sessions, extension_paise, total_paise,
           medical_leave_adjustment_paise, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft')
         ON CONFLICT (payroll_period_id, teacher_email) DO UPDATE
         SET classes_conducted = $3, classes_missed = $4, classes_cancelled = $5,
             rate_per_class = $6, base_pay_paise = $7, incentive_paise = $8,
             lop_paise = $9, extension_sessions = $10, extension_paise = $11,
             total_paise = $12, medical_leave_adjustment_paise = $13, updated_at = NOW()
         RETURNING *`,
        [
          periodId, teacherEmail, classesConducted,
          classesMissed, classesCancelled, perHourRatePaise,
          basePay, incentive, lop,
          extensionSessions, extensionPaise, totalPaise,
          medicalAdjPaise,
        ]
      );

      payslips.push(slipResult.rows[0]);
    }

    return payslips;
  });
}

// ── Record Per-Session Earning (called on session end) ───────

export async function recordSessionEarning(roomId: string) {
  // Get room details
  const roomResult = await db.query(
    `SELECT r.room_id, r.teacher_email, r.batch_id, r.batch_session_id,
            r.subject, r.duration_minutes, r.go_live_at, r.ended_at,
            r.scheduled_start,
            COALESCE(r.original_duration_minutes, r.duration_minutes) AS planned_minutes
     FROM rooms r
     WHERE r.room_id = $1 AND r.status = 'ended'`,
    [roomId]
  );
  if (roomResult.rows.length === 0) return null;
  const room = roomResult.rows[0] as Record<string, unknown>;
  const teacherEmail = room.teacher_email as string;
  if (!teacherEmail) return null;

  // Get per-hour rate from user_profiles (stored in rupees, e.g. 900 = ₹900/hr)
  const rateResult = await db.query(
    `SELECT per_hour_rate FROM user_profiles WHERE email = $1`,
    [teacherEmail]
  );
  const perHourRateRupees = (rateResult.rows[0] as Record<string, number> | undefined)?.per_hour_rate;
  if (!perHourRateRupees) {
    console.log(`[payroll] No per_hour_rate for ${teacherEmail}, skipping earning for ${roomId}`);
    return null;
  }
  const perHourRatePaise = perHourRateRupees * 100; // ₹900 → 90000 paise

  const plannedMinutes = (room.planned_minutes as number) || 60;

  // Calculate actual teaching minutes (go_live_at → ended_at)
  let actualMinutes = plannedMinutes;
  if (room.go_live_at && room.ended_at) {
    const diffMs = new Date(room.ended_at as string).getTime() - new Date(room.go_live_at as string).getTime();
    actualMinutes = Math.max(1, Math.round(diffMs / 60000));
  }

  // Check for approved extensions on this room
  const extResult = await db.query(
    `SELECT COALESCE(SUM(requested_minutes), 0) AS ext_minutes
     FROM session_extension_requests
     WHERE room_id = $1 AND status = 'approved'`,
    [roomId]
  );
  const extensionMinutes = parseInt((extResult.rows[0] as Record<string, string>).ext_minutes || '0');

  // Base pay: per_hour_rate prorated by scheduled duration
  // e.g. ₹900/hr × (90min / 60) = ₹1,350
  const basePaise = Math.round(perHourRatePaise * (plannedMinutes / 60));

  // Extension pay: same hourly rate prorated by extension minutes
  const extensionPaise = extensionMinutes > 0 ? Math.round(perHourRatePaise * (extensionMinutes / 60)) : 0;

  const totalPaise = basePaise + extensionPaise;

  // Derive scheduled_date from scheduled_start
  const scheduledDate = room.scheduled_start
    ? new Date(room.scheduled_start as string).toISOString().slice(0, 10)
    : null;

  // Upsert (idempotent — safe to call multiple times for same room)
  const result = await db.query(
    `INSERT INTO teacher_session_earnings (
       room_id, batch_session_id, teacher_email, batch_id, subject,
       scheduled_date, duration_minutes, actual_minutes,
       per_hour_rate_paise, base_paise, extension_minutes, extension_paise, total_paise
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (room_id) DO UPDATE
     SET actual_minutes = $8, per_hour_rate_paise = $9, base_paise = $10,
         extension_minutes = $11, extension_paise = $12, total_paise = $13
     RETURNING *`,
    [
      roomId, room.batch_session_id, teacherEmail, room.batch_id, room.subject,
      scheduledDate, plannedMinutes, actualMinutes,
      perHourRatePaise, basePaise, extensionMinutes, extensionPaise, totalPaise,
    ]
  );

  console.log(`[payroll] Recorded earning for ${teacherEmail}: ₹${(totalPaise / 100).toFixed(2)} (room ${roomId}, ${plannedMinutes}min @ ₹${perHourRateRupees}/hr)`);
  return result.rows[0];
}

// ── Get Per-Session Earnings for a Teacher ───────────────────

export async function getTeacherSessionEarnings(teacherEmail: string, limit = 50) {
  const result = await db.query(
    `SELECT tse.*, b.batch_name
     FROM teacher_session_earnings tse
     LEFT JOIN batches b ON b.batch_id = tse.batch_id
     WHERE tse.teacher_email = $1
     ORDER BY tse.scheduled_date DESC, tse.created_at DESC
     LIMIT $2`,
    [teacherEmail, limit]
  );
  return result.rows;
}

// ── Backfill Session Earnings for All Past Sessions ─────────

export async function backfillSessionEarnings() {
  // Find all ended rooms that don't have an earnings record yet (teacher must have per_hour_rate)
  const result = await db.query(
    `SELECT r.room_id
     FROM rooms r
     INNER JOIN user_profiles up ON up.email = r.teacher_email AND up.per_hour_rate IS NOT NULL
     LEFT JOIN teacher_session_earnings tse ON tse.room_id = r.room_id
     WHERE r.status = 'ended'
       AND r.teacher_email IS NOT NULL
       AND tse.id IS NULL
     ORDER BY r.scheduled_start DESC`
  );

  const results = { total: result.rows.length, recorded: 0, skipped: 0, errors: 0 };

  for (const row of result.rows) {
    try {
      const earning = await recordSessionEarning(row.room_id as string);
      if (earning) results.recorded++;
      else results.skipped++;
    } catch (e) {
      console.error(`[payroll/backfill] Error for room ${row.room_id}:`, e);
      results.errors++;
    }
  }

  console.log(`[payroll/backfill] Done: ${results.recorded} recorded, ${results.skipped} skipped, ${results.errors} errors out of ${results.total}`);
  return results;
}

// ── Real-time Salary for Current Month (Teacher Dashboard) ──

export async function getTeacherLiveSalary(teacherEmail: string) {
  // Get per-hour rate from user_profiles (rupees INT → paise)
  const rateResult = await db.query(
    `SELECT per_hour_rate FROM user_profiles WHERE email = $1`,
    [teacherEmail]
  );
  const perHourRateRupees = (rateResult.rows[0] as Record<string, number> | undefined)?.per_hour_rate;
  if (!perHourRateRupees) {
    return {
      configured: false,
      per_hour_rate: 0,
      incentive_rules: null,
      current_month: null,
      recent_earnings: [],
    };
  }
  const perHourRatePaise = perHourRateRupees * 100;

  // Get incentive rules from teacher_pay_config (if any)
  const config = await getTeacherPayConfig(teacherEmail);
  const incentiveRules = (config?.incentive_rules as Record<string, unknown>) || null;

  // Current month boundaries (IST)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // Get session counts from rooms (for upcoming/missed/cancelled which aren't in earnings table)
  const classesResult = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE r.status = 'ended') AS conducted,
       COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled,
       COUNT(*) FILTER (WHERE r.status = 'scheduled' AND r.scheduled_start < NOW()) AS missed,
       COUNT(*) FILTER (WHERE r.status = 'scheduled' AND r.scheduled_start >= NOW()) AS upcoming
     FROM rooms r
     WHERE r.teacher_email = $1
       AND r.scheduled_start >= $2
       AND r.scheduled_start <= ($3::date + INTERVAL '1 day')`,
    [teacherEmail, monthStart, monthEnd]
  );
  const stats = classesResult.rows[0] as Record<string, string>;
  const conducted = parseInt(stats.conducted || '0');
  const cancelled = parseInt(stats.cancelled || '0');
  const missed = parseInt(stats.missed || '0');
  const upcoming = parseInt(stats.upcoming || '0');

  // Sum earnings from stored per-session records (accurate, auto-calculated on session end)
  const earningsResult = await db.query(
    `SELECT
       COALESCE(SUM(base_paise), 0) AS total_base,
       COALESCE(SUM(extension_paise), 0) AS total_ext,
       COALESCE(SUM(extension_minutes), 0) AS total_ext_minutes,
       COUNT(*) FILTER (WHERE extension_minutes > 0) AS ext_sessions,
       COALESCE(SUM(total_paise), 0) AS total_earned
     FROM teacher_session_earnings
     WHERE teacher_email = $1
       AND scheduled_date >= $2
       AND scheduled_date <= $3`,
    [teacherEmail, monthStart, monthEnd]
  );
  const earned = earningsResult.rows[0] as Record<string, string>;
  const basePay = parseInt(earned.total_base || '0');
  const extensionPaise = parseInt(earned.total_ext || '0');
  const extensionMinutes = parseInt(earned.total_ext_minutes || '0');
  const extensionSessions = parseInt(earned.ext_sessions || '0');

  // Incentive calculated on total conducted sessions
  let incentive = 0;
  const bonusThreshold = (incentiveRules?.bonus_threshold as number) || 0;
  const bonusPerClass = (incentiveRules?.bonus_per_class as number) || 0;
  if (bonusThreshold > 0 && bonusPerClass > 0 && conducted > bonusThreshold) {
    incentive = (conducted - bonusThreshold) * bonusPerClass;
  }

  const lop = missed * Math.floor(perHourRatePaise * 0.5); // LOP = half hour's pay per missed session

  // Medical leave salary adjustment (same logic as payslip generation)
  const medLiveResult = await db.query(
    `SELECT salary_adjustment, affected_sessions
     FROM teacher_leave_requests
     WHERE teacher_email = $1
       AND status = 'confirmed'
       AND leave_type = 'sick'
       AND salary_adjustment IN ('full_pay', 'half_pay')
       AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')`,
    [teacherEmail, monthStart, monthEnd]
  );
  let medicalAdjPaise = 0;
  for (const leave of medLiveResult.rows as Array<{ salary_adjustment: string; affected_sessions: string[] }>) {
    const sessCount = (leave.affected_sessions || []).length;
    const lopPerSession = Math.floor(perHourRatePaise * 0.5);
    if (leave.salary_adjustment === 'full_pay') {
      medicalAdjPaise += sessCount * lopPerSession;
    } else if (leave.salary_adjustment === 'half_pay') {
      medicalAdjPaise += Math.floor(sessCount * lopPerSession * 0.5);
    }
  }
  medicalAdjPaise = Math.min(medicalAdjPaise, lop);

  const totalPaise = basePay + extensionPaise + incentive - lop + medicalAdjPaise;

  // Recent session-level earnings (last 10)
  const recentResult = await db.query(
    `SELECT tse.*, b.batch_name
     FROM teacher_session_earnings tse
     LEFT JOIN batches b ON b.batch_id = tse.batch_id
     WHERE tse.teacher_email = $1
     ORDER BY tse.scheduled_date DESC, tse.created_at DESC
     LIMIT 10`,
    [teacherEmail]
  );

  return {
    configured: true,
    per_hour_rate: perHourRatePaise,
    incentive_rules: incentiveRules,
    current_month: {
      label: monthLabel,
      start: monthStart,
      end: monthEnd,
      classes_conducted: conducted,
      classes_missed: missed,
      classes_cancelled: cancelled,
      classes_upcoming: upcoming,
      extension_sessions: extensionSessions,
      extension_minutes: extensionMinutes,
      base_pay_paise: basePay,
      extension_paise: extensionPaise,
      incentive_paise: incentive,
      lop_paise: lop,
      medical_leave_adjustment_paise: medicalAdjPaise,
      total_paise: totalPaise,
    },
    recent_earnings: recentResult.rows,
  };
}

// ── Get Payslips for a Period ────────────────────────────────

export async function getPayslipsForPeriod(periodId: string) {
  const result = await db.query(
    `SELECT ps.*, pu.full_name AS teacher_name, pp.period_label,
            up.per_hour_rate
     FROM payslips ps
     LEFT JOIN portal_users pu ON pu.email = ps.teacher_email
     LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
     LEFT JOIN user_profiles up ON up.email = ps.teacher_email
     WHERE ps.payroll_period_id = $1
     ORDER BY pu.full_name`,
    [periodId]
  );
  return result.rows;
}

// ── Get Teacher Payslips ────────────────────────────────────

export async function getTeacherPayslips(teacherEmail: string) {
  const result = await db.query(
    `SELECT ps.*, pp.period_label, pp.period_start AS start_date, pp.period_end AS end_date,
            ps.paid_at, ps.payment_reference
     FROM payslips ps
     JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
     WHERE ps.teacher_email = $1
     ORDER BY pp.period_start DESC`,
    [teacherEmail]
  );
  return result.rows;
}

// ── Finalize Payroll ────────────────────────────────────────

export async function finalizePayroll(periodId: string) {
  return db.withTransaction(async (client) => {
    // Update period status
    await client.query(
      `UPDATE payroll_periods SET status = 'finalized' WHERE id = $1`,
      [periodId]
    );

    // Update all payslips to finalized
    await client.query(
      `UPDATE payslips SET status = 'finalized' WHERE payroll_period_id = $1`,
      [periodId]
    );

    return { success: true };
  });
}

// ── Mark Individual Payslip as Paid ─────────────────────────

export async function markPayslipPaid(
  payslipId: string,
  paidBy: string,
  paymentReference?: string,
) {
  return db.withTransaction(async (client) => {
    // Mark the individual payslip as paid
    const result = await client.query(
      `UPDATE payslips
       SET status = 'paid', paid_at = NOW(), paid_by = $2, payment_reference = $3
       WHERE id = $1 AND status = 'finalized'
       RETURNING payroll_period_id`,
      [payslipId, paidBy, paymentReference || null]
    );
    if (result.rowCount === 0) {
      throw new Error('Payslip not found or not in finalized state');
    }

    const periodId = (result.rows[0] as Record<string, string>).payroll_period_id;

    // Check if all payslips in this period are now paid → auto-transition period
    const remaining = await client.query(
      `SELECT COUNT(*) AS unpaid FROM payslips
       WHERE payroll_period_id = $1 AND status != 'paid'`,
      [periodId]
    );
    const unpaidCount = parseInt((remaining.rows[0] as Record<string, string>).unpaid);
    if (unpaidCount === 0) {
      await client.query(
        `UPDATE payroll_periods SET status = 'paid' WHERE id = $1`,
        [periodId]
      );
    }

    return { success: true, all_paid: unpaidCount === 0 };
  });
}

// ── Bulk Mark All Payslips as Paid ──────────────────────────

export async function markPayrollPaid(periodId: string, paidBy: string) {
  return db.withTransaction(async (client) => {
    await client.query(
      `UPDATE payroll_periods SET status = 'paid' WHERE id = $1`,
      [periodId]
    );
    await client.query(
      `UPDATE payslips SET status = 'paid', paid_at = NOW(), paid_by = $1
       WHERE payroll_period_id = $2 AND status = 'finalized'`,
      [paidBy, periodId]
    );
    return { success: true };
  });
}

// ── Auto-Sync Payroll Periods from Earnings ─────────────────

export async function syncPayrollPeriods() {
  // Find all months with session earnings
  const months = await db.query(
    `SELECT DISTINCT
       DATE_TRUNC('month', scheduled_date)::date AS start_date,
       (DATE_TRUNC('month', scheduled_date) + INTERVAL '1 month' - INTERVAL '1 day')::date AS end_date
     FROM teacher_session_earnings
     WHERE scheduled_date IS NOT NULL
     ORDER BY start_date DESC`
  );

  let created = 0;
  for (const m of months.rows as Array<Record<string, string>>) {
    // Skip if period already exists for this month
    const existing = await db.query(
      `SELECT id FROM payroll_periods WHERE period_start = $1 AND period_end = $2`,
      [m.start_date, m.end_date]
    );
    if (existing.rows.length > 0) continue;

    // Create period with proper month label
    const d = new Date(m.start_date + 'T00:00:00');
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const period = await createPayrollPeriod(label, m.start_date, m.end_date);
    await generatePayslips((period as Record<string, string>).id);
    created++;
  }

  return { synced: created };
}

// ── Get All Teachers with Per-Hour Rates ────────────────────

export async function getTeachersWithRates() {
  const result = await db.query(
    `SELECT pu.email, pu.full_name, up.per_hour_rate, up.subjects,
            (SELECT COUNT(*) FROM rooms r WHERE r.teacher_email = pu.email AND r.status = 'ended') AS total_sessions,
            (SELECT COALESCE(SUM(tse.total_paise), 0) FROM teacher_session_earnings tse WHERE tse.teacher_email = pu.email) AS total_earned_paise
     FROM portal_users pu
     LEFT JOIN user_profiles up ON up.email = pu.email
     WHERE pu.portal_role = 'teacher' AND pu.is_active = TRUE
     ORDER BY pu.full_name`
  );
  return result.rows;
}
