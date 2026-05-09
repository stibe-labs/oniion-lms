-- Migration 087: Allow multiple teachers per subject per batch
-- Drops the UNIQUE(batch_id, subject) constraint and replaces it with
-- UNIQUE(batch_id, teacher_email, subject) so multiple teachers can share a subject.

-- Step 1: Remove the old unique constraint
ALTER TABLE batch_teachers DROP CONSTRAINT IF EXISTS batch_teachers_batch_id_subject_key;

-- Step 2: Add the new constraint (one teacher+subject combo per batch)
ALTER TABLE batch_teachers ADD CONSTRAINT batch_teachers_batch_id_teacher_email_subject_key
  UNIQUE (batch_id, teacher_email, subject);
