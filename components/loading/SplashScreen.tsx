'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const SPLASH_DURATION = 4000;
const FADE_DURATION = 600;

// Dashboard routes that should skip splash
const DASHBOARD_PREFIXES = [
  '/owner', '/teacher', '/student', '/parent', '/hr',
  '/academic-operator', '/batch-coordinator', '/ghost',
];

function isDashboardRoute(path: string) {
  return DASHBOARD_PREFIXES.some(p => path.startsWith(p));
}

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'init' | 'splash' | 'fading' | 'done'>('init');
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval>>(null);
  const [logoUrl, setLogoUrl] = useState('/logo/full.png');
  const [splashHeight, setSplashHeight] = useState(36);

  useEffect(() => {
    fetch('/api/v1/platform/config')
      .then(r => r.json())
      .then(d => {
        if (d.logo_full_url)      setLogoUrl(d.logo_full_url);
        if (d.logo_splash_height) setSplashHeight(d.logo_splash_height);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Skip splash on dashboard routes
    if (isDashboardRoute(pathname)) {
      setPhase('done');
      return;
    }

    // Skip if already shown in this browser session (e.g. page reload)
    if (sessionStorage.getItem('splash_shown')) {
      setPhase('done');
      return;
    }
    sessionStorage.setItem('splash_shown', '1');

    setPhase('splash');

    // Animate progress from 0 → 100 over SPLASH_DURATION
    const step = 50; // update every 50ms
    const increment = (step / SPLASH_DURATION) * 100;
    progressRef.current = setInterval(() => {
      setProgress(p => {
        const next = p + increment;
        return next >= 100 ? 100 : next;
      });
    }, step);

    const splashTimer = setTimeout(() => {
      setPhase('fading');
      setProgress(100);
      if (progressRef.current) clearInterval(progressRef.current);
    }, SPLASH_DURATION);

    return () => {
      clearTimeout(splashTimer);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'fading') return;
    const fadeTimer = setTimeout(() => setPhase('done'), FADE_DURATION);
    return () => clearTimeout(fadeTimer);
  }, [phase]);

  if (phase === 'done') return <>{children}</>;
  if (phase === 'init') return null;

  return (
    <>
      <div style={{ visibility: 'hidden', position: 'fixed', inset: 0, zIndex: 0 }}>{children}</div>

      <div className="splash-overlay" data-phase={phase}>
        <div className="splash-content">
          {/* Character GIF */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/buji/4 second thinking.gif"
            alt=""
            className="splash-gif"
          />

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Logo" className="splash-logo" style={{ height: splashHeight, width: 'auto' }} />

          {/* Tagline */}
          <p className="splash-tagline">
            {'Crafting Future'.split('').map((ch, i) => (
              <span key={i} className="splash-letter" style={{ animationDelay: `${i * 0.07}s` }}>
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </p>

          {/* Progress */}
          <div className="splash-progress-area">
            <div className="splash-progress-track">
              <div className="splash-progress-bar" style={{ width: `${progress}%` }} />
              <div className="splash-progress-glow" style={{ left: `${progress}%` }} />
            </div>
            <span className="splash-percent">{Math.round(progress)}%</span>
          </div>
        </div>

        <style jsx>{`
          .splash-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafbfc;
            overflow: hidden;
            transition: opacity ${FADE_DURATION}ms cubic-bezier(0.4, 0, 0, 1);
          }
          .splash-overlay[data-phase="fading"] {
            opacity: 0;
          }
          .splash-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
          }
          .splash-logo {
            height: 36px;
            width: auto;
            object-fit: contain;
            pointer-events: none;
            user-select: none;
          }
          .splash-gif {
            width: 180px;
            height: auto;
            object-fit: contain;
            pointer-events: none;
            user-select: none;
          }

          /* Tagline — letter-by-letter reveal */
          .splash-tagline {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 4px;
            text-transform: uppercase;
            display: flex;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .splash-letter {
            display: inline-block;
            opacity: 0;
            transform: translateY(8px);
            animation: letterIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            background: linear-gradient(135deg, #0bab64, #3bb78f, #00c9a7);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          @keyframes letterIn {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Progress area */
          .splash-progress-area {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 2px;
          }
          .splash-progress-track {
            width: 180px;
            height: 4px;
            background: #e8ecf0;
            border-radius: 99px;
            overflow: visible;
            position: relative;
          }
          .splash-progress-bar {
            height: 100%;
            border-radius: 99px;
            background: linear-gradient(90deg, #0bab64, #3bb78f, #00c9a7);
            background-size: 200% 100%;
            animation: shimmer 2s linear infinite;
            transition: width 80ms linear;
            position: relative;
          }
          .splash-progress-glow {
            position: absolute;
            top: 50%;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #3bb78f;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 10px rgba(59, 183, 143, 0.6), 0 0 20px rgba(59, 183, 143, 0.3);
            transition: left 80ms linear;
            pointer-events: none;
          }
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          .splash-percent {
            font-size: 11px;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
            color: #9ca3af;
            min-width: 28px;
            font-family: system-ui, -apple-system, sans-serif;
          }
        `}</style>
      </div>
    </>
  );
}
