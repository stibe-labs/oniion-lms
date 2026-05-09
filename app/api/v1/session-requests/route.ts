// ═══════════════════════════════════════════════════════════════
// Session Requests API — /api/v1/session-requests
// Students, Parents, Teachers & Coordinators: submit reschedule/cancel
// AO: list & approve/reject
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendEmail } from '@/lib/email';
import {
  sessionRequestSubmittedTemplate,
  sessionRequestApprovedTemplate,
  sessionRequestRejectedTemplate,
  sessionRescheduledNotifyTemplate,
  sessionCancelledNotifyTemplate,
} from '@/lib/email-templates';

interface SessionRequest {
  id: string;
  request_type: string;
  requester_email: string;
  requester_role: string;
  batch_session_id: string | null;
  batch_id: string | null;
  room_id: string | null;
  reason: string;
  proposed_date: string | null;
  proposed_time: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  batch_name?: string;
  subject?: string;
  session_date?: string;
  start_time?: string;
  requester_name?: string;
  [key: string]: unknown;
}

const ok = (data: unknown) => NextResponse.json({ success: true, data });
const err = (msg: string, status = 400) => NextResponse.json({ success: false, error: msg }, { status });

/* ─── GET: List session requests ──────────────────────── */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const role = String(user.role);
  const email = String(user.id);

  let query: string;
  let params: string[];

  if (['academic_operator', 'owner', 'hr', 'batch_coordinator'].includes(role)) {
    // AO/Owner/HR see all requests (or filtered by their batches)
    if (role === 'academic_operator') {
      query = `
        SELECT sr.*, b.batch_name, bs.subject, bs.scheduled_date AS session_date,
               bs.start_time, pu.full_name AS requester_name
        FROM session_requests sr
        LEFT JOIN batches b ON b.batch_id = sr.batch_id
        LEFT JOIN batch_sessions bs ON bs.session_id = sr.batch_session_id
        LEFT JOIN portal_users pu ON pu.email = sr.requester_email
        WHERE b.academic_operator_email = $1
        ORDER BY sr.created_at DESC
        LIMIT 200`;
      params = [email];
    } else {
      query = `
        SELECT sr.*, b.batch_name, bs.subject, bs.scheduled_date AS session_date,
               bs.start_time, pu.full_name AS requester_name
        FROM session_requests sr
        LEFT JOIN batches b ON b.batch_id = sr.batch_id
        LEFT JOIN batch_sessions bs ON bs.session_id = sr.batch_session_id
        LEFT JOIN portal_users pu ON pu.email = sr.requester_email
        ORDER BY sr.created_at DESC
        LIMIT 200`;
      params = [];
    }
  } else {
    // Teachers/students/parents/coordinators see only their own
    query = `
      SELECT sr.*, b.batch_name, bs.subject, bs.scheduled_date AS session_date,
             bs.start_time
      FROM session_requests sr
      LEFT JOIN batches b ON b.batch_id = sr.batch_id
      LEFT JOIN batch_sessions bs ON bs.session_id = sr.batch_session_id
      WHERE sr.requester_email = $1
      ORDER BY sr.created_at DESC
      LIMIT 100`;
    params = [email];
  }

  const { rows } = await db.query<SessionRequest>(query, params);

  // Count by status
  const counts = { pending: 0, approved: 0, rejected: 0, total: rows.length };
  for (const r of rows) {
    if (r.status === 'pending') counts.pending++;
    else if (r.status === 'approved') counts.approved++;
    else if (r.status === 'rejected') counts.rejected++;
  }

  return ok({ requests: rows, counts });
}

/* ─── POST: Submit new request OR approve/reject ──────── */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return err('Unauthorized', 401);
  const user = await verifySession(token);
  if (!user) return err('Unauthorized', 401);

  const body = await req.json();
  const role = String(user.role);
  const email = String(user.id);

  // ─── Action: approve / reject ───────────────────────
  if (body.action === 'approve' || body.action === 'reject') {
    if (!['academic_operator', 'owner', 'hr', 'batch_coordinator'].includes(role)) {
      return err('Only AO/HR/Owner/Coordinator can review requests', 403);
    }

    const reqId = body.request_id;
    if (!reqId) return err('request_id required');

    const { rows: existing } = await db.query<SessionRequest>(
      `SELECT sr.*, b.batch_name, bs.subject, bs.scheduled_date AS session_date,
              bs.start_time, bs.teacher_email, b.coordinator_email,
              b.academic_operator_email
       FROM session_requests sr
       LEFT JOIN batches b ON b.batch_id = sr.batch_id
       LEFT JOIN batch_sessions bs ON bs.session_id = sr.batch_session_id
       WHERE sr.id = $1`, [reqId]
    );
    if (existing.length === 0) return err('Request not found', 404);
    const request = existing[0];

    if (request.status !== 'pending') return err('Request already processed');

    if (body.action === 'reject') {
      await db.query(
        `UPDATE session_requests SET status = 'rejected', reviewed_by = $2,
         reviewed_at = NOW(), rejection_reason = $3 WHERE id = $1`,
        [reqId, email, body.reason || 'Rejected by reviewer']
      );

      // Email requester about rejection
      try {
        const tmpl = sessionRequestRejectedTemplate({
          requesterName: String(request.requester_name || request.requester_email),
          requestType: request.request_type,
          batchName: String(request.batch_name || ''),
          subject: String(request.subject || ''),
          sessionDate: String(request.session_date || ''),
          reason: body.reason || 'Rejected by reviewer',
        });
        await sendEmail({
          to: request.requester_email, ...tmpl,
          waTemplate: 'stibe_request_update',
          waParams: [String(request.requester_name || request.requester_email), `${request.request_type} request`, 'Rejected', body.reason || 'Rejected by reviewer'],
        });
      } catch (e) { console.error('Email failed:', e); }

      return ok({ status: 'rejected' });
    }

    // ─── APPROVE ─────────────────────────────────────
    await db.query(
      `UPDATE session_requests SET status = 'approved', reviewed_by = $2,
       reviewed_at = NOW() WHERE id = $1`,
      [reqId, email]
    );

    const teacherEmail = String(request.teacher_email || '');
    const coordEmail = String(request.coordinator_email || '');
    const aoEmail = String(request.academic_operator_email || '');
    const batchName = String(request.batch_name || '');
    const subject = String(request.subject || '');

    if (request.request_type === 'cancel') {
      // Cancel the session
      if (request.batch_session_id) {
        await db.query(
          `UPDATE batch_sessions SET status = 'cancelled' WHERE session_id = $1`,
          [request.batch_session_id]
        );
      }
      if (request.room_id) {
        await db.query(
          `UPDATE rooms SET status = 'cancelled' WHERE room_id = $1`,
          [request.room_id]
        );
      }

      // Notify everyone about cancellation
      const stakeholders = await getSessionStakeholders(request.batch_id, request.batch_session_id);
      for (const s of stakeholders) {
        try {
          const tmpl = sessionCancelledNotifyTemplate({
            recipientName: s.name,
            batchName,
            subject,
            sessionDate: String(request.session_date || ''),
            startTime: String(request.start_time || ''),
            reason: request.reason,
            cancelledBy: String(request.requester_name || request.requester_email),
          });
          await sendEmail({
            to: s.email, ...tmpl,
            waTemplate: 'stibe_session_cancel',
            waParams: [s.name, `${batchName} (${subject})`, String(request.session_date || ''), request.reason],
          });
        } catch (e) { console.error('Notify email failed:', e); }
      }
    } else if (request.request_type === 'reschedule') {
      // Reschedule the session
      if (request.batch_session_id && request.proposed_date) {
        await db.query(
          `UPDATE batch_sessions SET scheduled_date = $2, start_time = COALESCE($3, start_time),
           status = 'scheduled' WHERE session_id = $1`,
          [request.batch_session_id, request.proposed_date, request.proposed_time]
        );
      }

      // Notify everyone about reschedule
      const stakeholders = await getSessionStakeholders(request.batch_id, request.batch_session_id);
      for (const s of stakeholders) {
        try {
          const tmpl = sessionRescheduledNotifyTemplate({
            recipientName: s.name,
            batchName,
            subject,
            oldDate: String(request.session_date || ''),
            oldTime: String(request.start_time || ''),
            newDate: String(request.proposed_date || ''),
            newTime: String(request.proposed_time || request.start_time || ''),
            reason: request.reason,
            requestedBy: String(request.requester_name || request.requester_email),
          });
          await sendEmail({
            to: s.email, ...tmpl,
            waTemplate: 'stibe_session_moved',
            waParams: [s.name, `${batchName} (${subject})`, String(request.session_date || ''), `${String(request.proposed_date || '')} (${request.reason})`],
          });
        } catch (e) { console.error('Notify email failed:', e); }
      }
    }

    // Email requester about approval
    try {
      const tmpl = sessionRequestApprovedTemplate({
        requesterName: String(request.requester_name || request.requester_email),
        requestType: request.request_type,
        batchName,
        subject,
        sessionDate: String(request.session_date || ''),
        proposedDate: request.proposed_date ? String(request.proposed_date) : undefined,
        proposedTime: request.proposed_time ? String(request.proposed_time) : undefined,
      });
      await sendEmail({
        to: request.requester_email, ...tmpl,
        waTemplate: 'stibe_request_update',
        waParams: [String(request.requester_name || request.requester_email), `${request.request_type} request`, 'Approved', 'Changes have been applied'],
      });
    } catch (e) { console.error('Email failed:', e); }

    return ok({ status: 'approved' });
  }

  // ─── Action: withdraw ────────────────────────────────
  if (body.action === 'withdraw') {
    const reqId = body.request_id;
    if (!reqId) return err('request_id required');
    await db.query(
      `UPDATE session_requests SET status = 'withdrawn' WHERE id = $1 AND requester_email = $2 AND status = 'pending'`,
      [reqId, email]
    );
    return ok({ status: 'withdrawn' });
  }

  // ─── Submit new request ──────────────────────────────
  if (!['student', 'parent', 'teacher', 'batch_coordinator'].includes(role)) {
    return err('Not authorized to submit requests', 403);
  }

  const { request_type, batch_session_id, batch_id, reason, proposed_date, proposed_time } = body;
  if (!request_type || !reason) return err('request_type and reason are required');
  if (!['reschedule', 'cancel'].includes(request_type)) return err('Invalid request_type');
  if (request_type === 'reschedule' && !proposed_date) return err('proposed_date required for reschedule');

  // Verify the requester is associated with this batch
  if (batch_id) {
    if (['student', 'parent'].includes(role)) {
      const { rows: assoc } = await db.query(
        `SELECT 1 FROM batch_students WHERE batch_id = $1
         AND (student_email = $2 OR parent_email = $2)`,
        [batch_id, email]
      );
      if (assoc.length === 0) return err('Not associated with this batch', 403);
    } else if (role === 'teacher') {
      // Teacher must be assigned to this session
      const { rows: assoc } = await db.query(
        `SELECT 1 FROM batch_sessions WHERE session_id = $1 AND teacher_email = $2`,
        [batch_session_id || '', email]
      );
      if (assoc.length === 0) return err('Not assigned to this session', 403);
    } else if (role === 'batch_coordinator') {
      const { rows: assoc } = await db.query(
        `SELECT 1 FROM batches WHERE batch_id = $1 AND coordinator_email = $2`,
        [batch_id, email]
      );
      if (assoc.length === 0) return err('Not coordinator for this batch', 403);
    }
  }

  const { rows: inserted } = await db.query<SessionRequest>(
    `INSERT INTO session_requests (request_type, requester_email, requester_role,
     batch_session_id, batch_id, room_id, reason, proposed_date, proposed_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [request_type, email, role, batch_session_id || null, batch_id || null,
     body.room_id || null, reason, proposed_date || null, proposed_time || null]
  );

  // Notify AO about new request
  if (batch_id) {
    const { rows: batch } = await db.query<{ academic_operator_email: string; batch_name: string; [key: string]: unknown }>(
      `SELECT academic_operator_email, batch_name FROM batches WHERE batch_id = $1`,
      [batch_id]
    );
    if (batch.length > 0 && batch[0].academic_operator_email) {
      try {
        const tmpl = sessionRequestSubmittedTemplate({
          aoName: 'Academic Operator',
          requesterName: user.name || email,
          requesterRole: role,
          requestType: request_type,
          batchName: batch[0].batch_name,
          reason,
          proposedDate: proposed_date,
          proposedTime: proposed_time,
        });
        await sendEmail({
          to: batch[0].academic_operator_email, ...tmpl,
          waTemplate: 'stibe_session_request',
          waParams: ['Academic Operator', user.name || email, `${request_type} — ${batch[0].batch_name}`, `${reason}${proposed_date ? ` (Proposed: ${proposed_date})` : ''}`],
        });
      } catch (e) { console.error('AO notify failed:', e); }
    }
  }

  return ok({ request: inserted[0] });
}

/* ─── Helper: get all stakeholders for a session ──────── */
async function getSessionStakeholders(batchId: string | null, sessionId: string | null) {
  const people: { email: string; name: string; role: string }[] = [];
  if (!batchId) return people;

  // Teacher
  if (sessionId) {
    const { rows: sess } = await db.query<{ teacher_email: string; [key: string]: unknown }>(
      `SELECT teacher_email FROM batch_sessions WHERE session_id = $1`, [sessionId]
    );
    for (const s of sess) {
      if (s.teacher_email) {
        const { rows: u } = await db.query<{ full_name: string; [key: string]: unknown }>(
          `SELECT full_name FROM portal_users WHERE email = $1`, [s.teacher_email]
        );
        people.push({ email: s.teacher_email, name: u[0]?.full_name || s.teacher_email, role: 'teacher' });
      }
    }
  }

  // Coordinator & AO
  const { rows: batch } = await db.query<{ coordinator_email: string; academic_operator_email: string; [key: string]: unknown }>(
    `SELECT coordinator_email, academic_operator_email FROM batches WHERE batch_id = $1`, [batchId]
  );
  for (const b of batch) {
    for (const field of ['coordinator_email', 'academic_operator_email'] as const) {
      if (b[field]) {
        const { rows: u } = await db.query<{ full_name: string; [key: string]: unknown }>(
          `SELECT full_name FROM portal_users WHERE email = $1`, [b[field]]
        );
        people.push({ email: b[field], name: u[0]?.full_name || b[field], role: field.replace('_email', '') });
      }
    }
  }

  // Students & Parents
  const { rows: students } = await db.query<{ student_email: string; parent_email: string | null; [key: string]: unknown }>(
    `SELECT student_email, parent_email FROM batch_students WHERE batch_id = $1`, [batchId]
  );
  for (const s of students) {
    const { rows: u } = await db.query<{ full_name: string; [key: string]: unknown }>(
      `SELECT full_name FROM portal_users WHERE email = $1`, [s.student_email]
    );
    people.push({ email: s.student_email, name: u[0]?.full_name || s.student_email, role: 'student' });
    if (s.parent_email) {
      const { rows: p } = await db.query<{ full_name: string; [key: string]: unknown }>(
        `SELECT full_name FROM portal_users WHERE email = $1`, [s.parent_email]
      );
      people.push({ email: s.parent_email, name: p[0]?.full_name || s.parent_email, role: 'parent' });
    }
  }

  return people;
}
