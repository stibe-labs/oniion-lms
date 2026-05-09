-- ═══════════════════════════════════════════════════════════════
-- Migration 072: Open Classrooms
-- AO-managed open teaching sessions with public join links,
-- real TeacherView/StudentView UI, and optional paid entry.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS open_classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Ownership
  created_by TEXT NOT NULL,
  teacher_email TEXT NOT NULL REFERENCES portal_users(email),

  -- Tokens (public links)
  host_token TEXT NOT NULL UNIQUE,
  join_token TEXT NOT NULL UNIQUE,

  -- LiveKit
  livekit_room_name TEXT,
  room_id TEXT,

  -- Scheduling
  classroom_type TEXT NOT NULL DEFAULT 'instant',
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 60,

  -- Payment
  payment_enabled BOOLEAN DEFAULT FALSE,
  price_paise INT DEFAULT 0,
  currency TEXT DEFAULT 'INR',

  -- Status: created | live | ended | cancelled
  status TEXT NOT NULL DEFAULT 'created',
  max_participants INT DEFAULT 100,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS open_classroom_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES open_classrooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'student',

  -- Payment tracking
  payment_status TEXT DEFAULT 'exempt',
  invoice_id UUID REFERENCES invoices(id),
  paid_at TIMESTAMPTZ,

  -- Session tracking
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS open_classroom_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES open_classrooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oc_host_token ON open_classrooms(host_token);
CREATE INDEX IF NOT EXISTS idx_oc_join_token ON open_classrooms(join_token);
CREATE INDEX IF NOT EXISTS idx_oc_teacher ON open_classrooms(teacher_email);
CREATE INDEX IF NOT EXISTS idx_oc_created_by ON open_classrooms(created_by);
CREATE INDEX IF NOT EXISTS idx_oc_status ON open_classrooms(status);
CREATE INDEX IF NOT EXISTS idx_oc_participants_cid ON open_classroom_participants(classroom_id);
CREATE INDEX IF NOT EXISTS idx_oc_participants_email ON open_classroom_participants(email);
CREATE INDEX IF NOT EXISTS idx_oc_shares_cid ON open_classroom_shares(classroom_id);
