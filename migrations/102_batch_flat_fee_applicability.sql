-- Migration 102: Add applicability arrays to enrollment_fee_structure for batch_flat fees
-- Allows specifying which grades, regions, and boards a special batch fee applies to
-- '["all"]' means applies to all values (default for existing rows)

ALTER TABLE enrollment_fee_structure
  ADD COLUMN IF NOT EXISTS applicable_grades   JSONB NOT NULL DEFAULT '["all"]',
  ADD COLUMN IF NOT EXISTS applicable_regions  JSONB NOT NULL DEFAULT '["all"]',
  ADD COLUMN IF NOT EXISTS applicable_boards   JSONB NOT NULL DEFAULT '["all"]';

-- Index for batch_flat fee lookup by batch_type
CREATE INDEX IF NOT EXISTS idx_efs_batch_flat_type
  ON enrollment_fee_structure (batch_type)
  WHERE fee_type = 'batch_flat' AND is_active = true;

COMMENT ON COLUMN enrollment_fee_structure.applicable_grades  IS 'JSONB array of applicable grades, e.g. ["8","9","10"]. ["all"] means all grades.';
COMMENT ON COLUMN enrollment_fee_structure.applicable_regions IS 'JSONB array of applicable region_groups, e.g. ["GCC","Kerala"]. ["all"] means all regions.';
COMMENT ON COLUMN enrollment_fee_structure.applicable_boards  IS 'JSONB array of applicable boards, e.g. ["CBSE","State Board"]. ["all"] means all boards.';
