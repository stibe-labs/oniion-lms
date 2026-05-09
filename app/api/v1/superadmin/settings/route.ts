import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { getPlatformName, getBujiEnabled, getLogoConfig, getSplashConfig } from '@/lib/platform-config';

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const [platformName, bujiEnabled, logos, splash] = await Promise.all([
    getPlatformName(), getBujiEnabled(), getLogoConfig(), getSplashConfig(),
  ]);
  return NextResponse.json({
    success: true,
    data: {
      platform_name:        platformName,
      buji_enabled:         bujiEnabled,
      logo_small_url:       logos.logoSmallUrl,
      logo_full_url:        logos.logoFullUrl,
      favicon_url:          logos.faviconUrl,
      logo_auth_height:     logos.authHeight,
      logo_splash_height:   logos.splashHeight,
      logo_sidebar_height:  logos.sidebarHeight,
      logo_email_height:    logos.emailHeight,
      splash_template:      splash.template,
      splash_progress_style: splash.progressStyle,
      splash_loading_anim:  splash.loadingAnim,
      splash_tagline:       splash.tagline,
      splash_accent_color:  splash.accentColor,
      splash_bg_color:      splash.bgColor,
      splash_show_quotes:   splash.showQuotes,
      splash_quotes:        splash.quotes,
    },
  });
}

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  // Platform name
  if ('platform_name' in body) {
    const platformName = (body.platform_name ?? '').trim();
    if (!platformName) return NextResponse.json({ success: false, error: 'platform_name is required' }, { status: 400 });
    await db.query(
      `INSERT INTO school_config (key, value, description) VALUES ('platform_name', $1, 'Platform display name') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [platformName]
    );
  }

  // Buji toggle
  if ('buji_enabled' in body) {
    await db.query(
      `INSERT INTO school_config (key, value, description) VALUES ('buji_enabled', $1, 'Buji chatbot enabled') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [body.buji_enabled ? 'true' : 'false']
    );
  }

  // Logo sizes
  for (const key of ['logo_auth_height', 'logo_splash_height', 'logo_sidebar_height', 'logo_email_height'] as const) {
    if (key in body) {
      const val = parseInt(body[key], 10);
      if (!isNaN(val) && val > 0) {
        await db.query(
          `INSERT INTO school_config (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, String(val), `Logo height px - ${key}`]
        );
      }
    }
  }

  // Splash string fields
  for (const key of ['splash_template', 'splash_progress_style', 'splash_loading_anim', 'splash_tagline', 'splash_accent_color', 'splash_bg_color'] as const) {
    if (key in body && typeof body[key] === 'string') {
      await db.query(
        `INSERT INTO school_config (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, body[key], `Splash config - ${key}`]
      );
    }
  }
  if ('splash_show_quotes' in body) {
    await db.query(
      `INSERT INTO school_config (key, value, description) VALUES ('splash_show_quotes', $1, 'Splash rotating quotes enabled') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [body.splash_show_quotes ? 'true' : 'false']
    );
  }
  if ('splash_quotes' in body && Array.isArray(body.splash_quotes)) {
    await db.query(
      `INSERT INTO school_config (key, value, description) VALUES ('splash_quotes', $1, 'Splash quotes JSON array') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(body.splash_quotes)]
    );
  }

  return NextResponse.json({ success: true });
}
