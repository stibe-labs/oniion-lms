-- ═══════════════════════════════════════════════════════════════
-- stibe Portal — Initial Migration
-- Creates all 47 tables, indexes, triggers, and foreign keys.
-- Source of truth: Production schema as of Feb 27, 2026
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Helper functions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_user_profiles_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


-- ═════════════════════════════════════════════════════════════
-- 1. CORE TABLES
-- ═════════════════════════════════════════════════════════════

-- ── School Config ────────────────────────────────────────────
CREATE TABLE school_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Academic Settings ────────────────────────────────────────
CREATE TABLE academic_settings (
  setting_key    TEXT PRIMARY KEY,
  setting_values TEXT[] NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Session Config ───────────────────────────────────────────
CREATE TABLE session_config (
  id                       SERIAL PRIMARY KEY,
  max_sessions_per_day     INT NOT NULL DEFAULT 4,
  default_duration_minutes INT NOT NULL DEFAULT 90,
  teaching_minutes         INT NOT NULL DEFAULT 75,
  prep_buffer_minutes      INT NOT NULL DEFAULT 15,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Branches ─────────────────────────────────────────────────
CREATE TABLE branches (
  branch_id    TEXT PRIMARY KEY DEFAULT 'BR-' || substr(gen_random_uuid()::text, 1, 8),
  branch_name  TEXT NOT NULL,
  branch_code  TEXT NOT NULL UNIQUE,
  address      TEXT,
  city         TEXT,
  state        TEXT,
  phone        TEXT,
  email        TEXT,
  manager_email TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  max_rooms    INT DEFAULT 20,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Portal Users ─────────────────────────────────────────────
CREATE TABLE portal_users (
  email              TEXT PRIMARY KEY,
  full_name          TEXT NOT NULL,
  portal_role        TEXT NOT NULL CHECK (portal_role IN (
                       'teacher','teacher_screen','student','batch_coordinator',
                       'academic_operator','academic','hr','parent','owner','ghost'
                     )),
  phone              TEXT,
  profile_image      TEXT,
  batch_ids          TEXT[] DEFAULT '{}',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_hash      TEXT,
  branch_id          TEXT REFERENCES branches(branch_id),
  plain_password     TEXT,
  custom_permissions JSONB NOT NULL DEFAULT '{}'
);

-- ── User Profiles ────────────────────────────────────────────
CREATE TABLE user_profiles (
  email            TEXT PRIMARY KEY REFERENCES portal_users(email) ON DELETE CASCADE,
  phone            TEXT,
  whatsapp         TEXT,
  date_of_birth    DATE,
  address          TEXT,
  qualification    TEXT,
  notes            TEXT,
  subjects         TEXT[],
  experience_years INT,
  grade            TEXT,
  section          TEXT,
  board            TEXT,
  parent_email     TEXT,
  admission_date   DATE,
  assigned_region  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  per_hour_rate    INT
);


-- ═════════════════════════════════════════════════════════════
-- 2. BATCH SYSTEM
-- ═════════════════════════════════════════════════════════════

-- ── Batches ──────────────────────────────────────────────────
CREATE TABLE batches (
  batch_id                TEXT PRIMARY KEY DEFAULT 'batch_' || substr(gen_random_uuid()::text, 1, 12),
  batch_name              TEXT NOT NULL,
  batch_type              TEXT NOT NULL DEFAULT 'one_to_many' CHECK (batch_type IN ('one_to_one','one_to_three','one_to_many','custom')),
  grade                   TEXT,
  board                   TEXT,
  coordinator_email       TEXT,
  max_students            INT NOT NULL DEFAULT 50,
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  notes                   TEXT,
  created_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subjects                TEXT[],
  section                 TEXT,
  academic_operator_email TEXT
);

-- ── Batch Students ───────────────────────────────────────────
CREATE TABLE batch_students (
  id            SERIAL PRIMARY KEY,
  batch_id      TEXT NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  parent_email  TEXT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, student_email)
);

-- ── Batch Teachers ───────────────────────────────────────────
CREATE TABLE batch_teachers (
  id            SERIAL PRIMARY KEY,
  batch_id      TEXT NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  teacher_email TEXT NOT NULL,
  subject       TEXT NOT NULL,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, subject)
);

-- ── Batch Sessions ───────────────────────────────────────────
CREATE TABLE batch_sessions (
  session_id           TEXT PRIMARY KEY DEFAULT 'sess_' || substr(gen_random_uuid()::text, 1, 12),
  batch_id             TEXT NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  subject              TEXT NOT NULL,
  teacher_email        TEXT,
  teacher_name         TEXT,
  scheduled_date       DATE NOT NULL,
  start_time           TIME NOT NULL,
  duration_minutes     INT NOT NULL DEFAULT 90,
  teaching_minutes     INT NOT NULL DEFAULT 75,
  prep_buffer_minutes  INT NOT NULL DEFAULT 15,
  status               TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  livekit_room_name    TEXT,
  topic                TEXT,
  notes                TEXT,
  started_at           TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  cancel_reason        TEXT,
  created_by           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Admission Requests ───────────────────────────────────────
CREATE TABLE admission_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name       TEXT NOT NULL,
  student_email      TEXT NOT NULL,
  parent_name        TEXT,
  parent_email       TEXT,
  parent_phone       TEXT,
  grade              TEXT NOT NULL,
  subjects           TEXT[] DEFAULT '{}',
  board              TEXT,
  batch_type_pref    TEXT DEFAULT 'one_to_many' CHECK (batch_type_pref IN ('one_to_one','one_to_three','one_to_many')),
  status             TEXT NOT NULL DEFAULT 'enquiry' CHECK (status IN ('enquiry','registered','fee_confirmed','allocated','active','rejected')),
  fee_structure_id   UUID,
  allocated_batch_id TEXT,
  notes              TEXT,
  processed_by       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═════════════════════════════════════════════════════════════
-- 3. ROOM & SESSION SYSTEM
-- ═════════════════════════════════════════════════════════════

-- ── Rooms ────────────────────────────────────────────────────
CREATE TABLE rooms (
  room_id            TEXT PRIMARY KEY,
  room_name          TEXT NOT NULL,
  subject            TEXT NOT NULL,
  grade              TEXT NOT NULL,
  section            TEXT,
  coordinator_email  TEXT NOT NULL,
  teacher_email      TEXT,
  status             TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  scheduled_start    TIMESTAMPTZ NOT NULL,
  duration_minutes   INT NOT NULL CHECK (duration_minutes > 0),
  open_at            TIMESTAMPTZ NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  ended_at           TIMESTAMPTZ,
  max_participants   INT DEFAULT 50,
  fee_paise          INT DEFAULT 0 CHECK (fee_paise >= 0),
  notes_for_teacher  TEXT,
  reminder_sent_at   TIMESTAMPTZ,
  livekit_room_id    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  egress_id          TEXT,
  recording_url      TEXT,
  recording_status   TEXT DEFAULT 'none',
  session_fee_paise  INT DEFAULT 0,
  payment_required   BOOLEAN DEFAULT FALSE,
  batch_type         TEXT DEFAULT 'one_to_many',
  class_portion      TEXT,
  class_remarks      TEXT,
  created_by         TEXT,
  batch_id           TEXT,
  batch_session_id   TEXT
);

-- ── Room Assignments ─────────────────────────────────────────
CREATE TABLE room_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id              TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  participant_type     TEXT NOT NULL CHECK (participant_type IN ('teacher','student')),
  participant_email    TEXT NOT NULL,
  participant_name     TEXT NOT NULL,
  frappe_user_id       TEXT,
  join_token           TEXT,
  device_preference    TEXT DEFAULT 'desktop' CHECK (device_preference IN ('desktop','tablet')),
  notification_sent_at TIMESTAMPTZ,
  joined_at            TIMESTAMPTZ,
  left_at              TIMESTAMPTZ,
  payment_status       TEXT NOT NULL DEFAULT 'unknown' CHECK (payment_status IN ('paid','unpaid','exempt','scholarship','unknown')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_verified     BOOLEAN DEFAULT FALSE,
  session_invoice_id   UUID,
  UNIQUE (room_id, participant_email)
);

-- ── Room Events ──────────────────────────────────────────────
CREATE TABLE room_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL CHECK (event_type IN (
                      'room_created','room_started','room_ended_by_teacher','room_expired','room_cancelled',
                      'participant_joined','participant_left','payment_completed','notification_sent','reminder_sent',
                      'recording_started','recording_stopped','attention_update','exam_started','exam_submitted',
                      'teacher_joined','teacher_left','go_live','attendance_marked','attendance_update',
                      'recording_completed','recording_failed','contact_violation','contact_violation_detected',
                      'student_feedback','class_portion_updated','class_remarks_updated',
                      'cancellation_requested','cancellation_approved','cancellation_rejected',
                      'rejoin_requested','rejoin_approved','rejoin_denied',
                      'fee_payment_confirmed','fee_payment','admission_status_change',
                      'session_report_generated','parent_report_generated','monitoring_alert',
                      'teacher_camera_toggle','student_attention_low','class_report_generated'
                    )),
  participant_email TEXT,
  participant_role  TEXT,
  payload           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Rejoin Requests ──────────────────────────────────────────
CREATE TABLE rejoin_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       TEXT NOT NULL REFERENCES rooms(room_id),
  student_email TEXT NOT NULL,
  teacher_email TEXT,
  decision      TEXT CHECK (decision IN ('approved','denied','pending')),
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Cancellation Requests ────────────────────────────────────
CREATE TABLE cancellation_requests (
  id                 SERIAL PRIMARY KEY,
  room_id            TEXT NOT NULL,
  requested_by       TEXT NOT NULL,
  requester_role     TEXT,
  reason             TEXT,
  cancellation_type  TEXT NOT NULL DEFAULT 'parent_initiated' CHECK (cancellation_type IN ('parent_initiated','group_request','teacher_initiated','policy')),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','coordinator_approved','admin_approved','academic_approved','hr_approved','approved','rejected')),
  coordinator_decision TEXT,
  coordinator_email    TEXT,
  coordinator_at       TIMESTAMPTZ,
  admin_decision       TEXT,
  admin_email          TEXT,
  admin_at             TIMESTAMPTZ,
  academic_decision    TEXT,
  academic_email       TEXT,
  academic_at          TIMESTAMPTZ,
  hr_decision          TEXT,
  hr_email             TEXT,
  hr_at                TIMESTAMPTZ,
  rejection_reason     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Session Requests ─────────────────────────────────────────
CREATE TABLE session_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type        TEXT NOT NULL CHECK (request_type IN ('reschedule','cancel')),
  requester_email     TEXT NOT NULL,
  requester_role      TEXT NOT NULL CHECK (requester_role IN ('student','parent')),
  batch_session_id    TEXT,
  batch_id            TEXT,
  room_id             TEXT,
  reason              TEXT NOT NULL,
  proposed_date       DATE,
  proposed_time       TIME,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reviewed_by         TEXT,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  notifications_sent  BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Student Availability ─────────────────────────────────────
CREATE TABLE student_availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  batch_id      TEXT,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  preference    TEXT DEFAULT 'available' CHECK (preference IN ('available','preferred','unavailable')),
  notes         TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Teacher Leave Requests ───────────────────────────────────
CREATE TABLE teacher_leave_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email       TEXT NOT NULL,
  leave_type          TEXT NOT NULL CHECK (leave_type IN ('sick','personal','emergency','planned','other')),
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  reason              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  ao_status           TEXT DEFAULT 'pending' CHECK (ao_status IN ('pending','approved','rejected','skipped')),
  ao_reviewed_by      TEXT,
  ao_reviewed_at      TIMESTAMPTZ,
  ao_notes            TEXT,
  hr_status           TEXT DEFAULT 'pending' CHECK (hr_status IN ('pending','approved','rejected','skipped')),
  hr_reviewed_by      TEXT,
  hr_reviewed_at      TIMESTAMPTZ,
  hr_notes            TEXT,
  owner_status        TEXT DEFAULT 'pending' CHECK (owner_status IN ('pending','approved','rejected','skipped')),
  owner_reviewed_by   TEXT,
  owner_reviewed_at   TIMESTAMPTZ,
  owner_notes         TEXT,
  affected_sessions   TEXT[] DEFAULT '{}',
  substitute_teacher  TEXT,
  notifications_sent  BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═════════════════════════════════════════════════════════════
-- 4. ATTENDANCE & MONITORING
-- ═════════════════════════════════════════════════════════════

-- ── Attendance Sessions ──────────────────────────────────────
CREATE TABLE attendance_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  participant_email   TEXT NOT NULL,
  participant_name    TEXT NOT NULL,
  participant_role    TEXT NOT NULL DEFAULT 'student' CHECK (participant_role IN ('student','teacher')),
  first_join_at       TIMESTAMPTZ,
  last_leave_at       TIMESTAMPTZ,
  total_duration_sec  INT DEFAULT 0,
  join_count          INT DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present','absent','late','left_early','excused')),
  late_join           BOOLEAN NOT NULL DEFAULT FALSE,
  late_by_sec         INT DEFAULT 0,
  leave_approved      BOOLEAN,
  leave_reason        TEXT,
  teacher_remarks     TEXT,
  engagement_score    SMALLINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mic_off_count       INT DEFAULT 0,
  camera_off_count    INT DEFAULT 0,
  leave_request_count INT DEFAULT 0,
  attention_avg       SMALLINT,
  UNIQUE (room_id, participant_email)
);

-- ── Attendance Logs ──────────────────────────────────────────
CREATE TABLE attendance_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  participant_email TEXT NOT NULL,
  participant_name  TEXT,
  participant_role  TEXT,
  event_type        TEXT NOT NULL CHECK (event_type IN (
                      'join','leave','rejoin','leave_request','leave_approved','leave_denied',
                      'late_join','kicked','mic_off','mic_on','camera_off','camera_on','attention_report'
                    )),
  event_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload           JSONB
);

-- ── Contact Violations ───────────────────────────────────────
CREATE TABLE contact_violations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  sender_email     TEXT NOT NULL,
  sender_name      TEXT,
  sender_role      TEXT,
  message_text     TEXT NOT NULL,
  detected_pattern TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  notified         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Class Monitoring Events ──────────────────────────────────
CREATE TABLE class_monitoring_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          TEXT NOT NULL,
  session_id       UUID,
  student_email    TEXT NOT NULL,
  student_name     TEXT,
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'attentive','looking_away','eyes_closed','not_in_frame','low_engagement',
                     'hand_raised','speaking','distracted','phone_detected','multiple_faces'
                   )),
  confidence       SMALLINT DEFAULT 100,
  duration_seconds INT DEFAULT 0,
  details          JSONB DEFAULT '{}',
  snapshot_url     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Monitoring Alerts ────────────────────────────────────────
CREATE TABLE monitoring_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT,
  session_id          UUID,
  batch_id            UUID,
  alert_type          TEXT NOT NULL CHECK (alert_type IN (
                        'teacher_absent','teacher_camera_off','class_started_late','class_cancelled',
                        'low_attendance','student_sleeping','student_not_looking','student_left_frame',
                        'student_distracted','class_disruption','contact_violation','phone_detected','unusual_leave'
                      )),
  severity            TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  target_email        TEXT,
  notify_coordinator  BOOLEAN DEFAULT TRUE,
  notify_ao           BOOLEAN DEFAULT TRUE,
  notify_teacher      BOOLEAN DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','resolved','escalated')),
  dismissed_by        TEXT,
  dismissed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Monitoring Reports ───────────────────────────────────────
CREATE TABLE monitoring_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type     TEXT NOT NULL CHECK (report_type IN ('student_daily','student_weekly','student_monthly','teacher_daily','teacher_weekly','teacher_monthly')),
  report_period   TEXT NOT NULL CHECK (report_period IN ('daily','weekly','monthly')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  target_email    TEXT NOT NULL,
  target_role     TEXT NOT NULL CHECK (target_role IN ('student','teacher')),
  target_name     TEXT,
  batch_id        UUID,
  batch_name      TEXT,
  grade           TEXT,
  section         TEXT,
  metrics         JSONB NOT NULL DEFAULT '{}',
  sent_to_parent  BOOLEAN DEFAULT FALSE,
  parent_email    TEXT,
  sent_at         TIMESTAMPTZ,
  generated_by    TEXT DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Session Ratings ──────────────────────────────────────────
CREATE TABLE session_ratings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       TEXT NOT NULL,
  student_email    TEXT NOT NULL,
  teacher_email    TEXT NOT NULL,
  batch_id         TEXT,
  punctuality      SMALLINT CHECK (punctuality BETWEEN 1 AND 5),
  teaching_quality SMALLINT CHECK (teaching_quality BETWEEN 1 AND 5),
  communication    SMALLINT CHECK (communication BETWEEN 1 AND 5),
  overall          SMALLINT CHECK (overall BETWEEN 1 AND 5),
  comment          TEXT,
  is_anonymous     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_email)
);

-- ── Student Feedback ─────────────────────────────────────────
CREATE TABLE student_feedback (
  id                     SERIAL PRIMARY KEY,
  room_id                TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  student_email          TEXT NOT NULL,
  student_name           TEXT NOT NULL DEFAULT '',
  rating                 SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text          TEXT DEFAULT '',
  tags                   TEXT DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attendance_confirmed   BOOLEAN NOT NULL DEFAULT FALSE
);


-- ═════════════════════════════════════════════════════════════
-- 5. EXAM SYSTEM
-- ═════════════════════════════════════════════════════════════

-- ── Exams ────────────────────────────────────────────────────
CREATE TABLE exams (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  subject           TEXT NOT NULL,
  grade             TEXT NOT NULL,
  exam_type         TEXT NOT NULL DEFAULT 'online' CHECK (exam_type IN ('online','offline')),
  duration_minutes  INT NOT NULL CHECK (duration_minutes > 0),
  passing_marks     INT NOT NULL DEFAULT 0 CHECK (passing_marks >= 0),
  total_marks       INT NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
  scheduled_at      TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  published         BOOLEAN DEFAULT FALSE,
  results_published BOOLEAN DEFAULT FALSE,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Exam Questions ───────────────────────────────────────────
CREATE TABLE exam_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        UUID REFERENCES exams(id) ON DELETE SET NULL,
  question_text  TEXT NOT NULL,
  question_type  TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq','descriptive')),
  options        JSONB,
  correct_answer INT,
  marks          INT NOT NULL DEFAULT 1,
  difficulty     TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  topic          TEXT,
  subject        TEXT,
  grade          TEXT,
  sort_order     INT DEFAULT 0,
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Exam Attempts ────────────────────────────────────────────
CREATE TABLE exam_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  student_name  TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ,
  score         INT,
  total_marks   INT,
  percentage    NUMERIC(5,2),
  grade_letter  TEXT,
  status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','graded','expired')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_email)
);

-- ── Exam Answers ─────────────────────────────────────────────
CREATE TABLE exam_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  selected_option INT,
  text_answer     TEXT,
  is_correct      BOOLEAN,
  marks_awarded   INT DEFAULT 0,
  UNIQUE (attempt_id, question_id)
);

-- ── Exam Batch Assignments ───────────────────────────────────
CREATE TABLE exam_batch_assignments (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  UNIQUE (exam_id, room_id)
);


-- ═════════════════════════════════════════════════════════════
-- 6. PAYMENT & INVOICING
-- ═════════════════════════════════════════════════════════════

-- ── Fee Structures ───────────────────────────────────────────
CREATE TABLE fee_structures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type        TEXT NOT NULL CHECK (batch_type IN ('one_to_one','one_to_three','one_to_many')),
  grade             TEXT,
  subject           TEXT,
  amount_paise      INT NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','AED','SAR','QAR','KWD','OMR','BHD','USD')),
  billing_period    TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','quarterly','yearly')),
  registration_fee  INT DEFAULT 0,
  security_deposit  INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Session Fee Rates ────────────────────────────────────────
CREATE TABLE session_fee_rates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           TEXT REFERENCES batches(batch_id) ON DELETE CASCADE,
  subject            TEXT,
  grade              TEXT,
  per_hour_rate_paise INT NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','AED','SAR','QAR','KWD','OMR','BHD','USD')),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  notes              TEXT,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Invoices ─────────────────────────────────────────────────
CREATE TABLE invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   TEXT NOT NULL UNIQUE,
  student_email    TEXT NOT NULL,
  parent_email     TEXT,
  description      TEXT,
  billing_period   TEXT NOT NULL DEFAULT 'monthly',
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  amount_paise     INT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','AED','SAR','QAR','KWD','OMR','BHD','USD')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled','refunded')),
  due_date         DATE NOT NULL,
  paid_at          TIMESTAMPTZ,
  payment_method   TEXT,
  transaction_id   TEXT,
  gateway_order_id TEXT,
  pdf_url          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Session Payments ─────────────────────────────────────────
CREATE TABLE session_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL,
  student_email   TEXT NOT NULL,
  parent_email    TEXT,
  invoice_id      UUID REFERENCES invoices(id),
  amount_paise    INT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at         TIMESTAMPTZ,
  payment_method  TEXT,
  transaction_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, student_email)
);

-- ── Payment Attempts ─────────────────────────────────────────
CREATE TABLE payment_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         TEXT NOT NULL UNIQUE,
  room_id          TEXT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  student_email    TEXT NOT NULL,
  student_frappe_id TEXT,
  amount_paise     INT NOT NULL CHECK (amount_paise > 0),
  status           TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','completed','failed','pending','fraud_attempt')),
  transaction_id   TEXT,
  initiated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  raw_callback     JSONB
);

-- ── Payment Receipts ─────────────────────────────────────────
CREATE TABLE payment_receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number   TEXT NOT NULL UNIQUE,
  invoice_id       UUID REFERENCES invoices(id),
  student_email    TEXT NOT NULL,
  amount_paise     INT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'INR',
  payment_method   TEXT,
  transaction_id   TEXT,
  gateway_response JSONB,
  pdf_url          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═════════════════════════════════════════════════════════════
-- 7. PAYROLL
-- ═════════════════════════════════════════════════════════════

-- ── Payroll Periods ──────────────────────────────────────────
CREATE TABLE payroll_periods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','paid')),
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payslips ─────────────────────────────────────────────────
CREATE TABLE payslips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  teacher_email     TEXT NOT NULL,
  teacher_name      TEXT,
  classes_conducted INT NOT NULL DEFAULT 0,
  classes_missed    INT NOT NULL DEFAULT 0,
  classes_cancelled INT NOT NULL DEFAULT 0,
  rate_per_class    INT NOT NULL,
  base_pay_paise    INT NOT NULL DEFAULT 0,
  incentive_paise   INT DEFAULT 0,
  lop_paise         INT DEFAULT 0,
  total_paise       INT NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'INR',
  notes             TEXT,
  pdf_url           TEXT,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','paid')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_period_id, teacher_email)
);

-- ── Teacher Pay Config ───────────────────────────────────────
CREATE TABLE teacher_pay_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_email   TEXT NOT NULL UNIQUE,
  rate_per_class  INT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  incentive_rules JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═════════════════════════════════════════════════════════════
-- 8. NOTIFICATIONS & LOGS
-- ═════════════════════════════════════════════════════════════

-- ── Email Log ────────────────────────────────────────────────
CREATE TABLE email_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          TEXT REFERENCES rooms(room_id) ON DELETE SET NULL,
  recipient_email  TEXT NOT NULL,
  template_type    TEXT NOT NULL CHECK (template_type IN (
                     'teacher_invite','student_invite','room_reminder','room_cancelled','room_rescheduled',
                     'payment_confirmation','coordinator_summary',
                     'batch_coordinator_notify','batch_teacher_notify','batch_student_notify','batch_parent_notify',
                     'daily_timetable','session_reminder','weekly_timetable','weekly_timetable_auto',
                     'session_request_submitted','session_request_approved','session_request_rejected',
                     'session_rescheduled_notify','session_cancelled_notify','availability_submitted',
                     'leave_request_submitted','leave_request_approved','leave_request_rejected','leave_sessions_affected',
                     'invoice_generated','payment_receipt','payslip_notification','payment_reminder','credentials'
                   )),
  subject          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  smtp_message_id  TEXT,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ
);

-- ── Notification Log ─────────────────────────────────────────
CREATE TABLE notification_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel    TEXT NOT NULL CHECK (channel IN ('whatsapp','email','push')),
  recipient  TEXT NOT NULL,
  template   TEXT NOT NULL,
  payload    JSONB,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','delivered')),
  sent_at    TIMESTAMPTZ,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Generated Reports ────────────────────────────────────────
CREATE TABLE generated_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type  TEXT NOT NULL CHECK (report_type IN (
                 'daily_business_summary','weekly_sales','monthly_academic','monthly_revenue',
                 'teacher_performance','session_report','parent_monthly',
                 'student_daily_monitoring','student_weekly_monitoring','student_monthly_monitoring',
                 'teacher_daily_monitoring','teacher_weekly_monitoring','teacher_monthly_monitoring',
                 'class_session_monitoring'
               )),
  title        TEXT NOT NULL,
  period_start DATE,
  period_end   DATE,
  generated_by TEXT,
  data         JSONB NOT NULL DEFAULT '{}',
  pdf_url      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Parent Complaints ────────────────────────────────────────
CREATE TABLE parent_complaints (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_email TEXT NOT NULL,
  student_email TEXT,
  subject      TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','teaching','fee','facility','behaviour','academic','other')),
  description  TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to  TEXT,
  resolution   TEXT,
  resolved_at  TIMESTAMPTZ,
  resolved_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Teaching Materials ───────────────────────────────────────
CREATE TABLE teaching_materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      TEXT REFERENCES batches(batch_id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  material_type TEXT NOT NULL DEFAULT 'notes',
  uploaded_by   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_size     BIGINT,
  mime_type     TEXT
);


-- ═════════════════════════════════════════════════════════════
-- 9. INDEXES
-- ═════════════════════════════════════════════════════════════

-- Portal users
CREATE INDEX idx_portal_users_role          ON portal_users (portal_role);
CREATE INDEX idx_portal_users_active        ON portal_users (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_portal_users_batch         ON portal_users USING gin (batch_ids);
CREATE INDEX idx_portal_users_branch        ON portal_users (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_portal_users_custom_perms  ON portal_users USING gin (custom_permissions) WHERE custom_permissions <> '{}';

-- User profiles
CREATE INDEX idx_user_profiles_parent_email ON user_profiles (parent_email) WHERE parent_email IS NOT NULL;
CREATE INDEX idx_user_profiles_subjects     ON user_profiles USING gin (subjects) WHERE subjects IS NOT NULL;

-- Branches
CREATE INDEX idx_branches_active  ON branches (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_branches_city    ON branches (city);
CREATE INDEX idx_branches_manager ON branches (manager_email) WHERE manager_email IS NOT NULL;

-- Batches
CREATE INDEX idx_batches_status      ON batches (status);
CREATE INDEX idx_batches_type        ON batches (batch_type);
CREATE INDEX idx_batches_coordinator ON batches (coordinator_email);

-- Batch students / teachers
CREATE INDEX idx_batch_students_batch   ON batch_students (batch_id);
CREATE INDEX idx_batch_students_student ON batch_students (student_email);
CREATE INDEX idx_batch_teachers_batch   ON batch_teachers (batch_id);
CREATE INDEX idx_batch_teachers_teacher ON batch_teachers (teacher_email);

-- Batch sessions
CREATE INDEX idx_bsess_batch   ON batch_sessions (batch_id);
CREATE INDEX idx_bsess_date    ON batch_sessions (scheduled_date);
CREATE INDEX idx_bsess_status  ON batch_sessions (status);
CREATE INDEX idx_bsess_teacher ON batch_sessions (teacher_email);
CREATE INDEX idx_bsess_livekit ON batch_sessions (livekit_room_name);

-- Admission requests
CREATE INDEX idx_admission_email  ON admission_requests (student_email);
CREATE INDEX idx_admission_status ON admission_requests (status);

-- Rooms
CREATE INDEX idx_rooms_status           ON rooms (status);
CREATE INDEX idx_rooms_scheduled_start  ON rooms (scheduled_start);
CREATE INDEX idx_rooms_expires_at       ON rooms (expires_at);
CREATE INDEX idx_rooms_coordinator      ON rooms (coordinator_email);
CREATE INDEX idx_rooms_recording        ON rooms (recording_status);
CREATE INDEX idx_rooms_batch_id         ON rooms (batch_id);
CREATE INDEX idx_rooms_batch_session_id ON rooms (batch_session_id);

-- Room assignments / events
CREATE INDEX idx_assignments_room_id ON room_assignments (room_id);
CREATE INDEX idx_assignments_email   ON room_assignments (participant_email);
CREATE INDEX idx_assignments_payment ON room_assignments (room_id, payment_status);
CREATE INDEX idx_room_events_room_id ON room_events (room_id);
CREATE INDEX idx_room_events_created ON room_events (created_at DESC);

-- Cancellation requests
CREATE INDEX idx_cancel_req_room   ON cancellation_requests (room_id);
CREATE INDEX idx_cancel_req_status ON cancellation_requests (status);
CREATE INDEX idx_cancel_req_by     ON cancellation_requests (requested_by);

-- Session requests / availability / leave
CREATE INDEX idx_session_requests_requester ON session_requests (requester_email);
CREATE INDEX idx_session_requests_status    ON session_requests (status);
CREATE INDEX idx_session_requests_batch     ON session_requests (batch_id);
CREATE INDEX idx_student_availability_student ON student_availability (student_email);
CREATE INDEX idx_student_availability_batch   ON student_availability (batch_id);
CREATE UNIQUE INDEX idx_student_availability_unique ON student_availability (student_email, COALESCE(batch_id, ''), day_of_week, start_time) WHERE is_active = TRUE;
CREATE INDEX idx_teacher_leave_teacher ON teacher_leave_requests (teacher_email);
CREATE INDEX idx_teacher_leave_status  ON teacher_leave_requests (status);
CREATE INDEX idx_teacher_leave_dates   ON teacher_leave_requests (start_date, end_date);

-- Attendance
CREATE INDEX idx_att_sess_room   ON attendance_sessions (room_id);
CREATE INDEX idx_att_sess_email  ON attendance_sessions (participant_email);
CREATE INDEX idx_att_sess_status ON attendance_sessions (room_id, status);
CREATE INDEX idx_att_log_room    ON attendance_logs (room_id);
CREATE INDEX idx_att_log_email   ON attendance_logs (participant_email);
CREATE INDEX idx_att_log_event_at ON attendance_logs (event_at DESC);

-- Contact violations
CREATE INDEX idx_cv_room   ON contact_violations (room_id);
CREATE INDEX idx_cv_sender ON contact_violations (sender_email);

-- Monitoring
CREATE INDEX idx_mon_events_room    ON class_monitoring_events (room_id);
CREATE INDEX idx_mon_events_session ON class_monitoring_events (session_id);
CREATE INDEX idx_mon_events_student ON class_monitoring_events (student_email);
CREATE INDEX idx_mon_events_type    ON class_monitoring_events (event_type);
CREATE INDEX idx_mon_events_created ON class_monitoring_events (created_at);
CREATE INDEX idx_mon_alerts_room    ON monitoring_alerts (room_id);
CREATE INDEX idx_mon_alerts_type    ON monitoring_alerts (alert_type);
CREATE INDEX idx_mon_alerts_status  ON monitoring_alerts (status);
CREATE INDEX idx_mon_alerts_batch   ON monitoring_alerts (batch_id);
CREATE INDEX idx_mon_alerts_created ON monitoring_alerts (created_at);
CREATE INDEX idx_mon_reports_type   ON monitoring_reports (report_type);
CREATE INDEX idx_mon_reports_target ON monitoring_reports (target_email);
CREATE INDEX idx_mon_reports_batch  ON monitoring_reports (batch_id);
CREATE INDEX idx_mon_reports_period ON monitoring_reports (period_start, period_end);

-- Ratings / feedback
CREATE INDEX idx_ratings_session ON session_ratings (session_id);
CREATE INDEX idx_ratings_teacher ON session_ratings (teacher_email);
CREATE INDEX idx_ratings_batch   ON session_ratings (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_student_feedback_room    ON student_feedback (room_id);
CREATE INDEX idx_student_feedback_student ON student_feedback (student_email);
CREATE UNIQUE INDEX idx_student_feedback_unique ON student_feedback (room_id, student_email);

-- Exams
CREATE INDEX idx_exams_subject_grade  ON exams (subject, grade);
CREATE INDEX idx_exams_created_by     ON exams (created_by);
CREATE INDEX idx_exam_questions_exam    ON exam_questions (exam_id);
CREATE INDEX idx_exam_questions_subject ON exam_questions (subject, grade);
CREATE INDEX idx_exam_attempts_exam    ON exam_attempts (exam_id);
CREATE INDEX idx_exam_attempts_student ON exam_attempts (student_email);
CREATE INDEX idx_exam_answers_attempt  ON exam_answers (attempt_id);

-- Payment & invoicing
CREATE INDEX idx_fee_structures_active  ON fee_structures (is_active);
CREATE INDEX idx_sfr_batch   ON session_fee_rates (batch_id);
CREATE INDEX idx_sfr_subject ON session_fee_rates (subject);
CREATE INDEX idx_sfr_active  ON session_fee_rates (is_active);
CREATE INDEX idx_invoices_student ON invoices (student_email);
CREATE INDEX idx_invoices_parent  ON invoices (parent_email);
CREATE INDEX idx_invoices_status  ON invoices (status);
CREATE INDEX idx_invoices_due     ON invoices (due_date);
CREATE INDEX idx_sp_room    ON session_payments (room_id);
CREATE INDEX idx_sp_student ON session_payments (student_email);
CREATE INDEX idx_sp_status  ON session_payments (status);
CREATE INDEX idx_sp_invoice ON session_payments (invoice_id);
CREATE INDEX idx_payment_order_id      ON payment_attempts (order_id);
CREATE INDEX idx_payment_room_student  ON payment_attempts (room_id, student_email);
CREATE INDEX idx_receipts_student ON payment_receipts (student_email);
CREATE INDEX idx_receipts_invoice ON payment_receipts (invoice_id);

-- Payroll
CREATE INDEX idx_payslips_period  ON payslips (payroll_period_id);
CREATE INDEX idx_payslips_teacher ON payslips (teacher_email);
CREATE INDEX idx_teacher_pay_config_email ON teacher_pay_config (teacher_email);

-- Notifications
CREATE INDEX idx_email_log_room_id ON email_log (room_id);
CREATE INDEX idx_email_log_status  ON email_log (status);
CREATE INDEX idx_notif_channel   ON notification_log (channel);
CREATE INDEX idx_notif_recipient ON notification_log (recipient);
CREATE INDEX idx_notif_status    ON notification_log (status);

-- Reports
CREATE INDEX idx_reports_type  ON generated_reports (report_type);
CREATE INDEX idx_reports_dates ON generated_reports (period_start, period_end);

-- Complaints
CREATE INDEX idx_complaints_parent  ON parent_complaints (parent_email);
CREATE INDEX idx_complaints_student ON parent_complaints (student_email);
CREATE INDEX idx_complaints_status  ON parent_complaints (status);

-- Teaching materials
CREATE INDEX idx_teaching_materials_batch    ON teaching_materials (batch_id);
CREATE INDEX idx_teaching_materials_subject  ON teaching_materials (subject);
CREATE INDEX idx_teaching_materials_uploader ON teaching_materials (uploaded_by);

-- Rejoin
CREATE INDEX idx_rejoin_room ON rejoin_requests (room_id);


-- ═════════════════════════════════════════════════════════════
-- 10. TRIGGERS
-- ═════════════════════════════════════════════════════════════

CREATE TRIGGER trg_portal_users_updated_at       BEFORE UPDATE ON portal_users              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at       BEFORE UPDATE ON user_profiles             FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();
CREATE TRIGGER trg_branches_updated_at            BEFORE UPDATE ON branches                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_batches_updated_at             BEFORE UPDATE ON batches                   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_batch_sessions_updated_at      BEFORE UPDATE ON batch_sessions            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rooms_updated_at               BEFORE UPDATE ON rooms                     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attendance_sessions_updated_at BEFORE UPDATE ON attendance_sessions       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cancellation_requests_updated_at BEFORE UPDATE ON cancellation_requests   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER session_requests_updated           BEFORE UPDATE ON session_requests           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER student_availability_updated       BEFORE UPDATE ON student_availability       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER teacher_leave_updated              BEFORE UPDATE ON teacher_leave_requests     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_exams_updated_at               BEFORE UPDATE ON exams                     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fee_structures_updated_at      BEFORE UPDATE ON fee_structures            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_session_fee_rates_updated_at   BEFORE UPDATE ON session_fee_rates         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at            BEFORE UPDATE ON invoices                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_teacher_pay_updated_at         BEFORE UPDATE ON teacher_pay_config        FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═════════════════════════════════════════════════════════════
-- 11. SEED DATA
-- ═════════════════════════════════════════════════════════════

-- System room (required for room_events FK when logging system-level events)
INSERT INTO rooms (room_id, room_name, subject, grade, coordinator_email, teacher_email, status, scheduled_start, duration_minutes, open_at, expires_at)
VALUES ('system', 'System Events', 'system', 'N/A', 'system@stibelearning.online', NULL, 'ended',
        '2000-01-01T00:00:00Z', 1, '2000-01-01T00:00:00Z', '2000-01-01T00:01:00Z');

-- Default school config
INSERT INTO school_config (key, value, description) VALUES
  ('session_fee_paise',       '50000',  'Default fee per session in paise (₹500.00)'),
  ('lobby_open_before_mins',  '15',     'Minutes before session start when joins are allowed'),
  ('late_join_grace_mins',    '10',     'Grace period for late joins after session start'),
  ('livekit_url',             'wss://media.stibelearning.online', 'LiveKit WebSocket URL'),
  ('reminder_before_mins',    '30',     'Minutes before session to send email reminder')
ON CONFLICT (key) DO NOTHING;

-- Default session config
INSERT INTO session_config (max_sessions_per_day, default_duration_minutes, teaching_minutes, prep_buffer_minutes)
VALUES (4, 90, 75, 15)
ON CONFLICT DO NOTHING;
