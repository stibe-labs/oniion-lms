-- Migration 026: Teacher Reports — students report teachers from live classroom
-- Categories: sexual_abuse, inappropriate_behaviour, bad_performance, 
--   doubt_not_cleared, abusive_language, discrimination, unprofessional_conduct, other

CREATE TABLE teacher_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL,
  batch_id        TEXT,
  student_email   TEXT NOT NULL,
  student_name    TEXT,
  teacher_email   TEXT NOT NULL,
  teacher_name    TEXT,
  category        TEXT NOT NULL CHECK (category IN (
    'sexual_abuse','inappropriate_behaviour','bad_performance',
    'doubt_not_cleared','abusive_language','discrimination',
    'unprofessional_conduct','other'
  )),
  description     TEXT NOT NULL DEFAULT '',
  severity        TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low','medium','high','critical')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','dismissed')),
  assigned_to     TEXT,
  resolution      TEXT,
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  notified_roles  TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teacher_reports_room     ON teacher_reports (room_id);
CREATE INDEX idx_teacher_reports_teacher  ON teacher_reports (teacher_email);
CREATE INDEX idx_teacher_reports_student  ON teacher_reports (student_email);
CREATE INDEX idx_teacher_reports_status   ON teacher_reports (status);
CREATE INDEX idx_teacher_reports_category ON teacher_reports (category);
CREATE INDEX idx_teacher_reports_created  ON teacher_reports (created_at DESC);
