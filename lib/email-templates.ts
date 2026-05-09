// ═══════════════════════════════════════════════════════════════
// stibe Portal — Email Templates (Step 05)
// ═══════════════════════════════════════════════════════════════
// Plain HTML email templates — no external template engine.
// All templates share a master layout wrapper.
// ═══════════════════════════════════════════════════════════════

// ── Master Layout ───────────────────────────────────────────

function masterLayout(body: string, recipientEmail: string, platformName: string = 'Stibe', logoUrl?: string, logoHeight: number = 36): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://oniion.stibe.in';
  const resolvedLogoUrl = logoUrl ?? `${appUrl}/logo/full.png`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${platformName} Classes</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    :root { color-scheme: light only; }
    * { color-scheme: light only; }
    @media (prefers-color-scheme: dark) {
      body, .email-bg, .email-bg-inner { background-color: #f5f6f8 !important; }
      .email-card { background-color: #ffffff !important; color: #1f2937 !important; }
      .email-header { background-color: #ffffff !important; }
      .email-footer { background-color: #f9fafb !important; }
      h1, h2, h3, .hdr-txt { color: #111827 !important; }
      p, td, th, span, div, .body-txt { color: #1f2937 !important; }
      a, .link-txt { color: #2563eb !important; }
      .muted-txt { color: #6b7280 !important; }
      .faint-txt { color: #9ca3af !important; }
      .email-card, .email-header, .email-footer { border-color: #e5e7eb !important; }
      img { opacity: 1 !important; }
    }
    /* Gmail app dark mode (Android/iOS) */
    u + .email-bg, u + .email-bg .email-card { background-color: #f5f6f8 !important; }
    u + .email-bg .email-card { background-color: #ffffff !important; }
    u + .email-bg h1, u + .email-bg h2, u + .email-bg h3, u + .email-bg .hdr-txt { color: #111827 !important; }
    u + .email-bg p, u + .email-bg td, u + .email-bg span, u + .email-bg div, u + .email-bg .body-txt { color: #1f2937 !important; }
    u + .email-bg a, u + .email-bg .link-txt { color: #2563eb !important; }
    u + .email-bg .muted-txt { color: #6b7280 !important; }
    u + .email-bg .faint-txt { color: #9ca3af !important; }
    u + .email-bg .email-footer { background-color: #f9fafb !important; }
    /* Outlook (data-ogsc / data-ogsb) */
    [data-ogsc] body, [data-ogsc] .email-bg { background-color: #f5f6f8 !important; }
    [data-ogsc] .email-card { background-color: #ffffff !important; }
    [data-ogsc] h1, [data-ogsc] h2, [data-ogsc] h3, [data-ogsc] .hdr-txt { color: #111827 !important; }
    [data-ogsc] p, [data-ogsc] td, [data-ogsc] span, [data-ogsc] div, [data-ogsc] .body-txt { color: #1f2937 !important; }
    [data-ogsc] a { color: #2563eb !important; }
    [data-ogsc] .muted-txt { color: #6b7280 !important; }
    [data-ogsc] .faint-txt { color: #9ca3af !important; }
    [data-ogsb] body, [data-ogsb] .email-bg { background-color: #f5f6f8 !important; }
    [data-ogsb] .email-card { background-color: #ffffff !important; }
    [data-ogsb] h1, [data-ogsb] h2, [data-ogsb] h3, [data-ogsb] .hdr-txt { color: #111827 !important; }
    [data-ogsb] p, [data-ogsb] td, [data-ogsb] span, [data-ogsb] div, [data-ogsb] .body-txt { color: #1f2937 !important; }
    [data-ogsb] a { color: #2563eb !important; }
    [data-ogsb] .muted-txt { color: #6b7280 !important; }
    [data-ogsb] .faint-txt { color: #9ca3af !important; }
    /* Yahoo Mail dark mode */
    [style*="color-scheme:dark"] body, [style*="color-scheme:dark"] .email-bg { background-color: #f5f6f8 !important; }
    [style*="color-scheme:dark"] .email-card { background-color: #ffffff !important; }
    [style*="color-scheme:dark"] h1, [style*="color-scheme:dark"] h2 { color: #111827 !important; }
    [style*="color-scheme:dark"] p, [style*="color-scheme:dark"] td { color: #1f2937 !important; }
  </style>
</head>
<body class="email-bg" style="margin:0; padding:0; background-color:#f5f6f8; color:#1f2937; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:#f5f6f8; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" class="email-card" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.06); border:1px solid #e5e7eb;">

          <!-- Header -->
          <tr>
            <td class="email-header" style="background-color:#ffffff; padding:24px 32px; border-bottom:1px solid #e5e7eb;">
              <div style="display:inline-block; line-height:0;">
                <img src="${resolvedLogoUrl}" alt="${platformName}" height="${logoHeight}" style="display:block; width:auto;" />
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0"><tr>
                <td>
                  <p class="muted-txt" style="margin:0 0 3px; font-size:12px; color:#6b7280;">Need help? <a class="link-txt" href="mailto:support@stibelearning.online" style="color:#2563eb; text-decoration:none;">support@stibelearning.online</a></p>
                  ${recipientEmail ? `<p class="faint-txt" style="margin:0; font-size:11px; color:#9ca3af;">This email was sent to ${recipientEmail}</p>` : ''}
                </td>
                <td align="right" style="vertical-align:bottom;">
                  <p class="faint-txt" style="margin:0; font-size:11px; color:#d1d5db;">&copy; 2026 ${platformName}</p>
                </td>
              </tr></table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Shared Helpers ──────────────────────────────────────────

function button(text: string, href: string, color: string = '#16a34a'): string {
  return `<a href="${href}" style="display:inline-block; padding:12px 28px; background-color:${color}; color:#ffffff !important; text-decoration:none; border-radius:6px; font-size:14px; font-weight:700; margin:8px 4px 8px 0; letter-spacing:0.01em; mso-padding-alt:12px 28px;"><span style="color:#ffffff; text-decoration:none;">${text}</span></a>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 14px; font-size:13px; color:#6b7280; font-weight:500; border-bottom:1px solid #f3f4f6; background-color:#f9fafb; width:38%;">${label}</td>
    <td style="padding:9px 14px; font-size:13px; color:#111827; font-weight:600; border-bottom:1px solid #f3f4f6;">${value}</td>
  </tr>`;
}

function infoTable(rows: [string, string][]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
    ${rows.map(([l, v]) => infoRow(l, v)).join('\n')}
  </table>`;
}

function alertBox(text: string, color: string, bgColor: string): string {
  return `<div style="padding:12px 16px; background-color:${bgColor}; border-left:4px solid ${color}; border-radius:0 8px 8px 0; margin:16px 0; font-size:13px; color:${color}; font-weight:500; line-height:1.5;">${text}</div>`;
}

/**
 * Parse a pipe-delimited invoice description and render as an HTML table for emails.
 * Returns empty string if the description doesn't contain structured line items.
 */
function descriptionItemsHtml(description: string): string {
  if (!description) return '';
  const parts = description.split('|').map(s => s.trim());
  if (parts.length < 2) return '';

  const header = parts[0];
  const items: Array<{ subject: string; sessions: string; rate: string; total: string }> = [];

  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^(.+?):\s*(\d+×\d+min)\s*@(.+?\/hr)\s*=\s*(.+)$/);
    if (m) items.push({ subject: m[1].trim(), sessions: m[2], rate: m[3].trim(), total: m[4].trim() });
  }

  if (items.length === 0) return '';

  return `
    <p style="font-size:12px; color:#9ca3af; margin:12px 0 6px;">${header}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb;">Subject</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb; text-align:right;">Sessions</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb; text-align:right;">Rate</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb; text-align:right;">Amount</td>
      </tr>
      ${items.map(li => `<tr>
        <td style="padding:9px 12px; font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6;">${li.subject}</td>
        <td style="padding:9px 12px; font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6; text-align:right;">${li.sessions}</td>
        <td style="padding:9px 12px; font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6; text-align:right;">${li.rate}</td>
        <td style="padding:9px 12px; font-size:13px; color:#111827; font-weight:600; border-bottom:1px solid #f3f4f6; text-align:right;">${li.total}</td>
      </tr>`).join('')}
    </table>`;
}

// ── Type Definitions ────────────────────────────────────────

export interface TeacherInviteData {
  teacherName: string;
  roomName: string;
  subject: string;
  grade: string;
  date: string;        // formatted date string e.g. "28 Feb 2026"
  time: string;        // formatted time e.g. "10:00 AM"
  duration: string;    // e.g. "60 minutes"
  notes?: string;      // coordinator notes (optional)
  laptopLink: string;
  tabletLink: string;
  recipientEmail: string;
}

export interface StudentInviteData {
  studentName: string;
  roomName: string;
  subject: string;
  grade: string;
  date: string;
  time: string;
  duration: string;
  joinLink: string;
  paymentStatus: 'paid' | 'unpaid' | 'exempt';
  recipientEmail: string;
}

export interface PaymentConfirmationData {
  studentName: string;
  roomName: string;
  amount: string;
  transactionId: string;
  date: string;
  joinLink: string;
  recipientEmail: string;
}

export interface RoomReminderData {
  recipientName: string;
  recipientRole: 'teacher' | 'student';
  roomName: string;
  startTime: string;
  teacherName?: string;   // shown for students
  classSize?: number;     // shown for teachers
  laptopLink?: string;    // teacher only
  tabletLink?: string;    // teacher only
  joinLink?: string;      // student only
  recipientEmail: string;
}

export interface RoomCancelledData {
  roomName: string;
  date: string;
  time: string;
  reason?: string;
  recipientEmail: string;
}

export interface RoomRescheduledData {
  roomName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  joinLink: string;
  recipientEmail: string;
}

export interface CoordinatorSummaryData {
  coordinatorName: string;
  roomName: string;
  date: string;
  teacherName: string;
  teacherLaptopLink: string;
  teacherTabletLink: string;
  studentCount: number;
  unpaidCount: number;
  recipientEmail: string;
}

// ── Template 1: Teacher Invitation ──────────────────────────

export function teacherInviteTemplate(data: TeacherInviteData): { subject: string; html: string; text: string } {
  const subject = `Your class is scheduled — ${data.roomName} on ${data.date} at ${data.time}`;

  const notesBlock = data.notes
    ? alertBox(`<strong>Notes from Coordinator:</strong> ${data.notes}`, '#d97706', '#fffbeb')
    : '';

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.teacherName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">Your class has been scheduled. Please review the details below.</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Grade', data.grade],
      ['Date', data.date],
      ['Time', data.time],
      ['Duration', data.duration],
    ])}

    ${notesBlock}

    <div style="margin:24px 0;">
      ${button('Join on Laptop', data.laptopLink)}
      ${button('Join on Tablet', data.tabletLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0 0 8px;">Click the <strong>Laptop</strong> link when using your desktop/laptop. Click the <strong>Tablet</strong> link when using your drawing tablet for whiteboard writing.</p>
    <p style="font-size:13px; color:#6c757d; margin:0;">You will be asked to log in with your stibe credentials after clicking the link.</p>
  `;

  const text = `Dear ${data.teacherName},\n\nYour class "${data.roomName}" is scheduled for ${data.date} at ${data.time}.\nSubject: ${data.subject} | Grade: ${data.grade} | Duration: ${data.duration}\n${data.notes ? `Notes: ${data.notes}\n` : ''}\nLaptop: ${data.laptopLink}\nTablet: ${data.tabletLink}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 2: Student Invitation ──────────────────────────

export function studentInviteTemplate(data: StudentInviteData): { subject: string; html: string; text: string } {
  const subject = `You have been invited to: ${data.roomName} — ${data.date} at ${data.time}`;

  const paymentBlock = data.paymentStatus === 'unpaid'
    ? alertBox('Your fee payment is pending. You will be redirected to the payment page when you click Join.', '#e65100', '#fff3e0')
    : alertBox('✓ Your fee is confirmed.', '#16a34a', '#f0fdf4');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.studentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">You have been invited to the following class.</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Grade / Class', data.grade],
      ['Date', data.date],
      ['Time', data.time],
      ['Duration', data.duration],
    ])}

    ${paymentBlock}

    <div style="margin:24px 0;">
      ${button('Join Class', data.joinLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">You will be asked to log in with your stibe credentials after clicking the link.</p>
  `;

  const text = `Dear ${data.studentName},\n\nYou have been invited to "${data.roomName}" on ${data.date} at ${data.time}.\nSubject: ${data.subject} | Grade: ${data.grade} | Duration: ${data.duration}\nPayment: ${data.paymentStatus}\n\nJoin: ${data.joinLink}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 3: Payment Confirmation ────────────────────────

export function paymentConfirmationTemplate(data: PaymentConfirmationData): { subject: string; html: string; text: string } {
  const subject = `Payment confirmed — ${data.roomName}`;

  const body = `
    <div style="text-align:center; padding:16px; background-color:#eff6ff; border-radius:8px; margin:0 0 24px;">
      <span style="font-size:32px;">&#10004;</span>
      <h2 style="margin:8px 0 0; color:#1e40af; font-size:20px;">Payment Successful</h2>
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 16px;">Dear ${data.studentName},</p>

    ${infoTable([
      ['Amount', data.amount],
      ['Transaction ID', data.transactionId],
      ['Date', data.date],
      ['Room', data.roomName],
    ])}

    <div style="margin:24px 0;">
      ${button('Join Your Class Now', data.joinLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Your access to this class has been activated.</p>
  `;

  const text = `Payment Successful\n\nDear ${data.studentName},\n\nAmount: ${data.amount}\nTransaction ID: ${data.transactionId}\nDate: ${data.date}\nRoom: ${data.roomName}\n\nJoin: ${data.joinLink}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 4: 30-Minute Reminder ──────────────────────────

export function roomReminderTemplate(data: RoomReminderData & { minutesBefore?: number }): { subject: string; html: string; text: string } {
  const mins = data.minutesBefore ?? 30;
  const isNow = mins === 0;
  const timeLabel = isNow ? 'starting now' : `starts in ${mins} minutes`;
  const subject = isNow
    ? `Class is starting now — ${data.roomName}`
    : `Class starts in ${mins} minutes — ${data.roomName}`;

  const contextInfo = data.recipientRole === 'teacher'
    ? `<p style="font-size:14px; color:#495057;">Class size: <strong>${data.classSize} students</strong></p>`
    : `<p style="font-size:14px; color:#495057;">Teacher: <strong>${data.teacherName}</strong></p>`;

  const buttons = data.recipientRole === 'teacher'
    ? `${button('Join on Laptop', data.laptopLink!)} ${button('Join on Tablet', data.tabletLink!)}`
    : button('Join Class', data.joinLink!);

  const body = `
    ${alertBox(`Your class ${timeLabel}.`, '#1565c0', '#e3f2fd')}

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.recipientName},</p>

    ${infoTable([
      ['Room', data.roomName],
      ['Start Time', data.startTime],
    ])}

    ${contextInfo}

    <div style="margin:24px 0;">
      ${buttons}
    </div>
  `;

  const textHeading = isNow ? 'Class is starting now!' : `Class starts in ${mins} minutes!`;
  const text = `${textHeading}\n\nDear ${data.recipientName},\n\nRoom: ${data.roomName}\nStart Time: ${data.startTime}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 5: Room Cancelled ──────────────────────────────

export function roomCancelledTemplate(data: RoomCancelledData): { subject: string; html: string; text: string } {
  const subject = `Class cancelled — ${data.roomName} on ${data.date}`;

  const reasonBlock = data.reason
    ? `<p style="font-size:14px; color:#495057; margin:16px 0;"><strong>Reason:</strong> ${data.reason}</p>`
    : '';

  const body = `
    ${alertBox('This class has been cancelled.', '#c62828', '#ffebee')}

    ${infoTable([
      ['Room', data.roomName],
      ['Original Date', data.date],
      ['Original Time', data.time],
    ])}

    ${reasonBlock}

    <p style="font-size:14px; color:#495057; margin:16px 0 0;">Please contact your coordinator for details.</p>
  `;

  const text = `Class Cancelled\n\nRoom: ${data.roomName}\nDate: ${data.date}\nTime: ${data.time}\n${data.reason ? `Reason: ${data.reason}\n` : ''}\nPlease contact your coordinator for details.\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 6: Room Rescheduled ────────────────────────────

export function roomRescheduledTemplate(data: RoomRescheduledData): { subject: string; html: string; text: string } {
  const subject = `Class rescheduled — ${data.roomName} new time: ${data.newDate} at ${data.newTime}`;

  const body = `
    ${alertBox('This class has been rescheduled.', '#e65100', '#fff3e0')}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td style="padding:12px; background-color:#ffebee; border-radius:6px; text-align:center; width:48%;">
          <p style="margin:0 0 4px; font-size:12px; color:#c62828; text-transform:uppercase; font-weight:600;">Original</p>
          <p style="margin:0; font-size:15px; color:#1a1a2e; font-weight:600;">${data.oldDate}<br/>${data.oldTime}</p>
        </td>
        <td style="text-align:center; font-size:20px; color:#6c757d; width:4%;">→</td>
        <td style="padding:12px; background-color:#eff6ff; border-radius:6px; text-align:center; width:48%;">
          <p style="margin:0 0 4px; font-size:12px; color:#1e40af; text-transform:uppercase; font-weight:600;">New</p>
          <p style="margin:0; font-size:15px; color:#1a1a2e; font-weight:600;">${data.newDate}<br/>${data.newTime}</p>
        </td>
      </tr>
    </table>

    <div style="margin:24px 0;">
      ${button('Join with New Link', data.joinLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Your previous join link is no longer valid. Please use the new link above.</p>
  `;

  const text = `Class Rescheduled\n\nRoom: ${data.roomName}\nOriginal: ${data.oldDate} at ${data.oldTime}\nNew: ${data.newDate} at ${data.newTime}\n\nJoin: ${data.joinLink}\n\nYour previous join link is no longer valid.\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 7: Coordinator Summary ─────────────────────────

export function coordinatorSummaryTemplate(data: CoordinatorSummaryData): { subject: string; html: string; text: string } {
  const subject = `Notifications sent — ${data.roomName} (${data.studentCount} students)`;

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.coordinatorName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">All participants have been notified for the following class.</p>

    ${infoTable([
      ['Room', data.roomName],
      ['Date', data.date],
      ['Teacher', data.teacherName],
      ['Students Emailed', String(data.studentCount)],
      ['Unpaid Students', String(data.unpaidCount)],
    ])}

    <h3 style="font-size:15px; color:#1a1a2e; margin:24px 0 8px;">Teacher Links (for your reference)</h3>
    <p style="font-size:13px; color:#495057; margin:0 0 4px;">
      Laptop: <a href="${data.teacherLaptopLink}" style="color:#4a6cf7;">${data.teacherLaptopLink}</a>
    </p>
    <p style="font-size:13px; color:#495057; margin:0 0 16px;">
      Tablet: <a href="${data.teacherTabletLink}" style="color:#4a6cf7;">${data.teacherTabletLink}</a>
    </p>

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">This email is for your records. All participants have been notified.</p>
  `;

  const text = `Notifications Sent\n\nDear ${data.coordinatorName},\n\nRoom: ${data.roomName}\nDate: ${data.date}\nTeacher: ${data.teacherName}\nStudents Emailed: ${data.studentCount}\nUnpaid: ${data.unpaidCount}\n\nTeacher Laptop Link: ${data.teacherLaptopLink}\nTeacher Tablet Link: ${data.teacherTabletLink}\n\nAll participants have been notified.\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Welcome / Credentials Template ─────────────────────────
export interface CredentialsTemplateData {
  recipientEmail: string;
  recipientName: string;
  role: string;         // Human-readable role label
  loginEmail: string;
  tempPassword: string;
  loginUrl: string;
  additionalInfo?: string;  // e.g. subjects, grade, etc.
}

export function credentialsTemplate(data: CredentialsTemplateData): { subject: string; html: string; text: string } {
  const roleColors: Record<string, string> = {
    'Teacher': '#2563eb', 'Student': '#7c3aed', 'Admin': '#1e40af',
    'Parent': '#e11d48', 'HR Associate': '#6366f1',
  };
  const accent = roleColors[data.role] || '#4a6cf7';

  const subject = `Welcome to stibe \u2014 Your ${data.role} Account`;

  const body = `
    <h2 style="font-size:22px; color:#1a1a2e; margin:0 0 8px;">Welcome to stibe! \uD83C\uDF93</h2>
    <p style="font-size:15px; color:#495057; margin:0 0 20px;">
      Dear <strong>${data.recipientName}</strong>, your <strong>${data.role}</strong> account has been created.
      Here are your login credentials:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:8px; overflow:hidden; margin:0 0 24px;">
      <tr>
        <td colspan="2" style="padding:12px 16px; font-size:13px; font-weight:700; color:${accent}; text-transform:uppercase; letter-spacing:0.5px; background-color:#f3f4f6; border-bottom:1px solid #e5e7eb;">
          Login Credentials
        </td>
      </tr>
      ${infoRow('Login URL', '<a href="' + data.loginUrl + '" style="color:' + accent + ';">' + data.loginUrl + '</a>')}
      ${infoRow('Email', data.loginEmail)}
      ${infoRow('Password', '<code style="background:#f1f3f5; padding:2px 6px; border-radius:4px; font-family:monospace; color:#e63946;">' + data.tempPassword + '</code>')}
      ${infoRow('Role', '<span style="background:#f3f4f6; color:' + accent + '; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:700;">' + data.role + '</span>')}
      ${data.additionalInfo ? infoRow('Details', data.additionalInfo) : ''}
    </table>

    <div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:6px; padding:14px 16px; margin:0 0 20px;">
      <p style="margin:0; font-size:13px; color:#92400e;">
        \u26A0\uFE0F <strong>Important:</strong> Please log in and change your password immediately.
        Do not share your credentials with anyone.
      </p>
    </div>

    ${button('Login to stibe', data.loginUrl)}

    <p style="font-size:13px; color:#6c757d; margin:20px 0 0;">
      If you have any issues logging in, please contact your HR Associate or reply to this email.
    </p>
  `;

  const text = `Welcome to stibe!\n\nDear ${data.recipientName},\n\nYour ${data.role} account has been created.\n\nLogin URL: ${data.loginUrl}\nEmail: ${data.loginEmail}\nPassword: ${data.tempPassword}\n\nPlease change your password after first login.\n\n\u2014 stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 9: Room Started (Class is Live) ────────────────

export interface RoomStartedData {
  studentName: string;
  roomName: string;
  teacherName: string;
  joinLink: string;
  recipientEmail: string;
}

export function roomStartedTemplate(data: RoomStartedData): { subject: string; html: string; text: string } {
  const subject = `🔴 Class is LIVE now — ${data.roomName}`;

  const body = `
    ${alertBox('Your class has started! Join now.', '#c62828', '#ffebee')}

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.studentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">
      <strong>${data.teacherName}</strong> has started the class <strong>"${data.roomName}"</strong>.
      Click below to join immediately.
    </p>

    <div style="text-align:center; margin:24px 0;">
      ${button('Join Class Now', data.joinLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">You will be asked to log in with your stibe credentials after clicking the link.</p>
  `;

  const text = `Your class "${data.roomName}" is LIVE now!\n\nDear ${data.studentName},\n\n${data.teacherName} has started the class.\n\nJoin now: ${data.joinLink}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═══════════════════════════════════════════════════════════════
// BATCH CREATION NOTIFICATION TEMPLATES
// ═══════════════════════════════════════════════════════════════

// ── Shared Batch Info Table ─────────────────────────────────

interface BatchInfoBase {
  batchName: string;
  batchType: string;     // e.g. "One-to-One", "One-to-Three"
  subjects: string[];
  grade: string;
  section?: string;
  board?: string;
}

function batchInfoRows(b: BatchInfoBase): [string, string][] {
  const rows: [string, string][] = [
    ['Batch Name', b.batchName],
    ['Batch Type', b.batchType],
    ['Subject(s)', b.subjects.length > 0 ? b.subjects.join(', ') : '—'],
    ['Grade', b.grade || '—'],
  ];
  if (b.section) rows.push(['Section', b.section]);
  if (b.board) rows.push(['Board', b.board]);
  return rows;
}

// ── Template 10: Batch Created — Coordinator ────────────────

export interface BatchCoordinatorNotifyData extends BatchInfoBase {
  coordinatorName: string;
  studentCount: number;
  teacherCount: number;
  teachers: { name: string; email: string; subject: string }[];
  students: { name: string; email: string }[];
  loginUrl: string;
  recipientEmail: string;
}

export function batchCoordinatorNotifyTemplate(data: BatchCoordinatorNotifyData): { subject: string; html: string; text: string } {
  const subject = `New batch assigned to you — ${data.batchName}`;

  const teacherRows = data.teachers.map(t =>
    `<tr><td style="padding:6px 12px; font-size:13px; color:#1a1a2e; border-bottom:1px solid #f1f3f5;">${t.name}</td><td style="padding:6px 12px; font-size:13px; color:#495057; border-bottom:1px solid #f1f3f5;">${t.subject}</td><td style="padding:6px 12px; font-size:13px; color:#6c757d; border-bottom:1px solid #f1f3f5;">${t.email}</td></tr>`
  ).join('');

  const studentRows = data.students.map(s =>
    `<tr><td style="padding:6px 12px; font-size:13px; color:#1a1a2e; border-bottom:1px solid #f1f3f5;">${s.name}</td><td style="padding:6px 12px; font-size:13px; color:#6c757d; border-bottom:1px solid #f1f3f5;">${s.email}</td></tr>`
  ).join('');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.coordinatorName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">A new batch has been created and assigned to you as the <strong>Batch Coordinator</strong>. Here are the details:</p>

    ${infoTable(batchInfoRows(data))}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td width="48%" style="padding:12px; background-color:#eff6ff; border-radius:8px; text-align:center;">
          <p style="margin:0; font-size:24px; font-weight:700; color:#1e40af;">${data.teacherCount}</p>
          <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">Teacher(s)</p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="padding:12px; background-color:#dbeafe; border-radius:8px; text-align:center;">
          <p style="margin:0; font-size:24px; font-weight:700; color:#1d4ed8;">${data.studentCount}</p>
          <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">Student(s)</p>
        </td>
      </tr>
    </table>

    ${data.teachers.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:24px 0 8px;">Assigned Teachers</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:6px; overflow:hidden;">
      <tr style="background:#f8f9fa;"><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Name</th><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Subject</th><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Email</th></tr>
      ${teacherRows}
    </table>` : ''}

    ${data.students.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:24px 0 8px;">Enrolled Students</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:6px; overflow:hidden;">
      <tr style="background:#f8f9fa;"><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Name</th><th style="padding:8px 12px; font-size:12px; color:#6c757d; text-align:left;">Email</th></tr>
      ${studentRows}
    </table>` : ''}

    <div style="margin:24px 0;">
      ${button('Open stibe Portal', data.loginUrl)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">You are responsible for scheduling sessions and managing this batch. Log in to get started.</p>
  `;

  const teachersTxt = data.teachers.map(t => `  • ${t.name} — ${t.subject} (${t.email})`).join('\n');
  const studentsTxt = data.students.map(s => `  • ${s.name} (${s.email})`).join('\n');
  const text = `New Batch Assigned to You\n\nDear ${data.coordinatorName},\n\nBatch: ${data.batchName}\nType: ${data.batchType}\nSubjects: ${data.subjects.join(', ')}\nGrade: ${data.grade}\n\nTeachers (${data.teacherCount}):\n${teachersTxt}\n\nStudents (${data.studentCount}):\n${studentsTxt}\n\nLogin: ${data.loginUrl}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 11: Batch Created — Teacher ────────────────────

export interface BatchTeacherNotifyData extends BatchInfoBase {
  teacherName: string;
  assignedSubject: string;
  coordinatorName: string;
  coordinatorEmail: string;
  studentCount: number;
  loginUrl: string;
  recipientEmail: string;
}

export function batchTeacherNotifyTemplate(data: BatchTeacherNotifyData): { subject: string; html: string; text: string } {
  const subject = `You've been assigned to batch — ${data.batchName}`;

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.teacherName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">You have been assigned as a <strong>Teacher</strong> in a new batch. Here are the details:</p>

    ${infoTable([
      ...batchInfoRows(data),
      ['Your Subject', `<strong style="color:#2563eb;">${data.assignedSubject}</strong>`],
      ['Students', String(data.studentCount)],
      ['Coordinator', `${data.coordinatorName} (${data.coordinatorEmail})`],
    ])}

    ${alertBox('Sessions will be scheduled by your batch coordinator. You will receive a separate notification before each class.', '#1565c0', '#e3f2fd')}

    <div style="margin:24px 0;">
      ${button('Open stibe Portal', data.loginUrl)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">If you have any questions, please contact your coordinator at <a href="mailto:${data.coordinatorEmail}" style="color:#4a6cf7;">${data.coordinatorEmail}</a>.</p>
  `;

  const text = `You've Been Assigned to a Batch\n\nDear ${data.teacherName},\n\nBatch: ${data.batchName}\nYour Subject: ${data.assignedSubject}\nType: ${data.batchType}\nGrade: ${data.grade}\nStudents: ${data.studentCount}\nCoordinator: ${data.coordinatorName} (${data.coordinatorEmail})\n\nLogin: ${data.loginUrl}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 12: Batch Created — Student ────────────────────

export interface BatchStudentNotifyData extends BatchInfoBase {
  studentName: string;
  teachers: { name: string; subject: string }[];
  coordinatorName: string;
  coordinatorEmail: string;
  loginUrl: string;
  recipientEmail: string;
}

export function batchStudentNotifyTemplate(data: BatchStudentNotifyData): { subject: string; html: string; text: string } {
  const subject = `You've been enrolled in — ${data.batchName}`;

  const teacherList = data.teachers.map(t =>
    `<li style="padding:4px 0; font-size:14px; color:#1a1a2e;"><strong>${t.name}</strong> — ${t.subject}</li>`
  ).join('');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.studentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">You have been enrolled in a new batch. Here are the details:</p>

    ${infoTable(batchInfoRows(data))}

    ${data.teachers.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:20px 0 8px;">Your Teachers</h3>
    <ul style="margin:0; padding:0 0 0 20px;">${teacherList}</ul>` : ''}

    <div style="margin:8px 0; padding:12px 16px; background-color:#eff6ff; border-left:4px solid #1e40af; border-radius:4px; font-size:14px; color:#1e40af;">
      Your coordinator <strong>${data.coordinatorName}</strong> will schedule your classes. You will receive a notification before each session.
    </div>

    <div style="margin:24px 0;">
      ${button('Open stibe Portal', data.loginUrl)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Questions? Contact your coordinator at <a href="mailto:${data.coordinatorEmail}" style="color:#4a6cf7;">${data.coordinatorEmail}</a>.</p>
  `;

  const teachersTxt = data.teachers.map(t => `  • ${t.name} — ${t.subject}`).join('\n');
  const text = `You've Been Enrolled in a Batch\n\nDear ${data.studentName},\n\nBatch: ${data.batchName}\nSubjects: ${data.subjects.join(', ')}\nGrade: ${data.grade}\n\nTeachers:\n${teachersTxt}\n\nCoordinator: ${data.coordinatorName} (${data.coordinatorEmail})\n\nLogin: ${data.loginUrl}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 13: Batch Created — Parent ─────────────────────

export interface BatchParentNotifyData extends BatchInfoBase {
  parentName: string;
  childName: string;
  childEmail: string;
  teachers: { name: string; subject: string }[];
  coordinatorName: string;
  coordinatorEmail: string;
  loginUrl: string;
  recipientEmail: string;
}

export function batchParentNotifyTemplate(data: BatchParentNotifyData): { subject: string; html: string; text: string } {
  const subject = `Your child ${data.childName} has been enrolled in — ${data.batchName}`;

  const teacherList = data.teachers.map(t =>
    `<li style="padding:4px 0; font-size:14px; color:#1a1a2e;"><strong>${t.name}</strong> — ${t.subject}</li>`
  ).join('');

  const body = `
    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.parentName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">
      Your child <strong>${data.childName}</strong> (<span style="color:#6c757d;">${data.childEmail}</span>) has been enrolled in a new batch.
    </p>

    ${infoTable(batchInfoRows(data))}

    ${data.teachers.length > 0 ? `
    <h3 style="font-size:15px; color:#1a1a2e; margin:20px 0 8px;">Assigned Teachers</h3>
    <ul style="margin:0; padding:0 0 0 20px;">${teacherList}</ul>` : ''}

    <div style="margin:8px 0; padding:12px 16px; background-color:#fff3e0; border-left:4px solid #e65100; border-radius:4px; font-size:14px; color:#795548;">
      Class sessions will be scheduled soon. Both you and your child will receive notifications before each session.
    </div>

    <div style="margin:24px 0;">
      ${button('Open Parent Portal', data.loginUrl)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Questions? Contact the coordinator at <a href="mailto:${data.coordinatorEmail}" style="color:#4a6cf7;">${data.coordinatorEmail}</a>.</p>
  `;

  const teachersTxt = data.teachers.map(t => `  • ${t.name} — ${t.subject}`).join('\n');
  const text = `Your Child Has Been Enrolled\n\nDear ${data.parentName},\n\nYour child ${data.childName} (${data.childEmail}) has been enrolled in batch "${data.batchName}".\n\nSubjects: ${data.subjects.join(', ')}\nGrade: ${data.grade}\n\nTeachers:\n${teachersTxt}\n\nCoordinator: ${data.coordinatorName} (${data.coordinatorEmail})\n\nLogin: ${data.loginUrl}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═══════════════════════════════════════════════════════════════
// DAILY TIMETABLE & SESSION REMINDER TEMPLATES
// ═══════════════════════════════════════════════════════════════

// ── Template 14: Daily Timetable (Morning) ──────────────────

export interface SessionInfo {
  subject: string;
  teacherName: string;
  startTime: string;     // e.g. "10:00 AM" (always IST)
  duration: string;      // e.g. "60 minutes"
  batchName: string;
  topic?: string;
  localStartTime?: string; // e.g. "8:30 AM" (recipient's local time, if different from IST)
}

export interface DailyTimetableData {
  recipientName: string;
  recipientRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
  date: string;          // e.g. "Thursday, 26 Feb 2026"
  sessions: SessionInfo[];
  childName?: string;    // for parents
  loginUrl: string;
  recipientEmail: string;
  localTimezone?: string; // e.g. "GST" — shown as secondary note when set
}

export function dailyTimetableTemplate(data: DailyTimetableData): { subject: string; html: string; text: string } {
  const roleLabel = data.recipientRole === 'parent'
    ? `${data.childName}'s`
    : 'Your';
  const count = data.sessions.length;
  const subject = `📅 Today's Timetable — ${count} class${count > 1 ? 'es' : ''} on ${data.date}`;

  const roleColors: Record<string, string> = {
    teacher: '#2563eb',
    student: '#7c3aed',
    parent: '#e11d48',
    batch_coordinator: '#6366f1',
  };
  const accent = roleColors[data.recipientRole] || '#4a6cf7';

  const sessionRows = data.sessions.map((s, i) => `
    <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
      <td style="padding:10px 12px; font-size:14px; color:#1a1a2e; font-weight:600; border-bottom:1px solid #e9ecef;">${s.localStartTime || s.startTime}${s.localStartTime ? `<br/><span style="font-size:11px; color:#6c757d; font-weight:400;">${s.startTime} IST</span>` : ''}</td>
      <td style="padding:10px 12px; font-size:14px; border-bottom:1px solid #e9ecef;">
        <span style="color:#1a1a2e; font-weight:600;">${s.subject}</span>
        ${s.topic ? `<br/><span style="font-size:12px; color:#6c757d;">Topic: ${s.topic}</span>` : ''}
      </td>
      <td style="padding:10px 12px; font-size:13px; color:#495057; border-bottom:1px solid #e9ecef;">${s.teacherName}</td>
      <td style="padding:10px 12px; font-size:13px; color:#6c757d; border-bottom:1px solid #e9ecef;">${s.duration}</td>
      <td style="padding:10px 12px; font-size:12px; color:#6c757d; border-bottom:1px solid #e9ecef;">${s.batchName}</td>
    </tr>
  `).join('');

  const greetingNote = data.recipientRole === 'parent'
    ? `Here is <strong>${data.childName}</strong>'s class schedule for today.`
    : data.recipientRole === 'teacher'
    ? `Here are the classes you are teaching today.`
    : data.recipientRole === 'batch_coordinator'
    ? `Here are all classes under your batches today.`
    : `Here is your class schedule for today.`;

  const body = `
    <div style="text-align:center; padding:16px; background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
      <p style="margin:0 0 4px; font-size:13px; color:${accent}; text-transform:uppercase; font-weight:700; letter-spacing:1px;">Today's Schedule</p>
      <h2 style="margin:0; font-size:22px; color:#1a1a2e;">${data.date}</h2>
      <p style="margin:8px 0 0; font-size:32px; font-weight:700; color:${accent};">${count}</p>
      <p style="margin:0; font-size:13px; color:#6c757d;">class${count > 1 ? 'es' : ''} scheduled</p>
      <p style="margin:6px 0 0; font-size:12px; color:#6c757d;">🕐 All times in ${data.localTimezone || 'IST'}${data.localTimezone ? ' (IST reference below)' : ''}</p>
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Good morning, ${data.recipientName}!</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">${greetingNote} You will receive a reminder with your join link 30 minutes before each class.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:8px; overflow:hidden; margin:16px 0;">
      <tr style="background-color:${accent}; color:#ffffff;">
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Time (${data.localTimezone || 'IST'})</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Subject</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Teacher</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Duration</th>
        <th style="padding:10px 12px; font-size:12px; text-align:left; text-transform:uppercase;">Batch</th>
      </tr>
      ${sessionRows}
    </table>

    ${alertBox('Join links will be sent 30 minutes before each class starts.', '#1565c0', '#e3f2fd')}

    <div style="margin:24px 0;">
      ${button('Open stibe Portal', data.loginUrl)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Have a great day of learning! 🎓</p>
  `;

  const sessionsTxt = data.sessions.map(s => `  • ${s.localStartTime || s.startTime} — ${s.subject} (${s.teacherName}) [${s.duration}] — ${s.batchName}${s.localStartTime ? ` [${s.startTime} IST]` : ''}${s.topic ? ` | Topic: ${s.topic}` : ''}`).join('\n');
  const text = `${roleLabel} Timetable for ${data.date}\n\nDear ${data.recipientName},\n\n${greetingNote}\n\n${sessionsTxt}\n\nJoin links will be sent 30 minutes before each class.\n\nLogin: ${data.loginUrl}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 15: 30-Minute Session Reminder with Join Link ──

export interface SessionReminderData {
  recipientName: string;
  recipientRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
  subject: string;
  teacherName: string;
  batchName: string;
  startTime: string;     // e.g. "10:00 AM" (IST)
  localTime?: string;    // e.g. "8:30 AM" (recipient's local time)
  localTimezone?: string; // e.g. "Dubai" — shown next to localTime
  duration: string;      // e.g. "60 minutes"
  topic?: string;
  childName?: string;    // for parents
  joinUrl: string;
  recipientEmail: string;
  minutesBefore?: number; // 30, 15, or 0 (class starting now)
}

export function sessionReminderTemplate(data: SessionReminderData): { subject: string; html: string; text: string } {
  const mins = data.minutesBefore ?? 30;
  const isNow = mins === 0;
  const timeLabel = isNow ? 'Starting Now' : `${mins} min`;
  const timeLabelLong = isNow ? 'Starting Now!' : `Starts in ${mins} Minutes`;
  const timeLabelSentence = isNow ? 'starting <strong>now</strong>' : `starting in <strong>${mins} minutes</strong>`;

  const subject = isNow
    ? `🚨 Class Starting Now — ${data.subject} | ${data.localTime || data.startTime} ${data.localTimezone || 'IST'}`
    : `⏰ Class in ${timeLabel} — ${data.subject} at ${data.localTime || data.startTime} ${data.localTimezone || 'IST'}`;

  const roleColors: Record<string, string> = {
    teacher: '#2563eb',
    student: '#7c3aed',
    parent: '#e11d48',
    batch_coordinator: '#6366f1',
  };
  const accent = roleColors[data.recipientRole] || '#4a6cf7';

  const roleNote = data.recipientRole === 'parent'
    ? `<strong>${data.childName}</strong>'s class is ${timeLabelSentence}.`
    : data.recipientRole === 'teacher'
    ? `Your class is ${timeLabelSentence}. Please prepare your materials.`
    : `Your class is ${timeLabelSentence}.`;

  const body = `
    <div style="text-align:center; padding:20px; background-color:#fff5f5; border-radius:8px; margin:0 0 24px; border:2px solid #fca5a5;">
      <p style="margin:0; font-size:36px;">${isNow ? '🚨' : '⏰'}</p>
      <h2 style="margin:8px 0; font-size:20px; color:#c62828;">Class ${timeLabelLong}</h2>
      <p style="margin:0; font-size:15px; color:#495057;">${data.localTime || data.startTime} ${data.localTimezone || 'IST'}</p>
      ${data.localTime ? `<p style="margin:4px 0 0; font-size:12px; color:#6c757d;">${data.startTime} IST</p>` : ''}
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.recipientName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">${roleNote}</p>

    ${infoTable([
      ['Subject', `<strong style="color:${accent};">${data.subject}</strong>`],
      ['Teacher', data.teacherName],
      ['Batch', data.batchName],
      ['Start Time', data.localTime ? `${data.localTime} ${data.localTimezone || ''} — <span style="color:#6c757d;">${data.startTime} IST</span>` : `${data.startTime} IST`],
      ['Duration', data.duration],
      ...(data.topic ? [['Topic', data.topic] as [string, string]] : []),
    ])}

    <div style="text-align:center; margin:28px 0; padding:20px; background:#f8f9fa; border-radius:8px; border:1px dashed #dee2e6;">
      <p style="margin:0 0 12px; font-size:14px; color:#495057; font-weight:600;">Click below to join the class:</p>
      ${button('Join Class Now', data.joinUrl)}
      <p style="margin:12px 0 0; font-size:12px; color:#6c757d;">
        🔗 This link stays active until the teacher ends the class — no login needed.
      </p>
    </div>

    ${data.recipientRole === 'teacher'
      ? alertBox('Students will join using their own links. You may start teaching once the class timer begins.', '#e65100', '#fff3e0')
      : alertBox('Please join on time. The class will be recorded for future reference.', '#1565c0', '#e3f2fd')
    }

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">If you have trouble joining, copy this link: <a href="${data.joinUrl}" style="color:#4a6cf7; word-break:break-all;">${data.joinUrl}</a></p>
  `;

  const textHeading = isNow ? 'Class Starting Now!' : `Class in ${mins} Minutes!`;
  const text = `${textHeading}\n\nDear ${data.recipientName},\n\n${data.recipientRole === 'parent' ? `${data.childName}'s` : 'Your'} class is ${isNow ? 'starting now' : `starting in ${mins} minutes`}.\n\nSubject: ${data.subject}\nTeacher: ${data.teacherName}\nBatch: ${data.batchName}\nTime: ${data.localTime || data.startTime} ${data.localTimezone || 'IST'}${data.localTime ? ` (${data.startTime} IST)` : ''}\nDuration: ${data.duration}${data.topic ? `\nTopic: ${data.topic}` : ''}\n\nJoin: ${data.joinUrl}\n\nThis link stays active until the teacher ends the class — no login needed.\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template 16: Weekly Timetable (Mon–Sat school schedule) ──

export interface WeeklyTimetableSlot {
  day: string;           // e.g. "Monday"
  subject: string;
  teacherName: string;
  startTime: string;     // e.g. "10:00 AM" (always IST)
  endTime: string;       // e.g. "11:30 AM" (always IST)
  duration: string;      // e.g. "90 min"
  localStartTime?: string; // e.g. "8:30 AM" (recipient's local time, if different from IST)
  localEndTime?: string;   // e.g. "10:00 AM"
}

export interface WeeklyTimetableData {
  recipientName: string;
  recipientRole: 'teacher' | 'student' | 'parent' | 'batch_coordinator';
  batchName: string;
  batchGrade: string;
  slots: WeeklyTimetableSlot[];
  childName?: string;
  loginUrl: string;
  recipientEmail: string;
  isUpdate?: boolean;
  localTimezone?: string; // e.g. "GST" — shown as secondary note when set
}

export function weeklyTimetableTemplate(data: WeeklyTimetableData): { subject: string; html: string; text: string } {
  const roleLabel = data.recipientRole === 'parent'
    ? `${data.childName}'s`
    : 'Your';

  const prefix = data.isUpdate ? '🔄 Updated' : '📅';
  const subject = `${prefix} Weekly Timetable — ${data.batchName} (Grade ${data.batchGrade})`;

  const roleColors: Record<string, string> = {
    teacher: '#2563eb',
    student: '#7c3aed',
    parent: '#e11d48',
    batch_coordinator: '#6366f1',
  };
  const accent = roleColors[data.recipientRole] || '#4a6cf7';

  // Group slots by day (Mon–Sat only)
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = new Map<string, WeeklyTimetableSlot[]>();
  for (const s of data.slots) {
    if (!dayOrder.includes(s.day)) continue;
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day)!.push(s);
  }

  // Use neutral color for day labels
  const dayColor = '#374151';

  const dayAbbr: Record<string, string> = {
    Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED',
    Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT',
  };

  let timetableHTML = '';
  for (const day of dayOrder) {
    const daySlots = byDay.get(day);

    if (!daySlots || daySlots.length === 0) {
      // Show empty day row
      timetableHTML += `
        <tr style="background-color:#f8f9fa;">
          <td style="padding:10px 14px; font-size:13px; font-weight:700; color:${dayColor}; border-bottom:1px solid #e9ecef; vertical-align:middle; width:80px;">${dayAbbr[day]}</td>
          <td colspan="3" style="padding:10px 14px; font-size:13px; color:#adb5bd; font-style:italic; border-bottom:1px solid #e9ecef;">No class</td>
        </tr>
      `;
      continue;
    }

    daySlots.forEach((s, i) => {
      timetableHTML += `
        <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
          ${i === 0
            ? `<td rowspan="${daySlots.length}" style="padding:10px 14px; font-size:13px; font-weight:700; color:${dayColor}; border-bottom:1px solid #e9ecef; vertical-align:middle; width:80px; border-right:2px solid ${dayColor}30;">${dayAbbr[day]}</td>`
            : ''}
          <td style="padding:10px 14px; font-size:14px; color:#1a1a2e; font-weight:600; border-bottom:1px solid #e9ecef; white-space:nowrap;">${s.localStartTime ? `${s.localStartTime} – ${s.localEndTime || ''}` : `${s.startTime} – ${s.endTime}`}${s.localStartTime ? `<br/><span style="font-size:11px; color:#6c757d; font-weight:400;">${s.startTime} – ${s.endTime} IST</span>` : ''}</td>
          <td style="padding:10px 14px; font-size:14px; border-bottom:1px solid #e9ecef;">
            <span style="color:#1a1a2e; font-weight:600;">${s.subject}</span>
          </td>
          <td style="padding:10px 14px; font-size:13px; color:#495057; border-bottom:1px solid #e9ecef;">${s.teacherName}</td>
        </tr>
      `;
    });
  }

  const totalSlots = data.slots.filter(s => dayOrder.includes(s.day)).length;
  const activeDays = dayOrder.filter(d => byDay.has(d)).length;
  const uniqueSubjects = [...new Set(data.slots.map(s => s.subject))];

  const greetingNote = data.recipientRole === 'parent'
    ? `Here is <strong>${data.childName}</strong>'s weekly class timetable for <strong>${data.batchName}</strong>.`
    : data.recipientRole === 'teacher'
    ? `Here is the weekly class schedule for <strong>${data.batchName}</strong>.`
    : data.recipientRole === 'batch_coordinator'
    ? `Here is the weekly timetable for <strong>${data.batchName}</strong>.`
    : `Here is your weekly class timetable for <strong>${data.batchName}</strong>.`;

  const updateNote = data.isUpdate
    ? alertBox('⚠ This timetable has been updated. Please review the changes below.', '#e65100', '#fff3e0')
    : '';

  const body = `
    <div style="text-align:center; padding:16px; background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
      <p style="margin:0 0 4px; font-size:13px; color:${accent}; text-transform:uppercase; font-weight:700; letter-spacing:1px;">
        ${data.isUpdate ? '🔄 Updated Weekly Timetable' : '📅 Weekly Timetable'}
      </p>
      <h2 style="margin:0; font-size:20px; color:#1a1a2e;">${data.batchName}</h2>
      <p style="margin:4px 0 0; font-size:13px; color:#6c757d;">Grade ${data.batchGrade}</p>
      <p style="margin:6px 0 0; font-size:12px; color:#6c757d;">🕐 All times in ${data.localTimezone || 'IST'}${data.localTimezone ? ' (IST reference below)' : ''}</p>
      <table cellpadding="0" cellspacing="0" style="margin:12px auto 0;">
        <tr>
          <td style="padding:0 16px; text-align:center;">
            <span style="font-size:24px; font-weight:700; color:${accent};">${totalSlots}</span>
            <br/><span style="font-size:11px; color:#6b7280;">Classes/Week</span>
          </td>
          <td style="padding:0 16px; text-align:center;">
            <span style="font-size:24px; font-weight:700; color:${accent};">${activeDays}</span>
            <br/><span style="font-size:11px; color:#6b7280;">Days</span>
          </td>
          <td style="padding:0 16px; text-align:center;">
            <span style="font-size:24px; font-weight:700; color:${accent};">${uniqueSubjects.length}</span>
            <br/><span style="font-size:11px; color:#6b7280;">Subjects</span>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size:16px; color:#1a1a2e; margin:0 0 8px;">Dear ${data.recipientName},</p>
    <p style="font-size:14px; color:#495057; margin:0 0 16px;">${greetingNote}</p>

    ${updateNote}

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e9ecef; border-radius:8px; overflow:hidden; margin:16px 0;">
      <tr style="background-color:${accent}; color:#ffffff;">
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Day</th>
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Time (${data.localTimezone || 'IST'})</th>
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Subject</th>
        <th style="padding:10px 14px; font-size:11px; text-align:left; text-transform:uppercase; letter-spacing:1px;">Teacher</th>
      </tr>
      ${timetableHTML}
    </table>

    ${alertBox('You will receive a join link 30 minutes before each class starts.', '#1e40af', '#eff6ff')}

    <div style="margin:24px 0;">
      ${button('Open stibe Portal', data.loginUrl)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Happy learning! 🎓</p>
  `;

  // Plain text version
  const sessionsTxt = dayOrder
    .map(d => {
      const slots = byDay.get(d);
      if (!slots) return `  ${d}: No class`;
      const lines = slots.map(s => `    ${s.localStartTime ? `${s.localStartTime}–${s.localEndTime || ''}` : `${s.startTime}–${s.endTime}`}  ${s.subject} (${s.teacherName})${s.localStartTime ? ` [${s.startTime}–${s.endTime} IST]` : ''}`);
      return `  ${d}:\n${lines.join('\n')}`;
    }).join('\n');

  const text = `${data.isUpdate ? 'UPDATED ' : ''}${roleLabel} Weekly Timetable — ${data.batchName} (Grade ${data.batchGrade})\n\nDear ${data.recipientName},\n\n${data.localTimezone ? `All times in ${data.localTimezone} (IST in brackets)` : 'All times in IST'}.\n${totalSlots} class${totalSlots > 1 ? 'es' : ''}/week across ${activeDays} day${activeDays > 1 ? 's' : ''}.\n\n${sessionsTxt}\n\nJoin links will be sent 30 minutes before each class.\n\nLogin: ${data.loginUrl}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═══════════════════════════════════════════════════════════════
// SESSION REQUEST TEMPLATES
// ═══════════════════════════════════════════════════════════════

export interface SessionRequestSubmittedData {
  aoName: string;
  requesterName: string;
  requesterRole: string;
  requestType: string;
  batchName: string;
  reason: string;
  proposedDate?: string;
  proposedTime?: string;
}

export function sessionRequestSubmittedTemplate(data: SessionRequestSubmittedData) {
  const isCancel = data.requestType === 'cancel';
  const subject = `📋 ${isCancel ? 'Cancellation' : 'Reschedule'} Request — ${data.batchName}`;
  const accent = isCancel ? '#dc2626' : '#2563eb';

  const rows: [string, string][] = [
    ['Request Type', isCancel ? '❌ Cancel Session' : '🔄 Reschedule Session'],
    ['Requested By', `${data.requesterName} (${data.requesterRole})`],
    ['Batch', data.batchName],
    ['Reason', data.reason],
  ];
  if (data.proposedDate) rows.push(['Proposed Date', data.proposedDate]);
  if (data.proposedTime) rows.push(['Proposed Time', data.proposedTime]);

  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">New Session Request</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.aoName}, a ${data.requesterRole} has submitted a request that needs your review.</p>
    ${alertBox(isCancel ? 'A student/parent is requesting to cancel a session.' : 'A student/parent is requesting a schedule change.', accent, isCancel ? '#fef2f2' : '#eff6ff')}
    ${infoTable(rows)}
    <p style="font-size:14px; color:#1a1a2e; margin:16px 0 0;">Please review this request in your dashboard.</p>
  `;
  const text = `New ${data.requestType} request for ${data.batchName} by ${data.requesterName}. Reason: ${data.reason}`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface SessionRequestApprovedData {
  requesterName: string;
  requestType: string;
  batchName: string;
  subject: string;
  sessionDate: string;
  proposedDate?: string;
  proposedTime?: string;
}

export function sessionRequestApprovedTemplate(data: SessionRequestApprovedData) {
  const isCancel = data.requestType === 'cancel';
  const subject = `✅ Request Approved — ${data.batchName} ${data.subject}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Request Approved</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.requesterName},</p>
    ${alertBox(isCancel
      ? `Your cancellation request for ${data.batchName} — ${data.subject} on ${data.sessionDate} has been approved.`
      : `Your reschedule request has been approved. The session has been moved to ${data.proposedDate || 'the new date'}${data.proposedTime ? ' at ' + data.proposedTime : ''}.`,
      '#1e40af', '#eff6ff')}
    ${infoTable([
      ['Batch', data.batchName],
      ['Subject', data.subject],
      ['Original Date', data.sessionDate],
      ...(data.proposedDate ? [['New Date', data.proposedDate] as [string, string]] : []),
      ['Status', '✅ Approved'],
    ])}
  `;
  const text = `Your ${data.requestType} request for ${data.batchName} has been approved.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface SessionRequestRejectedData {
  requesterName: string;
  requestType: string;
  batchName: string;
  subject: string;
  sessionDate: string;
  reason: string;
}

export function sessionRequestRejectedTemplate(data: SessionRequestRejectedData) {
  const subject = `❌ Request Rejected — ${data.batchName} ${data.subject}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Request Rejected</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.requesterName},</p>
    ${alertBox(`Your ${data.requestType} request for ${data.batchName} — ${data.subject} on ${data.sessionDate} has been rejected.`, '#dc2626', '#fef2f2')}
    ${infoTable([
      ['Batch', data.batchName], ['Subject', data.subject], ['Session Date', data.sessionDate],
      ['Reason', data.reason], ['Status', '❌ Rejected'],
    ])}
    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">Contact your academic coordinator for questions.</p>
  `;
  const text = `Your ${data.requestType} request for ${data.batchName} was rejected. Reason: ${data.reason}`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface SessionRescheduledNotifyData {
  recipientName: string;
  batchName: string;
  subject: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  reason: string;
  requestedBy: string;
  joinUrl?: string;
  recipientEmail?: string;
  duration?: string;
  topic?: string;
  childName?: string;
}

export function sessionRescheduledNotifyTemplate(data: SessionRescheduledNotifyData) {
  const subject = `🔄 Session Rescheduled — ${data.batchName} ${data.subject}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Session Rescheduled</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    ${alertBox('We sincerely apologize for the inconvenience. A session has been rescheduled to ensure continued learning.', '#2563eb', '#eff6ff')}
    ${data.childName ? `<p style="font-size:14px; color:#495057; margin:0 0 12px;">This update is regarding <strong>${data.childName}</strong>'s class.</p>` : ''}
    ${infoTable([
      ['Batch', data.batchName], ['Subject', data.subject],
      ['Previous Schedule', `${data.oldDate} at ${data.oldTime}`],
      ['New Schedule', `<strong style="color:#22C55E;">${data.newDate} at ${data.newTime}</strong>`],
      ...(data.duration ? [['Duration', data.duration] as [string, string]] : []),
      ...(data.topic ? [['Topic', data.topic] as [string, string]] : []),
      ['Reason', data.reason],
    ])}
    ${data.joinUrl ? `
    <div style="text-align:center; margin:24px 0; padding:20px; background:#f0fdf4; border-radius:8px; border:1px dashed #16a34a;">
      <p style="margin:0 0 12px; font-size:14px; color:#495057; font-weight:600;">Join the rescheduled session:</p>
      ${button('Join Class', data.joinUrl)}
    </div>
    <p style="font-size:12px; color:#6c757d; margin:0 0 8px;">If the button doesn't work, copy this link: <a href="${data.joinUrl}" style="color:#16a34a; word-break:break-all;">${data.joinUrl}</a></p>
    ` : ''}
    <p style="font-size:13px; color:#6c757d; margin:12px 0 0;">Please update your schedule accordingly. Thank you for your understanding.</p>
  `;
  const text = `Session rescheduled: ${data.batchName} ${data.subject} moved from ${data.oldDate} to ${data.newDate} at ${data.newTime}.${data.joinUrl ? ` Join: ${data.joinUrl}` : ''}`;
  return { subject, html: masterLayout(body, data.recipientEmail || ''), text };
}

export interface SessionCancelledNotifyData {
  recipientName: string;
  batchName: string;
  subject: string;
  sessionDate: string;
  startTime: string;
  reason: string;
  cancelledBy: string;
  recipientEmail?: string;
  childName?: string;
}

export function sessionCancelledNotifyTemplate(data: SessionCancelledNotifyData) {
  const subject = `❌ Session Cancelled — ${data.batchName} ${data.subject} (${data.sessionDate})`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Session Cancelled</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    ${alertBox('We regret to inform you that the following session has been cancelled. We sincerely apologize for the inconvenience.', '#dc2626', '#fef2f2')}
    ${data.childName ? `<p style="font-size:14px; color:#495057; margin:0 0 12px;">This update is regarding <strong>${data.childName}</strong>'s class.</p>` : ''}
    ${infoTable([
      ['Batch', data.batchName], ['Subject', data.subject], ['Date', data.sessionDate],
      ['Time', data.startTime], ['Cancelled By', data.cancelledBy], ['Reason', data.reason],
    ])}
    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">A makeup session may be scheduled. You will be notified with the updated schedule. Thank you for your understanding.</p>
  `;
  const text = `Session cancelled: ${data.batchName} ${data.subject} on ${data.sessionDate}. Reason: ${data.reason}. We apologize for the inconvenience.`;
  return { subject, html: masterLayout(body, data.recipientEmail || ''), text };
}

// ═══════════════════════════════════════════════════════════════
// SUBSTITUTE TEACHER NOTIFICATION
// ═══════════════════════════════════════════════════════════════

export interface SessionSubstituteNotifyData {
  recipientName: string;
  batchName: string;
  subject: string;
  originalSubject?: string;
  sessionDate: string;
  startTime: string;
  substituteTeacher: string;
  originalTeacher: string;
  reason: string;
  requestedBy: string;
  joinUrl?: string;
  recipientEmail?: string;
  duration?: string;
  topic?: string;
  grade?: string;
  studentCount?: number;
  childName?: string;
  isSubstitute?: boolean;
}

export function sessionSubstituteNotifyTemplate(data: SessionSubstituteNotifyData) {
  const subjectChanged = data.originalSubject && data.originalSubject !== data.subject;
  const subject = data.isSubstitute
    ? `📋 Teaching Assignment — ${data.batchName} ${data.subject} on ${data.sessionDate}`
    : `👥 Substitute Teacher — ${data.batchName} ${data.subject}`;

  const subjectRow = subjectChanged
    ? ['Subject', `${data.subject} (changed from ${data.originalSubject})`]
    : ['Subject', data.subject];

  // Substitute teacher gets a preparation-focused email
  if (data.isSubstitute) {
    const body = `
      <div style="text-align:center; padding:20px; background: linear-gradient(135deg, #22C55E15, #22C55E05); border-radius:8px; margin:0 0 24px; border:2px solid #22C55E30;">
        <p style="margin:0; font-size:36px;">📋</p>
        <h2 style="margin:8px 0; font-size:20px; color:#1a1a2e;">You've Been Assigned a Class</h2>
        <p style="margin:0; font-size:14px; color:#495057;">Please review the details below and prepare accordingly.</p>
      </div>

      <p style="font-size:14px; color:#1a1a2e; margin:0 0 16px;">Dear ${data.recipientName},</p>
      ${alertBox(`You have been assigned as a substitute teacher for this session, replacing ${data.originalTeacher} who is on leave.`, '#2563eb', '#eff6ff')}

      <h3 style="font-size:15px; color:#1a1a2e; margin:20px 0 8px;">📚 Session Details</h3>
      ${infoTable([
        ['Batch', data.batchName],
        ...(data.grade ? [['Grade', data.grade] as [string, string]] : []),
        subjectRow as [string, string],
        ['Date', `<strong>${data.sessionDate}</strong>`],
        ['Time', `<strong>${data.startTime}</strong>`],
        ...(data.duration ? [['Duration', data.duration] as [string, string]] : []),
        ...(data.topic ? [['Topic', data.topic] as [string, string]] : []),
        ...(data.studentCount ? [['Students', `${data.studentCount} student${data.studentCount > 1 ? 's' : ''}`] as [string, string]] : []),
      ])}

      ${data.joinUrl ? `
      <div style="text-align:center; margin:24px 0; padding:20px; background:#f0fdf4; border-radius:8px; border:1px dashed #16a34a;">
        <p style="margin:0 0 12px; font-size:14px; color:#495057; font-weight:600;">Your class join link:</p>
        ${button('Join Class', data.joinUrl)}
      </div>
      <p style="font-size:12px; color:#6c757d; margin:0 0 8px;">If the button doesn't work, copy this link: <a href="${data.joinUrl}" style="color:#16a34a; word-break:break-all;">${data.joinUrl}</a></p>
      ` : ''}

      ${alertBox('Please review the session topic and prepare your materials before the class. Students will join using their own links.', '#e65100', '#fff3e0')}
    `;
    const text = `Teaching Assignment: You are the substitute teacher for ${data.batchName} ${data.subject} on ${data.sessionDate} at ${data.startTime}.${data.topic ? ` Topic: ${data.topic}.` : ''}${data.joinUrl ? ` Join: ${data.joinUrl}` : ''}`;
    return { subject, html: masterLayout(body, data.recipientEmail || ''), text };
  }

  // Stakeholder (student/parent/coordinator) notification
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Substitute Teacher Assigned</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    ${alertBox('We apologize for the change. A qualified substitute teacher has been assigned to ensure your learning continues without interruption.', '#2563eb', '#eff6ff')}
    ${data.childName ? `<p style="font-size:14px; color:#495057; margin:0 0 12px;">This update is regarding <strong>${data.childName}</strong>'s class.</p>` : ''}
    ${infoTable([
      ['Batch', data.batchName], subjectRow as [string, string],
      ['Date', data.sessionDate], ['Time', data.startTime],
      ...(data.duration ? [['Duration', data.duration] as [string, string]] : []),
      ...(data.topic ? [['Topic', data.topic] as [string, string]] : []),
      ['Original Teacher', data.originalTeacher],
      ['Substitute Teacher', `<strong style="color:#22C55E;">${data.substituteTeacher}</strong>`],
      ['Reason', data.reason],
    ])}
    ${data.joinUrl ? `
    <div style="text-align:center; margin:24px 0; padding:20px; background:#f0fdf4; border-radius:8px; border:1px dashed #16a34a;">
      <p style="margin:0 0 12px; font-size:14px; color:#495057; font-weight:600;">Join the session with the new teacher:</p>
      ${button('Join Class', data.joinUrl)}
    </div>
    <p style="font-size:12px; color:#6c757d; margin:0 0 8px;">If the button doesn't work, copy this link: <a href="${data.joinUrl}" style="color:#16a34a; word-break:break-all;">${data.joinUrl}</a></p>
    ` : ''}
    <p style="font-size:13px; color:#6c757d; margin:12px 0 0;">The session will proceed as scheduled. Thank you for your understanding.</p>
  `;
  const text = `Substitute teacher: ${data.substituteTeacher} replaces ${data.originalTeacher} for ${data.batchName} ${data.subject} on ${data.sessionDate}.${data.joinUrl ? ` Join: ${data.joinUrl}` : ''}`;
  return { subject, html: masterLayout(body, data.recipientEmail || ''), text };
}

// ═══════════════════════════════════════════════════════════════
// TEACHER LEAVE REQUEST TEMPLATES
// ═══════════════════════════════════════════════════════════════

export interface LeaveRequestSubmittedData {
  reviewerName: string;
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  affectedSessions: number;
}

export function leaveRequestSubmittedTemplate(data: LeaveRequestSubmittedData) {
  const subject = `📋 Leave Request — ${data.teacherName} (${data.leaveType})`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Teacher Leave Request</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.reviewerName}, a teacher has submitted a leave request.</p>
    ${alertBox(`${data.affectedSessions} session${data.affectedSessions !== 1 ? 's' : ''} will be affected if approved.`, '#f59e0b', '#fffbeb')}
    ${infoTable([
      ['Teacher', data.teacherName],
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate], ['Reason', data.reason],
      ['Affected Sessions', String(data.affectedSessions)],
    ])}
    <p style="font-size:14px; color:#1a1a2e; margin:16px 0 0;">Please review in your dashboard.</p>
  `;
  const text = `Leave request from ${data.teacherName} (${data.leaveType}): ${data.startDate} to ${data.endDate}. ${data.affectedSessions} sessions affected.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface LeaveRequestApprovedData {
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  affectedSessions: number;
}

export function leaveRequestApprovedTemplate(data: LeaveRequestApprovedData) {
  const subject = `✅ Leave Approved — ${data.startDate} to ${data.endDate}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Leave Request Approved</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.teacherName},</p>
    ${alertBox('Your leave request has been approved.', '#1e40af', '#eff6ff')}
    ${infoTable([
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate],
      ['Sessions Cancelled', String(data.affectedSessions)], ['Status', '✅ Approved'],
    ])}
    ${data.affectedSessions > 0 ? alertBox(`${data.affectedSessions} sessions auto-cancelled. Stakeholders notified.`, '#f59e0b', '#fffbeb') : ''}
  `;
  const text = `Leave approved: ${data.startDate} to ${data.endDate}. ${data.affectedSessions} sessions cancelled.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface LeaveRequestRejectedData {
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  rejectedBy: string;
  rejectedByRole: string;
  reason: string;
}

export function leaveRequestRejectedTemplate(data: LeaveRequestRejectedData) {
  const subject = `❌ Leave Rejected — ${data.startDate} to ${data.endDate}`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Leave Request Rejected</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.teacherName},</p>
    ${alertBox('Your leave request has been rejected.', '#dc2626', '#fef2f2')}
    ${infoTable([
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate],
      ['Rejected By', `${data.rejectedBy} (${data.rejectedByRole})`], ['Reason', data.reason],
    ])}
  `;
  const text = `Leave rejected: ${data.startDate} to ${data.endDate}. Reason: ${data.reason}`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface LeaveSessionsAffectedData {
  recipientName: string;
  teacherName: string;
  batchName: string;
  sessionDates: string;
  sessionsCount: number;
  leaveType: string;
  startDate: string;
  endDate: string;
}

export function leaveSessionsAffectedTemplate(data: LeaveSessionsAffectedData) {
  const subject = `⚠️ Sessions Cancelled — ${data.batchName} (Teacher on Leave)`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Sessions Cancelled Due to Teacher Leave</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.recipientName},</p>
    ${alertBox(`${data.sessionsCount} session${data.sessionsCount !== 1 ? 's' : ''} cancelled because teacher is on leave.`, '#f59e0b', '#fffbeb')}
    ${infoTable([
      ['Batch', data.batchName], ['Teacher', data.teacherName],
      ['Leave Period', `${data.startDate} to ${data.endDate}`],
      ['Cancelled Dates', data.sessionDates],
    ])}
    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">The academic team will arrange make-up sessions if needed.</p>
  `;
  const text = `${data.sessionsCount} sessions for ${data.batchName} cancelled — teacher ${data.teacherName} on leave (${data.startDate} to ${data.endDate}).`;
  return { subject, html: masterLayout(body, ''), text };
}

// ── Template: Leave — HR Approved (awaiting AO) ─────────────

export interface LeaveHRApprovedData {
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  hrReviewerName: string;
}
export function leaveHRApprovedTemplate(data: LeaveHRApprovedData) {
  const subject = `✅ Leave — HR Approved, Pending AO Review (${data.startDate} to ${data.endDate})`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Leave Request — HR Approved</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.teacherName},</p>
    ${alertBox('HR has approved your leave request. It is now pending Academic Operator approval.', '#d97706', '#fffbeb')}
    ${infoTable([
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate],
      ['HR Reviewed By', data.hrReviewerName],
      ['Status', '⏳ Awaiting AO Approval'],
    ])}
    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">You will receive another notification once the Academic Operator reviews your request.</p>
  `;
  const text = `HR has approved your leave (${data.startDate} to ${data.endDate}). Awaiting AO approval.`;
  return { subject, html: masterLayout(body, ''), text };
}

export interface LeaveAOActionRequiredData {
  aoName: string;
  teacherName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  affectedSessions: number;
}
export function leaveAOActionRequiredTemplate(data: LeaveAOActionRequiredData) {
  const subject = `📋 Action Required — Leave Request from ${data.teacherName} (HR Approved)`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Leave Request — AO Approval Required</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Hi ${data.aoName}, HR has approved the following leave request. Your approval is now required.</p>
    ${alertBox(`${data.affectedSessions} session${data.affectedSessions !== 1 ? 's' : ''} will be affected. Please review in your dashboard.`, '#f59e0b', '#fffbeb')}
    ${infoTable([
      ['Teacher', data.teacherName],
      ['Leave Type', data.leaveType.charAt(0).toUpperCase() + data.leaveType.slice(1)],
      ['From', data.startDate], ['To', data.endDate],
      ['Reason', data.reason],
      ['Affected Sessions', String(data.affectedSessions)],
    ])}
    <p style="font-size:14px; color:#1a1a2e; margin:16px 0 0;">Please log in to your dashboard to approve or reject this request.</p>
  `;
  const text = `Leave request from ${data.teacherName} (${data.startDate} to ${data.endDate}) — HR approved, awaiting your review.`;
  return { subject, html: masterLayout(body, ''), text };
}

// ── Template: Invoice Generated ─────────────────────────────

export interface InvoiceGeneratedData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  invoiceNumber: string;
  description: string;
  amount: string;
  dueDate: string;
  billingPeriod: string;
  payLink: string;
  invoiceLink?: string;
  /** Invoice UUID — enables WhatsApp CTA button links */
  invoiceId?: string;
}

export function invoiceGeneratedTemplate(data: InvoiceGeneratedData) {
  const subject = `📄 New Invoice ${data.invoiceNumber} — ${data.amount} due by ${data.dueDate}`;
  const itemsHtml = descriptionItemsHtml(data.description);
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">New Invoice Generated</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">A new invoice has been generated for <strong>${data.studentName}</strong>.</p>

    ${infoTable([
      ['Invoice #', data.invoiceNumber],
      ['Amount', data.amount],
      ['Billing Period', data.billingPeriod],
      ['Due Date', data.dueDate],
    ])}

    ${itemsHtml || `<p style="font-size:13px; color:#6b7280; margin:8px 0 16px;">${data.description}</p>`}

    <div style="margin:24px 0; text-align:center;">
      ${button('Pay Now', data.payLink)}
      ${data.invoiceLink ? `<span style="display:inline-block; width:12px;"></span>${button('View Invoice PDF', data.invoiceLink)}` : ''}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Please ensure payment is made before the due date to avoid any disruption in classes.</p>
  `;
  const text = `New Invoice ${data.invoiceNumber}\n\nDear ${data.recipientName},\n\nA new invoice of ${data.amount} has been generated for ${data.studentName}.\nDescription: ${data.description}\nDue Date: ${data.dueDate}\n\nPay at: ${data.payLink}\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Payment Receipt ───────────────────────────────

export interface PaymentReceiptData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  receiptNumber: string;
  invoiceNumber: string;
  amount: string;
  transactionId: string;
  paymentMethod: string;
  paymentDate: string;
  receiptLink: string;
  description?: string;
}

export function paymentReceiptTemplate(data: PaymentReceiptData) {
  const subject = `✅ Payment Received — ${data.receiptNumber} (${data.amount})`;
  const itemsHtml = data.description ? descriptionItemsHtml(data.description) : '';
  const body = `
    <div style="text-align:center; padding:16px; background-color:#eff6ff; border-radius:8px; margin:0 0 24px;">
      <span style="font-size:32px;">&#10004;</span>
      <h2 style="margin:8px 0 0; color:#1e40af; font-size:20px;">Payment Successful</h2>
    </div>

    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">Payment has been received for <strong>${data.studentName}</strong>.</p>

    ${infoTable([
      ['Receipt #', data.receiptNumber],
      ['Invoice #', data.invoiceNumber],
      ['Amount', data.amount],
      ['Transaction ID', data.transactionId],
      ['Payment Method', data.paymentMethod],
      ['Date', data.paymentDate],
    ])}

    ${itemsHtml}

    <div style="margin:24px 0;">
      ${button('View Receipt', data.receiptLink)}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">This is an auto-generated receipt. Please save it for your records.</p>
  `;
  const text = `Payment Received — ${data.receiptNumber}\n\nDear ${data.recipientName},\n\nAmount: ${data.amount}\nTransaction ID: ${data.transactionId}\nReceipt: ${data.receiptLink}\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Payslip Notification ──────────────────────────

export interface PayslipNotificationData {
  teacherName: string;
  recipientEmail: string;
  periodLabel: string;
  classesConducted: number;
  basePay: string;
  incentive: string;
  deductions: string;
  totalPay: string;
  status: string;
}

export function payslipNotificationTemplate(data: PayslipNotificationData) {
  const subject = `💰 Payslip — ${data.periodLabel} (${data.totalPay})`;
  const body = `
    <h2 style="margin:0 0 8px; font-size:20px; color:#1a1a2e;">Payslip for ${data.periodLabel}</h2>
    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.teacherName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">Your payslip for <strong>${data.periodLabel}</strong> has been ${data.status === 'paid' ? 'paid' : 'generated'}.</p>

    ${infoTable([
      ['Period', data.periodLabel],
      ['Classes Conducted', String(data.classesConducted)],
      ['Base Pay', data.basePay],
      ['Incentive', data.incentive],
      ['Deductions (LOP)', data.deductions],
      ['Total Pay', data.totalPay],
      ['Status', data.status.toUpperCase()],
    ])}

    ${data.status === 'paid'
      ? alertBox('Your salary has been processed and credited.', '#1e40af', '#eff6ff')
      : alertBox('Your payslip has been generated. Payment will be processed shortly.', '#1565c0', '#e3f2fd')
    }

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">For any discrepancies, please contact the HR department.</p>
  `;
  const text = `Payslip for ${data.periodLabel}\n\nDear ${data.teacherName},\nClasses: ${data.classesConducted}\nBase Pay: ${data.basePay}\nIncentive: ${data.incentive}\nDeductions: ${data.deductions}\nTotal: ${data.totalPay}\nStatus: ${data.status}\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Payment Reminder ──────────────────────────────

export interface PaymentReminderData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  payLink: string;
}

export function paymentReminderTemplate(data: PaymentReminderData) {
  const isOverdue = data.daysOverdue > 0;
  const subject = isOverdue
    ? `⚠️ Payment Overdue — ${data.invoiceNumber} (${data.daysOverdue} days)`
    : `🔔 Payment Reminder — ${data.invoiceNumber} due ${data.dueDate}`;
  const body = `
    ${isOverdue
      ? alertBox(`Payment of ${data.amount} is ${data.daysOverdue} day${data.daysOverdue !== 1 ? 's' : ''} overdue!`, '#d32f2f', '#ffebee')
      : alertBox(`Payment of ${data.amount} is due by ${data.dueDate}.`, '#f57c00', '#fff3e0')
    }

    <p style="color:#6c757d; font-size:14px; margin:16px 0;">Dear ${data.recipientName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">This is a reminder for the pending fee payment for <strong>${data.studentName}</strong>.</p>

    ${infoTable([
      ['Invoice #', data.invoiceNumber],
      ['Amount', data.amount],
      ['Due Date', data.dueDate],
      ...(isOverdue ? [['Overdue By', `${data.daysOverdue} days`] as [string, string]] : []),
    ])}

    <div style="margin:24px 0;">
      ${button('Pay Now', data.payLink, isOverdue ? '#dc2626' : '#16a34a')}
    </div>

    <p style="font-size:13px; color:#6c757d; margin:0;">Continued non-payment may result in temporary suspension from classes.</p>
  `;
  const text = `Payment ${isOverdue ? 'Overdue' : 'Reminder'} — ${data.invoiceNumber}\n\nDear ${data.recipientName},\nAmount: ${data.amount}\nDue Date: ${data.dueDate}${isOverdue ? `\nOverdue: ${data.daysOverdue} days` : ''}\n\nPay at: ${data.payLink}\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Password Reset OTP ──────────────────────────────────────

export interface PasswordResetOtpData {
  recipientName: string;
  recipientEmail: string;
  otp: string;
}

export function passwordResetOtpTemplate(data: PasswordResetOtpData): { subject: string; html: string; text: string } {
  const subject = `🔐 Your Password Reset Code — ${data.otp}`;
  const body = `
    <p style="color:#374151; font-size:15px; margin:0 0 16px;">Hi <strong>${data.recipientName}</strong>,</p>
    <p style="color:#4b5563; font-size:14px; margin:0 0 24px; line-height:1.6;">
      We received a request to reset your stibe account password. Use the code below to verify your identity:
    </p>

    <div style="text-align:center; margin:28px 0;">
      <div style="display:inline-block; background-color:#1e40af; padding:20px 40px; border-radius:12px; box-shadow:0 4px 16px rgba(30,64,175,0.2);">
        <span style="font-size:36px; font-weight:800; color:#ffffff; letter-spacing:8px; font-family:monospace;">${data.otp}</span>
      </div>
    </div>

    ${alertBox('This code expires in 10 minutes. Do not share it with anyone.', '#b45309', '#fffbeb')}

    <p style="color:#6b7280; font-size:13px; margin:20px 0 0; line-height:1.5;">
      If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
  `;
  const text = `stibe Password Reset\n\nHi ${data.recipientName},\n\nYour password reset code is: ${data.otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── DEMO SESSION TEMPLATES ─────────────────────────────────

/**
 * Email sent to teacher when a demo session is requested.
 */
interface DemoTeacherRequestData {
  teacherName: string;
  studentName: string;
  studentGrade: string;
  subject: string;
  portions: string;
  recipientEmail: string;
}

export function demoTeacherRequestTemplate(data: DemoTeacherRequestData): { subject: string; html: string; text: string } {
  const subject = `Demo Session Request — ${data.subject} (Grade ${data.studentGrade})`;
  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session Request</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">A new student has requested a demo session with you.</p>

    ${infoTable([
      ['Student Name', data.studentName],
      ['Grade', data.studentGrade],
      ['Subject', data.subject],
      ['Topics / Portions', data.portions],
    ])}

    ${alertBox('⏱ This is a 30-minute demo session. Please accept or reject from your dashboard.', '#0d9488', '#f0fdfa')}

    <div style="text-align:center; margin:24px 0;">
      ${button('Open Dashboard', 'https://stibelearning.online/teacher#demo', '#16a34a')}
    </div>

    <p style="color:#6b7280; font-size:13px; margin:16px 0 0; line-height:1.5;">
      Once you accept, a demo session room will be created automatically and the student will be notified with a join link.
    </p>
  `;
  const text = `Demo Session Request\n\nHi ${data.teacherName},\n\nA new student (${data.studentName}, Grade ${data.studentGrade}) has requested a ${data.subject} demo session.\n\nTopics: ${data.portions}\n\nPlease log in to your dashboard to accept or reject: https://stibelearning.online/teacher#demo\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

/**
 * Email sent to teacher when CRM agent directly assigns them to a demo session.
 * Informational only — no accept/reject needed.
 */
interface DemoTeacherAssignedData {
  teacherName: string;
  studentName: string;
  subject: string;
  scheduledStart: string;
  joinLink: string;
  durationMinutes: number;
  recipientEmail: string;
  studentGrade?: string;
}

export function demoTeacherAssignedTemplate(data: DemoTeacherAssignedData): { subject: string; html: string; text: string } {
  const subject = `Demo Session Assigned — ${data.subject} at ${new Date(data.scheduledStart).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}`;
  const startDate = new Date(data.scheduledStart);
  const timeStr = startDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session Assigned 📋</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">Hi ${data.teacherName}, you have been assigned a demo session.</p>

    ${infoTable([
      ['Student', data.studentName],
      ...(data.studentGrade ? [['Grade', data.studentGrade] as [string, string]] : []),
      ['Subject', data.subject],
      ['Scheduled Time', timeStr],
      ['Duration', `${data.durationMinutes} minutes`],
    ])}

    ${alertBox('This session was scheduled by the sales team. Please join at the scheduled time — no confirmation needed.', '#0d9488', '#f0fdfa')}

    <div style="text-align:center; margin:24px 0;">
      ${button('Join Demo Session', data.joinLink, '#16a34a')}
    </div>

    <p style="color:#6b7280; font-size:13px; margin:16px 0 0; line-height:1.5;">
      The student has already been sent a join link. Make sure you have a stable connection and are ready a few minutes before the scheduled time.
    </p>
  `;
  const text = `Demo Session Assigned\n\nHi ${data.teacherName},\n\nYou have been assigned a demo session:\n\nStudent: ${data.studentName}${data.studentGrade ? ` (Grade ${data.studentGrade})` : ''}\nSubject: ${data.subject}\nTime: ${timeStr}\nDuration: ${data.durationMinutes} minutes\n\nJoin here: ${data.joinLink}\n\nNo confirmation needed — please join at the scheduled time.\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

/**
 * Email sent to student when teacher accepts the demo session.
 */
interface DemoStudentAcceptedData {
  studentName: string;
  teacherName: string;
  subject: string;
  scheduledStart: string;
  joinLink: string;
  durationMinutes: number;
  recipientEmail: string;
}

export function demoStudentAcceptedTemplate(data: DemoStudentAcceptedData): { subject: string; html: string; text: string } {
  const subject = `Your Demo Session is Confirmed! — ${data.subject}`;
  const startDate = new Date(data.scheduledStart);
  const timeStr = startDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session Confirmed! 🎉</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">Great news — your demo session has been scheduled.</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Teacher', data.teacherName],
      ['Scheduled Time', timeStr],
      ['Duration', `${data.durationMinutes} minutes`],
    ])}

    ${alertBox('✅ Your demo session is FREE — no payment required!', '#16a34a', '#f0fdf4')}

    <div style="text-align:center; margin:24px 0;">
      ${button('Join Demo Session', data.joinLink, '#16a34a')}
    </div>

    <p style="color:#6b7280; font-size:13px; margin:16px 0 0; line-height:1.5;">
      Click the button above when it's time for your session. Make sure you have a stable internet connection and a quiet environment.
    </p>
  `;
  const text = `Demo Session Confirmed!\n\nHi ${data.studentName},\n\nYour ${data.subject} demo session with ${data.teacherName} is scheduled for ${timeStr} (${data.durationMinutes} min).\n\nJoin here: ${data.joinLink}\n\nThis session is completely FREE!\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

/**
 * Email sent to AO when teacher accepts a demo request.
 */
interface DemoAOAcceptedData {
  teacherName: string;
  studentName: string;
  subject: string;
  studentGrade: string;
  scheduledStart: string;
  durationMinutes: number;
  recipientEmail: string;
}

export function demoAOAcceptedTemplate(data: DemoAOAcceptedData): { subject: string; html: string; text: string } {
  const subject = `Demo Accepted — ${data.teacherName} → ${data.studentName} (${data.subject})`;
  const startDate = new Date(data.scheduledStart);
  const timeStr = startDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session Accepted ✅</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">A teacher has accepted a demo request and scheduled the session.</p>

    ${infoTable([
      ['Teacher', data.teacherName],
      ['Student', data.studentName],
      ['Grade', data.studentGrade],
      ['Subject', data.subject],
      ['Scheduled Time', timeStr],
      ['Duration', `${data.durationMinutes} minutes`],
    ])}

    ${alertBox('The student has been automatically notified with a join link. The teacher will start the session at the scheduled time.', '#16a34a', '#f0fdf4')}

    <div style="text-align:center; margin:24px 0;">
      ${button('View in Dashboard', 'https://stibelearning.online/academic-operator#demo', '#16a34a')}
    </div>
  `;
  const text = `Demo Accepted\n\n${data.teacherName} accepted the demo for ${data.studentName} (${data.subject}, Grade ${data.studentGrade}).\n\nScheduled: ${timeStr} (${data.durationMinutes} min)\n\nStudent has been notified.\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

/**
 * Email sent to CRM sales agent when a demo session is accepted.
 */
interface DemoAgentJoinData {
  agentName: string;
  teacherName: string;
  studentName: string;
  subject: string;
  scheduledStart: string;
  joinLink: string;
  durationMinutes: number;
  recipientEmail: string;
}

export function demoAgentJoinTemplate(data: DemoAgentJoinData): { subject: string; html: string; text: string } {
  const subject = `Demo Session Ready — Join as Agent (${data.subject})`;
  const startDate = new Date(data.scheduledStart);
  const timeStr = startDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session — You're Invited! 🎯</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">A demo session has been scheduled for your lead. Join to observe and assist.</p>

    ${infoTable([
      ['Student', data.studentName],
      ['Teacher', data.teacherName],
      ['Subject', data.subject],
      ['Scheduled Time', timeStr],
      ['Duration', `${data.durationMinutes} minutes`],
      ['Your Role', 'Sales Agent (visible participant)'],
    ])}

    ${alertBox('Join BEFORE the student — the student will wait until you are connected.', '#d97706', '#fffbeb')}

    <div style="text-align:center; margin:24px 0;">
      ${button('Join Demo Session', data.joinLink)}
    </div>

    <p style="color:#6b7280; font-size:13px; margin:16px 0 0; line-height:1.5;">
      You will be visible to both the teacher and student. Your camera and microphone will be active.
    </p>
  `;
  const text = `Demo Session Ready\n\nHi ${data.agentName},\n\nA demo for ${data.studentName} (${data.subject}) with ${data.teacherName} is scheduled at ${timeStr} (${data.durationMinutes} min).\n\nJoin here: ${data.joinLink}\n\nPlease join before the student.\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

/**
 * Email sent to student after registration — "we're searching for a teacher".
 */
interface DemoStudentSearchingData {
  studentName: string;
  subject: string;
  recipientEmail: string;
}

export function demoStudentSearchingTemplate(data: DemoStudentSearchingData): { subject: string; html: string; text: string } {
  const subject = `Demo Request Received — ${data.subject}`;
  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">We Received Your Demo Request!</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">Thank you for your interest in stibe Classes.</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Status', '🔍 Finding the best teacher for you'],
    ])}

    ${alertBox('We are checking teacher availability and will confirm your demo session shortly via email and phone.', '#0d9488', '#f0fdfa')}

    <p style="color:#6b7280; font-size:13px; margin:16px 0 0; line-height:1.5;">
      Once a teacher confirms, you'll receive another email with the exact time and a link to join your <strong>free 30-minute demo session</strong>.
    </p>
    <p style="color:#6b7280; font-size:13px; margin:8px 0 0; line-height:1.5;">
      If you have any questions, please reply to this email or contact us.
    </p>
  `;
  const text = `Demo Request Received\n\nHi ${data.studentName},\n\nThank you for requesting a ${data.subject} demo session with stibe Classes.\n\nWe are finding the best available teacher for you. Once confirmed, you'll receive an email with the session time and join link.\n\nYour demo session is completely FREE (30 minutes).\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

/**
 * Email sent to student when teacher rejects / AO cancels the demo request.
 */
interface DemoStudentRejectedData {
  studentName: string;
  subject: string;
  reason?: string;
  recipientEmail: string;
}

export function demoStudentRejectedTemplate(data: DemoStudentRejectedData): { subject: string; html: string; text: string } {
  const subject = `Your Demo Session Request — Update Required`;
  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session Update</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 20px;">Hi ${data.studentName}, we have an update on your demo session request.</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Status', '⚠️ Unable to schedule at this time'],
      ...(data.reason ? [['Note', data.reason] as [string, string]] : []),
    ])}

    ${alertBox('Unfortunately we were unable to assign a teacher for your demo session at this time. Please contact us and we will arrange a new slot as soon as possible.', '#b45309', '#fffbeb')}

    <div style="text-align:center; margin:24px 0;">
      ${button('Contact stibe', 'https://stibelearning.online')}
    </div>

    <p style="color:#6b7280; font-size:13px; margin:8px 0 0; line-height:1.5;">
      We apologise for the inconvenience. Our team will reach out to you shortly to reschedule your demo session.
    </p>
  `;
  const text = `Demo Session Update\n\nHi ${data.studentName},\n\nUnfortunately we were unable to schedule your ${data.subject} demo session at this time${data.reason ? '. ' + data.reason : ''}.\n\nOur team will contact you to arrange a new slot.\n\nWe apologise for the inconvenience.\n\n— stibe Classes`;
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── POST-DEMO SUMMARY TEMPLATES ────────────────────────────

/**
 * Shared type for all demo summary templates.
 */
export interface DemoSummaryTemplateData {
  // Session
  roomId: string;
  roomName: string;
  subject: string;
  grade: string;
  scheduledStr: string;
  endedStr: string;
  durationMinutes: number;
  outcome: string;
  outcomeLabel: string;
  portions: string;
  // Participants
  teacherName: string;
  studentName: string;
  studentEmail: string;
  // Attendance
  durationStr: string;
  studentJoinedAt: string | null;
  studentDurationSec: number;
  studentLate: boolean;
  studentLateBySec: number;
  studentJoinCount: number;
  // Engagement
  attentionScore: number;
  attentiveMinutes: number;
  lookingAwayMinutes: number;
  eyesClosedMinutes: number;
  notInFrameMinutes: number;
  distractedMinutes: number;
  phoneDetectedMinutes: number;
  headTurnedMinutes: number;
  yawningMinutes: number;
  inactiveMinutes: number;
  tabSwitchedMinutes: number;
  totalMonitoringEvents: number;
  // Alerts
  alerts: { type: string; severity: string; message: string }[];
  // Exam
  exam: {
    totalQuestions: number;
    answered: number;
    skipped: number;
    score: number;
    totalMarks: number;
    percentage: number;
    gradeLetter: string;
    timeTakenSeconds: number;
    questions: {
      questionText: string;
      correctAnswer: string;
      selectedOption: string;
      isCorrect: boolean;
      marks: number;
      topic?: string;
    }[];
  } | null;
  // Feedback
  feedback: { rating: number; text: string; tags: string } | null;
  recipientEmail: string;
}

// ── Engagement badge color helpers ──────────────────────────

function engagementColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

function engagementLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor';
}

function outcomeIcon(outcome: string): string {
  if (outcome === 'completed_with_exam') return '🏆';
  if (outcome === 'completed') return '✅';
  if (outcome === 'student_no_show') return '❌';
  if (outcome === 'cancelled_by_teacher') return '⚠️';
  return '📋';
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return '#16a34a';
  if (grade === 'B+' || grade === 'B') return '#ca8a04';
  if (grade === 'C+' || grade === 'C') return '#ea580c';
  return '#dc2626';
}

function starRating(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

function fmtExamTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function engagementBar(label: string, minutes: number, totalMin: number, color: string): string {
  const pct = totalMin > 0 ? Math.min(100, Math.round((minutes / totalMin) * 100)) : 0;
  return `<tr>
    <td style="padding:6px 14px; font-size:12px; color:#6b7280; width:35%;">${label}</td>
    <td style="padding:6px 14px;">
      <div style="background:#f3f4f6; border-radius:4px; height:12px; overflow:hidden;">
        <div style="width:${pct}%; background:${color}; height:100%; border-radius:4px;"></div>
      </div>
    </td>
    <td style="padding:6px 14px; font-size:12px; color:#374151; font-weight:600; text-align:right; white-space:nowrap; width:20%;">${minutes} min</td>
  </tr>`;
}

function examQuestionRows(questions: DemoSummaryTemplateData['exam'] extends null ? never : NonNullable<DemoSummaryTemplateData['exam']>['questions']): string {
  return questions.map((q, i) => `<tr>
    <td style="padding:8px 12px; font-size:12px; color:#374151; border-bottom:1px solid #f3f4f6; vertical-align:top; width:5%;">${i + 1}</td>
    <td style="padding:8px 12px; font-size:12px; color:#374151; border-bottom:1px solid #f3f4f6; vertical-align:top;">${q.questionText}${q.topic ? ` <span style="color:#9ca3af;">(${q.topic})</span>` : ''}</td>
    <td style="padding:8px 12px; font-size:12px; color:#374151; border-bottom:1px solid #f3f4f6; vertical-align:top; text-align:center;">${q.correctAnswer}</td>
    <td style="padding:8px 12px; font-size:12px; border-bottom:1px solid #f3f4f6; vertical-align:top; text-align:center; color:${q.isCorrect ? '#16a34a' : '#dc2626'}; font-weight:600;">${q.selectedOption || '\u2014'} ${q.isCorrect ? '&#10004;' : '&#10008;'}</td>
  </tr>`).join('');
}

// ── Shared sections (reused across templates) ───────────────

function sessionOverviewSection(d: DemoSummaryTemplateData): string {
  return `
    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">📋 Session Overview</h3>
    ${infoTable([
      ['Subject', `${d.subject} — Grade ${d.grade}`],
      ['Topics Covered', d.portions || 'Not specified'],
      ['Scheduled', d.scheduledStr],
      ['Ended', d.endedStr],
      ['Duration', `${d.durationMinutes} min (planned)`],
      ['Outcome', `${outcomeIcon(d.outcome)} ${d.outcomeLabel}`],
    ])}
  `;
}

function attendanceSection(d: DemoSummaryTemplateData): string {
  if (d.outcome === 'student_no_show') {
    return alertBox('❌ The student did not join this demo session.', '#dc2626', '#fef2f2');
  }
  const lateStr = d.studentLate
    ? `Late by ${Math.ceil(d.studentLateBySec / 60)} min`
    : 'On time';
  return `
    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">⏱ Student Attendance</h3>
    ${infoTable([
      ['Student', d.studentName],
      ['Time in Session', d.durationStr],
      ['Punctuality', lateStr],
      ['Join Count', d.studentJoinCount > 1 ? `${d.studentJoinCount} (reconnected ${d.studentJoinCount - 1}×)` : '1 (no disconnects)'],
    ])}
  `;
}

function engagementSection(d: DemoSummaryTemplateData): string {
  if (d.totalMonitoringEvents === 0) {
    return `
      <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">🧠 AI Engagement Analysis</h3>
      <p style="font-size:13px; color:#9ca3af; margin:8px 0;">No engagement data available (camera may not have been enabled).</p>
    `;
  }
  const color = engagementColor(d.attentionScore);
  const label = engagementLabel(d.attentionScore);
  const total = d.attentiveMinutes + d.lookingAwayMinutes + d.eyesClosedMinutes + d.notInFrameMinutes + d.distractedMinutes + d.headTurnedMinutes + d.yawningMinutes + d.inactiveMinutes + d.tabSwitchedMinutes;
  return `
    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">🧠 AI Engagement Analysis</h3>
    <div style="text-align:center; margin:16px 0;">
      <div style="display:inline-block; border:4px solid ${color}; border-radius:50%; width:80px; height:80px; text-align:center; padding-top:22px; box-sizing:border-box;">
        <span style="font-size:26px; font-weight:800; color:${color}; line-height:1; display:block;">${d.attentionScore}%</span>
      </div>
      <p style="margin:6px 0 0; font-size:14px; font-weight:600; color:${color};">${label}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      ${engagementBar('Attentive', d.attentiveMinutes, total, '#16a34a')}
      ${engagementBar('Looking Away', d.lookingAwayMinutes, total, '#ca8a04')}
      ${engagementBar('Distracted', d.distractedMinutes, total, '#ea580c')}
      ${engagementBar('Eyes Closed', d.eyesClosedMinutes, total, '#dc2626')}
      ${engagementBar('Out of Frame', d.notInFrameMinutes, total, '#6b7280')}
      ${d.headTurnedMinutes > 0 ? engagementBar('Head Turned', d.headTurnedMinutes, total, '#d97706') : ''}
      ${d.yawningMinutes > 0 ? engagementBar('Yawning', d.yawningMinutes, total, '#9333ea') : ''}
      ${d.inactiveMinutes > 0 ? engagementBar('Inactive', d.inactiveMinutes, total, '#64748b') : ''}
      ${d.tabSwitchedMinutes > 0 ? engagementBar('Tab Switched', d.tabSwitchedMinutes, total, '#7c3aed') : ''}
      ${d.phoneDetectedMinutes > 0 ? engagementBar('Phone Detected', d.phoneDetectedMinutes, total, '#7c3aed') : ''}
    </table>
  `;
}

function alertsSection(d: DemoSummaryTemplateData): string {
  if (d.alerts.length === 0) return '';
  return `
    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">🚨 Alerts Detected</h3>
    ${d.alerts.map(a => {
      const c = a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#ca8a04' : '#6b7280';
      const bg = a.severity === 'critical' ? '#fef2f2' : a.severity === 'warning' ? '#fffbeb' : '#f9fafb';
      return alertBox(`${a.severity === 'critical' ? '🔴' : '⚠️'} ${a.message}`, c, bg);
    }).join('')}
  `;
}

function examSection(d: DemoSummaryTemplateData, showQuestions: boolean): string {
  if (!d.exam) return '';
  const e = d.exam;
  const gc = gradeColor(e.gradeLetter);
  return `
    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">📝 Exam Results</h3>
    <div style="text-align:center; margin:16px 0;">
      <div style="display:inline-block; background:${gc}; color:#fff; border-radius:12px; padding:12px 28px;">
        <span style="font-size:28px; font-weight:800;">${e.percentage}%</span>
        <span style="font-size:16px; font-weight:600; margin-left:8px;">Grade ${e.gradeLetter}</span>
      </div>
    </div>
    ${infoTable([
      ['Score', `${e.score} / ${e.totalMarks}`],
      ['Questions', `${e.answered} answered, ${e.skipped} skipped (of ${e.totalQuestions})`],
      ['Time Taken', fmtExamTime(e.timeTakenSeconds)],
    ])}
    ${showQuestions && e.questions.length > 0 ? `
    <p style="font-size:12px; color:#9ca3af; margin:16px 0 6px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Question-wise Breakdown</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb;">#</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb;">Question</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb; text-align:center;">Correct</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb; text-align:center;">Student</td>
      </tr>
      ${examQuestionRows(e.questions)}
    </table>
    ` : ''}
  `;
}

function feedbackSection(d: DemoSummaryTemplateData): string {
  if (!d.feedback) return '';
  const fb = d.feedback;
  const sc = fb.rating >= 4 ? '#16a34a' : fb.rating >= 3 ? '#ca8a04' : '#dc2626';
  return `
    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">💬 Student Feedback</h3>
    <div style="text-align:center; margin:12px 0;">
      <span style="font-size:28px; color:${sc}; letter-spacing:2px;">${starRating(fb.rating)}</span>
      <p style="font-size:14px; font-weight:600; color:${sc}; margin:4px 0;">${fb.rating}/5</p>
    </div>
    ${fb.text ? `<div style="padding:12px 16px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb; margin:8px 0;">
      <p style="font-size:13px; color:#374151; margin:0; line-height:1.5; font-style:italic;">"${fb.text}"</p>
    </div>` : ''}
    ${fb.tags ? `<p style="font-size:12px; color:#9ca3af; margin:8px 0;">Tags: ${fb.tags}</p>` : ''}
  `;
}

// ═════════════════════════════════════════════════════════════
// 1. TEACHER — Post-Demo Summary
// ═════════════════════════════════════════════════════════════

export function demoSummaryTeacherTemplate(data: DemoSummaryTemplateData): { subject: string; html: string; text: string } {
  const subject = `Demo Summary — ${data.subject} (${data.studentName}) ${outcomeIcon(data.outcome)}`;

  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session Report</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 6px;">Hi ${data.teacherName}, here's the full report for your demo session.</p>

    ${sessionOverviewSection(data)}
    ${attendanceSection(data)}
    ${engagementSection(data)}
    ${alertsSection(data)}
    ${examSection(data, true)}
    ${feedbackSection(data)}

    ${data.feedback && data.feedback.rating >= 4 ? alertBox('🎉 Great job! The student rated this session highly.', '#16a34a', '#f0fdf4') : ''}
    ${data.feedback && data.feedback.rating <= 2 ? alertBox('Note: The student gave a low rating. The academic team may follow up.', '#ca8a04', '#fffbeb') : ''}

    <p style="color:#9ca3af; font-size:12px; margin:24px 0 0; line-height:1.5;">
      This is an automated summary generated by stibe's AI classroom analytics.
    </p>
  `;

  const examText = data.exam
    ? `\n\nExam Results: ${data.exam.score}/${data.exam.totalMarks} (${data.exam.percentage}%, Grade ${data.exam.gradeLetter})`
    : '';
  const feedbackText = data.feedback
    ? `\n\nStudent Feedback: ${data.feedback.rating}/5${data.feedback.text ? ' — "' + data.feedback.text + '"' : ''}`
    : '';

  const text = `Demo Session Report\n\nHi ${data.teacherName},\n\nSubject: ${data.subject} (Grade ${data.grade})\nStudent: ${data.studentName}\nOutcome: ${data.outcomeLabel}\nScheduled: ${data.scheduledStr}\nEnded: ${data.endedStr}\n\nStudent Time in Session: ${data.durationStr}\nAttention Score: ${data.attentionScore}%${examText}${feedbackText}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═════════════════════════════════════════════════════════════
// 2. ACADEMIC OPERATOR — Post-Demo Summary
// ═════════════════════════════════════════════════════════════

export function demoSummaryAOTemplate(data: DemoSummaryTemplateData): { subject: string; html: string; text: string } {
  const subject = `[AO Report] Demo: ${data.studentName} — ${data.subject} ${outcomeIcon(data.outcome)}`;

  // Conversion signal analysis
  let conversionSignal = '';
  if (data.outcome === 'student_no_show') {
    conversionSignal = alertBox('❌ Student did not attend. Consider reaching out to reschedule.', '#dc2626', '#fef2f2');
  } else if (data.exam && data.exam.percentage >= 70 && data.feedback && data.feedback.rating >= 4) {
    conversionSignal = alertBox('🔥 HIGH CONVERSION POTENTIAL — Strong exam score + positive feedback. Prioritize follow-up!', '#16a34a', '#f0fdf4');
  } else if (data.feedback && data.feedback.rating >= 4) {
    conversionSignal = alertBox('👍 Good feedback — student enjoyed the session. Timely follow-up recommended.', '#16a34a', '#f0fdf4');
  } else if (data.attentionScore >= 70 && data.studentDurationSec >= data.durationMinutes * 30) {
    conversionSignal = alertBox('📊 Engaged student — high attention for most of the session. Worth following up.', '#0d9488', '#f0fdfa');
  } else if (data.feedback && data.feedback.rating <= 2) {
    conversionSignal = alertBox('⚠️ Low feedback rating — review teacher performance and consider offering another demo.', '#ca8a04', '#fffbeb');
  }

  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Demo Session Report — AO View</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 6px;">Complete analytics for conversion decision-making.</p>

    ${conversionSignal}

    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">👤 Lead Details</h3>
    ${infoTable([
      ['Student', `${data.studentName} (${data.studentEmail})`],
      ['Grade', data.grade],
      ['Subject', data.subject],
      ['Topics Requested', data.portions || 'Not specified'],
      ['Teacher Assigned', data.teacherName],
    ])}

    ${sessionOverviewSection(data)}
    ${attendanceSection(data)}
    ${engagementSection(data)}
    ${alertsSection(data)}
    ${examSection(data, true)}
    ${feedbackSection(data)}

    <div style="text-align:center; margin:24px 0;">
      ${button('View Dashboard', 'https://stibelearning.online/owner#demo')}
    </div>

    <p style="color:#9ca3af; font-size:12px; margin:24px 0 0; line-height:1.5;">
      Automated report from stibe AI classroom analytics. Follow up promptly for best conversion.
    </p>
  `;

  const examText = data.exam
    ? `\nExam: ${data.exam.score}/${data.exam.totalMarks} (${data.exam.percentage}%, Grade ${data.exam.gradeLetter})`
    : '';
  const feedbackText = data.feedback
    ? `\nFeedback: ${data.feedback.rating}/5${data.feedback.text ? ' — "' + data.feedback.text + '"' : ''}`
    : '';

  const text = `[AO Report] Demo: ${data.studentName} — ${data.subject}\n\nOutcome: ${data.outcomeLabel}\nTeacher: ${data.teacherName}\nAttention: ${data.attentionScore}%\nTime in Session: ${data.durationStr}${examText}${feedbackText}\n\nView dashboard: https://stibelearning.online/owner#demo\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ═════════════════════════════════════════════════════════════
// 3. STUDENT — Post-Demo Summary
// ═════════════════════════════════════════════════════════════

export function demoSummaryStudentTemplate(data: DemoSummaryTemplateData): { subject: string; html: string; text: string } {
  const subject = `Your Demo Session Summary — ${data.subject} 🎓`;

  // Encouraging message based on outcome
  let heroMessage = '';
  if (data.outcome === 'student_no_show') {
    heroMessage = `
      <div style="text-align:center; padding:20px; background-color:#fef2f2; border-radius:12px; margin:16px 0;">
        <p style="font-size:18px; font-weight:700; color:#374151; margin:0;">We missed you! 😢</p>
        <p style="font-size:14px; color:#6b7280; margin:8px 0 0;">It looks like you couldn't make it to the demo. No worries — we'd love to reschedule!</p>
      </div>
    `;
  } else {
    heroMessage = `
      <div style="text-align:center; padding:20px; background-color:#f0fdf4; border-radius:12px; margin:16px 0;">
        <p style="font-size:18px; font-weight:700; color:#374151; margin:0;">Thank you for attending! 🎉</p>
        <p style="font-size:14px; color:#6b7280; margin:8px 0 0;">Here's a summary of your ${data.subject} demo session with ${data.teacherName}.</p>
      </div>
    `;
  }

  // Student gets a lighter version — no raw engagement bars, just key highlights
  const highlights: [string, string][] = [
    ['Subject', `${data.subject} — Grade ${data.grade}`],
    ['Teacher', data.teacherName],
    ['Session Time', `${data.scheduledStr} → ${data.endedStr}`],
    ['You Were In Class For', data.durationStr],
  ];
  if (data.attentionScore > 0 && data.totalMonitoringEvents > 0) {
    highlights.push(['Focus Score', `${data.attentionScore}% — ${engagementLabel(data.attentionScore)}`]);
  }

  // Exam section — student gets score + per-question review
  const examBlock = data.exam ? `
    <h3 style="margin:24px 0 8px; font-size:15px; font-weight:700; color:#374151;">📝 Your Exam Results</h3>
    <div style="text-align:center; margin:16px 0;">
      <div style="display:inline-block; background:${gradeColor(data.exam.gradeLetter)}; color:#fff; border-radius:12px; padding:16px 32px;">
        <span style="font-size:32px; font-weight:800;">${data.exam.percentage}%</span>
        <span style="font-size:18px; font-weight:600; margin-left:8px;">Grade ${data.exam.gradeLetter}</span>
      </div>
    </div>
    ${infoTable([
      ['Score', `${data.exam.score} / ${data.exam.totalMarks}`],
      ['Questions', `${data.exam.answered} answered, ${data.exam.skipped} skipped`],
      ['Time Taken', fmtExamTime(data.exam.timeTakenSeconds)],
    ])}
    ${data.exam.questions.length > 0 ? `
    <p style="font-size:12px; color:#9ca3af; margin:16px 0 6px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Review Your Answers</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <tr style="background-color:#f9fafb;">
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb;">#</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb;">Question</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb; text-align:center;">Correct Answer</td>
        <td style="padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; font-weight:600; border-bottom:2px solid #e5e7eb; text-align:center;">Your Answer</td>
      </tr>
      ${examQuestionRows(data.exam.questions)}
    </table>
    ` : ''}
    ${data.exam.percentage >= 80 ? alertBox('🌟 Excellent performance! You clearly have a strong grasp of the material.', '#16a34a', '#f0fdf4') : ''}
    ${data.exam.percentage >= 50 && data.exam.percentage < 80 ? alertBox('👍 Good effort! With regular classes, you can strengthen these topics further.', '#0d9488', '#f0fdfa') : ''}
    ${data.exam.percentage < 50 ? alertBox('📚 This is a great starting point! Our structured classes will help you build a strong foundation.', '#ca8a04', '#fffbeb') : ''}
  ` : '';

  const body = `
    <h2 style="margin:0 0 6px; font-size:20px; font-weight:700; color:#111827;">Your Demo Session Summary</h2>
    <p style="color:#6b7280; font-size:14px; margin:0 0 6px;">Hi ${data.studentName}!</p>

    ${heroMessage}
    ${infoTable(highlights)}
    ${examBlock}

    ${data.outcome !== 'student_no_show' ? `
    <div style="text-align:center; margin:28px 0; padding:24px; background-color:#eff6ff; border-radius:12px; border:1px solid #bfdbfe;">
      <p style="font-size:16px; font-weight:700; color:#1e40af; margin:0 0 8px;">Ready to continue learning?</p>
      <p style="font-size:13px; color:#3b82f6; margin:0 0 16px;">Join stibe Classes for structured, personalized online sessions with expert teachers.</p>
      ${button('Contact stibe', 'https://stibelearning.online')}
    </div>
    ` : `
    <div style="text-align:center; margin:28px 0; padding:24px; background-color:#fff7ed; border-radius:12px; border:1px solid #fed7aa;">
      <p style="font-size:16px; font-weight:700; color:#9a3412; margin:0 0 8px;">Would you like to reschedule?</p>
      <p style="font-size:13px; color:#ea580c; margin:0 0 16px;">We understand things come up! Contact us to book another free demo session.</p>
      ${button('Contact stibe', 'https://stibelearning.online')}
    </div>
    `}

    <p style="color:#9ca3af; font-size:12px; margin:24px 0 0; line-height:1.5;">
      Thank you for trying stibe Classes. We look forward to helping you achieve your academic goals!
    </p>
  `;

  const examText = data.exam
    ? `\n\nExam Results: ${data.exam.score}/${data.exam.totalMarks} (${data.exam.percentage}%, Grade ${data.exam.gradeLetter})`
    : '';

  const text = data.outcome === 'student_no_show'
    ? `Hi ${data.studentName},\n\nWe noticed you couldn't make it to your ${data.subject} demo session. No worries — contact us to reschedule!\n\nVisit: https://stibelearning.online\n\n— stibe Classes`
    : `Hi ${data.studentName},\n\nThank you for attending your ${data.subject} demo session with ${data.teacherName}!\n\nSession Duration: ${data.durationStr}\nFocus Score: ${data.attentionScore}%${examText}\n\nReady to continue? Contact us at https://stibelearning.online\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Teacher Report (Student → Management) ───────────────────

export interface TeacherReportNotifyData {
  recipientName: string;
  recipientRole: string;
  recipientEmail: string;
  studentName: string;
  teacherName: string;
  roomName: string;
  category: string;
  categoryLabel: string;
  description: string;
  severity: string;
  reportId: string;
  reportedAt: string;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fef2f2', text: '#991b1b', border: '#dc2626' },
  high:     { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' },
  medium:   { bg: '#fffbeb', text: '#92400e', border: '#f59e0b' },
  low:      { bg: '#f0fdf4', text: '#166534', border: '#22c55e' },
};

export function teacherReportNotifyTemplate(data: TeacherReportNotifyData): { subject: string; html: string; text: string } {
  const sev = SEVERITY_COLORS[data.severity] || SEVERITY_COLORS.high;
  const subject = `🚨 Teacher Report: ${data.categoryLabel} — ${data.teacherName}`;

  const body = `
    ${alertBox(`⚠️ A student has filed a report against a teacher during a live class session. Immediate attention required.`, sev.border, sev.bg)}

    <h2 style="font-size:18px; color:#111827; margin:20px 0 4px; font-weight:700;">Teacher Report</h2>
    <p style="font-size:13px; color:#6b7280; margin:0 0 16px;">Submitted during live session — ${data.reportedAt}</p>

    ${infoTable([
      ['Report ID', data.reportId.slice(0, 8).toUpperCase()],
      ['Category', data.categoryLabel],
      ['Severity', data.severity.toUpperCase()],
      ['Teacher', data.teacherName],
      ['Student', data.studentName],
      ['Session', data.roomName],
    ])}

    ${data.description ? `
    <div style="margin:16px 0; padding:16px; background-color:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
      <p style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#9ca3af; margin:0 0 8px; font-weight:600;">Student's Description</p>
      <p style="font-size:13px; color:#374151; margin:0; line-height:1.6;">${data.description}</p>
    </div>` : ''}

    <div style="text-align:center; margin:24px 0;">
      ${button('View Report', `https://stibelearning.online/${data.recipientRole === 'owner' ? 'owner' : data.recipientRole === 'batch_coordinator' ? 'batch-coordinator' : 'academic-operator'}#teacher-reports`, '#dc2626')}
    </div>

    <p style="font-size:12px; color:#9ca3af; margin:16px 0 0; line-height:1.5;">
      This report requires investigation. Please review and take appropriate action from your dashboard.
    </p>
  `;

  const text = `TEACHER REPORT ALERT\n\nDear ${data.recipientName},\n\nA student has filed a report against a teacher.\n\nCategory: ${data.categoryLabel}\nSeverity: ${data.severity.toUpperCase()}\nTeacher: ${data.teacherName}\nStudent: ${data.studentName}\nSession: ${data.roomName}\n${data.description ? `Description: ${data.description}\n` : ''}\nPlease review from your dashboard.\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}


// ── Early Student Exit Notification ─────────────────────────

export interface EarlyExitAlertData {
  recipientName: string;
  recipientEmail: string;
  recipientRole: 'parent' | 'batch_coordinator';
  studentName: string;
  studentEmail: string;
  roomName: string;
  subject: string;
  scheduledEnd: string;
  exitTime: string;
  remainingMinutes: number;
}

export function earlyExitAlertTemplate(data: EarlyExitAlertData): { subject: string; html: string; text: string } {
  const isParent = data.recipientRole === 'parent';
  const subjectLine = isParent
    ? `⚠️ ${data.studentName} left class early — ${data.roomName}`
    : `⚠️ Early Exit: ${data.studentName} left "${data.roomName}"`;

  const body = `
    ${alertBox(
      isParent
        ? `Your child <strong>${data.studentName}</strong> has left the class before it ended.`
        : `Student <strong>${data.studentName}</strong> left the session without approved leave.`,
      '#d97706',
      '#fffbeb'
    )}

    <p style="font-size:15px; color:#374151; margin:20px 0 16px; line-height:1.5;">
      Dear ${data.recipientName},
    </p>

    <p style="font-size:14px; color:#374151; margin:0 0 16px; line-height:1.6;">
      ${isParent
        ? `We noticed that <strong>${data.studentName}</strong> exited the live session before the scheduled end time. The class was still ${data.remainingMinutes} minutes from completion.`
        : `<strong>${data.studentName}</strong> (${data.studentEmail}) disconnected from the session with approximately ${data.remainingMinutes} minutes remaining. No leave was approved.`
      }
    </p>

    ${infoTable([
      ['Session', data.roomName],
      ['Subject', data.subject],
      ['Scheduled End', data.scheduledEnd],
      ['Exit Time', data.exitTime],
      ['Time Remaining', `~${data.remainingMinutes} min`],
    ])}

    <p style="font-size:13px; color:#6b7280; margin:16px 0 0; line-height:1.5;">
      ${isParent
        ? 'If this was planned, no action is needed. Otherwise, please ensure your child attends the full session next time.'
        : 'Please follow up with the student or parent if needed.'}
    </p>
  `;

  const text = `${isParent ? 'EARLY EXIT ALERT' : 'STUDENT EARLY EXIT'}\n\nDear ${data.recipientName},\n\n${data.studentName} left "${data.roomName}" (${data.subject}) early with ~${data.remainingMinutes} minutes remaining.\n\nScheduled End: ${data.scheduledEnd}\nExit Time: ${data.exitTime}\n\n— stibe Classes`;

  return { subject: subjectLine, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Absent Notification (Student + Parent) ────────

export interface AbsentNotificationData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  subject: string;
  batchName: string;
  date: string;
  time: string;
  teacherName: string;
  isParent: boolean;
}

export function absentNotificationTemplate(data: AbsentNotificationData): { subject: string; html: string; text: string } {
  const isParent = data.isParent;
  const subjectLine = isParent
    ? `Absent Alert: ${data.studentName} — ${data.subject} class on ${data.date}`
    : `You were marked absent — ${data.subject} class on ${data.date}`;

  const body = `
    ${alertBox(
      isParent
        ? `${data.studentName} was marked absent from today's class.`
        : 'You were marked absent from today\'s class.',
      '#c62828', '#ffebee'
    )}

    <p style="font-size:14px; color:#495057; margin:16px 0;">Dear ${data.recipientName},</p>

    <p style="font-size:14px; color:#495057; margin:0 0 16px;">
      ${isParent
        ? `${data.studentName} did not join the scheduled class session.`
        : 'You did not join your scheduled class session today.'}
    </p>

    ${infoTable([
      ['Subject', data.subject],
      ['Batch', data.batchName],
      ['Date', data.date],
      ['Scheduled Time', data.time],
      ['Teacher', data.teacherName],
      ['Status', '❌ Absent'],
    ])}

    <p style="font-size:13px; color:#6b7280; margin:16px 0 0; line-height:1.5;">
      ${isParent
        ? 'If this was unexpected, please contact your batch coordinator. Regular attendance is essential for academic progress.'
        : 'If you had a valid reason, please inform your batch coordinator. Regular attendance is important for your learning progress.'}
    </p>
  `;

  const text = `${isParent ? 'ABSENT ALERT' : 'MARKED ABSENT'}\n\nDear ${data.recipientName},\n\n${isParent ? `${data.studentName} was` : 'You were'} marked absent from ${data.subject} class on ${data.date} at ${data.time}.\n\nBatch: ${data.batchName}\nTeacher: ${data.teacherName}\n\nPlease contact your batch coordinator if this was an error.\n\n— stibe Classes`;

  return { subject: subjectLine, html: masterLayout(body, data.recipientEmail), text };
}

// ── Join Reminder (teacher/BC sends to student who hasn't joined yet) ────

export interface JoinReminderData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  subject: string;
  batchName: string;
  teacherName: string;
  joinUrl: string;
  isParent: boolean;
}

export function joinReminderTemplate(data: JoinReminderData): { subject: string; html: string; text: string } {
  const subjectLine = data.isParent
    ? `${data.studentName} hasn't joined — ${data.subject} class is live now`
    : `Your class is live — ${data.subject} | Join now`;

  const body = `
    ${alertBox(
      data.isParent
        ? `${data.studentName} hasn't joined the live class yet.`
        : 'Your class is live right now — please join immediately!',
      '#e65100', '#fff3e0'
    )}

    <p style="font-size:14px; color:#495057; margin:16px 0;">Dear ${data.recipientName},</p>

    ${infoTable([
      ['Subject', data.subject],
      ['Batch', data.batchName],
      ['Teacher', data.teacherName],
      ['Status', '🔴 Live Now'],
    ])}

    ${!data.isParent ? `
    <div style="text-align:center; margin:24px 0;">
      ${button('Join Class Now', data.joinUrl)}
    </div>
    ` : `
    <p style="font-size:14px; color:#495057; margin:16px 0;">
      Please ensure ${data.studentName} joins the class as soon as possible.
    </p>
    `}
  `;

  const text = data.isParent
    ? `CLASS LIVE NOW\n\nDear ${data.recipientName},\n\n${data.studentName} hasn't joined ${data.subject} class (${data.batchName}).\nTeacher: ${data.teacherName}\n\nPlease ensure they join immediately.\n\n— stibe Classes`
    : `CLASS LIVE NOW\n\nDear ${data.recipientName},\n\nYour ${data.subject} class is live now!\nTeacher: ${data.teacherName}\n\nJoin: ${data.joinUrl}\n\n— stibe Classes`;

  return { subject: subjectLine, html: masterLayout(body, data.recipientEmail), text };
}

// ── Template: Refund Approved ─────────────────────────────────

export interface RefundApprovedData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  amount: string;
  sessionSubject: string;
  sessionDate: string;
  batchName: string;
  refundMethod: string;
  reviewNotes?: string;
}

export function refundApprovedTemplate(data: RefundApprovedData) {
  const subject = `✅ Refund Approved — ₹${data.amount} for ${data.studentName}`;
  const body = `
    <div style="text-align:center; padding:16px; background-color:#ecfdf5; border-radius:8px; margin:0 0 24px;">
      <span style="font-size:32px;">💸</span>
      <h2 style="margin:8px 0 0; color:#065f46; font-size:20px;">Refund Approved</h2>
    </div>

    <p style="color:#6c757d; font-size:14px; margin:0 0 16px;">Dear ${data.recipientName},</p>
    <p style="color:#495057; font-size:14px; margin:0 0 16px;">
      A refund has been approved for <strong>${data.studentName}</strong>. 
      The amount will be credited to the provided account shortly.
    </p>

    ${infoTable([
      ['Student', data.studentName],
      ['Subject', data.sessionSubject],
      ['Session Date', data.sessionDate],
      ['Batch', data.batchName],
      ['Refund Amount', '₹' + data.amount],
      ['Refund To', data.refundMethod],
    ])}

    ${data.reviewNotes ? alertBox('Reviewer note: ' + data.reviewNotes, '#1565c0', '#e3f2fd') : ''}

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">
      If the refund is not received within 5–7 business days, 
      please contact the academic coordinator.
    </p>
  `;
  const text = 'Refund Approved\n\nDear ' + data.recipientName + ',\n\nA refund of ₹' + data.amount + ' has been approved for ' + data.studentName + '.\nSubject: ' + data.sessionSubject + '\nSession: ' + data.sessionDate + '\nBatch: ' + data.batchName + '\nRefund To: ' + data.refundMethod + '\n' + (data.reviewNotes ? 'Note: ' + data.reviewNotes + '\n' : '') + '\n— stibe Classes';
  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Low Session Credits Warning ─────────────────────────────

export interface LowCreditsWarningData {
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  remainingCredits: number;
  totalAllotted: number;
  usedCredits: number;
  subjectBreakdown: Array<{ subject: string; remaining: number; total: number }>;
  renewLink: string;
  isExhausted: boolean;
}

export function lowCreditsWarningTemplate(data: LowCreditsWarningData): { subject: string; html: string; text: string } {
  const subject = data.isExhausted
    ? `🚫 Session Credits Exhausted — ${data.studentName} cannot attend classes`
    : `⚠️ Low Session Credits — Only ${data.remainingCredits} left for ${data.studentName}`;

  const alertColor = data.isExhausted ? '#d32f2f' : '#f57c00';
  const alertBg = data.isExhausted ? '#ffebee' : '#fff3e0';
  const alertText = data.isExhausted
    ? `All prepaid session credits for ${data.studentName} have been used. Class access is now blocked until payment is renewed.`
    : `Only ${data.remainingCredits} prepaid session credit${data.remainingCredits !== 1 ? 's' : ''} remaining for ${data.studentName}. Please renew to avoid class disruption.`;

  const subjectRows = data.subjectBreakdown.map(s =>
    [s.subject, `${s.remaining} / ${s.total} remaining`] as [string, string]
  );

  const body = `
    ${alertBox(alertText, alertColor, alertBg)}

    <p style="color:#6c757d; font-size:14px; margin:16px 0;">Dear ${data.recipientName},</p>

    <p style="color:#495057; font-size:14px; margin:0 0 16px;">
      ${data.isExhausted
        ? `<strong>${data.studentName}</strong> has used all ${data.totalAllotted} prepaid sessions. To continue attending classes, please renew the session package immediately.`
        : `<strong>${data.studentName}</strong> has used ${data.usedCredits} of ${data.totalAllotted} prepaid sessions. Only <strong>${data.remainingCredits}</strong> session${data.remainingCredits !== 1 ? 's' : ''} remain.`
      }
    </p>

    ${infoTable([
      ['Student', data.studentName],
      ['Total Allotted', String(data.totalAllotted) + ' sessions'],
      ['Used', String(data.usedCredits) + ' sessions'],
      ['Remaining', data.isExhausted ? '0 (Exhausted)' : String(data.remainingCredits) + ' sessions'],
      ...subjectRows,
    ])}

    <div style="margin:24px 0; text-align:center;">
      ${button(data.isExhausted ? 'Renew Now to Restore Access' : 'Renew Session Package', data.renewLink, alertColor)}
    </div>

    ${data.isExhausted
      ? `<p style="font-size:13px; color:#d32f2f; font-weight:600; margin:0;">⚠️ ${data.studentName} will not be able to join live classes until sessions are renewed.</p>`
      : `<p style="font-size:13px; color:#6c757d; margin:0;">Tip: Renew early to avoid interruption in classes.</p>`
    }
  `;

  const text = `${data.isExhausted ? 'Session Credits Exhausted' : 'Low Session Credits Warning'}\n\nDear ${data.recipientName},\n\n${data.studentName} has ${data.isExhausted ? '0' : data.remainingCredits} of ${data.totalAllotted} prepaid sessions remaining.\nUsed: ${data.usedCredits} sessions\n\n${data.subjectBreakdown.map(s => `${s.subject}: ${s.remaining}/${s.total}`).join('\n')}\n\nRenew at: ${data.renewLink}\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, data.recipientEmail), text };
}

// ── Enrollment Payment Link Email ───────────────────────────

interface EnrollmentPaymentLinkData {
  studentName: string;
  grade: string;
  board: string;
  batchType: string;
  amount: string;
  paymentUrl: string;
}

export function enrollmentPaymentLinkEmail(data: EnrollmentPaymentLinkData): { subject: string; html: string; text: string } {
  const subject = `stibe Enrollment — Complete Your Payment (${data.amount})`;

  const body = `
    <h1 class="hdr-txt" style="margin:0 0 6px; font-size:22px; font-weight:700; color:#111827;">Complete Your Enrollment</h1>
    <p class="muted-txt" style="margin:0 0 24px; font-size:14px; color:#6b7280;">Hi ${data.studentName}, your enrollment details are ready!</p>

    ${infoTable([
      ['Student', data.studentName],
      ['Grade', `Class ${data.grade}`],
      ['Board', data.board],
      ['Batch Type', data.batchType],
      ['Amount', data.amount],
    ])}

    <div style="margin:28px 0; text-align:center;">
      ${button(`Pay ${data.amount}`, data.paymentUrl)}
    </div>

    ${alertBox('This payment link is valid for 7 days. After payment, our team will assign you to the right batch and share login credentials.', '#2563eb', '#eff6ff')}

    <p style="font-size:13px; color:#6c757d; margin:16px 0 0;">If you have any questions, reach out to your stibe counsellor or reply to this email.</p>
  `;

  const text = `stibe Enrollment — Complete Your Payment\n\nHi ${data.studentName},\n\nYour enrollment is ready:\nGrade: Class ${data.grade}\nBoard: ${data.board}\nBatch Type: ${data.batchType}\nAmount: ${data.amount}\n\nComplete payment here: ${data.paymentUrl}\n\nLink valid for 7 days.\n\n— stibe Classes`;

  return { subject, html: masterLayout(body, ''), text };
}
