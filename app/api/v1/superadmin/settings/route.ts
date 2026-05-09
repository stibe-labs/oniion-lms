import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { getPlatformName, getBujiEnabled, getLogoConfig } from '@/lib/platform-config';

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const [platformName, bujiEnabled, logos] = await Promise.all([
    getPlatformName(),
    getBujiEnabled(),
    getLogoConfig(),
  ]);
  return NextResponse.json({
    success: true,
    data: {
      platform_name: platformName,
      buji_enabled: bujiEnabled,
      logo_small_url: logos.logoSmallUrl,
      logo_full_url:  logos.logoFullUrl,
      favicon_url:    logos.faviconUrl,
    },
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  if ('platform_name' in body) {
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
  }

  if ('buji_enabled' in body) {
    await db.query(
      `INSERT INTO school_config (key, value, description)
       VALUES ('buji_enabled', $1, 'Whether the Buji AI chatbot is shown to students')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [body.buji_enabled ? 'true' : 'false']
    );
  }

  const [platformName, bujiEnabled, logos] = await Promise.all([
    getPlatformName(),
    getBujiEnabled(),
    getLogoConfig(),
  ]);
  return NextResponse.json({
    success: true,
    data: {
      platform_name: platformName,
      buji_enabled: bujiEnabled,
      logo_small_url: logos.logoSmallUrl,
      logo_full_url:  logos.logoFullUrl,
      favicon_url:    logos.faviconUrl,
    },
  });
}

