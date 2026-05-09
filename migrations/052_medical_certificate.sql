-- Migration 052: Medical Certificate & Salary Adjustment for Sick Leave
-- Teachers can upload medical certificates; HR decides salary impact
-- ═══════════════════════════════════════════════════════════════

-- 1. Add medical certificate columns to leave requests
ALTER TABLE teacher_leave_requests
  ADD COLUMN IF NOT EXISTS medical_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS medical_certificate_name TEXT,
  ADD COLUMN IF NOT EXISTS salary_adjustment TEXT;

-- 2. Add constraint for salary_adjustment values
ALTER TABLE teacher_leave_requests
  DROP CONSTRAINT IF EXISTS teacher_leave_requests_salary_adjustment_check;

ALTER TABLE teacher_leave_requests
  ADD CONSTRAINT teacher_leave_requests_salary_adjustment_check
  CHECK (salary_adjustment IS NULL OR salary_adjustment IN ('full_pay', 'half_pay', 'no_pay'));

-- 3. Add medical leave adjustment to payslips
ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS medical_leave_adjustment_paise INT DEFAULT 0;
