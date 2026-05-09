-- ═══════════════════════════════════════════════════════════════
-- Migration 050: Individual payslip payment tracking
-- ═══════════════════════════════════════════════════════════════
-- Adds per-payslip payment metadata so HR can mark each teacher
-- as paid individually with UTR/reference and timestamp.
-- Period auto-transitions to 'paid' when all its payslips are paid.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS paid_by TEXT;
