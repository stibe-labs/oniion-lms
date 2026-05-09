-- ════════════════════════════════════════════════════════════
-- Migration 108 — Demo Teacher Broadcast Invitations
-- Creates demo_invitations table and extends demo_requests with
-- join link fields for the 15-min-before delivery cron.
-- ════════════════════════════════════════════════════════════

-- Each demo broadcast generates one invitation row per teacher.
-- The first teacher to accept wins; all others get expired.
CREATE TABLE IF NOT EXISTS demo_invitations (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_request_id   UUID         NOT NULL REFERENCES demo_requests(id) ON DELETE CASCADE,
  teacher_email     TEXT         NOT NULL REFERENCES portal_users(email) ON DELETE CASCADE,
  invite_token      TEXT         NOT NULL UNIQUE,
  status            TEXT         NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'accepted', 'expired')),
  sent_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  accepted_at       TIMESTAMPTZ  NULL,
  expires_at        TIMESTAMPTZ  NOT NULL,  -- 24h window from send
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS demo_invitations_demo_request_idx ON demo_invitations(demo_request_id);
CREATE INDEX IF NOT EXISTS demo_invitations_teacher_idx ON demo_invitations(teacher_email);
CREATE INDEX IF NOT EXISTS demo_invitations_token_idx ON demo_invitations(invite_token);
CREATE INDEX IF NOT EXISTS demo_invitations_status_idx ON demo_invitations(status);

-- Extend demo_requests: track join link delivery + store computed join URLs
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS join_links_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS teacher_join_url TEXT NULL;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS student_join_url TEXT NULL;
ALTER TABLE demo_requests ADD COLUMN IF NOT EXISTS agent_join_url   TEXT NULL;
