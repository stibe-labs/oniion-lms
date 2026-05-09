'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const PlatformContext = createContext<{ platformName: string; setPlatformName: (n: string) => void }>({
  platformName: 'Stibe',
  setPlatformName: () => {},
});

export function PlatformProvider({ children, initialName = 'Stibe' }: { children: React.ReactNode; initialName?: string }) {
  const [platformName, setPlatformName] = useState(initialName);

  useEffect(() => {
    fetch('/api/v1/platform/config')
      .then(r => r.json())
      .then(d => { if (d.platform_name) setPlatformName(d.platform_name); })
      .catch(() => {});
  }, []);

  return (
    <PlatformContext.Provider value={{ platformName, setPlatformName }}>
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
