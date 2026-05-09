// ═══════════════════════════════════════════════════════════════
// stibe Portal — YouTube Live Streaming Service
// ═══════════════════════════════════════════════════════════════
// Creates unlisted YouTube Live broadcasts for class recordings.
// Uses OAuth2 with a refresh token for the institutional account.
//
// Setup: Run `npx ts-node scripts/youtube-auth.ts` once to get
// the refresh token, then set YOUTUBE_REFRESH_TOKEN in .env.local
// ═══════════════════════════════════════════════════════════════

import { google, youtube_v3 } from 'googleapis';
import { Readable } from 'stream';

// ── Configuration ───────────────────────────────────────────

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID!;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN!;

// ── OAuth2 Client ───────────────────────────────────────────

function getAuth() {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: REFRESH_TOKEN });
  return oauth2;
}

function getYouTube() {
  return google.youtube({ version: 'v3', auth: getAuth() });
}

// ── Types ───────────────────────────────────────────────────

export interface BroadcastResult {
  broadcastId: string;
  streamId: string;
  rtmpUrl: string;       // Full RTMP URL including stream key
  watchUrl: string;       // https://youtube.com/watch?v={id}
}

export interface SessionMeta {
  batchName: string;
  subject: string;
  grade: string;
  topic?: string;
  teacherName?: string;
  scheduledDate?: string;
  partNumber?: number;
}

// ── Create Live Broadcast + Stream ──────────────────────────

export async function createLiveBroadcast(meta: SessionMeta): Promise<BroadcastResult> {
  const yt = getYouTube();
  const title = buildTitle(meta);
  const description = buildDescription(meta);

  // 1. Create broadcast (unlisted — only accessible via direct URL)
  const broadcast = await yt.liveBroadcasts.insert({
    part: ['snippet', 'status', 'contentDetails'],
    requestBody: {
      snippet: {
        title,
        description,
        scheduledStartTime: new Date().toISOString(),
      },
      status: {
        privacyStatus: 'unlisted',
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: true,     // Auto-transition to live when stream starts
        enableAutoStop: true,      // Auto-end broadcast when stream stops
        enableDvr: true,           // Allow rewinding during live
        recordFromStart: true,     // Record from the beginning
      },
    },
  });

  const broadcastId = broadcast.data.id!;

  // 2. Create stream (the RTMP ingest endpoint)
  const stream = await yt.liveStreams.insert({
    part: ['snippet', 'cdn'],
    requestBody: {
      snippet: {
        title: `stibe Stream — ${title}`,
      },
      cdn: {
        frameRate: '30fps',
        ingestionType: 'rtmp',
        resolution: '720p',
      },
    },
  });

  const streamId = stream.data.id!;
  const ingestion = stream.data.cdn?.ingestionInfo;
  const rtmpUrl = `${ingestion?.ingestionAddress}/${ingestion?.streamName}`;

  // 3. Bind stream to broadcast
  await yt.liveBroadcasts.bind({
    id: broadcastId,
    part: ['id', 'contentDetails'],
    streamId,
  });

  return {
    broadcastId,
    streamId,
    rtmpUrl,
    watchUrl: `https://www.youtube.com/watch?v=${broadcastId}`,
  };
}

// ── End Broadcast ───────────────────────────────────────────

export async function endBroadcast(broadcastId: string): Promise<void> {
  const yt = getYouTube();
  try {
    // Try transitioning to "complete" — only works if in "live" status
    await yt.liveBroadcasts.transition({
      broadcastStatus: 'complete',
      id: broadcastId,
      part: ['id', 'status'],
    });
  } catch (err) {
    // If enableAutoStop is true, broadcast may already be complete
    console.warn('[youtube] Broadcast transition warning (may already be complete):', (err as Error).message);
  }
}

// ── Get Video Details (after broadcast ends) ────────────────

export async function getVideoDetails(videoId: string): Promise<{
  title: string;
  duration: string;
  url: string;
  status: string;
} | null> {
  const yt = getYouTube();
  const res = await yt.videos.list({
    id: [videoId],
    part: ['snippet', 'contentDetails', 'status'],
  });

  const video = res.data.items?.[0];
  if (!video) return null;

  return {
    title: video.snippet?.title || '',
    duration: video.contentDetails?.duration || '',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    status: video.status?.uploadStatus || 'unknown',
  };
}

// ── Upload Pre-recorded Video ───────────────────────────────

export async function uploadVideoToYouTube(
  videoBuffer: Buffer,
  meta: SessionMeta,
): Promise<{ videoId: string; watchUrl: string }> {
  const yt = getYouTube();
  const title = buildTitle(meta);
  const description = buildDescription(meta);

  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: '27', // Education
      },
      status: {
        privacyStatus: 'unlisted',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: Readable.from(videoBuffer),
    },
  });

  const videoId = res.data.id!;
  return {
    videoId,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

// ── Playlist Management ─────────────────────────────────────

/**
 * Get or create a YouTube playlist for a batch + subject + month.
 * Naming: "[Batch Name] — [Subject] — [Month Year]"
 */
export async function createOrGetPlaylist(
  batchName: string,
  subject: string,
  monthKey: string, // e.g. '2026-03'
): Promise<{ playlistId: string; playlistUrl: string }> {
  const yt = getYouTube();
  const [year, month] = monthKey.split('-');
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('en', { month: 'long' });
  const title = `${batchName} — ${subject} — ${monthName} ${year}`;

  // Search existing playlists by title
  const existing = await yt.playlists.list({
    part: ['snippet'],
    mine: true,
    maxResults: 50,
  });

  const match = existing.data.items?.find(p => p.snippet?.title === title);
  if (match) {
    return {
      playlistId: match.id!,
      playlistUrl: `https://www.youtube.com/playlist?list=${match.id}`,
    };
  }

  // Create new playlist
  const res = await yt.playlists.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description: `stibe Learning — Class recordings for ${batchName}, ${subject} (${monthName} ${year})`,
      },
      status: { privacyStatus: 'unlisted' },
    },
  });

  return {
    playlistId: res.data.id!,
    playlistUrl: `https://www.youtube.com/playlist?list=${res.data.id}`,
  };
}

/**
 * Add a video to a YouTube playlist.
 */
export async function addToPlaylist(playlistId: string, videoId: string): Promise<void> {
  const yt = getYouTube();
  await yt.playlistItems.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId },
      },
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────

function buildTitle(meta: SessionMeta): string {
  const parts: string[] = [];
  parts.push(meta.subject || 'Class');
  if (meta.grade) parts.push(`Grade ${meta.grade}`);
  if (meta.topic) parts.push(meta.topic);
  parts.push(meta.batchName);
  if (meta.scheduledDate) parts.push(meta.scheduledDate);
  if (meta.partNumber && meta.partNumber > 1) parts.push(`Part ${meta.partNumber}`);

  // YouTube title limit: 100 chars, no < or > characters
  let title = parts.join(' — ').replace(/[<>]/g, '');
  if (title.length > 100) title = title.slice(0, 97) + '...';
  return title || 'stibe Class Recording';
}

function buildDescription(meta: SessionMeta): string {
  const lines = [
    `stibe Learning — Class Recording`,
    ``,
    `Subject: ${meta.subject}`,
    `Grade: ${meta.grade}`,
    `Batch: ${meta.batchName}`,
  ];
  if (meta.topic) lines.push(`Topic: ${meta.topic}`);
  if (meta.teacherName) lines.push(`Teacher: ${meta.teacherName}`);
  if (meta.scheduledDate) lines.push(`Date: ${meta.scheduledDate}`);
  lines.push('', 'This is an unlisted class recording from stibe Learning portal.');
  return lines.join('\n');
}
