// ═══════════════════════════════════════════════════════════════
// Parent Exam Results API — GET /api/v1/parent/exams
// Returns exam results for parent's children
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'parent') {
      return NextResponse.json({ success: false, error: 'Parent only' }, { status: 403 });
    }

    // Find children
    const childrenResult = await db.query(
      `SELECT up.email, pu.full_name
       FROM user_profiles up
       JOIN portal_users pu ON pu.email = up.email
       WHERE up.parent_email = $1`,
      [user.id]
    );

    let childEmails: string[] = childrenResult.rows.map(
      (r: Record<string, unknown>) => String(r.email)
    );

    if (childEmails.length === 0) {
      const admResult = await db.query(
        `SELECT DISTINCT student_email FROM admission_requests
         WHERE parent_email = $1 AND status = 'active'`,
        [user.id]
      );
      childEmails = admResult.rows.map((r: Record<string, unknown>) => String(r.student_email));
    }

    if (childEmails.length === 0) {
      return NextResponse.json({
        success: true,
        data: { children: [], message: 'No children linked' },
      });
    }

    const childExams = [];

    for (const email of childEmails) {
      const nameResult = await db.query(
        `SELECT full_name FROM portal_users WHERE email = $1`,
        [email]
      );
      const name = String((nameResult.rows[0] as Record<string, unknown>)?.full_name || email);

      // Get exam attempts with exam details
      const attemptsResult = await db.query(
        `SELECT
           ea.id AS attempt_id,
           ea.exam_id,
           e.title AS exam_title,
           e.subject,
           e.grade,
           e.exam_type,
           e.total_marks,
           e.passing_marks,
           ea.total_marks_obtained,
           ea.percentage,
           ea.grade_letter,
           ea.status AS attempt_status,
           ea.started_at,
           ea.submitted_at,
           ea.created_at,
           CASE
             WHEN ea.percentage >= (e.passing_marks * 100.0 / NULLIF(e.total_marks, 0)) THEN true
             ELSE false
           END AS passed
         FROM exam_attempts ea
         JOIN exams e ON e.id = ea.exam_id
         WHERE ea.student_email = $1
           AND ea.status = 'graded'
         ORDER BY ea.created_at DESC`,
        [email]
      );

      // Summary stats
      const summaryResult = await db.query(
        `SELECT
           COUNT(*) AS total_exams,
           COALESCE(AVG(ea.percentage), 0) AS avg_percentage,
           COALESCE(MAX(ea.percentage), 0) AS best_score,
           COALESCE(MIN(ea.percentage), 0) AS worst_score,
           COUNT(*) FILTER (WHERE ea.percentage >= (e.passing_marks * 100.0 / NULLIF(e.total_marks, 0))) AS passed,
           COUNT(*) FILTER (WHERE ea.percentage < (e.passing_marks * 100.0 / NULLIF(e.total_marks, 0))) AS failed
         FROM exam_attempts ea
         JOIN exams e ON e.id = ea.exam_id
         WHERE ea.student_email = $1 AND ea.status = 'graded'`,
        [email]
      );

      const summary = summaryResult.rows[0] as Record<string, unknown>;

      childExams.push({
        student_email: email,
        student_name: name,
        summary: {
          total_exams: Number(summary.total_exams || 0),
          avg_percentage: Number(Number(summary.avg_percentage || 0).toFixed(1)),
          best_score: Number(Number(summary.best_score || 0).toFixed(1)),
          worst_score: Number(Number(summary.worst_score || 0).toFixed(1)),
          passed: Number(summary.passed || 0),
          failed: Number(summary.failed || 0),
        },
        exams: attemptsResult.rows,
      });
    }

    return NextResponse.json({ success: true, data: { children: childExams } });
  } catch (err) {
    console.error('[parent/exams] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
