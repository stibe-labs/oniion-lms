// ═══════════════════════════════════════════════════════════════
// Shared logo utility — reads logo once and caches as base64
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

let cachedLogoDataUri: string | null = null;

/**
 * Returns a base64 data URI for the logo image.
 * Reads from public/logo/main.png (smaller) and caches in memory.
 * Falls back to a URL if the file can't be read.
 */
export function getLogoDataUri(): string {
  if (cachedLogoDataUri) return cachedLogoDataUri;

  try {
    // Try main.png first (smaller, ~25KB), fallback to full.png
    const candidates = ['public/logo/main.png', 'public/logo/full.png'];
    for (const rel of candidates) {
      const abs = path.join(process.cwd(), rel);
      if (fs.existsSync(abs)) {
        const buf = fs.readFileSync(abs);
        cachedLogoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
        return cachedLogoDataUri;
      }
    }
  } catch {
    // ignore fs errors
  }

  // Fallback to URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stibelearning.online';
  return `${baseUrl}/logo/full.png`;
}
