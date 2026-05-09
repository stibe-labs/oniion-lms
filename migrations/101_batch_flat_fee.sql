-- Migration 101: Batch-flat fee type + payment gate on enrollment_fee_structure
-- Adds support for one-time flat batch fees (special/improvement batches)
-- with optional classroom entry gate enforcement.

-- ── Normalize legacy 'year' fee_unit to 'annual' ─────────────────────────────
UPDATE enrollment_fee_structure SET fee_unit = 'annual' WHERE fee_unit = 'year';

-- ── Add new columns ──────────────────────────────────────────────────────────
ALTER TABLE enrollment_fee_structure
  ADD COLUMN IF NOT EXISTS fee_type TEXT NOT NULL DEFAULT 'enrollment',
  ADD COLUMN IF NOT EXISTS batch_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_gate_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── Expand fee_unit constraint to allow 'batch_flat' ─────────────────────────
ALTER TABLE enrollment_fee_structure
  DROP CONSTRAINT IF EXISTS enrollment_fee_structure_fee_unit_check;

ALTER TABLE enrollment_fee_structure
  ADD CONSTRAINT enrollment_fee_structure_fee_unit_check
  CHECK (fee_unit IN ('per_class', 'monthly', 'annual', 'session', 'batch_flat'));

-- ── Expand batch_type constraint to allow 'special' ──────────────────────────
ALTER TABLE enrollment_fee_structure
  DROP CONSTRAINT IF EXISTS enrollment_fee_structure_batch_type_check;

ALTER TABLE enrollment_fee_structure
  ADD CONSTRAINT enrollment_fee_structure_batch_type_check
  CHECK (batch_type IN (
    'one_to_one', 'one_to_three', 'one_to_fifteen', 'one_to_many',
    'one_to_thirty', 'lecture', 'improvement_batch', 'custom', 'special', 'all'
  ));

-- ── Index for fast gate lookups ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_efs_fee_type_gate
  ON enrollment_fee_structure (fee_type, payment_gate_enabled, is_active);

-- ── Add batch_flat_fee_id to invoices for tracking flat-fee payments ─────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS batch_flat_fee_id UUID REFERENCES enrollment_fee_structure(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_batch_flat_fee_id
  ON invoices (batch_flat_fee_id)
  WHERE batch_flat_fee_id IS NOT NULL;
