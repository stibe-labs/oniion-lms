import { Room, ConnectionState, LocalParticipant, DataPublishOptions } from 'livekit-client';

/**
 * Safely publish data on a LiveKit room data channel.
 *
 * Guards against the common `UnexpectedConnectionState: PC manager is closed`
 * error that fires when `publishData` is called before the underlying
 * PeerConnection is ready or after a brief disconnect.
 *
 * Behavior:
 *  - If the room is not yet `Connected`, polls every 100ms up to `waitMs`.
 *  - If still not connected, returns `false` (drops the message).
 *  - Catches and logs (warn) any transport errors so they never crash the UI.
 *
 * Returns `true` if the publish succeeded, `false` otherwise.
 */
export async function safePublish(
  room: Room | null | undefined,
  participant: LocalParticipant | null | undefined,
  payload: Uint8Array,
  options?: DataPublishOptions,
  waitMs: number = 2000,
): Promise<boolean> {
  if (!room || !participant || typeof participant.publishData !== 'function') return false;

  if (room.state !== ConnectionState.Connected) {
    const start = Date.now();
    // Read state via getter on each iteration to avoid TS narrowing
    const getState = () => room.state as ConnectionState;
    while (getState() !== ConnectionState.Connected && Date.now() - start < waitMs) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }
    if (getState() !== ConnectionState.Connected) return false;
  }

  try {
    await participant.publishData(payload, options);
    return true;
  } catch (err) {
    // PC manager closed / transport error — surface as a warn but never throw.
    // eslint-disable-next-line no-console
    console.warn('[safePublish] publish failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
