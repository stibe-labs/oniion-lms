-- Migration 104: Mark temporary auto-created teacher accounts (for open classroom manual teachers)
ALTER TABLE portal_users
  ADD COLUMN IF NOT EXISTS is_temp_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_portal_users_temp ON portal_users (is_temp_account) WHERE is_temp_account = TRUE;
