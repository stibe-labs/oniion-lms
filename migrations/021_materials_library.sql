-- ────────────────────────────────────────────────────────────
-- 021 — Teaching Materials: Library + Multi-Batch Assignment
-- Moves from single-batch FK to a junction table so the same
-- material can be shared across multiple batches.
-- ────────────────────────────────────────────────────────────

-- 1. Add updated_at column
ALTER TABLE teaching_materials
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create junction table
CREATE TABLE IF NOT EXISTS material_batch_assignments (
  id          SERIAL PRIMARY KEY,
  material_id UUID    NOT NULL REFERENCES teaching_materials(id) ON DELETE CASCADE,
  batch_id    TEXT    NOT NULL REFERENCES batches(batch_id)      ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by TEXT,
  UNIQUE (material_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_mba_material ON material_batch_assignments (material_id);
CREATE INDEX IF NOT EXISTS idx_mba_batch    ON material_batch_assignments (batch_id);

-- 3. Migrate existing batch_id data into junction table
INSERT INTO material_batch_assignments (material_id, batch_id, assigned_by)
SELECT id, batch_id, uploaded_by
FROM   teaching_materials
WHERE  batch_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Drop old batch_id FK column (data is now in junction table)
ALTER TABLE teaching_materials DROP COLUMN IF EXISTS batch_id;
