// Region → UTC offset in minutes
// IST = UTC+5:30 = +330 minutes
const IST_OFFSET = 330;

export const REGION_UTC_OFFSETS: Record<string, number> = {
  'Dubai':          240,   // GST  UTC+4
  'Abu Dhabi':      240,   // GST  UTC+4
  'Sharjah':        240,   // GST  UTC+4
  'Ajman':          240,   // GST  UTC+4
  'Oman':           240,   // GST  UTC+4
  'Saudi Arabia':   180,   // AST  UTC+3
  'Qatar':          180,   // AST  UTC+3
  'Kuwait':         180,   // AST  UTC+3
  'Bahrain':        180,   // AST  UTC+3
  'India':          330,   // IST  UTC+5:30
  'Malaysia':       480,   // MYT  UTC+8
  'Singapore':      480,   // SGT  UTC+8
  'UK':             0,     // GMT  (no DST handling — approximate)
  'USA':           -300,   // EST  UTC-5 (default eastern)
};

// Short labels for display
export const REGION_FLAGS: Record<string, string> = {
  'Dubai': '🇦🇪', 'Abu Dhabi': '🇦🇪', 'Sharjah': '🇦🇪', 'Ajman': '🇦🇪', 'Oman': '🇴🇲',
  'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦', 'Kuwait': '🇰🇼', 'Bahrain': '🇧🇭',
  'India': '🇮🇳', 'Malaysia': '🇲🇾', 'Singapore': '🇸🇬', 'UK': '🇬🇧', 'USA': '🇺🇸',
};

export const REGION_TZ_LABELS: Record<string, string> = {
  'Dubai': 'GST', 'Abu Dhabi': 'GST', 'Sharjah': 'GST', 'Ajman': 'GST', 'Oman': 'GST',
  'Saudi Arabia': 'AST', 'Qatar': 'AST', 'Kuwait': 'AST', 'Bahrain': 'AST',
  'India': 'IST', 'Malaysia': 'MYT', 'Singapore': 'SGT', 'UK': 'GMT', 'USA': 'EST',
};

/** Convert an IST 24h time (e.g. "09:00") to a region's local 12h time */
export function istToRegionTime(time24: string, region: string): string {
  const offset = REGION_UTC_OFFSETS[region];
  if (offset === undefined || offset === IST_OFFSET) {
    // Unknown region or IST — return as-is in 12h
    return fmtTime12(time24);
  }
  const [h, m] = (time24 || '09:00').split(':').map(Number);
  let totalMins = h * 60 + m - IST_OFFSET + offset; // IST→UTC→region
  if (totalMins < 0) totalMins += 1440;
  if (totalMins >= 1440) totalMins -= 1440;
  const rH = Math.floor(totalMins / 60) % 24;
  const rM = totalMins % 60;
  const p = rH >= 12 ? 'PM' : 'AM';
  const h12 = rH === 0 ? 12 : rH > 12 ? rH - 12 : rH;
  return `${h12}:${String(rM).padStart(2, '0')} ${p}`;
}

function fmtTime12(t: string): string {
  const [hh, mm] = (t || '09:00').split(':').map(Number);
  const p = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${p}`;
}

/** Convert a 12h IST time string (e.g. "10:00 AM") to a region's local 12h time */
export function localize12hTime(time12ist: string, region: string | null | undefined): string {
  if (!region || region === 'India') return time12ist;
  const match = time12ist.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12ist;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'AM' && h === 12) h = 0;
  if (ampm === 'PM' && h !== 12) h += 12;
  const time24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return istToRegionTime(time24, region);
}

/**
 * Given a list of student regions, return unique timezone groups
 * sorted by count descending: { region, flag, tzLabel, count }[]
 * Regions with the same UTC offset are NOT merged (keep identity).
 */
export function groupStudentsByTimezone(regions: (string | null)[]): {
  region: string; flag: string; tzLabel: string; count: number; offsetMinutes: number;
}[] {
  const counts = new Map<string, number>();
  for (const r of regions) {
    const key = r || 'India'; // default to IST if unset
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([region, count]) => ({
      region,
      flag: REGION_FLAGS[region] || '🌍',
      tzLabel: REGION_TZ_LABELS[region] || 'IST',
      count,
      offsetMinutes: REGION_UTC_OFFSETS[region] ?? IST_OFFSET,
    }))
    .sort((a, b) => b.count - a.count);
}
