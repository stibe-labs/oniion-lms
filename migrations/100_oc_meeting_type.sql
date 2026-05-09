-- Migration 100: Add meeting_type to open_classrooms
-- Used by Owner Meetings tab (templates: staff/parents/batch/student/custom)
ALTER TABLE open_classrooms
  ADD COLUMN IF NOT EXISTS meeting_type TEXT;

CREATE INDEX IF NOT EXISTS idx_oc_meeting_type
  ON open_classrooms (meeting_type)
  WHERE meeting_type IS NOT NULL;
