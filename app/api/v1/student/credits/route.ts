// ═══════════════════════════════════════════════════════════════
// Student Session Credits API — GET /api/v1/student/credits
//
// Returns prepaid session credit balance for the logged-in student
// (or for parent's children). Includes per-subject breakdown,
// totals, and low-credit warning flags.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const user = await verifySession(token);
  if (!user || !['student', 'parent'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // For parents, resolve child emails
  let studentEmails: string[] = [];
  if (user.role === 'parent') {
    const childRes = await db.query(
      `SELECT DISTINCT bs.student_email, COALESCE(u.full_name, bs.student_email) AS student_name
       FROM batch_students bs
       LEFT JOIN portal_users u ON u.email = bs.student_email
       WHERE bs.parent_email = $1`,
      [user.id]
    );
    studentEmails = (childRes.rows as Array<{ student_email: string }>).map(r => r.student_email);
    // Fallback: students linked via user_profiles.parent_email (no batch yet)
    if (studentEmails.length === 0) {
      const upRes = await db.query(
        `SELECT up.email AS student_email, COALESCE(u.full_name, up.email) AS student_name
         FROM user_profiles up
         LEFT JOIN portal_users u ON u.email = up.email
         WHERE up.parent_email = $1`,
        [user.id]
      );
      studentEmails = (upRes.rows as Array<{ student_email: string }>).map(r => r.student_email);
    }
    if (studentEmails.length === 0) {
      return NextResponse.json({
        success: true,
        data: { children: [], total_remaining: 0, total_allotted: 0, warning: false },
      });
    }
  } else {
    studentEmails = [user.id];
  }

  // Fetch credits for all student emails
  const children: Array<{
    student_email: string;
    student_name: string;
    credits: Array<{
      id: string;
      subject: string;
      batch_type: string;
      total_sessions: number;
      used_sessions: number;
      remaining: number;
      fee_per_session_paise: number;
      currency: string;
      source: string;
      created_at: string;
    }>;
    total_remaining: number;
    total_allotted: number;
    warning: boolean;
    exhausted: boolean;
  }> = [];

  let overallRemaining = 0;
  let overallAllotted = 0;

  for (const email of studentEmails) {
    const nameRes = await db.query(
      `SELECT full_name FROM portal_users WHERE email = $1`,
      [email]
    );
    const studentName = (nameRes.rows[0] as { full_name: string } | undefined)?.full_name || email;

    const creditsRes = await db.query(
      `SELECT id, subject, batch_type, total_sessions, used_sessions,
              (total_sessions - used_sessions) AS remaining,
              fee_per_session_paise, currency, source, created_at
       FROM student_session_credits
       WHERE student_email = $1 AND is_active = true
       ORDER BY subject, created_at ASC`,
      [email]
    );

    const credits = creditsRes.rows as Array<{
      id: string; subject: string; batch_type: string;
      total_sessions: number; used_sessions: number; remaining: number;
      fee_per_session_paise: number; currency: string; source: string; created_at: string;
    }>;

    // total_allotted = all sessions ever purchased (sum across all active credit rows)
    const totalAllotted = credits.reduce((sum, c) => sum + c.total_sessions, 0);

    // total_remaining = total_sessions - used_sessions across all active credit rows.
    // used_sessions is incremented at:
    //   • invoice-generation time (scheduled batch flow) — reflects sessions reserved for upcoming classes
    //   • room join time (manual enrollment flow) — reflects sessions actually attended
    // This correctly decrements for both flows, including manually enrolled students who have
    // no session_payments rows (the old session_payments approach always showed 0 consumed for them).
    const totalRemaining = credits.reduce((sum, c) => sum + Math.max(0, c.total_sessions - c.used_sessions), 0);

    children.push({
      student_email: email,
      student_name: studentName,
      credits,
      total_remaining: totalRemaining,
      total_allotted: totalAllotted,
      warning: totalRemaining > 0 && totalRemaining <= 5,
      exhausted: totalAllotted > 0 && totalRemaining <= 0,
    });

    overallRemaining += totalRemaining;
    overallAllotted += totalAllotted;
  }

  return NextResponse.json({
    success: true,
    data: {
      children: user.role === 'parent' ? children : undefined,
      credits: user.role === 'student' ? children[0]?.credits || [] : undefined,
      total_remaining: overallRemaining,
      total_allotted: overallAllotted,
      warning: overallRemaining > 0 && overallRemaining <= 5,
      exhausted: overallAllotted > 0 && overallRemaining <= 0,
    },
  });
}
