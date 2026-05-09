-- ═══════════════════════════════════════════════════════════
-- 070: Academic Calendars — Calendar template storage
-- ═══════════════════════════════════════════════════════════

-- Master table: one row per (year, region, grade, board, category)
CREATE TABLE IF NOT EXISTS academic_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2026-27',
  region TEXT NOT NULL,
  grade TEXT NOT NULL,
  board TEXT NOT NULL,
  category TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_sessions INT NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}',
  source_file TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (academic_year, region, grade, board, category)
);

-- Individual sessions within a calendar
CREATE TABLE IF NOT EXISTS academic_calendar_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES academic_calendars(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  session_type TEXT NOT NULL,
  session_order INT NOT NULL DEFAULT 0,
  subject_session_number INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acs_calendar_id ON academic_calendar_sessions(calendar_id);
CREATE INDEX IF NOT EXISTS idx_acs_session_type ON academic_calendar_sessions(session_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acs_cal_date_order ON academic_calendar_sessions(calendar_id, session_date, session_order);

-- Audit log: tracks each auto-schedule run
CREATE TABLE IF NOT EXISTS calendar_schedule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES academic_calendars(id),
  batch_id TEXT NOT NULL REFERENCES batches(batch_id),
  schedule_group_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  sessions_created INT NOT NULL DEFAULT 0,
  special_sessions_created INT DEFAULT 0,
  time_slots JSONB NOT NULL DEFAULT '{}',
  teacher_map JSONB NOT NULL DEFAULT '{}',
  include_special_classes BOOLEAN DEFAULT TRUE,
  include_new_batch BOOLEAN DEFAULT FALSE,
  include_exam_special BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csr_batch ON calendar_schedule_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_csr_calendar ON calendar_schedule_runs(calendar_id);
