// ═══════════════════════════════════════════════════════════════
// Invoice Description Parser
// ═══════════════════════════════════════════════════════════════
// Parses pipe-delimited combined invoice descriptions into
// structured line items for display in PDFs, emails, and UI.
//
// Format: "BatchName — N sessions (date to date) | Subject: N×Dmin @₹Rate/hr = ₹Total | ..."
// ═══════════════════════════════════════════════════════════════

export interface DescriptionLineItem {
  subject: string;
  sessions: string;   // e.g. "10×90min"
  rate: string;       // e.g. "₹4000/hr"
  total: string;      // e.g. "₹60000.00"
}

export interface ParsedDescription {
  header: string;                 // e.g. "Class 12 A1 — 27 sessions (2026-03-04 to 2026-04-03)"
  items: DescriptionLineItem[];
}

/**
 * Parse a pipe-delimited invoice description into structured data.
 * Returns null if the description doesn't contain line items.
 */
export function parseDescription(desc: string | null | undefined): ParsedDescription | null {
  if (!desc) return null;

  const parts = desc.split('|').map(s => s.trim());
  if (parts.length < 2) return null;

  const header = parts[0];
  const items: DescriptionLineItem[] = [];

  for (let i = 1; i < parts.length; i++) {
    // Pattern: "Mathematics: 10×90min @₹4000/hr = ₹60000.00"
    const m = parts[i].match(/^(.+?):\s*(\d+×\d+min)\s*@(.+?\/hr)\s*=\s*(.+)$/);
    if (m) {
      items.push({
        subject: m[1].trim(),
        sessions: m[2],
        rate: m[3].trim(),
        total: m[4].trim(),
      });
    }
  }

  return items.length > 0 ? { header, items } : null;
}
