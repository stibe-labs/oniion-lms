'use client';
import { createContext, useContext, useEffect, useState } from 'react';

interface PlatformConfig {
  platformName: string;
  logoSmallUrl: string | null;
  logoFullUrl: string | null;
  faviconUrl: string | null;
}

interface PlatformContextType extends PlatformConfig {
  setPlatformName: (n: string) => void;
  setLogoSmallUrl: (u: string | null) => void;
  setLogoFullUrl:  (u: string | null) => void;
  setFaviconUrl:   (u: string | null) => void;
}

const PlatformContext = createContext<PlatformContextType>({
  platformName: 'Stibe',
  logoSmallUrl: null,
  logoFullUrl:  null,
  faviconUrl:   null,
  setPlatformName: () => {},
  setLogoSmallUrl: () => {},
  setLogoFullUrl:  () => {},
  setFaviconUrl:   () => {},
});

export function PlatformProvider({ children, initialName = 'Stibe' }: { children: React.ReactNode; initialName?: string }) {
  const [platformName, setPlatformName] = useState(initialName);
  const [logoSmallUrl, setLogoSmallUrl] = useState<string | null>(null);
  const [logoFullUrl,  setLogoFullUrl]  = useState<string | null>(null);
  const [faviconUrl,   setFaviconUrl]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/platform/config')
      .then(r => r.json())
      .then(d => {
        if (d.platform_name)  setPlatformName(d.platform_name);
        if (d.logo_small_url !== undefined) setLogoSmallUrl(d.logo_small_url);
        if (d.logo_full_url  !== undefined) setLogoFullUrl(d.logo_full_url);
        if (d.favicon_url    !== undefined) setFaviconUrl(d.favicon_url);
      })
      .catch(() => {});
  }, []);

  return (
    <PlatformContext.Provider value={{ platformName, logoSmallUrl, logoFullUrl, faviconUrl, setPlatformName, setLogoSmallUrl, setLogoFullUrl, setFaviconUrl }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatformName() {
  return useContext(PlatformContext).platformName;
}

export function usePlatformContext() {
  return useContext(PlatformContext);
}

export function useLogoSmall() {
  return useContext(PlatformContext).logoSmallUrl;
}

export function useLogoFull() {
  return useContext(PlatformContext).logoFullUrl;
}
