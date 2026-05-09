-- Migration 103: Allow manual (external) teachers in open_classrooms
-- teacher_email is no longer required — external teachers have no portal account

ALTER TABLE open_classrooms
  ALTER COLUMN teacher_email DROP NOT NULL;

ALTER TABLE open_classrooms
  ADD COLUMN IF NOT EXISTS teacher_name_manual TEXT,
  ADD COLUMN IF NOT EXISTS teacher_whatsapp_manual TEXT;
