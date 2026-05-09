import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

/**
 * GET /api/v1/batches/[batchId]/report?sessions=id1,id2,...
 *
 * Generate a multi-session performance report for a batch.
 * Aggregates attendance, exam scores, and AI engagement per student
 * across the selected ended sessions.
 *
 * Access: academic_operator, batch_coordinator, owner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    // Auth
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    const user = await verifySession(sessionToken);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });

    const allowed = ['academic_operator', 'academic', 'batch_coordinator', 'owner'];
    if (!allowed.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Parse session IDs from query param
    const sessionIds = (request.nextUrl.searchParams.get('sessions') || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (sessionIds.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'No sessions specified' }, { status: 400 });
    }

    // ── 1. Batch metadata ──────────────────────────────────────────
    const batchRes = await db.query(
      `SELECT b.batch_id, b.batch_name, b.grade, b.board, b.subjects, b.batch_type,
              b.coordinator_email, b.academic_operator_email
       FROM batches b
       WHERE b.batch_id = $1`,
      [batchId]
    );
    if (batchRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    const batch = batchRes.rows[0] as Record<string, unknown>;

    // ── 2. Session metadata for the requested sessions ────────────
    // Build parameterised placeholder list: $1, $2, …
    const placeholders = sessionIds.map((_, i) => `$${i + 2}`).join(', ');
    const sessionsRes = await db.query(
      `SELECT
         bs.session_id, bs.subject, bs.scheduled_date, bs.start_time,
         bs.duration_minutes, bs.topic, bs.status,
         r.room_id, r.go_live_at, r.ended_at,
         CASE
           WHEN r.go_live_at IS NOT NULL AND r.ended_at IS NOT NULL
           THEN ROUND(EXTRACT(EPOCH FROM (r.ended_at - r.go_live_at)) / 60)::int
           ELSE COALESCE(r.duration_minutes, bs.duration_minutes)
         END AS actual_duration_min,
         pu.full_name AS teacher_name, bs.teacher_email,
         (SELECT ROUND(AVG(sr.overall)::numeric, 1)
          FROM session_ratings sr
          WHERE sr.session_id = bs.session_id) AS teacher_rating
       FROM batch_sessions bs
       LEFT JOIN rooms r ON r.batch_session_id = bs.session_id
       LEFT JOIN portal_users pu ON pu.email = bs.teacher_email
       WHERE bs.batch_id = $1
         AND bs.session_id IN (${placeholders})
       ORDER BY bs.scheduled_date ASC, bs.start_time ASC`,
      [batchId, ...sessionIds]
    );
    const sessionRows = sessionsRes.rows as Record<string, unknown>[];
    const validRoomIds = sessionRows
      .map(s => s.room_id as string | null)
      .filter(Boolean) as string[];

    // ── 3. Student roster for this batch ──────────────────────────
    const studentsRes = await db.query(
      `SELECT bs.student_email, pu.full_name AS student_name,
              COALESCE(up.grade, '')  AS grade,
              COALESCE(up.board, '') AS board
       FROM batch_students bs
       JOIN portal_users pu ON pu.email = bs.student_email
       LEFT JOIN user_profiles up ON up.email = bs.student_email
       WHERE bs.batch_id = $1
         AND bs.student_status = 'active'
       ORDER BY pu.full_name ASC`,
      [batchId]
    );
    const studentRows = studentsRes.rows as Record<string, unknown>[];

    // ── 4. Attendance per student per session ─────────────────────
    let attRows: Record<string, unknown>[] = [];
    if (validRoomIds.length > 0) {
      const attPlaceholders = validRoomIds.map((_, i) => `$${i + 1}`).join(', ');
      const attRes = await db.query(
        `SELECT atts.room_id, atts.participant_email AS student_email,
                atts.status, atts.total_duration_sec,
                atts.late_by_sec, atts.attention_avg, atts.join_count
         FROM attendance_sessions atts
         WHERE atts.room_id IN (${attPlaceholders})
           AND atts.participant_role = 'student'`,
        validRoomIds
      );
      attRows = attRes.rows as Record<string, unknown>[];
    }

    // ── 4b. AI monitoring events per student ────────────────────────
    let monitoringRows: Record<string, unknown>[] = [];
    if (validRoomIds.length > 0) {
      const monPlaceholders = validRoomIds.map((_, i) => `$${i + 1}`).join(', ');
      const monRes = await db.query(
        `SELECT cme.student_email, cme.event_type,
                COUNT(*) AS event_count,
                COALESCE(SUM(cme.duration_seconds), 0) AS total_seconds
         FROM class_monitoring_events cme
         WHERE cme.room_id IN (${monPlaceholders})
         GROUP BY cme.student_email, cme.event_type`,
        validRoomIds
      );
      monitoringRows = monRes.rows as Record<string, unknown>[];
    }

    // ── 5. Exam results per student per session (live in-class exams) ─────
    let examRows: Record<string, unknown>[] = [];
    if (sessionIds.length > 0) {
      const examPlaceholders = sessionIds.map((_, i) => `$${i + 1}`).join(', ');
      const examRes = await db.query(
        `SELECT ser.student_email, ser.score, ser.total_marks,
                ser.percentage, ser.grade_letter,
                ser.session_id,
                COALESCE(ser.topic_title, ser.subject) AS topic
         FROM session_exam_results ser
         WHERE ser.session_id IN (${examPlaceholders})`,
        sessionIds
      );
      examRows = examRes.rows as Record<string, unknown>[];
    }

    // ── 6. Build per-session attendance counts + monitoring map ────────
    // Map room_id → session_id
    const roomToSession: Record<string, string> = {};
    for (const s of sessionRows) {
      if (s.room_id) roomToSession[s.room_id as string] = s.session_id as string;
    }

    // monitoring map: student_email → event_type → { count, seconds }
    const ENGAGED = new Set(['attentive', 'writing_notes', 'thinking', 'reading_material', 'hand_raised', 'speaking']);
    const monMap: Record<string, Record<string, { count: number; seconds: number }>> = {};
    for (const row of monitoringRows) {
      const email = row.student_email as string;
      const etype = row.event_type as string;
      if (!monMap[email]) monMap[email] = {};
      monMap[email][etype] = {
        count: Number(row.event_count) || 0,
        seconds: Number(row.total_seconds) || 0,
      };
    }

    // session_id → { present, late, absent, total, avg_exam_score }
    const sessionStats: Record<string, { present: number; late: number; absent: number; total: number; examScores: number[] }> = {};
    for (const s of sessionRows) {
      sessionStats[s.session_id as string] = { present: 0, late: 0, absent: 0, total: 0, examScores: [] };
    }
    for (const att of attRows) {
      const sid = roomToSession[att.room_id as string];
      if (!sid || !sessionStats[sid]) continue;
      sessionStats[sid].total++;
      const st = att.status as string;
      if (st === 'present') sessionStats[sid].present++;
      else if (st === 'late') { sessionStats[sid].present++; sessionStats[sid].late++; }
      else sessionStats[sid].absent++;
    }
    for (const ex of examRows) {
      const sid = ex.session_id as string;
      if (sessionStats[sid] && ex.percentage != null) {
        sessionStats[sid].examScores.push(Number(ex.percentage));
      }
    }

    // ── 7. Build per-student aggregation ─────────────────────────
    // att lookup: student_email + room_id → row
    const attMap: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const att of attRows) {
      const email = att.student_email as string;
      const rid = att.room_id as string;
      if (!attMap[email]) attMap[email] = {};
      attMap[email][rid] = att;
    }
    // exam lookup: student_email + session_id → row[]
    const examMap: Record<string, Record<string, Record<string, unknown>[]>> = {};
    for (const ex of examRows) {
      const email = ex.student_email as string;
      const sid = ex.session_id as string;
      if (!examMap[email]) examMap[email] = {};
      if (!examMap[email][sid]) examMap[email][sid] = [];
      examMap[email][sid].push(ex);
    }

    const studentReports = studentRows.map(st => {
      const email = st.student_email as string;
      let present = 0, late = 0, absent = 0, attSum = 0, attCount = 0;

      for (const s of sessionRows) {
        const roomId = s.room_id as string | null;
        if (!roomId) { absent++; continue; }
        const att = attMap[email]?.[roomId];
        if (!att) { absent++; continue; }
        const status = att.status as string;
        if (status === 'present') present++;
        else if (status === 'late') { present++; late++; }
        else absent++;
        if (att.attention_avg != null && Number(att.attention_avg) > 0) {
          attSum += Number(att.attention_avg);
          attCount++;
        }
      }

      const total = sessionRows.length;
      const attendanceRate = total > 0 ? Math.round(((present) / total) * 100) : 0;
      let avgAttention: number | null = attCount > 0 ? Math.round(attSum / attCount) : null;

      // Fallback: compute attention from monitoring events when attention_avg is NULL
      // (happens when all monitoring events have duration_seconds=0)
      if (avgAttention === null && monMap[email]) {
        const mon = monMap[email];
        const totalSec = Object.values(mon).reduce((s, v) => s + v.seconds, 0);
        if (totalSec > 0) {
          const engSec = Object.entries(mon)
            .filter(([k]) => ENGAGED.has(k))
            .reduce((s, [, v]) => s + v.seconds, 0);
          avgAttention = Math.round((engSec / totalSec) * 100);
        } else {
          const totalCount = Object.values(mon).reduce((s, v) => s + v.count, 0);
          if (totalCount > 0) {
            const engCount = Object.entries(mon)
              .filter(([k]) => ENGAGED.has(k))
              .reduce((s, [, v]) => s + v.count, 0);
            avgAttention = Math.round((engCount / totalCount) * 100);
          }
        }
      }

      // Exam results
      const exams: { session_id: string; topic: string; score: number; total: number; percentage: number; grade_letter: string }[] = [];
      for (const [sid, rows] of Object.entries(examMap[email] || {})) {
        for (const ex of rows) {
          exams.push({
            session_id: sid,
            topic: (ex.topic as string) || 'Exam',
            score: Number(ex.score) || 0,
            total: Number(ex.total_marks) || 0,
            percentage: Number(ex.percentage) || 0,
            grade_letter: (ex.grade_letter as string) || '—',
          });
        }
      }
      const avgExamScore = exams.length > 0
        ? Math.round(exams.reduce((s, e) => s + e.percentage, 0) / exams.length)
        : null;

      // Overall grade: 60% exam + 40% attendance if exams exist, else attendance only
      let overallGrade: string | null = null;
      const gradeScore = avgExamScore != null
        ? avgExamScore * 0.6 + attendanceRate * 0.4
        : attendanceRate;
      if (gradeScore >= 85) overallGrade = 'A';
      else if (gradeScore >= 70) overallGrade = 'B';
      else if (gradeScore >= 55) overallGrade = 'C';
      else if (gradeScore >= 40) overallGrade = 'D';
      else overallGrade = 'F';

      // AI monitoring breakdown
      const mon = monMap[email] || {};
      const engagedSec = Object.entries(mon)
        .filter(([k]) => ENGAGED.has(k))
        .reduce((sum, [, v]) => sum + v.seconds, 0);
      const monitoring = Object.keys(mon).length > 0 ? {
        engagedSec,
        writingNotesCount: mon['writing_notes']?.count ?? 0,
        writingNotesSec:   mon['writing_notes']?.seconds ?? 0,
        tabSwitchCount:    mon['tab_switched']?.count ?? 0,
        tabSwitchedSec:    mon['tab_switched']?.seconds ?? 0,
        phoneDetectedSec:  mon['phone_detected']?.seconds ?? 0,
        distractedSec: (['distracted', 'head_turned', 'yawning'] as string[])
          .reduce((s, k) => s + (mon[k]?.seconds ?? 0), 0),
        inactiveSec: (['inactive', 'brief_absence', 'low_visibility'] as string[])
          .reduce((s, k) => s + (mon[k]?.seconds ?? 0), 0),
        multipleFacesSec: mon['multiple_faces']?.seconds ?? 0,
      } : null;

      return {
        email,
        name: st.student_name as string,
        grade: (st.grade as string) || '—',
        board: (st.board as string) || '—',
        attendance: { present, late, absent, total, rate: attendanceRate },
        avgAttention,
        monitoring,
        exams,
        avgExamScore,
        overallGrade,
      };
    });

    // ── 8. Build session summaries ────────────────────────────────
    const sessionSummaries = sessionRows.map(s => {
      const sid = s.session_id as string;
      const stats = sessionStats[sid] || { present: 0, late: 0, absent: 0, total: 0, examScores: [] };
      const avgExamScore = stats.examScores.length > 0
        ? Math.round(stats.examScores.reduce((a, b) => a + b, 0) / stats.examScores.length)
        : null;
      return {
        session_id: sid,
        subject: s.subject as string,
        scheduled_date: typeof s.scheduled_date === 'object'
          ? (s.scheduled_date as Date).toISOString().slice(0, 10)
          : String(s.scheduled_date).slice(0, 10),
        start_time: String(s.start_time).slice(0, 5),
        teacher_name: (s.teacher_name as string) || (s.teacher_email as string) || 'Unknown',
        actual_duration_min: Number(s.actual_duration_min) || 0,
        scheduled_duration_min: Number(s.duration_minutes) || 0,
        overtime_min: Math.max(0, (Number(s.actual_duration_min) || 0) - (Number(s.duration_minutes) || 0)),
        present_count: stats.present,
        total_students: studentRows.length,
        avg_exam_score: avgExamScore,
        topic: (s.topic as string) || null,
        teacher_rating: s.teacher_rating != null ? Number(s.teacher_rating) : null,
      };
    });

    // ── 9. Overall stats ──────────────────────────────────────────
    const dates = sessionSummaries.map(s => s.scheduled_date).sort();
    const allExamScores = studentReports.flatMap(st => st.exams.map(e => e.percentage));
    const avgAttendanceRate = studentReports.length > 0
      ? Math.round(studentReports.reduce((s, st) => s + st.attendance.rate, 0) / studentReports.length)
      : 0;
    const avgExamScoreOverall = allExamScores.length > 0
      ? Math.round(allExamScores.reduce((a, b) => a + b, 0) / allExamScores.length)
      : null;
    const totalClassTimeMin = sessionSummaries.reduce((sum, s) => sum + (s.actual_duration_min || 0), 0);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        batch: {
          batch_id: batch.batch_id,
          batch_name: batch.batch_name,
          grade: batch.grade || '—',
          board: batch.board || '—',
          subjects: batch.subjects || [],
          batch_type: batch.batch_type,
        },
        sessions: sessionSummaries,
        students: studentReports,
        overallStats: {
          totalSessions: sessionSummaries.length,
          totalStudents: studentRows.length,
          avgAttendanceRate,
          avgExamScore: avgExamScoreOverall,
          totalClassTimeMin,
          dateRange: {
            from: dates[0] || '',
            to: dates[dates.length - 1] || '',
          },
        },
      },
    });
  } catch (err) {
    console.error('[batch/report] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
