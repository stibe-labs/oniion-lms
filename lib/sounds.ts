/**
 * sounds.ts — Shared sound effects & haptic feedback for stibe Classroom.
 *
 * Uses Web Audio API (no audio files needed).
 * All functions are no-op safe — they silently catch errors
 * so they never break the calling code.
 */

// ─── Low-level tone player ────────────────────────────────
// Global volume multiplier — reduce all sounds across the classroom UI
const VOLUME_SCALE = 0.4;
function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', volume = 0.18) {
  volume = volume * VOLUME_SCALE;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    setTimeout(() => ctx.close(), durationMs + 100);
  } catch { /* no audio context — ignore */ }
}

// ─── Haptic feedback ──────────────────────────────────────
function vibrate(pattern: number | number[]) {
  try { navigator?.vibrate?.(pattern); } catch { /* not supported */ }
}

// ─── Sound effects ────────────────────────────────────────

/** Rising two-tone chime — hand raised */
export function sfxHandRaise() {
  playTone(880, 200, 'sine');
  setTimeout(() => playTone(1174, 300, 'sine'), 150);
  vibrate([40, 30, 40]);
}

/** Falling single tone — hand lowered */
export function sfxHandLower() {
  playTone(660, 250, 'triangle');
  vibrate(30);
}

/** Bright ascending ding — student/participant joined */
export function sfxParticipantJoin() {
  playTone(523, 120, 'sine', 0.14);     // C5
  setTimeout(() => playTone(659, 120, 'sine', 0.14), 100);  // E5
  setTimeout(() => playTone(784, 200, 'sine', 0.14), 200);  // G5
  vibrate(25);
}

/** Descending soft tone — student/participant left */
export function sfxParticipantLeave() {
  playTone(784, 120, 'triangle', 0.10); // G5
  setTimeout(() => playTone(523, 250, 'triangle', 0.10), 100); // C5
  vibrate(20);
}

/** Short pop — incoming chat message */
export function sfxChatReceive() {
  playTone(1047, 80, 'sine', 0.12);  // C6 pop
  vibrate(15);
}

/** Subtle whoosh — outgoing chat message sent */
export function sfxChatSend() {
  playTone(880, 60, 'triangle', 0.08);
}

/** Warning alert — time running low */
export function sfxWarning() {
  playTone(440, 200, 'sawtooth', 0.10);
  setTimeout(() => playTone(440, 200, 'sawtooth', 0.10), 300);
  vibrate([80, 60, 80]);
}

/** Class ended / expired alert */
export function sfxExpired() {
  playTone(330, 300, 'sawtooth', 0.12);
  setTimeout(() => playTone(262, 400, 'sawtooth', 0.12), 250);
  vibrate([100, 50, 100, 50, 200]);
}

/** Generic button tap haptic (no sound) */
export function hapticTap() {
  vibrate(10);
}

/** Stronger haptic for toggle actions */
export function hapticToggle() {
  vibrate([15, 10, 15]);
}

/** Teacher muted/unmuted a student — soft notification */
export function sfxMediaControl() {
  playTone(698, 100, 'sine', 0.12);  // F5
  setTimeout(() => playTone(880, 150, 'sine', 0.12), 80); // A5
  vibrate([20, 15, 20]);
}

/** Media request received — teacher gets notified */
export function sfxMediaRequest() {
  playTone(784, 80, 'sine', 0.14);   // G5
  setTimeout(() => playTone(988, 120, 'sine', 0.14), 70);  // B5
  setTimeout(() => playTone(1175, 160, 'sine', 0.14), 150); // D6
  vibrate([30, 20, 30]);
}

/** Urgent double-beep — student switched tab (danger alert) */
export function sfxTabSwitch() {
  playTone(880, 100, 'square', 0.15);  // A5 sharp
  setTimeout(() => playTone(880, 100, 'square', 0.15), 180);
  vibrate([50, 30, 50]);
}

/** Danger alert — student reported teacher */
export function sfxDangerAlert() {
  playTone(440, 150, 'sawtooth', 0.18);
  setTimeout(() => playTone(554, 150, 'sawtooth', 0.18), 120);
  setTimeout(() => playTone(440, 200, 'sawtooth', 0.18), 260);
  vibrate([80, 40, 80, 40, 80]);
}
