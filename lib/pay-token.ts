// ═══════════════════════════════════════════════════════════════
// Pay Token — HMAC-signed tokens for public payment links
// ═══════════════════════════════════════════════════════════════
// Generates short, URL-safe tokens so WhatsApp pay links can
// be opened without login. Token = HMAC-SHA256(invoiceId, secret)
// truncated to 16 hex chars.
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

const PAY_TOKEN_SECRET = process.env.PAY_TOKEN_SECRET || process.env.SESSION_SECRET || 'stibe-pay-token-secret';

/** Generate a short HMAC token for a given invoice ID */
export function generatePayToken(invoiceId: string): string {
  return crypto
    .createHmac('sha256', PAY_TOKEN_SECRET)
    .update(invoiceId)
    .digest('hex')
    .slice(0, 16);
}

/** Verify a pay token matches the invoice ID */
export function verifyPayToken(invoiceId: string, token: string): boolean {
  const expected = generatePayToken(invoiceId);
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(token.slice(0, 16).padEnd(16, '0'), 'utf8'),
  );
}

/** Build a full pay URL for an invoice */
export function buildPayUrl(invoiceId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
  const token = generatePayToken(invoiceId);
  return `${baseUrl}/pay/${invoiceId}?t=${token}`;
}

/** Build a full public invoice URL (token-based, no login needed) */
export function buildInvoiceUrl(invoiceId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
  const token = generatePayToken(invoiceId);
  return `${baseUrl}/api/v1/payment/invoice-pdf/${invoiceId}?t=${token}`;
}
