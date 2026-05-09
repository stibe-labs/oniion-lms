import { NextResponse } from 'next/server';
import { db, resolveRoomId } from '@/lib/db';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/v1/room/contact-violation
 *
 * Records an unauthorized contact information detection event.
 * Called by the ChatPanel client when a message containing
 * phone numbers, social media handles, or other contact info is detected.
 *
 * Also sends email alerts to all coordinators and academic operators.
 *
 * Body: { room_id, sender_email, sender_name, sender_role, message_text, detected_pattern, severity }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      room_id,
      sender_email,
      sender_name,
      sender_role,
      message_text,
      detected_pattern,
      severity,
    } = body;

    if (!room_id || !sender_email || !message_text || !detected_pattern) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const actualRoomId = await resolveRoomId(room_id);

    await db.query(
      `INSERT INTO contact_violations
         (room_id, sender_email, sender_name, sender_role, message_text, detected_pattern, severity, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [actualRoomId, sender_email, sender_name || '', sender_role || '', message_text, detected_pattern, severity || 'warning'],
    );

    // Also log as a room_event for the audit trail
    try {
      await db.query(
        `INSERT INTO room_events (room_id, event_type, payload)
         VALUES ($1, 'contact_violation', $2::jsonb)`,
        [
          actualRoomId,
          JSON.stringify({
            sender_email,
            sender_name,
            sender_role,
            detected_pattern,
            severity,
            message_preview: message_text.substring(0, 100),
          }),
        ],
      );
    } catch {
      // room_events logging is best-effort
    }

    // ── Send email alerts to coordinators and admins (best-effort) ──
    try {
      // Get room name for the alert
      const roomRes = await db.query(
        `SELECT room_name FROM rooms WHERE room_id = $1 LIMIT 1`,
        [actualRoomId],
      );
      const roomName = roomRes.rows[0]?.room_name || actualRoomId;

      // Get all coordinators and academic operators
      const alertRes = await db.query(
        `SELECT email, name FROM portal_users WHERE role IN ('batch_coordinator', 'academic_operator', 'owner') AND active = true`,
      );

      const recipients = (alertRes.rows as { email: string; name: string }[]).map((r) => r.email);

      if (recipients.length > 0) {
        const sevLabel = severity === 'critical' ? '🔴 CRITICAL' : '🟡 WARNING';
        const subject = `${sevLabel} Contact Violation Alert — ${roomName}`;
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc2626; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 18px;">⚠️ Unauthorized Contact Detection</h2>
            </div>
            <div style="background: #1f2937; color: #e5e7eb; padding: 20px; border-radius: 0 0 8px 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #9ca3af;">Batch:</td><td style="padding: 6px 0; font-weight: 600;">${roomName}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Student:</td><td style="padding: 6px 0; font-weight: 600;">${sender_name || sender_email}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Role:</td><td style="padding: 6px 0;">${sender_role}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Severity:</td><td style="padding: 6px 0; font-weight: 600; color: ${severity === 'critical' ? '#ef4444' : '#f59e0b'};">${sevLabel}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Pattern:</td><td style="padding: 6px 0;">${detected_pattern}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Message:</td><td style="padding: 6px 0; color: #fca5a5;">"${message_text.substring(0, 200)}"</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Time:</td><td style="padding: 6px 0;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
              </table>
              <p style="margin-top: 16px; font-size: 13px; color: #9ca3af;">
                This message was blocked and not delivered. The violation has been recorded in the audit log.
              </p>
            </div>
          </div>
        `;
        const text = `Contact Violation Alert\nBatch: ${roomName}\nStudent: ${sender_name || sender_email}\nPattern: ${detected_pattern}\nSeverity: ${severity}\nMessage: "${message_text.substring(0, 200)}"`;

        // Send to all alert recipients (non-blocking)
        sendEmail({ to: recipients, subject, html, text, priority: 'high' }).catch(() => {});

        // Mark as notified in DB
        await db.query(
          `UPDATE contact_violations SET notified = true
           WHERE room_id = $1 AND sender_email = $2 AND detected_at = (
             SELECT MAX(detected_at) FROM contact_violations WHERE room_id = $1 AND sender_email = $2
           )`,
          [actualRoomId, sender_email],
        );
      }
    } catch {
      // Email alert is best-effort — don't fail the response
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact-violation] Error recording violation:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
