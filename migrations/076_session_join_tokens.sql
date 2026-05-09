-- Migration 076: Session join tokens — pre-room direct-join links
-- Generated at session schedule time so WhatsApp links work before room exists.
-- Tokens are copied to room_assignments.join_token when the teacher starts the session.

CREATE TABLE IF NOT EXISTS session_join_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  participant_name  TEXT NOT NULL,
  participant_type  TEXT NOT NULL CHECK (participant_type IN ('teacher','student','batch_coordinator','parent')),
  join_token      TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, participant_email)
);

CREATE INDEX IF NOT EXISTS idx_sjt_token ON session_join_tokens(join_token);
CREATE INDEX IF NOT EXISTS idx_sjt_session ON session_join_tokens(session_id);
