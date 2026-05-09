-- ═══════════════════════════════════════════════════════════════
-- Migration 056: Sales CRM Module
-- Adds 'sales' role, CRM tables for lead management,
-- activities, reminders, tags, and seeds initial data.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Add 'sales' to portal_role CHECK constraint ───────────
ALTER TABLE portal_users DROP CONSTRAINT IF EXISTS portal_users_portal_role_check;
ALTER TABLE portal_users ADD CONSTRAINT portal_users_portal_role_check
  CHECK (portal_role IN (
    'teacher','teacher_screen','student','batch_coordinator',
    'academic_operator','academic','hr','parent','owner','ghost',
    'sales'
  ));

-- ── 2. Seed sales user ──────────────────────────────────────
INSERT INTO portal_users (email, full_name, portal_role, is_active, password_hash)
VALUES (
  'sales@stibelearning.com',
  'Sales Team',
  'sales',
  TRUE,
  '$2b$10$6OFtPWKv79cL7MfRNqzxvOgtvbPAIoObBiwUE5yAj2EknRNqTwdB6'
)
ON CONFLICT (email) DO UPDATE SET
  portal_role = 'sales',
  is_active = TRUE;

-- ── 3. CRM Leads ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact info
  full_name         TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  whatsapp          TEXT,

  -- Student/academic info
  student_grade     TEXT,
  student_board     TEXT,
  subjects_interested TEXT[],
  batch_type_pref   TEXT,

  -- Lead metadata
  source            TEXT NOT NULL DEFAULT 'manual'
                    CHECK (source IN (
                      'manual','whatsapp_ctwa','facebook_lead','instagram_lead',
                      'demo_request','admission','website','referral',
                      'walkin','phone_call','other'
                    )),
  source_detail     TEXT,

  -- Ad tracking
  ad_id             TEXT,
  ad_name           TEXT,
  campaign_id       TEXT,
  form_id           TEXT,

  -- Pipeline
  pipeline_stage    TEXT NOT NULL DEFAULT 'new'
                    CHECK (pipeline_stage IN (
                      'new','contacted','interested','demo_scheduled',
                      'demo_completed','negotiation','enrolled','lost','disqualified'
                    )),

  -- Assignment & scoring
  assigned_to       TEXT REFERENCES portal_users(email),
  lead_score        INT DEFAULT 0,
  priority          TEXT DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','urgent')),
  tags              TEXT[] DEFAULT '{}',

  -- Lost lead tracking
  lost_reason       TEXT,

  -- Conversion tracking
  converted_at      TIMESTAMPTZ,
  student_email     TEXT,
  admission_id      UUID,
  demo_request_id   UUID,

  -- UTM tracking
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,

  -- Meta
  is_archived       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. CRM Activities (Interaction Log) ──────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,

  activity_type     TEXT NOT NULL
                    CHECK (activity_type IN (
                      'call','whatsapp_sent','whatsapp_received','email_sent',
                      'email_received','sms','meeting','demo_session','note',
                      'stage_change','status_change','follow_up','system'
                    )),

  title             TEXT NOT NULL,
  description       TEXT,
  outcome           TEXT,

  -- Call-specific
  call_duration_sec INT,
  call_direction    TEXT CHECK (call_direction IN ('inbound','outbound')),

  -- WhatsApp-specific
  wa_message_id     TEXT,

  performed_by      TEXT NOT NULL REFERENCES portal_users(email),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. CRM Reminders ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_reminders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID REFERENCES crm_leads(id) ON DELETE CASCADE,

  title             TEXT NOT NULL,
  description       TEXT,
  due_at            TIMESTAMPTZ NOT NULL,

  reminder_type     TEXT NOT NULL DEFAULT 'follow_up'
                    CHECK (reminder_type IN (
                      'follow_up','callback','demo_reminder','payment_follow','general'
                    )),

  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','snoozed','cancelled')),
  snoozed_until     TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,

  assigned_to       TEXT NOT NULL REFERENCES portal_users(email),
  created_by        TEXT NOT NULL REFERENCES portal_users(email),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. CRM Tags (Predefined) ────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  color             TEXT DEFAULT '#6B7280',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 7. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone       ON crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email       ON crm_leads(email);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage       ON crm_leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned    ON crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source      ON crm_leads(source);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created     ON crm_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_score       ON crm_leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead   ON crm_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_reminders_due     ON crm_reminders(due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_crm_reminders_user    ON crm_reminders(assigned_to) WHERE status = 'pending';

-- ── 8. Seed default tags ────────────────────────────────────
INSERT INTO crm_tags (name, color) VALUES
  ('hot-lead',           '#EF4444'),
  ('warm-lead',          '#F59E0B'),
  ('cold-lead',          '#3B82F6'),
  ('parent-enquiry',     '#8B5CF6'),
  ('student-enquiry',    '#10B981'),
  ('demo-attended',      '#06B6D4'),
  ('price-sensitive',    '#F97316'),
  ('competitive-exam',   '#EC4899'),
  ('referred',           '#14B8A6'),
  ('callback-requested', '#6366F1')
ON CONFLICT (name) DO NOTHING;
