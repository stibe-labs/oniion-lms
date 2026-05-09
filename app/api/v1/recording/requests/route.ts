// ═══════════════════════════════════════════════════════════════
// Video Access Requests — /api/v1/recording/requests
// POST: student creates request
// GET:  AO/owner fetches pending requests
// PATCH: AO/owner approves or rejects
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { sendWhatsApp } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/email';
import { getPlatformName } from '@/lib/platform-config';

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

// ── POST: Student submits a video access request ─────────────
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user || user.role !== 'student')
    return NextResponse.json({ success: false, error: 'Students only' }, { status: 403 });

  const body = await req.json();
  const { room_id, reason } = body;
  if (!room_id) return NextResponse.json({ success: false, error: 'room_id required' }, { status: 400 });

  // Verify the room exists and is ended with a recording
  const room = await db.query(
    `SELECT room_id, recording_url FROM rooms WHERE room_id = $1 AND status = 'ended'`,
    [room_id],
  );
  if (room.rows.length === 0)
    return NextResponse.json({ success: false, error: 'Room not found or not ended' }, { status: 404 });
  if (!room.rows[0].recording_url)
    return NextResponse.json({ success: false, error: 'No recording available for this session' }, { status: 400 });

  // Check for duplicate
  const existing = await db.query(
    `SELECT id, status FROM video_access_requests WHERE room_id = $1 AND student_email = $2`,
    [room_id, user.id],
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({
      success: false,
      error: existing.rows[0].status === 'pending' ? 'Request already pending' : 'You already requested access to this recording',
    }, { status: 409 });
  }

  const result = await db.query(
    `INSERT INTO video_access_requests (room_id, student_email, reason)
     VALUES ($1, $2, $3)
     RETURNING id, status, created_at`,
    [room_id, user.id, reason || ''],
  );

  return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
}

// ── GET: Students see own requests; AO/Owner see all ─────────
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Students can only see their own requests (lightweight)
  if (user.role === 'student') {
    const result = await db.query(
      `SELECT v.id, v.room_id, v.status, v.recording_url, v.created_at, v.reviewed_at
       FROM video_access_requests v
       WHERE v.student_email = $1
       ORDER BY v.created_at DESC`,
      [user.id],
    );
    return NextResponse.json({ success: true, data: result.rows });
  }

  if (!['academic_operator', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

  const status = req.nextUrl.searchParams.get('status') || 'pending';

  // AO data isolation: only show requests for rooms in AO's batches
  const aoFilter = user.role === 'academic_operator'
    ? `AND r.batch_id IN (SELECT batch_id FROM batches WHERE academic_operator_email = $2)`
    : '';
  const queryParams = user.role === 'academic_operator' ? [status, user.id] : [status];

  const result = await db.query(
    `SELECT v.id, v.room_id, v.student_email, v.reason, v.status,
            v.reviewed_by, v.review_notes, v.recording_url, v.created_at, v.reviewed_at,
            r.room_name, r.subject, r.grade, r.teacher_email, r.recording_url AS room_recording_url,
            r.scheduled_start,
            u.full_name AS student_name,
            t.full_name AS teacher_name
     FROM video_access_requests v
     JOIN rooms r ON r.room_id = v.room_id
     LEFT JOIN portal_users u ON u.email = v.student_email
     LEFT JOIN portal_users t ON t.email = r.teacher_email
     WHERE ($1 = 'all' OR v.status = $1) ${aoFilter}
     ORDER BY v.created_at DESC
     LIMIT 100`,
    queryParams,
  );

  return NextResponse.json({ success: true, data: result.rows });
}

// ── PATCH: AO/Owner approves or rejects ──────────────────────
export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !['academic_operator', 'owner'].includes(user.role))
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { id, action, notes } = body;
  if (!id || !['approve', 'reject'].includes(action))
    return NextResponse.json({ success: false, error: 'id and action (approve|reject) required' }, { status: 400 });

  // Get the request and its recording URL
  const request = await db.query(
    `SELECT v.id, v.room_id, v.student_email, v.status, r.recording_url
     FROM video_access_requests v
     JOIN rooms r ON r.room_id = v.room_id
     WHERE v.id = $1`,
    [id],
  );
  if (request.rows.length === 0)
    return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
  if (request.rows[0].status !== 'pending')
    return NextResponse.json({ success: false, error: 'Request already reviewed' }, { status: 409 });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const recordingUrl = action === 'approve' ? request.rows[0].recording_url : null;

  await db.query(
    `UPDATE video_access_requests
     SET status = $1, reviewed_by = $2, review_notes = $3, recording_url = $4, reviewed_at = NOW()
     WHERE id = $5`,
    [newStatus, user.id, notes || null, recordingUrl, id],
  );

  // Fire-and-forget: Notify student about video access decision
  const reqRow = request.rows[0] as Record<string, unknown>;
  const studentEmail = reqRow.student_email as string;
  (async () => {
    try {
      // Get student details for notification
      const studentResult = await db.query(
        `SELECT pu.full_name, up.phone, up.whatsapp
         FROM portal_users pu
         LEFT JOIN user_profiles up ON up.email = pu.email
         WHERE pu.email = $1`,
        [studentEmail],
      );
      const student = studentResult.rows[0] as Record<string, unknown> | undefined;
      const studentName = (student?.full_name as string) || 'Student';
      const phone = (student?.whatsapp || student?.phone) as string | null;

      // Get room name for context
      const roomResult = await db.query(
        `SELECT room_name FROM rooms WHERE room_id = $1`,
        [reqRow.room_id],
      );
      const roomName = (roomResult.rows[0] as Record<string, unknown>)?.room_name as string || 'Recording';

      // Send WhatsApp
      if (phone) {
        await sendWhatsApp({
          to: phone,
          template: 'video_access',
          templateData: { studentName, roomName, status: newStatus },
          recipientEmail: studentEmail,
        });
      }

      // Send Email
      const statusText = newStatus === 'approved' ? 'approved' : 'rejected';
      const platformName = await getPlatformName();
      await sendEmail({
        to: studentEmail,
        subject: `Video Access ${statusText === 'approved' ? 'Approved' : 'Rejected'}: ${roomName}`,
        html: `<p>Hi ${studentName},</p><p>Your video access request for <strong>${roomName}</strong> has been <strong>${statusText}</strong>.</p>${newStatus === 'approved' ? '<p>You can now watch the recording from your dashboard.</p>' : `<p>Reason: ${notes || 'No reason provided'}</p>`}<p>— ${platformName}</p>`,
        text: `Hi ${studentName},\n\nYour video access request for ${roomName} has been ${statusText}.\n${newStatus === 'approved' ? 'You can now watch the recording from your dashboard.' : `Reason: ${notes || 'No reason provided'}`}\n— ${platformName}`,
      });
    } catch (err) {
      console.error('[recording/requests] Notification send failed:', err);
    }
  })();

  return NextResponse.json({ success: true, data: { id, status: newStatus } });
}
