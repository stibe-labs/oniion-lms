// ═══════════════════════════════════════════════════════════════
// Report Card — GET /api/v1/exams/[id]/report-card
// Generates a printable HTML report card for a student's exam
// Print from browser as PDF (Ctrl+P → Save as PDF)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getLogoDataUri } from '@/lib/pdf-logo';
import { getPlatformName } from '@/lib/platform-config';

function dt(d: string | null | unknown) {
  return d ? new Date(String(d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id: examId } = await ctx.params;
    const studentEmail = new URL(req.url).searchParams.get('student') || user.id;

    // Students can only view their own report card
    if (user.role === 'student' && studentEmail !== user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Fetch exam
    const examResult = await db.query(
      `SELECT id, title, subject, grade, total_marks, passing_marks,
              scheduled_at, results_published, duration_minutes
       FROM exams WHERE id = $1`,
      [examId],
    );
    if (examResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
    }
    const exam = examResult.rows[0] as Record<string, unknown>;

    // Fetch attempt
    const attemptResult = await db.query(
      `SELECT ea.*, pu.full_name AS student_name
       FROM exam_attempts ea
       LEFT JOIN portal_users pu ON pu.email = ea.student_email
       WHERE ea.exam_id = $1 AND ea.student_email = $2
       ORDER BY ea.created_at DESC LIMIT 1`,
      [examId, studentEmail],
    );
    if (attemptResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No attempt found for this student' }, { status: 404 });
    }
    const attempt = attemptResult.rows[0] as Record<string, unknown>;

    // Fetch answers with question details
    const answersResult = await db.query(
      `SELECT ea.*, eq.question_text, eq.question_type, eq.marks, eq.options, eq.correct_answer, eq.topic
       FROM exam_answers ea
       JOIN exam_questions eq ON eq.id = ea.question_id
       WHERE ea.attempt_id = $1
       ORDER BY eq.sort_order ASC, eq.created_at ASC`,
      [attempt.id],
    );
    const answers = answersResult.rows as Array<Record<string, unknown>>;

    // Compute rank (position among all attempts for this exam)
    const rankResult = await db.query(
      `SELECT student_email, percentage
       FROM exam_attempts
       WHERE exam_id = $1 AND status = 'graded'
       ORDER BY percentage DESC NULLS LAST`,
      [examId],
    );
    const allAttempts = rankResult.rows as Array<Record<string, unknown>>;
    const rank = allAttempts.findIndex(a => a.student_email === studentEmail) + 1;
    const totalStudents = allAttempts.length;

    const logo = await getLogoDataUri();
    const platformName = await getPlatformName();
    const html = generateReportCardHTML({
      exam, attempt, answers, rank, totalStudents, logo, platformName,
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('[report-card] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function generateReportCardHTML({
  exam, attempt, answers, rank, totalStudents, logo, platformName,
}: {
  exam: Record<string, unknown>;
  attempt: Record<string, unknown>;
  answers: Array<Record<string, unknown>>;
  rank: number;
  totalStudents: number;
  logo: string;
  platformName: string;
}) {
  const studentName = esc(String(attempt.student_name || attempt.student_email || ''));
  const examTitle = esc(String(exam.title || ''));
  const subject = esc(String(exam.subject || ''));
  const grade = esc(String(exam.grade || ''));
  const score = Number(attempt.score || 0);
  const totalMarks = Number(attempt.total_marks || exam.total_marks || 0);
  const percentage = Number(attempt.percentage || 0);
  const passingMarks = Number(exam.passing_marks || 0);
  const passed = score >= passingMarks;
  const gradeLetter = String(attempt.grade_letter || getGrade(percentage));

  // Question-wise breakdown
  const questionRows = answers.map((a, i) => {
    const qText = esc(String(a.question_text || '').substring(0, 120));
    const qType = String(a.question_type || 'mcq');
    const marks = Number(a.marks || 0);
    const awarded = Number(a.marks_awarded || 0);
    const isCorrect = a.is_correct === true;
    const topic = a.topic ? esc(String(a.topic)) : '';

    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6b7280;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#1f2937;max-width:300px;">${qText}${topic ? `<br/><span style="color:#9ca3af;font-size:10px;">${topic}</span>` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6b7280;text-transform:uppercase;">${qType}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;text-align:center;">${marks}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;text-align:center;font-weight:600;color:${isCorrect ? '#059669' : '#dc2626'};">${awarded}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
        <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${isCorrect ? '#d1fae5' : '#fee2e2'};color:${isCorrect ? '#059669' : '#dc2626'};font-size:12px;line-height:20px;text-align:center;">${isCorrect ? '&#10004;' : '&#10008;'}</span>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Report Card — ${examTitle} — ${studentName}</title>
<style>
  @media print { body { margin: 0; } .no-print { display: none !important; } }
  body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #1f2937; }
  .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); overflow: hidden; }
  .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 24px 32px; }
  .header img { height: 48px; margin-bottom: 12px; }
  .header h1 { font-size: 22px; margin: 0 0 4px 0; }
  .header p { font-size: 13px; opacity: .85; margin: 0; }
  .student-info { padding: 20px 32px; border-bottom: 1px solid #e5e7eb; display: flex; flex-wrap: wrap; gap: 24px; }
  .student-info .field { flex: 1; min-width: 140px; }
  .student-info .label { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: .5px; margin-bottom: 2px; }
  .student-info .value { font-size: 14px; font-weight: 600; color: #1f2937; }
  .summary { padding: 24px 32px; display: flex; gap: 16px; flex-wrap: wrap; }
  .summary-card { flex: 1; min-width: 120px; background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #e5e7eb; }
  .summary-card .num { font-size: 28px; font-weight: 700; }
  .summary-card .lbl { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .result-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-top: 4px; }
  .pass { background: #d1fae5; color: #059669; }
  .fail { background: #fee2e2; color: #dc2626; }
  .questions { padding: 0 32px 24px; }
  .questions h3 { font-size: 14px; margin-bottom: 12px; color: #374151; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #9ca3af; border-bottom: 2px solid #e5e7eb; letter-spacing: .3px; }
  .footer { padding: 16px 32px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  .print-btn { position: fixed; bottom: 20px; right: 20px; background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .print-btn:hover { background: #047857; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    ${logo ? `<img src="${logo}" alt="Logo" />` : `<p style="font-size:24px;font-weight:800;">${platformName}</p>`}
    <h1>Exam Report Card</h1>
    <p>${examTitle} — ${subject} — Grade ${grade}</p>
  </div>

  <div class="student-info">
    <div class="field"><div class="label">Student Name</div><div class="value">${studentName}</div></div>
    <div class="field"><div class="label">Email</div><div class="value">${esc(String(attempt.student_email || ''))}</div></div>
    <div class="field"><div class="label">Exam Date</div><div class="value">${dt(exam.scheduled_at)}</div></div>
    <div class="field"><div class="label">Duration</div><div class="value">${exam.duration_minutes} min</div></div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="num" style="color:#059669;">${score}<span style="font-size:16px;color:#9ca3af;">/${totalMarks}</span></div>
      <div class="lbl">Score</div>
    </div>
    <div class="summary-card">
      <div class="num" style="color:${percentage >= 75 ? '#059669' : percentage >= 50 ? '#d97706' : '#dc2626'};">${percentage.toFixed(1)}%</div>
      <div class="lbl">Percentage</div>
    </div>
    <div class="summary-card">
      <div class="num" style="color:#7c3aed;">${gradeLetter}</div>
      <div class="lbl">Grade</div>
    </div>
    <div class="summary-card">
      <div class="num" style="color:#2563eb;">${rank}<span style="font-size:14px;color:#9ca3af;">/${totalStudents}</span></div>
      <div class="lbl">Rank</div>
    </div>
    <div class="summary-card">
      <span class="result-badge ${passed ? 'pass' : 'fail'}">${passed ? 'PASSED' : 'FAILED'}</span>
      <div class="lbl" style="margin-top:8px;">Pass: ${passingMarks}/${totalMarks}</div>
    </div>
  </div>

  ${answers.length > 0 ? `
  <div class="questions">
    <h3>Question-wise Breakdown</h3>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Question</th>
          <th>Type</th>
          <th style="text-align:center;">Max</th>
          <th style="text-align:center;">Scored</th>
          <th style="text-align:center;">Result</th>
        </tr>
      </thead>
      <tbody>${questionRows}</tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    Generated by ${platformName} Learning Platform &middot; ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
    &middot; This is a computer-generated document
  </div>
</div>

<button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
</body>
</html>`;
}

function getGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}
