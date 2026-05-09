-- Tracks students waiting in the lobby (before teacher goes live).
-- Students heartbeat via the /room/join polling loop; stale rows are harmless.
CREATE TABLE IF NOT EXISTS lobby_presence (
  room_id     TEXT        NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  user_email  TEXT        NOT NULL,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_email)
);
