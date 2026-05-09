-- Migration 097: Expand batch_type CHECK constraint to include one_to_fifteen, one_to_thirty, improvement_batch
-- Previously only: one_to_one, one_to_three, one_to_five, one_to_many, lecture, custom

ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_batch_type_check;
ALTER TABLE batches ADD CONSTRAINT batches_batch_type_check
  CHECK (batch_type = ANY (ARRAY[
    'one_to_one',
    'one_to_three',
    'one_to_five',
    'one_to_fifteen',
    'one_to_thirty',
    'one_to_many',
    'lecture',
    'custom',
    'improvement_batch'
  ]));
