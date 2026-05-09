-- ────────────────────────────────────────────────────────────
-- 078 — Open Classroom Materials
-- Add open_classroom_id to teaching_materials so materials
-- can be attached to open classrooms (workshops/training).
-- ────────────────────────────────────────────────────────────

ALTER TABLE teaching_materials
  ADD COLUMN IF NOT EXISTS open_classroom_id UUID REFERENCES open_classrooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tm_oc ON teaching_materials (open_classroom_id) WHERE open_classroom_id IS NOT NULL;
