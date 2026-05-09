import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db, resolveRoomId } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { absentNotificationTemplate } from '@/lib/email-templates';

/**
 * POST /api/v1/room/[room_id]/attendance/mark-absent
 *
 * Marks all unjoined students as absent and sends email + WhatsApp
 * notifications to students and their parents.
 *
 * Auth: batch_coordinator, teacher, academic_operator, owner
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

    // Get room info
    const roomRes = await db.query(
      `SELECT r.room_id, r.room_name, r.subject, r.teacher_email,
              r.scheduled_start, r.duration_minutes, r.batch_id,
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
      room_id: string; room_name: string; subject: string; teacher_email: string;
      scheduled_start: string; duration_minutes: number; batch_id: string;
      batch_name: string; teacher_name: string;
    };

    // Get all enrolled students (room_assignments + batch_students fallback)
    const enrolledRes = await db.query(
      `SELECT participant_email, participant_name FROM room_assignments
       WHERE room_id = $1 AND participant_type = 'student'
       UNION
       SELECT bs.student_email, COALESCE(pu.full_name, bs.student_email)
       FROM batch_students bs
       JOIN rooms r ON r.batch_id = bs.batch_id AND r.room_id = $1
       LEFT JOIN portal_users pu ON pu.email = bs.student_email`,
      [actualRoomId],
    );

    // Get students who already have attendance records (joined at some point)
    const joinedRes = await db.query(
      `SELECT participant_email FROM attendance_sessions
       WHERE room_id = $1 AND participant_role = 'student'`,
      [actualRoomId],
    );
    const joinedEmails = new Set(
      (joinedRes.rows as { participant_email: string }[]).map(r => r.participant_email),
    );

    // Filter to only unjoined students
    const absentStudents = (enrolledRes.rows as { participant_email: string; participant_name: string }[])
      .filter(s => !joinedEmails.has(s.participant_email));

    if (absentStudents.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { marked: 0, students: [] },
        message: 'All students have joined — no absences to mark',
      });
    }

    // Format date/time for notifications
    const schedDate = new Date(room.scheduled_start);
    const dateStr = schedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = schedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const markedStudents: string[] = [];

    for (const student of absentStudents) {
      // 1. Insert absent record into attendance_sessions
      await db.query(
        `INSERT INTO attendance_sessions (room_id, participant_email, participant_name, participant_role, status)
         VALUES ($1, $2, $3, 'student', 'absent')
         ON CONFLICT (room_id, participant_email) DO UPDATE SET status = 'absent', updated_at = NOW()`,
        [actualRoomId, student.participant_email, student.participant_name],
      );

      // 2. Log the absent event
      await db.query(
        `INSERT INTO attendance_logs (room_id, participant_email, participant_name, participant_role, event_type, event_at, payload)
         VALUES ($1, $2, $3, 'student', 'absent_marked', NOW(), $4)`,
        [actualRoomId, student.participant_email, student.participant_name,
         JSON.stringify({ marked_by: user.id, auto: true })],
      );

      markedStudents.push(student.participant_email);

      // 3. Send email to student
      const studentTemplate = absentNotificationTemplate({
        recipientName: student.participant_name,
        recipientEmail: student.participant_email,
        studentName: student.participant_name,
        subject: room.subject || 'General',
        batchName: room.batch_name || room.room_name || 'Class',
        date: dateStr,
        time: timeStr,
        teacherName: room.teacher_name,
        isParent: false,
      });
      sendEmail({
        to: student.participant_email,
        ...studentTemplate,
        waTemplate: 'stibe_alert',
        waParams: [student.participant_name, `You were marked absent from ${room.subject || 'General'} class on ${dateStr}.`],
      }).catch(() => {});

      // 4. Send email to parent (if parent_email exists)
      const parentRes = await db.query(
        `SELECT up.parent_email, COALESCE(pu.full_name, up.parent_email) AS parent_name
         FROM user_profiles up
         LEFT JOIN portal_users pu ON pu.email = up.parent_email
         WHERE up.email = $1 AND up.parent_email IS NOT NULL`,
        [student.participant_email],
      );

      if (parentRes.rows.length > 0) {
        const parent = parentRes.rows[0] as { parent_email: string; parent_name: string };
        const parentTemplate = absentNotificationTemplate({
          recipientName: parent.parent_name,
          recipientEmail: parent.parent_email,
          studentName: student.participant_name,
          subject: room.subject || 'General',
          batchName: room.batch_name || room.room_name || 'Class',
          date: dateStr,
          time: timeStr,
          teacherName: room.teacher_name,
          isParent: true,
        });
        sendEmail({
          to: parent.parent_email,
          ...parentTemplate,
          waTemplate: 'stibe_alert',
          waParams: [parent.parent_name, `${student.participant_name} was marked absent from ${room.subject || 'General'} class on ${dateStr}.`],
        }).catch(() => {});
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { marked: markedStudents.length, students: markedStudents },
      message: `${markedStudents.length} student${markedStudents.length !== 1 ? 's' : ''} marked absent — notifications sent`,
    });
  } catch (err) {
    console.error('[mark-absent POST] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
