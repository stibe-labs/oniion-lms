// ═══════════════════════════════════════════════════════════════
// Recording Upload — /api/v1/room/[room_id]/recording/upload
// Receives a webm recording blob from student's browser,
// uploads it to YouTube (unlisted), saves the URL to the room.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { uploadVideoToYouTube, type SessionMeta } from '@/lib/youtube';

export const config = {
  api: { bodyParser: false },
};

// Max upload: 500 MB
const MAX_SIZE = 500 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ room_id: string }> }
) {
  const { room_id } = await params;

  // Auth
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Check room exists and is ended
  const room = await db.query(
    `SELECT r.room_id, r.room_name, r.status, r.recording_url, r.subject, r.grade,
            r.teacher_email, r.batch_session_id, r.scheduled_start,
            bs.topic, b.batch_name, u.full_name AS teacher_name
     FROM rooms r
     LEFT JOIN batch_sessions bs ON bs.session_id = r.batch_session_id
     LEFT JOIN batches b ON b.batch_id = r.batch_id
     LEFT JOIN portal_users u ON u.email = r.teacher_email
     WHERE r.room_id = $1`,
    [room_id],
  );

  if (room.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
  }

  const r = room.rows[0];

  // If recording already exists, skip (first uploader wins)
  if (r.recording_url) {
    return NextResponse.json({ success: true, message: 'Recording already exists', data: { youtubeUrl: r.recording_url } });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('recording') as File | null;
  if (!file) {
    return NextResponse.json({ success: false, error: 'No recording file provided' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'Recording too large (max 500 MB)' }, { status: 413 });
  }

  console.log(`[recording/upload] Received ${(file.size / 1024 / 1024).toFixed(1)} MB from ${user.id} for room ${room_id}`);

  try {
    // Mark room as recording in progress to prevent duplicate uploads
    const lockResult = await db.query(
      `UPDATE rooms SET recording_status = 'uploading'
       WHERE room_id = $1 AND (recording_url IS NULL OR recording_url = '')
       RETURNING room_id`,
      [room_id],
    );

    if (lockResult.rowCount === 0) {
      return NextResponse.json({ success: true, message: 'Recording already exists' });
    }

    // Convert File to Buffer for YouTube upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const meta: SessionMeta = {
      batchName: (r.batch_name as string) || (r.room_name as string),
      subject: (r.subject as string) || 'Unknown Subject',
      grade: (r.grade as string) || '',
      topic: (r.topic as string) || undefined,
      teacherName: (r.teacher_name as string) || undefined,
      scheduledDate: r.scheduled_start
        ? new Date(r.scheduled_start as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : undefined,
    };

    // Upload to YouTube
    const result = await uploadVideoToYouTube(buffer, meta);

    // Save URL to room
    await db.query(
      `UPDATE rooms SET recording_url = $1, recording_status = 'completed' WHERE room_id = $2`,
      [result.watchUrl, room_id],
    );

    // Log event
    await db.query(
      `INSERT INTO room_events (room_id, event_type, participant_email, payload)
       VALUES ($1, 'recording_uploaded', $2, $3::jsonb)`,
      [room_id, user.id, JSON.stringify({
        youtube_video_id: result.videoId,
        youtube_url: result.watchUrl,
        file_size_mb: (file.size / 1024 / 1024).toFixed(1),
        uploaded_by: user.id,
      })],
    );

    console.log(`[recording/upload] YouTube upload complete: ${result.watchUrl}`);

    return NextResponse.json({
      success: true,
      data: { youtubeUrl: result.watchUrl, videoId: result.videoId },
    });
  } catch (err) {
    console.error('[recording/upload] Upload failed:', err);
    // Reset status so another student can try
    await db.query(
      `UPDATE rooms SET recording_status = NULL WHERE room_id = $1 AND recording_status = 'uploading'`,
      [room_id],
    );
    return NextResponse.json({ success: false, error: 'Upload to YouTube failed' }, { status: 500 });
  }
}
