// ═══════════════════════════════════════════════════════════════
// Chatbot Context API — GET /api/v1/chatbot-context
// Builds comprehensive student data context for the Buji chatbot.
// Fetches: profile, attendance, AI monitoring, marks, parent,
//          homework, fees, credits, sessions, batches — everything.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Helper: safely access row fields from pg query results
type R = Record<string, any>;

// Typed query helper — avoids repetitive casting
function q(sql: string, params?: unknown[]) {
  return db.query(sql, params) as Promise<{ rows: R[]; rowCount: number }>;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return fail('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return fail('Unauthorized', 401);

  const email = user.id;
  const role = user.role;

  // Only students and parents get rich context
  if (!['student', 'parent'].includes(role)) {
    return NextResponse.json({ success: true, context: `Role: ${role}\nName: ${user.name}\nEmail: ${email}` });
  }

  try {
    if (role === 'student') {
      const context = await buildStudentContext(email);
      return NextResponse.json({ success: true, context });
    }

    if (role === 'parent') {
      const context = await buildParentContext(email);
      return NextResponse.json({ success: true, context });
    }

    return NextResponse.json({ success: true, context: '' });
  } catch (err) {
    console.error('[chatbot-context] Error building context:', err);
    return fail('Failed to build context', 500);
  }
}

// ── Student: Build complete context string ──────────────────────
async function buildStudentContext(email: string): Promise<string> {
  const lines: string[] = [];
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const today = now.toISOString().slice(0, 10);

  // Helper: run a section safely — if one section crashes, the rest still runs
  async function section(name: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      console.error(`[chatbot-context] Section "${name}" failed:`, err);
    }
  }

  // === 1. Profile & Parent Details ===
  // (profile is critical — let it throw if broken)
  const profileRes = await q(
    `SELECT
       pu.full_name, pu.email, pu.portal_role, pu.phone AS login_phone,
       pu.branch_id, pu.last_login_at,
       up.phone, up.whatsapp, up.date_of_birth, up.grade, up.section,
       up.board, up.parent_email, up.admission_date, up.qualification,
       up.address, up.notes
     FROM portal_users pu
     LEFT JOIN user_profiles up ON up.email = pu.email
     WHERE pu.email = $1`,
    [email],
  );
  const p = profileRes.rows[0];
  if (p) {
    lines.push('=== STUDENT PROFILE ===');
    lines.push(`Name: ${p.full_name || 'N/A'}`);
    lines.push(`Email: ${email}`);
    if (p.grade) lines.push(`Grade: ${p.grade}`);
    if (p.section) lines.push(`Section: ${p.section}`);
    if (p.board) lines.push(`Board: ${p.board}`);
    if (p.phone) lines.push(`Phone: ${p.phone}`);
    if (p.whatsapp) lines.push(`WhatsApp: ${p.whatsapp}`);
    if (p.date_of_birth) lines.push(`Date of Birth: ${p.date_of_birth}`);
    if (p.admission_date) lines.push(`Admission Date: ${p.admission_date}`);
    if (p.address) lines.push(`Address: ${p.address}`);
    if (p.qualification) lines.push(`Qualification: ${p.qualification}`);
    if (p.last_login_at) lines.push(`Last Login: ${new Date(String(p.last_login_at)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  }

  // === 2. Parent Details ===
  if (p?.parent_email) {
    const parentRes = await q(
      `SELECT pu.full_name, pu.email, pu.phone,
              up.phone AS parent_phone, up.whatsapp AS parent_whatsapp
       FROM portal_users pu
       LEFT JOIN user_profiles up ON up.email = pu.email
       WHERE pu.email = $1`,
      [p.parent_email],
    );
    const parent = parentRes.rows[0];
    lines.push('\n=== PARENT DETAILS ===');
    if (parent) {
      lines.push(`Parent Name: ${parent.full_name || 'N/A'}`);
      lines.push(`Parent Email: ${parent.email}`);
      if (parent.parent_phone || parent.phone) lines.push(`Parent Phone: ${parent.parent_phone || parent.phone}`);
      if (parent.parent_whatsapp) lines.push(`Parent WhatsApp: ${parent.parent_whatsapp}`);
    } else {
      lines.push(`Parent Email: ${p.parent_email} (not registered yet)`);
    }
  }

  // ── Sections 3–16: Each wrapped in section() to be fault-tolerant ──

  await section('Batches & Teachers', async () => {
  // === 3. Enrolled Batches & Teachers ===
  const batchRes = await q(
    `SELECT b.batch_id, b.batch_name, b.batch_type, b.grade, b.board,
            b.section, b.subjects, bs.student_status,
            b.coordinator_email, b.academic_operator_email
     FROM batch_students bs
     JOIN batches b ON b.batch_id = bs.batch_id
     WHERE bs.student_email = $1
     ORDER BY bs.added_at DESC`,
    [email],
  );
  if (batchRes.rows.length > 0) {
    lines.push(`\n=== ENROLLED CLASSES (${batchRes.rows.length}) ===`);
    for (const b of batchRes.rows) {
      const subjects = Array.isArray(b.subjects) ? b.subjects.join(', ') : b.subjects || 'N/A';
      lines.push(`- ${b.batch_name} | Type: ${String(b.batch_type || '').replace(/_/g, ' ')} | Subjects: ${subjects} | Status: ${b.student_status || 'active'}`);
      // Teachers for this batch
      const teacherRes = await q(
        `SELECT bt.subject, pu.full_name AS teacher_name
         FROM batch_teachers bt
         JOIN portal_users pu ON pu.email = bt.teacher_email
         WHERE bt.batch_id = $1`,
        [b.batch_id],
      );
      for (const t of teacherRes.rows) {
        lines.push(`  Teacher: ${t.teacher_name} (${t.subject})`);
      }

      // Session stats for this batch
      const statsRes = await q(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_start > NOW())::int AS upcoming
         FROM rooms WHERE batch_id = $1`,
        [b.batch_id],
      );
      const st = statsRes.rows[0];
      if (st) lines.push(`  Sessions: ${st.completed} completed, ${st.upcoming} upcoming of ${st.total} total`);
    }
  }
  }); // end section 3

  await section('Attendance', async () => {
  // === 4. Overall Attendance Summary ===
  const attSummary = await q(
    `SELECT
       COUNT(*)::int AS total_sessions,
       COUNT(*) FILTER (WHERE status = 'present')::int AS present,
       COUNT(*) FILTER (WHERE status = 'absent')::int AS absent,
       COUNT(*) FILTER (WHERE status = 'late')::int AS late,
       COUNT(*) FILTER (WHERE status = 'left_early')::int AS left_early,
       ROUND(AVG(CASE WHEN status IN ('present','late') THEN 100.0 ELSE 0 END), 1) AS attendance_rate,
       ROUND(AVG(total_duration_sec) / 60.0, 1) AS avg_time_minutes,
       ROUND(AVG(attention_avg), 1) AS avg_attention,
       ROUND(AVG(engagement_score), 1) AS avg_engagement,
       SUM(join_count)::int AS total_rejoins
     FROM attendance_sessions
     WHERE participant_email = $1 AND participant_role = 'student'`,
    [email],
  );
  const att = attSummary.rows[0];
  if (att && att.total_sessions > 0) {
    lines.push('\n=== ATTENDANCE SUMMARY ===');
    lines.push(`Overall Rate: ${att.attendance_rate}%`);
    lines.push(`Total Sessions: ${att.total_sessions} | Present: ${att.present} | Absent: ${att.absent} | Late: ${att.late} | Left Early: ${att.left_early}`);
    lines.push(`Average Time in Class: ${att.avg_time_minutes} minutes`);
    lines.push(`Average Attention Score: ${att.avg_attention}/100`);
    lines.push(`Average Engagement Score: ${att.avg_engagement}/100`);
    lines.push(`Total Rejoins: ${att.total_rejoins}`);
  }

  // === 5. Attendance by Subject ===
  const attBySubject = await q(
    `SELECT r.subject,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE a.status IN ('present','late'))::int AS present,
       ROUND(AVG(CASE WHEN a.status IN ('present','late') THEN 100.0 ELSE 0 END), 1) AS rate,
       ROUND(AVG(a.attention_avg), 1) AS avg_attention
     FROM attendance_sessions a
     JOIN rooms r ON r.room_id = a.room_id
     WHERE a.participant_email = $1 AND a.participant_role = 'student'
     GROUP BY r.subject
     ORDER BY total DESC`,
    [email],
  );
  if (attBySubject.rows.length > 0) {
    lines.push('\n=== ATTENDANCE BY SUBJECT ===');
    for (const s of attBySubject.rows) {
      lines.push(`- ${s.subject}: ${s.rate}% attendance (${s.present}/${s.total}), Avg attention: ${s.avg_attention}/100`);
    }
  }
  }); // end section 4-5

  await section('AI Monitoring', async () => {
  // === 6. AI Monitoring Summary (last 90 days) ===
  const monRes = await q(
    `SELECT event_type,
       COUNT(*)::int AS count,
       ROUND(SUM(duration_seconds)::numeric / 60, 1)::float AS total_minutes,
       ROUND(AVG(confidence)::numeric, 1)::float AS avg_confidence
     FROM class_monitoring_events
     WHERE student_email = $1 AND created_at >= $2
     GROUP BY event_type
     ORDER BY total_minutes DESC`,
    [email, ninetyDaysAgo],
  );
  if (monRes.rows.length > 0) {
    lines.push('\n=== AI MONITORING BEHAVIOR (Last 90 Days) ===');
    for (const m of monRes.rows) {
      lines.push(`- ${m.event_type.replace(/_/g, ' ')}: ${m.count} events, ${m.total_minutes} min total, ${m.avg_confidence}% confidence`);
    }
  }

  // === 7. Monitoring Alerts Summary ===
  const alertRes = await q(
    `SELECT alert_type, severity, COUNT(*)::int AS count
     FROM monitoring_alerts
     WHERE target_email = $1 AND created_at >= $2
     GROUP BY alert_type, severity
     ORDER BY count DESC`,
    [email, ninetyDaysAgo],
  );
  if (alertRes.rows.length > 0) {
    lines.push('\n=== MONITORING ALERTS (Last 90 Days) ===');
    for (const a of alertRes.rows) {
      lines.push(`- ${a.alert_type.replace(/_/g, ' ')} [${a.severity}]: ${a.count} alerts`);
    }
  }
  }); // end section 6-7

  await section('Exam Results', async () => {
  // === 8. Session Exam Results — Full LiveKit Live Exam Data ===
  const examRes = await q(
    `SELECT ser.id, ser.topic_id, ser.session_id, ser.room_id,
            ser.subject, ser.topic_title,
            ser.total_questions, ser.answered, ser.skipped,
            ser.score, ser.total_marks, ser.percentage, ser.grade_letter,
            ser.time_taken_seconds, ser.tab_switch_count, ser.auto_submitted,
            ser.violations, ser.answers,
            ser.started_at, ser.completed_at,
            ser.teacher_name, ser.teacher_email,
            COALESCE(st.paper_type, '') AS paper_type,
            COALESCE(st.category, 'topic') AS category,
            COALESCE(st.chapter_name, '') AS chapter_name,
            COALESCE(st.topic_name, '') AS topic_name
     FROM session_exam_results ser
     LEFT JOIN session_exam_topics st ON st.id = ser.topic_id
     WHERE ser.student_email = $1
     ORDER BY ser.completed_at DESC
     LIMIT 20`,
    [email],
  );
  if (examRes.rows.length > 0) {
    const exams = examRes.rows;
    const avgPct = exams.reduce((s: number, e: R) => s + (Number(e.percentage) || 0), 0) / exams.length;
    const passCount = exams.filter((e: R) => Number(e.percentage) >= 40).length;
    const failCount = exams.length - passCount;

    lines.push(`\n=== LIVE SESSION EXAM RESULTS (${exams.length} exams) ===`);
    lines.push(`Average Score: ${Math.round(avgPct)}% | Pass rate: ${passCount}/${exams.length} (${Math.round(passCount / exams.length * 100)}%) | Failed: ${failCount}`);
    lines.push(`Grade scale: A+ (≥90%), A (≥75%), B+ (≥60%), B (≥45%), C+ (≥30%), C (<30%) | Pass threshold: 40%`);

    for (const e of exams) {
      const passed = Number(e.percentage) >= 40;
      const dt = e.completed_at ? new Date(String(e.completed_at)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
      const timeTaken = Number(e.time_taken_seconds) || 0;
      const avgTimePerQ = e.answered > 0 ? Math.round(timeTaken / Number(e.answered)) : 0;
      const typeLabel = e.paper_type ? ` [${e.paper_type}]` : '';
      const catLabel = e.category === 'question_paper' ? ' (Question Paper)' : '';
      const chapterStr = e.chapter_name ? ` | Chapter: ${e.chapter_name}` : '';
      const topicStr = e.topic_name ? ` | Topic: ${e.topic_name}` : '';

      lines.push(`\n[${e.topic_title} — ${e.subject}${typeLabel}${catLabel}]`);
      lines.push(`  Date: ${dt} | Teacher: ${e.teacher_name || 'N/A'}`);
      lines.push(`  Score: ${e.score}/${e.total_marks} = ${e.percentage}% | Grade: ${e.grade_letter || 'N/A'} | ${passed ? '✅ PASS' : '❌ FAIL'}${chapterStr}${topicStr}`);
      lines.push(`  Questions: ${e.answered} answered, ${e.skipped} skipped out of ${e.total_questions}`);
      lines.push(`  Time: ${Math.floor(timeTaken / 60)}min ${timeTaken % 60}s total | Avg ${avgTimePerQ}s per question`);
      lines.push(`  Tab switches: ${e.tab_switch_count || 0}${Number(e.tab_switch_count) > 3 ? ' ⚠ HIGH' : ''}${e.auto_submitted ? ' | ⚠ AUTO-SUBMITTED (time expired)' : ''}`);

      // Parse violations if present
      if (e.violations && typeof e.violations === 'object') {
        const v = Array.isArray(e.violations) ? e.violations : [];
        if (v.length > 0) {
          const violationTypes: Record<string, number> = {};
          for (const vi of v) {
            const t = String(vi?.type || 'unknown');
            violationTypes[t] = (violationTypes[t] || 0) + 1;
          }
          const parts = Object.entries(violationTypes).map(([t, c]) => `${t.replace(/_/g, ' ')}: ${c}x`);
          lines.push(`  Violations: ${parts.join(', ')}`);
        }
      }

      // Per-question accuracy breakdown from answers JSONB
      const answers = Array.isArray(e.answers) ? e.answers : [];
      if (answers.length > 0) {
        const correct = answers.filter((a: R) => a.is_correct === true).length;
        const wrong = answers.filter((a: R) => a.is_correct === false && a.selected_option != null).length;
        const unanswered = answers.filter((a: R) => a.selected_option == null).length;
        const fastest = answers.filter((a: R) => a.time_taken != null).sort((a: R, b: R) => Number(a.time_taken) - Number(b.time_taken))[0];
        const slowest = answers.filter((a: R) => a.time_taken != null).sort((a: R, b: R) => Number(b.time_taken) - Number(a.time_taken))[0];

        lines.push(`  Accuracy: ${correct} correct, ${wrong} wrong, ${unanswered} unanswered`);
        if (fastest) lines.push(`  Fastest answer: ${fastest.time_taken}s | Slowest: ${slowest?.time_taken || 'N/A'}s`);

        // Full question-by-question detail — so Buji can explain each answer
        lines.push(`  --- Questions Detail ---`);
        for (let qi = 0; qi < answers.length; qi++) {
          const a = answers[qi];
          const opts = Array.isArray(a.options) ? a.options : [];
          const selectedIdx = a.selected_option;
          const correctIdx = a.correct_answer;
          const selectedText = selectedIdx != null && opts[selectedIdx] ? opts[selectedIdx] : '(not answered)';
          const correctText = correctIdx != null && opts[correctIdx] ? opts[correctIdx] : 'N/A';
          const status = a.is_correct ? '✅' : selectedIdx == null ? '⏭️ SKIPPED' : '❌';

          lines.push(`  Q${qi + 1}: ${a.question_text || 'N/A'}`);
          lines.push(`    Options: ${opts.map((o: string, i: number) => `${i === correctIdx ? '✓' : ' '}${String.fromCharCode(65 + i)}) ${o}`).join(' | ')}`);
          lines.push(`    Student answered: ${selectedText} ${status} | Correct: ${correctText}`);
          if (a.time_taken != null) lines.push(`    Time: ${a.time_taken}s | Marks: ${a.marks_awarded ?? 0}/${a.marks || 1}`);
        }

        // Topic-wise breakdown if questions have topic field
        const topicStats: Record<string, { correct: number; total: number }> = {};
        for (const a of answers) {
          const t = String(a.topic || 'General');
          if (!topicStats[t]) topicStats[t] = { correct: 0, total: 0 };
          topicStats[t].total++;
          if (a.is_correct) topicStats[t].correct++;
        }
        if (Object.keys(topicStats).length > 1) {
          const topicParts = Object.entries(topicStats).map(([t, d]) => `${t}: ${d.correct}/${d.total}`);
          lines.push(`  Topic-wise: ${topicParts.join(' | ')}`);
        }
      }
    }

    // Subject-wise exam averages & trends
    const subjectExams: Record<string, { total: number; sum: number; pass: number; totalTabSwitches: number; latestPct: number }> = {};
    for (const e of exams) {
      const sub = (e.subject as string) || 'Unknown';
      if (!subjectExams[sub]) subjectExams[sub] = { total: 0, sum: 0, pass: 0, totalTabSwitches: 0, latestPct: Number(e.percentage) || 0 };
      subjectExams[sub].total++;
      subjectExams[sub].sum += Number(e.percentage) || 0;
      if (Number(e.percentage) >= 40) subjectExams[sub].pass++;
      subjectExams[sub].totalTabSwitches += Number(e.tab_switch_count) || 0;
    }
    lines.push('\nSubject-wise Exam Summary:');
    for (const [sub, data] of Object.entries(subjectExams)) {
      lines.push(`  ${sub}: Avg ${Math.round(data.sum / data.total)}% | ${data.pass}/${data.total} passed | Tab switches total: ${data.totalTabSwitches} | Latest: ${data.latestPct}%`);
    }
  }
  }); // end section 8

  await section('Pending Exams', async () => {
  // === 9. Pending Exams ===
  const pendingExamRes = await q(
    `SELECT e.title, e.subject, e.total_marks, e.duration_minutes, e.passing_marks
     FROM exams e
     JOIN exam_batch_assignments eba ON eba.exam_id = e.id
     JOIN rooms r ON r.room_id = eba.room_id
     JOIN batch_students bs ON bs.batch_id = r.batch_id
     LEFT JOIN exam_attempts ea ON ea.exam_id = e.id AND ea.student_email = $1
     WHERE bs.student_email = $1 AND e.published = true AND ea.id IS NULL
     ORDER BY e.created_at DESC
     LIMIT 10`,
    [email],
  );
  if (pendingExamRes.rows.length > 0) {
    lines.push(`\n=== PENDING EXAMS (${pendingExamRes.rows.length}) ===`);
    for (const e of pendingExamRes.rows) {
      lines.push(`- ${e.title} (${e.subject}): ${e.total_marks} marks, ${e.duration_minutes}min, Pass: ${e.passing_marks}`);
    }
  }
  }); // end section 9

  await section('Fees & Credits', async () => {
  // === 10. Fees & Payments ===
  const feesRes = await q(
    `SELECT
       COALESCE(SUM(amount_paise), 0)::bigint AS total_invoiced,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paise ELSE 0 END), 0)::bigint AS total_paid,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_paise ELSE 0 END), 0)::bigint AS total_pending,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
       COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue_count,
       COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count
     FROM invoices
     WHERE student_email = $1`,
    [email],
  );
  const fees = feesRes.rows[0];
  if (fees && (Number(fees.total_invoiced) > 0 || fees.pending_count > 0)) {
    lines.push('\n=== FEES & PAYMENTS ===');
    lines.push(`Total Invoiced: ₹${(Number(fees.total_invoiced) / 100).toLocaleString('en-IN')}`);
    lines.push(`Paid: ₹${(Number(fees.total_paid) / 100).toLocaleString('en-IN')} (${fees.paid_count} invoices)`);
    lines.push(`Pending: ₹${(Number(fees.total_pending) / 100).toLocaleString('en-IN')} (${fees.pending_count} invoices)`);
    if (fees.overdue_count > 0) lines.push(`⚠ OVERDUE: ${fees.overdue_count} invoices!`);
  }

  // === 11. Session Credits ===
  const creditsRes = await q(
    `SELECT subject,
       COALESCE(SUM(total_sessions), 0)::int AS allotted,
       COALESCE(SUM(used_sessions), 0)::int AS used,
       COALESCE(SUM(remaining), 0)::int AS remaining
     FROM student_session_credits
     WHERE student_email = $1 AND is_active = true
     GROUP BY subject`,
    [email],
  );
  if (creditsRes.rows.length > 0) {
    const totalRemaining = creditsRes.rows.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.remaining) || 0), 0);
    const totalAllotted = creditsRes.rows.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.allotted) || 0), 0);
    lines.push(`\n=== SESSION CREDITS ===`);
    lines.push(`Total: ${totalRemaining} remaining of ${totalAllotted} allotted`);
    for (const c of creditsRes.rows) {
      lines.push(`- ${c.subject}: ${c.remaining} remaining of ${c.allotted}`);
    }
    if (totalRemaining <= 3 && totalAllotted > 0) lines.push('⚠ Credits running low!');
    if (totalRemaining <= 0 && totalAllotted > 0) lines.push('🚨 Credits exhausted!');
  }
  }); // end section 10-11

  await section('Sessions', async () => {
  // === 12. Upcoming & Live Sessions ===
  const sessionsRes = await q(
    `SELECT r.room_id, r.subject, r.room_name, r.scheduled_start,
            r.duration_minutes, r.status, r.teacher_email,
            pu.full_name AS teacher_name, b.batch_name
     FROM rooms r
     JOIN batches b ON b.batch_id = r.batch_id
     JOIN batch_students bs ON bs.batch_id = r.batch_id
     LEFT JOIN portal_users pu ON pu.email = r.teacher_email
     WHERE bs.student_email = $1
       AND r.scheduled_start >= NOW() - interval '2 hours'
       AND r.status IN ('scheduled', 'live')
     ORDER BY r.scheduled_start ASC
     LIMIT 10`,
    [email],
  );
  if (sessionsRes.rows.length > 0) {
    const live = sessionsRes.rows.filter(s => s.status === 'live');
    const upcoming = sessionsRes.rows.filter(s => s.status === 'scheduled');
    if (live.length > 0) {
      lines.push(`\n=== LIVE NOW (${live.length}) ===`);
      for (const s of live) {
        lines.push(`- ${s.subject} — ${s.batch_name} (Teacher: ${s.teacher_name || 'TBD'})`);
      }
    }
    if (upcoming.length > 0) {
      lines.push(`\n=== UPCOMING SESSIONS (${upcoming.length}) ===`);
      for (const s of upcoming) {
        const dt = new Date(s.scheduled_start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
        lines.push(`- ${s.subject} on ${dt} (${s.duration_minutes}min) — Teacher: ${s.teacher_name || 'TBD'}, Batch: ${s.batch_name}`);
      }
    }
  }
  }); // end section 12

  await section('Homework', async () => {
  // === 13. Homework ===
  const hwRes = await q(
    `SELECT h.id, h.title, h.subject, h.due_date, h.due_time, h.status,
            CASE WHEN hs.id IS NOT NULL THEN true ELSE false END AS submitted,
            hs.score AS hw_score, hs.grade AS hw_grade
     FROM homework h
     JOIN batch_students bs ON bs.batch_id = h.batch_id
     LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_email = $1
     WHERE bs.student_email = $1
     ORDER BY h.due_date DESC
     LIMIT 15`,
    [email],
  );
  if (hwRes.rows.length > 0) {
    const pending = hwRes.rows.filter(h => !h.submitted && h.status === 'active');
    const completed = hwRes.rows.filter(h => h.submitted);
    if (pending.length > 0) {
      lines.push(`\n=== PENDING HOMEWORK (${pending.length}) ===`);
      for (const hw of pending) {
        lines.push(`- ${hw.title} (${hw.subject}) — Due: ${hw.due_date}${hw.due_time ? ' ' + String(hw.due_time).slice(0, 5) : ''}`);
      }
    }
    if (completed.length > 0) {
      lines.push(`\n=== COMPLETED HOMEWORK (${completed.length}) ===`);
      for (const hw of completed) {
        const scoreStr = hw.hw_score != null ? `, Score: ${hw.hw_score}` : '';
        const gradeStr = hw.hw_grade ? ` [${hw.hw_grade}]` : '';
        lines.push(`- ${hw.title} (${hw.subject})${scoreStr}${gradeStr}`);
      }
    }
  }
  }); // end section 13

  await section('Recent Sessions Monitoring', async () => {
  // === 14. Recent Completed Sessions — Full AI Monitoring Breakdown ===
  const recentAtt = await q(
    `SELECT a.room_id, a.status, a.total_duration_sec, a.engagement_score,
            a.attention_avg, a.late_by_sec, a.join_count, a.mic_off_count,
            a.camera_off_count,
            r.subject, r.scheduled_start, r.room_name, r.duration_minutes,
            pu.full_name AS teacher_name
     FROM attendance_sessions a
     JOIN rooms r ON r.room_id = a.room_id
     LEFT JOIN portal_users pu ON pu.email = r.teacher_email
     WHERE a.participant_email = $1 AND a.participant_role = 'student'
     ORDER BY a.first_join_at DESC
     LIMIT 10`,
    [email],
  );
  if (recentAtt.rows.length > 0) {
    // Fetch per-session monitoring breakdown for all rooms at once
    const roomIds = recentAtt.rows.map(a => a.room_id);
    const perSessionMon = await q(
      `SELECT room_id, event_type,
              COUNT(*)::int AS count,
              ROUND(COALESCE(SUM(duration_seconds), 0)::numeric / 60, 1)::float AS total_minutes
       FROM class_monitoring_events
       WHERE student_email = $1 AND room_id = ANY($2)
       GROUP BY room_id, event_type`,
      [email, roomIds],
    );
    // Fetch per-session exam data (tab switches etc.)
    const perSessionExam = await q(
      `SELECT ser.room_id, ser.topic_title, ser.subject,
              ser.score, ser.total_marks, ser.percentage,
              ser.tab_switch_count, ser.auto_submitted, ser.answered, ser.total_questions
       FROM session_exam_results ser
       WHERE ser.student_email = $1 AND ser.room_id = ANY($2)`,
      [email, roomIds],
    );

    // Build lookup maps
    const monByRoom: Record<string, R[]> = {};
    for (const m of perSessionMon.rows) {
      if (!monByRoom[m.room_id]) monByRoom[m.room_id] = [];
      monByRoom[m.room_id].push(m);
    }
    const examByRoom: Record<string, R[]> = {};
    for (const e of perSessionExam.rows) {
      if (!examByRoom[e.room_id]) examByRoom[e.room_id] = [];
      examByRoom[e.room_id].push(e);
    }

    lines.push('\n=== RECENT COMPLETED SESSIONS — AI MONITORING BREAKDOWN (Last 10) ===');
    for (const a of recentAtt.rows) {
      const dt = new Date(String(a.scheduled_start)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
      const lateStr = Number(a.late_by_sec) > 0 ? ` | Late by ${Math.round(Number(a.late_by_sec) / 60)}min` : '';
      const teacher = a.teacher_name ? ` | Teacher: ${a.teacher_name}` : '';
      lines.push(`\n[${a.subject} — ${dt}${teacher}]`);
      lines.push(`  Status: ${a.status} | Time in class: ${Math.round(Number(a.total_duration_sec) / 60)}min of ${a.duration_minutes}min scheduled${lateStr}`);
      lines.push(`  Attention score: ${a.attention_avg || 'N/A'}/100 | Engagement: ${a.engagement_score || 'N/A'}/100 | Rejoins: ${a.join_count} | Mic-off count: ${a.mic_off_count || 0} | Camera-off count: ${a.camera_off_count || 0}`);

      // Per-session monitoring events
      const events = monByRoom[a.room_id] || [];
      if (events.length > 0) {
        // Sort by total_minutes descending, show all events
        const sorted = events.sort((x, y) => Number(y.total_minutes) - Number(x.total_minutes));
        const parts = sorted.map(e => `${String(e.event_type).replace(/_/g, ' ')}: ${e.count}x (${e.total_minutes}min)`);
        lines.push(`  AI Monitoring events: ${parts.join(' | ')}`);

        // Highlight the most concerning
        const tabSwitch = events.find(e => e.event_type === 'tab_switched');
        const notInFrame = events.find(e => e.event_type === 'not_in_frame');
        const lookingAway = events.find(e => e.event_type === 'looking_away');
        const eyesClosed = events.find(e => e.event_type === 'eyes_closed');
        const distracted = events.find(e => e.event_type === 'distracted');
        const phoneDet = events.find(e => e.event_type === 'phone_detected');
        const multiFace = events.find(e => e.event_type === 'multiple_faces');
        const yawning = events.find(e => e.event_type === 'yawning');
        const inactive = events.find(e => e.event_type === 'inactive');

        const flags: string[] = [];
        if (tabSwitch) flags.push(`Tab switched ${tabSwitch.count} times`);
        if (notInFrame && Number(notInFrame.total_minutes) > 1) flags.push(`Not in frame ${notInFrame.total_minutes}min`);
        if (lookingAway && Number(lookingAway.total_minutes) > 2) flags.push(`Looking away ${lookingAway.total_minutes}min`);
        if (eyesClosed && Number(eyesClosed.total_minutes) > 1) flags.push(`Eyes closed ${eyesClosed.total_minutes}min`);
        if (distracted && Number(distracted.total_minutes) > 2) flags.push(`Distracted ${distracted.total_minutes}min`);
        if (phoneDet) flags.push(`Phone detected ${phoneDet.count}x`);
        if (multiFace) flags.push(`Multiple faces ${multiFace.count}x`);
        if (yawning && Number(yawning.count) > 2) flags.push(`Yawning ${yawning.count}x`);
        if (inactive && Number(inactive.total_minutes) > 2) flags.push(`Inactive ${inactive.total_minutes}min`);
        if (flags.length > 0) lines.push(`  ⚠ Flags: ${flags.join(', ')}`);
      } else {
        lines.push(`  AI Monitoring events: No events recorded for this session`);
      }

      // Exam in this session
      const exams = examByRoom[a.room_id] || [];
      for (const e of exams) {
        lines.push(`  Exam: ${e.topic_title} — ${e.score}/${e.total_marks} (${e.percentage}%) | Answered: ${e.answered}/${e.total_questions} | Tab switches: ${e.tab_switch_count}${e.auto_submitted ? ' [AUTO-SUBMITTED]' : ''}`);
      }
    }
  }
  }); // end section 14

  await section('Weekly Trend', async () => {
  // === 15. Weekly Engagement Trend ===
  const trendRes = await q(
    `SELECT
       date_trunc('week', a.first_join_at)::date AS week_start,
       ROUND(AVG(a.attention_avg), 1) AS avg_attention,
       ROUND(AVG(a.engagement_score), 1) AS avg_engagement,
       COUNT(*)::int AS sessions_attended
     FROM attendance_sessions a
     WHERE a.participant_email = $1 AND a.participant_role = 'student'
       AND a.first_join_at >= $2
     GROUP BY week_start
     ORDER BY week_start DESC
     LIMIT 12`,
    [email, ninetyDaysAgo],
  );
  if (trendRes.rows.length > 0) {
    lines.push('\n=== WEEKLY ENGAGEMENT TREND ===');
    for (const t of trendRes.rows) {
      lines.push(`- Week of ${t.week_start}: ${t.sessions_attended} sessions, Attention: ${t.avg_attention}/100, Engagement: ${t.avg_engagement}/100`);
    }
  }
  }); // end section 15

  await section('Requests', async () => {
  // === 16. Session Requests (reschedule/cancel) ===
  const reqRes = await q(
    `SELECT request_type, status, reason, created_at
     FROM student_requests
     WHERE student_email = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [email],
  );
  if (reqRes.rows.length > 0) {
    lines.push('\n=== RECENT REQUESTS ===');
    for (const r of reqRes.rows) {
      lines.push(`- ${r.request_type}: ${r.status} — "${r.reason || 'N/A'}" (${new Date(r.created_at).toLocaleDateString('en-IN')})`);
    }
  }
  }); // end section 16

  lines.push(`\n--- Context generated at: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} ---`);
  return lines.join('\n');
}

// ── Parent: Build context with all children's data ──────────────
async function buildParentContext(parentEmail: string): Promise<string> {
  const lines: string[] = [];

  // Get parent info
  const parentRes = await q(
    `SELECT pu.full_name, pu.email, pu.phone,
            up.phone AS profile_phone, up.whatsapp
     FROM portal_users pu
     LEFT JOIN user_profiles up ON up.email = pu.email
     WHERE pu.email = $1`,
    [parentEmail],
  );
  const parent = parentRes.rows[0];
  if (parent) {
    lines.push('=== PARENT PROFILE ===');
    lines.push(`Name: ${parent.full_name || 'N/A'}`);
    lines.push(`Email: ${parent.email}`);
    if (parent.profile_phone || parent.phone) lines.push(`Phone: ${parent.profile_phone || parent.phone}`);
    if (parent.whatsapp) lines.push(`WhatsApp: ${parent.whatsapp}`);
  }

  // Get all children
  const childrenRes = await q(
    `SELECT DISTINCT bs.student_email, pu.full_name AS student_name,
            up.grade, up.section, up.board
     FROM batch_students bs
     LEFT JOIN portal_users pu ON pu.email = bs.student_email
     LEFT JOIN user_profiles up ON up.email = bs.student_email
     WHERE bs.parent_email = $1`,
    [parentEmail],
  );

  if (childrenRes.rows.length === 0) {
    lines.push('\nNo children linked to this parent account.');
    return lines.join('\n');
  }

  for (const child of childrenRes.rows) {
    lines.push(`\n${'='.repeat(50)}`);
    lines.push(`CHILD: ${child.student_name || child.student_email}`);
    if (child.grade) lines.push(`Grade: ${child.grade} ${child.section || ''} | Board: ${child.board || 'N/A'}`);

    // Attendance summary per child
    const attRes = await q(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('present','late'))::int AS present,
         ROUND(AVG(CASE WHEN status IN ('present','late') THEN 100.0 ELSE 0 END), 1) AS rate,
         ROUND(AVG(attention_avg), 1) AS avg_attention
       FROM attendance_sessions
       WHERE participant_email = $1 AND participant_role = 'student'`,
      [child.student_email],
    );
    const att = attRes.rows[0];
    if (att && att.total > 0) {
      lines.push(`Attendance: ${att.rate}% (${att.present}/${att.total}) | Avg Attention: ${att.avg_attention}/100`);
    }

    // Exam results per child
    const examRes = await q(
      `SELECT subject, COUNT(*)::int AS exams,
              ROUND(AVG(percentage), 1) AS avg_pct
       FROM session_exam_results
       WHERE student_email = $1
       GROUP BY subject`,
      [child.student_email],
    );
    if (examRes.rows.length > 0) {
      lines.push('Exam Averages:');
      for (const e of examRes.rows) {
        lines.push(`  ${e.subject}: ${e.avg_pct}% (${e.exams} exams)`);
      }
    }

    // AI monitoring alerts per child
    const alertRes = await q(
      `SELECT alert_type, COUNT(*)::int AS count
       FROM monitoring_alerts
       WHERE target_email = $1
         AND created_at >= NOW() - interval '30 days'
       GROUP BY alert_type
       ORDER BY count DESC
       LIMIT 5`,
      [child.student_email],
    );
    if (alertRes.rows.length > 0) {
      lines.push('Recent Alerts (30d):');
      for (const a of alertRes.rows) {
        lines.push(`  ${a.alert_type.replace(/_/g, ' ')}: ${a.count}`);
      }
    }

    // Pending fees per child
    const feesRes = await q(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_paise ELSE 0 END), 0)::bigint AS pending,
         COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue
       FROM invoices
       WHERE student_email = $1`,
      [child.student_email],
    );
    const f = feesRes.rows[0];
    if (f && (Number(f.pending) > 0 || f.overdue > 0)) {
      lines.push(`Pending Fees: ₹${(Number(f.pending) / 100).toLocaleString('en-IN')}${f.overdue > 0 ? ` (${f.overdue} overdue!)` : ''}`);
    }

    // Homework status per child
    const hwRes = await q(
      `SELECT
         COUNT(*) FILTER (WHERE hs.id IS NULL AND h.status = 'active')::int AS pending,
         COUNT(*) FILTER (WHERE hs.id IS NOT NULL)::int AS completed
       FROM homework h
       JOIN batch_students bs ON bs.batch_id = h.batch_id
       LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_email = $1
       WHERE bs.student_email = $1`,
      [child.student_email],
    );
    const hw = hwRes.rows[0];
    if (hw) {
      lines.push(`Homework: ${hw.completed} completed, ${hw.pending} pending`);
    }
  }

  lines.push(`\n--- Context generated at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} ---`);
  return lines.join('\n');
}
