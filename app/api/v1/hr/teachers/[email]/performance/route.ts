// ═══════════════════════════════════════════════════════════════
// HR Teacher Performance API — GET /api/v1/hr/teachers/[email]/performance
// Returns batch assignments, session stats, ratings for
// a specific teacher — viewable by hr, owner, academic_operator,
// batch_coordinator, ghost_observer
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

const ALLOWED_ROLES = ['owner', 'hr_associate', 'hr', 'academic_operator', 'batch_coordinator', 'ghost_observer'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !ALLOWED_ROLES.includes(user.role))
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { email: teacherEmail } = await params;
    const email = decodeURIComponent(teacherEmail).toLowerCase();

    // ── Batch assignments + per-batch session stats ───────────
    const batchesResult = await db.query(
      `SELECT
         b.batch_id AS id,
         b.batch_name AS name,
         b.batch_type AS type,
         b.grade,
         b.section,
         b.subjects,
         b.status,
         bt.subject AS assigned_subject,
         bt.added_at,
         -- Session counts for this teacher in this batch
         (SELECT COUNT(*)
            FROM batch_sessions bss
           WHERE bss.batch_id = b.batch_id AND bss.teacher_email = $1) AS total_sessions,
         (SELECT COUNT(*) FILTER (WHERE bss.status = 'completed')
            FROM batch_sessions bss
           WHERE bss.batch_id = b.batch_id AND bss.teacher_email = $1) AS completed_sessions,
         (SELECT COUNT(*) FILTER (WHERE bss.status = 'cancelled')
            FROM batch_sessions bss
           WHERE bss.batch_id = b.batch_id AND bss.teacher_email = $1) AS cancelled_sessions,
         (SELECT COALESCE(SUM(bss.duration_minutes), 0)
            FROM batch_sessions bss
           WHERE bss.batch_id = b.batch_id AND bss.teacher_email = $1 AND bss.status = 'completed') AS teaching_minutes,
         -- Student count
         (SELECT COUNT(*)
            FROM batch_students bst
           WHERE bst.batch_id = b.batch_id) AS student_count
       FROM batch_teachers bt
       JOIN batches b ON b.batch_id = bt.batch_id
       WHERE bt.teacher_email = $1
         AND b.status != 'archived'
       ORDER BY bt.added_at DESC`,
      [email]
    );

    // ── Overall session summary ───────────────────────────────
    const sessionResult = await db.query<{
      total: string; completed: string; cancelled: string; live: string;
      teaching_minutes: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
         COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
         COUNT(*) FILTER (WHERE status = 'live')::text AS live,
         COALESCE(SUM(duration_minutes) FILTER (WHERE status = 'completed'), 0)::text AS teaching_minutes
       FROM batch_sessions
       WHERE teacher_email = $1`,
      [email]
    );

    // ── Rating averages ───────────────────────────────────────
    const ratingResult = await db.query(
      `SELECT
         ROUND(AVG(punctuality)::numeric, 2) AS punctuality,
         ROUND(AVG(teaching_quality)::numeric, 2) AS teaching_quality,
         ROUND(AVG(communication)::numeric, 2) AS communication,
         ROUND(AVG(overall)::numeric, 2) AS overall,
         COUNT(*)::text AS total_count
       FROM session_ratings
       WHERE teacher_email = $1`,
      [email]
    );

    // ── Monthly rating trend (last 6 months) ──────────────────
    const trendResult = await db.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
         ROUND(AVG(overall)::numeric, 2) AS avg_overall,
         COUNT(*)::text AS count
       FROM session_ratings
       WHERE teacher_email = $1
         AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at)`,
      [email]
    );

    // ── Leave requests ────────────────────────────────────────
    const leaveResult = await db.query<{
      total: string; approved: string; rejected: string; pending: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE ao_status = 'approved' OR ao_status = 'auto_approved')::text AS approved,
         COUNT(*) FILTER (WHERE ao_status = 'rejected')::text AS rejected,
         COUNT(*) FILTER (WHERE ao_status = 'pending')::text AS pending
       FROM teacher_leave_requests
       WHERE teacher_email = $1`,
      [email]
    );

    const s = sessionResult.rows[0];
    const r = ratingResult.rows[0];
    const l = leaveResult.rows[0];
    const totalSessions = Number(s?.total ?? 0);
    const completed = Number(s?.completed ?? 0);

    const batches = batchesResult.rows.map(b => ({
      id:               b.id,
      name:             b.name,
      type:             b.type,
      grade:            b.grade,
      section:          b.section,
      subjects:         b.subjects ?? [],
      assigned_subject: b.assigned_subject,
      status:           b.status,
      added_at:         b.added_at,
      student_count:    Number(b.student_count ?? 0),
      stats: {
        total_sessions:     Number(b.total_sessions ?? 0),
        completed_sessions: Number(b.completed_sessions ?? 0),
        cancelled_sessions: Number(b.cancelled_sessions ?? 0),
        teaching_minutes:   Number(b.teaching_minutes ?? 0),
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        batches,
        sessions: {
          total:            totalSessions,
          completed,
          cancelled:        Number(s?.cancelled ?? 0),
          live:             Number(s?.live ?? 0),
          teaching_minutes: Number(s?.teaching_minutes ?? 0),
          teaching_hours:   Number((Number(s?.teaching_minutes ?? 0) / 60).toFixed(1)),
          completion_rate:  totalSessions > 0 ? Number(((completed / totalSessions) * 100).toFixed(1)) : 0,
        },
        ratings: {
          punctuality:      parseFloat(String(r?.punctuality ?? 0)),
          teaching_quality: parseFloat(String(r?.teaching_quality ?? 0)),
          communication:    parseFloat(String(r?.communication ?? 0)),
          overall:          parseFloat(String(r?.overall ?? 0)),
          total_count:      parseInt(String(r?.total_count ?? 0), 10),
          trend: trendResult.rows.map(t => ({
            month:       t.month,
            avg_overall: parseFloat(String(t.avg_overall)),
            count:       parseInt(String(t.count), 10),
          })),
        },
        leave: {
          total:    Number(l?.total ?? 0),
          approved: Number(l?.approved ?? 0),
          rejected: Number(l?.rejected ?? 0),
          pending:  Number(l?.pending ?? 0),
        },
      },
    });
  } catch (err) {
    console.error('[hr/teachers/performance] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
