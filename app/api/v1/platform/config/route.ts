import { NextResponse } from 'next/server';
import { getPlatformName, getLogoConfig } from '@/lib/platform-config';

export async function GET() {
  const [platformName, logos] = await Promise.all([getPlatformName(), getLogoConfig()]);
  return NextResponse.json({
    platform_name:       platformName,
    logo_small_url:      logos.logoSmallUrl,
    logo_full_url:       logos.logoFullUrl,
    favicon_url:         logos.faviconUrl,
    logo_auth_height:    logos.authHeight,
    logo_splash_height:  logos.splashHeight,
    logo_sidebar_height: logos.sidebarHeight,
    logo_email_height:   logos.emailHeight,
  });
}
