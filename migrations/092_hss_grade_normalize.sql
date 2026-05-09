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

-- When both '11' and '12' exist for the same key group, both would become 'HSS' — keep one
DELETE FROM enrollment_fee_structure e1
WHERE e1.grade = '12'
  AND EXISTS (
    SELECT 1 FROM enrollment_fee_structure e2
    WHERE e2.grade = '11'
      AND e2.academic_year  = e1.academic_year
      AND e2.region_group   = e1.region_group
      AND e2.board          = e1.board
      AND e2.batch_type     = e1.batch_type
  );

UPDATE enrollment_fee_structure
SET grade = 'HSS'
WHERE grade IN ('11', '12');

-- Update the unique constraint to use the new grade values
-- (conflict target stays the same — just the stored value changes)
