// ═══════════════════════════════════════════════════════════════
// stibe Portal — Email Service (Step 05)
// ═══════════════════════════════════════════════════════════════
// Single entry point for all email sending. Uses Nodemailer
// for SMTP transport. In dev mode with EMAIL_MODE=log, emails
// are printed to console instead of sent.
// ═══════════════════════════════════════════════════════════════

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { db } from '@/lib/db';
import { fireWhatsApp, type MetaButtonUrl } from '@/lib/whatsapp';
import { generatePayToken } from '@/lib/pay-token';
import {
  teacherInviteTemplate,
  studentInviteTemplate,
  paymentConfirmationTemplate,
  roomReminderTemplate,
  roomCancelledTemplate,
  roomRescheduledTemplate,
  coordinatorSummaryTemplate,
  batchCoordinatorNotifyTemplate,
  batchTeacherNotifyTemplate,
  batchStudentNotifyTemplate,
  batchParentNotifyTemplate,
  invoiceGeneratedTemplate,
  paymentReceiptTemplate,
  payslipNotificationTemplate,
  paymentReminderTemplate,
  refundApprovedTemplate,
  lowCreditsWarningTemplate,
  type TeacherInviteData,
  type StudentInviteData,
  type PaymentConfirmationData,
  type RoomReminderData,
  type RoomCancelledData,
  type RoomRescheduledData,
  type CoordinatorSummaryData,
  type BatchCoordinatorNotifyData,
  type BatchTeacherNotifyData,
  type BatchStudentNotifyData,
  type BatchParentNotifyData,
  type InvoiceGeneratedData,
  type PaymentReceiptData,
  type PayslipNotificationData,
  type PaymentReminderData,
  type RefundApprovedData,
  type LowCreditsWarningData,
} from '@/lib/email-templates';

// ── Singleton Transporter ───────────────────────────────────

const globalForEmail = globalThis as unknown as {
  emailTransporter: Transporter | undefined;
};

function getTransporter(): Transporter {
  if (globalForEmail.emailTransporter) {
    return globalForEmail.emailTransporter;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.SMTP_USERNAME,
      // Gmail App Passwords are displayed with spaces but must be used without
      pass: (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').replace(/\s/g, ''),
    },
    tls: {
      rejectUnauthorized: false, // allow self-signed certs in dev
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForEmail.emailTransporter = transporter;
  }

  return transporter;
}

// ── Send Options ────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  /** @deprecated Use waTemplate + waParams instead */
  waTemplateType?: string;
  /** Meta WhatsApp template name (e.g. 'stibe_receipt') */
  waTemplate?: string;
  /** Pre-extracted template params in order: {{1}}, {{2}}, ... */
  waParams?: string[];
  /** CTA button URL suffixes for Meta templates with URL buttons */
  waButtonUrls?: MetaButtonUrl[];
  /** Override phone number for WA (for recipients not in user_profiles, e.g. demo students) */
  recipientPhone?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Core Send Function ──────────────────────────────────────

const DEV_LOG_MODE = process.env.EMAIL_MODE === 'log';

/**
 * Core email send function. In dev mode with EMAIL_MODE=log,
 * prints to console instead of sending. Includes single retry
 * on first failure (30s delay).
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const from = `"${process.env.EMAIL_FROM_NAME || 'stibe Classes'}" <${process.env.EMAIL_FROM_ADDRESS || 'noreply@stibelearning.online'}>`;

  // ── Dev log mode — print to console, skip SMTP ────────
  if (DEV_LOG_MODE) {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    console.log('\n┌─── EMAIL (DEV LOG MODE) ────────────────────────────┐');
    console.log(`│ To:      ${recipients}`);
    console.log(`│ From:    ${from}`);
    console.log(`│ Subject: ${options.subject}`);
    console.log(`│ Priority:${options.priority || 'normal'}`);
    console.log('├──────────────────────────────────────────────────────┤');
    console.log(`│ Text Preview (first 200 chars):`);
    console.log(`│ ${options.text.substring(0, 200).replace(/\n/g, '\n│ ')}`);
    console.log('└──────────────────────────────────────────────────────┘\n');
    // Still fire WhatsApp in dev mode (mock mode will just log)
    mirrorToWhatsApp(options);
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  // ── Production SMTP send with retry ───────────────────
  const mailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
    priority: options.priority,
  };

  const transporter = getTransporter();

  // First attempt
  try {
    const info = await transporter.sendMail(mailOptions);
    mirrorToWhatsApp(options);
    return { success: true, messageId: info.messageId };
  } catch (firstError: any) {
    // Don't retry on authentication errors — password is wrong, retrying is pointless
    // Also flush cached transporter so next call re-reads env vars
    if (firstError?.code === 'EAUTH' || firstError?.responseCode === 535) {
      const errMsg = firstError instanceof Error ? firstError.message : String(firstError);
      console.error('[Email] Auth error (not retrying):', errMsg);
      globalForEmail.emailTransporter = undefined; // flush stale transporter
      return { success: false, error: errMsg };
    }
    console.warn('[Email] First attempt failed, retrying in 30s...', firstError);
  }

  // Wait 30 seconds and retry once
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  try {
    const info = await transporter.sendMail(mailOptions);
    mirrorToWhatsApp(options);
    return { success: true, messageId: info.messageId };
  } catch (secondError) {
    const errMsg = secondError instanceof Error ? secondError.message : String(secondError);
    console.error('[Email] Second attempt failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

// ── WhatsApp Mirror (fire-and-forget after every email) ─────

/**
 * After every successful email, send the same content via WhatsApp.
 * Looks up the recipient's WhatsApp number from user_profiles.
 * Non-blocking — never delays email delivery or throws.
 */
function mirrorToWhatsApp(options: SendEmailOptions): void {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const waMessage = `*${options.subject}*\n\n${options.text.substring(0, 3500)}\n\n_stibe Online Classes_`;
  for (const email of recipients) {
    fireWhatsApp(email, waMessage, options.waTemplateType, options.waTemplate, options.waParams, options.recipientPhone, options.waButtonUrls).catch(() => {});
  }
}

// ── Email Log Helpers ───────────────────────────────────────

/**
 * Log a queued email to the email_log table. Returns the log ID.
 */
export async function logEmailQueued(
  roomId: string | null,
  recipientEmail: string,
  templateType: string,
  subject: string
): Promise<string> {
  // Verify room_id exists (FK constraint on email_log.room_id → rooms.room_id)
  let safeRoomId = roomId;
  if (roomId) {
    const roomCheck = await db.query('SELECT 1 FROM rooms WHERE room_id = $1', [roomId]);
    if (roomCheck.rows.length === 0) safeRoomId = null;
  }
  const result = await db.query<{ id: string }>(
    `INSERT INTO email_log (room_id, recipient_email, template_type, subject, status)
     VALUES ($1, $2, $3, $4, 'queued')
     RETURNING id`,
    [safeRoomId, recipientEmail, templateType, subject]
  );
  return result.rows[0].id;
}

/**
 * Update email log to sent status.
 */
export async function logEmailSent(logId: string, smtpMessageId?: string): Promise<void> {
  await db.query(
    `UPDATE email_log SET status = 'sent', smtp_message_id = $1, sent_at = NOW() WHERE id = $2`,
    [smtpMessageId || null, logId]
  );
}

/**
 * Update email log to failed status.
 */
export async function logEmailFailed(logId: string, errorMessage: string): Promise<void> {
  await db.query(
    `UPDATE email_log SET status = 'failed', error_message = $1 WHERE id = $2`,
    [errorMessage, logId]
  );
}

// ── Convenience Senders (template + send + log + WhatsApp) ──

export async function sendTeacherInvite(data: TeacherInviteData & { roomId: string }): Promise<SendEmailResult> {
  const { subject, html, text } = teacherInviteTemplate(data);
  const logId = await logEmailQueued(data.roomId, data.recipientEmail, 'teacher_invite', subject);

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate: 'stibe_teacher_class',
    waParams: [data.teacherName, data.roomName, data.subject, data.date, data.time, data.duration],
  });

  if (result.success) {
    await logEmailSent(logId, result.messageId);
  } else {
    await logEmailFailed(logId, result.error || 'Unknown error');
  }
  return result;
}

export async function sendStudentInvite(data: StudentInviteData & { roomId: string }): Promise<SendEmailResult> {
  const { subject, html, text } = studentInviteTemplate(data);
  const logId = await logEmailQueued(data.roomId, data.recipientEmail, 'student_invite', subject);

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate: 'stibe_student_class',
    waParams: [data.studentName, data.roomName, data.subject, data.date, data.time, data.duration],
  });

  if (result.success) {
    await logEmailSent(logId, result.messageId);
  } else {
    await logEmailFailed(logId, result.error || 'Unknown error');
  }
  return result;
}

export async function sendPaymentConfirmation(data: PaymentConfirmationData & { roomId: string }): Promise<SendEmailResult> {
  const { subject, html, text } = paymentConfirmationTemplate(data);
  const logId = await logEmailQueued(data.roomId, data.recipientEmail, 'payment_confirmation', subject);

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'high',
    waTemplate: 'stibe_payment_done',
    waParams: [data.studentName, data.amount, data.transactionId, data.date],
  });

  if (result.success) {
    await logEmailSent(logId, result.messageId);
  } else {
    await logEmailFailed(logId, result.error || 'Unknown error');
  }
  return result;
}

export async function sendRoomReminder(data: RoomReminderData & { roomId: string }): Promise<SendEmailResult> {
  const { subject, html, text } = roomReminderTemplate(data);
  const logId = await logEmailQueued(data.roomId, data.recipientEmail, 'room_reminder', subject);

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'high',
    waTemplate: 'stibe_class_reminder',
    waParams: [data.recipientName, data.roomName, data.startTime, data.teacherName || 'Teacher', 'stibe'],
  });

  if (result.success) {
    await logEmailSent(logId, result.messageId);
  } else {
    await logEmailFailed(logId, result.error || 'Unknown error');
  }
  return result;
}

export async function sendRoomCancelled(data: RoomCancelledData & { roomId: string }): Promise<SendEmailResult> {
  const { subject, html, text } = roomCancelledTemplate(data);
  const logId = await logEmailQueued(data.roomId, data.recipientEmail, 'room_cancelled', subject);

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'high',
    waTemplate: 'stibe_class_cancelled',
    waParams: [data.roomName, data.roomName, data.date, data.time],
  });

  if (result.success) {
    await logEmailSent(logId, result.messageId);
  } else {
    await logEmailFailed(logId, result.error || 'Unknown error');
  }
  return result;
}

export async function sendRoomRescheduled(data: RoomRescheduledData & { roomId: string }): Promise<SendEmailResult> {
  const { subject, html, text } = roomRescheduledTemplate(data);
  const logId = await logEmailQueued(data.roomId, data.recipientEmail, 'room_rescheduled', subject);

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'high',
    waTemplate: 'stibe_class_rescheduled',
    waParams: [data.roomName, data.roomName, data.oldDate, data.oldTime, data.newDate, data.newTime],
  });

  if (result.success) {
    await logEmailSent(logId, result.messageId);
  } else {
    await logEmailFailed(logId, result.error || 'Unknown error');
  }
  return result;
}

export async function sendCoordinatorSummary(data: CoordinatorSummaryData & { roomId: string }): Promise<SendEmailResult> {
  const { subject, html, text } = coordinatorSummaryTemplate(data);
  const logId = await logEmailQueued(data.roomId, data.recipientEmail, 'coordinator_summary', subject);

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'low',
    waTemplate: 'stibe_coord_summary',
    waParams: [data.coordinatorName, data.roomName, data.date, `${data.studentCount} students, ${data.unpaidCount} unpaid`],
  });

  if (result.success) {
    await logEmailSent(logId, result.messageId);
  } else {
    await logEmailFailed(logId, result.error || 'Unknown error');
  }
  return result;
}

// ── Batch Creation Notification Senders ─────────────────────

export async function sendBatchCoordinatorNotify(data: BatchCoordinatorNotifyData): Promise<SendEmailResult> {
  const { subject, html, text } = batchCoordinatorNotifyTemplate(data);
  console.log(`[Email] Sending batch coordinator notify to ${data.recipientEmail}`);
  return sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate: 'stibe_batch_assign',
    waParams: [data.coordinatorName, data.batchName, 'Coordinator', `${data.studentCount} students, ${data.teacherCount} teachers`],
  });
}

export async function sendBatchTeacherNotify(data: BatchTeacherNotifyData): Promise<SendEmailResult> {
  const { subject, html, text } = batchTeacherNotifyTemplate(data);
  console.log(`[Email] Sending batch teacher notify to ${data.recipientEmail}`);
  return sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate: 'stibe_batch_assign',
    waParams: [data.teacherName, data.batchName, 'Teacher', `Subject: ${data.assignedSubject}`],
  });
}

export async function sendBatchStudentNotify(data: BatchStudentNotifyData): Promise<SendEmailResult> {
  const { subject, html, text } = batchStudentNotifyTemplate(data);
  console.log(`[Email] Sending batch student notify to ${data.recipientEmail}`);
  return sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate: 'stibe_batch_assign',
    waParams: [data.studentName, data.batchName, 'Student', `${data.teachers.length} subjects`],
  });
}

export async function sendBatchParentNotify(data: BatchParentNotifyData): Promise<SendEmailResult> {
  const { subject, html, text } = batchParentNotifyTemplate(data);
  console.log(`[Email] Sending batch parent notify to ${data.recipientEmail}`);
  return sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate: 'stibe_batch_assign',
    waParams: [data.parentName, data.batchName, 'Parent', `Child: ${data.childName}`],
  });
}

// ── Payment & Invoice Email Senders ─────────────────────────

export async function sendInvoiceGenerated(data: InvoiceGeneratedData): Promise<SendEmailResult> {
  const { subject, html, text } = invoiceGeneratedTemplate(data);
  const logId = await logEmailQueued(null, data.recipientEmail, 'invoice_generated', subject);

  // Use CTA button template when invoiceId is available
  let waTemplate = 'stibe_invoice';
  let waButtonUrls: MetaButtonUrl[] | undefined;
  if (data.invoiceId) {
    const token = generatePayToken(data.invoiceId);
    const suffix = `${data.invoiceId}?t=${token}`;
    waTemplate = 'stibe_invoice_pay';
    waButtonUrls = [
      { index: 0, urlSuffix: suffix }, // Pay Now
      { index: 1, urlSuffix: suffix }, // View Invoice
    ];
  }

  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate,
    waParams: [data.recipientName, data.invoiceNumber, data.amount, data.dueDate],
    waButtonUrls,
    waTemplateType: 'invoice_generated', // fallback to approved stibe_invoice if waTemplate fails
  });
  if (result.success) await logEmailSent(logId, result.messageId);
  else await logEmailFailed(logId, result.error || 'Unknown error');
  return result;
}

export async function sendPaymentReceipt(data: PaymentReceiptData): Promise<SendEmailResult> {
  const { subject, html, text } = paymentReceiptTemplate(data);
  const logId = await logEmailQueued(null, data.recipientEmail, 'payment_receipt', subject);
  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'high',
    waTemplate: 'stibe_receipt',
    waParams: [data.recipientName, data.receiptNumber, data.amount, data.paymentDate],
  });
  if (result.success) await logEmailSent(logId, result.messageId);
  else await logEmailFailed(logId, result.error || 'Unknown error');
  return result;
}

export async function sendPayslipNotification(data: PayslipNotificationData): Promise<SendEmailResult> {
  const { subject, html, text } = payslipNotificationTemplate(data);
  const logId = await logEmailQueued(null, data.recipientEmail, 'payslip_notification', subject);
  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'normal',
    waTemplate: 'stibe_payslip',
    waParams: [data.teacherName, data.periodLabel, String(data.classesConducted), data.totalPay],
  });
  if (result.success) await logEmailSent(logId, result.messageId);
  else await logEmailFailed(logId, result.error || 'Unknown error');
  return result;
}

export async function sendPaymentReminder(data: PaymentReminderData): Promise<SendEmailResult> {
  const { subject, html, text } = paymentReminderTemplate(data);
  const logId = await logEmailQueued(null, data.recipientEmail, 'payment_reminder', subject);
  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'high',
    waTemplate: 'stibe_payment_reminder',
    waParams: [data.recipientName, data.amount, `${data.studentName} fees`, data.dueDate, data.invoiceNumber],
  });
  if (result.success) await logEmailSent(logId, result.messageId);
  else await logEmailFailed(logId, result.error || 'Unknown error');
  return result;
}

export async function sendRefundApproved(data: RefundApprovedData): Promise<SendEmailResult> {
  const { subject, html, text } = refundApprovedTemplate(data);
  const logId = await logEmailQueued(null, data.recipientEmail, 'refund_approved', subject);
  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: 'high',
    waTemplate: 'stibe_refund_approved',
    waParams: [data.recipientName, data.studentName, data.amount, data.sessionSubject, data.refundMethod],
  });
  if (result.success) await logEmailSent(logId, result.messageId);
  else await logEmailFailed(logId, result.error || 'Unknown error');
  return result;
}

export async function sendLowCreditsWarning(data: LowCreditsWarningData): Promise<SendEmailResult> {
  const { subject, html, text } = lowCreditsWarningTemplate(data);
  const logId = await logEmailQueued(null, data.recipientEmail, 'low_credits_warning', subject);
  const waMessage = data.isExhausted
    ? `🚫 *stibe — Credits Exhausted*\n\nDear ${data.recipientName},\n\nAll ${data.totalAllotted} prepaid sessions for *${data.studentName}* have been used.\n\n⚠️ Class access is blocked until renewed.\n\n💳 Renew now: ${data.renewLink}`
    : `⚠️ *stibe — Low Credits*\n\nDear ${data.recipientName},\n\nOnly *${data.remainingCredits}* of ${data.totalAllotted} prepaid sessions remain for *${data.studentName}*.\n\n💳 Renew: ${data.renewLink}`;
  const result = await sendEmail({
    to: data.recipientEmail, subject, html, text, priority: data.isExhausted ? 'high' : 'normal',
    waTemplate: 'stibe_payment_reminder',
    waParams: [
      data.recipientName,
      data.isExhausted ? 'Session renewal' : `${data.remainingCredits} credits left`,
      `${data.studentName} sessions`,
      'immediately',
      `Credits: ${data.remainingCredits}/${data.totalAllotted}`,
    ],
  });
  // Also fire WhatsApp with the custom text as fallback
  fireWhatsApp(data.recipientEmail, waMessage, 'low_credits_warning').catch(() => {});
  if (result.success) await logEmailSent(logId, result.messageId);
  else await logEmailFailed(logId, result.error || 'Unknown error');
  return result;
}
