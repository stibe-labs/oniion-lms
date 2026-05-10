'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { AuthConfig } from '@/lib/auth-config';
import { AUTH_CONFIG_DEFAULTS } from '@/lib/auth-config';

interface PlatformContextType {
  platformName: string;
  logoSmallUrl: string | null;
  logoFullUrl:  string | null;
  faviconUrl:   string | null;
  loadingCharacterUrl: string | null;
  logoAuthHeight:    number;
  logoSplashHeight:  number;
  logoSidebarHeight: number;
  logoEmailHeight:   number;
  authConfig: AuthConfig;
  setPlatformName:         (n: string) => void;
  setLogoSmallUrl:         (u: string | null) => void;
  setLogoFullUrl:          (u: string | null) => void;
  setFaviconUrl:           (u: string | null) => void;
  setLoadingCharacterUrl:  (u: string | null) => void;
  setLogoAuthHeight:       (h: number) => void;
  setLogoSplashHeight:     (h: number) => void;
  setLogoSidebarHeight:    (h: number) => void;
  setLogoEmailHeight:      (h: number) => void;
  setAuthConfig:           (c: AuthConfig) => void;
}

const PlatformContext = createContext<PlatformContextType>({
  platformName:        'Stibe',
  logoSmallUrl:        null,
  logoFullUrl:         null,
  faviconUrl:          null,
  loadingCharacterUrl: null,
  logoAuthHeight:      40,
  logoSplashHeight:    36,
  logoSidebarHeight:   20,
  logoEmailHeight:     36,
  authConfig:          { ...AUTH_CONFIG_DEFAULTS },
  setPlatformName:         () => {},
  setLogoSmallUrl:         () => {},
  setLogoFullUrl:          () => {},
  setFaviconUrl:           () => {},
  setLoadingCharacterUrl:  () => {},
  setLogoAuthHeight:       () => {},
  setLogoSplashHeight:     () => {},
  setLogoSidebarHeight:    () => {},
  setLogoEmailHeight:      () => {},
  setAuthConfig:           () => {},
});

interface PlatformProviderProps {
  children:                   React.ReactNode;
  initialName?:               string;
  initialLogoSmallUrl?:       string | null;
  initialLogoFullUrl?:        string | null;
  initialFaviconUrl?:         string | null;
  initialLoadingCharacterUrl?: string | null;
  initialLogoAuthHeight?:     number;
  initialLogoSplashHeight?:   number;
  initialLogoSidebarHeight?:  number;
  initialLogoEmailHeight?:    number;
  initialAuthConfig?:         AuthConfig;
}

export function PlatformProvider({
  children,
  initialName                = 'Stibe',
  initialLogoSmallUrl        = null,
  initialLogoFullUrl         = null,
  initialFaviconUrl          = null,
  initialLoadingCharacterUrl = null,
  initialLogoAuthHeight      = 40,
  initialLogoSplashHeight    = 36,
  initialLogoSidebarHeight   = 20,
  initialLogoEmailHeight     = 36,
  initialAuthConfig,
}: PlatformProviderProps) {
  const [platformName,         setPlatformName]         = useState(initialName);
  const [logoSmallUrl,         setLogoSmallUrl]         = useState<string | null>(initialLogoSmallUrl);
  const [logoFullUrl,          setLogoFullUrl]          = useState<string | null>(initialLogoFullUrl);
  const [faviconUrl,           setFaviconUrl]           = useState<string | null>(initialFaviconUrl);
  const [loadingCharacterUrl,  setLoadingCharacterUrl]  = useState<string | null>(initialLoadingCharacterUrl);
  const [logoAuthHeight,       setLogoAuthHeight]       = useState(initialLogoAuthHeight);
  const [logoSplashHeight,     setLogoSplashHeight]     = useState(initialLogoSplashHeight);
  const [logoSidebarHeight,    setLogoSidebarHeight]    = useState(initialLogoSidebarHeight);
  const [logoEmailHeight,      setLogoEmailHeight]      = useState(initialLogoEmailHeight);
  const [authConfig,           setAuthConfig]           = useState<AuthConfig>(initialAuthConfig ?? { ...AUTH_CONFIG_DEFAULTS });

  useEffect(() => {
    fetch('/api/v1/platform/config')
      .then(r => r.json())
      .then(d => {
        if (d.platform_name)                    setPlatformName(d.platform_name);
        if (d.logo_small_url !== undefined)     setLogoSmallUrl(d.logo_small_url);
        if (d.logo_full_url  !== undefined)     setLogoFullUrl(d.logo_full_url);
        if (d.favicon_url    !== undefined)     setFaviconUrl(d.favicon_url);
        if (d.loading_character_url !== undefined) setLoadingCharacterUrl(d.loading_character_url);
        if (d.logo_auth_height    > 0)          setLogoAuthHeight(d.logo_auth_height);
        if (d.logo_splash_height  > 0)          setLogoSplashHeight(d.logo_splash_height);
        if (d.logo_sidebar_height > 0)          setLogoSidebarHeight(d.logo_sidebar_height);
        if (d.logo_email_height   > 0)          setLogoEmailHeight(d.logo_email_height);
        if (d.auth_template) {
          setAuthConfig({
            template:    d.auth_template    ?? 'classic',
            accentColor: d.auth_accent_color ?? '#10b981',
            bgColor:     d.auth_bg_color     ?? '#f0fdf4',
            headline:    d.auth_headline     ?? 'Empowering every learner',
            subheadline: d.auth_subheadline  ?? 'Sign in to continue learning',
            showTagline: d.auth_show_tagline !== false,
            bgPattern:   d.auth_bg_pattern   ?? 'dots',
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <PlatformContext.Provider value={{
      platformName, logoSmallUrl, logoFullUrl, faviconUrl, loadingCharacterUrl,
      logoAuthHeight, logoSplashHeight, logoSidebarHeight, logoEmailHeight,
      authConfig,
      setPlatformName, setLogoSmallUrl, setLogoFullUrl, setFaviconUrl, setLoadingCharacterUrl,
      setLogoAuthHeight, setLogoSplashHeight, setLogoSidebarHeight, setLogoEmailHeight,
      setAuthConfig,
    }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatformName()    { return useContext(PlatformContext).platformName; }
export function usePlatformContext() { return useContext(PlatformContext); }
export function useLogoSmall()       { return useContext(PlatformContext).logoSmallUrl; }
export function useLogoFull()        { return useContext(PlatformContext).logoFullUrl; }
export function useLoadingCharacter() { return useContext(PlatformContext).loadingCharacterUrl; }
export function useAuthConfig()      { return useContext(PlatformContext).authConfig; }
