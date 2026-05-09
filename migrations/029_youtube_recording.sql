-- Migration 029: Add YouTube Live columns to rooms table
-- Supports YouTube Live recording instead of local MP4 storage

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS youtube_broadcast_id TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS youtube_stream_id TEXT;

-- Track in migrations table
INSERT INTO _migrations (filename) VALUES ('029_youtube_recording.sql')
ON CONFLICT (filename) DO NOTHING;
