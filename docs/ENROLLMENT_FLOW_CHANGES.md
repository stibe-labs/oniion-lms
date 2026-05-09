# Enrollment Flow — Workflow Corrections & Code Changes Needed

**Date:** 28 April 2026
**Scope:** Stibe CRM + stibe Portal integration — demo link flow, guest session flow, student enrollment
**Tenant:** `stibelearningventures@gmail.com` (stibe Learning)

---

## Current State (as-is)

### Complete CRM → Portal Enrollment Journey (Current)

```
[Stibe CRM]                               [stibe Portal]
────────────────────────────────────────────────────────────────
1. Sales creates lead                      —
2. Sales clicks "Send Demo"
   → POST /api/v1/crm/leads/[id]/send-demo
   → calls createstibeDemoLink()
   → POST stibe/api/v1/external/create-demo-link
                                           → creates demo_requests row (status=link_created)
                                           → sends WhatsApp to student: /demo/[linkId]
                                           ← returns { demo_link_id, demo_url, demo_request_id }
   → stores stibe_demo_link_id on lead
   → lead stage → "demo_registered" (after student registers)

3. Student opens /demo/[linkId]
   → fills registration form (name, grade, board, subject)
   → guest account created
   → stibe fires webhook → POST /api/webhooks/stibe { event: demo_registered }
   → CRM lead stage → "demo_registered"

4. Sales/AO schedules demo
   → POST /api/v1/crm/leads/[id]/schedule-demo
   → calls schedulestibeDemo()
   → POST stibe/api/v1/external/schedule-demo
                                           → assigns teacher + time to demo_request
                                           → student gets join link
   → stibe fires webhook { event: demo_scheduled }
   → CRM lead stage → "demo_scheduled"

5. Demo session happens
   → stibe fires webhook { event: demo_completed }
   → CRM lead stage → "demo_success"

6. Sales marks interest
   → stibe fires webhook { event: demo_interest, interested: true }
   → CRM lead stage → "interested"

7. Sales sends enrollment link
   → POST /api/v1/crm/leads/[id]/send-enrollment
   → calls createEnrollmentLink()
   → POST stibe/api/v1/external/create-enrollment-link
                                           → creates enrollment_links row
                                           → sends WhatsApp with /enroll/[linkId]
                                           ← returns { enrollment_link_id, enrollment_url }
   → stores stibe_enrollment_link_id on lead

8. Student opens /enroll/[linkId]
   → fills details, pays via Razorpay
   → account created, credits added, assigned to batch
   → stibe fires webhook { event: enrollment_paid }
   → CRM lead stage → "closed"

[Alternative path: AO manually adds student in special cases]
   AO → Batch → Add Student → fills details manually (special cases only)
```

---

## Target State (to-be)

### Key Changes

1. **Demo step (step 2) uses a guest live session when one is near** instead of always creating a `/demo` registration link
2. **AO does NOT add students as part of the normal flow** — enrollment link is the primary path. AO manual add is reserved for exceptional cases only.

### New Demo Decision Logic

When sales clicks "Send Demo" on a lead, the CRM checks stibe for upcoming/live sessions near the current time that match the lead's grade/subject:

```
Sales clicks "Send Demo"
         ↓
CRM calls stibe: GET /api/v1/external/upcoming-sessions
    (filtered by grade, subject, within next 4 hours or currently live)
         ↓
  ┌─ Live session found nearby? ─┐
  │ YES                          │ NO
  ↓                              ↓
Add student as guest         Create demo registration link
to that live session         (current /demo/[linkId] flow)
         ↓                       ↓
Send /open-classroom/[token]  Send /demo/[linkId] via WhatsApp
via WhatsApp                 
         ↓                       ↓
Guest joins, observes class   Student registers → demo scheduled
         ↓                       ↓
Sales follows up              Sales follows up
```

---

## Code Changes — stibe Portal

### Change 1 — New External API: Get Upcoming Sessions

**File to create:** `app/api/v1/external/upcoming-sessions/route.ts`

**Purpose:** CRM calls this before "Send Demo" to check if there's a suitable live or near-future session to use as a demo.

**Request:**
```
GET /api/v1/external/upcoming-sessions?grade=10&subject=Math&window_hours=4
Headers: X-API-Key: <key>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "session_id": "...",
        "batch_id": "...",
        "batch_name": "Class 10 A1",
        "subject": "Math",
        "grade": "10",
        "scheduled_date": "2026-04-28",
        "start_time": "10:00:00",
        "duration_minutes": 60,
        "status": "live",                 // "live" | "scheduled"
        "is_live_now": true,
        "starts_in_minutes": 0
      }
    ]
  }
}
```

**Logic:**
```sql
SELECT bs.session_id, bs.batch_id, b.batch_name, bs.subject, b.grade,
       bs.scheduled_date, bs.start_time, bs.duration_minutes, bs.status,
       bs.livekit_room_name
FROM batch_sessions bs
JOIN batches b ON b.batch_id = bs.batch_id
WHERE (
  bs.status = 'live'
  OR (
    bs.status = 'scheduled'
    AND (bs.scheduled_date || ' ' || bs.start_time)::timestamp
        BETWEEN NOW() AND NOW() + interval '4 hours'
  )
)
AND ($grade IS NULL OR b.grade = $grade)
AND ($subject IS NULL OR LOWER(bs.subject) = LOWER($subject))
ORDER BY
  CASE bs.status WHEN 'live' THEN 0 ELSE 1 END,
  bs.scheduled_date, bs.start_time
LIMIT 5
```

---

### Change 2 — New External API: Add Guest to Session

**File to create:** `app/api/v1/external/add-guest-to-session/route.ts`

**Purpose:** CRM calls this to get a guest join link for a specific session (live or scheduled). The WhatsApp message with the link is sent here.

**Request:**
```json
POST /api/v1/external/add-guest-to-session
Headers: X-API-Key: <key>
Body: {
  "session_id": "...",
  "crm_lead_id": "...",
  "crm_tenant_id": "...",
  "student_name": "Rahul Menon",
  "student_phone": "919876543210",
  "student_email": "rahul@example.com"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "guest_link": "https://stibelearning.online/open-classroom/abc123",
    "join_token": "abc123",
    "session_status": "live",           // "live" | "scheduled"
    "starts_at": "2026-04-28T10:00:00+05:30"  // ISO8601, null if already live
  },
  "message": "Guest link created and WhatsApp sent"
}
```

**Logic:**
1. Validate API key (`CRM_INTEGRATION_API_KEY`)
2. Fetch the session — check it is `live` or `scheduled` (not `ended`/`cancelled`)
3. For **live** sessions: reuse existing `guest_session` open-classroom if exists, else create one (same logic as internal `batch-sessions/[sessionId]/guest-link` POST)
4. For **scheduled** sessions: pre-create the guest open-classroom with `status = 'scheduled'` (it auto-activates when the session goes live)
5. Send WhatsApp to student with the guest link
6. Return the link + session timing info

**WhatsApp message template (live):**
```
🎓 *stibe Classes — Join a Free Live Class*

Hi {student_name}! A live class is happening right now.

Tap to join and see how stibe works:
{guest_link}

No account needed — just enter your name and watch the class. Free!

— stibe Classes
```

**WhatsApp message template (scheduled):**
```
🎓 *stibe Classes — Free Demo Class Invite*

Hi {student_name}! You're invited to observe a live class on {date} at {time}.

Join link (save this):
{guest_link}

No account needed. Just tap the link when class starts and enter your name.

— stibe Classes
```

---

### Change 3 — Webhook: Fire demo_completed When Guest Session Ends

When a `guest_session` open-classroom ends (room status → `ended`), stibe should fire a webhook back to the CRM if there's a `crm_lead_id` attached to that guest session.

**File to update:** `app/api/v1/open-classroom/[token]/end/route.ts` (or wherever room end is handled)

Add: if `open_classrooms.classroom_type = 'guest_session'` and there's a `crm_lead_id` linked, fire:
```json
POST {crm_webhook_url} {
  "event": "demo_completed",
  "crm_lead_id": "...",
  "crm_tenant_id": "...",
  "outcome": "completed",
  "duration_minutes": 45
}
```

Need to store `crm_lead_id` and `crm_tenant_id` on the `open_classrooms` record when creating from guest session via the external API.

**Migration needed:** Add `crm_lead_id TEXT, crm_tenant_id TEXT` columns to `open_classrooms` table.

---

### Change 4 — Update `create-demo-link` External API (Fallback Path)

No changes needed to the existing `create-demo-link` endpoint — it remains the fallback when no live/upcoming session is available. It continues to work as-is.

---

## Code Changes — Stibe CRM

### Change 5 — Update `send-demo` Route: Smart Demo Routing

**File:** `app/api/v1/crm/leads/[id]/send-demo/route.ts`

**Current behavior:** Always calls `createstibeDemoLink()` → sends `/demo/[linkId]`.

**New behavior:**
```typescript
// 1. Get lead's grade and subject from custom_data
const grade = lead.custom_data?.grade;
const subject = lead.custom_data?.subject;

// 2. Check stibe for upcoming live sessions (window: 4 hours)
const upcomingSessions = await getstibeUpcomingSessions(tenantId, {
  grade,
  subject,
  window_hours: 4,
});

// 3. Route decision
if (upcomingSessions.length > 0) {
  // Pick best session (live > scheduled, soonest first)
  const bestSession = upcomingSessions[0];
  
  // Add as guest — gets WhatsApp automatically
  const result = await addGuestTostibeSession(tenantId, {
    session_id: bestSession.session_id,
    crm_lead_id: id,
    crm_tenant_id: tenantId,
    student_name: lead.full_name,
    student_phone: phone,
    student_email: lead.email ?? undefined,
  });
  
  // Update lead: store guest_link, set stage to demo_scheduled, log activity
  await execute(
    `UPDATE leads SET pipeline_stage = 'demo_scheduled', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  await query(/* INSERT INTO activities ... guest demo sent ... */);
  
  return apiSuccess({ type: 'guest_session', guest_link: result.guest_link, ... });
  
} else {
  // Fallback: original demo link flow
  const result = await createstibeDemoLink({ ... });
  // ... existing code unchanged ...
  return apiSuccess({ type: 'demo_link', demo_url: result.demo_url, ... });
}
```

---

### Change 6 — New Integration Functions in `lib/integrations/stibe.ts`

Add two new exported functions:

```typescript
// ── Get upcoming sessions suitable for demo ────────────────

export interface UpcomingSession {
  session_id: string;
  batch_id: string;
  batch_name: string;
  subject: string;
  grade: string;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  status: 'live' | 'scheduled';
  is_live_now: boolean;
  starts_in_minutes: number;
}

export async function getstibeUpcomingSessions(
  tenantId: string,
  params?: { grade?: string; subject?: string; window_hours?: number },
): Promise<UpcomingSession[]> { ... }


// ── Add guest to a specific session ───────────────────────

export interface AddGuestToSessionParams {
  session_id: string;
  crm_lead_id: string;
  crm_tenant_id: string;
  student_name: string;
  student_phone: string;
  student_email?: string;
}

export interface AddGuestToSessionResult {
  guest_link: string;
  join_token: string;
  session_status: 'live' | 'scheduled';
  starts_at: string | null;
}

export async function addGuestTostibeSession(
  tenantId: string,
  params: AddGuestToSessionParams,
): Promise<AddGuestToSessionResult> { ... }
```

---

### Change 7 — Update Webhook Handler: Handle `demo_guest_completed` Event

**File:** `app/api/webhooks/stibe/route.ts`

Add new webhook event type `demo_guest_completed`:
```typescript
// In stageMap:
demo_guest_completed: 'demo_success',
```

Update `stibeWebhookEvent` in `lib/integrations/stibe.ts`:
```typescript
export type stibeWebhookEvent =
  | 'demo_registered'
  | 'demo_scheduled'
  | 'demo_completed'
  | 'demo_guest_completed'   // ← new
  | 'demo_interest'
  | 'enrollment_paid';
```

---

### Change 8 — CRM UI: Show Demo Type in Lead Card

In the lead detail panel (or pipeline card), show which demo path was used:
- Badge: `Live Session Demo` (if guest_session path was used)
- Badge: `Demo Link Sent` (if registration link was used)

Store this on the lead's `custom_data`:
```json
{
  "demo_type": "guest_session",        // or "demo_link"
  "demo_session_id": "...",
  "demo_guest_link": "https://..."
}
```

---

## Database Changes — stibe Portal

### Migration: Add CRM context to `open_classrooms`

```sql
-- Migration: Add CRM lead tracking to open_classrooms (for guest sessions)
ALTER TABLE open_classrooms
  ADD COLUMN IF NOT EXISTS crm_lead_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_oc_crm_lead
  ON open_classrooms (crm_lead_id)
  WHERE crm_lead_id IS NOT NULL;
```

---

## Complete Target Enrollment Flow (Summary)

```
[Stibe CRM — Sales Team]                  [stibe Portal — AO/BC/Teacher]
────────────────────────────────────────────────────────────────────────────

STEP 1 — Lead comes in
  Lead created (FB ad / manual / call)
  Assigned to sales agent

STEP 2 — Demo (updated flow)
  Sales clicks "Send Demo"
  CRM checks: any live/upcoming session in next 4h for this grade/subject?
  
  PATH A — Live session available:
    stibe creates open-classroom guest link
    WhatsApp sent: "Live class happening now — join to observe"
    Student joins as view-only guest (no account)
    Session ends → stibe fires demo_guest_completed webhook
    CRM: lead → "demo_success"
  
  PATH B — No session near:
    stibe creates /demo/[linkId] registration link
    WhatsApp sent: "Register for a free demo class"
    Student fills form, registers
    AO/BC schedules demo with teacher
    Demo happens → stibe fires demo_completed webhook
    CRM: lead → "demo_success"

STEP 3 — Follow-up after demo
  Sales agent follows up
  If interested → lead stage → "interested"
  stibe fires demo_interest webhook

STEP 4 — Enrollment
  Sales clicks "Send Enrollment Link"
  stibe creates /enroll/[linkId]
  WhatsApp sent: "Complete your enrollment and pay"
  Student fills all details + pays via Razorpay
  Account created, credits added
  stibe fires enrollment_paid webhook
  CRM: lead stage → "closed"

STEP 5 — Batch Assignment (stibe Portal side — AO only)
  AO assigns enrolled student to a batch
  Student gets join tokens and welcome email
  [This is done on the Portal, not in CRM]

SPECIAL CASE — AO manually adds student (exceptions only):
  Student cannot self-enroll (no phone, paid offline, etc.)
  AO uses "Add Student" on Portal manually
  This is NOT the normal enrollment path
```

---

## Implementation Order

| # | Change | File | Priority |
|---|---|---|---|
| 1 | New stibe API: `upcoming-sessions` | `stibe-portal/app/api/v1/external/upcoming-sessions/route.ts` | 🔴 First |
| 2 | New stibe API: `add-guest-to-session` | `stibe-portal/app/api/v1/external/add-guest-to-session/route.ts` | 🔴 First |
| 3 | DB migration: add `crm_lead_id` to `open_classrooms` | New migration file | 🔴 First |
| 4 | New CRM integration functions | `stibe-crm/lib/integrations/stibe.ts` | 🔴 Second |
| 5 | Update CRM `send-demo` route with routing logic | `stibe-crm/app/api/v1/crm/leads/[id]/send-demo/route.ts` | 🔴 Second |
| 6 | stibe: fire `demo_guest_completed` webhook on room end | `stibe-portal/app/api/v1/room/...` | 🟡 Third |
| 7 | CRM: handle `demo_guest_completed` webhook | `stibe-crm/app/api/webhooks/stibe/route.ts` | 🟡 Third |
| 8 | CRM UI: show demo path type badge on lead card | CRM frontend | 🟢 Polish |

---

## Notes on AO Role in Enrollment

- AO does **not** initiate student enrollment — that's always via the CRM sales flow
- AO's job on the Portal is: create batches, assign coordinators, schedule sessions, manage academic calendar
- After a student self-enrolls (pays via /enroll link), AO assigns them to a batch — this is the only normal AO action in the enrollment process
- Manual "Add Student" by AO is reserved for: offline-paid students, data migration, special admin corrections
