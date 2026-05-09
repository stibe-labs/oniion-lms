-- Migration 092: Normalize HSS grades in enrollment_fee_structure
-- HSS covers both Class 11 and Class 12. Consolidate grade='11' rows to grade='HSS'.

-- Remove any pre-existing 'HSS' rows that would conflict when '11'/'12' rows are renamed
DELETE FROM enrollment_fee_structure efs_hss
WHERE efs_hss.grade = 'HSS'
  AND EXISTS (
    SELECT 1 FROM enrollment_fee_structure efs_src
    WHERE efs_src.grade IN ('11', '12')
      AND efs_src.academic_year  = efs_hss.academic_year
      AND efs_src.region_group   = efs_hss.region_group
      AND efs_src.board          = efs_hss.board
      AND efs_src.batch_type     = efs_hss.batch_type
  );

UPDATE enrollment_fee_structure
SET grade = 'HSS'
WHERE grade IN ('11', '12');

-- Update the unique constraint to use the new grade values
-- (conflict target stays the same — just the stored value changes)
