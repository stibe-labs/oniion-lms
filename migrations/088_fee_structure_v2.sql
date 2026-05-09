-- Migration 088: Fee structure v2 — early bird offer, per-class flag, new batch types
-- Adds early bird fee, offer label, offer expiry, and per-class-only display flag.
-- Also expands allowed batch_type and fee_unit values.

-- ── New columns on enrollment_fee_structure ──────────────────

ALTER TABLE enrollment_fee_structure
  ADD COLUMN IF NOT EXISTS early_bird_fee_paise   INT,
  ADD COLUMN IF NOT EXISTS offer_label            TEXT,
  ADD COLUMN IF NOT EXISTS offer_expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS show_per_class_only    BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN enrollment_fee_structure.early_bird_fee_paise IS
  'Offer/early-bird per-class fee in paise. Shown as the active price when offer is not expired.';
COMMENT ON COLUMN enrollment_fee_structure.offer_label IS
  'Label for the offer, e.g. "Launching Offer" or "Early Bird".';
COMMENT ON COLUMN enrollment_fee_structure.offer_expires_at IS
  'When the offer ends. NULL = no expiry. Once expired, fee_paise (annual) becomes the active rate.';
COMMENT ON COLUMN enrollment_fee_structure.show_per_class_only IS
  'When TRUE, display per-class rate only — never show totals. Auto-set for one_to_one and one_to_three.';

-- ── Expand batch_type CHECK constraint ───────────────────────

ALTER TABLE enrollment_fee_structure
  DROP CONSTRAINT IF EXISTS enrollment_fee_structure_batch_type_check;

ALTER TABLE enrollment_fee_structure
  ADD CONSTRAINT enrollment_fee_structure_batch_type_check
  CHECK (batch_type IN (
    'one_to_one', 'one_to_three', 'one_to_five',
    'one_to_many', 'one_to_fifteen', 'one_to_thirty',
    'lecture', 'improvement_batch', 'custom'
  ));

-- ── Expand fee_unit CHECK constraint ─────────────────────────

ALTER TABLE enrollment_fee_structure
  DROP CONSTRAINT IF EXISTS enrollment_fee_structure_fee_unit_check;

ALTER TABLE enrollment_fee_structure
  ADD CONSTRAINT enrollment_fee_structure_fee_unit_check
  CHECK (fee_unit IN ('session', 'per_class', 'monthly', 'year', 'annual', 'manual'));

-- ── Auto-set show_per_class_only for existing 1:1 and 1:3 rows ──

UPDATE enrollment_fee_structure
  SET show_per_class_only = TRUE
  WHERE batch_type IN ('one_to_one', 'one_to_three');

-- ── Seed AY 2026-27 fee data from PDF ────────────────────────
-- fee_paise       = annual / original per-class fee (shown crossed out)
-- early_bird_paise = early bird / launching offer per-class fee (shown as active price)
-- offer_expires_at left NULL — owner sets expiry via dashboard UI

INSERT INTO enrollment_fee_structure
  (academic_year, region_group, board, batch_type, grade,
   fee_paise, early_bird_fee_paise, fee_unit, currency,
   show_per_class_only, offer_label, is_active)
VALUES
  -- 1:1 Kerala CBSE
  ('2026-27','Kerala','CBSE','one_to_one','8',  80000,  70000,'per_class','INR',true,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_one','9',  90000,  80000,'per_class','INR',true,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_one','10',100000,  90000,'per_class','INR',true,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_one','11',110000, 100000,'per_class','INR',true,'Launching Offer',true),

  -- 1:3 Kerala CBSE
  ('2026-27','Kerala','CBSE','one_to_three','8', 55000, 45000,'per_class','INR',true,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_three','9', 60000, 50000,'per_class','INR',true,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_three','10',65000, 55000,'per_class','INR',true,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_three','11',70000, 60000,'per_class','INR',true,'Launching Offer',true),

  -- 1:15 Kerala CBSE (monthly)
  ('2026-27','Kerala','CBSE','one_to_fifteen','8', 450000,400000,'monthly','INR',false,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_fifteen','9', 550000,500000,'monthly','INR',false,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_fifteen','10',650000,600000,'monthly','INR',false,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_fifteen','11',650000,600000,'monthly','INR',false,'Launching Offer',true),

  -- 1:30 Kerala CBSE (monthly, HSS only)
  ('2026-27','Kerala','CBSE','one_to_thirty','11',350000,300000,'monthly','INR',false,'Launching Offer',true),

  -- 1:Many (lecture) Kerala CBSE (monthly)
  ('2026-27','Kerala','CBSE','one_to_many','8', 120000,110000,'monthly','INR',false,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_many','9', 125000,115000,'monthly','INR',false,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_many','10',135000,120000,'monthly','INR',false,'Launching Offer',true),
  ('2026-27','Kerala','CBSE','one_to_many','11',155000,140000,'monthly','INR',false,'Launching Offer',true),

  -- 1:1 GCC CBSE
  ('2026-27','GCC','CBSE','one_to_one','8',  80000,  70000,'per_class','AED',true,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_one','9',  90000,  80000,'per_class','AED',true,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_one','10',100000,  90000,'per_class','AED',true,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_one','11',110000, 100000,'per_class','AED',true,'Launching Offer',true),

  -- 1:3 GCC CBSE
  ('2026-27','GCC','CBSE','one_to_three','8', 55000, 45000,'per_class','AED',true,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_three','9', 60000, 50000,'per_class','AED',true,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_three','10',65000, 55000,'per_class','AED',true,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_three','11',70000, 60000,'per_class','AED',true,'Launching Offer',true),

  -- 1:15 GCC CBSE (monthly)
  ('2026-27','GCC','CBSE','one_to_fifteen','8', 450000,400000,'monthly','AED',false,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_fifteen','9', 550000,500000,'monthly','AED',false,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_fifteen','10',650000,600000,'monthly','AED',false,'Launching Offer',true),
  ('2026-27','GCC','CBSE','one_to_fifteen','11',650000,600000,'monthly','AED',false,'Launching Offer',true)

ON CONFLICT (academic_year, region_group, board, batch_type, grade)
DO UPDATE SET
  fee_paise            = EXCLUDED.fee_paise,
  early_bird_fee_paise = EXCLUDED.early_bird_fee_paise,
  fee_unit             = EXCLUDED.fee_unit,
  show_per_class_only  = EXCLUDED.show_per_class_only,
  offer_label          = EXCLUDED.offer_label,
  is_active            = true;
