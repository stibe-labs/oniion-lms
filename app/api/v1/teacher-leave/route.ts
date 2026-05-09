// ═══════════════════════════════════════════════════════════════
// Teacher Leave Requests API — /api/v1/teacher-leave
//
// NEW WORKFLOW (Phase 24):
//   Teacher submits → AO reviews (resolves sessions) → HR approves plan → AO confirms
//
// Statuses: pending_ao → pending_hr → approved → confirmed | rejected | withdrawn
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendEmail } from '@/lib/email';
import { createLiveKitToken, ensureRoom } from '@/lib/livekit';
import {
  leaveRequestSubmittedTemplate,
  leaveRequestApprovedTemplate,
  leaveRequestRejectedTemplate,
  sessionCancelledNotifyTemplate,
  sessionRescheduledNotifyTemplate,
  sessionSubstituteNotifyTemplate,
  leaveHRApprovedTemplate,
  leaveAOActionRequiredTemplate,
} from '@/lib/email-templates';

interface LeaveRequest {
  id: string;
  teacher_email: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  requester_role: string;
  sessions_managed: boolean;
  ao_status: string;
  ao_reviewed_by: string | null;
  ao_reviewed_at: string | null;
  ao_notes: string | null;
  hr_status: string;
  hr_reviewed_by: string | null;
  hr_reviewed_at: string | null;
  hr_notes: string | null;
  affected_sessions: string[];
  resolution_plan: ResolutionItem[];
  ai_suggestions: unknown;
  forwarded_at: string | null;
  confirmed_at: string | null;
  substitute_teacher: string | null;
  medical_certificate_url: string | null;
  medical_certificate_name: string | null;
  salary_adjustment: 'full_pay' | 'half_pay' | 'no_pay' | null;
  created_at: string;
  updated_at: string;
  teacher_name?: string;
  [key: string]: unknown;
}

interface ResolutionItem {
  session_id: string;
  action: 'substitute' | 'reschedule' | 'cancel';
  substitute_email?: string;
  substitute_name?: string;
  new_date?: string;
  new_time?: string;
  notes?: string;
  subject_override?: string;
  original_subject?: string;
}

const ok = (data: unknown) => NextResponse.json({ success: true, data });
const err = (msg: string, status = 400) => NextResponse.json({ success: false, error: msg }, { status });

/* ════════════════════════════════════════════════════════════
   GET: List leave requests / fetch single leave details
   ════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const role = String(user.role);
  const email = String(user.id);
  const url = new URL(req.url);

  // ── Fetch single leave details (with sessions, actions, AI) ──
  const leaveId = url.searchParams.get('leave_id');
  if (leaveId) {
    const { rows: leave } = await db.query<LeaveRequest>(
      `SELECT * FROM teacher_leave_requests WHERE id = $1`, [leaveId]
    );
    if (leave.length === 0) return err('Not found', 404);
    const lr = leave[0];

    // Fetch affected sessions (include grade, board, duration from batch)
    const sessionIds = lr.affected_sessions || [];
    let sessions: Array<{ session_id: string; batch_id: string; subject: string; scheduled_date: string; start_time: string; batch_name: string; teacher_name: string; status: string; grade: string | null; board: string | null; duration_minutes: number; [key: string]: unknown }> = [];
    if (sessionIds.length > 0) {
      const { rows } = await db.query<typeof sessions[0]>(
        `SELECT bs.session_id, bs.batch_id, bs.subject, bs.scheduled_date, bs.start_time,
                bs.status, bs.teacher_email, bs.teacher_name, bs.duration_minutes,
                b.batch_name, b.grade, b.board
         FROM batch_sessions bs
         LEFT JOIN batches b ON b.batch_id = bs.batch_id
         WHERE bs.session_id = ANY($1::text[])
         ORDER BY bs.scheduled_date, bs.start_time`,
        [sessionIds]
      );
      sessions = rows;
    }

    // Fetch leave_session_actions (executed actions)
    const { rows: actions } = await db.query(
      `SELECT lsa.*, pu.full_name AS acted_by_name
       FROM leave_session_actions lsa
       LEFT JOIN portal_users pu ON pu.email = lsa.acted_by
       WHERE lsa.leave_request_id = $1`,
      [leaveId]
    );

    // Available substitute teachers (include subjects for subject dropdown in AO UI)
    const { rows: teachers } = await db.query<{ email: string; full_name: string; subjects: string[] }>(
      `SELECT DISTINCT pu.email, pu.full_name, COALESCE(up.subjects, '{}') AS subjects
       FROM portal_users pu
       LEFT JOIN user_profiles up ON up.email = pu.email
       WHERE pu.portal_role = 'teacher' AND pu.is_active = TRUE AND pu.email != $1
       ORDER BY pu.full_name`,
      [lr.teacher_email]
    );

    // ── AI suggestions: find free teachers per session (subject-aware) ──
    const aiSuggestions: Record<string, {
      freeTeachers: { email: string; name: string; inBatch: boolean; sameSubject: boolean; subjects: string[] }[];
      recommendation: string;
      sameSubjectCount: number;
      sessionSubject: string;
    }> = {};
    if (sessions.length > 0 && lr.status === 'pending_ao') {
      for (const sess of sessions) {
        // Find teachers NOT scheduled at this date+time, include their subjects
        const { rows: free } = await db.query<{ email: string; full_name: string; subjects: string[] | null }>(
          `SELECT DISTINCT pu.email, pu.full_name, up.subjects
           FROM portal_users pu
           LEFT JOIN user_profiles up ON up.email = pu.email
           WHERE pu.portal_role = 'teacher' AND pu.is_active = TRUE AND pu.email != $1
             AND pu.email NOT IN (
               SELECT bs2.teacher_email FROM batch_sessions bs2
               WHERE bs2.scheduled_date = $2 AND bs2.start_time = $3
                 AND bs2.status IN ('scheduled', 'prep', 'live')
             )
           ORDER BY pu.full_name`,
          [lr.teacher_email, sess.scheduled_date, sess.start_time]
        );

        // Teachers assigned to this batch (with their subject in the batch)
        const { rows: batchTeachers } = await db.query<{ teacher_email: string; subject: string }>(
          `SELECT teacher_email, subject FROM batch_teachers WHERE batch_id = $1`, [sess.batch_id]
        );
        const batchTeacherSet = new Set(batchTeachers.map(t => t.teacher_email));

        // Also find teachers who teach this subject in ANY batch
        const { rows: subjectTeachers } = await db.query<{ teacher_email: string }>(
          `SELECT DISTINCT teacher_email FROM batch_teachers WHERE LOWER(subject) = LOWER($1)`,
          [sess.subject]
        );
        const subjectTeacherSet = new Set(subjectTeachers.map(t => t.teacher_email));

        const sessionSubjectLower = (sess.subject || '').toLowerCase();
        const freeTeachers = free.map(t => {
          const profileSubjects = (t.subjects || []).map(s => s.toLowerCase());
          const teachesSubjectInBatch = subjectTeacherSet.has(t.email);
          const teachesSubjectInProfile = profileSubjects.includes(sessionSubjectLower);
          return {
            email: t.email,
            name: t.full_name,
            inBatch: batchTeacherSet.has(t.email),
            sameSubject: teachesSubjectInBatch || teachesSubjectInProfile,
            subjects: t.subjects || [],
          };
        });

        // Sort: same-subject + in-batch first, then same-subject, then in-batch, then others
        freeTeachers.sort((a, b) => {
          const scoreA = (a.sameSubject ? 2 : 0) + (a.inBatch ? 1 : 0);
          const scoreB = (b.sameSubject ? 2 : 0) + (b.inBatch ? 1 : 0);
          return scoreB - scoreA;
        });

        const sameSubjectCount = freeTeachers.filter(t => t.sameSubject).length;
        let recommendation: string;
        if (freeTeachers.length > 0 && freeTeachers[0].sameSubject && freeTeachers[0].inBatch) {
          recommendation = `Best: ${freeTeachers[0].name} teaches ${sess.subject} in this batch`;
        } else if (freeTeachers.length > 0 && freeTeachers[0].sameSubject) {
          recommendation = `${freeTeachers[0].name} teaches ${sess.subject} (not in this batch)`;
        } else if (freeTeachers.length > 0) {
          recommendation = `No ${sess.subject} teacher free — ${freeTeachers[0].name} available (teaches ${freeTeachers[0].subjects.join(', ') || 'unspecified'}). Consider rescheduling or assigning a different subject.`;
        } else {
          recommendation = `No free teachers at this time — recommend rescheduling or cancelling`;
        }

        aiSuggestions[sess.session_id] = { freeTeachers, recommendation, sameSubjectCount, sessionSubject: sess.subject };
      }
    }

    return ok({
      leave: lr,
      affectedSessions: sessions,
      actions,
      availableTeachers: teachers,
      aiSuggestions,
    });
  }

  // ── List leave requests ──
  let query: string;
  let params: unknown[];

  if (role === 'teacher' || role === 'batch_coordinator') {
    query = `SELECT * FROM teacher_leave_requests WHERE teacher_email = $1 ORDER BY created_at DESC`;
    params = [email];
  } else if (role === 'academic_operator') {
    query = `SELECT lr.*, pu.full_name AS teacher_name
             FROM teacher_leave_requests lr
             LEFT JOIN portal_users pu ON pu.email = lr.teacher_email
             WHERE lr.teacher_email IN (
               SELECT DISTINCT bt.teacher_email FROM batch_teachers bt
               JOIN batches b ON b.batch_id = bt.batch_id WHERE b.academic_operator_email = $1
             )
             OR lr.teacher_email IN (
               SELECT DISTINCT b.coordinator_email FROM batches b
               WHERE b.academic_operator_email = $1 AND b.coordinator_email IS NOT NULL
             )
             ORDER BY lr.created_at DESC`;
    params = [email];
  } else if (['hr', 'owner'].includes(role)) {
    query = `SELECT lr.*, pu.full_name AS teacher_name
             FROM teacher_leave_requests lr
             LEFT JOIN portal_users pu ON pu.email = lr.teacher_email
             ORDER BY lr.created_at DESC LIMIT 200`;
    params = [];
  } else {
    return err('Access denied', 403);
  }

  const { rows } = await db.query<LeaveRequest>(query, params);

  const counts = { pending_ao: 0, pending_hr: 0, approved: 0, confirmed: 0, rejected: 0, total: rows.length };
  for (const r of rows) {
    if (r.status === 'pending_ao') counts.pending_ao++;
    else if (r.status === 'pending_hr') counts.pending_hr++;
    else if (r.status === 'approved') counts.approved++;
    else if (r.status === 'confirmed') counts.confirmed++;
    else if (r.status === 'rejected') counts.rejected++;
  }

  return ok({ requests: rows, counts });
}

/* ════════════════════════════════════════════════════════════
   POST: Submit / AO actions / HR actions / Withdraw
   ════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const role = String(user.role);
  const email = String(user.id);
  const body = await req.json();

  // ═══════════════════════════════════════════════════════════
  // ACTION: ao_forward — AO forwards leave + resolution plan to HR
  // ═══════════════════════════════════════════════════════════
  if (body.action === 'ao_forward') {
    if (role !== 'academic_operator') return err('Only AO can forward', 403);
    const reqId = body.request_id;
    if (!reqId) return err('request_id required');

    const { rows } = await db.query<LeaveRequest>(
      `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
       LEFT JOIN portal_users pu ON pu.email = lr.teacher_email WHERE lr.id = $1`, [reqId]
    );
    if (!rows.length) return err('Not found', 404);
    const leave = rows[0];
    if (leave.status !== 'pending_ao') return err('Can only forward pending_ao requests');

    const plan: ResolutionItem[] = body.resolution_plan || [];
    const affectedIds = leave.affected_sessions || [];

    // If sessions affected, plan must cover all of them
    if (affectedIds.length > 0) {
      const plannedIds = new Set(plan.map((p: ResolutionItem) => p.session_id));
      const missing = affectedIds.filter(id => !plannedIds.has(id));
      if (missing.length > 0) return err(`Resolution plan missing for ${missing.length} session(s)`);

      // Enrich plan items with original_subject from session data
      const { rows: sessSrc } = await db.query<{ session_id: string; subject: string }>(
        `SELECT session_id, subject FROM batch_sessions WHERE session_id = ANY($1::text[])`,
        [affectedIds]
      );
      const sessMap = new Map(sessSrc.map(s => [s.session_id, s.subject]));
      for (const item of plan) {
        if (!item.original_subject) item.original_subject = sessMap.get(item.session_id) || undefined;
        // Clear subject_override if same as original
        if (item.subject_override && item.subject_override === item.original_subject) {
          item.subject_override = undefined;
        }
      }
    }

    await db.query(
      `UPDATE teacher_leave_requests SET
         status = 'pending_hr', ao_status = 'approved',
         ao_reviewed_by = $2, ao_reviewed_at = NOW(), ao_notes = $3,
         resolution_plan = $4, forwarded_at = NOW()
       WHERE id = $1`,
      [reqId, email, body.notes || null, JSON.stringify(plan)]
    );

    // Fire notifications in background — don't block the response
    void (async () => {
      // Notify HR
      try {
        const { rows: hrUsers } = await db.query<{ email: string; full_name: string }>(
          `SELECT email, full_name FROM portal_users WHERE portal_role = 'hr' AND is_active = TRUE LIMIT 5`
        );
        for (const hr of hrUsers) {
          try {
            const tmpl = leaveAOActionRequiredTemplate({
              aoName: hr.full_name || 'HR',
              teacherName: leave.teacher_name || leave.teacher_email,
              leaveType: leave.leave_type,
              startDate: leave.start_date,
              endDate: leave.end_date,
              reason: leave.reason,
              affectedSessions: affectedIds.length,
            });
            await sendEmail({
              to: hr.email,
              subject: `📋 Leave Review Required — ${leave.teacher_name || leave.teacher_email} (AO Forwarded)`,
              html: tmpl.html, text: tmpl.text,
              waTemplate: 'stibe_leave_req',
              waParams: [hr.full_name || 'HR', leave.teacher_name || leave.teacher_email, `${leave.start_date} to ${leave.end_date}`, `AO forwarded — ${affectedIds.length} sessions`],
            });
          } catch (e) { console.error('HR notify failed:', e); }
        }
      } catch (e) { console.error('HR notify lookup failed:', e); }

      // Notify teacher: AO reviewed, pending HR
      try {
        await sendEmail({
          to: leave.teacher_email,
          subject: `📋 Leave Update — AO Reviewed, Pending HR (${leave.start_date} to ${leave.end_date})`,
          html: `<p>Hi ${leave.teacher_name || leave.teacher_email}, your leave request has been reviewed by the Academic Operator and forwarded to HR for final approval.</p>`,
          text: `Your leave request has been reviewed by AO and forwarded to HR.`,
          waTemplate: 'stibe_leave_update',
          waParams: [leave.teacher_name || leave.teacher_email, `${leave.start_date} to ${leave.end_date}`, 'AO Reviewed — Pending HR', ''],
        });
      } catch (e) { console.error('Teacher notify failed:', e); }
    })();

    return ok({ status: 'pending_hr', plan });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: ao_reject — AO rejects leave
  // ═══════════════════════════════════════════════════════════
  if (body.action === 'ao_reject') {
    if (role !== 'academic_operator') return err('Only AO can reject at this stage', 403);
    const reqId = body.request_id;
    if (!reqId) return err('request_id required');

    const { rows } = await db.query<LeaveRequest>(
      `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
       LEFT JOIN portal_users pu ON pu.email = lr.teacher_email WHERE lr.id = $1`, [reqId]
    );
    if (!rows.length) return err('Not found', 404);
    const leave = rows[0];
    if (leave.status !== 'pending_ao') return err('Can only reject pending_ao requests');

    await db.query(
      `UPDATE teacher_leave_requests SET
         status = 'rejected', ao_status = 'rejected',
         ao_reviewed_by = $2, ao_reviewed_at = NOW(), ao_notes = $3
       WHERE id = $1`,
      [reqId, email, body.notes || null]
    );

    try {
      const tmpl = leaveRequestRejectedTemplate({
        teacherName: leave.teacher_name || leave.teacher_email,
        leaveType: leave.leave_type,
        startDate: leave.start_date, endDate: leave.end_date,
        rejectedBy: user.name || email,
        rejectedByRole: 'Academic Operator',
        reason: body.notes || 'No reason provided',
      });
      await sendEmail({
        to: leave.teacher_email, ...tmpl,
        waTemplate: 'stibe_leave_update',
        waParams: [leave.teacher_name || leave.teacher_email, `${leave.start_date} to ${leave.end_date}`, 'Rejected by AO', body.notes || ''],
      });
    } catch (e) { console.error('Reject notify failed:', e); }

    return ok({ status: 'rejected' });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: hr_approve — HR approves leave + AO's plan
  // ═══════════════════════════════════════════════════════════
  if (body.action === 'hr_approve') {
    if (role !== 'hr') return err('Only HR can approve at this stage', 403);
    const reqId = body.request_id;
    if (!reqId) return err('request_id required');

    const { rows } = await db.query<LeaveRequest>(
      `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
       LEFT JOIN portal_users pu ON pu.email = lr.teacher_email WHERE lr.id = $1`, [reqId]
    );
    if (!rows.length) return err('Not found', 404);
    const leave = rows[0];
    if (leave.status !== 'pending_hr') return err('Can only approve pending_hr requests');

    const affectedIds = leave.affected_sessions || [];
    const hasSessionsToManage = affectedIds.length > 0;
    const plan: ResolutionItem[] = (leave.resolution_plan || []) as ResolutionItem[];

    // Validate salary_adjustment if provided
    const salaryAdj = body.salary_adjustment || null;
    if (salaryAdj && !['full_pay', 'half_pay', 'no_pay'].includes(salaryAdj)) {
      return err('salary_adjustment must be full_pay, half_pay, or no_pay');
    }

    // Commit the approval to DB immediately — this is what the UI polls
    await db.query(
      `UPDATE teacher_leave_requests SET
         status = 'confirmed', hr_status = 'approved',
         hr_reviewed_by = $2, hr_reviewed_at = NOW(), hr_notes = $3,
         sessions_managed = TRUE, confirmed_at = NOW(),
         salary_adjustment = COALESCE($4, salary_adjustment)
       WHERE id = $1`,
      [reqId, email, body.notes || null, salaryAdj]
    );

    // Fire session plan execution + all notifications in background — don't block the response
    void (async () => {
      // Execute resolution plan (each call does DB updates + background notifications internally)
      if (hasSessionsToManage && plan.length > 0) {
        for (const item of plan) {
          try {
            await executeSessionAction(leave, item, email, user.name || email);
          } catch (e) { console.error(`Plan exec failed for ${item.session_id}:`, e); }
        }
      }

      // Notify teacher — leave confirmed
      try {
        const tmpl = leaveRequestApprovedTemplate({
          teacherName: leave.teacher_name || leave.teacher_email,
          leaveType: leave.leave_type,
          startDate: leave.start_date, endDate: leave.end_date,
          affectedSessions: affectedIds.length,
        });
        await sendEmail({
          to: leave.teacher_email,
          subject: `✅ Leave Confirmed — ${leave.start_date} to ${leave.end_date}`,
          html: tmpl.html, text: `Your leave is confirmed. All affected sessions have been managed.`,
          waTemplate: 'stibe_leave_update',
          waParams: [leave.teacher_name || leave.teacher_email, `${leave.start_date} to ${leave.end_date}`,
            'Confirmed', `${affectedIds.length} sessions managed`],
        });
      } catch (e) { console.error('Teacher notify failed:', e); }

      // Notify AO — sessions have been auto-managed
      if (hasSessionsToManage) {
        const aoLookup = leave.requester_role === 'batch_coordinator'
          ? `SELECT DISTINCT b.academic_operator_email AS email, pu.full_name
             FROM batches b LEFT JOIN portal_users pu ON pu.email = b.academic_operator_email
             WHERE b.coordinator_email = $1 AND b.academic_operator_email IS NOT NULL`
          : `SELECT DISTINCT b.academic_operator_email AS email, pu.full_name
             FROM batch_teachers bt JOIN batches b ON b.batch_id = bt.batch_id
             LEFT JOIN portal_users pu ON pu.email = b.academic_operator_email
             WHERE bt.teacher_email = $1 AND b.academic_operator_email IS NOT NULL`;
        const { rows: aoEmails } = await db.query<{ email: string; full_name: string }>(aoLookup, [leave.teacher_email]);
        for (const ao of aoEmails) {
          try {
            await sendEmail({
              to: ao.email,
              subject: `✅ Leave Confirmed — Sessions Updated for ${leave.teacher_name || leave.teacher_email}`,
              html: `<p>HR has approved and sessions have been automatically updated for ${leave.teacher_name || leave.teacher_email} (${leave.start_date} to ${leave.end_date}). ${affectedIds.length} session(s) managed per your resolution plan.</p>`,
              text: `Leave confirmed. ${affectedIds.length} sessions auto-managed per your plan.`,
              waTemplate: 'stibe_leave_update',
              waParams: [ao.full_name || 'AO', `${leave.start_date} to ${leave.end_date}`, 'Confirmed — Sessions Updated', `${affectedIds.length} sessions`],
            });
          } catch (e) { console.error('AO notify failed:', e); }
        }
      }
    })();

    return ok({ status: 'confirmed' });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: hr_reject — HR rejects leave
  // ═══════════════════════════════════════════════════════════
  if (body.action === 'hr_reject') {
    if (role !== 'hr') return err('Only HR can reject at this stage', 403);
    const reqId = body.request_id;
    if (!reqId) return err('request_id required');

    const { rows } = await db.query<LeaveRequest>(
      `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
       LEFT JOIN portal_users pu ON pu.email = lr.teacher_email WHERE lr.id = $1`, [reqId]
    );
    if (!rows.length) return err('Not found', 404);
    const leave = rows[0];
    if (leave.status !== 'pending_hr') return err('Can only reject pending_hr requests');

    await db.query(
      `UPDATE teacher_leave_requests SET
         status = 'rejected', hr_status = 'rejected',
         hr_reviewed_by = $2, hr_reviewed_at = NOW(), hr_notes = $3
       WHERE id = $1`,
      [reqId, email, body.notes || null]
    );

    // Notify teacher
    try {
      const tmpl = leaveRequestRejectedTemplate({
        teacherName: leave.teacher_name || leave.teacher_email,
        leaveType: leave.leave_type,
        startDate: leave.start_date, endDate: leave.end_date,
        rejectedBy: user.name || email, rejectedByRole: 'HR',
        reason: body.notes || 'No reason provided',
      });
      await sendEmail({
        to: leave.teacher_email, ...tmpl,
        waTemplate: 'stibe_leave_update',
        waParams: [leave.teacher_name || leave.teacher_email, `${leave.start_date} to ${leave.end_date}`, 'Rejected by HR', body.notes || ''],
      });
    } catch (e) { console.error('HR reject notify failed:', e); }

    // Notify AO that HR rejected
    const aoLookup = leave.requester_role === 'batch_coordinator'
      ? `SELECT DISTINCT b.academic_operator_email AS email FROM batches b WHERE b.coordinator_email = $1 AND b.academic_operator_email IS NOT NULL`
      : `SELECT DISTINCT b.academic_operator_email AS email FROM batch_teachers bt JOIN batches b ON b.batch_id = bt.batch_id WHERE bt.teacher_email = $1 AND b.academic_operator_email IS NOT NULL`;
    const { rows: aoEmails } = await db.query<{ email: string }>(aoLookup, [leave.teacher_email]);
    for (const ao of aoEmails) {
      try {
        await sendEmail({
          to: ao.email,
          subject: `❌ Leave Rejected by HR — ${leave.teacher_name || leave.teacher_email}`,
          html: `<p>HR rejected the leave from ${leave.teacher_name || leave.teacher_email} (${leave.start_date} to ${leave.end_date}). Reason: ${body.notes || 'No reason provided'}</p>`,
          text: `HR rejected leave. Reason: ${body.notes || 'No reason'}`,
        });
      } catch (e) { console.error('AO notify failed:', e); }
    }

    return ok({ status: 'rejected' });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: ao_confirm — AO executes resolution plan (after HR approval)
  // ═══════════════════════════════════════════════════════════
  if (body.action === 'ao_confirm') {
    if (role !== 'academic_operator') return err('Only AO can confirm', 403);
    const reqId = body.request_id;
    if (!reqId) return err('request_id required');

    const { rows } = await db.query<LeaveRequest>(
      `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
       LEFT JOIN portal_users pu ON pu.email = lr.teacher_email WHERE lr.id = $1`, [reqId]
    );
    if (!rows.length) return err('Not found', 404);
    const leave = rows[0];
    if (leave.status !== 'approved') return err('Can only confirm approved requests');

    const plan: ResolutionItem[] = (leave.resolution_plan || []) as ResolutionItem[];

    // Execute each item in the plan
    for (const item of plan) {
      try {
        await executeSessionAction(leave, item, email, user.name || email);
      } catch (e) { console.error(`Plan exec failed for ${item.session_id}:`, e); }
    }

    await db.query(
      `UPDATE teacher_leave_requests SET
         status = 'confirmed', sessions_managed = TRUE, confirmed_at = NOW()
       WHERE id = $1`,
      [reqId]
    );

    // Notify teacher: fully confirmed
    try {
      const tmpl = leaveRequestApprovedTemplate({
        teacherName: leave.teacher_name || leave.teacher_email,
        leaveType: leave.leave_type,
        startDate: leave.start_date, endDate: leave.end_date,
        affectedSessions: (leave.affected_sessions || []).length,
      });
      await sendEmail({
        to: leave.teacher_email,
        subject: `✅ Leave Confirmed — ${leave.start_date} to ${leave.end_date}`,
        html: tmpl.html, text: `Your leave is confirmed. All affected sessions have been managed.`,
        waTemplate: 'stibe_leave_update',
        waParams: [leave.teacher_name || leave.teacher_email, `${leave.start_date} to ${leave.end_date}`, 'Confirmed', 'All sessions managed'],
      });
    } catch (e) { console.error('Confirm notify failed:', e); }

    return ok({ status: 'confirmed' });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: attach_certificate — Teacher attaches cert to existing leave
  // ═══════════════════════════════════════════════════════════
  if (body.action === 'attach_certificate') {
    if (!['teacher', 'batch_coordinator'].includes(role)) return err('Not authorized', 403);
    const reqId = body.leave_id;
    if (!reqId || !body.medical_certificate_url) return err('leave_id and medical_certificate_url required');
    const result = await db.query(
      `UPDATE teacher_leave_requests SET medical_certificate_url = $1, medical_certificate_name = $2
       WHERE id = $3 AND teacher_email = $4`,
      [body.medical_certificate_url, body.medical_certificate_name || null, reqId, email]
    );
    if ((result.rowCount || 0) === 0) return err('Leave not found or not a sick leave');
    return ok({ attached: true });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: withdraw
  // ═══════════════════════════════════════════════════════════
  if (body.action === 'withdraw') {
    const reqId = body.request_id || body.leave_id;
    if (!reqId) return err('request_id required');

    const result = await db.query(
      `UPDATE teacher_leave_requests SET status = 'withdrawn'
       WHERE id = $1 AND teacher_email = $2 AND status IN ('pending_ao', 'pending_hr')`,
      [reqId, email]
    );
    if ((result.rowCount || 0) === 0) return err('Cannot withdraw — not found or already processed');

    // Notify AO about withdrawal
    const { rows: leaveRows } = await db.query<LeaveRequest>(
      `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
       LEFT JOIN portal_users pu ON pu.email = lr.teacher_email WHERE lr.id = $1`, [reqId]
    );
    if (leaveRows.length > 0) {
      const leave = leaveRows[0];
      const aoQ = leave.requester_role === 'batch_coordinator'
        ? `SELECT DISTINCT b.academic_operator_email AS email FROM batches b WHERE b.coordinator_email = $1 AND b.academic_operator_email IS NOT NULL`
        : `SELECT DISTINCT b.academic_operator_email AS email FROM batch_teachers bt JOIN batches b ON b.batch_id = bt.batch_id WHERE bt.teacher_email = $1 AND b.academic_operator_email IS NOT NULL`;
      const { rows: aoEmails } = await db.query<{ email: string }>(aoQ, [leave.teacher_email]);
      for (const ao of aoEmails) {
        try {
          await sendEmail({
            to: ao.email,
            subject: `🔙 Leave Withdrawn — ${leave.teacher_name || leave.teacher_email}`,
            html: `<p>${leave.teacher_name || leave.teacher_email} has withdrawn their leave request (${leave.start_date} to ${leave.end_date}).</p>`,
            text: `Leave withdrawn by ${leave.teacher_name} (${leave.start_date} to ${leave.end_date}).`,
          });
        } catch { /* ignore */ }
      }
    }

    return ok({ status: 'withdrawn' });
  }

  // ═══════════════════════════════════════════════════════════
  // SUBMIT: New leave request
  // ═══════════════════════════════════════════════════════════
  if (!['teacher', 'batch_coordinator'].includes(role)) return err('Only teachers and coordinators can submit leave', 403);

  const { leave_type, start_date, end_date, reason, medical_certificate_url, medical_certificate_name } = body;
  if (!leave_type || !start_date || !end_date || !reason) {
    return err('leave_type, start_date, end_date, reason required');
  }

  // Check overlapping leave
  const { rows: overlaps } = await db.query(
    `SELECT id FROM teacher_leave_requests
     WHERE teacher_email = $1 AND status IN ('pending_ao', 'pending_hr', 'approved', 'confirmed')
       AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')`,
    [email, start_date, end_date]
  );
  if (overlaps.length > 0) return err('Overlapping leave request exists');

  // Find affected sessions
  const { rows: affSessions } = await db.query<{ session_id: string }>(
    `SELECT session_id FROM batch_sessions
     WHERE teacher_email = $1 AND scheduled_date BETWEEN $2 AND $3
       AND status IN ('scheduled', 'prep')`,
    [email, start_date, end_date]
  );
  const sessionIds = affSessions.map(s => s.session_id);

  const { rows: inserted } = await db.query<LeaveRequest>(
    `INSERT INTO teacher_leave_requests
       (teacher_email, leave_type, start_date, end_date, reason, requester_role, status, affected_sessions,
        medical_certificate_url, medical_certificate_name)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending_ao', $7, $8, $9) RETURNING *`,
    [email, leave_type, start_date, end_date, reason, role, sessionIds,
     medical_certificate_url || null, medical_certificate_name || null]
  );

  // Notify AO ONLY (not HR — AO is first reviewer)
  const aoQ = role === 'batch_coordinator'
    ? `SELECT DISTINCT b.academic_operator_email AS email, pu.full_name
       FROM batches b LEFT JOIN portal_users pu ON pu.email = b.academic_operator_email
       WHERE b.coordinator_email = $1 AND b.academic_operator_email IS NOT NULL`
    : `SELECT DISTINCT b.academic_operator_email AS email, pu.full_name
       FROM batch_teachers bt JOIN batches b ON b.batch_id = bt.batch_id
       LEFT JOIN portal_users pu ON pu.email = b.academic_operator_email
       WHERE bt.teacher_email = $1 AND b.academic_operator_email IS NOT NULL`;

  const { rows: aoEmails } = await db.query<{ email: string; full_name: string }>(aoQ, [email]);
  for (const ao of aoEmails) {
    try {
      const tmpl = leaveRequestSubmittedTemplate({
        reviewerName: ao.full_name || 'Academic Operator',
        teacherName: user.name || email,
        leaveType: leave_type, startDate: start_date, endDate: end_date, reason,
        affectedSessions: sessionIds.length,
      });
      await sendEmail({
        to: ao.email, ...tmpl,
        waTemplate: 'stibe_leave_req',
        waParams: [ao.full_name || 'AO', user.name || email, `${start_date} to ${end_date}`, reason],
      });
    } catch (e) { console.error('AO email failed:', e); }
  }

  return ok({ request: inserted[0], affectedSessions: sessionIds.length });
}

/* ════════════════════════════════════════════════════════════
   PATCH: AO manages individual session (fine-tune after plan)
   ════════════════════════════════════════════════════════════ */
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  if (String(user.role) !== 'academic_operator') return err('Not authorized', 403);
  const email = String(user.id);
  const body = await req.json();
  const { leave_request_id, session_id, action_type, substitute_teacher_email, new_date, new_time, notes } = body;

  if (!leave_request_id || !session_id || !action_type) return err('leave_request_id, session_id, action_type required');
  if (!['substitute', 'cancel', 'reschedule'].includes(action_type)) return err('Invalid action_type');

  const { rows: leaveRows } = await db.query<LeaveRequest>(
    `SELECT lr.*, pu.full_name AS teacher_name FROM teacher_leave_requests lr
     LEFT JOIN portal_users pu ON pu.email = lr.teacher_email WHERE lr.id = $1`, [leave_request_id]
  );
  if (!leaveRows.length) return err('Not found', 404);
  const leave = leaveRows[0];
  if (!['approved', 'pending_ao'].includes(leave.status)) return err('Leave must be pending_ao or approved');
  if (!leave.affected_sessions?.includes(session_id)) return err('Session not in affected list');

  const { rows: existing } = await db.query(
    `SELECT id FROM leave_session_actions WHERE leave_request_id = $1 AND batch_session_id = $2`,
    [leave_request_id, session_id]
  );
  if (existing.length > 0) return err('Action already taken for this session');

  await executeSessionAction(leave, {
    session_id,
    action: action_type as 'substitute' | 'reschedule' | 'cancel',
    substitute_email: substitute_teacher_email, new_date, new_time, notes,
  }, email, user.name || email);

  // Check if all managed
  const managed = await db.query<{ unmanaged: number }>(`
    SELECT COUNT(*)::int AS unmanaged FROM UNNEST($1::text[]) AS sid
    WHERE NOT EXISTS (SELECT 1 FROM leave_session_actions WHERE leave_request_id = $2 AND batch_session_id = sid)
  `, [leave.affected_sessions, leave_request_id]);
  const allManaged = managed.rows[0]?.unmanaged === 0;
  if (allManaged) {
    await db.query(`UPDATE teacher_leave_requests SET sessions_managed = TRUE WHERE id = $1`, [leave_request_id]);
  }

  return ok({ action: action_type, session_id, allSessionsManaged: allManaged });
}

/* ════════════════════════════════════════════════════════════
   DELETE: Remove leave requests
   ════════════════════════════════════════════════════════════ */
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return err('Unauthorized', 401);
    const user = await verifySession(token);
    if (!user) return err('Unauthorized', 401);

    if (!['academic_operator', 'hr', 'batch_coordinator'].includes(String(user.role))) return err('Access denied', 403);

    const body = await req.json();
    const { leave_ids } = body as { leave_ids?: string[] };
    if (!leave_ids || !Array.isArray(leave_ids) || !leave_ids.length) return err('leave_ids required');

    await db.query(`DELETE FROM leave_session_actions WHERE leave_request_id = ANY($1)`, [leave_ids]);
    const result = await db.query(`DELETE FROM teacher_leave_requests WHERE id = ANY($1)`, [leave_ids]);

    return ok({ deleted: result.rowCount || 0 });
  } catch (error) {
    console.error('[teacher-leave DELETE] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */

async function executeSessionAction(
  leave: LeaveRequest, item: ResolutionItem, actorEmail: string, actorName: string,
) {
  const { rows: sessRows } = await db.query<{
    session_id: string; batch_id: string; subject: string; scheduled_date: string;
    start_time: string; batch_name?: string; livekit_room_name?: string;
    duration_minutes?: number; topic?: string; grade?: string;
    [key: string]: unknown;
  }>(
    `SELECT bs.*, b.batch_name, b.grade FROM batch_sessions bs
     LEFT JOIN batches b ON b.batch_id = bs.batch_id WHERE bs.session_id = $1`, [item.session_id]
  );
  if (!sessRows.length) return;
  const session = sessRows[0];

  // ── Phase 1: ALL DB MUTATIONS (synchronous — fast) ──────────
  if (item.action === 'cancel') {
    await db.query(
      `UPDATE batch_sessions SET status = 'cancelled', cancel_reason = $2 WHERE session_id = $1`,
      [item.session_id, item.notes || `Teacher on leave (${leave.teacher_name || leave.teacher_email})`]
    );
  } else if (item.action === 'substitute') {
    if (!item.substitute_email) return;
    const { rows: subRows } = await db.query<{ full_name: string }>(
      `SELECT full_name FROM portal_users WHERE email = $1`, [item.substitute_email]
    );
    const subName = subRows[0]?.full_name || item.substitute_email;
    item.substitute_name = subName;
    const effectiveSubject = item.subject_override || session.subject;

    if (item.subject_override) {
      await db.query(
        `UPDATE batch_sessions SET teacher_email = $2, teacher_name = $3, subject = $4 WHERE session_id = $1`,
        [item.session_id, item.substitute_email, subName, item.subject_override]
      );
    } else {
      await db.query(
        `UPDATE batch_sessions SET teacher_email = $2, teacher_name = $3 WHERE session_id = $1`,
        [item.session_id, item.substitute_email, subName]
      );
    }
    await db.query(
      `UPDATE rooms SET teacher_email = $2${item.subject_override ? ', subject = $3' : ''}
       WHERE batch_session_id = $1`,
      item.subject_override
        ? [item.session_id, item.substitute_email, item.subject_override]
        : [item.session_id, item.substitute_email]
    );
    await db.query(
      `INSERT INTO batch_teachers (batch_id, teacher_email, subject)
       VALUES ($1, $2, $3) ON CONFLICT (batch_id, subject) DO UPDATE SET teacher_email = $2`,
      [session.batch_id, item.substitute_email, effectiveSubject]
    );
  } else if (item.action === 'reschedule') {
    if (!item.new_date) return;
    await db.query(
      `UPDATE batch_sessions SET scheduled_date = $2, start_time = COALESCE($3, start_time), status = 'scheduled'
       WHERE session_id = $1`,
      [item.session_id, item.new_date, item.new_time || null]
    );
  }

  // Record the action in DB (synchronous)
  await db.query(`
    INSERT INTO leave_session_actions
      (leave_request_id, batch_session_id, action_type, substitute_teacher_email, substitute_teacher_name,
       new_date, new_time, acted_by, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    leave.id, item.session_id, item.action,
    item.substitute_email || null, item.substitute_name || null,
    item.new_date || null, item.new_time || null,
    actorEmail, item.notes || null,
  ]);

  // ── Phase 2: NOTIFICATIONS (fire-and-forget — does NOT block HTTP response) ──
  void sendSessionNotifications(leave, item, session, actorName);
}

// Async notifications — runs in background without blocking the HTTP response
async function sendSessionNotifications(
  leave: LeaveRequest,
  item: ResolutionItem,
  session: { session_id: string; batch_id: string; subject: string; scheduled_date: string; start_time: string; batch_name?: string; livekit_room_name?: string; duration_minutes?: number; topic?: string; grade?: string; [key: string]: unknown },
  actorName: string,
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.stibelearning.online';
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stibelearning.online';
  const roomName = String(session.livekit_room_name || session.session_id);
  const duration = session.duration_minutes ? `${session.duration_minutes} min` : undefined;

  async function makeJoinUrl(email: string, name: string, role: 'teacher' | 'student' | 'parent' | 'batch_coordinator'): Promise<string | undefined> {
    try {
      await ensureRoom(roomName);
      const token = await createLiveKitToken({ roomName, participantIdentity: email, participantName: name, role });
      return `${baseUrl}/classroom/${session.session_id}?token=${encodeURIComponent(token)}&ws=${encodeURIComponent(wsUrl)}`;
    } catch { return undefined; }
  }

  if (item.action === 'cancel') {
    const stakeholders = await getSessionStakeholders(session.batch_id);
    for (const s of stakeholders) {
      try {
        const tmpl = sessionCancelledNotifyTemplate({
          recipientName: s.name, batchName: String(session.batch_name || ''),
          subject: session.subject, sessionDate: session.scheduled_date,
          startTime: session.start_time,
          reason: `Teacher on leave: ${leave.teacher_name || leave.teacher_email}`,
          cancelledBy: actorName,
          recipientEmail: s.email, childName: s.childName,
        });
        await sendEmail({ to: s.email, ...tmpl });
      } catch { /* */ }
    }
  } else if (item.action === 'substitute') {
    if (!item.substitute_email || !item.substitute_name) return;
    const subName = item.substitute_name;
    const effectiveSubject = item.subject_override || session.subject;

    // Notify substitute teacher
    try {
      const subJoinUrl = await makeJoinUrl(item.substitute_email, subName, 'teacher');
      const { rows: cntRows } = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM batch_students WHERE batch_id = $1`, [session.batch_id]
      );
      const studentCount = parseInt(cntRows[0]?.count || '0', 10);
      const tmpl = sessionSubstituteNotifyTemplate({
        recipientName: subName, batchName: String(session.batch_name || ''),
        subject: effectiveSubject,
        originalSubject: item.subject_override ? session.subject : undefined,
        sessionDate: session.scheduled_date, startTime: session.start_time,
        substituteTeacher: subName,
        originalTeacher: leave.teacher_name || leave.teacher_email,
        reason: `Substitute for ${leave.teacher_name || leave.teacher_email} (on leave)`,
        requestedBy: actorName, joinUrl: subJoinUrl, recipientEmail: item.substitute_email,
        duration, topic: session.topic ? String(session.topic) : undefined,
        grade: session.grade ? String(session.grade) : undefined,
        studentCount, isSubstitute: true,
      });
      await sendEmail({ to: item.substitute_email, ...tmpl });
    } catch { /* */ }

    // Notify stakeholders
    const stakeholders = await getSessionStakeholders(session.batch_id);
    for (const s of stakeholders) {
      try {
        const sRole = s.role === 'parent' ? 'parent' : s.role === 'coordinator' ? 'batch_coordinator' : 'student';
        const sJoinUrl = s.role !== 'coordinator' && s.role !== 'academic_operator'
          ? await makeJoinUrl(s.email, s.name, sRole as 'student' | 'parent' | 'batch_coordinator')
          : undefined;
        const tmpl = sessionSubstituteNotifyTemplate({
          recipientName: s.name, batchName: String(session.batch_name || ''),
          subject: effectiveSubject,
          originalSubject: item.subject_override ? session.subject : undefined,
          sessionDate: session.scheduled_date, startTime: session.start_time,
          substituteTeacher: subName,
          originalTeacher: leave.teacher_name || leave.teacher_email,
          reason: `Substitute teacher: ${subName} (replaces ${leave.teacher_name || leave.teacher_email})`,
          requestedBy: actorName, joinUrl: sJoinUrl, recipientEmail: s.email,
          duration, topic: session.topic ? String(session.topic) : undefined, childName: s.childName,
        });
        await sendEmail({ to: s.email, ...tmpl });
      } catch { /* */ }
    }
  } else if (item.action === 'reschedule') {
    if (!item.new_date) return;
    const newTime = item.new_time || session.start_time;
    const stakeholders = await getSessionStakeholders(session.batch_id);
    for (const s of stakeholders) {
      try {
        const sRole = s.role === 'parent' ? 'parent' : s.role === 'coordinator' ? 'batch_coordinator' : s.role === 'teacher' ? 'teacher' : 'student';
        const sJoinUrl = s.role !== 'coordinator' && s.role !== 'academic_operator'
          ? await makeJoinUrl(s.email, s.name, sRole as 'teacher' | 'student' | 'parent' | 'batch_coordinator')
          : undefined;
        const tmpl = sessionRescheduledNotifyTemplate({
          recipientName: s.name, batchName: String(session.batch_name || ''),
          subject: session.subject,
          oldDate: session.scheduled_date, oldTime: session.start_time,
          newDate: item.new_date!, newTime,
          reason: `Rescheduled — teacher on leave: ${leave.teacher_name || leave.teacher_email}`,
          requestedBy: actorName, joinUrl: sJoinUrl, recipientEmail: s.email,
          duration, topic: session.topic ? String(session.topic) : undefined, childName: s.childName,
        });
        await sendEmail({ to: s.email, ...tmpl });
      } catch { /* */ }
    }
  }
}

async function getSessionStakeholders(batchId: string) {
  const people: { email: string; name: string; role: string; childName?: string }[] = [];
  if (!batchId) return people;

  // Students + their parents
  const { rows: students } = await db.query<{ student_email: string; parent_email: string | null; student_name?: string }>(
    `SELECT bs.student_email, bs.parent_email, pu.full_name as student_name
     FROM batch_students bs LEFT JOIN portal_users pu ON pu.email = bs.student_email
     WHERE bs.batch_id = $1`, [batchId]
  );
  for (const s of students) {
    people.push({ email: s.student_email, name: s.student_name || s.student_email, role: 'student' });
    if (s.parent_email) {
      const { rows: p } = await db.query<{ full_name: string }>(
        `SELECT full_name FROM portal_users WHERE email = $1`, [s.parent_email]
      );
      people.push({
        email: s.parent_email, name: p[0]?.full_name || s.parent_email, role: 'parent',
        childName: s.student_name || s.student_email,
      });
    }
  }

  // Coordinator + Academic Operator from batches
  const { rows: batch } = await db.query<{ coordinator_email: string; academic_operator_email: string }>(
    `SELECT coordinator_email, academic_operator_email FROM batches WHERE batch_id = $1`, [batchId]
  );
  if (batch[0]?.coordinator_email) {
    const { rows: u } = await db.query<{ full_name: string }>(
      `SELECT full_name FROM portal_users WHERE email = $1`, [batch[0].coordinator_email]
    );
    people.push({ email: batch[0].coordinator_email, name: u[0]?.full_name || batch[0].coordinator_email, role: 'coordinator' });
  }
  if (batch[0]?.academic_operator_email) {
    const { rows: u } = await db.query<{ full_name: string }>(
      `SELECT full_name FROM portal_users WHERE email = $1`, [batch[0].academic_operator_email]
    );
    people.push({ email: batch[0].academic_operator_email, name: u[0]?.full_name || batch[0].academic_operator_email, role: 'academic_operator' });
  }

  return people;
}
