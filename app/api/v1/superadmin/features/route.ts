import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { FLAG_KEYS, getFeatureFlags, invalidateFeatureFlags } from '@/lib/feature-flags';

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  const flags = await getFeatureFlags();
  return NextResponse.json({ success: true, data: flags });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as Record<string, boolean>;

  for (const [name, dbKey] of Object.entries(FLAG_KEYS) as [keyof typeof FLAG_KEYS, string][]) {
    if (name in body) {
      const val = body[name] ? 'true' : 'false';
      await db.query(
        `INSERT INTO school_config (key, value, description) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [dbKey, val, `Feature flag: ${name}`]
      );
    }
  }

  invalidateFeatureFlags();
  return NextResponse.json({ success: true });
}
