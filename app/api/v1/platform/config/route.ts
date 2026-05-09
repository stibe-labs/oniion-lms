import { NextResponse } from 'next/server';
import { getPlatformName, getLogoConfig, getSplashConfig } from '@/lib/platform-config';

export async function GET() {
  const [platformName, logos, splash] = await Promise.all([
    getPlatformName(),
    getLogoConfig(),
    getSplashConfig(),
  ]);
  return NextResponse.json({
    platform_name:          platformName,
    logo_small_url:         logos.logoSmallUrl,
    logo_full_url:          logos.logoFullUrl,
    favicon_url:            logos.faviconUrl,
    loading_character_url:  logos.loadingCharacterUrl,
    logo_auth_height:       logos.authHeight,
    logo_splash_height:     logos.splashHeight,
    logo_sidebar_height:    logos.sidebarHeight,
    logo_email_height:      logos.emailHeight,
    splash_template:        splash.template,
    splash_progress_style:  splash.progressStyle,
    splash_loading_anim:    splash.loadingAnim,
    splash_tagline:         splash.tagline,
    splash_accent_color:    splash.accentColor,
    splash_bg_color:        splash.bgColor,
    splash_show_quotes:     splash.showQuotes,
    splash_quotes:          splash.quotes,
  });
}
