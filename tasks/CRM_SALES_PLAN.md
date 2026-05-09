# stibe CRM & Sales Module — Implementation Plan

**Date:** 2025-03-23  
**Status:** Planning  
**Estimated Scope:** ~3,500 LOC (migration + API + dashboard + webhook)

---

## 1. Executive Summary

Add a **`sales`** role to stibe Portal with a full CRM dashboard for managing leads, tracking pipeline stages, logging interactions, setting reminders, and receiving real-time WhatsApp leads via Meta webhook. Integrates with the existing `demo_requests` and `admission_requests` tables as the upstream lead sources.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEAD SOURCES                                  │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ Facebook/IG  │ WhatsApp     │ Demo Session │ Manual Entry       │
│ Lead Ads     │ CTWA Ads     │ Requests     │ (Sales Dashboard)  │
│ (Instant     │ (Click-to-   │ (Existing    │                    │
│  Form)       │  WhatsApp)   │  System)     │                    │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│              /api/v1/webhook/meta                                │
│   Receives lead form submissions + WhatsApp message events      │
│   Verifies X-Hub-Signature-256 (HMAC SHA-256)                   │
│   Extracts: name, phone, email, source, ad_id, form_id         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     crm_leads TABLE                              │
│   id · name · phone · email · source · status · assigned_to     │
│   pipeline_stage · score · tags · utm · ad_data · created_at    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        crm_activities  crm_reminders  crm_notes
        (interactions)  (follow-ups)   (internal notes)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SALES DASHBOARD                                  │
│  /sales — 8 tabs                                                │
│  Overview · Leads · Pipeline · Activities · Reminders ·          │
│  WhatsApp · Reports · Settings                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Phases

### Phase 1: Foundation (Role + DB + Auth)
- [ ] Migration 056: Add `sales` role, create CRM tables
- [ ] Add `sales` to `portal_users` CHECK constraint
- [ ] Seed sales user: `sales@stibelearning.com` / `Test@1234`
- [ ] Update `lib/permissions.ts` — add `ROLE_DEFAULT_PERMISSIONS.sales`
- [ ] Update `lib/nav-config.ts` — add `ROLE_NAV.sales` with tabs
- [ ] Update `proxy.ts` — add `/sales` route protection
- [ ] Create `/app/(portal)/sales/page.tsx` (server component)
- [ ] Create `SalesDashboardClient.tsx` (client component shell)

### Phase 2: CRM Core (CRUD + Dashboard)
- [ ] Create `/api/v1/sales/dashboard/route.ts` — stats endpoint
- [ ] Create `/api/v1/sales/leads/route.ts` — lead CRUD
- [ ] Create `/api/v1/sales/activities/route.ts` — interaction log
- [ ] Create `/api/v1/sales/reminders/route.ts` — reminder CRUD
- [ ] Build dashboard tabs: Overview, Leads, Pipeline, Activities, Reminders
- [ ] Build lead detail panel with interaction timeline
- [ ] Build pipeline kanban view (drag-and-drop stages)

### Phase 3: Meta Webhook Integration
- [ ] Create `/api/v1/webhook/meta/route.ts` — verification + event handler
- [ ] Add `META_APP_SECRET` and `META_VERIFY_TOKEN` to env
- [ ] Register webhook URL in Meta App Dashboard
- [ ] Subscribe to `leadgen` (Instant Forms) + `messages` (CTWA) events
- [ ] Auto-create leads from webhook events
- [ ] WhatsApp quick-reply from sales dashboard

### Phase 4: Advanced Features
- [ ] Auto-import existing `demo_requests` as leads
- [ ] Auto-import existing `admission_requests` as leads
- [ ] Lead scoring algorithm (source + engagement + response time)
- [ ] Sales reports: conversion funnel, rep performance, source ROI
- [ ] WhatsApp template messages from CRM (follow-up, greeting, etc.)
- [ ] Email notifications for overdue reminders
- [ ] Owner dashboard: Sales team overview widget

---

## 4. Database Schema (Migration 056)

```sql
-- ═══════════════════════════════════════════════════════════════
-- Migration 056: Sales CRM Module
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Add 'sales' to portal_role CHECK constraint ───────────
ALTER TABLE portal_users DROP CONSTRAINT IF EXISTS portal_users_portal_role_check;
ALTER TABLE portal_users ADD CONSTRAINT portal_users_portal_role_check
  CHECK (portal_role IN (
    'teacher','teacher_screen','student','batch_coordinator',
    'academic_operator','academic','hr','parent','owner','ghost',
    'sales'
  ));

-- ── 2. CRM Leads ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact info
  full_name         TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  whatsapp          TEXT,                -- WhatsApp number (may differ from phone)
  
  -- Student/academic info (for education CRM)
  student_grade     TEXT,
  student_board     TEXT,                -- CBSE/ICSE/State
  subjects_interested TEXT[],            -- subjects they're looking for
  batch_type_pref   TEXT,                -- one_to_one, one_to_three, one_to_many
  
  -- Lead metadata
  source            TEXT NOT NULL DEFAULT 'manual'
                    CHECK (source IN (
                      'manual',          -- sales rep entered manually
                      'whatsapp_ctwa',   -- click-to-WhatsApp ad
                      'facebook_lead',   -- Facebook Instant Form
                      'instagram_lead',  -- Instagram Instant Form
                      'demo_request',    -- came from demo session
                      'admission',       -- came from admission request
                      'website',         -- website contact form
                      'referral',        -- referred by existing user
                      'walkin',          -- walk-in enquiry
                      'phone_call',      -- inbound phone call
                      'other'
                    )),
  source_detail     TEXT,                -- e.g., ad name, referrer name
  
  -- Ad tracking
  ad_id             TEXT,                -- Meta ad ID
  ad_name           TEXT,                -- Meta ad name (denormalized)
  campaign_id       TEXT,                -- Meta campaign ID
  form_id           TEXT,                -- Leadgen form ID
  
  -- Pipeline
  pipeline_stage    TEXT NOT NULL DEFAULT 'new'
                    CHECK (pipeline_stage IN (
                      'new',             -- just came in
                      'contacted',       -- first contact made
                      'interested',      -- showed interest
                      'demo_scheduled',  -- demo session booked
                      'demo_completed',  -- attended demo
                      'negotiation',     -- discussing fees/schedule
                      'enrolled',        -- signed up & fee paid
                      'lost',            -- didn't convert
                      'disqualified'     -- not a valid lead
                    )),
  
  -- Assignment & scoring
  assigned_to       TEXT REFERENCES portal_users(email),  -- sales rep
  lead_score        INT DEFAULT 0,       -- 0-100 score
  priority          TEXT DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags              TEXT[] DEFAULT '{}',  -- flexible tagging
  
  -- Lost lead tracking
  lost_reason       TEXT,                -- why they didn't convert
  
  -- Conversion tracking
  converted_at      TIMESTAMPTZ,         -- when they enrolled
  student_email     TEXT,                -- portal_users.email after conversion
  admission_id      UUID,                -- link to admission_requests.id
  demo_request_id   UUID,                -- link to demo_requests.id
  
  -- UTM tracking (from ad clicks)
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  
  -- Meta
  is_archived       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. CRM Activities (Interaction Log) ──────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  
  activity_type     TEXT NOT NULL
                    CHECK (activity_type IN (
                      'call',            -- phone call
                      'whatsapp_sent',   -- outbound WhatsApp message
                      'whatsapp_received', -- inbound WhatsApp message
                      'email_sent',      -- outbound email
                      'email_received',  -- inbound email
                      'sms',             -- SMS sent
                      'meeting',         -- in-person meeting
                      'demo_session',    -- attended demo session
                      'note',            -- internal note
                      'stage_change',    -- pipeline stage changed
                      'status_change',   -- lead status changed
                      'follow_up',       -- follow-up activity
                      'system'           -- auto-generated by system
                    )),
  
  title             TEXT NOT NULL,        -- short description
  description       TEXT,                 -- detailed notes
  outcome           TEXT,                 -- result of the activity
  
  -- Call-specific
  call_duration_sec INT,                  -- for calls: duration
  call_direction    TEXT CHECK (call_direction IN ('inbound', 'outbound')),
  
  -- WhatsApp-specific
  wa_message_id     TEXT,                 -- Meta message ID for tracking
  
  performed_by      TEXT NOT NULL REFERENCES portal_users(email),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. CRM Reminders ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_reminders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID REFERENCES crm_leads(id) ON DELETE CASCADE,  -- nullable for general reminders
  
  title             TEXT NOT NULL,
  description       TEXT,
  due_at            TIMESTAMPTZ NOT NULL,
  
  reminder_type     TEXT NOT NULL DEFAULT 'follow_up'
                    CHECK (reminder_type IN (
                      'follow_up',       -- follow up with lead
                      'callback',        -- call them back
                      'demo_reminder',   -- remind about demo
                      'payment_follow',  -- follow up on payment
                      'general'          -- generic reminder
                    )),
  
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'snoozed', 'cancelled')),
  snoozed_until     TIMESTAMPTZ,         -- if snoozed, when to resurface
  completed_at      TIMESTAMPTZ,
  
  assigned_to       TEXT NOT NULL REFERENCES portal_users(email),
  created_by        TEXT NOT NULL REFERENCES portal_users(email),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. CRM Tags (Predefined) ────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  color             TEXT DEFAULT '#6B7280', -- hex color for UI
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. Indexes ──────────────────────────────────────────────
CREATE INDEX idx_crm_leads_phone       ON crm_leads(phone);
CREATE INDEX idx_crm_leads_email       ON crm_leads(email);
CREATE INDEX idx_crm_leads_stage       ON crm_leads(pipeline_stage);
CREATE INDEX idx_crm_leads_assigned    ON crm_leads(assigned_to);
CREATE INDEX idx_crm_leads_source      ON crm_leads(source);
CREATE INDEX idx_crm_leads_created     ON crm_leads(created_at DESC);
CREATE INDEX idx_crm_leads_score       ON crm_leads(lead_score DESC);
CREATE INDEX idx_crm_activities_lead   ON crm_activities(lead_id, created_at DESC);
CREATE INDEX idx_crm_reminders_due     ON crm_reminders(due_at) WHERE status = 'pending';
CREATE INDEX idx_crm_reminders_user    ON crm_reminders(assigned_to) WHERE status = 'pending';

-- ── 7. Seed default tags ────────────────────────────────────
INSERT INTO crm_tags (name, color) VALUES
  ('hot-lead', '#EF4444'),
  ('warm-lead', '#F59E0B'),
  ('cold-lead', '#3B82F6'),
  ('parent-enquiry', '#8B5CF6'),
  ('student-enquiry', '#10B981'),
  ('demo-attended', '#06B6D4'),
  ('price-sensitive', '#F97316'),
  ('competitive-exam', '#EC4899'),
  ('referred', '#14B8A6'),
  ('callback-requested', '#6366F1')
ON CONFLICT (name) DO NOTHING;
```

---

## 5. Sales User Credentials

```
Email:    sales@stibelearning.com
Password: Test@1234
Role:     sales
Name:     Sales Team
```

Seeded in migration 056 alongside table creation:
```sql
INSERT INTO portal_users (email, full_name, portal_role, is_active, password_hash)
VALUES (
  'sales@stibelearning.com',
  'Sales Team',
  'sales',
  TRUE,
  '$2b$10$...'   -- bcrypt hash of Test@1234
);
```

---

## 6. Sales Dashboard — Tab Layout

| # | Tab | Hash Route | Features |
|---|-----|-----------|----------|
| 1 | **Overview** | `#overview` | Pipeline summary cards, today's reminders, recent leads, conversion funnel chart, source breakdown pie chart |
| 2 | **Leads** | `#leads` | Full leads table with search, filter by stage/source/priority/assigned, bulk actions, quick-add modal |
| 3 | **Pipeline** | `#pipeline` | Kanban board showing leads by stage, drag-to-change-stage, lead count + value per column |
| 4 | **Activities** | `#activities` | Chronological interaction timeline, filter by type/lead/rep, log new activity modal |
| 5 | **Reminders** | `#reminders` | Today's tasks, overdue (red), upcoming, completed. Snooze/complete actions |
| 6 | **WhatsApp** | `#whatsapp` | Quick-send WhatsApp templates to leads, recent message log, CTWA lead feed |
| 7 | **Reports** | `#reports` | Conversion funnel (recharts), source ROI, rep performance, monthly trends, time-to-convert |
| 8 | **Settings** | `#settings` | Pipeline stage config, tag management, auto-assignment rules, lead scoring weights |

---

## 7. API Endpoints

### Sales Dashboard
```
GET  /api/v1/sales/dashboard         — overview stats (counts, pipeline, today's tasks)
```

### Lead CRUD
```
GET    /api/v1/sales/leads           — list leads (paginated, filter, search, sort)
POST   /api/v1/sales/leads           — create lead (manual entry)
GET    /api/v1/sales/leads/[id]      — get single lead + activities + reminders
PATCH  /api/v1/sales/leads/[id]      — update lead (stage, info, assignment)
DELETE /api/v1/sales/leads/[id]      — archive lead (soft delete)
POST   /api/v1/sales/leads/import    — bulk import from demo_requests/admission_requests
POST   /api/v1/sales/leads/[id]/convert — convert lead to student (create admission_request)
```

### Activities
```
GET    /api/v1/sales/activities      — list activities (by lead or global)
POST   /api/v1/sales/activities      — log new activity (call, note, etc.)
```

### Reminders
```
GET    /api/v1/sales/reminders       — list reminders (today, overdue, upcoming)
POST   /api/v1/sales/reminders       — create reminder
PATCH  /api/v1/sales/reminders/[id]  — complete/snooze/cancel reminder
```

### WhatsApp
```
POST   /api/v1/sales/whatsapp/send   — send WhatsApp template to lead
GET    /api/v1/sales/whatsapp/templates — list available WhatsApp templates
```

### Reports
```
GET    /api/v1/sales/reports         — aggregated reports (funnel, source, rep)
```

### Webhook (public, no auth — signature verified)
```
GET    /api/v1/webhook/meta          — Meta verification challenge
POST   /api/v1/webhook/meta          — Meta event handler (leadgen + messages)
```

---

## 8. Meta Webhook Integration

### 8.1 Environment Variables (new)
```env
# Meta App Webhook
META_APP_SECRET=<your_meta_app_secret>       # For HMAC signature verification
META_VERIFY_TOKEN=stibe_meta_webhook_2025  # For GET verification challenge
```

### 8.2 Webhook Flow

```
Meta → POST /api/v1/webhook/meta
  │
  ├─ Verify X-Hub-Signature-256 (HMAC SHA-256 with META_APP_SECRET)
  │
  ├─ Event: leadgen (Facebook Instant Form)
  │   ├─ Extract: leadgen_id, form_id, page_id, created_time
  │   ├─ Fetch lead data: GET /v19.0/{leadgen_id}?access_token={page_token}
  │   │   → Returns: full_name, phone_number, email, etc.
  │   ├─ Check duplicate (phone/email)
  │   └─ INSERT INTO crm_leads (source='facebook_lead', ...)
  │       + INSERT INTO crm_activities (type='system', title='Lead from Facebook Ad')
  │       + INSERT INTO crm_reminders (type='follow_up', due=NOW()+15min)
  │
  ├─ Event: messages (WhatsApp CTWA — referral.source_type = 'ad')
  │   ├─ Extract: from (phone), referral.headline, referral.body, referral.source_id
  │   ├─ Fetch contact name via WhatsApp profile
  │   ├─ Check duplicate (phone)
  │   └─ INSERT INTO crm_leads (source='whatsapp_ctwa', ad_id=referral.source_id, ...)
  │       + INSERT INTO crm_activities (type='whatsapp_received', ...)
  │       + INSERT INTO crm_reminders (type='callback', due=NOW()+5min)
  │
  └─ Return 200 OK (always — Meta retries on failure)
```

### 8.3 Meta App Configuration Steps

1. **Go to**: developers.facebook.com → `stibe` app → Webhooks
2. **Add webhook subscriptions**:
   - **Page**: Subscribe to `leadgen` field → URL: `https://stibelearning.online/api/v1/webhook/meta`
   - **WhatsApp Business Account**: Subscribe to `messages` field → same URL
3. **Verify token**: `stibe_meta_webhook_2025` (we handle the GET challenge)
4. **App Secret**: Copy from App Dashboard → Settings → Basic → App Secret → save as `META_APP_SECRET`

### 8.4 Partner Business Setup

To access a new business account's ads/pages/WhatsApp:

1. **Business Settings** → System Users → `stibe-portal`
2. **Add the new business as a partner**:
   - New business owner goes to: Business Settings → Partners → Add → enter your Business ID `2348821842224273`
   - Grant permissions: `ads_management`, `leads_retrieval`, `pages_read_engagement`, `whatsapp_business_messaging`
3. **System user token**: Regenerate with all required scopes after partner access is granted
4. **Subscribe webhook**: The new business's Page and WABA must be subscribed to your app's webhook

---

## 9. File Structure (New Files)

```
app/
  (portal)/
    sales/
      page.tsx                          # Server component — requireRole('sales')
      SalesDashboardClient.tsx          # ~2,500 LOC — 8 tab dashboard
  api/
    v1/
      sales/
        dashboard/route.ts              # GET: overview stats
        leads/route.ts                  # GET/POST: lead listing + creation
        leads/[id]/route.ts             # GET/PATCH/DELETE: single lead
        leads/import/route.ts           # POST: import from demo/admission
        leads/[id]/convert/route.ts     # POST: convert to student
        activities/route.ts             # GET/POST: activity log
        reminders/route.ts              # GET/POST/PATCH: reminders
        whatsapp/send/route.ts          # POST: send WhatsApp
        whatsapp/templates/route.ts     # GET: list templates
        reports/route.ts                # GET: analytics
      webhook/
        meta/route.ts                   # GET/POST: Meta webhook handler

migrations/
  056_sales_crm.sql                     # CRM tables + sales role + seed data

lib/
  crm.ts                                # CRM helper functions (scoring, dedup, import)
```

### Modified Files
```
lib/permissions.ts                      # Add sales role permissions
lib/nav-config.ts                       # Add sales nav tabs
proxy.ts                                # Add /sales route protection
lib/whatsapp.ts                         # Add CRM-specific WhatsApp templates
lib/email-templates.ts                  # Add lead follow-up email templates
```

---

## 10. Lead Scoring Algorithm

| Factor | Points | Notes |
|--------|--------|-------|
| Source: Facebook Lead Ad | +15 | Filled a form — higher intent |
| Source: WhatsApp CTWA | +10 | Clicked ad & messaged |
| Source: Demo Request | +20 | Attended/requested demo |
| Source: Referral | +15 | Referred by existing user |
| Source: Walk-in | +20 | Came physically |
| Has email | +5 | Contactable via email |
| Has phone | +5 | Contactable via phone |
| Has WhatsApp | +10 | Primary contact channel |
| Grade specified | +5 | Knows what they want |
| Subjects specified | +5 | Clear requirement |
| Activity in last 7 days | +10 | Recent engagement |
| Activity in last 30 days | +5 | Somewhat engaged |
| Demo completed | +15 | Serious interest |
| Multiple interactions | +10 | Engaged lead |

Score ranges: **0-30** Cold · **31-60** Warm · **61-100** Hot

---

## 11. Sales Dashboard Tab Wireframes

### Overview Tab
```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Sales Overview                                   [Date Range]│
├────────────┬────────────┬────────────┬────────────┬─────────────┤
│   New      │  In        │  Demo      │  Enrolled  │  Lost       │
│   Leads    │  Pipeline  │  Scheduled │  (Won)     │             │
│   12       │  34        │  5         │  8         │  3          │
│   +4 today │  ▲ 12%     │  2 today   │  ▲ 25%    │  ▼ 10%     │
├────────────┴────────────┴────────────┴────────────┴─────────────┤
│                                                                  │
│  ┌──── Conversion Funnel ────┐   ┌──── Source Breakdown ───────┐ │
│  │ New          100 ████████ │   │ 🟢 WhatsApp CTWA   45%     │ │
│  │ Contacted     72 ██████   │   │ 🔵 Facebook Lead   25%     │ │
│  │ Interested    48 ████     │   │ 🟣 Demo Request    15%     │ │
│  │ Demo          25 ██       │   │ 🟡 Referral        10%     │ │
│  │ Enrolled      15 █        │   │ ⚪ Other            5%     │ │
│  └───────────────────────────┘   └─────────────────────────────┘ │
│                                                                  │
│  ┌──── Today's Reminders (5) ────────────────────────────────┐   │
│  │ ⚠️  Call back Rahul (overdue 2h)              [Complete]   │   │
│  │ 📞 Follow up with Priya — fee discussion      [Complete]   │   │
│  │ 📋 Demo reminder for Amit (3:00 PM)           [Snooze]     │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──── Recent Leads ────────────────────────────────────────┐    │
│  │ Anjali K.   📱 +91 98765...  WhatsApp CTWA   2 min ago  │    │
│  │ Ravi M.     📱 +91 87654...  Facebook Lead   15 min ago  │    │
│  │ Sanjay P.   📱 +91 76543...  Demo Request    1 hour ago  │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Leads Tab
```
┌─────────────────────────────────────────────────────────────────┐
│ [🔍 Search name/phone/email]  [Stage ▼] [Source ▼] [Priority ▼]│
│                                                    [+ New Lead] │
├─────────────────────────────────────────────────────────────────┤
│ Name          Phone         Source      Stage       Score  Age  │
│ ──────────────────────────────────────────────────────────────  │
│ Anjali K.     +91 9876...   📱 CTWA     🟢 New       75   2m  │
│ Ravi M.       +91 8765...   📘 FB Lead  🔵 Contacted  60   15m │
│ Sanjay P.     +91 7654...   🎓 Demo     🟡 Interest   85   1h  │
│ Priya S.      +91 6543...   📞 Call     🟠 Negotiat   90   2d  │
│ Amit R.       +91 5432...   👥 Referral 🔴 Lost       30   5d  │
│                                                                  │
│ ← 1 2 3 ... 12 →                              Showing 1-20/235 │
└─────────────────────────────────────────────────────────────────┘

Click row → Slide-out Lead Detail Panel:
┌──────────────────────────────────┐
│ Anjali Krishnan            [Edit]│
│ 📱 +91 98765 43210  [WhatsApp]  │
│ 📧 anjali@gmail.com  [Email]    │
│ 🎓 Grade 10 · CBSE · Math/Sci  │
│ Source: WhatsApp CTWA Ad        │
│ Score: 75 🟢  Priority: High    │
│ Stage: New → [Change Stage ▼]   │
│                                  │
│ ── Timeline ─────────────────── │
│ 📱 2:15 PM WhatsApp received    │
│    "Hi, I saw your ad..."       │
│ 🤖 2:15 PM Auto-created lead    │
│ ⏰ 2:30 PM Reminder: Follow up  │
│                                  │
│ [📞 Log Call] [📝 Add Note]     │
│ [⏰ Set Reminder] [📱 WhatsApp] │
└──────────────────────────────────┘
```

### Pipeline Tab (Kanban)
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  New (12) │Contacted │Interested│  Demo    │Negotiate │Enrolled  │
│           │   (8)    │   (6)    │  (5)     │  (3)     │  (8)     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│┌────────┐│┌────────┐│┌────────┐│┌────────┐│┌────────┐│┌────────┐│
││Anjali K ││Ravi M.  ││Sanjay  ││Meera K. ││Priya S. ││Deepa T. ││
││🟢 75   ││🔵 60   ││🟡 85   ││📱 CTWA ││🟠 90   ││✅ 100  ││
││📱 CTWA ││📘 FB   ││🎓 Demo ││Demo 3PM ││₹15k/mo ││Batch 3A ││
│└────────┘│└────────┘│└────────┘│└────────┘│└────────┘│└────────┘│
│┌────────┐│┌────────┐│          │          │          │          │
││Vikram R ││Neha P.  ││          │          │          │          │
││🟢 45   ││🔵 55   ││          │          │          │          │
││📞 Call ││📱 CTWA ││          │          │          │          │
│└────────┘│└────────┘│          │          │          │          │
│  ⋮       │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
          ← Drag cards between columns to change stage →
```

---

## 12. WhatsApp Template Messages for Sales

New templates to register with Meta (via Meta Business Suite → WhatsApp Manager → Message Templates):

| Template Name | Category | Parameters | Body |
|--------------|----------|------------|------|
| `lead_greeting` | Marketing | `{{1}}` name | Hi `{{1}}`! 👋 Thank you for your interest in stibe Classes. Our academic counselor will reach out shortly. |
| `demo_invite` | Marketing | `{{1}}` name, `{{2}}` link | Hi `{{1}}`! 🎓 We've set up a free demo class for you. Join here: `{{2}}` |
| `follow_up` | Marketing | `{{1}}` name | Hi `{{1}}`! Just following up on your enquiry about stibe Classes. Would you like to schedule a free demo? Reply YES to proceed. |
| `fee_info` | Marketing | `{{1}}` name, `{{2}}` details | Hi `{{1}}`! Here are the fee details you requested: `{{2}}`. Let us know if you have questions! |
| `enrollment_confirm` | Utility | `{{1}}` name | Hi `{{1}}`! 🎉 Welcome to stibe Classes! Your enrollment is confirmed. Our team will share your batch schedule shortly. |

---

## 13. Permissions & Access Control

```typescript
// lib/permissions.ts — new entry
sales: {
  'crm:view':       true,   // View leads, activities, reports
  'crm:manage':     true,   // Create/edit/delete leads, log activities
  'crm:assign':     true,   // Assign leads to self
  'crm:whatsapp':   true,   // Send WhatsApp from CRM
  'crm:reports':    true,   // View sales reports
  'crm:import':     true,   // Import leads from demo/admission
  'crm:settings':   false,  // Only owner can change CRM settings
  'crm:delete':     false,  // Only owner can permanently delete
}
```

Owner also gets all `crm:*` permissions for oversight.

---

## 14. Nav Config

```typescript
// lib/nav-config.ts — new entry
sales: [
  { id: 'overview',   label: 'Overview',    icon: LayoutDashboard },
  { id: 'leads',      label: 'Leads',       icon: Users },
  { id: 'pipeline',   label: 'Pipeline',    icon: KanbanSquare },
  { id: 'activities', label: 'Activities',  icon: Activity },
  { id: 'reminders',  label: 'Reminders',   icon: Bell },
  { id: 'whatsapp',   label: 'WhatsApp',    icon: MessageCircle },
  { id: 'reports',    label: 'Reports',     icon: BarChart3 },
  { id: 'settings',   label: 'Settings',    icon: Settings },
]
```

---

## 15. Implementation Order (Step-by-Step)

```
Step 1:  Migration 056 — tables + role + seed user         → commit & deploy
Step 2:  permissions.ts + nav-config.ts + proxy.ts updates  → builds ok
Step 3:  /app/(portal)/sales/page.tsx server component      → login works
Step 4:  SalesDashboardClient.tsx — shell + Overview tab     → tab renders
Step 5:  /api/v1/sales/leads/route.ts — CRUD                → leads work
Step 6:  Leads tab (table + filters + detail panel)          → full CRUD
Step 7:  Activities API + tab                                → logging works
Step 8:  Reminders API + tab                                 → tasks work
Step 9:  Pipeline kanban tab                                 → visual pipeline
Step 10: /api/v1/webhook/meta/route.ts                       → webhook ready
Step 11: Register webhook in Meta App Dashboard              → leads auto-flow
Step 12: WhatsApp tab (send templates)                       → outbound comms
Step 13: Reports tab (recharts)                              → analytics
Step 14: Settings tab                                        → config
Step 15: Import existing demo_requests/admission_requests    → backfill data
Step 16: Owner dashboard CRM widget                          → owner visibility
```

---

## 16. Tech Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| **ORM** | Raw SQL (pg) | Consistent with entire codebase |
| **Kanban** | HTML drag-and-drop | No extra dependency, works with existing Tailwind |
| **Charts** | recharts | Already installed and used in student reports |
| **WhatsApp** | Existing `lib/whatsapp.ts` | Extend, don't replace |
| **Webhook security** | HMAC SHA-256 | Meta standard — `X-Hub-Signature-256` header |
| **Lead dedup** | Phone number match | Primary identifier (email often missing) |
| **Pagination** | Cursor-based | Efficient for large lead lists |
| **Real-time** | Polling (30s) | Simple, no websocket needed for CRM |

---

## 17. Risk & Dependencies

| Risk | Mitigation |
|------|------------|
| Meta webhook URL must be HTTPS | Already have SSL on `stibelearning.online` ✅ |
| WhatsApp templates need Meta approval (24-48h) | Submit templates early, start with existing `general` template |
| CTWA leads have no name (only phone) | Auto-fetch WhatsApp profile name, allow manual edit |
| Lead dedup on phone — international format varies | Normalize to E.164 format (`+91XXXXXXXXXX`) before insert |
| Partner business token scope | Document exact steps for business owner to grant access |
| Rate limits on Meta API | Batch fetches, cache templates, respect 200 calls/hour |

---

## 18. Success Metrics

- [ ] Sales rep can log in and see dashboard within 2 seconds
- [ ] WhatsApp CTWA leads appear in dashboard within 30 seconds of message
- [ ] Facebook Lead Ad submissions appear within 60 seconds
- [ ] Full lead lifecycle: New → Contacted → Interested → Demo → Enrolled
- [ ] All interactions logged with timestamp and rep identity
- [ ] Overdue reminders highlighted in red, notification sent via email
- [ ] Conversion funnel report shows accurate drop-off at each stage
- [ ] Owner can see sales team performance from owner dashboard

---

*This document will be updated after each phase completion.*
