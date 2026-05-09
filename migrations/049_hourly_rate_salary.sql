-- ═══════════════════════════════════════════════════════════════
-- Migration 049: Switch teacher salary from flat rate to hourly proration
-- ═══════════════════════════════════════════════════════════════
-- The per_hour_rate is stored in user_profiles (rupees INT, e.g. 900 = ₹900/hr).
-- teacher_session_earnings.rate_per_class → per_hour_rate_paise
-- Salary formula: base_paise = per_hour_rate_paise × (duration_minutes / 60)
-- ═══════════════════════════════════════════════════════════════

-- Rename the column to reflect hourly rate semantics
ALTER TABLE teacher_session_earnings
  RENAME COLUMN rate_per_class TO per_hour_rate_paise;
