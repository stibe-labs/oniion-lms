/**
 * Contact Detection — Unauthorized contact information detector.
 *
 * Scans chat messages for:
 *   - Phone numbers (Indian & international)
 *   - Instagram handles (@username)
 *   - WhatsApp references
 *   - Telegram references
 *   - Snapchat references
 *   - Email addresses
 *   - Social media URLs (facebook, twitter, etc.)
 *
 * Returns detection result with matched patterns.
 * Used by ChatPanel to block messages + log violations to DB.
 */

export interface ContactDetection {
  detected: boolean;
  patterns: string[];       // e.g. ['phone_number', 'instagram']
  matches: string[];        // actual matched text
  severity: 'info' | 'warning' | 'critical';
}

// ── Phone number patterns ──────────────────────────────────
// Indian: 10-digit starting with 6-9, optional +91
// International: + followed by 8-15 digits
const PHONE_PATTERNS = [
  /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g,           // Indian mobile
  /(?:\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, // International
  /\b\d{10,12}\b/g,                                     // Plain 10-12 digits
];

// ── Social media patterns ──────────────────────────────────
const SOCIAL_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /@[a-zA-Z0-9_.]{3,30}/g, label: 'social_handle' },
  { pattern: /\b(?:instagram|insta|ig)\b[\s:@]*[a-zA-Z0-9_.]{2,}/gi, label: 'instagram' },
  { pattern: /\b(?:whatsapp|wa|watsapp|whats\s?app)\b/gi, label: 'whatsapp' },
  { pattern: /\b(?:telegram|tg|t\.me)\b[\s:/@]*[a-zA-Z0-9_.]{2,}/gi, label: 'telegram' },
  { pattern: /\b(?:snapchat|snap|sc)\b[\s:@]*[a-zA-Z0-9_.]{2,}/gi, label: 'snapchat' },
  { pattern: /\b(?:facebook|fb|twitter|x\.com|tiktok)\b/gi, label: 'social_media' },
  { pattern: /\b(?:discord)\b[\s:#]*[a-zA-Z0-9_.#]{2,}/gi, label: 'discord' },
];

// ── Email pattern ──────────────────────────────────────────
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ── URL patterns ───────────────────────────────────────────
const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /\b(?:www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
];

// ── "My number is" / "call me" intent patterns ─────────────
const INTENT_PATTERNS = [
  /\b(?:my\s+(?:number|phone|mobile|cell|contact))\b/gi,
  /\b(?:call\s+me|text\s+me|message\s+me|dm\s+me|ping\s+me)\b/gi,
  /\b(?:add\s+me\s+on|follow\s+me|reach\s+me)\b/gi,
  /\b(?:give\s+(?:me\s+)?(?:your|ur)\s+(?:number|phone|insta|id|contact))\b/gi,
];

/**
 * Scan a message for contact information.
 * Returns detection result with matched patterns.
 */
export function detectContact(text: string): ContactDetection {
  const normalizedText = text.toLowerCase();
  const patterns: string[] = [];
  const matches: string[] = [];

  // Check phone numbers
  for (const regex of PHONE_PATTERNS) {
    const m = text.match(new RegExp(regex.source, regex.flags));
    if (m) {
      patterns.push('phone_number');
      matches.push(...m);
    }
  }

  // Check social media
  for (const { pattern, label } of SOCIAL_PATTERNS) {
    const m = text.match(new RegExp(pattern.source, pattern.flags));
    if (m) {
      patterns.push(label);
      matches.push(...m);
    }
  }

  // Check email
  const emailMatches = text.match(EMAIL_PATTERN);
  if (emailMatches) {
    patterns.push('email_address');
    matches.push(...emailMatches);
  }

  // Check URLs
  for (const regex of URL_PATTERNS) {
    const m = text.match(new RegExp(regex.source, regex.flags));
    if (m) {
      patterns.push('url');
      matches.push(...m);
    }
  }

  // Check intent phrases
  for (const regex of INTENT_PATTERNS) {
    if (regex.test(normalizedText)) {
      patterns.push('contact_intent');
    }
  }

  // De-duplicate
  const uniquePatterns = [...new Set(patterns)];
  const uniqueMatches = [...new Set(matches)];

  // Determine severity
  let severity: ContactDetection['severity'] = 'info';
  if (uniquePatterns.includes('phone_number') || uniquePatterns.includes('email_address')) {
    severity = 'critical';
  } else if (uniquePatterns.some((p) => ['instagram', 'whatsapp', 'telegram', 'snapchat', 'discord'].includes(p))) {
    severity = 'critical';
  } else if (uniquePatterns.includes('social_handle') || uniquePatterns.includes('url')) {
    severity = 'warning';
  } else if (uniquePatterns.includes('contact_intent')) {
    severity = 'warning';
  }

  return {
    detected: uniquePatterns.length > 0,
    patterns: uniquePatterns,
    matches: uniqueMatches,
    severity,
  };
}

/**
 * Report a contact violation to the server.
 * Called by ChatPanel when a violation is detected.
 */
export async function reportViolation(
  roomId: string,
  senderEmail: string,
  senderName: string,
  senderRole: string,
  messageText: string,
  detectedPattern: string,
  severity: string,
): Promise<void> {
  try {
    await fetch('/api/v1/room/contact-violation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        room_id: roomId,
        sender_email: senderEmail,
        sender_name: senderName,
        sender_role: senderRole,
        message_text: messageText,
        detected_pattern: detectedPattern,
        severity,
      }),
    });
  } catch {
    // Best-effort — don't block UI
  }
}
