import {
  RoomServiceClient,
  AccessToken,
  WebhookReceiver,
  type VideoGrant,
} from 'livekit-server-sdk';
import type { PortalRole } from '@/types';

/**
 * LiveKit server utilities.
 * Uses LIVEKIT_API_KEY + LIVEKIT_API_SECRET from environment.
 * These are server-side only — never import this in client components.
 *
 * LIVEKIT_URL = direct HTTP URL for server-side API calls (e.g. http://76.13.244.54:7880)
 * NEXT_PUBLIC_LIVEKIT_URL = client-facing WSS URL sent to browsers (e.g. wss://stibelearning.online)
 */

const livekitHost =
  process.env.LIVEKIT_URL ||
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:7880';
const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

// ── Room Service Client (admin operations) ──────────────────
export const roomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);

// ── Webhook Receiver (verify LiveKit signatures) ────────────
export const webhookReceiver = new WebhookReceiver(apiKey, apiSecret);

// ── Role-based LiveKit grants ───────────────────────────────
// See 04_API_ROUTES.md §4.1 for grant matrix
// hidden: true is a real LiveKit server-enforced field — hides participant from all lists
const GRANTS: Record<PortalRole, VideoGrant> = {
  teacher: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
    roomAdmin: true,
    roomRecord: true,
  },
  teacher_screen: {
    // Teacher's tablet/screen device — can only screen share, no camera/mic
    roomJoin: true,
    canPublish: true,           // needs to publish screen share track
    canPublishSources: [3, 4],  // TrackSource.SCREEN_SHARE = 3, SCREEN_SHARE_AUDIO = 4
    canPublishData: false,
    canSubscribe: false,        // doesn't need to receive tracks
    hidden: false,              // students need to see this to get the screen share
    roomAdmin: false,
  },
  student: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
  },
  batch_coordinator: {
    // BC observes silently by default but can press-and-hold a "Talk to Teacher"
    // button to whisper privately. Track-subscription permissions are tightened
    // client-side so only the teacher identity can subscribe to BC's mic.
    // hidden MUST be false — LiveKit's hidden flag prevents track events from
    // reaching other participants, so teacher would never receive BC's audio.
    // StudentView only renders teacher mic; students cannot hear BC.
    roomJoin: true,
    canPublish: true,
    canPublishData: true, // BC needs data channels: private chat, media_control, leave_control, rejoin_control
    canSubscribe: true,
    hidden: false,
  },
  academic_operator: {
    // AO observes silently by default but can press-and-hold "Talk to Teacher"
    // to whisper privately — same as BC. hidden MUST be false so LiveKit
    // propagates track events and teacher can hear AO's mic.
    // StudentView only renders teacher mic; students cannot hear AO.
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
  },
  academic: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: true,
  },
  parent: {
    roomJoin: true,
    canPublish: false,
    canPublishData: true,  // needed for StudentView data channels (attention, hand-raise)
    canSubscribe: true,
    hidden: true, // parents are ghost observers
  },
  hr: {
    roomJoin: false,
    canPublish: false,
    canPublishData: false,
    canSubscribe: false,
    hidden: true, // HR does not join classrooms
  },
  owner: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
    hidden: true,
  },
  ghost: {
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
    hidden: true,
  },
  sales: {
    roomJoin: false,
    canPublish: false,
    canPublishData: false,
    canSubscribe: false,
    hidden: true,
  },
  demo_agent: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
  },
  conference_host: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
    roomAdmin: true,
  },
  conference_user: {
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    hidden: false,
  },
  superadmin: {
    roomJoin: false,
    canPublish: false,
    canPublishData: false,
    canSubscribe: false,
    hidden: true,
  },
};

/**
 * Create a LiveKit access token for a participant.
 * Grants are determined by role from the GRANTS matrix.
 * For lecture rooms, students get downgraded: no mic/camera publish (chat + hand-raise only).
 */
export async function createLiveKitToken(options: {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: PortalRole;
  metadata?: string;
  ttl?: string;
  batchType?: string;
}): Promise<string> {
  const { roomName, participantIdentity, participantName, role, metadata, ttl, batchType } = options;
  const grant: VideoGrant = { ...GRANTS[role], room: roomName };

  // Lecture mode: students can only chat (data channel) and subscribe — no mic/camera
  if (batchType === 'lecture' && role === 'student') {
    grant.canPublish = false;
    grant.canPublishData = true; // needed for chat + hand-raise data channels
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: ttl || '4h',
    metadata,
  });
  token.addGrant(grant);

  return await token.toJwt();
}

// Keep the old function as an alias for backward compat
export async function createRoomToken(
  roomName: string,
  identity: string,
  name: string,
  role: PortalRole
): Promise<string> {
  return createLiveKitToken({
    roomName,
    participantIdentity: identity,
    participantName: name,
    role,
  });
}

/**
 * Ensure a LiveKit room exists. Idempotent — safe to call multiple times.
 * Returns the room object.
 */
export async function ensureRoom(
  roomName: string,
  metadata?: string
): Promise<{ name: string; sid: string }> {
  const rooms = await roomService.listRooms([roomName]);
  if (rooms.length > 0) {
    return { name: rooms[0].name, sid: rooms[0].sid };
  }

  const room = await roomService.createRoom({
    name: roomName,
    // 4 hours — long enough to survive PM2 restarts, network blips, and
    // scheduled-end-to-manual-end overtime. Teacher must explicitly end via
    // DELETE /api/v1/room/[room_id] to close the room.
    emptyTimeout: 14400,
    maxParticipants: 0, // 0 = unlimited (governed by server config max_participants)
    metadata,
  });

  return { name: room.name, sid: room.sid };
}

/**
 * Delete a LiveKit room. Used when teacher ends the class.
 */
export async function deleteRoom(roomName: string): Promise<void> {
  await roomService.deleteRoom(roomName);
}

/**
 * List current participants in a room (excludes hidden by default).
 */
export async function listParticipants(roomName: string) {
  return roomService.listParticipants(roomName);
}

/**
 * Test LiveKit connectivity. Creates a test room, lists it, deletes it.
 * Returns step-by-step results.
 */
export async function testLiveKitConnectivity(): Promise<{
  steps: { name: string; pass: boolean; error?: string }[];
  reachable: boolean;
}> {
  const testRoom = 'dev_ping_room';
  const steps: { name: string; pass: boolean; error?: string }[] = [];

  // Step 1: Create test room
  try {
    await roomService.createRoom({ name: testRoom, emptyTimeout: 10 });
    steps.push({ name: 'Create test room', pass: true });
  } catch (e) {
    steps.push({ name: 'Create test room', pass: false, error: String(e) });
    return { steps, reachable: false };
  }

  // Step 2: List rooms to verify it exists
  try {
    const rooms = await roomService.listRooms([testRoom]);
    const found = rooms.some((r) => r.name === testRoom);
    steps.push({ name: 'List rooms (verify exists)', pass: found, error: found ? undefined : 'Room not found in list' });
  } catch (e) {
    steps.push({ name: 'List rooms (verify exists)', pass: false, error: String(e) });
  }

  // Step 3: Delete test room
  try {
    await roomService.deleteRoom(testRoom);
    steps.push({ name: 'Delete test room', pass: true });
  } catch (e) {
    steps.push({ name: 'Delete test room', pass: false, error: String(e) });
  }

  // Step 4: Generate a test token
  try {
    const token = await createLiveKitToken({
      roomName: 'test_room',
      participantIdentity: 'test_user',
      participantName: 'Test User',
      role: 'student',
      ttl: '30s',
    });
    steps.push({ name: 'Generate test token', pass: !!token });
  } catch (e) {
    steps.push({ name: 'Generate test token', pass: false, error: String(e) });
  }

  return { steps, reachable: steps.every((s) => s.pass) };
}

/**
 * Generate ghost identity string.
 * Format: ghost_{role}_{sanitised_name}_{unix_timestamp}
 */
export function ghostIdentity(role: PortalRole, userName: string): string {
  const sanitised = userName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return `ghost_${role}_${sanitised}_${Math.floor(Date.now() / 1000)}`;
}

/**
 * Check if a role gets ghost (hidden) grants.
 */
export function isHiddenRole(role: PortalRole): boolean {
  return GRANTS[role]?.hidden === true;
}
