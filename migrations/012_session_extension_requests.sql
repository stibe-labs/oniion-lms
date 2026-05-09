-- Migration 012: Session Extension Requests
-- Allows students to request additional time during live sessions
-- Approval chain: Student → Teacher → Batch Coordinator
-- On approval: extends session + generates overdue invoice

CREATE TABLE IF NOT EXISTS session_extension_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             TEXT NOT NULL REFERENCES rooms(room_id),
  batch_session_id    TEXT REFERENCES batch_sessions(session_id),
  batch_id            TEXT REFERENCES batches(batch_id),

  -- Who requested
  student_email       TEXT NOT NULL,
  student_name        TEXT,

  -- Extension details
  requested_minutes   INT NOT NULL CHECK (requested_minutes IN (30, 60, 120)),
  reason              TEXT,

  -- Approval chain: student → teacher → coordinator
  status              TEXT NOT NULL DEFAULT 'pending_teacher'
    CHECK (status IN (
      'pending_teacher',       -- waiting for teacher approval
      'teacher_approved',      -- teacher said yes, waiting for coordinator
      'pending_coordinator',   -- forwarded to coordinator
      'approved',              -- both approved, session extended
      'rejected_by_teacher',   -- teacher said no
      'rejected_by_coordinator', -- coordinator said no
      'expired',               -- no response in time
      'cancelled'              -- student cancelled
    )),

  teacher_email       TEXT,
  teacher_responded_at TIMESTAMPTZ,
  teacher_note        TEXT,

  coordinator_email   TEXT,
  coordinator_responded_at TIMESTAMPTZ,
  coordinator_note    TEXT,

  -- Result
  original_duration   INT,            -- original duration_minutes
  extended_duration   INT,            -- new total duration_minutes after extension
  invoice_id          UUID REFERENCES invoices(id),
  extension_fee_paise INT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ext_req_room ON session_extension_requests(room_id);
CREATE INDEX idx_ext_req_status ON session_extension_requests(status);
CREATE INDEX idx_ext_req_student ON session_extension_requests(student_email);
CREATE INDEX idx_ext_req_teacher ON session_extension_requests(teacher_email);
