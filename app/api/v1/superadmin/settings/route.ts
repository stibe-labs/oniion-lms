import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { getPlatformName } from '@/lib/platform-config';

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const platformName = await getPlatformName();
  return NextResponse.json({ success: true, data: { platform_name: platformName } });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const platformName = (body.platform_name ?? '').trim();
  if (!platformName) {
    return NextResponse.json({ success: false, error: 'platform_name is required' }, { status: 400 });
  }

  await db.query(
    `INSERT INTO school_config (key, value, description)
     VALUES ('platform_name', $1, 'Platform display name shown across the UI')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [platformName]
  );

  return NextResponse.json({ success: true, data: { platform_name: platformName } });
}
