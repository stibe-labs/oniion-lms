-- Migration 013: Demo Session Requests
-- Allows AO to generate demo links for prospective students.
-- Students register via public link → matched teacher gets notified →
-- teacher accepts → 30-min demo room created → student joins for free.

CREATE TABLE IF NOT EXISTS demo_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_link_id      TEXT NOT NULL UNIQUE,              -- short ID for the public URL /demo/<linkId>
  
  -- Student info (filled on registration)
  student_email     TEXT,
  student_name      TEXT,
  student_phone     TEXT,
  student_grade     TEXT,
  
  -- Session details (filled on registration)
  subject           TEXT,
  portions          TEXT,                               -- topics/portions the student wants to cover
  sample_portions   TEXT[],                             -- pre-selected sample portions
  
  -- Teacher assignment
  teacher_email     TEXT,                               -- matched teacher
  teacher_name      TEXT,
  
  -- Status chain: link_created → submitted → pending_teacher → accepted → live → completed
  --               also: rejected, expired, cancelled
  status            TEXT NOT NULL DEFAULT 'link_created'
    CHECK (status IN (
      'link_created',        -- AO generated the link, student hasn't registered yet
      'submitted',           -- student registered, system is matching teacher
      'pending_teacher',     -- request sent to teacher, awaiting response
      'accepted',            -- teacher accepted, demo room created
      'live',                -- demo session is live
      'completed',           -- demo session ended
      'rejected',            -- teacher rejected
      'expired',             -- link or request expired
      'cancelled'            -- AO cancelled
    )),
  
  -- Room & scheduling
  room_id           TEXT REFERENCES rooms(room_id) ON DELETE SET NULL,
  scheduled_start   TIMESTAMPTZ,                       -- when the demo session is scheduled
  duration_minutes  INT NOT NULL DEFAULT 30,           -- demo sessions are 30 min
  
  -- Admin
  ao_email          TEXT,                               -- AO who created the link
  
  -- Teacher response
  teacher_responded_at  TIMESTAMPTZ,
  teacher_note          TEXT,
  
  -- Tracking
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ                        -- link expiry (e.g. 48 hours after creation)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_demo_requests_link_id ON demo_requests(demo_link_id);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_teacher ON demo_requests(teacher_email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_ao ON demo_requests(ao_email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_student_email ON demo_requests(student_email);
