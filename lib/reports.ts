// ═══════════════════════════════════════════════════════════════
// stibe Portal — Report Generator Service
// ═══════════════════════════════════════════════════════════════
// Generates reports: attendance, revenue, teacher performance,
// student progress, batch summary, exam analytics, payroll
// Includes AI-style natural language summaries for each report.
//
// Usage:
//   import { generateReport, getReports } from '@/lib/reports';
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ── Types ───────────────────────────────────────────────────

export type ReportType =
  | 'attendance'
  | 'revenue'
  | 'teacher_performance'
  | 'student_progress'
  | 'batch_summary'
  | 'exam_analytics'
  | 'payroll_summary'
  | 'session_report'
  | 'parent_monthly'
  | 'daily_business'
  | 'weekly_sales';

// ── Generate Report ─────────────────────────────────────────

export async function generateReport(
  reportType: ReportType,
  periodStart: string,
  periodEnd: string,
  createdBy: string,
  filters?: Record<string, string>
) {
  let data: Record<string, unknown> = {};
  let title = '';

  switch (reportType) {
    case 'attendance':
      ({ data, title } = await generateAttendanceReport(periodStart, periodEnd, filters));
      break;
    case 'revenue':
      ({ data, title } = await generateRevenueReport(periodStart, periodEnd));
      break;
    case 'teacher_performance':
      ({ data, title } = await generateTeacherPerformanceReport(periodStart, periodEnd));
      break;
    case 'student_progress':
      ({ data, title } = await generateStudentProgressReport(periodStart, periodEnd, filters));
      break;
    case 'batch_summary':
      ({ data, title } = await generateBatchSummaryReport(periodStart, periodEnd));
      break;
    case 'exam_analytics':
      ({ data, title } = await generateExamAnalyticsReport(periodStart, periodEnd));
      break;
    case 'payroll_summary':
      ({ data, title } = await generatePayrollSummaryReport(periodStart, periodEnd));
      break;
    case 'session_report':
      ({ data, title } = await generateSessionReport(periodStart, periodEnd, filters));
      break;
    case 'parent_monthly':
      ({ data, title } = await generateParentMonthlyReport(periodStart, periodEnd, filters));
      break;
    case 'daily_business':
      ({ data, title } = await generateDailyBusinessReport(periodStart, periodEnd));
      break;
    case 'weekly_sales':
      ({ data, title } = await generateWeeklySalesReport(periodStart, periodEnd));
      break;
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

  // Store report
  const narrativeSummary = generateNarrativeSummary(reportType, data, title);
  const reportData = { ...data, narrative_summary: narrativeSummary };

  const result = await db.query(
    `INSERT INTO generated_reports (report_type, title, period_start, period_end, data, generated_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING *`,
    [reportType, title, periodStart, periodEnd, JSON.stringify(reportData), createdBy]
  );

  return result.rows[0];
}

// ── Get Reports ─────────────────────────────────────────────

export async function getReports(filters?: {
  reportType?: string;
  limit?: number;
}) {
  let sql = `SELECT * FROM generated_reports WHERE 1=1`;
  const params: unknown[] = [];

  if (filters?.reportType) {
    params.push(filters.reportType);
    sql += ` AND report_type = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC`;
  params.push(filters?.limit || 50);
  sql += ` LIMIT $${params.length}`;

  const result = await db.query(sql, params);
  return result.rows;
}

export async function getReport(reportId: string) {
  const result = await db.query(`SELECT * FROM generated_reports WHERE id = $1`, [reportId]);
  return result.rows[0] || null;
}

// ═══════════════════════════════════════════════════════════════
// AI-Style Narrative Summary Generator
// Produces human-readable natural language summaries for reports
// ═══════════════════════════════════════════════════════════════

function generateNarrativeSummary(
  reportType: ReportType,
  data: Record<string, unknown>,
  title: string
): string {
  switch (reportType) {
    case 'attendance': {
      const summary = (data.summary as Record<string, number>) || {};
      const students = (data.students as Array<Record<string, unknown>>) || [];
      const total = summary.total_classes || 0;
      const completed = summary.completed || 0;
      const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
      const topStudents = students.slice(0, 3).map(s => s.full_name || s.participant_email).join(', ');
      return `${title}\n\nDuring this period, ${total} classes were scheduled with ${completed} completed successfully (${rate}% completion rate). ${summary.cancelled || 0} classes were cancelled. ${students.length} students participated — the most active being ${topStudents || 'N/A'}. ${Number(rate) >= 80 ? 'Overall attendance is healthy and above target.' : 'Attendance rates need improvement — consider sending reminders to students with low participation.'}`;
    }

    case 'revenue': {
      const byCurrency = (data.by_currency as Array<Record<string, unknown>>) || [];
      const monthly = (data.monthly_breakdown as Array<Record<string, unknown>>) || [];
      const summaries = byCurrency.map(c => {
        const paid = Number(c.paid_invoices || 0);
        const pending = Number(c.pending_invoices || 0);
        const overdue = Number(c.overdue_invoices || 0);
        const revenue = (Number(c.total_revenue_paise || 0) / 100).toFixed(2);
        return `${c.currency || 'INR'}: ${paid} paid invoices totalling ${revenue}, ${pending} pending, ${overdue} overdue`;
      });
      return `${title}\n\n${summaries.join('. ') || 'No revenue data found for this period.'}. ${monthly.length > 0 ? `Revenue was tracked across ${monthly.length} month(s).` : ''} ${byCurrency.some(c => Number(c.overdue_invoices || 0) > 0) ? 'Action needed: There are overdue invoices requiring follow-up with parents.' : 'All collections are on track.'}`;
    }

    case 'teacher_performance': {
      const teachers = (data.teachers as Array<Record<string, unknown>>) || [];
      if (teachers.length === 0) return `${title}\n\nNo teacher performance data available for this period.`;
      const topTeacher = teachers[0];
      const totalClasses = teachers.reduce((sum, t) => sum + Number(t.completed_classes || 0), 0);
      const totalCancelled = teachers.reduce((sum, t) => sum + Number(t.cancelled_classes || 0), 0);
      return `${title}\n\n${teachers.length} teachers were active during this period, conducting a total of ${totalClasses} classes. The most active teacher was ${topTeacher.teacher_name || topTeacher.teacher_email} with ${topTeacher.completed_classes} completed classes serving ${topTeacher.unique_students} unique students. ${totalCancelled > 0 ? `${totalCancelled} classes were cancelled across all teachers — investigate if any teacher has a high cancellation rate.` : 'No cancellations recorded — excellent reliability.'}`;
    }

    case 'student_progress': {
      const exams = (data.exam_performance as Array<Record<string, unknown>>) || [];
      if (exams.length === 0) return `${title}\n\nNo student exam data available for this period.`;
      const avgScore = exams.reduce((sum, e) => sum + Number(e.avg_percentage || 0), 0) / exams.length;
      const topStudent = exams[0];
      return `${title}\n\n${exams.length} students took exams during this period with an overall average score of ${avgScore.toFixed(1)}%. ${topStudent.student_name || topStudent.student_email} leads with ${Number(topStudent.avg_percentage || 0).toFixed(1)}% average, having passed ${topStudent.exams_passed || 0} out of ${topStudent.exams_taken || 0} exams. ${avgScore >= 70 ? 'Academic performance is strong overall.' : 'Average scores are below 70% — additional tutoring or revision sessions may be beneficial.'}`;
    }

    case 'batch_summary': {
      const batches = (data.batches as Array<Record<string, unknown>>) || [];
      const activeBatches = batches.filter(b => b.status === 'ended' || b.status === 'live');
      return `${title}\n\n${batches.length} batches operated during this period with ${activeBatches.length} active/completed. Subjects covered include ${[...new Set(batches.map(b => b.subject))].filter(Boolean).join(', ') || 'various'}. ${batches.length > 0 ? `Average class had ${Math.round(batches.reduce((s, b) => s + Number(b.student_count || 0), 0) / batches.length)} enrolled students.` : ''}`;
    }

    case 'exam_analytics': {
      const exams = (data.exams as Array<Record<string, unknown>>) || [];
      if (exams.length === 0) return `${title}\n\nNo exams conducted during this period.`;
      const totalAttempts = exams.reduce((s, e) => s + Number(e.total_attempts || 0), 0);
      const avgPct = exams.reduce((s, e) => s + Number(e.avg_percentage || 0), 0) / exams.length;
      const totalPassed = exams.reduce((s, e) => s + Number(e.passed || 0), 0);
      const totalFailed = exams.reduce((s, e) => s + Number(e.failed || 0), 0);
      const passRate = (totalPassed + totalFailed) > 0 ? ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : '0';
      return `${title}\n\n${exams.length} exams were conducted with ${totalAttempts} total student attempts. The overall pass rate is ${passRate}% with an average score of ${avgPct.toFixed(1)}%. ${Number(passRate) >= 75 ? 'The pass rate is healthy.' : 'The pass rate is below 75% — consider reviewing exam difficulty or providing additional study materials.'}`;
    }

    case 'payroll_summary': {
      const periods = (data.periods as Array<Record<string, unknown>>) || [];
      if (periods.length === 0) return `${title}\n\nNo payroll data available for this period.`;
      const totalPayroll = periods.reduce((s, p) => s + Number(p.total_payroll || 0), 0);
      const totalTeachers = periods.reduce((s, p) => s + Number(p.teacher_count || 0), 0);
      const totalClasses = periods.reduce((s, p) => s + Number(p.total_classes_conducted || 0), 0);
      return `${title}\n\nTotal payroll processed: ₹${(totalPayroll / 100).toFixed(2)} across ${totalTeachers} teacher payslips. ${totalClasses} classes were conducted. ${periods.some(p => p.period_status === 'draft') ? 'Some payroll periods are still in draft — finalize and mark as paid.' : 'All payroll periods are finalized.'}`;
    }

    case 'session_report': {
      const sessions = (data.sessions as Array<Record<string, unknown>>) || [];
      if (sessions.length === 0) return `${title}\n\nNo session data available.`;
      const session = sessions[0];
      const att = session.attendance as Record<string, unknown> || {};
      return `${title}\n\nClass "${session.batch_name}" (${session.subject}, ${session.grade}) was conducted by ${session.teacher}. Duration: ${session.actual_duration_minutes} minutes (scheduled: ${session.scheduled_duration} min). Attendance: ${att.present || 0}/${att.total_students || 0} students present (${att.attendance_rate || 0}% rate), ${att.late || 0} late arrivals. Topic covered: ${session.class_portion || 'Not recorded'}. Teacher remarks: ${session.class_remarks || 'No remarks'}. ${Number(session.contact_violations || 0) > 0 ? `⚠️ ${session.contact_violations} contact violation(s) detected during this session.` : 'No contact violations.'}`;
    }

    case 'parent_monthly': {
      const students = (data.students as Array<Record<string, unknown>>) || [];
      if (students.length === 0) return `${title}\n\nNo student data available for this report.`;
      return students.map(s => {
        const att = s.attendance as Record<string, number> || {};
        const academic = s.academic as Record<string, number> || {};
        const fees = s.fees as Record<string, number> || {};
        const violations = Number(s.contact_violations || 0);
        const topics = (s.topics_covered as Array<Record<string, unknown>>) || [];

        let summary = `Student: ${s.student_name}\n`;
        summary += `Attendance: ${att.attendance_rate || 0}% (${att.present || 0} present, ${att.absent || 0} absent, ${att.late || 0} late out of ${att.total_sessions || 0} sessions). Average time in class: ${att.avg_time_in_class_minutes || 0} minutes.\n`;
        summary += `Academic Performance: ${academic.exams_taken || 0} exams taken with ${academic.avg_percentage || 0}% average score. Best: ${academic.best_score || 0}%, Lowest: ${academic.worst_score || 0}%.\n`;
        summary += `Fee Status: ${fees.paid || 0} invoices paid, ${fees.pending || 0} pending, ${fees.overdue || 0} overdue. Total paid: ₹${fees.total_paid_inr || 0}, Outstanding: ₹${fees.outstanding_inr || 0}.\n`;
        if (topics.length > 0) {
          summary += `Topics covered: ${topics.map(t => t.class_portion).filter(Boolean).join(', ')}.\n`;
        }
        if (violations > 0) {
          summary += `⚠️ ${violations} unauthorized contact attempt(s) detected — please discuss appropriate communication channels with your child.\n`;
        }
        summary += att.attendance_rate >= 80 && academic.avg_percentage >= 60
          ? 'Overall: Your child is performing well. Keep up the good work!'
          : att.attendance_rate < 75
            ? 'Overall: Attendance needs improvement. Regular attendance is crucial for academic success.'
            : 'Overall: Academic performance could be improved. Consider additional study time or tutoring support.';
        return summary;
      }).join('\n\n---\n\n');
    }

    case 'daily_business': {
      const sessions = data.sessions as Record<string, number> || {};
      const rev = data.revenue as Record<string, number> || {};
      const att = data.attendance as Record<string, number> || {};
      const totalRev = ((rev.collected_today_paise || 0) / 100).toFixed(2);
      return `${title}\n\nToday's snapshot: ${sessions.total || 0} classes scheduled (${sessions.live || 0} live, ${sessions.completed || 0} completed, ${sessions.cancelled || 0} cancelled). Revenue collected today: ₹${totalRev} from ${rev.payments_today || 0} payments. ${rev.pending_invoices || 0} invoices still pending. Attendance rate across today's classes: ${att.attendance_rate || 0}%. Active batches: ${data.active_batches || 0}. New student enrollments: ${data.new_students_today || 0}. ${Number(att.attendance_rate || 0) >= 80 ? 'Operations running smoothly.' : 'Attendance below target — follow up on absences.'}`;
    }

    case 'weekly_sales': {
      const weekly = data.weekly as Record<string, number> || {};
      const daily = (data.daily_breakdown as Array<Record<string, unknown>>) || [];
      const collectionRate = weekly.total_invoiced ? ((weekly.total_collected / weekly.total_invoiced) * 100).toFixed(1) : '0';
      const topBatches = (data.top_batches as Array<Record<string, unknown>>) || [];
      const topList = topBatches.slice(0, 3).map(b => `${b.batch_name} (₹${((Number(b.revenue_paise || 0)) / 100).toFixed(0)})`).join(', ');
      return `${title}\n\nThis week: ${weekly.invoices_created || 0} invoices created, ${weekly.invoices_paid || 0} paid, ${weekly.invoices_overdue || 0} overdue. Total collected: ₹${((weekly.total_collected || 0) / 100).toFixed(2)}. Collection rate: ${collectionRate}%. New enrollments this week: ${weekly.new_enrollments || 0}. ${daily.length > 0 ? `Revenue tracked across ${daily.length} day(s).` : ''} Top revenue batches: ${topList || 'N/A'}. ${Number(collectionRate) >= 80 ? 'Collection performance is strong.' : 'Collection rate below 80% — intensify follow-ups on pending payments.'}`;
    }

    default:
      return `${title}\n\nReport generated successfully.`;
  }
}

// ═══════════════════════════════════════════════════════════════
// Report Generators
// ═══════════════════════════════════════════════════════════════

async function generateAttendanceReport(start: string, end: string, filters?: Record<string, string>) {
  // Total classes and attendance
  let roomFilter = '';
  const params: unknown[] = [start, end];

  if (filters?.grade) {
    params.push(filters.grade);
    roomFilter += ` AND r.grade = $${params.length}`;
  }
  if (filters?.subject) {
    params.push(filters.subject);
    roomFilter += ` AND r.subject = $${params.length}`;
  }

  const classesResult = await db.query(
    `SELECT COUNT(*) AS total_classes,
            COUNT(*) FILTER (WHERE r.status = 'ended') AS completed,
            COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled
     FROM rooms r
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2 ${roomFilter}`,
    params
  );

  // Student attendance per room
  const attendanceResult = await db.query(
    `SELECT re.participant_email,
            COUNT(*) FILTER (WHERE re.event_type = 'joined') AS classes_attended,
            pu.full_name
     FROM room_events re
     JOIN rooms r ON r.room_id = re.room_id
     LEFT JOIN portal_users pu ON pu.email = re.participant_email
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND re.event_type IN ('joined')
       AND re.participant_email NOT LIKE 'ghost_%'
     GROUP BY re.participant_email, pu.full_name
     ORDER BY classes_attended DESC`,
    [start, end]
  );

  const stats = classesResult.rows[0] as Record<string, string>;

  return {
    title: `Attendance Report (${start} to ${end})`,
    data: {
      summary: {
        total_classes: parseInt(stats.total_classes),
        completed: parseInt(stats.completed),
        cancelled: parseInt(stats.cancelled),
        period: { start, end },
      },
      students: attendanceResult.rows,
    },
  };
}

async function generateRevenueReport(start: string, end: string) {
  const revenueResult = await db.query(
    `SELECT
       COUNT(*) AS total_invoices,
       COUNT(*) FILTER (WHERE status = 'paid') AS paid_invoices,
       COUNT(*) FILTER (WHERE status = 'pending') AS pending_invoices,
       COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_invoices,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0) AS total_revenue_paise,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'pending'), 0) AS pending_revenue_paise,
       currency
     FROM invoices
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY currency`,
    [start, end]
  );

  // Monthly breakdown
  const monthlyResult = await db.query(
    `SELECT
       TO_CHAR(paid_at, 'YYYY-MM') AS month,
       COUNT(*) AS payments,
       SUM(amount_paise) AS amount_paise
     FROM invoices
     WHERE status = 'paid'
       AND paid_at >= $1 AND paid_at <= $2
     GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
     ORDER BY month`,
    [start, end]
  );

  return {
    title: `Revenue Report (${start} to ${end})`,
    data: {
      by_currency: revenueResult.rows,
      monthly_breakdown: monthlyResult.rows,
    },
  };
}

async function generateTeacherPerformanceReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       r.teacher_email,
       pu.full_name AS teacher_name,
       COUNT(*) AS total_classes,
       COUNT(*) FILTER (WHERE r.status = 'ended') AS completed_classes,
       COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled_classes,
       AVG(r.duration_minutes) AS avg_duration,
       COUNT(DISTINCT ra.participant_email) FILTER (WHERE ra.participant_type = 'student') AS unique_students
     FROM rooms r
     LEFT JOIN portal_users pu ON pu.email = r.teacher_email
     LEFT JOIN room_assignments ra ON ra.room_id = r.room_id
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND r.teacher_email IS NOT NULL
     GROUP BY r.teacher_email, pu.full_name
     ORDER BY completed_classes DESC`,
    [start, end]
  );

  // Student retention per teacher's batches
  const retentionResult = await db.query(
    `SELECT
       bt.teacher_email,
       COUNT(DISTINCT bs.student_email) AS total_enrolled,
       COUNT(DISTINCT bs.student_email) FILTER (WHERE bs.student_status = 'active') AS still_active,
       COUNT(DISTINCT bs.student_email) FILTER (WHERE bs.student_status IN ('discontinued', 'inactive')) AS dropped
     FROM batch_teachers bt
     JOIN batch_students bs ON bs.batch_id = bt.batch_id
     JOIN batches b ON b.id = bt.batch_id AND b.status = 'active'
     GROUP BY bt.teacher_email`,
    []
  );

  const retentionMap = new Map<string, { total: number; active: number; rate: number }>();
  for (const row of retentionResult.rows as Array<Record<string, unknown>>) {
    const total = Number(row.total_enrolled || 0);
    const active = Number(row.still_active || 0);
    retentionMap.set(row.teacher_email as string, {
      total,
      active,
      rate: total > 0 ? Number(((active / total) * 100).toFixed(1)) : 100,
    });
  }

  const teachers = (result.rows as Array<Record<string, unknown>>).map(t => {
    const retention = retentionMap.get(t.teacher_email as string);
    return {
      ...t,
      retention_total_students: retention?.total || 0,
      retention_active_students: retention?.active || 0,
      retention_rate: retention?.rate ?? 100,
    };
  });

  return {
    title: `Teacher Performance Report (${start} to ${end})`,
    data: { teachers },
  };
}

async function generateStudentProgressReport(start: string, end: string, filters?: Record<string, string>) {
  let studentFilter = '';
  const params: unknown[] = [start, end];

  if (filters?.studentEmail) {
    params.push(filters.studentEmail);
    studentFilter = ` AND ea.student_email = $${params.length}`;
  }

  // Exam performance
  const examResult = await db.query(
    `SELECT
       ea.student_email,
       pu.full_name AS student_name,
       COUNT(*) AS exams_taken,
       AVG(ea.percentage) AS avg_percentage,
       MAX(ea.percentage) AS best_percentage,
       MIN(ea.percentage) AS worst_percentage,
       COUNT(*) FILTER (WHERE ea.percentage >= e.passing_marks * 100.0 / NULLIF(e.total_marks, 0)) AS exams_passed
     FROM exam_attempts ea
     JOIN exams e ON e.id = ea.exam_id
     LEFT JOIN portal_users pu ON pu.email = ea.student_email
     WHERE ea.created_at >= $1 AND ea.created_at <= $2
       ${studentFilter}
     GROUP BY ea.student_email, pu.full_name
     ORDER BY avg_percentage DESC`,
    params
  );

  // Attendance
  const attendanceResult = await db.query(
    `SELECT
       re.participant_email AS student_email,
       COUNT(DISTINCT re.room_id) AS classes_attended
     FROM room_events re
     JOIN rooms r ON r.room_id = re.room_id
     WHERE re.event_type = 'joined'
       AND r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND re.participant_email NOT LIKE 'ghost_%'
     GROUP BY re.participant_email`,
    [start, end]
  );

  return {
    title: `Student Progress Report (${start} to ${end})`,
    data: {
      exam_performance: examResult.rows,
      attendance: attendanceResult.rows,
    },
  };
}

async function generateBatchSummaryReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       r.room_name AS batch_name,
       r.subject,
       r.grade,
       r.status,
       r.scheduled_start,
       r.duration_minutes,
       r.teacher_email,
       pu.full_name AS teacher_name,
       COUNT(DISTINCT ra.participant_email) FILTER (WHERE ra.participant_type = 'student') AS student_count,
       COUNT(DISTINCT re.participant_email) FILTER (WHERE re.event_type = 'joined') AS active_students
     FROM rooms r
     LEFT JOIN portal_users pu ON pu.email = r.teacher_email
     LEFT JOIN room_assignments ra ON ra.room_id = r.room_id
     LEFT JOIN room_events re ON re.room_id = r.room_id AND re.event_type = 'joined'
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
     GROUP BY r.room_id, r.room_name, r.subject, r.grade, r.status, r.scheduled_start,
              r.duration_minutes, r.teacher_email, pu.full_name
     ORDER BY r.scheduled_start DESC`,
    [start, end]
  );

  return {
    title: `Batch Summary Report (${start} to ${end})`,
    data: { batches: result.rows },
  };
}

async function generateExamAnalyticsReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       e.id, e.title, e.subject, e.grade,
       e.total_marks, e.passing_marks,
       COUNT(ea.id) AS total_attempts,
       AVG(ea.percentage) AS avg_percentage,
       MAX(ea.percentage) AS highest_percentage,
       MIN(ea.percentage) AS lowest_percentage,
       COUNT(*) FILTER (WHERE ea.percentage >= e.passing_marks * 100.0 / NULLIF(e.total_marks, 0)) AS passed,
       COUNT(*) FILTER (WHERE ea.percentage < e.passing_marks * 100.0 / NULLIF(e.total_marks, 0)) AS failed
     FROM exams e
     LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.status = 'graded'
     WHERE e.created_at >= $1 AND e.created_at <= $2
     GROUP BY e.id, e.title, e.subject, e.grade, e.total_marks, e.passing_marks
     ORDER BY e.created_at DESC`,
    [start, end]
  );

  return {
    title: `Exam Analytics Report (${start} to ${end})`,
    data: { exams: result.rows },
  };
}

async function generatePayrollSummaryReport(start: string, end: string) {
  const result = await db.query(
    `SELECT
       pp.period_label,
       pp.status AS period_status,
       COUNT(ps.id) AS teacher_count,
       COALESCE(SUM(ps.base_pay_paise), 0) AS total_base_pay,
       COALESCE(SUM(ps.incentive_paise), 0) AS total_incentives,
       COALESCE(SUM(ps.lop_paise), 0) AS total_lop,
       COALESCE(SUM(ps.total_paise), 0) AS total_payroll,
       COALESCE(SUM(ps.classes_conducted), 0) AS total_classes_conducted,
       COALESCE(SUM(ps.classes_missed), 0) AS total_classes_missed
     FROM payroll_periods pp
     LEFT JOIN payslips ps ON ps.payroll_period_id = pp.id
     WHERE pp.period_start >= $1 AND pp.period_end <= $2
     GROUP BY pp.id, pp.period_label, pp.status
     ORDER BY pp.period_start DESC`,
    [start, end]
  );

  return {
    title: `Payroll Summary Report (${start} to ${end})`,
    data: { periods: result.rows },
  };
}

// ── Session Report (auto-generated after class ends) ─────────

async function generateSessionReport(start: string, end: string, filters?: Record<string, string>) {
  const roomFilter = filters?.room_id ? ` AND r.room_id = $3` : '';
  const params: unknown[] = [start, end];
  if (filters?.room_id) params.push(filters.room_id);

  const roomResult = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade, r.teacher_email,
            r.scheduled_start, r.ended_at, r.duration_minutes,
            r.class_portion, r.class_remarks, r.batch_type,
            r.go_live_at, r.batch_session_id,
            r.recording_url, r.recording_status,
            bs.topic AS session_topic, bs.notes AS session_notes,
            pu.full_name AS teacher_name
     FROM rooms r
     LEFT JOIN portal_users pu ON pu.email = r.teacher_email
     LEFT JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND r.status = 'ended'
       ${roomFilter}
     ORDER BY r.scheduled_start DESC`,
    params
  );

  const sessions = [];
  for (const room of roomResult.rows as Array<Record<string, unknown>>) {
    const rid = room.room_id as string;

    // ── 1. Teacher Go Live timing ──
    const schedStart = room.scheduled_start ? new Date(String(room.scheduled_start)) : null;
    const goLiveAt = room.go_live_at ? new Date(String(room.go_live_at)) : null;
    const endedAt = room.ended_at ? new Date(String(room.ended_at)) : null;
    let goLiveDelaySec = 0;
    let teacherLate = false;
    if (schedStart && goLiveAt) {
      goLiveDelaySec = Math.round((goLiveAt.getTime() - schedStart.getTime()) / 1000);
      teacherLate = goLiveDelaySec > 120; // >2 min = late
    }
    const actualMinutes = goLiveAt && endedAt
      ? Math.round((endedAt.getTime() - goLiveAt.getTime()) / 60000)
      : 0;

    // ── 2. Attendance summary + details ──
    const attendanceResult = await db.query(
      `SELECT participant_email, participant_name, status, join_count,
              total_duration_sec AS time_in_class_seconds, late_join AS is_late,
              late_by_sec, first_join_at, last_leave_at, attention_avg, teacher_remarks
       FROM attendance_sessions
       WHERE room_id = $1`,
      [rid]
    );
    const students = attendanceResult.rows as Array<Record<string, unknown>>;
    const presentCount = students.filter(s => s.status === 'present').length;
    const absentCount = students.filter(s => s.status === 'absent').length;
    const lateCount = students.filter(s => s.is_late === true).length;

    // ── 3. Attendance logs (join/leave timeline) ──
    const logsResult = await db.query(
      `SELECT participant_email, participant_name, event_type, event_at,
              payload
       FROM attendance_logs
       WHERE room_id = $1
       ORDER BY event_at ASC`,
      [rid]
    );

    // ── 4. AI Monitoring per-student summary ──
    const monitoringResult = await db.query(
      `SELECT student_email, student_name, event_type,
              COUNT(*) AS occurrences,
              SUM(duration_seconds) AS total_duration_sec,
              AVG(confidence)::numeric(5,1) AS avg_confidence
       FROM class_monitoring_events
       WHERE room_id = $1
       GROUP BY student_email, student_name, event_type
       ORDER BY student_email, event_type`,
      [rid]
    );
    // Group by student
    const monitoringByStudent: Record<string, { name: string; events: Record<string, unknown>[] }> = {};
    for (const row of monitoringResult.rows as Array<Record<string, unknown>>) {
      const email = row.student_email as string;
      if (!monitoringByStudent[email]) {
        monitoringByStudent[email] = { name: row.student_name as string, events: [] };
      }
      monitoringByStudent[email].events.push({
        type: row.event_type,
        occurrences: Number(row.occurrences),
        total_duration_sec: Number(row.total_duration_sec || 0),
        avg_confidence: Number(row.avg_confidence || 0),
      });
    }

    // Compute attention_avg per student from monitoring event counts
    // (fallback for when attendance_sessions.attention_avg is NULL because
    //  duration_seconds was 0 for all events — count-based: positive / total * 100)
    const POSITIVE_EVENTS = new Set([
      'attentive', 'writing_notes', 'reading_material', 'thinking',
      'in_exam', 'hand_raised', 'speaking',
    ]);
    const monitoringAttention: Record<string, number> = {};
    for (const [email, data] of Object.entries(monitoringByStudent)) {
      // Prefer duration-based if available
      const totalDur = data.events.reduce((s, e) => s + ((e as Record<string, unknown>).total_duration_sec as number || 0), 0);
      if (totalDur > 0) {
        const positiveDur = data.events
          .filter(e => POSITIVE_EVENTS.has((e as Record<string, unknown>).type as string))
          .reduce((s, e) => s + ((e as Record<string, unknown>).total_duration_sec as number || 0), 0);
        monitoringAttention[email] = Math.round((positiveDur / totalDur) * 100);
      } else {
        // Count-based fallback
        const total = data.events.reduce((s, e) => s + ((e as Record<string, unknown>).occurrences as number || 0), 0);
        if (total > 0) {
          const positive = data.events
            .filter(e => POSITIVE_EVENTS.has((e as Record<string, unknown>).type as string))
            .reduce((s, e) => s + ((e as Record<string, unknown>).occurrences as number || 0), 0);
          monitoringAttention[email] = Math.round((positive / total) * 100);
        }
      }
    }

    // ── 5. Monitoring alerts ──
    const alertsResult = await db.query(
      `SELECT target_email AS student_email,
              title AS student_name,
              alert_type, severity,
              message, created_at
       FROM monitoring_alerts
       WHERE room_id = $1
       ORDER BY created_at ASC`,
      [rid]
    );

    // ── 6. Chat messages ──
    const chatResult = await db.query(
      `SELECT sender_email, sender_name, sender_role, message_text, sent_at
       FROM room_chat_messages
       WHERE room_id = $1
       ORDER BY sent_at ASC`,
      [rid]
    );

    // ── 7. Teacher fraud reports by students ──
    const fraudResult = await db.query(
      `SELECT student_email, student_name, category, description,
              severity, status, created_at
       FROM teacher_reports
       WHERE room_id = $1
       ORDER BY created_at ASC`,
      [rid]
    );

    // ── 8. Session exam results ──
    const examResult = await db.query(
      `SELECT student_email, student_name, topic, score, total_questions,
              correct_answers, time_taken_sec, submitted_at
       FROM session_exam_results
       WHERE room_id = $1
       ORDER BY submitted_at ASC`,
      [rid]
    );

    // ── 9. Student feedback ──
    const feedbackResult = await db.query(
      `SELECT student_email, rating, feedback_text, tags, created_at
       FROM student_feedback
       WHERE room_id = $1`,
      [rid]
    );

    // ── 10. Contact violations ──
    const violationsResult = await db.query(
      `SELECT COUNT(*) AS count FROM contact_violations WHERE room_id = $1`,
      [rid]
    );

    // ── 11. Room events timeline ──
    const eventsResult = await db.query(
      `SELECT event_type, participant_email, payload, created_at
       FROM room_events
       WHERE room_id = $1
       ORDER BY created_at ASC`,
      [rid]
    );

    // ── 12. Doubts (counts + full list) ──
    const doubtsResult = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'answered') AS answered,
              COUNT(*) FILTER (WHERE status = 'open') AS open
       FROM session_doubts WHERE room_id = $1`,
      [rid]
    );
    const doubtsListResult = await db.query(
      `SELECT student_email, student_name, subject, doubt_text, status,
              teacher_reply, replied_by, replied_at, created_at
       FROM session_doubts WHERE room_id = $1
       ORDER BY created_at ASC`,
      [rid]
    );

    // ── 14. Session materials (files shared with class) ──
    const materialsResult = room.batch_session_id
      ? await db.query(
          `SELECT id, file_name, file_url, file_type, file_size_bytes,
                  title, description, uploaded_by, created_at
           FROM session_materials WHERE session_id = $1
           ORDER BY created_at ASC`,
          [room.batch_session_id]
        )
      : { rows: [] as Array<Record<string, unknown>> };

    // ── 15. Exam analytics summary ──
    const examRows = examResult.rows as Array<Record<string, unknown>>;
    let examSummary: Record<string, unknown> | null = null;
    if (examRows.length > 0) {
      const scores = examRows.map(e => Number(e.score) || 0);
      const classAvg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const passCount = scores.filter(s => s >= 50).length;
      const sorted = [...examRows].sort((a, b) => Number(b.score) - Number(a.score));
      const top = sorted[0];
      const low = sorted[sorted.length - 1];
      const byTopic: Record<string, { topic: string; count: number; total: number }> = {};
      for (const e of examRows) {
        const t = String(e.topic || 'General');
        if (!byTopic[t]) byTopic[t] = { topic: t, count: 0, total: 0 };
        byTopic[t].count += 1;
        byTopic[t].total += Number(e.score) || 0;
      }
      examSummary = {
        attempts: examRows.length,
        class_avg: classAvg,
        pass_count: passCount,
        pass_rate: Math.round((passCount / scores.length) * 100),
        top_scorer: { name: top.student_name, score: Number(top.score) },
        low_scorer: { name: low.student_name, score: Number(low.score) },
        by_topic: Object.values(byTopic).map(t => ({
          topic: t.topic,
          attempts: t.count,
          avg: Math.round(t.total / t.count),
        })),
      };
    }

    // ── 13. Homework ──
    const hwAssignResult = await db.query(
      `SELECT id, title, description, due_date, due_time, status, created_at
       FROM homework_assignments WHERE room_id = $1
       ORDER BY created_at ASC`,
      [rid]
    );
    const hwAssignments = hwAssignResult.rows as Array<Record<string, unknown>>;
    const hwIds = hwAssignments.map(a => a.id as string);
    let hwQuestionsByHw: Record<string, Array<Record<string, unknown>>> = {};
    let hwSubmissionsByHw: Record<string, Array<Record<string, unknown>>> = {};
    if (hwIds.length > 0) {
      const qRes = await db.query(
        `SELECT homework_id, question_number, question_text
         FROM homework_questions WHERE homework_id = ANY($1)
         ORDER BY question_number ASC`,
        [hwIds]
      );
      for (const q of qRes.rows as Array<Record<string, unknown>>) {
        const hid = q.homework_id as string;
        if (!hwQuestionsByHw[hid]) hwQuestionsByHw[hid] = [];
        hwQuestionsByHw[hid].push({ number: q.question_number, text: q.question_text });
      }
      const sRes = await db.query(
        `SELECT homework_id, student_email, student_name,
                completion_status, delay_days, grade, teacher_comment,
                file_urls, file_names, submitted_at
         FROM homework_submissions WHERE homework_id = ANY($1)
         ORDER BY submitted_at ASC`,
        [hwIds]
      );
      for (const s of sRes.rows as Array<Record<string, unknown>>) {
        const hid = s.homework_id as string;
        if (!hwSubmissionsByHw[hid]) hwSubmissionsByHw[hid] = [];
        hwSubmissionsByHw[hid].push(s);
      }
    }

    sessions.push({
      room_id: rid,
      batch_name: room.room_name,
      batch_session_id: room.batch_session_id,
      subject: room.subject,
      grade: room.grade,
      batch_type: room.batch_type,
      teacher: { name: room.teacher_name, email: room.teacher_email },

      // Timing
      scheduled_start: room.scheduled_start,
      go_live_at: room.go_live_at,
      ended_at: room.ended_at,
      scheduled_duration_min: room.duration_minutes,
      actual_duration_min: actualMinutes,
      go_live_delay_sec: goLiveDelaySec,
      teacher_late: teacherLate,
      class_portion: room.class_portion || null,
      class_remarks: room.class_remarks || null,

      // Attendance
      attendance: {
        total_students: students.length,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        attendance_rate: students.length > 0
          ? Number(((presentCount / students.length) * 100).toFixed(1))
          : 0,
        details: students.map(s => ({
          email: s.participant_email,
          name: s.participant_name,
          status: s.status,
          is_late: s.is_late,
          late_by_sec: s.late_by_sec,
          join_count: s.join_count,
          time_in_class_sec: s.time_in_class_seconds,
          first_join: s.first_join_at,
          last_leave: s.last_leave_at,
          attention_avg: s.attention_avg != null
            ? Number(s.attention_avg)
            : (monitoringAttention[s.participant_email as string] ?? null),
          remarks: s.teacher_remarks,
        })),
      },

      // Join/leave timeline
      join_leave_log: (logsResult.rows as Array<Record<string, unknown>>).map(l => ({
        email: l.participant_email,
        name: l.participant_name,
        event: l.event_type,
        at: l.event_at,
      })),

      // AI Monitoring
      ai_monitoring: {
        per_student: monitoringByStudent,
        alerts: (alertsResult.rows as Array<Record<string, unknown>>).map(a => ({
          student_email: a.student_email,
          student_name: a.student_name,
          type: a.alert_type,
          severity: a.severity,
          message: a.message,
          at: a.created_at,
        })),
        alert_summary: {
          total: alertsResult.rows.length,
          critical: (alertsResult.rows as Array<Record<string, unknown>>).filter(a => a.severity === 'critical').length,
          warnings: (alertsResult.rows as Array<Record<string, unknown>>).filter(a => a.severity === 'warning').length,
        },
      },

      // Chat
      chat: {
        message_count: chatResult.rows.length,
        messages: (chatResult.rows as Array<Record<string, unknown>>).map(c => ({
          sender: c.sender_name,
          role: c.sender_role,
          text: c.message_text,
          at: c.sent_at,
        })),
      },

      // Teacher fraud reports
      teacher_reports: (fraudResult.rows as Array<Record<string, unknown>>).map(f => ({
        student: f.student_name,
        category: f.category,
        description: f.description,
        severity: f.severity,
        status: f.status,
        at: f.created_at,
      })),

      // Exams
      exam_results: (examResult.rows as Array<Record<string, unknown>>).map(e => ({
        student: e.student_name,
        email: e.student_email,
        topic: e.topic,
        score: e.score,
        total: e.total_questions,
        correct: e.correct_answers,
        time_sec: e.time_taken_sec,
      })),

      // Feedback
      student_feedback: (feedbackResult.rows as Array<Record<string, unknown>>).map(f => ({
        student: f.student_email,
        rating: f.rating,
        text: f.feedback_text,
        tags: f.tags,
      })),

      // Other
      contact_violations: Number(violationsResult.rows[0]?.count || 0),
      doubts: {
        total: Number(doubtsResult.rows[0]?.total || 0),
        answered: Number(doubtsResult.rows[0]?.answered || 0),
        open: Number(doubtsResult.rows[0]?.open || 0),
        list: (doubtsListResult.rows as Array<Record<string, unknown>>).map(d => ({
          student: d.student_name || d.student_email,
          email: d.student_email,
          subject: d.subject,
          text: d.doubt_text,
          status: d.status,
          reply: d.teacher_reply,
          replied_by: d.replied_by,
          replied_at: d.replied_at,
          at: d.created_at,
        })),
      },

      // Recording
      recording: {
        url: room.recording_url || null,
        status: room.recording_status || 'none',
      },

      // Session topic / notes (from batch_sessions)
      session_topic: room.session_topic || null,
      session_notes: room.session_notes || null,

      // Materials shared during class
      materials: (materialsResult.rows as Array<Record<string, unknown>>).map(m => ({
        id: m.id,
        file_name: m.file_name,
        file_url: m.file_url,
        file_type: m.file_type,
        file_size_bytes: Number(m.file_size_bytes || 0),
        title: m.title,
        description: m.description,
        uploaded_by: m.uploaded_by,
        at: m.created_at,
      })),

      // Exam analytics summary (class avg, top/low scorer, per-topic)
      exam_summary: examSummary,

      // Homework
      homework: {
        total_assigned: hwAssignments.length,
        assignments: hwAssignments.map(a => ({
          title: a.title,
          description: a.description,
          due_date: a.due_date,
          due_time: a.due_time,
          status: a.status,
          questions: hwQuestionsByHw[a.id as string] || [],
          submissions: (hwSubmissionsByHw[a.id as string] || []).map(s => ({
            student: s.student_name || s.student_email,
            email: s.student_email,
            completion_status: s.completion_status,
            delay_days: s.delay_days,
            grade: s.grade,
            comment: s.teacher_comment,
            file_count: (s.file_urls as string[] || []).length,
            submitted_at: s.submitted_at,
          })),
          submission_count: (hwSubmissionsByHw[a.id as string] || []).length,
        })),
      },

      room_events: (eventsResult.rows as Array<Record<string, unknown>>).map(e => ({
        type: e.event_type,
        participant: e.participant_email,
        payload: e.payload,
        at: e.created_at,
      })),
    });
  }

  return {
    title: filters?.room_id
      ? `Session Report — ${sessions[0]?.batch_name || 'Class'}`
      : `Session Reports (${start} to ${end})`,
    data: { sessions, session_count: sessions.length },
  };
}

// ── Parent Monthly Report ───────────────────────────────────

async function generateParentMonthlyReport(start: string, end: string, filters?: Record<string, string>) {
  const studentEmail = filters?.student_email;
  const parentEmail = filters?.parent_email;

  // If parent_email given, find their children
  let studentEmails: string[] = [];
  if (studentEmail) {
    studentEmails = [studentEmail];
  } else if (parentEmail) {
    const childResult = await db.query(
      `SELECT email FROM portal_users
       WHERE role = 'student' AND email IN (
         SELECT ar.student_email FROM admission_requests ar
         WHERE ar.parent_email = $1 AND ar.status = 'active'
       )`,
      [parentEmail]
    );
    studentEmails = childResult.rows.map((r: Record<string, unknown>) => String(r.email));
  }

  if (studentEmails.length === 0) {
    return {
      title: `Parent Monthly Report (${start} to ${end})`,
      data: { students: [], message: 'No student found for given parent/student email' },
    };
  }

  const studentReports = [];
  for (const email of studentEmails) {
    // Student info
    const userResult = await db.query(
      `SELECT full_name, email FROM portal_users WHERE email = $1`,
      [email]
    );
    const studentName = (userResult.rows[0] as Record<string, string>)?.full_name || email;

    // Attendance summary
    const attendanceResult = await db.query(
      `SELECT
         COUNT(*) AS total_sessions,
         COUNT(*) FILTER (WHERE a.status = 'present') AS present,
         COUNT(*) FILTER (WHERE a.status = 'absent') AS absent,
         COUNT(*) FILTER (WHERE a.late_join = true) AS late,
         COALESCE(AVG(a.total_duration_sec), 0) AS avg_time_seconds
       FROM attendance_sessions a
       JOIN rooms r ON r.room_id = a.room_id
       WHERE a.participant_email = $1
         AND r.scheduled_start >= $2 AND r.scheduled_start <= $3`,
      [email, start, end]
    );

    // Exam performance
    const examResult = await db.query(
      `SELECT
         COALESCE(COUNT(*), 0) AS exams_taken,
         COALESCE(AVG(ea.percentage), 0) AS avg_percentage,
         COALESCE(MAX(ea.percentage), 0) AS best_score,
         COALESCE(MIN(ea.percentage), 0) AS worst_score
       FROM exam_attempts ea
       JOIN exams e ON e.id = ea.exam_id
       WHERE ea.student_email = $1 AND ea.status = 'graded'
         AND ea.created_at >= $2 AND ea.created_at <= $3`,
      [email, start, end]
    );

    // Fee status
    const feeResult = await db.query(
      `SELECT
         COUNT(*) AS total_invoices,
         COUNT(*) FILTER (WHERE status = 'paid') AS paid,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'overdue') AS overdue,
         COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0) AS total_paid_paise,
         COALESCE(SUM(amount_paise) FILTER (WHERE status IN ('pending', 'overdue')), 0) AS outstanding_paise
       FROM invoices
       WHERE student_email = $1
         AND created_at >= $2 AND created_at <= $3`,
      [email, start, end]
    );

    // Contact violations
    const violationResult = await db.query(
      `SELECT COUNT(*) AS count FROM contact_violations
       WHERE participant_email = $1
         AND detected_at >= $2 AND detected_at <= $3`,
      [email, start, end]
    );

    // Class portion / topics covered
    const topicsResult = await db.query(
      `SELECT r.subject, r.class_portion, r.scheduled_start
       FROM rooms r
       JOIN attendance_sessions a ON a.room_id = r.room_id
       WHERE a.participant_email = $1
         AND r.scheduled_start >= $2 AND r.scheduled_start <= $3
         AND r.class_portion IS NOT NULL
       ORDER BY r.scheduled_start`,
      [email, start, end]
    );

    const att = attendanceResult.rows[0] as Record<string, unknown>;
    const exams = examResult.rows[0] as Record<string, unknown>;
    const fees = feeResult.rows[0] as Record<string, unknown>;

    studentReports.push({
      student_name: studentName,
      student_email: email,
      period: { start, end },
      attendance: {
        total_sessions: Number(att.total_sessions || 0),
        present: Number(att.present || 0),
        absent: Number(att.absent || 0),
        late: Number(att.late || 0),
        attendance_rate: Number(att.total_sessions || 0) > 0
          ? Number(((Number(att.present || 0) / Number(att.total_sessions || 1)) * 100).toFixed(1))
          : 0,
        avg_time_in_class_minutes: Number(((Number(att.avg_time_seconds || 0)) / 60).toFixed(1)),
      },
      academic: {
        exams_taken: Number(exams.exams_taken || 0),
        avg_percentage: Number(Number(exams.avg_percentage || 0).toFixed(1)),
        best_score: Number(Number(exams.best_score || 0).toFixed(1)),
        worst_score: Number(Number(exams.worst_score || 0).toFixed(1)),
      },
      fees: {
        total_invoices: Number(fees.total_invoices || 0),
        paid: Number(fees.paid || 0),
        pending: Number(fees.pending || 0),
        overdue: Number(fees.overdue || 0),
        total_paid_inr: Number(fees.total_paid_paise || 0) / 100,
        outstanding_inr: Number(fees.outstanding_paise || 0) / 100,
      },
      contact_violations: Number(violationResult.rows[0]?.count || 0),
      topics_covered: topicsResult.rows,
    });
  }

  return {
    title: `Parent Monthly Report (${start} to ${end})`,
    data: { students: studentReports },
  };
}

// ── Daily Business Report ───────────────────────────────────

async function generateDailyBusinessReport(start: string, end: string) {
  // Sessions today
  const sessionsResult = await db.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'live') AS live,
       COUNT(*) FILTER (WHERE status = 'ended') AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       COUNT(*) FILTER (WHERE status = 'scheduled') AS upcoming
     FROM rooms
     WHERE scheduled_start >= $1 AND scheduled_start <= $2`,
    [start, end]
  );

  // Revenue today
  const revenueResult = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'paid' AND paid_at >= $1 AND paid_at <= $2) AS payments_today,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid' AND paid_at >= $1 AND paid_at <= $2), 0) AS collected_today_paise,
       COUNT(*) FILTER (WHERE status = 'pending') AS pending_invoices,
       COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_invoices
     FROM invoices`,
    [start, end]
  );

  // Attendance rate across today's ended classes
  const attendanceResult = await db.query(
    `SELECT
       COUNT(*) AS total_assigned,
       COUNT(*) FILTER (WHERE a.status = 'present') AS present
     FROM attendance_sessions a
     JOIN rooms r ON r.room_id = a.room_id
     WHERE r.scheduled_start >= $1 AND r.scheduled_start <= $2
       AND r.status = 'ended'`,
    [start, end]
  );
  const totalAssigned = Number(attendanceResult.rows[0]?.total_assigned || 0);
  const presentCount = Number(attendanceResult.rows[0]?.present || 0);
  const attendanceRate = totalAssigned > 0 ? Number(((presentCount / totalAssigned) * 100).toFixed(1)) : 0;

  // Active batches
  const batchResult = await db.query(
    `SELECT COUNT(*) AS active FROM batches WHERE status = 'active'`
  );

  // New students today
  const newStudentsResult = await db.query(
    `SELECT COUNT(*) AS count FROM portal_users
     WHERE role = 'student' AND created_at >= $1 AND created_at <= $2`,
    [start, end]
  );

  const sessions = sessionsResult.rows[0] as Record<string, string>;
  const revenue = revenueResult.rows[0] as Record<string, string>;

  return {
    title: `Daily Business Report (${start.split('T')[0]})`,
    data: {
      sessions: {
        total: Number(sessions.total),
        live: Number(sessions.live),
        completed: Number(sessions.completed),
        cancelled: Number(sessions.cancelled),
        upcoming: Number(sessions.upcoming),
      },
      revenue: {
        payments_today: Number(revenue.payments_today),
        collected_today_paise: Number(revenue.collected_today_paise),
        pending_invoices: Number(revenue.pending_invoices),
        overdue_invoices: Number(revenue.overdue_invoices),
      },
      attendance: {
        total_assigned: totalAssigned,
        present: presentCount,
        attendance_rate: attendanceRate,
      },
      active_batches: Number(batchResult.rows[0]?.active || 0),
      new_students_today: Number(newStudentsResult.rows[0]?.count || 0),
    },
  };
}

// ── Weekly Sales Report ─────────────────────────────────────

async function generateWeeklySalesReport(start: string, end: string) {
  // Weekly invoice summary
  const weeklyResult = await db.query(
    `SELECT
       COUNT(*) AS invoices_created,
       COUNT(*) FILTER (WHERE status = 'paid') AS invoices_paid,
       COUNT(*) FILTER (WHERE status = 'pending') AS invoices_pending,
       COUNT(*) FILTER (WHERE status = 'overdue') AS invoices_overdue,
       COALESCE(SUM(amount_paise), 0) AS total_invoiced,
       COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0) AS total_collected
     FROM invoices
     WHERE created_at >= $1 AND created_at <= $2`,
    [start, end]
  );

  // Daily breakdown
  const dailyResult = await db.query(
    `SELECT
       TO_CHAR(paid_at, 'YYYY-MM-DD') AS day,
       COUNT(*) AS payments,
       SUM(amount_paise) AS amount_paise
     FROM invoices
     WHERE status = 'paid' AND paid_at >= $1 AND paid_at <= $2
     GROUP BY TO_CHAR(paid_at, 'YYYY-MM-DD')
     ORDER BY day`,
    [start, end]
  );

  // Top batches by revenue
  const topBatchesResult = await db.query(
    `SELECT
       b.name AS batch_name,
       b.subject,
       COALESCE(SUM(i.amount_paise) FILTER (WHERE i.status = 'paid'), 0) AS revenue_paise,
       COUNT(DISTINCT i.student_email) AS paying_students
     FROM batches b
     LEFT JOIN invoices i ON i.batch_id = b.id AND i.created_at >= $1 AND i.created_at <= $2
     WHERE b.status = 'active'
     GROUP BY b.id, b.name, b.subject
     HAVING COALESCE(SUM(i.amount_paise) FILTER (WHERE i.status = 'paid'), 0) > 0
     ORDER BY revenue_paise DESC
     LIMIT 10`,
    [start, end]
  );

  // New enrollments this week
  const enrollmentsResult = await db.query(
    `SELECT COUNT(*) AS count FROM batch_students
     WHERE created_at >= $1 AND created_at <= $2`,
    [start, end]
  );

  const weekly = weeklyResult.rows[0] as Record<string, string>;

  return {
    title: `Weekly Sales Report (${start.split('T')[0]} to ${end.split('T')[0]})`,
    data: {
      weekly: {
        invoices_created: Number(weekly.invoices_created),
        invoices_paid: Number(weekly.invoices_paid),
        invoices_pending: Number(weekly.invoices_pending),
        invoices_overdue: Number(weekly.invoices_overdue),
        total_invoiced: Number(weekly.total_invoiced),
        total_collected: Number(weekly.total_collected),
        new_enrollments: Number(enrollmentsResult.rows[0]?.count || 0),
      },
      daily_breakdown: dailyResult.rows,
      top_batches: topBatchesResult.rows,
    },
  };
}

// ── Auto-generate Session Report (called after room ends) ───

export async function autoGenerateSessionReport(roomId: string) {
  try {
    // Use an all-time range so sessions from any date are included.
    // The room_id filter in generateSessionReport is the real constraint.
    const report = await generateReport(
      'session_report',
      '2020-01-01T00:00:00.000Z',
      '2099-12-31T23:59:59.000Z',
      'system_auto',
      { room_id: roomId }
    );

    console.log(`[reports] Auto-generated session report for room ${roomId}: report id ${report.id}`);
    return report;
  } catch (err) {
    console.error(`[reports] Failed to auto-generate session report for ${roomId}:`, err);
    return null;
  }
}
