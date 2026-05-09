-- Migration 010: Schedule Group — Combined Session Invoicing
-- Instead of 1 invoice per session per student, group all sessions
-- scheduled together into a single combined invoice per student.

-- 1. Group sessions scheduled together
ALTER TABLE batch_sessions
  ADD COLUMN IF NOT EXISTS schedule_group_id TEXT;

-- 2. Combined invoice references the group (replaces per-session batch_session_id)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS schedule_group_id TEXT;

-- 3. Fast lookup by schedule_group_id
CREATE INDEX IF NOT EXISTS idx_batch_sessions_schedule_group
  ON batch_sessions (schedule_group_id)
  WHERE schedule_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_schedule_group
  ON invoices (schedule_group_id)
  WHERE schedule_group_id IS NOT NULL;

-- 4. Unique: one combined invoice per student per schedule group
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_schedule_group_student
  ON invoices (schedule_group_id, student_email)
  WHERE schedule_group_id IS NOT NULL;
