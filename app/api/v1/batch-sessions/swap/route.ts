// ═══════════════════════════════════════════════════════════════
// Batch Session Swap API
// POST /api/v1/batch-sessions/swap
//   Body: { sessionAId, sessionBId, reason, remarks }
// Interchanges curriculum content (subject, teacher, topic) between two
// scheduled sessions in the same batch, recording a full audit trail
// and notifying all stakeholders via reschedule emails.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { scheduleTimetableUpdate } from '@/lib/timetable-auto';
import { sendEmail } from '@/lib/email';
import { sessionRescheduledNotifyTemplate } from '@/lib/email-templates';

async function getCaller(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) return null;
  return user;
}

type SessionRow = {
  session_id: string;
  batch_id: string;
  subject: string;
  teacher_email: string | null;
  teacher_name: string | null;
  scheduled_date: string;
  start_time: string;
  status: string;
  topic: string | null;
  notes: string | null;
  coordinator_email: string;
  academic_operator_email: string;
};

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let body: { sessionAId?: string; sessionBId?: string; reason?: string; remarks?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { sessionAId, sessionBId } = body;
  const reason = (body.reason ?? '').trim();
  const remarks = (body.remarks ?? '').trim();

  if (!sessionAId || !sessionBId) {
    return NextResponse.json({ success: false, error: 'Both sessionAId and sessionBId are required' }, { status: 400 });
  }
  if (sessionAId === sessionBId) {
    return NextResponse.json({ success: false, error: 'Cannot swap a session with itself' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ success: false, error: 'Reason for swap is required' }, { status: 400 });
  }

  // ── Load both sessions with batch ownership ──────────────────
  const sessRes = await db.query<SessionRow>(
    `SELECT s.session_id, s.batch_id, s.subject, s.teacher_email, s.teacher_name,
            s.scheduled_date, s.start_time, s.status, s.topic, s.notes,
            b.coordinator_email, b.academic_operator_email
     FROM batch_sessions s
     JOIN batches b ON b.batch_id = s.batch_id
     WHERE s.session_id = ANY($1)`,
    [[sessionAId, sessionBId]]
  );

  if (sessRes.rows.length !== 2) {
    return NextResponse.json({ success: false, error: 'One or both sessions not found' }, { status: 404 });
  }

  const sessionA = sessRes.rows.find(r => r.session_id === sessionAId)!;
  const sessionB = sessRes.rows.find(r => r.session_id === sessionBId)!;

  // ── Validate same batch ──────────────────────────────────────
  if (sessionA.batch_id !== sessionB.batch_id) {
    return NextResponse.json({ success: false, error: 'Sessions must belong to the same batch' }, { status: 400 });
  }

  // ── Validate scope ───────────────────────────────────────────
  if (caller.role === 'academic_operator' && sessionA.academic_operator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }
  if (caller.role === 'batch_coordinator' && sessionA.coordinator_email !== caller.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }

  // ── Validate status: both must be scheduled ──────────────────
  if (sessionA.status !== 'scheduled' || sessionB.status !== 'scheduled') {
    return NextResponse.json({
      success: false,
      error: `Both sessions must be in 'scheduled' status (got A=${sessionA.status}, B=${sessionB.status})`,
    }, { status: 400 });
  }

  // ── Validate both in future (IST) ────────────────────────────
  const dateA = String(sessionA.scheduled_date).slice(0, 10);
  const timeA = String(sessionA.start_time).slice(0, 5);
  const dateB = String(sessionB.scheduled_date).slice(0, 10);
  const timeB = String(sessionB.start_time).slice(0, 5);
  const now = new Date();
  if (new Date(`${dateA}T${timeA}+05:30`) < now || new Date(`${dateB}T${timeB}+05:30`) < now) {
    return NextResponse.json({ success: false, error: 'Cannot swap past sessions' }, { status: 400 });
  }

  // ── Build remark string to append to notes ───────────────────
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const swapNote = `[Swap ${stamp} by ${caller.id} (${caller.role})] Reason: ${reason}${remarks ? ' — ' + remarks : ''}`;
  const newNotesA = sessionA.notes ? `${sessionA.notes}\n${swapNote}` : swapNote;
  const newNotesB = sessionB.notes ? `${sessionB.notes}\n${swapNote}` : swapNote;

  // ── Perform the swap atomically ──────────────────────────────
  await db.withTransaction(async (client) => {
    // Session A receives B's content
    await client.query(
      `UPDATE batch_sessions
       SET subject = $1, teacher_email = $2, teacher_name = $3, topic = $4, notes = $5, updated_at = NOW()
       WHERE session_id = $6`,
      [sessionB.subject, sessionB.teacher_email, sessionB.teacher_name, sessionB.topic, newNotesA, sessionAId]
    );
    // Session B receives A's content
    await client.query(
      `UPDATE batch_sessions
       SET subject = $1, teacher_email = $2, teacher_name = $3, topic = $4, notes = $5, updated_at = NOW()
       WHERE session_id = $6`,
      [sessionA.subject, sessionA.teacher_email, sessionA.teacher_name, sessionA.topic, newNotesB, sessionBId]
    );
    // Audit record
    await client.query(
      `INSERT INTO session_swaps
        (session_a_id, session_b_id, batch_id,
         a_subject_before, a_teacher_email_before, a_teacher_name_before, a_topic_before,
         b_subject_before, b_teacher_email_before, b_teacher_name_before, b_topic_before,
         reason, remarks, swapped_by, swapped_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        sessionAId, sessionBId, sessionA.batch_id,
        sessionA.subject, sessionA.teacher_email, sessionA.teacher_name, sessionA.topic,
        sessionB.subject, sessionB.teacher_email, sessionB.teacher_name, sessionB.topic,
        reason, remarks || null, caller.id, caller.role,
      ]
    );
  });

  // Trigger timetable refresh
  scheduleTimetableUpdate(sessionA.batch_id);

  // ── Send notifications ───────────────────────────────────────
  // Each stakeholder receives one email per session that changed (subject/teacher swap).
  // We reuse sessionRescheduledNotifyTemplate but indicate this is a curriculum swap
  // (date/time stayed the same — only what's being taught changed).
  try {
    const batchRes = await db.query<{ batch_name: string }>(
      `SELECT batch_name FROM batches WHERE batch_id = $1`,
      [sessionA.batch_id]
    );
    const batchName = batchRes.rows[0]?.batch_name || 'Your batch';

    const stakeholders = await db.query<{ role: string; email: string; name: string; child_name: string | null }>(
      `SELECT 'student' AS role, bs.student_email AS email, u.full_name AS name, NULL::text AS child_name
       FROM batch_students bs
       JOIN portal_users u ON u.email = bs.student_email
       WHERE bs.batch_id = $1
       UNION ALL
       SELECT 'parent', bs.parent_email, pu.full_name, su.full_name
       FROM batch_students bs
       JOIN portal_users pu ON pu.email = bs.parent_email
       JOIN portal_users su ON su.email = bs.student_email
       WHERE bs.batch_id = $1 AND bs.parent_email IS NOT NULL
       UNION ALL
       SELECT 'teacher', u.email, u.full_name, NULL
       FROM portal_users u
       WHERE u.email = ANY($2::text[]) AND u.email IS NOT NULL`,
      [sessionA.batch_id, [sessionA.teacher_email, sessionB.teacher_email].filter(Boolean)]
    );

    // Send one notification per session that changed.
    // For each session, the "old" content is what was there before the swap,
    // and the "new" content is what's there now.
    const notifyForSession = async (
      sessionId: string,
      date: string,
      time: string,
      oldSubject: string,
      newSubject: string,
      oldTeacher: string | null,
      newTeacher: string | null,
      oldTopic: string | null,
      newTopic: string | null,
    ) => {
      void sessionId;
      const subjectLine = oldSubject === newSubject ? newSubject : `${newSubject} (was ${oldSubject})`;
      const teacherLine = (oldTeacher || '—') === (newTeacher || '—')
        ? (newTeacher || 'TBD')
        : `${newTeacher || 'TBD'} (was ${oldTeacher || 'TBD'})`;
      const topicLine = (oldTopic || '') !== (newTopic || '') && newTopic ? newTopic : (newTopic || '');

      for (const s of stakeholders.rows) {
        try {
          const tmpl = sessionRescheduledNotifyTemplate({
            recipientName: s.name,
            recipientEmail: s.email,
            batchName,
            subject: subjectLine,
            oldDate: date,
            oldTime: time,
            newDate: date,
            newTime: time,
            reason: `Session swap: ${reason}${remarks ? ' — ' + remarks : ''}. New teacher: ${teacherLine}`,
            requestedBy: caller.id,
            ...(topicLine ? { topic: topicLine } : {}),
            ...(s.role === 'parent' && s.child_name ? { childName: s.child_name } : {}),
          });
          await sendEmail({
            to: s.email,
            ...tmpl,
            waTemplate: 'stibe_session_moved',
            waParams: [
              s.name,
              `${batchName} (${subjectLine})`,
              `${date} at ${time}`,
              `Swapped — now ${newSubject} with ${newTeacher || 'TBD'} (Reason: ${reason})`,
            ],
          });
        } catch (e) {
          console.error('[batch-sessions/swap] Notify failed for', s.email, e);
        }
      }
    };

    // Session A: now hosts B's content
    await notifyForSession(
      sessionAId, dateA, timeA,
      sessionA.subject, sessionB.subject,
      sessionA.teacher_name, sessionB.teacher_name,
      sessionA.topic, sessionB.topic,
    );
    // Session B: now hosts A's content
    await notifyForSession(
      sessionBId, dateB, timeB,
      sessionB.subject, sessionA.subject,
      sessionB.teacher_name, sessionA.teacher_name,
      sessionB.topic, sessionA.topic,
    );
  } catch (e) {
    console.error('[batch-sessions/swap] Notification block failed:', e);
  }

  return NextResponse.json({
    success: true,
    message: 'Sessions swapped successfully',
    data: {
      sessionA: { id: sessionAId, now: { subject: sessionB.subject, teacher_email: sessionB.teacher_email, teacher_name: sessionB.teacher_name, topic: sessionB.topic } },
      sessionB: { id: sessionBId, now: { subject: sessionA.subject, teacher_email: sessionA.teacher_email, teacher_name: sessionA.teacher_name, topic: sessionA.topic } },
    },
  });
}
