-- Migration 039: Support selective extension (per-student)
-- Tracks original room duration before any extension is applied
-- so the system can kick non-extension students at original end time.

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS original_duration_minutes INT;

COMMENT ON COLUMN rooms.original_duration_minutes IS
  'Stores original duration before first extension. Used to selectively end non-extension students.';
