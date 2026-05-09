-- Migration 036: Go-live approval workflow
-- Teacher must request "Go Live" and BC must approve before session can start
-- Adds go_live_status column to batch_sessions

ALTER TABLE batch_sessions ADD COLUMN IF NOT EXISTS go_live_status TEXT DEFAULT NULL
  CHECK (go_live_status IS NULL OR go_live_status IN ('pending','approved','denied'));
ALTER TABLE batch_sessions ADD COLUMN IF NOT EXISTS go_live_requested_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE batch_sessions ADD COLUMN IF NOT EXISTS go_live_decided_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE batch_sessions ADD COLUMN IF NOT EXISTS go_live_decided_by TEXT DEFAULT NULL;
