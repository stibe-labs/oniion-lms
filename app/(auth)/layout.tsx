import { PlatformProvider } from '@/components/providers/PlatformProvider';
import { getPlatformName, getLogoConfig, getAuthConfig } from '@/lib/platform-config';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [name, logos, authCfg] = await Promise.all([
    getPlatformName(),
    getLogoConfig(),
    getAuthConfig(),
  ]);

  return (
    <PlatformProvider
      initialName={name}
      initialLogoFullUrl={logos.logoFullUrl}
      initialLogoSmallUrl={logos.logoSmallUrl}
      initialFaviconUrl={logos.faviconUrl}
      initialLoadingCharacterUrl={logos.loadingCharacterUrl}
      initialLogoAuthHeight={logos.authHeight}
      initialLogoSplashHeight={logos.splashHeight}
      initialLogoSidebarHeight={logos.sidebarHeight}
      initialLogoEmailHeight={logos.emailHeight}
      initialAuthConfig={authCfg}
    >
      {children}
    </PlatformProvider>
  );
}
