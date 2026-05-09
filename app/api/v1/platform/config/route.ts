import { NextResponse } from 'next/server';
import { getPlatformName, getLogoConfig } from '@/lib/platform-config';

export async function GET() {
  const [platformName, logos] = await Promise.all([getPlatformName(), getLogoConfig()]);
  return NextResponse.json({
    platform_name:  platformName,
    logo_small_url: logos.logoSmallUrl,
    logo_full_url:  logos.logoFullUrl,
    favicon_url:    logos.faviconUrl,
  });
}
