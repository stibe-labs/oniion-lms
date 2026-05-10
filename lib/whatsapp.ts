// ═══════════════════════════════════════════════════════════════
// stibe Portal — WhatsApp Notification Service
// ═══════════════════════════════════════════════════════════════
// Meta WhatsApp Cloud API integration.
// Every email sent via lib/email.ts automatically triggers a
// WhatsApp mirror message (fire-and-forget) to the recipient's
// registered WhatsApp number in user_profiles.
//
// Also supports template-based sends (class reminders, payment
// dues, exam notifications, etc.) via sendWhatsApp().
//
// Env vars:
//   WHATSAPP_API_TOKEN        — Meta Graph API access token
//   WHATSAPP_PHONE_NUMBER_ID  — Phone Number ID from Meta dashboard
//   WHATSAPP_MODE             — 'live' | 'mock' (default: mock)
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { buildPayUrl } from '@/lib/pay-token';
import { getIntegrationConfig } from '@/lib/integration-config';

// ── Configuration (read from DB with env fallback) ──────────

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// Cache auto-discovered phone number ID
let cachedPhoneId: string | null = null;

async function getWAConfig() {
  const cfg = await getIntegrationConfig();
  return cfg.whatsapp;
}

/**
 * Resolve the WhatsApp phone number ID.
 * Uses DB/env config first; falls back to auto-discovery via Meta API.
 */
async function getPhoneNumberId(): Promise<string> {
  const wa = await getWAConfig();
  if (wa.phoneNumberId) return wa.phoneNumberId;
  if (cachedPhoneId) return cachedPhoneId;

  try {
    const wa = await getWAConfig();
    // Auto-discover: token → WABA ID → phone numbers
    const meRes = await fetch(`${GRAPH_API}/me?access_token=${wa.apiToken}`);
    const me = await meRes.json() as { id?: string };
    if (!me.id) throw new Error('Could not determine WABA ID');

    const phonesRes = await fetch(
      `${GRAPH_API}/${me.id}/phone_numbers?access_token=${wa.apiToken}`
    );
    const phones = await phonesRes.json() as { data?: Array<{ id: string }> };
    if (phones.data?.[0]?.id) {
      cachedPhoneId = phones.data[0].id;
      console.log(`[whatsapp] Auto-discovered phone_number_id: ${cachedPhoneId}`);
      return cachedPhoneId;
    }
    throw new Error('No phone numbers found on this WABA');
  } catch (err) {
    console.error('[whatsapp] Phone ID discovery failed:', err);
    return '';
  }
}

// ── Message Templates ───────────────────────────────────────

export const TEMPLATES = {
  class_reminder: (data: { studentName: string; subject: string; time: string; teacherName: string }) =>
    `📚 *stibe Class Reminder*\n\nHi ${data.studentName},\n\nYour *${data.subject}* class is starting at *${data.time}*.\nTeacher: ${data.teacherName}\n\nJoin from your dashboard: https://stibelearning.online/student`,

  payment_due: (data: { parentName: string; studentName: string; amount: string; dueDate: string; payLink?: string }) =>
    `💰 *stibe Fee Reminder*\n\nDear ${data.parentName},\n\nPayment of *${data.amount}* for ${data.studentName} is due by *${data.dueDate}*.${data.payLink ? `\n\n💳 *Pay Now:* ${data.payLink}` : '\n\nPay at: https://stibelearning.online/parent'}`,

  exam_scheduled: (data: { studentName: string; examTitle: string; date: string; subject: string }) =>
    `📝 *stibe Exam Notice*\n\nHi ${data.studentName},\n\nYou have an upcoming exam:\n*${data.examTitle}*\nSubject: ${data.subject}\nDate: ${data.date}\n\nPrepare well!`,

  exam_result: (data: { studentName: string; examTitle: string; score: string; grade: string; percentage: string }) =>
    `🎓 *stibe Exam Result*\n\nHi ${data.studentName},\n\n*${data.examTitle}* Results:\nScore: ${data.score}\nPercentage: ${data.percentage}%\nGrade: ${data.grade}\n\nView details at: https://stibelearning.online/student/exams`,

  attendance_alert: (data: { parentName: string; studentName: string; date: string; status: string }) =>
    `📋 *stibe Attendance Alert*\n\nDear ${data.parentName},\n\n${data.studentName} was *${data.status}* on ${data.date}.\n\nView details at: https://stibelearning.online/parent`,

  payment_overdue: (data: { parentName: string; studentName: string; amount: string; dueDate: string; payLink?: string }) =>
    `🚨 *stibe — Payment Overdue*\n\nDear ${data.parentName},\n\nPayment of *${data.amount}* for ${data.studentName} was due on *${data.dueDate}* and is now overdue.${data.payLink ? `\n\n💳 *Pay Now:* ${data.payLink}` : '\n\nPlease pay immediately to avoid class access disruption: https://stibelearning.online/parent'}`,

  video_access: (data: { studentName: string; roomName: string; status: string }) =>
    `🎥 *stibe — Video Access ${data.status === 'approved' ? 'Approved' : 'Rejected'}*\n\nHi ${data.studentName},\n\nYour video access request for *${data.roomName}* has been *${data.status}*.\n\n${data.status === 'approved' ? 'You can now watch the recording from your dashboard: https://stibelearning.online/student' : 'Contact your coordinator for more information.'}`,

  invoice_generated: (data: { recipientName: string; invoiceNumber: string; amount: string; dueDate: string; payLink?: string }) =>
    `📄 *stibe — New Invoice*\n\nDear ${data.recipientName},\n\nInvoice *${data.invoiceNumber}* of *${data.amount}* has been generated.\nDue by: ${data.dueDate}${data.payLink ? `\n\n💳 *Pay Now:* ${data.payLink}` : '\n\nPay at: https://stibelearning.online'}`,

  general: (data: { recipientName: string; message: string }) =>
    `📢 *stibe Notification*\n\nHi ${data.recipientName},\n\n${data.message}`,
} as const;

export type TemplateName = keyof typeof TEMPLATES;

// ── Low-level: Send text message via Meta Cloud API ─────────

type MetaTemplateParam = { type: 'text'; text: string };

/** Button URL suffix for CTA buttons in Meta templates */
export type MetaButtonUrl = { index: number; urlSuffix: string };

async function metaSendTemplate(
  phone: string,
  templateName: string,
  languageCode: string,
  bodyParams: MetaTemplateParam[],
  buttonUrls?: MetaButtonUrl[],
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const wa = await getWAConfig();
  const cleanPhone = phone.replace(/[\s+\-()]/g, '');

  if (wa.mode !== 'live' || !wa.apiToken) {
    const mockId = `mock_wa_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    console.log(`\n┌─── WHATSAPP TEMPLATE (MOCK) ─────────────────────┐`);
    console.log(`│ To: ${cleanPhone}  Template: ${templateName}`);
    console.log(`│ Params: ${bodyParams.map(p => p.text).join(', ')}`);
    if (buttonUrls?.length) console.log(`│ Buttons: ${buttonUrls.map(b => `[${b.index}] ${b.urlSuffix}`).join(', ')}`);
    console.log(`└──────────────────────────────────────────────────┘\n`);
    return { success: true, messageId: mockId };
  }

  const phoneId = await getPhoneNumberId();
  if (!phoneId) return { success: false, error: 'No WhatsApp phone_number_id configured or discovered' };

  try {
    // Build components array — sanitize params (Meta rejects newlines/tabs/4+ spaces)
    const sanitizedParams = bodyParams.map(p => ({
      ...p,
      text: p.text.replace(/[\n\r\t]+/g, ' ').replace(/ {4,}/g, '   ').trim(),
    }));
    const components: Record<string, unknown>[] = [];
    if (sanitizedParams.length > 0) {
      components.push({ type: 'body', parameters: sanitizedParams });
    }
    // Add button URL suffixes (for CTA URL buttons)
    if (buttonUrls?.length) {
      for (const btn of buttonUrls) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(btn.index),
          parameters: [{ type: 'text', text: btn.urlSuffix }],
        });
      }
    }

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 && { components }),
      },
    };

    const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wa.apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as {
      messages?: Array<{ id: string }>;
      error?: { message: string; code: number };
    };

    if (res.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }

    const errMsg = data.error?.message || 'Meta WhatsApp API template error';
    console.error(`[whatsapp] Template API error for "${templateName}" (${bodyParams.length} params):`, errMsg);
    return { success: false, error: errMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[whatsapp] Template send failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

async function metaSend(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Strip +, spaces, dashes, parens — Meta expects pure digits with country code
  const wa2 = await getWAConfig();
  const cleanPhone = phone.replace(/[\s+\-()]/g, '');

  if (wa2.mode !== 'live' || !wa2.apiToken) {
    const mockId = `mock_wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    console.log(`\n┌─── WHATSAPP (MOCK) ──────────────────────────────┐`);
    console.log(`│ To: ${cleanPhone}`);
    console.log(`│ ${message.substring(0, 200).replace(/\n/g, '\n│ ')}`);
    console.log(`└──────────────────────────────────────────────────┘\n`);
    return { success: true, messageId: mockId };
  }

  const phoneId = await getPhoneNumberId();
  if (!phoneId) return { success: false, error: 'No WhatsApp phone_number_id configured or discovered' };

  try {
    const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wa2.apiToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: true, body: message.substring(0, 4096) },
      }),
    });

    const data = await res.json() as {
      messages?: Array<{ id: string }>;
      error?: { message: string; code: number };
    };

    if (res.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }

    const errMsg = data.error?.message || 'Meta WhatsApp API error';
    console.error('[whatsapp] API error:', errMsg);
    return { success: false, error: errMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[whatsapp] Send failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

// ── DB Phone Lookup ─────────────────────────────────────────

async function lookupPhone(email: string, overridePhone?: string): Promise<string | null> {
  // If caller provided a phone number directly, use it
  if (overridePhone) {
    const clean = overridePhone.replace(/\D/g, '');
    // Ensure country code prefix (default India +91)
    return clean.length === 10 ? `91${clean}` : clean;
  }
  try {
    // 1. Check user_profiles (registered portal users)
    const r = await db.query<{ whatsapp: string | null; phone: string | null }>(
      `SELECT whatsapp, phone FROM user_profiles WHERE email = $1`,
      [email],
    );
    if (r.rows.length > 0) {
      const p = r.rows[0].whatsapp || r.rows[0].phone || null;
      if (p) return p;
    }
    // 2. Fallback: check demo_requests (external demo students)
    const dr = await db.query<{ student_phone: string | null }>(
      `SELECT student_phone FROM demo_requests WHERE student_email = $1 AND student_phone IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    if (dr.rows.length > 0 && dr.rows[0].student_phone) {
      const clean = dr.rows[0].student_phone.replace(/\D/g, '');
      return clean.length === 10 ? `91${clean}` : clean;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Fire-and-forget WhatsApp (auto-mirror for every email) ──

/**
 * Look up the recipient's WhatsApp number and send a message.
 * Priority: direct waTemplate+waParams → legacy regex extraction → free-form text.
 * Silently skips if no phone is on file. Never throws.
 * Called automatically from lib/email.ts after every email send.
 */
export async function fireWhatsApp(
  recipientEmail: string,
  message: string,
  emailTemplateType?: string,
  waTemplate?: string,
  waParams?: string[],
  overridePhone?: string,
  waButtonUrls?: MetaButtonUrl[],
): Promise<void> {
  try {
    const phone = await lookupPhone(recipientEmail, overridePhone);
    if (!phone) return; // No phone on file — skip silently

    let result: { success: boolean; messageId?: string; error?: string } | null = null;
    let templateUsed = waTemplate || emailTemplateType || 'text';

    // Priority 1: Direct template + params (structured, reliable)
    if (waTemplate && waParams?.length) {
      result = await metaSendTemplate(
        phone,
        waTemplate,
        'en',
        waParams.map(v => ({ type: 'text' as const, text: v || 'N/A' })),
        waButtonUrls,
      );
    }

    // Priority 2: Legacy regex extraction from email text (backward compat / fallback)
    if ((!result || !result.success) && emailTemplateType) {
      const mapping = META_EMAIL_TEMPLATE_MAP[emailTemplateType];
      if (mapping) {
        try {
          const subject = message.match(/^\*([^*]+)\*/)?.[1] || '';
          const cleanText = message.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
          const params: MetaTemplateParam[] = mapping.extractParams(subject, cleanText, recipientEmail)
            .map(v => ({ type: 'text' as const, text: v || 'N/A' }));
          result = await metaSendTemplate(phone, mapping.metaName, mapping.lang, params);
          templateUsed = mapping.metaName;
        } catch (tplErr) {
          console.warn('[whatsapp:fire] Template extraction failed, falling back to text:', tplErr);
        }
      }
    }

    // Priority 3: Free-form text (only works within 24h conversation window)
    if (!result || !result.success) {
      result = await metaSend(phone, message);
    }

    // Log to notification_log
    await db.query(
      `INSERT INTO notification_log (channel, recipient, template, payload, status, external_id)
       VALUES ('whatsapp', $1, $2, $3::jsonb, $4, $5)`,
      [
        recipientEmail,
        templateUsed,
        JSON.stringify({ phone, template: templateUsed, body: message.substring(0, 500) }),
        result.success ? 'sent' : 'failed',
        result.messageId || null,
      ],
    );
  } catch (err) {
    // Never throw — this is fire-and-forget
    console.error('[whatsapp:fire] Error:', err);
  }
}

// ── Direct WhatsApp template send (standalone, no email) ────

/**
 * Send a WhatsApp template message directly by recipient email.
 * Looks up phone from user_profiles. Use this for WA-only notifications
 * that don't have a corresponding email.
 */
export async function sendWA(
  recipientEmail: string,
  templateName: string,
  params: string[],
  lang = 'en',
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phone = await lookupPhone(recipientEmail);
  if (!phone) return { success: false, error: 'No phone on file' };

  const result = await metaSendTemplate(
    phone,
    templateName,
    lang,
    params.map(v => ({ type: 'text' as const, text: v || 'N/A' })),
  );

  try {
    await db.query(
      `INSERT INTO notification_log (channel, recipient, template, payload, status, external_id)
       VALUES ('whatsapp', $1, $2, $3::jsonb, $4, $5)`,
      [
        recipientEmail,
        templateName,
        JSON.stringify({ phone, template: templateName, params }),
        result.success ? 'sent' : 'failed',
        result.messageId || null,
      ],
    );
  } catch (logErr) {
    console.error('[whatsapp] Failed to log:', logErr);
  }

  return result;
}

// ── Template-based Send (for notifications route) ───────────

export interface SendWhatsAppInput {
  to: string; // phone number with country code (e.g. +919876543210)
  template: TemplateName;
  templateData: Record<string, string>;
  recipientEmail?: string; // for logging
}

// ── Meta template mapping ──
// Maps our local template names → Meta-approved template names + param order.
// These correspond to templates created on Meta WhatsApp Business Manager.
// Meta templates work outside the 24h conversation window.

interface MetaTemplateMapping {
  metaName: string;
  lang: string;
  paramKeys: string[]; // keys from templateData in order for {{1}}, {{2}}, ...
}

const META_TEMPLATE_MAP: Record<TemplateName, MetaTemplateMapping> = {
  class_reminder: {
    metaName: 'stibe_class_reminder',
    lang: 'en',
    paramKeys: ['studentName', 'subject', 'time', 'teacherName', 'batchName'],
  },
  payment_due: {
    metaName: 'stibe_payment_reminder',
    lang: 'en',
    paramKeys: ['parentName', 'amount', 'description', 'dueDate', 'invoiceNumber'],
  },
  exam_scheduled: {
    metaName: 'stibe_alert',
    lang: 'en',
    paramKeys: ['studentName', 'message'],
  },
  exam_result: {
    metaName: 'stibe_exam_result',
    lang: 'en',
    paramKeys: ['studentName', 'examTitle', 'score', 'grade'],
  },
  attendance_alert: {
    metaName: 'stibe_alert',
    lang: 'en',
    paramKeys: ['parentName', 'message'],
  },
  general: {
    metaName: 'stibe_alert',
    lang: 'en',
    paramKeys: ['recipientName', 'message'],
  },
  payment_overdue: {
    metaName: 'stibe_payment_reminder',
    lang: 'en',
    paramKeys: ['parentName', 'amount', 'description', 'dueDate', 'invoiceNumber'],
  },
  video_access: {
    metaName: 'stibe_alert',
    lang: 'en',
    paramKeys: ['studentName', 'message'],
  },
  invoice_generated: {
    metaName: 'stibe_invoice',
    lang: 'en',
    paramKeys: ['recipientName', 'invoiceNumber', 'amount', 'dueDate'],
  },
};

// ── Extended Meta template mapping for email mirror ──
// Maps email template types directly to Meta templates for fireWhatsApp.
// This allows email mirrors to send templates outside the 24h window.

interface MetaEmailTemplateMapping {
  metaName: string;
  lang: string;
  extractParams: (subject: string, text: string, recipientEmail: string) => string[];
}

const META_EMAIL_TEMPLATE_MAP: Record<string, MetaEmailTemplateMapping> = {
  // Teacher invite to room
  teacher_invite: {
    metaName: 'stibe_teacher_class',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Teacher';
      const room = text.match(/class.*?"([^"]+)"|session.*?"([^"]+)"/i)?.[1] || text.match(/Room:\s*(.+)/)?.[1] || 'Class';
      const subject = text.match(/Subject:\s*(.+)/)?.[1] || 'Subject';
      const date = text.match(/Date:\s*(.+)/)?.[1] || 'TBD';
      const time = text.match(/Time:\s*(.+)/)?.[1] || 'TBD';
      const duration = text.match(/Duration:\s*(.+)/)?.[1] || '60 minutes';
      return [name, room, subject, date, time, duration];
    },
  },
  // Student invite to room
  student_invite: {
    metaName: 'stibe_student_class',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Student';
      const room = text.match(/class.*?"([^"]+)"|session.*?"([^"]+)"/i)?.[1] || text.match(/Room:\s*(.+)/)?.[1] || 'Class';
      const subject = text.match(/Subject:\s*(.+)/)?.[1] || 'Subject';
      const date = text.match(/Date:\s*(.+)/)?.[1] || 'TBD';
      const time = text.match(/Time:\s*(.+)/)?.[1] || 'TBD';
      const duration = text.match(/Duration:\s*(.+)/)?.[1] || '60 minutes';
      return [name, room, subject, date, time, duration];
    },
  },
  // Payment confirmation
  payment_confirmation: {
    metaName: 'stibe_payment_done',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Student';
      const amount = text.match(/(?:Rs\.|₹|Amount:)\s*([\d,.\s]+)/)?.[1]?.trim() || 'N/A';
      const txn = text.match(/(?:Transaction|Txn|ID):\s*(.+)/)?.[1]?.trim() || 'N/A';
      const date = text.match(/Date:\s*(.+)/)?.[1]?.trim() || new Date().toLocaleDateString('en-IN');
      return [name, `Rs. ${amount}`, txn, date];
    },
  },
  // Room reminder
  room_reminder: {
    metaName: 'stibe_class_reminder',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Student';
      const subject = text.match(/Subject:\s*(.+)/)?.[1] || 'Class';
      const time = text.match(/(?:Time|Starts?):\s*(.+)/)?.[1] || 'Soon';
      const teacher = text.match(/Teacher:\s*(.+)/)?.[1] || 'Teacher';
      const batch = text.match(/Batch:\s*(.+)/)?.[1] || 'N/A';
      return [name, subject, time, teacher, batch];
    },
  },
  // Room cancelled
  room_cancelled: {
    metaName: 'stibe_class_cancelled',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Student';
      const room = text.match(/class.*?"([^"]+)"|"([^"]+)".*?cancelled/i)?.[1] || 'Class';
      const date = text.match(/Date:\s*(.+)/)?.[1] || 'N/A';
      const time = text.match(/Time:\s*(.+)/)?.[1] || 'N/A';
      return [name, room, date, time];
    },
  },
  // Room rescheduled
  room_rescheduled: {
    metaName: 'stibe_class_rescheduled',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Student';
      const room = text.match(/class.*?"([^"]+)"|"([^"]+)"/i)?.[1] || 'Class';
      const oldDate = text.match(/(?:Old|Previous) Date:\s*(.+)/)?.[1] || text.match(/From:\s*(.+)/)?.[1] || 'N/A';
      const oldTime = text.match(/(?:Old|Previous) Time:\s*(.+)/)?.[1] || 'N/A';
      const newDate = text.match(/New Date:\s*(.+)/)?.[1] || text.match(/To:\s*(.+)/)?.[1] || 'N/A';
      const newTime = text.match(/New Time:\s*(.+)/)?.[1] || 'N/A';
      return [name, room, oldDate, oldTime, newDate, newTime];
    },
  },
  // Coordinator summary
  coordinator_summary: {
    metaName: 'stibe_coord_summary',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Coordinator';
      const room = text.match(/class.*?"([^"]+)"|Room:\s*(.+)/)?.[1] || 'Class';
      const date = text.match(/Date:\s*(.+)/)?.[1] || new Date().toLocaleDateString('en-IN');
      const details = text.match(/Teacher:\s*(.+)/)?.[1] || 'N/A';
      return [name, room, date, details];
    },
  },
  // Invoice generated
  invoice_generated: {
    metaName: 'stibe_invoice',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Student';
      const inv = text.match(/Invoice.*?:\s*(INV[^\s,]+)/)?.[1] || 'N/A';
      const amount = text.match(/(?:Amount|Total):\s*(?:Rs\.|₹)?\s*([\d,.\s]+)/)?.[1]?.trim() || 'N/A';
      const due = text.match(/Due.*?:\s*(.+)/)?.[1]?.trim() || 'N/A';
      return [name, inv, `Rs. ${amount}`, due];
    },
  },
  // Payment receipt
  payment_receipt: {
    metaName: 'stibe_receipt',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Student';
      const receipt = text.match(/Receipt.*?:\s*(REC[^\s,]+)/)?.[1] || 'N/A';
      const amount = text.match(/(?:Amount|Total):\s*(?:Rs\.|₹)?\s*([\d,.\s]+)/)?.[1]?.trim() || 'N/A';
      const date = text.match(/(?:Payment )?Date:\s*(.+)/)?.[1]?.trim() || new Date().toLocaleDateString('en-IN');
      return [name, receipt, `Rs. ${amount}`, date];
    },
  },
  // Payslip notification
  payslip_notification: {
    metaName: 'stibe_payslip',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Teacher';
      const period = text.match(/(?:Period|Month):\s*(.+)/)?.[1] || 'This month';
      const classes = text.match(/Classes.*?:\s*(\d+)/)?.[1] || 'N/A';
      const total = text.match(/(?:Total|Net).*?:\s*(?:Rs\.|₹)?\s*([\d,.\s]+)/)?.[1]?.trim() || 'N/A';
      return [name, period, classes, `Rs. ${total}`];
    },
  },
  // Payment reminder
  payment_reminder: {
    metaName: 'stibe_payment_reminder',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'Parent';
      const amount = text.match(/(?:Amount|Rs\.|₹)\s*([\d,.\s]+)/)?.[1]?.trim() || 'N/A';
      const desc = text.match(/(?:for|Description):\s*(.+)/)?.[1]?.trim() || 'Tuition fees';
      const due = text.match(/Due.*?:\s*(.+)/)?.[1]?.trim() || 'Soon';
      const inv = text.match(/Invoice.*?:\s*(INV[^\s,]+)/)?.[1] || 'N/A';
      return [name, `Rs. ${amount}`, desc, due, inv];
    },
  },
  // Batch assignment notification
  batch_assign: {
    metaName: 'stibe_batch_assign',
    lang: 'en',
    extractParams: (_s, text) => {
      const name = text.match(/(?:Hi|Dear) ([^,\n]+)/)?.[1] || 'User';
      const batch = text.match(/[Bb]atch.*?"([^"]+)"|[Bb]atch:\s*(.+)/)?.[1] || 'Batch';
      const role = text.match(/(?:as|Role:)\s*(teacher|student|coordinator)/i)?.[1] || 'member';
      const details = text.match(/Subject:\s*(.+)/)?.[1] || text.match(/Details:\s*(.+)/)?.[1] || 'See portal for details';
      return [name, batch, role, details];
    },
  },
};

export async function sendWhatsApp(
  input: SendWhatsAppInput,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, template, templateData, recipientEmail } = input;

  // Generate message body from our local template (used for text fallback + logging)
  const templateFn = TEMPLATES[template] as (data: Record<string, string>) => string;
  const messageBody = templateFn(templateData);

  // Try Meta approved template first (works outside 24h window)
  const metaMapping = META_TEMPLATE_MAP[template];
  let result: { success: boolean; messageId?: string; error?: string } | null = null;

  if (metaMapping) {
    const params: MetaTemplateParam[] = metaMapping.paramKeys.map(key => ({
      type: 'text' as const,
      text: templateData[key] || '',
    }));
    result = await metaSendTemplate(to, metaMapping.metaName, metaMapping.lang, params);
  }

  // Fallback to free-form text if template failed or no mapping
  if (!result || !result.success) {
    const textResult = await metaSend(to, messageBody);
    if (textResult.success) result = textResult;
    else if (!result) result = textResult;
  }

  // Log to notification_log
  try {
    await db.query(
      `INSERT INTO notification_log (channel, recipient, template, payload, status, external_id)
       VALUES ('whatsapp', $1, $2, $3::jsonb, $4, $5)`,
      [
        recipientEmail || to,
        template,
        JSON.stringify({ to, body: messageBody, ...templateData }),
        result.success ? 'sent' : 'failed',
        result.messageId || null,
      ],
    );
  } catch (logErr) {
    console.error('[whatsapp] Failed to log notification:', logErr);
  }

  return result;
}

// ── Bulk Reminders ──────────────────────────────────────────

export async function sendClassReminders(roomId: string) {
  // Get room + assigned students
  const roomResult = await db.query(
    `SELECT r.room_name, r.subject, r.scheduled_start, r.teacher_email,
            pu_t.full_name AS teacher_name
     FROM rooms r
     LEFT JOIN portal_users pu_t ON pu_t.email = r.teacher_email
     WHERE r.room_id = $1`,
    [roomId]
  );
  const room = roomResult.rows[0];
  if (!room) return { sent: 0, failed: 0 };

  const studentsResult = await db.query(
    `SELECT ra.participant_email, up.phone, up.whatsapp, pu.full_name
     FROM room_assignments ra
     LEFT JOIN user_profiles up ON up.email = ra.participant_email
     LEFT JOIN portal_users pu ON pu.email = ra.participant_email
     WHERE ra.room_id = $1 AND ra.participant_type = 'student'`,
    [roomId]
  );

  let sent = 0, failed = 0;
  const classTime = room.scheduled_start
    ? new Date(room.scheduled_start as string).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : 'Scheduled';

  for (const student of studentsResult.rows as Array<Record<string, unknown>>) {
    const phone = (student.whatsapp || student.phone) as string | null;
    if (!phone) { failed++; continue; }

    const result = await sendWhatsApp({
      to: phone,
      template: 'class_reminder',
      templateData: {
        studentName: (student.full_name as string) || 'Student',
        subject: (room.subject as string) || 'Class',
        time: classTime,
        teacherName: (room.teacher_name as string) || 'Teacher',
      },
      recipientEmail: student.participant_email as string,
    });

    if (result.success) sent++; else failed++;
  }

  return { sent, failed, total: studentsResult.rows.length };
}

// ── Send Payment Reminders ──────────────────────────────────

export async function sendPaymentReminders(window?: '7day' | '1day' | 'overdue') {
  // Three tiers of payment reminders per PDF spec
  const conditions: Record<string, { sql: string; template: TemplateName }> = {
    '7day': {
      sql: `i.status = 'pending' AND i.due_date > NOW() + INTERVAL '1 day' AND i.due_date <= NOW() + INTERVAL '7 days'`,
      template: 'payment_due',
    },
    '1day': {
      sql: `i.status = 'pending' AND i.due_date > NOW() AND i.due_date <= NOW() + INTERVAL '1 day'`,
      template: 'payment_due',
    },
    'overdue': {
      sql: `i.status IN ('pending', 'overdue') AND i.due_date < NOW()`,
      template: 'payment_overdue',
    },
  };

  const windows = window ? [window] : ['7day', '1day', 'overdue'] as const;
  let sent = 0, failed = 0;

  for (const w of windows) {
    const cond = conditions[w];
    const result = await db.query(
      `SELECT i.*, pu.full_name AS student_name,
              up.parent_email, up_p.phone AS parent_phone, up_p.whatsapp AS parent_whatsapp,
              pu_p.full_name AS parent_name
       FROM invoices i
       LEFT JOIN portal_users pu ON pu.email = i.student_email
       LEFT JOIN user_profiles up ON up.email = i.student_email
       LEFT JOIN user_profiles up_p ON up_p.email = up.parent_email
       LEFT JOIN portal_users pu_p ON pu_p.email = up.parent_email
       WHERE ${cond.sql}`
    );

    for (const inv of result.rows as Array<Record<string, unknown>>) {
      const phone = (inv.parent_whatsapp || inv.parent_phone) as string | null;
      if (!phone) { failed++; continue; }

      const amount = `₹${((inv.amount_paise as number) / 100).toFixed(2)}`;
      const dueDate = inv.due_date
        ? new Date(inv.due_date as string).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
        : 'Soon';

      const r = await sendWhatsApp({
        to: phone,
        template: cond.template,
        templateData: {
          parentName: (inv.parent_name as string) || 'Parent',
          studentName: (inv.student_name as string) || 'Student',
          amount,
          dueDate,
          payLink: buildPayUrl(String(inv.id)),
        },
        recipientEmail: inv.parent_email as string || inv.student_email as string,
      });

      if (r.success) sent++; else failed++;
    }
  }

  return { sent, failed };
}

// ── Get Notification Logs ───────────────────────────────────

export async function getNotificationLogs(filters?: {
  channel?: string;
  recipient?: string;
  limit?: number;
}) {
  let sql = `SELECT * FROM notification_log WHERE 1=1`;
  const params: unknown[] = [];

  if (filters?.channel) {
    params.push(filters.channel);
    sql += ` AND channel = $${params.length}`;
  }
  if (filters?.recipient) {
    params.push(filters.recipient);
    sql += ` AND recipient = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC`;
  params.push(filters?.limit || 100);
  sql += ` LIMIT $${params.length}`;

  const result = await db.query(sql, params);
  return result.rows;
}
