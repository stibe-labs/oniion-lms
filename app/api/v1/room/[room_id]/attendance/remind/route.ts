import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db, resolveRoomId } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { joinReminderTemplate } from '@/lib/email-templates';

const BASE_URL = process.env.PORTAL_BASE_URL || 'https://stibelearning.online';

/**
 * POST /api/v1/room/[room_id]/attendance/remind
 *
 * Sends a "class is live — join now" reminder to a single student
 * (+ their parent). Each student can only be reminded once per room.
 *
 * Body: { email: string }
 * Auth: teacher, batch_coordinator, academic_operator, owner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);

    // Auth
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }
    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid session' },
        { status: 401 },
      );
    }
    const allowedRoles = ['teacher', 'batch_coordinator', 'academic_operator', 'owner'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Parse body
    const body = await request.json().catch(() => null);
    const studentEmail: string | undefined = body?.email;
    if (!studentEmail || typeof studentEmail !== 'string') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required field: email' },
        { status: 400 },
      );
    }

    // Check if already reminded (attendance_logs event_type = 'reminder_sent')
    const alreadySent = await db.query(
      `SELECT 1 FROM attendance_logs
       WHERE room_id = $1 AND participant_email = $2 AND event_type = 'reminder_sent'
       LIMIT 1`,
      [actualRoomId, studentEmail],
    );
    if (alreadySent.rows.length > 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { sent: false, reason: 'already_reminded' },
        message: 'Reminder already sent to this student',
      });
    }

    // Get room info
    const roomRes = await db.query(
      `SELECT r.room_id, r.room_name, r.subject, r.teacher_email, r.batch_id,
              b.batch_name,
              COALESCE(
                (SELECT full_name FROM portal_users WHERE email = r.teacher_email),
                r.teacher_email, 'Teacher'
              ) AS teacher_name
       FROM rooms r
       LEFT JOIN batches b ON b.batch_id = r.batch_id
       WHERE r.room_id = $1`,
      [actualRoomId],
    );
    if (roomRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Room not found' },
        { status: 404 },
      );
    }
    const room = roomRes.rows[0] as {
      room_id: string; room_name: string; subject: string;
      teacher_email: string; batch_id: string; batch_name: string; teacher_name: string;
    };

    // Get student name
    const studentRes = await db.query(
      `SELECT COALESCE(pu.full_name, ra.participant_name, $2) AS student_name
       FROM portal_users pu
       FULL OUTER JOIN room_assignments ra ON ra.participant_email = $2 AND ra.room_id = $1
       WHERE pu.email = $2
       LIMIT 1`,
      [actualRoomId, studentEmail],
    );
    const studentName = (studentRes.rows[0] as { student_name: string } | undefined)?.student_name || studentEmail;

    const joinUrl = `${BASE_URL}/student`;

    // Log the reminder event
    await db.query(
      `INSERT INTO attendance_logs (room_id, participant_email, participant_name, participant_role, event_type, event_at, payload)
       VALUES ($1, $2, $3, 'student', 'reminder_sent', NOW(), $4)`,
      [actualRoomId, studentEmail, studentName,
       JSON.stringify({ sent_by: user.id, sent_by_role: user.role })],
    );

    // Send email to student
    const studentTemplate = joinReminderTemplate({
      recipientName: studentName,
      recipientEmail: studentEmail,
      studentName,
      subject: room.subject || 'General',
      batchName: room.batch_name || room.room_name || 'Class',
      teacherName: room.teacher_name,
      joinUrl,
      isParent: false,
    });
    sendEmail({
      to: studentEmail,
      ...studentTemplate,
      waTemplate: 'stibe_alert',
      waParams: [studentName, `Your ${room.subject || 'General'} class is live now! Please join immediately.`],
    }).catch(() => {});

    // Send email to parent (if exists)
    const parentRes = await db.query(
      `SELECT up.parent_email, COALESCE(pu.full_name, up.parent_email) AS parent_name
       FROM user_profiles up
       LEFT JOIN portal_users pu ON pu.email = up.parent_email
       WHERE up.email = $1 AND up.parent_email IS NOT NULL`,
      [studentEmail],
    );
    if (parentRes.rows.length > 0) {
      const parent = parentRes.rows[0] as { parent_email: string; parent_name: string };
      const parentTemplate = joinReminderTemplate({
        recipientName: parent.parent_name,
        recipientEmail: parent.parent_email,
        studentName,
        subject: room.subject || 'General',
        batchName: room.batch_name || room.room_name || 'Class',
        teacherName: room.teacher_name,
        joinUrl,
        isParent: true,
      });
      sendEmail({
        to: parent.parent_email,
        ...parentTemplate,
        waTemplate: 'stibe_alert',
        waParams: [parent.parent_name, `${studentName} hasn't joined the ${room.subject || 'General'} class yet. The class is live now.`],
      }).catch(() => {});
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { sent: true, email: studentEmail },
      message: 'Reminder sent to student and parent',
    });

  } catch (err) {
    console.error('[remind] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to send reminder' },
      { status: 500 },
    );
  }
}
