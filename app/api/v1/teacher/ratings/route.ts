// ═══════════════════════════════════════════════════════════════
// Teacher Ratings API — /api/v1/teacher/ratings
// Two-dimension rating system:
//   1. Punctuality — auto-computed from rooms (scheduled_start vs go_live_at)
//   2. Student Rating — from student_feedback (1-5 stars after each session)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

/** Convert late_minutes → 1-5 punctuality score */
function punctualityScore(lateMinutes: number): number {
  if (lateMinutes <= 1)  return 5;
  if (lateMinutes <= 3)  return 4;
  if (lateMinutes <= 5)  return 3;
  if (lateMinutes <= 15) return 2;
  return 1;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const user = await verifySession(token);
    if (!user || !['teacher', 'owner'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Teacher access only' }, { status: 403 });
    }

    const email = user.role === 'owner'
      ? (req.nextUrl.searchParams.get('teacher_email') || user.id)
      : user.id;

    // ── 1. Session-level data with punctuality ───────────────
    const sessionsResult = await db.query(
      `SELECT
         r.room_id,
         r.batch_session_id,
         r.subject,
         r.batch_id,
         r.scheduled_start,
         r.go_live_at,
         r.ended_at,
         EXTRACT(EPOCH FROM (r.go_live_at - r.scheduled_start)) / 60 AS late_minutes,
         bs.scheduled_date,
         b.batch_name,
         b.grade
       FROM rooms r
       LEFT JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
       LEFT JOIN batches b ON b.batch_id = r.batch_id
       WHERE r.teacher_email = $1
         AND r.status = 'ended'
         AND r.go_live_at IS NOT NULL
       ORDER BY r.scheduled_start DESC
       LIMIT 100`,
      [email]
    );

    // ── 2. Student feedback grouped by room ──────────────────
    const feedbackResult = await db.query(
      `SELECT
         sf.room_id,
         sf.student_email,
         sf.student_name,
         sf.rating,
         sf.feedback_text,
         sf.tags,
         sf.created_at,
         COALESCE(pu.full_name, sf.student_name) AS display_name
       FROM student_feedback sf
       JOIN rooms r ON r.room_id = sf.room_id
       LEFT JOIN portal_users pu ON pu.email = sf.student_email
       WHERE r.teacher_email = $1
       ORDER BY sf.created_at DESC`,
      [email]
    );

    // Group feedbacks by room_id
    const feedbackByRoom: Record<string, Array<{
      student_email: string; display_name: string;
      rating: number; feedback_text: string; tags: string; created_at: string;
    }>> = {};
    for (const row of feedbackResult.rows) {
      const f = row as Record<string, unknown>;
      const rid = f.room_id as string;
      if (!feedbackByRoom[rid]) feedbackByRoom[rid] = [];
      feedbackByRoom[rid].push({
        student_email: f.student_email as string,
        display_name: (f.display_name as string) || (f.student_email as string).split('@')[0],
        rating: Number(f.rating),
        feedback_text: (f.feedback_text as string) || '',
        tags: (f.tags as string) || '',
        created_at: f.created_at as string,
      });
    }

    // ── 3. Build session-level response ──────────────────────
    type SessionRow = Record<string, unknown>;
    const sessions = sessionsResult.rows.map((row) => {
      const s = row as SessionRow;
      const roomId = s.room_id as string;
      const lateMin = Math.max(0, Number(s.late_minutes ?? 0));
      const pScore = punctualityScore(lateMin);
      const fb = feedbackByRoom[roomId] ?? [];
      const avgRating = fb.length > 0
        ? Math.round(fb.reduce((sum, f) => sum + f.rating, 0) / fb.length * 10) / 10
        : null;

      return {
        room_id: roomId,
        batch_session_id: s.batch_session_id as string,
        subject: (s.subject as string) || '—',
        batch_name: (s.batch_name as string) || '—',
        grade: (s.grade as string) || '',
        scheduled_date: s.scheduled_date as string,
        scheduled_start: s.scheduled_start as string,
        go_live_at: s.go_live_at as string,
        late_minutes: Math.round(lateMin * 10) / 10,
        punctuality_score: pScore,
        feedbacks: fb,
        avg_student_rating: avgRating,
        feedback_count: fb.length,
      };
    });

    // ── 4. Compute aggregates ────────────────────────────────
    const totalSessions = sessions.length;
    const punctualityAvg = totalSessions > 0
      ? Math.round(sessions.reduce((s, x) => s + x.punctuality_score, 0) / totalSessions * 10) / 10
      : 0;

    const sessionsWithFeedback = sessions.filter(s => s.avg_student_rating !== null);
    const totalFeedback = sessions.reduce((s, x) => s + x.feedback_count, 0);
    const studentRatingAvg = sessionsWithFeedback.length > 0
      ? Math.round(sessionsWithFeedback.reduce((s, x) => s + (x.avg_student_rating ?? 0), 0) / sessionsWithFeedback.length * 10) / 10
      : 0;

    const overallAvg = (punctualityAvg > 0 && studentRatingAvg > 0)
      ? Math.round((punctualityAvg + studentRatingAvg) / 2 * 10) / 10
      : punctualityAvg || studentRatingAvg || 0;

    // ── 5. Monthly trend (both dimensions) ───────────────────
    const monthlyMap: Record<string, { pSum: number; pCount: number; sSum: number; sCount: number }> = {};
    for (const s of sessions) {
      const d = s.scheduled_date
        ? new Date(s.scheduled_date + 'T00:00:00')
        : new Date(s.scheduled_start);
      const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      if (!monthlyMap[key]) monthlyMap[key] = { pSum: 0, pCount: 0, sSum: 0, sCount: 0 };
      monthlyMap[key].pSum += s.punctuality_score;
      monthlyMap[key].pCount++;
      if (s.avg_student_rating !== null) {
        monthlyMap[key].sSum += s.avg_student_rating;
        monthlyMap[key].sCount++;
      }
    }

    const monthly = Object.entries(monthlyMap).map(([month, m]) => ({
      month,
      punctuality_avg: Math.round(m.pSum / m.pCount * 10) / 10,
      student_rating_avg: m.sCount > 0 ? Math.round(m.sSum / m.sCount * 10) / 10 : null,
      session_count: m.pCount,
      feedback_count: m.sCount,
    }));

    // ── 6. Punctuality distribution ──────────────────────────
    const punctDist = { on_time: 0, slightly_late: 0, late: 0, very_late: 0 };
    for (const s of sessions) {
      if (s.late_minutes <= 1) punctDist.on_time++;
      else if (s.late_minutes <= 5) punctDist.slightly_late++;
      else if (s.late_minutes <= 15) punctDist.late++;
      else punctDist.very_late++;
    }

    // ── 7. Rating distribution ───────────────────────────────
    const ratingDist = { five: 0, four: 0, three: 0, two: 0, one: 0 };
    for (const fbs of Object.values(feedbackByRoom)) {
      for (const f of fbs) {
        if (f.rating >= 5) ratingDist.five++;
        else if (f.rating >= 4) ratingDist.four++;
        else if (f.rating >= 3) ratingDist.three++;
        else if (f.rating >= 2) ratingDist.two++;
        else ratingDist.one++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          punctuality_avg: punctualityAvg,
          student_rating_avg: studentRatingAvg,
          overall_avg: overallAvg,
          total_sessions: totalSessions,
          total_feedback: totalFeedback,
          sessions_with_feedback: sessionsWithFeedback.length,
        },
        punctuality_distribution: punctDist,
        rating_distribution: ratingDist,
        sessions,
        monthly,
      },
    });
  } catch (err) {
    console.error('[teacher/ratings] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
