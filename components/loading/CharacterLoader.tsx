'use client';

/* eslint-disable @next/next/no-img-element */

const RUNNING_GIF = '/buji/2 second running.gif';

/**
 * Animated GIF loading indicator (large).
 */
export function CharacterLoader({
  size = 140,
  text,
  showOrbit: _showOrbit = true,
}: {
  size?: number;
  text?: string;
  showOrbit?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, justifyContent: 'center', minHeight: '100%' }}>
      <img
        src={RUNNING_GIF}
        alt="Loading"
        width={size}
        style={{ objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
      />
      {text && (
        <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b7280' }}>
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * Mini GIF loader for inline/section loading states.
 */
export function MiniCharacterLoader({
  text = 'Loading',
}: {
  text?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 0' }}>
      <img
        src={RUNNING_GIF}
        alt="Loading"
        width={72}
        style={{ objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
      />
      {text && (
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#6b7280' }}>
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * Full-page loading screen with GIF.
 */
export function CharacterLoadingPage({
  text,
}: {
  text?: string;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
      <CharacterLoader size={180} text={text} />
    </div>
  );
}
