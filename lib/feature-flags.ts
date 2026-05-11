import { db } from '@/lib/db';
export type { FeatureFlags } from './feature-flags-shared';
export { FLAG_KEYS, FLAG_LABELS, DEFAULT_FLAGS } from './feature-flags-shared';
import { FLAG_KEYS, DEFAULT_FLAGS, type FeatureFlags } from './feature-flags-shared';

let _cache: { flags: FeatureFlags; ts: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (_cache && Date.now() - _cache.ts < TTL_MS) return _cache.flags;

  const keys = Object.values(FLAG_KEYS);
  const result = await db.query<{ key: string; value: string }>(
    `SELECT key, value FROM school_config WHERE key = ANY($1)`,
    [keys]
  );
  const dbMap = Object.fromEntries(result.rows.map(r => [r.key, r.value]));

  const flags = { ...DEFAULT_FLAGS };
  for (const [name, dbKey] of Object.entries(FLAG_KEYS) as [keyof FeatureFlags, string][]) {
    if (dbKey in dbMap) {
      flags[name] = dbMap[dbKey] !== 'false' && dbMap[dbKey] !== '0';
    }
  }

  _cache = { flags, ts: Date.now() };
  return flags;
}

export function invalidateFeatureFlags() {
  _cache = null;
}
