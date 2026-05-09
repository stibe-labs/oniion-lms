-- Migration 085: Add skip_payment_gate flag to batch_students
-- When true, the student bypasses session payment checks entirely
-- and can join any live session in the batch without being prompted to pay.

ALTER TABLE batch_students
  ADD COLUMN IF NOT EXISTS skip_payment_gate BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN batch_students.skip_payment_gate IS
  'When TRUE the student is exempt from payment gate checks and can join any live session directly.';
