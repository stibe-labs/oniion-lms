// ═══════════════════════════════════════════════════════════════
// stibe Portal — Post-Demo Session Summary & Notifications
// ═══════════════════════════════════════════════════════════════
// Collects all available data after a demo session ends and sends
// personalized summary emails + WhatsApp to teacher, AO, and student.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { sendEmail, logEmailQueued, logEmailSent, logEmailFailed } from '@/lib/email';
import { fireWhatsApp } from '@/lib/whatsapp';
import {
  demoSummaryTeacherTemplate,
  demoSummaryAOTemplate,
  demoSummaryStudentTemplate,
} from '@/lib/email-templates';
import { fmtDateTimeIST } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────

export interface DemoSummaryData {
  // Session info
  roomId: string;
  roomName: string;
  subject: string;
  grade: string;
  scheduledStart: string;       // ISO
  durationMinutes: number;
  endedAt: string;              // ISO
  outcome: string;              // 'completed' | 'completed_with_exam' | 'student_no_show' | 'cancelled_by_teacher'
  portions: string;

  // Participants
  teacherEmail: string;
  teacherName: string;
  studentEmail: string;
  studentName: string;
  studentPhone: string;
  aoEmail: string;

  // Attendance
  studentJoinedAt: string | null;
  studentLeftAt: string | null;
  studentDurationSec: number;
  studentLate: boolean;
  studentLateBySec: number;
  studentJoinCount: number;     // 1=normal, >1=had rejoins

  // AI Engagement (full session)
  attentionScore: number;       // 0-100
  attentiveMinutes: number;
  lookingAwayMinutes: number;
  eyesClosedMinutes: number;
  notInFrameMinutes: number;
  distractedMinutes: number;
  phoneDetectedMinutes: number;
  headTurnedMinutes: number;
  yawningMinutes: number;
  inactiveMinutes: number;
  tabSwitchedMinutes: number;
  totalMonitoringEvents: number;

  // Alerts fired during session
  alerts: { type: string; severity: string; message: string }[];

  // Exam results (null if no exam taken)
  exam: {
    totalQuestions: number;
    answered: number;
    skipped: number;
    score: number;
    totalMarks: number;
    percentage: number;
    gradeLetter: string;
    timeTakenSeconds: number;
    // Per-question breakdown
    questions: {
      questionText: string;
      correctAnswer: string;
      selectedOption: string;
      isCorrect: boolean;
      marks: number;
      topic?: string;
    }[];
  } | null;

  // Student feedback (null if not given)
  feedback: {
    rating: number;         // 1-5
    text: string;
    tags: string;
  } | null;
}

// ── Data Collector ──────────────────────────────────────────

/**
 * Compute effective student duration.
 * Prefers recorded total_duration_sec from attendance, but falls back to
 * first_join → ended_at (or go_live → ended_at) when attendance leave events
 * didn't fire before the summary was collected.
 */
function computeStudentDuration(
  totalDurationSec: number,
  firstJoinAt: string | null,
  endedAt: string | null,
  goLiveAt: string | null,
): number {
  if (totalDurationSec > 0) return totalDurationSec;
  // Fallback: compute from join time → room end time
  const start = firstJoinAt ? new Date(firstJoinAt).getTime()
               : goLiveAt   ? new Date(goLiveAt).getTime()
               : 0;
  const end = endedAt ? new Date(endedAt).getTime() : 0;
  if (start > 0 && end > start) return Math.floor((end - start) / 1000);
  return 0;
}

/**
 * Collect all available demo session data for the summary notification.
 * Should be called AFTER the room is marked as 'ended' and demo_requests is updated.
 */
export async function collectDemoSummary(roomId: string): Promise<DemoSummaryData | null> {
  try {
    // 1. Room + demo request info
    const roomResult = await db.query(
      `SELECT r.room_id, r.room_name, r.subject, r.grade, r.scheduled_start,
              r.duration_minutes, r.ended_at, r.go_live_at, r.teacher_email,
              d.student_email, d.student_name, d.student_phone,
              d.teacher_name, d.ao_email, d.outcome, d.portions,
              COALESCE(d.sample_portions, ARRAY[]::TEXT[]) AS sample_portions
       FROM rooms r
       JOIN demo_requests d ON d.room_id = r.room_id
       WHERE r.room_id = $1`,
      [roomId],
    );
    if (roomResult.rows.length === 0) return null;
    const r = roomResult.rows[0] as Record<string, unknown>;

    // Build portions string from both free text + sample portions
    const freePortions = (r.portions as string) || '';
    const samplePortions = (r.sample_portions as string[]) || [];
    const allPortions = [freePortions, ...samplePortions].filter(Boolean).join(', ');

    // 2. Attendance
    const attResult = await db.query(
      `SELECT first_join_at, last_leave_at, total_duration_sec, join_count,
              late_join, late_by_sec
       FROM attendance_sessions
       WHERE room_id = $1 AND participant_role = 'student'
       LIMIT 1`,
      [roomId],
    );
    const att = attResult.rows[0] as Record<string, unknown> | undefined;

    // 3. AI monitoring — FULL session (no time window)
    const monResult = await db.query<{
      total_events: string;
      attentive_sec: string;
      looking_away_sec: string;
      eyes_closed_sec: string;
      not_in_frame_sec: string;
      distracted_sec: string;
      phone_detected_sec: string;
      head_turned_sec: string;
      yawning_sec: string;
      inactive_sec: string;
      tab_switched_sec: string;
    }>(
      `SELECT
         COUNT(*)::TEXT AS total_events,
         COALESCE(SUM(CASE WHEN event_type = 'attentive' THEN duration_seconds ELSE 0 END), 0)::TEXT AS attentive_sec,
         COALESCE(SUM(CASE WHEN event_type = 'looking_away' THEN duration_seconds ELSE 0 END), 0)::TEXT AS looking_away_sec,
         COALESCE(SUM(CASE WHEN event_type = 'eyes_closed' THEN duration_seconds ELSE 0 END), 0)::TEXT AS eyes_closed_sec,
         COALESCE(SUM(CASE WHEN event_type = 'not_in_frame' THEN duration_seconds ELSE 0 END), 0)::TEXT AS not_in_frame_sec,
         COALESCE(SUM(CASE WHEN event_type = 'distracted' THEN duration_seconds ELSE 0 END), 0)::TEXT AS distracted_sec,
         COALESCE(SUM(CASE WHEN event_type = 'phone_detected' THEN duration_seconds ELSE 0 END), 0)::TEXT AS phone_detected_sec,
         COALESCE(SUM(CASE WHEN event_type = 'head_turned' THEN duration_seconds ELSE 0 END), 0)::TEXT AS head_turned_sec,
         COALESCE(SUM(CASE WHEN event_type = 'yawning' THEN duration_seconds ELSE 0 END), 0)::TEXT AS yawning_sec,
         COALESCE(SUM(CASE WHEN event_type = 'inactive' THEN duration_seconds ELSE 0 END), 0)::TEXT AS inactive_sec,
         COALESCE(SUM(CASE WHEN event_type = 'tab_switched' THEN duration_seconds ELSE 0 END), 0)::TEXT AS tab_switched_sec
       FROM class_monitoring_events
       WHERE room_id = $1`,
      [roomId],
    );
    const mon = monResult.rows[0];
    const attentiveSec = parseInt(mon?.attentive_sec || '0', 10);
    const lookingAwaySec = parseInt(mon?.looking_away_sec || '0', 10);
    const eyesClosedSec = parseInt(mon?.eyes_closed_sec || '0', 10);
    const notInFrameSec = parseInt(mon?.not_in_frame_sec || '0', 10);
    const distractedSec = parseInt(mon?.distracted_sec || '0', 10);
    const phoneDetectedSec = parseInt(mon?.phone_detected_sec || '0', 10);
    const headTurnedSec = parseInt(mon?.head_turned_sec || '0', 10);
    const yawningSec = parseInt(mon?.yawning_sec || '0', 10);
    const inactiveSec = parseInt(mon?.inactive_sec || '0', 10);
    const tabSwitchedSec = parseInt(mon?.tab_switched_sec || '0', 10);
    const totalMonitored = attentiveSec + lookingAwaySec + eyesClosedSec + notInFrameSec + distractedSec + headTurnedSec + yawningSec + inactiveSec + tabSwitchedSec;
    const attentionScore = totalMonitored > 0 ? Math.round((attentiveSec / totalMonitored) * 100) : 0;

    // 4. Alerts
    const alertsResult = await db.query(
      `SELECT alert_type, severity, message FROM monitoring_alerts
       WHERE room_id = $1 ORDER BY created_at`,
      [roomId],
    );
    const alerts = (alertsResult.rows as { alert_type: string; severity: string; message: string }[]).map(a => ({
      type: a.alert_type, severity: a.severity, message: a.message,
    }));

    // 5. Exam results
    const examResult = await db.query(
      `SELECT total_questions, answered, skipped, score, total_marks,
              percentage, grade_letter, time_taken_seconds, answers
       FROM demo_exam_results WHERE room_id = $1 LIMIT 1`,
      [roomId],
    );
    let exam: DemoSummaryData['exam'] = null;
    if (examResult.rows.length > 0) {
      const e = examResult.rows[0] as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawAnswers = (e.answers as any[]) || [];
      exam = {
        totalQuestions: (e.total_questions as number) || 0,
        answered: (e.answered as number) || 0,
        skipped: (e.skipped as number) || 0,
        score: (e.score as number) || 0,
        totalMarks: (e.total_marks as number) || 0,
        percentage: parseFloat(String(e.percentage || '0')),
        gradeLetter: (e.grade_letter as string) || 'N/A',
        timeTakenSeconds: (e.time_taken_seconds as number) || 0,
        questions: rawAnswers.map((q) => ({
          questionText: q.question_text || '',
          correctAnswer: q.correct_answer || '',
          selectedOption: q.selected_option || '',
          isCorrect: !!q.is_correct,
          marks: q.marks || 0,
          topic: q.topic || undefined,
        })),
      };
    }

    // 6. Student feedback
    const fbResult = await db.query(
      `SELECT rating, feedback_text, tags FROM student_feedback
       WHERE room_id = $1 LIMIT 1`,
      [roomId],
    );
    let feedback: DemoSummaryData['feedback'] = null;
    if (fbResult.rows.length > 0) {
      const f = fbResult.rows[0] as Record<string, unknown>;
      feedback = {
        rating: (f.rating as number) || 0,
        text: (f.feedback_text as string) || '',
        tags: (f.tags as string) || '',
      };
    }

    // Get teacher name from portal_users if not in demo_requests
    let teacherName = (r.teacher_name as string) || '';
    if (!teacherName) {
      const tResult = await db.query(
        `SELECT full_name FROM portal_users WHERE email = $1`,
        [(r.teacher_email as string)],
      );
      teacherName = (tResult.rows[0] as Record<string, unknown>)?.full_name as string || 'Teacher';
    }

    return {
      roomId,
      roomName: (r.room_name as string) || '',
      subject: (r.subject as string) || '',
      grade: (r.grade as string) || '',
      scheduledStart: (r.scheduled_start as string) || '',
      durationMinutes: (r.duration_minutes as number) || 30,
      endedAt: (r.ended_at as string) || new Date().toISOString(),
      outcome: (r.outcome as string) || 'completed',
      portions: allPortions,
      teacherEmail: (r.teacher_email as string) || '',
      teacherName,
      studentEmail: (r.student_email as string) || '',
      studentName: (r.student_name as string) || '',
      studentPhone: (r.student_phone as string) || '',
      aoEmail: (r.ao_email as string) || '',
      studentJoinedAt: (att?.first_join_at as string) || null,
      studentLeftAt: (att?.last_leave_at as string) || null,
      studentDurationSec: computeStudentDuration(
        (att?.total_duration_sec as number) || 0,
        att?.first_join_at as string | null,
        r.ended_at as string | null,
        r.go_live_at as string | null,
      ),
      studentLate: !!(att?.late_join),
      studentLateBySec: (att?.late_by_sec as number) || 0,
      studentJoinCount: (att?.join_count as number) || 0,
      attentionScore,
      attentiveMinutes: round1(attentiveSec / 60),
      lookingAwayMinutes: round1(lookingAwaySec / 60),
      eyesClosedMinutes: round1(eyesClosedSec / 60),
      notInFrameMinutes: round1(notInFrameSec / 60),
      distractedMinutes: round1(distractedSec / 60),
      phoneDetectedMinutes: round1(phoneDetectedSec / 60),
      headTurnedMinutes: round1(headTurnedSec / 60),
      yawningMinutes: round1(yawningSec / 60),
      inactiveMinutes: round1(inactiveSec / 60),
      tabSwitchedMinutes: round1(tabSwitchedSec / 60),
      totalMonitoringEvents: parseInt(mon?.total_events || '0', 10),
      alerts,
      exam,
      feedback,
    };
  } catch (err) {
    console.error('[demo-summary] Failed to collect data for', roomId, err);
    return null;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── Send helper ─────────────────────────────────────────────

async function sendAndLog(
  roomId: string,
  recipientEmail: string,
  templateType: string,
  content: { subject: string; html: string; text: string },
  recipientPhone?: string,
): Promise<boolean> {
  try {
    const logId = await logEmailQueued(roomId, recipientEmail, templateType, content.subject);
    const result = await sendEmail({
      to: recipientEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
      priority: 'normal',
      recipientPhone,
    });
    if (result.success) {
      await logEmailSent(logId, result.messageId);
      return true;
    } else {
      await logEmailFailed(logId, result.error || 'Unknown');
      return false;
    }
  } catch (err) {
    console.error(`[demo-summary] Failed to send ${templateType} to ${recipientEmail}:`, err);
    return false;
  }
}

// ── Main notification sender ────────────────────────────────

/**
 * Send post-demo summary notifications to teacher, AO, and student.
 * Fire-and-forget — caller should not await this (or catch errors).
 * @param delayMs - optional delay before collecting data (allows DB writes to settle)
 */
export async function sendDemoSummaryNotifications(roomId: string, delayMs = 0): Promise<void> {
  if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

  const data = await collectDemoSummary(roomId);
  if (!data) {
    console.warn('[demo-summary] No data found for', roomId);
    return;
  }

  // Skip if notifications were already sent (check email_log)
  try {
    const alreadySent = await db.query(
      `SELECT 1 FROM email_log WHERE room_id = $1 AND template_type LIKE 'demo_summary_%' AND status = 'sent' LIMIT 1`,
      [roomId],
    );
    if (alreadySent.rows.length > 0) {
      console.log(`[demo-summary] Notifications already sent for ${roomId}, skipping`);
      return;
    }
  } catch { /* email_log table may not exist, continue */ }

  const scheduledStr = fmtDateTimeIST(data.scheduledStart);
  const endedStr = fmtDateTimeIST(data.endedAt);
  const durationStr = formatDuration(data.studentDurationSec);
  const outcomeLabel = OUTCOME_LABELS[data.outcome] || data.outcome;

  const shared = { ...data, scheduledStr, endedStr, durationStr, outcomeLabel };

  // 1. Teacher email
  if (data.teacherEmail) {
    const content = demoSummaryTeacherTemplate({ ...shared, recipientEmail: data.teacherEmail });
    await sendAndLog(roomId, data.teacherEmail, 'demo_summary_teacher', content);
  }

  // 2. AO email
  if (data.aoEmail) {
    const content = demoSummaryAOTemplate({ ...shared, recipientEmail: data.aoEmail });
    await sendAndLog(roomId, data.aoEmail, 'demo_summary_ao', content);
  }

  // 3. Student email (use recipientPhone for WA mirroring)
  if (data.studentEmail) {
    const content = demoSummaryStudentTemplate({ ...shared, recipientEmail: data.studentEmail });
    await sendAndLog(roomId, data.studentEmail, 'demo_summary_student', content, data.studentPhone);
  }

  // 4. WhatsApp thank-you message to student (separate from email mirror)
  if (data.studentPhone && data.outcome !== 'student_no_show') {
    try {
      const examLine = data.exam
        ? `\nYour exam score: ${data.exam.score}/${data.exam.totalMarks} (${data.exam.percentage}%)`
        : '';
      const thankYouMsg = `🎓 *Thank You, ${data.studentName}!*\n\nThank you for attending the demo session on *${data.subject}* (Grade ${data.grade}) with ${data.teacherName}.${examLine}\n\nWe hope you had a great experience! If you're interested in continuing your learning journey with stibe, our team will reach out with enrollment details shortly.\n\nFeel free to reply to this message if you have any questions.\n\n— stibe Classes`;
      await fireWhatsApp(
        data.studentEmail || `wa_demo_thankyou_${roomId}`,
        thankYouMsg,
        undefined,
        'stibe_alert',
        [data.studentName, `Thank you for attending the ${data.subject} demo! Our team will contact you about enrollment options.`],
        data.studentPhone,
      );
    } catch (waErr) {
      console.warn('[demo-summary] WhatsApp thank-you error:', waErr);
    }
  }

  console.log(`[demo-summary] Notifications sent for ${roomId} — outcome: ${data.outcome}`);
}

// ── Helpers ─────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 min';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

const OUTCOME_LABELS: Record<string, string> = {
  completed: 'Completed',
  completed_with_exam: 'Completed with Exam',
  student_no_show: 'Student No-Show',
  cancelled_by_teacher: 'Cancelled by Teacher',
  time_expired: 'Time Expired',
};
