-- Migration 092: Normalize HSS grades in enrollment_fee_structure
-- HSS covers both Class 11 and Class 12. Consolidate grade='11' rows to grade='HSS'.

UPDATE enrollment_fee_structure
SET grade = 'HSS'
WHERE grade IN ('11', '12');

-- Update the unique constraint to use the new grade values
-- (conflict target stays the same — just the stored value changes)
