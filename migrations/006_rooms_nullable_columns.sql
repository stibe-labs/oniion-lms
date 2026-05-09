-- Migration 006: Make rooms.grade and rooms.subject nullable
-- Batches without a grade/subject assignment should not block room creation.
ALTER TABLE rooms ALTER COLUMN grade DROP NOT NULL;
ALTER TABLE rooms ALTER COLUMN subject DROP NOT NULL;
