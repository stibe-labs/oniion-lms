// ═══════════════════════════════════════════════════════════════
// Owner API — /api/v1/owner/dashboard
// Single endpoint returning all dashboard metrics, charts data
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getOwner(req);
  if (!user)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    // NOTE: Previously auto-ended live rooms past their scheduled duration here.
    // Removed — only the teacher (via End Class), the LiveKit room_finished
    // webhook, or an explicit DELETE may end a live class. Time-based auto-end
    // was kicking students out of overtime classes that the teacher hadn't ended.

    // Run all queries in parallel for speed
    const [
      roomsResult,
      userStatsResult,
      recentRoomsResult,
      dailyClassesResult,
      subjectDistResult,
      gradeDistResult,
      recentUsersResult,
      cancelledResult,
      paymentResult,
      todaySessionsResult,
      pendingLeavesResult,
      pendingCancellationsResult,
      pendingSessionReqResult,
      alertsCountResult,
      recentPaymentsResult,
      payrollSummaryResult,
      revenueTrendResult,
      ghostVisitsResult,
    ] = await Promise.all([
      // 1. Room status counts
      db.query(`
        SELECT status, COUNT(*)::int AS count
        FROM rooms
        GROUP BY status
        ORDER BY count DESC
      `),

      // 2. User counts by role
      db.query(`
        SELECT portal_role AS role, COUNT(*)::int AS count
        FROM portal_users
        WHERE is_active = true
        GROUP BY portal_role
        ORDER BY count DESC
      `),

      // 3. Recent rooms (last 100)
      db.query(`
        SELECT r.room_id, r.room_name, r.subject, r.grade,
               r.coordinator_email, r.teacher_email, r.status,
               r.scheduled_start, r.duration_minutes,
               (SELECT COUNT(*) FROM room_assignments ra
                WHERE ra.room_id = r.room_id AND ra.participant_type = 'student')::int AS student_count
        FROM rooms r
        ORDER BY r.scheduled_start DESC
        LIMIT 100
      `),

      // 4. Classes per day (last 30 days) for area chart
      db.query(`
        SELECT DATE(scheduled_start) AS date,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'live' OR status = 'ended')::int AS conducted,
               COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM rooms
        WHERE scheduled_start >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(scheduled_start)
        ORDER BY date ASC
      `),

      // 5. Subject distribution
      db.query(`
        SELECT COALESCE(subject, 'Unassigned') AS subject, COUNT(*)::int AS count
        FROM rooms
        GROUP BY subject
        ORDER BY count DESC
        LIMIT 10
      `),

      // 6. Grade distribution
      db.query(`
        SELECT COALESCE(grade, 'Unassigned') AS grade, COUNT(*)::int AS count
        FROM rooms
        GROUP BY grade
        ORDER BY grade ASC
      `),

      // 7. Recently added users (last 10)
      db.query(`
        SELECT email, full_name AS display_name, portal_role, created_at
        FROM portal_users
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 10
      `),

      // 8. Cancellation stats (last 30 days)
      db.query(`
        SELECT COUNT(*)::int AS total_cancelled
        FROM rooms
        WHERE status = 'cancelled'
          AND scheduled_start >= NOW() - INTERVAL '30 days'
      `),

      // 9. Payment / revenue stats
      db.query(`
        SELECT
          COUNT(*)::int                                                AS total_invoices,
          COUNT(*) FILTER (WHERE status = 'paid')::int                AS paid_invoices,
          COUNT(*) FILTER (WHERE status = 'pending')::int             AS pending_invoices,
          COUNT(*) FILTER (WHERE status = 'overdue')::int             AS overdue_invoices,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid'), 0)::bigint    AS total_collected_paise,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'pending'), 0)::bigint AS total_pending_paise,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'overdue'), 0)::bigint AS total_overdue_paise,
          COALESCE(SUM(amount_paise), 0)::bigint                                   AS total_invoiced_paise,
          COALESCE(SUM(amount_paise) FILTER (WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS collected_last_30d_paise
        FROM invoices
      `),

      // 10. Today's sessions
      db.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'live')::int AS live,
               COUNT(*) FILTER (WHERE status = 'scheduled')::int AS upcoming,
               COUNT(*) FILTER (WHERE status = 'ended')::int AS completed,
               COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM rooms
        WHERE DATE(scheduled_start) = CURRENT_DATE
      `),

      // 11. Pending leave requests (owner level)
      db.query(`
        SELECT COUNT(*)::int AS count
        FROM teacher_leave_requests
        WHERE owner_status = 'pending'
      `).catch(() => ({ rows: [{ count: 0 }] })),

      // 12. Pending cancellation requests
      db.query(`
        SELECT COUNT(*)::int AS count
        FROM cancellation_requests
        WHERE status NOT IN ('approved', 'rejected', 'withdrawn')
      `).catch(() => ({ rows: [{ count: 0 }] })),

      // 13. Pending session requests
      db.query(`
        SELECT COUNT(*)::int AS count
        FROM session_requests
        WHERE status = 'pending'
      `).catch(() => ({ rows: [{ count: 0 }] })),

      // 14. Active monitoring alerts count
      db.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
          COUNT(*) FILTER (WHERE severity = 'warning')::int AS warning
        FROM monitoring_alerts
        WHERE status = 'active'
      `).catch(() => ({ rows: [{ total: 0, critical: 0, warning: 0 }] })),

      // 15. Recent paid invoices (last 10)
      db.query(`
        SELECT i.id, i.student_email, i.amount_paise, i.paid_at,
               u.full_name AS student_name
        FROM invoices i
        LEFT JOIN portal_users u ON u.email = i.student_email
        WHERE i.status = 'paid'
        ORDER BY i.paid_at DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),

      // 16. Payroll summary
      db.query(`
        SELECT
          COUNT(*)::int AS total_periods,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_periods,
          COUNT(*) FILTER (WHERE status = 'finalized')::int AS finalized_periods,
          COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_periods,
          (SELECT COALESCE(SUM(total_paise), 0)::bigint FROM payslips WHERE status = 'paid') AS total_paid_paise
        FROM payroll_periods
      `).catch(() => ({ rows: [{ total_periods: 0, draft_periods: 0, finalized_periods: 0, paid_periods: 0, total_paid_paise: 0 }] })),

      // 17. Revenue trend (monthly, last 6 months)
      db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', paid_at), 'Mon YY') AS month,
          COALESCE(SUM(amount_paise), 0)::bigint AS collected_paise,
          COUNT(*)::int AS invoice_count
        FROM invoices
        WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', paid_at)
        ORDER BY DATE_TRUNC('month', paid_at) ASC
      `).catch(() => ({ rows: [] })),

      // 18. Ghost mode visits (last 30 days)
      db.query(`
        SELECT e.room_id, e.participant_email, e.participant_role,
               e.payload, e.created_at,
               r.room_name, r.subject, r.grade, r.teacher_email,
               u.full_name AS observer_name
        FROM room_events e
        LEFT JOIN rooms r ON r.room_id = e.room_id
        LEFT JOIN portal_users u ON u.email = e.participant_email
        WHERE e.event_type = 'ghost_mode_entry'
          AND e.created_at >= NOW() - INTERVAL '30 days'
        ORDER BY e.created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] })),
    ]);

    // Process status counts into a map
    const statusCounts: Record<string, number> = {};
    for (const row of roomsResult.rows as { status: string; count: number }[]) {
      statusCounts[row.status] = row.count;
    }

    const totalRooms = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const totalUsers = (userStatsResult.rows as { count: number }[]).reduce(
      (a, b) => a + b.count,
      0,
    );

    const today = todaySessionsResult.rows[0] || { total: 0, live: 0, upcoming: 0, completed: 0, cancelled: 0 };

    return NextResponse.json({
      success: true,
      data: {
        // Summary cards
        summary: {
          totalBatches: totalRooms,
          liveBatches: statusCounts['live'] || 0,
          scheduledBatches: statusCounts['scheduled'] || 0,
          completedBatches: statusCounts['ended'] || 0,
          cancelledBatches: statusCounts['cancelled'] || 0,
          totalUsers,
          cancelledLast30: cancelledResult.rows[0]?.total_cancelled || 0,
        },

        // Today's sessions quick stats
        today: {
          total: today.total,
          live: today.live,
          upcoming: today.upcoming,
          completed: today.completed,
          cancelled: today.cancelled,
        },

        // Pending items (for urgent attention banner)
        pending: {
          leaveRequests: pendingLeavesResult.rows[0]?.count || 0,
          cancellations: pendingCancellationsResult.rows[0]?.count || 0,
          sessionRequests: pendingSessionReqResult.rows[0]?.count || 0,
          alerts: alertsCountResult.rows[0]?.total || 0,
          criticalAlerts: alertsCountResult.rows[0]?.critical || 0,
          warningAlerts: alertsCountResult.rows[0]?.warning || 0,
        },

        // User breakdown
        usersByRole: userStatsResult.rows,

        // Room list
        rooms: recentRoomsResult.rows,

        // Chart: daily classes trend
        dailyClasses: dailyClassesResult.rows.map((r: any) => ({
          date: r.date,
          total: r.total,
          conducted: r.conducted,
          cancelled: r.cancelled,
        })),

        // Chart: subject distribution (pie)
        subjectDistribution: subjectDistResult.rows,

        // Chart: grade distribution (bar)
        gradeDistribution: gradeDistResult.rows,

        // Recent users
        recentUsers: recentUsersResult.rows,

        // Payment / revenue stats
        payment: {
          totalInvoices: paymentResult.rows[0]?.total_invoices || 0,
          paidInvoices: paymentResult.rows[0]?.paid_invoices || 0,
          pendingInvoices: paymentResult.rows[0]?.pending_invoices || 0,
          overdueInvoices: paymentResult.rows[0]?.overdue_invoices || 0,
          totalCollectedPaise: Number(paymentResult.rows[0]?.total_collected_paise || 0),
          totalPendingPaise: Number(paymentResult.rows[0]?.total_pending_paise || 0),
          totalOverduePaise: Number(paymentResult.rows[0]?.total_overdue_paise || 0),
          totalInvoicedPaise: Number(paymentResult.rows[0]?.total_invoiced_paise || 0),
          collectedLast30dPaise: Number(paymentResult.rows[0]?.collected_last_30d_paise || 0),
        },

        // Recent payments (last 10 paid invoices)
        recentPayments: (recentPaymentsResult.rows || []).map((r: any) => ({
          id: r.id,
          studentEmail: r.student_email,
          studentName: r.student_name || r.student_email,
          amountPaise: Number(r.amount_paise),
          paidAt: r.paid_at,
        })),

        // Payroll summary
        payroll: {
          totalPeriods: payrollSummaryResult.rows[0]?.total_periods || 0,
          draftPeriods: payrollSummaryResult.rows[0]?.draft_periods || 0,
          finalizedPeriods: payrollSummaryResult.rows[0]?.finalized_periods || 0,
          paidPeriods: payrollSummaryResult.rows[0]?.paid_periods || 0,
          totalPaidPaise: Number(payrollSummaryResult.rows[0]?.total_paid_paise || 0),
        },

        // Revenue trend (last 6 months)
        revenueTrend: (revenueTrendResult.rows || []).map((r: any) => ({
          month: r.month,
          collectedPaise: Number(r.collected_paise),
          invoiceCount: r.invoice_count,
        })),

        // Ghost mode visits (last 30 days)
        ghostVisits: (ghostVisitsResult.rows || []).map((r: any) => ({
          roomId: r.room_id,
          roomName: r.room_name,
          subject: r.subject,
          grade: r.grade,
          teacherEmail: r.teacher_email,
          observerEmail: r.participant_email,
          observerName: r.observer_name || r.participant_email,
          observerRole: r.participant_role,
          enteredAt: r.created_at,
        })),
      },
    });
  } catch (err) {
    console.error('Owner dashboard error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 },
    );
  }
}
