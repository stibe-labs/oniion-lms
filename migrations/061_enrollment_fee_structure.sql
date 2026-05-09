-- Migration 061: Enrollment fee structure + enhanced enrollment links
-- New table for 2026-27 fee schedule with region/board/batch_type granularity
-- + extra columns on enrollment_links for full student profile

-- ── 1. New table: enrollment_fee_structure ──────────────────

CREATE TABLE IF NOT EXISTS enrollment_fee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2026-27',
  region_group  TEXT NOT NULL,          -- 'GCC' | 'Kerala'
  board         TEXT NOT NULL,          -- 'CBSE' | 'State Board'
  batch_type    TEXT NOT NULL,          -- one_to_one | one_to_three | one_to_many | one_to_thirty | lecture
  grade         TEXT NOT NULL,          -- '8' | '9' | '10' | '11' | '12'
  fee_paise     INT  NOT NULL,
  fee_unit      TEXT NOT NULL DEFAULT 'session', -- 'session' | 'year'
  currency      TEXT NOT NULL DEFAULT 'INR',
  is_active     BOOL NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year, region_group, board, batch_type, grade)
);

-- ── 2. Seed all 50 rows ────────────────────────────────────

-- GCC CBSE — 1:1 (session)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'GCC', 'CBSE', 'one_to_one', '8',  70000,  'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_one', '9',  80000,  'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_one', '10', 90000,  'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_one', '11', 100000, 'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_one', '12', 100000, 'session');

-- GCC CBSE — 1:3 (session)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'GCC', 'CBSE', 'one_to_three', '8',  45000,  'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_three', '9',  50000,  'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_three', '10', 55000,  'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_three', '11', 60000,  'session'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_three', '12', 60000,  'session');

-- GCC CBSE — 1:15 (year)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'GCC', 'CBSE', 'one_to_many', '8',  4000000, 'year'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_many', '9',  5000000, 'year'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_many', '10', 6000000, 'year'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_many', '11', 6000000, 'year'),
  ('2026-27', 'GCC', 'CBSE', 'one_to_many', '12', 6000000, 'year');

-- KERALA CBSE — 1:1 (session)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'Kerala', 'CBSE', 'one_to_one', '8',  70000,  'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_one', '9',  80000,  'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_one', '10', 90000,  'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_one', '11', 100000, 'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_one', '12', 100000, 'session');

-- KERALA CBSE — 1:3 (session)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'Kerala', 'CBSE', 'one_to_three', '8',  45000,  'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_three', '9',  50000,  'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_three', '10', 55000,  'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_three', '11', 60000,  'session'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_three', '12', 60000,  'session');

-- KERALA CBSE — 1:30 (year)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'Kerala', 'CBSE', 'one_to_thirty', '8',  3000000, 'year'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_thirty', '9',  3300000, 'year'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_thirty', '10', 3600000, 'year'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_thirty', '11', 3900000, 'year'),
  ('2026-27', 'Kerala', 'CBSE', 'one_to_thirty', '12', 3900000, 'year');

-- KERALA STATE — 1:1 (session)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'Kerala', 'State Board', 'one_to_one', '8',  70000,  'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_one', '9',  80000,  'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_one', '10', 90000,  'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_one', '11', 100000, 'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_one', '12', 100000, 'session');

-- KERALA STATE — 1:3 (session)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'Kerala', 'State Board', 'one_to_three', '8',  45000,  'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_three', '9',  50000,  'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_three', '10', 55000,  'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_three', '11', 60000,  'session'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_three', '12', 60000,  'session');

-- KERALA STATE — 1:15 (year)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'Kerala', 'State Board', 'one_to_many', '8',  2000000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_many', '9',  2500000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_many', '10', 3000000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_many', '11', 3000000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'one_to_many', '12', 3000000, 'year');

-- KERALA STATE — 1:50-1:100 Lecture (year)
INSERT INTO enrollment_fee_structure (academic_year, region_group, board, batch_type, grade, fee_paise, fee_unit) VALUES
  ('2026-27', 'Kerala', 'State Board', 'lecture', '8',  1100000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'lecture', '9',  1150000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'lecture', '10', 1200000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'lecture', '11', 1400000, 'year'),
  ('2026-27', 'Kerala', 'State Board', 'lecture', '12', 1400000, 'year');

-- ── 3. Add profile columns to enrollment_links ─────────────

ALTER TABLE enrollment_links
  ADD COLUMN IF NOT EXISTS student_whatsapp       TEXT,
  ADD COLUMN IF NOT EXISTS student_dob            TEXT,
  ADD COLUMN IF NOT EXISTS student_section        TEXT,
  ADD COLUMN IF NOT EXISTS student_board          TEXT,
  ADD COLUMN IF NOT EXISTS student_region         TEXT,
  ADD COLUMN IF NOT EXISTS student_parent_name    TEXT,
  ADD COLUMN IF NOT EXISTS student_parent_email   TEXT,
  ADD COLUMN IF NOT EXISTS student_parent_phone   TEXT,
  ADD COLUMN IF NOT EXISTS preferred_batch_type   TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_region_group TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_category    TEXT;
