-- Migration 096: Add batch_session_id to open_classrooms
-- Allows CRM-created guest OC records to be linked to a scheduled batch session
-- so that when the session goes live the OC is automatically activated.

ALTER TABLE open_classrooms
  ADD COLUMN IF NOT EXISTS batch_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_oc_batch_session
  ON open_classrooms (batch_session_id)
  WHERE batch_session_id IS NOT NULL;
