-- Migration 032: Chat Log Storage + YouTube Playlists + One-to-Five & Lecture batch types
-- Date: 2026-03-12

-- ═══════════════════════════════════════════════════════════════
-- 1. Chat Log Storage
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS room_chat_messages (
  id            SERIAL PRIMARY KEY,
  room_id       TEXT NOT NULL,
  sender_email  TEXT NOT NULL,
  sender_name   TEXT NOT NULL,
  sender_role   TEXT NOT NULL,
  message_text  TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_room_chat_messages_room_id ON room_chat_messages (room_id);
CREATE INDEX idx_room_chat_messages_sent_at ON room_chat_messages (room_id, sent_at);

-- ═══════════════════════════════════════════════════════════════
-- 2. YouTube Playlists
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS youtube_playlists (
  id            SERIAL PRIMARY KEY,
  batch_id      TEXT REFERENCES batches(batch_id) ON DELETE SET NULL,
  subject       TEXT NOT NULL,
  month_key     TEXT NOT NULL,           -- e.g. '2026-03'
  playlist_id   TEXT NOT NULL,           -- YouTube playlist ID
  playlist_url  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_youtube_playlists_lookup ON youtube_playlists (batch_id, subject, month_key);

-- ═══════════════════════════════════════════════════════════════
-- 3. Batch Type Extensions: one_to_five + lecture
-- ═══════════════════════════════════════════════════════════════

-- batches table
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_batch_type_check;
ALTER TABLE batches ADD CONSTRAINT batches_batch_type_check
  CHECK (batch_type IN ('one_to_one', 'one_to_three', 'one_to_five', 'one_to_many', 'lecture', 'custom'));

-- batch_sessions table (only if batch_type column exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_sessions' AND column_name = 'batch_type') THEN
    EXECUTE 'ALTER TABLE batch_sessions DROP CONSTRAINT IF EXISTS batch_sessions_batch_type_check';
    EXECUTE 'ALTER TABLE batch_sessions ADD CONSTRAINT batch_sessions_batch_type_check CHECK (batch_type IN (''one_to_one'', ''one_to_three'', ''one_to_five'', ''one_to_many'', ''lecture'', ''custom''))';
  END IF;
END $$;

-- user_preferences table (only if it exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
    EXECUTE 'ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_batch_type_pref_check';
    EXECUTE 'ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_batch_type_pref_check CHECK (batch_type_pref IN (''one_to_one'', ''one_to_three'', ''one_to_five'', ''one_to_many'', ''lecture''))';
  END IF;
END $$;
