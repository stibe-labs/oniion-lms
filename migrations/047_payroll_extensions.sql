-- ────────────────────────────────────────────────────────────
-- 047 — Payroll Extensions: extension tracking + payslips updated_at
-- ────────────────────────────────────────────────────────────

-- Add updated_at to payslips (referenced by upsert in generatePayslips)
ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Track extension pay in payslips
ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS extension_sessions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extension_paise INT NOT NULL DEFAULT 0;
