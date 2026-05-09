-- Migration 090: Expand batch_type CHECK constraint to match fee structure
-- Adds: one_to_fifteen, one_to_thirty, improvement_batch

ALTER TABLE batches
  DROP CONSTRAINT IF EXISTS batches_batch_type_check;

ALTER TABLE batches
  ADD CONSTRAINT batches_batch_type_check
  CHECK (batch_type IN (
    'one_to_one', 'one_to_three', 'one_to_five',
    'one_to_fifteen', 'one_to_many', 'one_to_thirty',
    'lecture', 'improvement_batch', 'custom'
  ));

ALTER TABLE batch_sessions
  DROP CONSTRAINT IF EXISTS batch_sessions_batch_type_check;

ALTER TABLE batch_sessions
  ADD CONSTRAINT batch_sessions_batch_type_check
  CHECK (batch_type IN (
    'one_to_one', 'one_to_three', 'one_to_five',
    'one_to_fifteen', 'one_to_many', 'one_to_thirty',
    'lecture', 'improvement_batch', 'custom'
  ));
