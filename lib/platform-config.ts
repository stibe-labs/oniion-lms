import { db } from '@/lib/db';

export async function getPlatformName(): Promise<string> {
  try {
    const result = await db.query<{ value: string }>(
      "SELECT value FROM school_config WHERE key = 'platform_name'",
      []
    );
    return result.rows[0]?.value ?? 'Stibe';
  } catch {
    return 'Stibe';
  }
}

export async function getBujiEnabled(): Promise<boolean> {
  try {
    const result = await db.query<{ value: string }>(
      "SELECT value FROM school_config WHERE key = 'buji_enabled'",
      []
    );
    // Default true if not set
    return result.rows[0]?.value !== 'false';
  } catch {
    return true;
  }
}
