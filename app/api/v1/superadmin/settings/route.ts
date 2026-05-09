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
      logo_auth_height:    logos.authHeight,
      logo_splash_height:  logos.splashHeight,
      logo_sidebar_height: logos.sidebarHeight,
      logo_email_height:   logos.emailHeight,
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

  for (const key of ['logo_auth_height', 'logo_splash_height', 'logo_sidebar_height', 'logo_email_height'] as const) {
    if (key in body) {
      const val = parseInt(body[key], 10);
      if (!isNaN(val) && val > 0) {
        await db.query(
          `INSERT INTO school_config (key, value, description)
           VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, String(val), `Logo height (px) for ${key.replace('logo_', '').replace('_height', '')} context`]
        );
      }
    }
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
      logo_auth_height:    logos.authHeight,
      logo_splash_height:  logos.splashHeight,
      logo_sidebar_height: logos.sidebarHeight,
      logo_email_height:   logos.emailHeight,
    },
  });
}

