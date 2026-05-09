'use client';

/**
 * Spinner-based loading indicator (large).
 */
export function CharacterLoader({
  size = 140,
  text,
}: {
  size?: number;
  text?: string;
  showOrbit?: boolean;
}) {
  const spinnerSize = Math.round(size * 0.35);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, justifyContent: 'center', minHeight: '100%' }}>
      <div style={{ width: spinnerSize, height: spinnerSize, borderRadius: '50%', border: `${Math.max(3, Math.round(spinnerSize / 12))}px solid #e5e7eb`, borderTopColor: '#10b981', animation: 'charLoaderSpin 0.8s linear infinite' }} />
      {text && (
        <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b7280' }}>
          {text}
        </p>
      )}
      <style>{`@keyframes charLoaderSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/**
 * Mini spinner for inline/section loading states.
 */
export function MiniCharacterLoader({
  text = 'Loading',
}: {
  text?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#10b981', animation: 'charLoaderSpin 0.8s linear infinite' }} />
      {text && (
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#6b7280' }}>
          {text}
        </p>
      )}
      <style>{`@keyframes charLoaderSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/**
 * Full-page loading screen.
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
