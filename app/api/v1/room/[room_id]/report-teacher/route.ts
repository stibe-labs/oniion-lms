// ═══════════════════════════════════════════════════════════════
// Report Teacher API — POST /api/v1/room/[room_id]/report-teacher
// ═══════════════════════════════════════════════════════════════
// Students report teachers from live classroom.
// Immediately notifies batch coordinator, academic operator, and owner.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db, resolveRoomId } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import {
  teacherReportNotifyTemplate,
  type TeacherReportNotifyData,
} from '@/lib/email-templates';

const VALID_CATEGORIES = [
  'sexual_abuse', 'inappropriate_behaviour', 'bad_performance',
  'doubt_not_cleared', 'abusive_language', 'discrimination',
  'unprofessional_conduct', 'other',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  sexual_abuse: 'Sexual Abuse / Harassment',
  inappropriate_behaviour: 'Inappropriate Behaviour',
  bad_performance: 'Bad Teaching Performance',
  doubt_not_cleared: 'Not Clearing Doubts',
  abusive_language: 'Abusive / Offensive Language',
  discrimination: 'Discrimination / Bias',
  unprofessional_conduct: 'Unprofessional Conduct',
  other: 'Other',
};

const CATEGORY_SEVERITY: Record<string, string> = {
  sexual_abuse: 'critical',
  inappropriate_behaviour: 'high',
  abusive_language: 'high',
  discrimination: 'high',
  bad_performance: 'medium',
  doubt_not_cleared: 'low',
  unprofessional_conduct: 'medium',
  other: 'medium',
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);
    const body = await req.json();
    const { student_email, student_name, category, description } = body;

    if (!student_email || !category) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });
    }

    // Get room details for teacher info
    const roomRes = await db.query(
      `SELECT r.room_id, r.room_name, r.teacher_email, r.batch_id,
              pu.full_name AS teacher_name
       FROM rooms r
       LEFT JOIN portal_users pu ON pu.email = r.teacher_email
       WHERE r.room_id = $1`,
      [actualRoomId],
    );

    if (roomRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    const room = roomRes.rows[0] as {
      room_id: string; room_name: string; teacher_email: string;
      batch_id: string | null; teacher_name: string | null;
    };

    const severity = CATEGORY_SEVERITY[category] || 'medium';
    const safeDescription = (description || '').slice(0, 2000);

    // Insert report
    const insertRes = await db.query(
      `INSERT INTO teacher_reports
         (room_id, batch_id, student_email, student_name, teacher_email, teacher_name, category, description, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [
        actualRoomId,
        room.batch_id,
        student_email,
        (student_name || '').slice(0, 200),
        room.teacher_email,
        room.teacher_name || room.teacher_email,
        category,
        safeDescription,
        severity,
      ],
    );

    const report = insertRes.rows[0] as { id: string; created_at: string };

    // Gather recipients: batch_coordinator, academic_operator, owner
    const recipientsRes = await db.query(
      `SELECT email, full_name, portal_role AS role FROM portal_users
       WHERE portal_role IN ('batch_coordinator', 'academic_operator', 'owner')
         AND is_active = true`,
    );

    const recipients = recipientsRes.rows as { email: string; full_name: string; role: string }[];
    const notifiedRoles: string[] = [];
    const reportedAt = new Date(report.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Send notifications to all recipients (fire-and-forget)
    for (const r of recipients) {
      const templateData: TeacherReportNotifyData = {
        recipientName: r.full_name || r.email,
        recipientRole: r.role,
        recipientEmail: r.email,
        studentName: student_name || student_email,
        teacherName: room.teacher_name || room.teacher_email,
        roomName: room.room_name || actualRoomId,
        category,
        categoryLabel: CATEGORY_LABELS[category] || category,
        description: safeDescription,
        severity,
        reportId: report.id,
        reportedAt,
      };

      const template = teacherReportNotifyTemplate(templateData);
      sendEmail({
        to: r.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        priority: severity === 'critical' ? 'high' : 'normal',
      }).catch((err) => console.error(`[report-teacher] Failed to notify ${r.email}:`, err));

      if (!notifiedRoles.includes(r.role)) notifiedRoles.push(r.role);
    }

    // Update notified_roles
    if (notifiedRoles.length > 0) {
      await db.query(
        `UPDATE teacher_reports SET notified_roles = $1 WHERE id = $2`,
        [notifiedRoles, report.id],
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: report.id, notified: recipients.length },
    });
  } catch (err) {
    console.error('[report-teacher] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
