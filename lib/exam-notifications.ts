// ═══════════════════════════════════════════════════════════════
// Exam Notification Helpers
// Sends WhatsApp + Email when exams are published or results released
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { sendWhatsApp, type TemplateName } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/email';

type ExamNotificationType = 'exam_scheduled' | 'results_published';

export async function sendExamNotifications(
  exam: Record<string, unknown>,
  type: ExamNotificationType
) {
  const examId = exam.id as string;
  const examTitle = (exam.title as string) || 'Exam';
  const subject = (exam.subject as string) || '';

  // Get students in this exam's assigned batches
  // exam_batch_assignments maps exam_id → room_id, rooms have batch_id → batch_students
  const studentsResult = await db.query(
    `SELECT DISTINCT bs.student_email, pu.full_name AS student_name,
            bs.parent_email, up_p.phone AS parent_phone, up_p.whatsapp AS parent_whatsapp,
            pu_p.full_name AS parent_name
     FROM exam_batch_assignments eba
     JOIN rooms r ON r.room_id = eba.room_id
     JOIN batch_students bs ON bs.batch_id = r.batch_id AND bs.student_status = 'active'
     LEFT JOIN portal_users pu ON pu.email = bs.student_email
     LEFT JOIN user_profiles up_p ON up_p.email = bs.parent_email
     LEFT JOIN portal_users pu_p ON pu_p.email = bs.parent_email
     WHERE eba.exam_id = $1`,
    [examId]
  );

  if (studentsResult.rows.length === 0) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;

  for (const row of studentsResult.rows as Array<Record<string, unknown>>) {
    const studentName = (row.student_name as string) || 'Student';
    const studentEmail = row.student_email as string;
    const parentName = (row.parent_name as string) || 'Parent';
    const parentPhone = (row.parent_whatsapp || row.parent_phone) as string | null;

    if (type === 'exam_scheduled') {
      const date = exam.scheduled_at
        ? new Date(exam.scheduled_at as string).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'TBA';

      // WhatsApp to student (via parent phone if available)
      if (parentPhone) {
        const r = await sendWhatsApp({
          to: parentPhone,
          template: 'exam_scheduled' as TemplateName,
          templateData: { studentName, examTitle, date, subject },
          recipientEmail: studentEmail,
        });
        if (r.success) sent++; else failed++;
      }

      // Email to student
      await sendEmail({
        to: studentEmail,
        subject: `Exam Scheduled: ${examTitle} on ${date}`,
        html: `<p>Hi ${studentName},</p><p>An exam has been scheduled:</p><p><strong>${examTitle}</strong><br/>Subject: ${subject}<br/>Date: ${date}</p><p>Prepare well!</p><p>— stibe</p>`,
        text: `Hi ${studentName},\n\nAn exam has been scheduled:\n${examTitle}\nSubject: ${subject}\nDate: ${date}\n\nPrepare well!\n— stibe`,
      }).then(r => { if (r.success) sent++; else failed++; });

    } else if (type === 'results_published') {
      // Get student's attempt result
      const attemptResult = await db.query(
        `SELECT score, percentage, total_marks
         FROM exam_attempts
         WHERE exam_id = $1 AND student_email = $2
         ORDER BY created_at DESC LIMIT 1`,
        [examId, studentEmail]
      );
      const attempt = attemptResult.rows[0] as Record<string, unknown> | undefined;
      const score = attempt ? `${attempt.score}/${attempt.total_marks}` : 'N/A';
      const percentage = attempt ? String(Number(attempt.percentage || 0).toFixed(1)) : '0';
      const grade = Number(percentage) >= 90 ? 'A+' : Number(percentage) >= 80 ? 'A' : Number(percentage) >= 70 ? 'B' : Number(percentage) >= 60 ? 'C' : Number(percentage) >= 50 ? 'D' : 'F';

      // WhatsApp
      if (parentPhone) {
        const r = await sendWhatsApp({
          to: parentPhone,
          template: 'exam_result' as TemplateName,
          templateData: { studentName, examTitle, score, grade, percentage },
          recipientEmail: studentEmail,
        });
        if (r.success) sent++; else failed++;
      }

      // Email to student
      await sendEmail({
        to: studentEmail,
        subject: `Results Published: ${examTitle}`,
        html: `<p>Hi ${studentName},</p><p>Results for <strong>${examTitle}</strong> are now available:</p><p>Score: ${score}<br/>Percentage: ${percentage}%<br/>Grade: ${grade}</p><p>View full details on your dashboard.</p><p>— stibe</p>`,
        text: `Hi ${studentName},\n\nResults for ${examTitle} are now available:\nScore: ${score}\nPercentage: ${percentage}%\nGrade: ${grade}\n\nView full details on your dashboard.\n— stibe`,
      }).then(r => { if (r.success) sent++; else failed++; });

      // Email to parent if available
      if (row.parent_email) {
        await sendEmail({
          to: row.parent_email as string,
          subject: `${studentName}'s Exam Results: ${examTitle}`,
          html: `<p>Dear ${parentName},</p><p>Exam results for your child <strong>${studentName}</strong>:</p><p><strong>${examTitle}</strong><br/>Score: ${score}<br/>Percentage: ${percentage}%<br/>Grade: ${grade}</p><p>View details at: <a href="https://stibelearning.online/parent">stibe Dashboard</a></p><p>— stibe</p>`,
          text: `Dear ${parentName},\n\nExam results for ${studentName}:\n${examTitle}\nScore: ${score}\nPercentage: ${percentage}%\nGrade: ${grade}\n\nView details at: https://stibelearning.online/parent\n— stibe`,
        }).then(r => { if (r.success) sent++; else failed++; });
      }
    }
  }

  console.log(`[exam-notify] ${type} for exam ${examId}: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}
