'use client';
import { createContext, useContext, useEffect, useState } from 'react';

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
  setPlatformName:         (n: string) => void;
  setLogoSmallUrl:         (u: string | null) => void;
  setLogoFullUrl:          (u: string | null) => void;
  setFaviconUrl:           (u: string | null) => void;
  setLoadingCharacterUrl:  (u: string | null) => void;
  setLogoAuthHeight:       (h: number) => void;
  setLogoSplashHeight:     (h: number) => void;
  setLogoSidebarHeight:    (h: number) => void;
  setLogoEmailHeight:      (h: number) => void;
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
  setPlatformName:         () => {},
  setLogoSmallUrl:         () => {},
  setLogoFullUrl:          () => {},
  setFaviconUrl:           () => {},
  setLoadingCharacterUrl:  () => {},
  setLogoAuthHeight:       () => {},
  setLogoSplashHeight:     () => {},
  setLogoSidebarHeight:    () => {},
  setLogoEmailHeight:      () => {},
});

export function PlatformProvider({ children, initialName = 'Stibe' }: { children: React.ReactNode; initialName?: string }) {
  const [platformName,         setPlatformName]         = useState(initialName);
  const [logoSmallUrl,         setLogoSmallUrl]         = useState<string | null>(null);
  const [logoFullUrl,          setLogoFullUrl]          = useState<string | null>(null);
  const [faviconUrl,           setFaviconUrl]           = useState<string | null>(null);
  const [loadingCharacterUrl,  setLoadingCharacterUrl]  = useState<string | null>(null);
  const [logoAuthHeight,       setLogoAuthHeight]       = useState(40);
  const [logoSplashHeight,     setLogoSplashHeight]     = useState(36);
  const [logoSidebarHeight,    setLogoSidebarHeight]    = useState(20);
  const [logoEmailHeight,      setLogoEmailHeight]      = useState(36);

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
      })
      .catch(() => {});
  }, []);

  return (
    <PlatformContext.Provider value={{
      platformName, logoSmallUrl, logoFullUrl, faviconUrl, loadingCharacterUrl,
      logoAuthHeight, logoSplashHeight, logoSidebarHeight, logoEmailHeight,
      setPlatformName, setLogoSmallUrl, setLogoFullUrl, setFaviconUrl, setLoadingCharacterUrl,
      setLogoAuthHeight, setLogoSplashHeight, setLogoSidebarHeight, setLogoEmailHeight,
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
