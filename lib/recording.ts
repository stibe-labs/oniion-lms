// ═══════════════════════════════════════════════════════════════
// stibe Portal — Recording Service (YouTube Live)
// ═══════════════════════════════════════════════════════════════
// Records classes via LiveKit RTMP egress → YouTube Live (unlisted).
// Zero local storage — recordings hosted on YouTube.
//
// Flow:
//   1. Teacher clicks Record → createLiveBroadcast() → YouTube RTMP URL
//   2. LiveKit startRoomCompositeEgress() streams to YouTube
//   3. Teacher stops → stopEgress() → YouTube auto-saves
//   4. Webhook egress_ended → store YouTube watch URL in recording_url
// ═══════════════════════════════════════════════════════════════

import { EgressClient, StreamOutput, StreamProtocol } from 'livekit-server-sdk';
import { db } from '@/lib/db';
import { createLiveBroadcast, endBroadcast, createOrGetPlaylist, addToPlaylist, type SessionMeta } from '@/lib/youtube';

// ── Configuration ───────────────────────────────────────────

const livekitHost =
  process.env.LIVEKIT_URL ||
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:7880';
const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

// ── Egress Client ───────────────────────────────────────────

const egressClient = new EgressClient(livekitHost, apiKey, apiSecret);

// ── Start Recording (YouTube Live) ──────────────────────────

export async function startRecording(roomName: string, roomId: string) {
  try {
    // Check if already recording
    const existing = await db.query(
      `SELECT recording_status, egress_id FROM rooms WHERE room_id = $1`,
      [roomId]
    );
    if (existing.rows[0]?.recording_status === 'recording') {
      return { alreadyRecording: true, egressId: existing.rows[0].egress_id };
    }

    // Fetch session metadata for YouTube broadcast title
    const roomMeta = await db.query(
      `SELECT r.subject, r.grade, r.room_name, r.teacher_email, r.batch_session_id,
              bs.topic, b.batch_name, u.full_name AS teacher_name,
              r.scheduled_start
       FROM rooms r
       LEFT JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
       LEFT JOIN batches b ON b.batch_id = r.batch_id
       LEFT JOIN portal_users u ON u.email = r.teacher_email
       WHERE r.room_id = $1`,
      [roomId]
    );
    const meta = roomMeta.rows[0] || {};

    // Count existing recordings for this room to determine part number
    const partResult = await db.query(
      `SELECT COUNT(*) AS cnt FROM room_events WHERE room_id = $1 AND event_type = 'recording_started'`,
      [roomId]
    );
    const partNumber = parseInt(partResult.rows[0]?.cnt as string || '0', 10) + 1;

    const sessionMeta: SessionMeta = {
      batchName: (meta.batch_name as string) || roomName,
      subject: (meta.subject as string) || 'Unknown Subject',
      grade: (meta.grade as string) || '',
      topic: (meta.topic as string) || undefined,
      teacherName: (meta.teacher_name as string) || undefined,
      scheduledDate: meta.scheduled_start
        ? new Date(meta.scheduled_start as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : undefined,
      partNumber,
    };

    // 1. Create YouTube Live broadcast (unlisted) → get RTMP URL
    const broadcast = await createLiveBroadcast(sessionMeta);

    // 2. Start LiveKit RTMP egress → streams to YouTube
    //    Retry up to 3 times if egress is temporarily unavailable ("no response from servers")
    const output = new StreamOutput({
      protocol: StreamProtocol.RTMP,
      urls: [broadcast.rtmpUrl],
    });

    let egress;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        egress = await egressClient.startRoomCompositeEgress(
          roomId,
          { stream: output },
          {
            layout: '',
            customBaseUrl: 'https://stibelearning.online/egress-layout',
            audioOnly: false,
            videoOnly: false,
          }
        );
        break; // success
      } catch (egressErr) {
        const msg = (egressErr as Error).message || '';
        if (attempt < 3 && msg.includes('no response from servers')) {
          console.warn(`[recording] Egress start attempt ${attempt} failed (no response), retrying in 3s…`);
          await new Promise(r => setTimeout(r, 3000));
        } else {
          throw egressErr;
        }
      }
    }
    if (!egress) throw new Error('Egress failed to start after 3 attempts');

    const egressId = egress.egressId;

    // 3. Update room with recording + YouTube metadata
    //    If the DB update fails, stop the egress immediately to avoid a zombie.
    try {
      await db.query(
        `UPDATE rooms
         SET recording_status = 'recording',
             egress_id = $1,
             recording_url = $2,
             youtube_broadcast_id = $3,
             youtube_stream_id = $4
         WHERE room_id = $5`,
        [egressId, broadcast.watchUrl, broadcast.broadcastId, broadcast.streamId, roomId]
      );
    } catch (dbErr) {
      console.error('[recording] DB update failed after egress start — stopping egress to avoid zombie:', egressId);
      egressClient.stopEgress(egressId).catch(e => console.warn('[recording] Cleanup stopEgress failed:', e));
      throw dbErr;
    }

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'recording_started', 'system', $2::jsonb)`,
      [roomId, JSON.stringify({
        egress_id: egressId,
        youtube_broadcast_id: broadcast.broadcastId,
        youtube_watch_url: broadcast.watchUrl,
      })]
    );

    return { success: true, egressId, youtubeUrl: broadcast.watchUrl };
  } catch (err) {
    console.error('[recording] Start recording error:', err);
    throw err;
  }
}

// ── Stop Recording ──────────────────────────────────────────

export async function stopRecording(roomId: string) {
  try {
    const room = await db.query(
      `SELECT egress_id, room_id, youtube_broadcast_id FROM rooms WHERE room_id = $1`,
      [roomId]
    );

    let egressId = room.rows[0]?.egress_id as string | undefined;

    // Fallback: if DB has no egress_id, query LiveKit directly for any active egress on this room
    if (!egressId) {
      try {
        const liveEgresses = await egressClient.listEgress({ roomName: roomId, active: true });
        if (liveEgresses.length > 0) {
          egressId = liveEgresses[0].egressId;
          console.warn(`[recording] DB had no egress_id for ${roomId}, found live egress via LiveKit: ${egressId}`);
        }
      } catch (listErr) {
        console.warn('[recording] listEgress fallback failed:', listErr);
      }
    }

    if (!egressId) {
      return { success: false, error: 'No active recording' };
    }

    // Stop LiveKit egress (stops RTMP stream to YouTube)
    await egressClient.stopEgress(egressId);

    // End YouTube broadcast (auto-stop should handle this, but be explicit)
    const broadcastId = room.rows[0]?.youtube_broadcast_id as string | undefined;
    if (broadcastId) {
      endBroadcast(broadcastId).catch(e =>
        console.warn('[recording] YouTube endBroadcast warning:', e)
      );
    }

    // Update room — mark completed (YouTube already has the video)
    await db.query(
      `UPDATE rooms SET recording_status = 'completed' WHERE room_id = $1`,
      [roomId]
    );

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'recording_stopped', 'system', $2::jsonb)`,
      [roomId, JSON.stringify({ egress_id: egressId, youtube_broadcast_id: broadcastId })]
    );

    // Auto-add to YouTube playlist (fire-and-forget)
    if (broadcastId) {
      autoAddToPlaylist(roomId, broadcastId).catch(e =>
        console.warn('[recording] Playlist auto-add warning:', e)
      );
    }

    return { success: true, egressId };
  } catch (err) {
    console.error('[recording] Stop recording error:', err);
    throw err;
  }
}

// ── Get Recording Status ────────────────────────────────────

export async function getRecordingStatus(roomId: string) {
  const result = await db.query(
    `SELECT recording_status, egress_id, recording_url FROM rooms WHERE room_id = $1`,
    [roomId]
  );
  return result.rows[0] || null;
}

// ── List Recordings ─────────────────────────────────────────

export async function listRecordings(filters?: { subject?: string; grade?: string; limit?: number }) {
  let sql = `SELECT r.room_id, r.room_name, r.subject, r.grade, r.recording_url,
                    r.recording_status, r.scheduled_start, r.duration_minutes,
                    r.teacher_email
             FROM rooms r
             WHERE r.recording_url IS NOT NULL`;
  const params: unknown[] = [];

  if (filters?.subject) {
    params.push(filters.subject);
    sql += ` AND r.subject = $${params.length}`;
  }
  if (filters?.grade) {
    params.push(filters.grade);
    sql += ` AND r.grade = $${params.length}`;
  }

  sql += ` ORDER BY r.scheduled_start DESC`;

  if (filters?.limit) {
    params.push(filters.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await db.query(sql, params);
  return result.rows;
}

// ── Update Recording URL (from webhook egress_ended) ────────

export async function updateRecordingUrl(egressId: string, recordingUrl: string) {
  await db.query(
    `UPDATE rooms SET recording_url = $1, recording_status = 'completed'
     WHERE egress_id = $2`,
    [recordingUrl, egressId]
  );
}

// ── Get Student Recordings ──────────────────────────────────

export async function getStudentRecordings(studentEmail: string) {
  const result = await db.query(
    `SELECT r.room_id, r.room_name, r.subject, r.grade, r.recording_url,
            r.scheduled_start, r.duration_minutes, r.teacher_email
     FROM rooms r
     JOIN room_assignments ra ON ra.room_id = r.room_id
     WHERE ra.participant_email = $1
       AND ra.participant_type = 'student'
       AND r.recording_url IS NOT NULL
     ORDER BY r.scheduled_start DESC`,
    [studentEmail]
  );
  return result.rows;
}

// ── Auto Add Recording to YouTube Playlist ──────────────────

async function autoAddToPlaylist(roomId: string, videoId: string) {
  const meta = await db.query(
    `SELECT r.subject, b.batch_id, b.batch_name, r.scheduled_start
     FROM rooms r
     LEFT JOIN batches b ON b.batch_id = r.batch_id
     WHERE r.room_id = $1`,
    [roomId]
  );
  const row = meta.rows[0];
  if (!row?.batch_id || !row?.subject) return;

  const monthKey = row.scheduled_start
    ? new Date(row.scheduled_start as string).toISOString().slice(0, 7)
    : new Date().toISOString().slice(0, 7);

  // Check local cache first
  const cached = await db.query(
    `SELECT playlist_id FROM youtube_playlists WHERE batch_id = $1 AND subject = $2 AND month_key = $3`,
    [row.batch_id, row.subject, monthKey]
  );

  let playlistId: string;
  if (cached.rows[0]) {
    playlistId = cached.rows[0].playlist_id as string;
  } else {
    const pl = await createOrGetPlaylist(row.batch_name as string, row.subject as string, monthKey);
    playlistId = pl.playlistId;
    await db.query(
      `INSERT INTO youtube_playlists (batch_id, subject, month_key, playlist_id, playlist_url)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (batch_id, subject, month_key) DO NOTHING`,
      [row.batch_id, row.subject, monthKey, pl.playlistId, pl.playlistUrl]
    );
  }

  await addToPlaylist(playlistId, videoId);
  console.log(`[recording] Added ${videoId} to playlist ${playlistId} (${row.batch_name} / ${row.subject} / ${monthKey})`);
}
