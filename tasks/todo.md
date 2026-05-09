# Active Task — Teacher Exam Upload + Live Tracking (April 2026)

## Requirements
1. Exam generation upload size must support files up to 50 MB.
2. Upload must accept broad document formats (including PPT and related office files).
3. Teacher exam tab must show end-to-end student status for selected exam topic:
  - delivery sent
  - exam reached/opened
  - can start / camera waiting
  - started
  - completed
  - fullscreen compliance indicators from result violations
4. Re-send behavior must support new exam topics for all students even if they completed a previous topic.

## Implementation Plan
- [x] Raise upload API file size guard to 50 MB and update UI copy.
- [x] Expand/normalize office file handling in exam content extraction pipeline.
- [x] Add student→teacher session exam status telemetry data channel events.
- [x] Add teacher-side telemetry state and pass to exam panel.
- [x] Update exam panel logic to be selected-topic aware for completion/pending and resend behavior.
- [x] Add detailed per-student status roster in exam tab.
- [x] Type-check and document review outcome.

Review:
- Upload size is now capped at 50 MB per file and UI reflects the same limit.
- Upload accepts broad file formats (extension required); office docs are normalized via LibreOffice PDF conversion for extraction.
- Exam tab now tracks per student lifecycle for selected topic: sent, reached, started, camera readiness, completed.
- Result scope/pending scope are now selected-topic aware, preventing false "already done" across different exams.
- New-topic send supports all students even if they completed a previous topic.

---

# Active Task — AO Overtime Status Classification (April 2026)

## Requirements
1. If a session is running in overtime, AO dashboard must continue to show it as live.
2. Session should show as ended only when teacher/manual end updates DB status to `ended`.

## Completed
- [x] Updated AO dashboard table/list status derivation to trust persisted DB status (no time-based auto-end).
- [x] Updated AO Today Live tab status derivation to trust persisted DB status.
- [x] Updated shared session calendar status mapping to avoid auto-ending live overtime sessions.
- [x] Type-check passed (`npx tsc --noEmit`).

Review:
- Overtime sessions now remain live in AO views until explicitly ended.
- `ended` badge now reflects manual end action/state only.

---

# Active Task — Create Batch Workflow Overhaul (April 2026)

## Requirements (Revised)
1. Trim batch types to 5: 1:1, 1:3, 1:15, 1:30, 1:M — remove `lecture`, `improvement_batch`, `custom`
2. **Templates are subject-combination based** — Step 1 shows BOTH batch type AND subject package cards
   - 1:1 and 1:3: one template card per subject combination (individual subjects + multi-subject combos)
   - 1:15, 1:30, 1:M: one template card per subject package (PCB, PCM, PCBM, PCSM, plus individual subjects for 1:M)
   - Selecting a template pre-fills BOTH batch type AND subjects in one click
3. Student list filtered by selected batch type (only students enrolled for that type)
4. Teacher picker filtered by the batch's subjects (only teachers who teach those subjects)
5. **1:1 and 1:3 require at least 1 student** to create batch — students mandatory for per-class types
6. **1:15, 1:30, 1:M allow 0 students** — create first, add students later

---

## Design: Subject-Based Template Cards

### Proposed BATCH_TEMPLATES structure (two-level: type + subjects)

```
TYPE: one_to_one (1 Student — per-class)
  Template: "1:1 — Physics"            subjects: ['Physics']
  Template: "1:1 — Chemistry"          subjects: ['Chemistry']
  Template: "1:1 — Mathematics"        subjects: ['Mathematics']
  Template: "1:1 — Biology"            subjects: ['Biology']
  Template: "1:1 — All Sciences"       subjects: ['Physics','Chemistry','Biology']
  Template: "1:1 — PCM"                subjects: ['Physics','Chemistry','Mathematics']
  Template: "1:1 — Full (4 subjects)"  subjects: ['Physics','Chemistry','Biology','Mathematics']

TYPE: one_to_three (Up to 3 — per-class)
  Template: "1:3 — Physics"            subjects: ['Physics']
  Template: "1:3 — Chemistry"          subjects: ['Chemistry']
  Template: "1:3 — Mathematics"        subjects: ['Mathematics']
  Template: "1:3 — Biology"            subjects: ['Biology']
  Template: "1:3 — PCB"                subjects: ['Physics','Chemistry','Biology']
  Template: "1:3 — PCM"                subjects: ['Physics','Chemistry','Mathematics']
  Template: "1:3 — Full (4 subjects)"  subjects: ['Physics','Chemistry','Biology','Mathematics']

TYPE: one_to_fifteen (Up to 15 — monthly, GCC CBSE)
  Template: "1:15 — PCB"               subjects: ['Physics','Chemistry','Biology']
  Template: "1:15 — PCM"               subjects: ['Physics','Chemistry','Mathematics']

TYPE: one_to_thirty (Up to 30 — monthly, Kerala CBSE)
  Template: "1:30 — PCBM"              subjects: ['Physics','Chemistry','Biology','Mathematics']
  Template: "1:30 — PCSM"              subjects: ['Physics','Chemistry','Computer Science','Mathematics']

TYPE: one_to_many (Unlimited — monthly, Kerala State Board)
  Template: "1:M — Physics"            subjects: ['Physics']
  Template: "1:M — Chemistry"          subjects: ['Chemistry']
  Template: "1:M — Mathematics"        subjects: ['Mathematics']
  Template: "1:M — Biology"            subjects: ['Biology']
  Template: "1:M — Computer Science"   subjects: ['Computer Science']
  Template: "1:M — PCB"                subjects: ['Physics','Chemistry','Biology']
  Template: "1:M — PCM"                subjects: ['Physics','Chemistry','Mathematics']
  Template: "1:M — PCBM"               subjects: ['Physics','Chemistry','Biology','Mathematics']
  Template: "1:M — PCSM"               subjects: ['Physics','Chemistry','Computer Science','Mathematics']
```

**UI Layout:** Cards grouped by batch type section, each section collapsible. Cards show subject chips + batch type badge. Selecting a card sets `formType` + `formSubjects` simultaneously.

---

## Implementation Plan

### Change 1 — Redesign BATCH_TEMPLATES as subject-combination templates
- File: `app/(portal)/academic-operator/AcademicOperatorDashboardClient.tsx`
- Change `BATCH_TEMPLATES` from 8 type-only entries to ~24 subject-combination entries
- Each entry: `{ type, label, subjects, description, maxStudents, color, ... }`
- Remove `lecture`, `improvement_batch`, `custom` entirely
- UI: render cards **grouped by batch type** with a section header per type
- On card select: `setFormType(tpl.type)` + `setFormSubjects(tpl.subjects)`
- The Subjects & Teachers step becomes assignment-only (no subject picker — subjects already locked from template)

### Change 2 — Filter students by batch type (API + wizard)
- File: `app/api/v1/batches/people/route.ts`
- Add `LEFT JOIN enrollment_links el ON el.student_email = u.email AND el.status = 'paid'` to student query
- Return `preferred_batch_type: el.preferred_batch_type` in each student row
- File: `app/(portal)/academic-operator/AcademicOperatorDashboardClient.tsx`
- Filter student list: `students.filter(s => !s.preferred_batch_type || s.preferred_batch_type === formType)`
- Show label: "Showing students enrolled for [batch type]"

### Change 3 — Filter teachers by batch subjects
- File: `app/(portal)/academic-operator/AcademicOperatorDashboardClient.tsx`
- Line ~7707: already filters `teachers.filter(t => { const ts = t.subjects || []; return ts.length === 0 || ts.some(x => x.toLowerCase() === subj.toLowerCase()); })`
- **This is already correct** — no change needed here since each teacher picker is already per-subject-filtered
- Enhancement: in the subject assignment section, show a "no eligible teachers" warning if no teacher has that subject

### Change 4 — 1:1 and 1:3: require ≥1 student; group types: allow 0 students
- File: `app/(portal)/academic-operator/AcademicOperatorDashboardClient.tsx`
- Line ~7443: `if (formType === 'one_to_one') return selectedStudents.length === 1;`
- Extend: `const SESSION_BASED = new Set(['one_to_one','one_to_three']); if (SESSION_BASED.has(formType)) return selectedStudents.length >= 1;`
- For 1:15, 1:30, 1:M: `return true` (0 students allowed)
- Rename wizard progress label for 1:3 students step to "Students (1–3, at least 1 required)"

### Change 5 — Step order: 1:1 and 1:3 use Template→Student→Details→Teachers→Review
- Because subjects are already locked from template, 1:1/1:3 student step stays early (student sets grade/board)
- For group types: Template→Details→Students→Teachers→Review (students optional, added later)
- Step keys remain: `['template','students','details','teachers','review']` for 1:1/1:3
  and `['template','details','students','teachers','review']` for group
- After student selected for 1:1/1:3: auto-fill grade/board from student profile (current behavior preserved)

### Change 6 — Batch name auto-generation includes subject package
- Current: `"{TypeLabel} Class {Grade} {Section}"` e.g. `"One-to-Fifteen Class 10 A1"`
- New: `"{TypeLabel} {SubjectLabel} {Grade} {Section}"` e.g. `"1:15 PCB Class 10 A1"`, `"1:1 Physics — Arjun Kumar"`
- Subject label derived from template (e.g. `'PCB'`, `'Full'`, `'Physics'`)

---

## Todo Items
- [ ] Read `/api/v1/batches/people` route to confirm current student query structure
- [ ] Change 1: Rebuild BATCH_TEMPLATES as subject-combination entries (~24 cards in 5 groups)
- [ ] Change 2: Add `preferred_batch_type` to student API response; filter students in wizard
- [ ] Change 4: 1:1/1:3 require ≥1 student; 1:15/1:30/1:M allow 0 students
- [ ] Change 5: Confirm step order is correct for each type (already handled by formType === 'one_to_one' check)
- [ ] Change 6: Update auto-generated batch name to include subject package label
- [ ] TypeScript check + build + deploy

---

# Previous Tasks

# Active Task — Teacher YouTube Recording Button Parity (April 2026)

- [x] Study BC live monitor recording UX and API behavior.
- [x] Enable teacher-side manual recording toggle (POST/DELETE recording API).
- [x] Make teacher REC/REC OFF control clickable with loading state.
- [x] Add teacher recording prompt dialog similar to BC flow.
- [x] Run typecheck/build and deploy.

Review:
- Teacher now has BC-style REC toggle and one-minute recording prompt.
- Verified with `npx tsc --noEmit` and `npm run build`.
- Deployed to production (`/var/www/stibe-portal`, PM2 restart `stibe-portal`).

# Active Task — Teacher Share Verification Preview (April 2026)

- [x] Add a teacher-side "Student Share Preview" panel in LiveKit classroom whiteboard mode.
- [x] Add a hide/show toggle for that preview panel so teachers can collapse it.
- [x] Ensure preview follows the same selected source (laptop/tablet) students receive.
- [x] Run TypeScript check and deploy.

# Open Classroom Enhancements — 4 Features

## Completed Bug Fix — Student Dashboard Session End Timing (April 2026)

- [x] Updated `GET /api/v1/student/rooms` to include `batch_sessions.started_at` via `rooms.batch_session_id` join.
- [x] Updated student dashboard `effectiveStatus` to compute end time from `started_at` when available, with fallback to `scheduled_start`.
- [x] Verified with TypeScript check (`npx tsc --noEmit`) and no errors.

## Completed Feature — Early Go Live Permission Toggle (April 2026)

- [x] Added new `teacher_controls` toggle: `allow_go_live_before_schedule` (default `false`).
- [x] Exposed toggle in AO Settings (`TeacherControlsTab`) as "Allow Go Live Before Scheduled Time".
- [x] Updated teacher LiveKit UI (`TeacherView`) to enable GO LIVE before scheduled time when toggle is enabled.
- [x] Added server-side enforcement in `POST /api/v1/room/[room_id]/go-live` to block early go-live when toggle is disabled.
- [x] Updated migration seed JSON (`074_teacher_controls.sql`) to include the new toggle for fresh installs.

## Completed Bug Fix — Flutter Screen Share Blank View + Audio Path (April 2026)

- [x] Fixed student render path to support tablet-only screen host (`teacher_screen`) without requiring primary teacher participant.
- [x] Added active screen-share audio playback path in student UI using `Track.Source.ScreenShareAudio`.
- [x] Improved live-state robustness: student session auto-flips to live when teacher media/screen device is detected to avoid stale waiting/blank states.
- [x] TypeScript check passed (`npx tsc --noEmit`).

## Active Plan — AI Monitoring Refinement (April 2026)

Full study + phased plan saved to `tasks/ai-monitoring-refinement-plan.md`.

**Core problem:** Students writing notes / reading textbooks below the camera are falsely flagged as `not_in_frame` with attention score crashing, even though they are actively engaged with the lesson.

**Phased rollout:**
- [ ] Phase 1 — Quick wins: temporal gating on `not_in_frame`, carry-forward score, new `writing_notes` + `brief_absence` states, UI badge "📝 Writing".
- [ ] Phase 2 — Writing-session context window (90s rolling), score floor, multi-face gating, yawn vs. drinking heuristic.
- [ ] Phase 3 — Reports: split engaged-with-notes vs. distracted in `lib/monitoring-reports.ts` + dashboard tabs.
- [ ] Phase 4 — AO settings: `monitoring_tuning` toggles (writing-aware, mobile-relaxed, exam-strict).
- [ ] Phase 5 — Advanced: low-visibility fallback, mobile thresholds, labeled-clip training pipeline, auto-calibration.

Target metrics: false-positive `not_in_frame` <5% (from ~40%), distraction-minute accuracy >90%.

## Feature 1: Unlimited Duration for Open Classrooms

**Current**: Duration input is a number field (15–480 min). Always required.
**Goal**: Add "Unlimited" toggle so OC can run with no time limit.

### Changes:
- [ ] **1a. Frontend — OpenClassroomTab.tsx**: Add "Unlimited" checkbox/toggle next to duration input. When checked, hide duration input and send `duration_minutes: 0` (or `null`).
- [ ] **1b. API — open-classroom/route.ts**: Accept `duration_minutes: 0` as "unlimited". Store 0 in DB.
- [ ] **1c. DB**: No migration needed — `duration_minutes INT DEFAULT 60` already allows 0.
- [ ] **1d. Display**: Anywhere that shows duration (detail view, classroom timer), show "Unlimited" when `duration_minutes === 0`.

---

## Feature 2: Full-Text Notifications in TeacherView

**Current**: Request panels (media, leave, rejoin, raised hand) use `truncate` CSS which clips long names/messages.
**Goal**: Show full readable text without ellipsis truncation.

### Changes:
- [ ] **2a. TeacherView.tsx**: Remove `truncate` class from request text spans. Use `whitespace-normal break-words` so messages wrap.
  - Line ~2266: Media requests
  - Line ~2321: Leave requests
  - Line ~2431: Rejoin requests
  - Line ~2484: Raised hands
  - Change `items-center` → `items-start` on parent rows so wrapped text aligns cleanly.

---

## Feature 3: Go-Live Flow for Open Classrooms

**Current**: OC auto-goes-live on first join. No staging state.
**Goal**: Teacher must explicitly "Go Live". Students see waiting/lobby until teacher goes live.

### Changes:
- [ ] **3a. Join API (open-classroom/[token]/join/route.ts)**:
  - Teacher joins → create LiveKit room, but keep OC status `'created'` (don't auto-set to `'live'`).
  - Student joins when OC `'created'` → return `{ waiting: true }` (lobby).
  - Student joins when OC `'live'` → normal flow (LiveKit token).

- [ ] **3b. Go-Live API (new: open-classroom/[token]/go-live/route.ts)**:
  - POST: Teacher goes live → `status = 'live'`, `started_at = NOW()`.
  - Updates `rooms.status = 'live'`, `go_live_at = NOW()`.
  - Verify caller is teacher (host_token).

- [ ] **3c. TeacherView — OC Go Live button**:
  - If OC room + status `'created'` → show "Go Live" button.
  - POST to go-live API → update state.

- [ ] **3d. OpenClassroomClient.tsx — Student waiting UI**:
  - If join returns `{ waiting: true }` → show "Waiting for teacher to start…"
  - Poll OC status every 5s. Once `'live'` → auto-rejoin.

---

## Feature 4: Join Permission / Approval for Open Classrooms

**Current**: Anyone with link enters directly (time + payment gates only).
**Goal**: Teacher gets popup to approve/deny entry. Also auto-approve toggle.

### Changes:
- [ ] **4a. DB Migration (079_oc_join_approval.sql)**:
  - `ALTER TABLE open_classrooms ADD COLUMN auto_approve_joins BOOLEAN DEFAULT true;`
  - `ALTER TABLE open_classroom_participants ADD COLUMN approval_status TEXT DEFAULT 'auto_approved';`
    - Values: `'pending' | 'approved' | 'denied' | 'auto_approved'`

- [ ] **4b. OpenClassroomTab.tsx — Creation form**:
  - Add "Auto-approve joins" toggle (default ON).
  - Send `auto_approve_joins` to POST API.

- [ ] **4c. OC Creation API**: Store `auto_approve_joins`.

- [ ] **4d. Join API changes**:
  - `auto_approve_joins = true` → direct join (current flow).
  - `auto_approve_joins = false` + student → insert with `approval_status = 'pending'`, send data channel msg to teacher, return `{ waiting_approval: true, participant_id }`.

- [ ] **4e. Approval API (new: open-classroom/[token]/approve-join/route.ts)**:
  - POST `{ participant_id, action: 'approve' | 'deny' }`.
  - Updates DB, sends data channel response to waiting participant.

- [ ] **4f. TeacherView — Join approval panel**:
  - Listen for `join_request` data channel messages.
  - Show "{name} wants to join" + Approve/Deny buttons.
  - "Auto-approve all" toggle in teacher controls.

- [ ] **4g. OpenClassroomClient.tsx — Waiting for approval UI**:
  - `{ waiting_approval: true }` → "Waiting for teacher approval…" screen.
  - Poll/listen for approval. On approved → get LiveKit token → redirect.
  - On denied → show "Entry denied" message.

---

## Implementation Order

1. **Feature 2** (notification text fix) — smallest, standalone CSS
2. **Feature 1** (unlimited duration) — simple UI + API
3. **Feature 3** (go-live flow) — medium, changes join logic
4. **Feature 4** (join approval) — most complex, builds on go-live

---

## Bug Fix: Flutter App Screen Share Not Showing in OC Sessions

**Reported**: Flutter teacher tablet screen share not visible to students (especially iPhones) in OC sessions, but works in normal batch sessions.

### Root Cause Chain (3 bugs):

1. **`/api/v1/room/join` — Time check blocks live rooms** (Critical)
   - The batch join route checks `scheduled_start + duration_minutes` and returns "class ended" for ALL users — even teachers — even when `rooms.status = 'live'`.
   - The Flutter app uses this route (not the OC join endpoint) since it treats OC rooms like any other room.
   - **Fix**: Skip time check when `room.status === 'live'`.

2. **OC rooms upsert — duration falsy bug** (Amplifier)
   - `Number(classroom.duration_minutes) || 60` treats `0` (unlimited) as falsy, stores `60` in the rooms table.
   - This gives unlimited OC rooms a false 60-minute time limit in the rooms table.
   - **Fix**: Use `classroom.duration_minutes != null ? Number(classroom.duration_minutes) : 60`.

3. **OpenClassroomClient.tsx — Hardcoded device** (Web client bug)
   - `sessionStorage.setItem('device', 'primary')` ignores API response.
   - Should use `d.device || 'primary'` (like the batch JoinRoomClient does).

### Files Changed:
- [x] `app/api/v1/room/join/route.ts` — Skip time-expired check for live rooms
- [x] `app/api/v1/open-classroom/[token]/join/route.ts` — Fix duration falsy bug in rooms upsert
- [x] `app/open-classroom/[token]/OpenClassroomClient.tsx` — Use API response device value

Deploy after each feature.
- Added `demo_agent` grant set: `roomJoin:true`, `canPublish:true`, `canPublishData:true`, `canSubscribe:true`, `hidden:false`

### Phase 2: API Layer

#### 4. External API — `app/api/v1/external/create-demo-link/route.ts`
- Accepts optional `agent_email`, `agent_name`, `agent_phone` in request body
- Stores agent fields in `demo_requests` row

#### 5. Accept Handler — `app/api/v1/demo/requests/route.ts` (PATCH)
- Detects agent presence (`hasAgent` flag from `demoReq.agent_email`)
- Sets `max_participants=3` when agent present (was hardcoded 2)
- Creates 3rd `room_assignments` row with `participant_type='demo_agent'`
- Generates agent join code (20-char hex)
- Sends agent notification email + WhatsApp

#### 6. Join Route — `app/api/v1/room/join/route.ts`
- Added ordered admission for demo rooms: checks if agent assignment exists, then verifies agent is connected via `listParticipants()` before allowing student to join
- Returns `AGENT_NOT_JOINED` error code when student tries to join before agent

### Phase 3: Client Layer

#### 7. JoinRoomClient — `app/(portal)/join/[room_id]/JoinRoomClient.tsx`
- Added `AGENT_NOT_JOINED` to auto-poll trigger list (alongside `CLASS_NOT_LIVE`, `SESSION_NOT_STARTED`)

#### 8. ClassroomWrapper — `components/classroom/ClassroomWrapper.tsx`
- Imported `AgentDemoView` component
- Added `role === 'demo_agent'` route before ghost roles

#### 9. AgentDemoView — `components/classroom/AgentDemoView.tsx` (NEW ~190 lines)
- Split view: teacher (left) + student (right) grid
- Screen share detection (fills top area when active)
- Self-view PIP (bottom-right)
- Chat sidebar toggle
- Mic/camera controls via ControlBar (student-level grants)
- Timer, "Sales Agent" badge, Leave button

### Phase 4: Email + CRM

#### 10. Email Template — `lib/email-templates.ts`
- Added `demoAgentJoinTemplate()` — "Demo Session — You're Invited! 🎯"
- Includes warning: "Join BEFORE the student"

#### 11. CRM Integration (Stibe CRM) — `lib/integrations/stibe.ts`
- Added `agent_email`, `agent_name`, `agent_phone` to `CreateDemoLinkParams`

#### 12. CRM Send Demo Route (Stibe CRM) — `app/api/v1/crm/leads/[id]/send-demo/route.ts`
- Resolves `lead.assigned_to` UUID → `users.email`, `users.full_name`, `users.agent_phone`
- Passes agent details to `createstibeDemoLink()`

---

## Verification
- [x] TypeScript passes: `npx tsc --noEmit` — zero errors (both projects)
- [ ] Run migration on production
- [ ] Deploy stibe Portal
- [ ] Deploy Stibe CRM
- [ ] End-to-end test: CRM sends demo → teacher accepts → agent joins → student joins

## Summary
Added payment link and invoice download option to WhatsApp invoice notifications. When a user receives an invoice on WhatsApp, they get two CTA buttons: **Pay Now** (opens Razorpay payment gateway directly, no login) and **View Invoice** (opens the full invoice PDF, no login).

---

## Changes

### 1. Public Invoice PDF Route — Token-Based Auth
**File:** `app/api/v1/payment/invoice-pdf/[id]/route.ts`
- Added dual auth: session cookie OR `?t=HMAC_TOKEN` query param
- Public access via token shows "Pay Now" button on unpaid invoices
- Same HTML invoice for both auth methods

### 2. Invoice URL Generator
**File:** `lib/pay-token.ts`
- Added `buildInvoiceUrl(invoiceId)` → `{baseUrl}/api/v1/payment/invoice-pdf/{id}?t={token}`
- Uses same HMAC-SHA256 token as `buildPayUrl()`

### 3. WhatsApp CTA Button Support
**File:** `lib/whatsapp.ts`
- `metaSendTemplate()` now accepts optional `buttonUrls: MetaButtonUrl[]`
- Generates `button` components with `sub_type: 'url'` for CTA URL buttons
- `fireWhatsApp()` forwards `waButtonUrls` to `metaSendTemplate()`
- Mock logging shows button URL suffixes

### 4. Email Service — Button URL Threading
**File:** `lib/email.ts`
- `SendEmailOptions` extended with `waButtonUrls?: MetaButtonUrl[]`
- `sendInvoiceGenerated()` auto-generates button URL suffixes from `invoiceId`
- Uses `stibe_invoice_pay` template (with CTA buttons) when `invoiceId` is available

### 5. Meta WhatsApp Template
- Registered `stibe_invoice_pay` (ID: 2472869023162701)
- 4 body params: name, invoice number, amount, due date
- 2 CTA URL buttons: "Pay Now" → `/pay/{id}?t={token}`, "View Invoice" → `/api/v1/payment/invoice-pdf/{id}?t={token}`
- Status: PENDING approval (UTILITY category)

### 6. All Invoice Callers Updated
- `finalize-invoices`: passes `invoiceId`, uses `buildInvoiceUrl()` for email link
- `generate-monthly`: captures INSERT RETURNING id, uses `buildPayUrl()` instead of static dashboard URL
- `session-extension`: passes `invoiceId`

---

## Flow
```
Invoice Created → sendInvoiceGenerated(data + invoiceId)
  ├── Email: Pay Now + View Invoice buttons in HTML
  └── WhatsApp: stibe_invoice_pay template
       ├── Body: "Hi {name}, invoice {number}, {amount}, due {date}"
       ├── Button 0: "Pay Now" → /pay/{id}?t={token} → Razorpay
       └── Button 1: "View Invoice" → /api/v1/payment/invoice-pdf/{id}?t={token}
```

---

## Previous Task

# Timezone-Aware Session Scheduling — Implementation Complete

## Summary
Added timezone-aware time display throughout the session scheduling workflow. Students' local times (based on their region) are now shown when scheduling sessions, and email/WhatsApp notifications are personalized with each recipient's local time.

---

## Changes

### 1. Region Timezone Utility — `lib/region-timezone.ts` (NEW)
- `REGION_UTC_OFFSETS` — maps 15 regions to UTC offset minutes
- `REGION_FLAGS` / `REGION_TZ_LABELS` — display metadata per region
- `istToRegionTime(time24, region)` — converts IST 24h time to any region's 12h time
- `groupStudentsByTimezone(regions)` — groups student regions with counts

### 2. Schedule Session Modal — Timezone Breakdown
**File:** `AcademicOperatorDashboardClient.tsx`
- Fetches batch students with regions when batch is selected
- **Schedule step**: Each subject card shows all non-IST student timezone groups with local times + student count (e.g. "🇦🇪 7:30 AM – 9:00 AM GST (5)")
- **Review step**: Same timezone breakdown per subject + "Student Timezones" distribution section in Participants area showing region, timezone label, and count per group

### 3. Session Reminder Route — Per-Recipient Local Times
**File:** `app/api/v1/batch-sessions/session-reminder/route.ts`
- Student query now JOINs `user_profiles` to fetch `assigned_region`
- Each recipient gets `localTime` computed from their region
- Teacher/coordinator get IST (no conversion), students/parents get their region's local time

### 4. Email Template — Dual Time Display
**File:** `lib/email-templates.ts`
- `SessionReminderData` interface: added `localTime` and `localTimezone` optional fields
- Email banner: shows local time prominently with timezone label, IST below in gray
- Info table: shows "8:30 AM (Dubai) — IST: 10:00 AM" format for non-IST recipients
- Plain text and subject line also use local time when available

### 5. WhatsApp — Local Time in Params
**File:** `app/api/v1/batch-sessions/session-reminder/route.ts`
- `waParams` array now passes local time (or IST fallback) as the time parameter
- No template change needed (Meta template uses positional params)

---

## Previous Task

### Live Session Exams + BC Live Monitor
(See git log for details)
9. **Post-class** — Sessions end, overview shows completed session summaries

---

## 2. Architecture

### Page Route

```
/batch-coordinator/live
```

New dedicated page (NOT a tab inside the dashboard). This is a full-screen, immersive command center.

Nav update: Add **"Live Monitor"** to BC nav (5th item, between Overview and Batches) with a `Monitor` or `Radio` icon + live pulse badge when sessions are active.

### Multi-Room LiveKit Strategy

**Key insight:** Each `<LiveKitRoom>` is a separate React context wrapping ONE room connection. For multi-room, we use **multiple `<LiveKitRoom>` providers** — one per live session.

```
┌─────────────────── BC Live Monitor Page ──────────────────┐
│                                                            │
│  ┌── LiveKitRoom (Physics) ──┐  ┌── LiveKitRoom (Chem) ──┐│
│  │  Teacher video + screen   │  │  Teacher video + screen ││
│  │  Student tiles (hidden)   │  │  Student tiles (hidden) ││
│  │  Data channels active     │  │  Data channels active   ││
│  └───────────────────────────┘  └─────────────────────────┘│
│                                                            │
│  ┌── LiveKitRoom (Maths) ──┐                              │
│  │  Teacher video + screen  │                              │
│  │  Student tiles (hidden)  │   [Alerts Panel]            │
│  │  Data channels active    │   [Requests Queue]          │
│  └──────────────────────────┘   [Teacher Reports]         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Token acquisition flow:**
1. On page load, fetch all live sessions for this BC:
   ```
   GET /api/v1/batch-coordinator/live-sessions
   ```
2. For each live session, call:
   ```
   POST /api/v1/room/join  (with session's room_id)
   ```
   → Gets LiveKit token with BC grants: `{ canSubscribe: true, canPublish: false, hidden: true }`
3. Connect each `<LiveKitRoom>` with its own token + wsUrl
4. Poll for new sessions every 30s (new classes starting)

**Bandwidth management:**
- Overview mode: Subscribe to teacher screen share + camera only (skip student video)
- Focus mode: Subscribe to ALL tracks in that room (students become visible)
- Use simulcast: request LOW quality in overview, HIGH in focus

---

## 3. UI Layout — Three Modes

### Mode 1: Session Grid (Default)

```
┌──────────────────────────────────────────────────────────┐
│  🔴 Live Monitor          3 sessions live    [Settings]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─── Physics 11A ───┐  ┌─── Chemistry 12B ──┐  ┌───┐  │
│  │ ╔═══════════════╗  │  │ ╔═══════════════╗  │  │   │  │
│  │ ║  Screen Share  ║  │  │ ║  Screen Share  ║  │  │ M │  │
│  │ ║  (Whiteboard)  ║  │  │ ║  (Whiteboard)  ║  │  │ a │  │
│  │ ║    ┌─────┐    ║  │  │ ║    ┌─────┐    ║  │  │ t │  │
│  │ ║    │Tchr │    ║  │  │ ║    │Tchr │    ║  │  │ h │  │
│  │ ║    │ PiP │    ║  │  │ ║    │ PiP │    ║  │  │ s │  │
│  │ ║    └─────┘    ║  │  │ ║    └─────┘    ║  │  │   │  │
│  │ ╚═══════════════╝  │  │ ╚═══════════════╝  │  │ . │  │
│  │                      │  │                      │  │ . │  │
│  │ 👥 15 students       │  │ 👥 8 students        │  │ . │  │
│  │ 🟢 92% engagement   │  │ 🟡 74% engagement    │  │   │  │
│  │ ⚠️ 1 alert           │  │                      │  │   │  │
│  └──────────────────────┘  └──────────────────────┘  └───┘  │
│                                                              │
│  ── Alerts Bar ──────────────────────────────────────────── │
│  🔴 Student X (Physics 11A) — eyes closed 2 min             │
│  🟡 Teacher Y requested end class early                      │
│  🔴 ABUSE REPORT: Student Z reported teacher (Chemistry 12B)│
└──────────────────────────────────────────────────────────────┘
```

Each session card shows:
- **WhiteboardComposite** — teacher's screen share with camera PiP cutout (same as student view)
- Batch name + subject + teacher name
- Student count + engagement score badge
- Active alert count
- Click to enter **Focus Mode**

### Mode 2: Focus Mode (Single Session Deep Dive)

When BC clicks a session card, it expands to fill the screen:

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Grid    Physics 11A — Mr. Kumar    🔴 LIVE   │
├───────────────────────────────────┬──────────────────────┤
│                                   │                      │
│  ╔═════════════════════════════╗  │  STUDENTS (15)       │
│  ║                             ║  │  ┌────┐ ┌────┐      │
│  ║     Screen Share            ║  │  │ S1 │ │ S2 │      │
│  ║     (Full whiteboard)       ║  │  │🟢95│ │🟡62│      │
│  ║                             ║  │  └────┘ └────┘      │
│  ║          ┌──────────┐       ║  │  ┌────┐ ┌────┐      │
│  ║          │ Teacher  │       ║  │  │ S3 │ │ S4 │      │
│  ║          │  Camera  │       ║  │  │🔴28│ │🟢88│      │
│  ║          │  PiP     │       ║  │  └────┘ └────┘      │
│  ║          └──────────┘       ║  │  ┌────┐ ┌────┐      │
│  ╚═════════════════════════════╝  │  │ S5 │ │ S6 │      │
│                                   │  │🟢91│ │🟡55│      │
│  ⏱ 45:12 elapsed  📊 87% avg     │  └────┘ └────┘      │
│                                   │  ... 9 more          │
├───────────────────────────────────┤                      │
│  💬 Chat  👥 Requests  📊 AI     │  [Click tile for     │
│  [Live chat messages scroll]      │   student detail]    │
└───────────────────────────────────┴──────────────────────┘
```

Focus mode shows:
- **Full WhiteboardComposite** with teacher PiP (reuse existing component)
- **Student video grid** — all student camera tiles with attention badges
  - 🟢 Green (score >= 80) | 🟡 Amber (50-79) | 🔴 Red (< 50 or alert state)
  - Badge shows: score number, alert icons (sleeping/away/tab-switched)
- **Bottom tabs**: Chat (read-only), Requests (end-class, media), AI Monitoring (attention timeline)
- Click student tile → `StudentDetailPanel` slides in (reuse from CoordinatorLiveView)
- **Actions**: Approve/deny end-class, approve/deny media requests

### Mode 3: All Students View

A panoramic view of ALL student tiles across ALL live sessions:

```
┌──────────────────────────────────────────────────────────┐
│  👥 All Students    Filter: [All Sessions ▾]  [Sort ▾]   │
├──────────────────────────────────────────────────────────┤
│  ── Physics 11A (15 students) ────────────────────────── │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │ S1 │ │ S2 │ │ S3 │ │ S4 │ │ S5 │ │ S6 │ │ S7 │     │
│  │🟢95│ │🟡62│ │🔴28│ │🟢88│ │🟢91│ │🟡55│ │🟢82│     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │ S8 │ │ S9 │ │S10│ │S11│ │S12│ │S13│ │S14│            │
│  │🟢79│ │🟢85│ │🔴35│ │🟡58│ │🟢92│ │🟢87│ │🟢90│     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
│                                                          │
│  ── Chemistry 12B (8 students) ──────────────────────── │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │ S1 │ │ S2 │ │ S3 │ │ S4 │ │ S5 │ │ S6 │ │ S7 │     │
│  │🟢88│ │🟢94│ │🟡65│ │🟢82│ │🟢95│ │🔴42│ │🟢78│     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
└──────────────────────────────────────────────────────────┘
```

- Grouped by session/batch
- Sort options: by attention score (worst first), by name, by session
- Filter by session
- Each tile: student video + name + attention score badge
- Click tile → popup with detail and student's session context

---

## 4. Data Channels & AI Monitoring

### Per-Room Data Channel Listeners

Each `<LiveKitRoom>` wrapper has its own `useDataChannel` hooks that collect:

| Channel | Data | Aggregated To |
|---------|------|---------------|
| `attention_update` | Per-student attention state | `Map<email, StudentAttentionState>` per room |
| `hand_raise` | Student raise/lower | Requests queue |
| `media_request` | Mic/camera on/off requests | Requests queue |
| `leave_request` | Student exit requests | Requests queue |

### Cross-Room Aggregator

A parent component (outside all `<LiveKitRoom>` providers) aggregates via callbacks:

```tsx
// Each RoomMonitor publishes its data upward
<RoomMonitor
  roomName={room.room_name}
  onAttentionUpdate={(roomId, studentMap) => updateGlobalAttention(roomId, studentMap)}
  onAlert={(roomId, alert) => addGlobalAlert(roomId, alert)}
  onRequest={(roomId, request) => addGlobalRequest(roomId, request)}
/>
```

### AI Alert Rules (client-side, same as existing CoordinatorLiveView)

| Trigger | Condition | Severity |
|---------|-----------|----------|
| Eyes closed | `monitorState === 'eyes_closed'` for > 60s | warning |
| Not in frame | `monitorState === 'not_in_frame'` for > 30s | warning |
| Tab switched | `monitorState === 'tab_switched'` | danger |
| Multiple faces | `faceCount > 1` | danger |
| Low engagement | `attentionScore < 40` for > 2 min | warning |
| Class avg drops | `classEngagement < 60%` | warning |

### Server-side Monitoring Polling

Every 15s, poll:
```
GET /api/v1/monitoring/session/{roomId}
```
For each active room. This provides:
- Class-level engagement score
- Per-student cumulated stats
- Server-generated alerts (distracted_duration, switch_count thresholds)

---

## 5. Teacher Reports & Abuse Alerts

### Real-time Alert Integration

Teacher reports submitted by students (`POST /api/v1/room/{room_id}/report-teacher`) need to appear INSTANTLY in the BC's command center.

**Two approaches (implement both):**
1. **Polling** — Every 10s: `GET /api/v1/teacher-reports?status=open&coordinator_email={bc}`
2. **Data channel** — When a report is submitted, broadcast via LiveKit data channel `teacher_report` to the room → BC receives it since they're subscribed

### UI: Alerts Drawer

A persistent alerts panel (right side or bottom bar) showing:

```
┌─ ALERTS ────────────────────────────────────────┐
│                                                  │
│ 🔴 CRITICAL — Student Abuse Report              │
│    Student: Rahul K. → Teacher: Mr. Sharma       │
│    Category: Abusive Language                     │
│    Batch: Chemistry 12B | 2 min ago              │
│    [View Details] [Start Investigation]          │
│                                                  │
│ 🟡 WARNING — Low Engagement                     │
│    Physics 11A class average dropped to 58%      │
│    5 students below 40% attention                │
│    [View Students]                               │
│                                                  │
│ 🟡 REQUEST — End Class Early                    │
│    Teacher: Mr. Kumar (Physics 11A)              │
│    Reason: "Completed syllabus for today"        │
│    [Approve] [Deny]                              │
│                                                  │
│ 🔵 INFO — Media Request                         │
│    Student: Priya S. wants to unmute mic         │
│    Batch: Maths 10C                              │
│    [Allow] [Deny]                                │
└──────────────────────────────────────────────────┘
```

---

## 6. Component Architecture

```
app/(portal)/batch-coordinator/live/
  page.tsx                          ← Server component, auth guard
  LiveMonitorClient.tsx             ← Main client component

components/classroom/
  RoomMonitor.tsx                   ← Per-room LiveKit wrapper
    - Wraps <LiveKitRoom>
    - Extracts teacher video, screen share, student videos
    - Listens to data channels
    - Reports data upward via callbacks
  SessionCard.tsx                   ← Grid card for a session (overview mode)
  FocusView.tsx                     ← Single-session deep dive
  AllStudentsView.tsx               ← Panoramic student grid
  AlertsPanel.tsx                   ← Cross-session alerts drawer
  RequestsPanel.tsx                 ← Pending requests queue
```

### Component Hierarchy

```
LiveMonitorClient
  ├── Header (session count, mode toggle, settings)
  ├── AlertsBar (bottom ticker or side panel)
  │
  ├── [Mode: Grid]
  │   └── SessionCard[] (one per live session)
  │       └── RoomMonitor (inside LiveKitRoom)
  │           ├── WhiteboardComposite (screen share + teacher PiP)
  │           └── Data channel listeners
  │
  ├── [Mode: Focus]
  │   └── FocusView
  │       └── RoomMonitor (inside LiveKitRoom, full quality)
  │           ├── WhiteboardComposite (large)
  │           ├── StudentGrid (video tiles + attention badges)
  │           ├── ChatPanel (read-only)
  │           └── RequestsPanel (end-class, media)
  │
  └── [Mode: Students]
      └── AllStudentsView
          └── Per-room student tiles (video + attention)
```

---

## 7. API Requirements

### Existing APIs (reuse as-is)

| API | Purpose |
|-----|---------|
| `GET /api/v1/batch-sessions` | List sessions for BC's batches |
| `POST /api/v1/room/join` | Get LiveKit token for a room |
| `GET /api/v1/monitoring/session/{roomId}` | Per-room monitoring data |
| `GET /api/v1/monitoring/alerts` | Active alerts |
| `POST /api/v1/monitoring/alerts` | Dismiss alerts |
| `GET /api/v1/teacher-reports` | List teacher abuse reports |
| `PATCH /api/v1/teacher-reports` | Update report status |

### New API Needed

**`GET /api/v1/batch-coordinator/live-sessions`**

Returns all currently live sessions for this BC with room details:

```json
{
  "sessions": [
    {
      "session_id": "...",
      "batch_id": "...",
      "batch_name": "Physics 11A",
      "subject": "Physics",
      "teacher_email": "kumar@...",
      "teacher_name": "Mr. Kumar",
      "room_name": "lk_room_xyz",
      "status": "live",
      "started_at": "2026-03-15T10:00:00Z",
      "duration_minutes": 90,
      "student_count": 15
    }
  ]
}
```

Query:
```sql
SELECT s.session_id, s.batch_id, b.batch_name, s.subject,
       s.teacher_email, s.teacher_name, s.livekit_room_name,
       s.status, s.started_at, s.duration_minutes,
       (SELECT COUNT(*) FROM batch_students WHERE batch_id = s.batch_id) as student_count
FROM batch_sessions s
JOIN batches b ON b.batch_id = s.batch_id
WHERE b.coordinator_email = $1
  AND s.status = 'live'
ORDER BY s.started_at;
```

---

## 8. Build Sequence (Checklist)

### Phase 1: Foundation
- [ ] Create `/batch-coordinator/live/page.tsx` (auth guard, server component)
- [ ] Create `LiveMonitorClient.tsx` (main client component with state management)
- [ ] Create `RoomMonitor.tsx` (per-room `<LiveKitRoom>` wrapper with data extraction)
- [ ] New API: `GET /api/v1/batch-coordinator/live-sessions`
- [ ] Update nav-config: add "Live Monitor" to BC nav

### Phase 2: Session Grid (Default Mode)
- [ ] `SessionCard.tsx` — WhiteboardComposite + stats overlay
- [ ] Multi-room connection manager (fetch tokens, connect/disconnect lifecycle)
- [ ] Engagement score badges per session
- [ ] Auto-refresh: detect new live sessions, clean up ended ones

### Phase 3: Focus Mode
- [ ] `FocusView.tsx` — Full session view with student grid
- [ ] Student video tiles with attention score badges
- [ ] StudentDetailPanel integration (click-to-zoom)
- [ ] Chat panel (read-only)
- [ ] End-class approve/deny
- [ ] Media request approve/deny

### Phase 4: All Students View
- [ ] `AllStudentsView.tsx` — All students across sessions
- [ ] Group by session
- [ ] Sort by attention score
- [ ] Filter by session

### Phase 5: Alerts & Reports
- [ ] `AlertsPanel.tsx` — Cross-session alerts aggregation
- [ ] AI monitoring alerts (from data channels)
- [ ] Teacher abuse report alerts (polling + display)
- [ ] Report actions (start investigation, dismiss)
- [ ] Request actions (approve/deny end-class, media)

### Phase 6: Polish
- [ ] Live pulse indicator in nav when sessions active
- [ ] Connection quality indicators per room
- [ ] Graceful reconnection handling
- [ ] Session ended → remove from grid with notification
- [ ] Performance: lazy-mount video tiles, unmount off-screen

---

## 9. Key Technical Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Multi-room approach | Multiple `<LiveKitRoom>` providers | Clean React integration, each room is isolated, hooks work naturally inside each |
| Video quality in overview | Simulcast LOW | Bandwidth: 3+ sessions x teacher screen + teacher cam x LOW = manageable |
| Student video in overview | NOT subscribed | Only subscribe to student tracks when entering Focus/Students mode |
| Token refresh | Re-fetch every 15 min | LiveKit tokens expire; poll /room/join for fresh tokens |
| New sessions polling | Every 30s | Check for newly started sessions, add to grid |
| Alert delivery | Data channels + API polling hybrid | Data channels for instant alerts, API polling as backup every 10s |
| State management | React state + refs | No external store needed; callback-based cross-room aggregation |
| Page vs tab | Separate page `/batch-coordinator/live` | Full-screen immersive experience, not cramped inside dashboard |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Too many video streams (5+ rooms x teacher cam + screen) | Browser lag, high bandwidth | Simulcast LOW quality + unmount hidden rooms + max 6 sessions visible |
| LiveKit token expiry mid-session | Disconnection | Auto-refresh tokens every 15 min before expiry |
| Student data channels from 50+ students across rooms | CPU overhead | Throttle attention updates to 1/3s, batch state updates with requestAnimationFrame |
| BC loses internet briefly | Rooms disconnect | LiveKit auto-reconnect + show reconnecting indicator |
| No live sessions (off-hours) | Empty page | Show "No live sessions" with next scheduled session info |

---

**Estimated new files:** 7 (1 page, 1 API, 5 components)
**Estimated lines:** ~2,000-2,500 (heavy reuse of WhiteboardComposite, VideoTile, StudentDetailPanel, AlertsPanel patterns)
**Reused components:** WhiteboardComposite, TeacherOverlay, VideoTile, StudentDetailPanel, ChatPanel, shared.tsx utilities

---

# (Previous plans archived below)

## Gap Analysis (PDF vs Current Implementation)

### Truly Missing Features (3 items):
1. **Teacher Post-Session Form** — Class portion + remarks form on the teacher's ended page
2. **Recording Start/Stop UI** — Teacher control to start/stop recording in ControlBar
3. **Student Recording Playback** — Student dashboard section to view past recordings

### Already Implemented (confirmed present):
- ✅ Homework grading (HomeworkPanel `action: 'grade'`)
- ✅ Contact detection (lib/contact-detection.ts + ChatPanel integration)
- ✅ Join log monitoring (attendance API with full event timeline)
- ✅ Session report auto-generation (lib/reports.ts `autoGenerateSessionReport`)
- ✅ Recording backend (lib/recording.ts with LiveKit egress)
- ✅ Class portion/remarks PATCH API + DB columns
- ✅ Class portion display (student + parent dashboards)

---

## Implementation Tasks

### ✅ Task 1: Teacher Post-Session Form (ended page) — DONE (`362cfb5`)
- Added class_portion + class_remarks form to teacher's ended page
- PATCHes `/api/v1/room/{roomId}` on submit
- Shows after "Session Ended" for non-demo teachers
- Fields: Topics Covered (text input), Remarks (textarea), Skip/Save buttons

### ✅ Task 2: Recording Start/Stop UI (ControlBar) — DONE (`362cfb5`)
- Added RecordIcon + recording toggle button to ControlBar (red pulsing when active)
- Created `POST/DELETE /api/v1/room/{roomId}/recording` API route
- Room GET now returns `recording_status` for state restoration on refresh
- TeacherView wires isRecording state + handleToggleRecording handler

### ✅ Task 3: Student Recording Playback (student dashboard) — DONE (`362cfb5`)
- Added `recording_url` to student sessions SQL query + SessionData interface
- Ended sessions with recordings show indigo "Watch Recording" button (PlayCircle icon)
- Uses existing `getStudentRecordings()` from lib/recording.ts

---

+# Daily Session Exam — AI-Powered Topic Exams

## Feature Overview

Academic Operators upload exam topics (PDF) by grade + subject + topic. AI (Google Gemini) auto-generates 20 MCQ questions from the uploaded topic. Teachers in live sessions can select a topic and start exam (last 10 mins or manual). Students take the exam like demo exams (MCQ, 30s timer, auto-advance). Proper reports, marks, parent notifications.

---

## Architecture

```
AO uploads PDF topic
        │
        ▼
POST /api/v1/session-exam-topics  ──►  Store PDF + metadata
        │
        ▼
AI Question Generation (Gemini)   ──►  Generate 20 MCQs from PDF
        │
        ▼
Store in session_exam_questions table
        │
        ▼
Teacher live room sees topics     ──►  Filtered by batch subject + grade
        │
        ▼
Teacher clicks "Start Exam"       ──►  Data channel: 'start_session_exam'
        │                                {action:'start', topic_id, exam_title}
        ▼
Student receives exam start       ──►  Opens /session-exam/[topicId]?session=X&student=Y
        │
        ▼
Student takes 20-question MCQ     ──►  30s per question, auto-advance
        │
        ▼
POST /api/v1/session-exam/submit  ──►  Grade + store in session_exam_results
        │
        ▼
exam_complete data channel        ──►  Teacher sees results in real-time
        │
        ▼
Email + WhatsApp to parents       ──►  Exam report notification
```

---

## Database Schema (Migration 028)

### Table 1: `session_exam_topics`
```sql
CREATE TABLE session_exam_topics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,              -- "Quadratic Equations"
  subject           TEXT NOT NULL,              -- "Mathematics"
  grade             TEXT NOT NULL,              -- "10"
  topic_description TEXT,                       -- optional notes
  pdf_url           TEXT,                       -- /uploads/exam-topics/xyz.pdf
  pdf_filename      TEXT,
  question_count    INT NOT NULL DEFAULT 20,
  status            TEXT NOT NULL DEFAULT 'generating'
                    CHECK (status IN ('generating','ready','failed','archived')),
  error_message     TEXT,                       -- if AI generation failed
  uploaded_by       TEXT NOT NULL,              -- AO email
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Table 2: `session_exam_questions`
```sql
CREATE TABLE session_exam_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      UUID NOT NULL REFERENCES session_exam_topics(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options       TEXT[] NOT NULL,               -- 4 options array
  correct_answer INT NOT NULL,                 -- 0-indexed
  marks         INT NOT NULL DEFAULT 1,
  difficulty    TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Table 3: `session_exam_results`
```sql
CREATE TABLE session_exam_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          UUID NOT NULL REFERENCES session_exam_topics(id) ON DELETE CASCADE,
  session_id        TEXT REFERENCES batch_sessions(session_id) ON DELETE SET NULL,
  room_id           TEXT REFERENCES rooms(room_id) ON DELETE SET NULL,

  -- Student info
  student_email     TEXT NOT NULL,
  student_name      TEXT NOT NULL,
  student_grade     TEXT,
  parent_email      TEXT,

  -- Teacher info
  teacher_email     TEXT,
  teacher_name      TEXT,

  -- Exam details
  subject           TEXT NOT NULL,
  topic_title       TEXT NOT NULL,
  total_questions   INT NOT NULL DEFAULT 20,
  answered          INT NOT NULL DEFAULT 0,
  skipped           INT NOT NULL DEFAULT 0,
  score             INT NOT NULL DEFAULT 0,
  total_marks       INT NOT NULL DEFAULT 20,
  percentage        NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade_letter      TEXT,
  time_taken_seconds INT,

  -- Per-question answers (JSONB)
  answers           JSONB NOT NULL DEFAULT '[]'::jsonb,

  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Implementation Steps

### Step 1: Migration 028
- [ ] Create `migrations/028_session_exams.sql`
- [ ] Run on production

### Step 2: AI Question Generation Service
- [ ] Install `@google/generative-ai` + `pdf-parse`
- [ ] Add `GEMINI_API_KEY` to .env
- [ ] Create `lib/ai-exam-generator.ts`

### Step 3: API Routes
- [ ] `POST /api/v1/session-exam-topics` — Upload + generate
- [ ] `GET /api/v1/session-exam-topics` — List topics
- [ ] `DELETE /api/v1/session-exam-topics/[id]` — Archive
- [ ] `GET /api/v1/session-exam/questions?topic_id=X` 
- [ ] `POST /api/v1/session-exam/submit` — Grade + store
- [ ] `GET /api/v1/session-exam/results?room_id=X`

### Step 4: AO Dashboard — Exam Topics Section
- [ ] Upload form: subject, grade, topic title, PDF file
- [ ] Topic cards with status badges
- [ ] Delete/archive action

### Step 5: Teacher Live Room — Exam Controls 
- [ ] Topic selector (filtered by session subject + grade)
- [ ] "Start Exam" button + data channel broadcast
- [ ] Real-time result display

### Step 6: Student Live Room — Exam UI
- [ ] `start_session_exam` data channel listener
- [ ] SessionExamDialog + new tab open
- [ ] SessionExamClient.tsx (20 questions, 30s each)
- [ ] `session_exam_complete` data channel on finish

### Step 7: Results & Parent Reports
- [ ] Grade calculation + email/WhatsApp to parents
- [ ] Results in AO dashboard

### Step 8: Build, Test, Deploy
- [ ] TypeScript check + build
- [ ] Deploy + run migration

### Fix Plan
- [ ] **API**: Add `original_subject` to ResolutionItem, enrich in `ao_forward`
- [ ] **Email**: Create `sessionSubstituteNotifyTemplate`, use for substitute actions
- [ ] **AO Dashboard**: Fix checkbox, add original_subject to addToPlan, guard subject_override, update all 3 view modes
- [ ] **HR Dashboard**: Use original_subject in detail view, fix subject display
- [ ] **Theme**: Brand colors (bg-primary) on all leave-related buttons (both dashboards)
- [ ] **Type-check + Deploy**

### Action × Display Matrix
| Action | Badge | Teacher | Subject | Date | Email Template |
|--------|-------|---------|---------|------|----------------|
| substitute | Blue "Substitute" | → New Teacher | Same subject | Same | sessionSubstituteNotify |
| substitute+override | Blue "Substitute" | → New Teacher | Purple: Old→New | Same | sessionSubstituteNotify |
| reschedule | Amber "Reschedule" | Same | Same | → New Date | sessionRescheduledNotify |
| cancel | Red "Cancel" | N/A | N/A | N/A | sessionCancelledNotify |

---

## Phase: Requests System Redesign (Phase 22)

### New Flows
1. Teacher Leave → AO approve → Manage affected sessions (substitute/cancel/reschedule)
2. Teacher requests session reschedule/cancel
3. Coordinator leave requests
4. Coordinator session change requests
5. Email + WhatsApp notifications for all flows

### Implementation
- [x] Migration 022: ALTER session_requests + teacher_leave_requests, CREATE leave_session_actions
- [x] API: session-requests allow teacher/coordinator submit
- [x] API: teacher-leave stop auto-cancel, add per-session management PATCH
- [x] AO Dashboard: Enhanced requests tab with affected sessions management 
- [x] Teacher Dashboard: Session change request feature (leave + session requests sub-views)
- [x] Coordinator Dashboard: Leave tab + session change requests
- [x] Email templates: verified existing templates cover all flows (cancel, reschedule, leave)
- [x] Nav config: coordinator Leave nav item added
- [ ] Deploy migration 022 + commit + push

---

## Phase: Student Session End Detection Fix (Phase 17)

### Bug: Student UI shows "Waiting for teacher" instead of "Session ended" when class ends
- [x] Root cause 1: No polling — student has no mechanism to detect room ended via DB status  
- [x] Root cause 2: LiveKit disconnect events may fire with unexpected/undefined reason → handler ignores and waits for reconnect  
- [x] Root cause 3: When teacher disconnects + timer expires, fallback UI still shows "Waiting for teacher"  
- [x] Fix 1: Room status polling every 10s in StudentView — auto-navigates when `status === 'ended'`  
- [x] Fix 2: New "Session has ended" fallback UI when `roomEnded || (isExpired && !teacher && isSessionLive)`  
- [x] Fix 3: ClassroomWrapper checks room status on unexpected disconnect reasons instead of silently ignoring  
- [ ] Deploy + verify

### Files Changed (2)
- `components/classroom/StudentView.tsx` — Periodic room status poll (10s), `roomEnded` state, "Session has ended" fallback UI
- `components/classroom/ClassroomWrapper.tsx` — `handleDisconnected` now checks room API on unexpected disconnect reasons

---

## Phase: Post-Demo Summary Notifications (Phase 18)

### Feature: Send comprehensive email+WA summary to teacher, AO, and student after demo session ends
- [x] Data collector: Gathers session info, attendance, AI engagement, alerts, exam results, student feedback
- [x] Teacher template: Full detailed report with engagement bars, exam question breakdown, alerts, feedback
- [x] AO template: Conversion-focused view with lead details, conversion signals, engagement + exam data
- [x] Student template: Encouraging tone with exam review, focus score, CTA to continue learning
- [x] Wired into DELETE /api/v1/room/{room_id} — fire-and-forget after demo room ends
- [ ] Deploy + verify

### Data Included in Summary
- Session: subject, grade, topics, scheduled/ended times, outcome
- Attendance: time in session, punctuality (late?), rejoin count
- AI Engagement: attention score, visual bars (attentive/looking away/distracted/eyes closed/out of frame/phone)
- Alerts: all monitoring alerts fired during session
- Exam: score, percentage, grade, time taken, per-question breakdown with correct vs student answers
- Feedback: star rating, text, tags
- AO conversion signal: automatic analysis (high potential / good feedback / engaged / low rating)

### Files Changed (3)
- `lib/demo-summary.ts` — NEW: `collectDemoSummary()` data collector + `sendDemoSummaryNotifications()` sender
- `lib/email-templates.ts` — NEW: `demoSummaryTeacherTemplate`, `demoSummaryAOTemplate`, `demoSummaryStudentTemplate`
- `app/api/v1/room/[room_id]/route.ts` — Import + fire-and-forget call to `sendDemoSummaryNotifications`

---

## Phase: Demo AI Monitoring Fix (Mar 7, 2026)

### Bug: AI monitoring not working in demo live sessions (works in normal sessions)
- [x] Root cause: Demo students join via `email_token` (no login) → no `stibe-session` cookie set
- [x] `POST /api/v1/monitoring/events` requires session cookie → returns 401 for demo students
- [x] Data channel (real-time attention to teacher) works — but server-side monitoring (alerts, persistence) fails silently
- [x] Fix: Set session cookie in `POST /api/v1/room/join` response when user authenticates via `email_token`
- [ ] Deploy + verify

### Files Changed (1)
- `app/api/v1/room/join/route.ts` — Import `signSession`, track `needsSessionCookie` flag, set `stibe-session` cookie for email-token users

---

## Phase: Demo Bug Fixes + Nginx Routing (Mar 6, 2026)

### Nginx Domain Routing
- [x] `stibelearning.online` was falling through to ERP (no Nginx server block)
- [x] Created `/etc/nginx/sites-available/stibe-online` → port 3000 (Portal)
- [x] Self-signed origin SSL cert at `/etc/ssl/stibe-portal/` (Cloudflare handles public SSL)
- [x] Verified: `stibelearning.online` → Portal, `stibelearning.net` → ERP

### Bug 1: Demo student WhatsApp not received after form submission
- [x] Root cause: `lookupPhone()` only checked `user_profiles` — demo students not in portal
- [x] Fix: Added 3-tier phone resolution: overridePhone → user_profiles → demo_requests.student_phone
- [x] Added `recipientPhone` field to `SendEmailOptions` interface
- [x] Demo form route now passes `recipientPhone: cleanPhone`

### Bug 2: Demo student WhatsApp not received after teacher accepts
- [x] Root cause: Same as Bug 1 — student not in user_profiles
- [x] Fix: Demo accept route passes `recipientPhone: studentPhone` from demo_requests

### Bug 3: "Missing session data" when teacher starts demo room
- [x] Root cause: TeacherDemoTab navigated to `/classroom/` without setting sessionStorage
- [x] Fix (accept): Store PATCH response token data in sessionStorage, auto-navigate
- [x] Fix (revisit): "Go to Demo Room" / "Join Live Demo" buttons call `/api/v1/room/join` for fresh token

### Deploy
- [x] TypeScript check: 0 errors
- [x] Production build: SUCCESS
- [x] Git commit `80c6c85`, pushed to origin/master
- [x] Deployed to production, PM2 restarted

### Files Changed (5)
- `lib/whatsapp.ts` — `lookupPhone()` 3-tier + `fireWhatsApp()` overridePhone param
- `lib/email.ts` — `recipientPhone` in SendEmailOptions + mirrorToWhatsApp
- `app/api/v1/demo/[linkId]/route.ts` — recipientPhone on student email
- `app/api/v1/demo/requests/route.ts` — recipientPhone on accepted email
- `components/dashboard/TeacherDemoTab.tsx` — sessionStorage + room/join flow

---

## Phase: WhatsApp Full Integration (Mar 6, 2026)

### Architecture
- [x] Add `waTemplate` + `waParams` to `SendEmailOptions` (structured params, no regex)
- [x] Update `fireWhatsApp()` to accept direct params (priority over regex extraction)
- [x] Add standalone `sendWA()` function for direct WA sends

### Files Updated  
- [x] `lib/whatsapp.ts` — core WA send with direct params
- [x] `lib/email.ts` — 15 convenience wrappers with `waTemplate` + `waParams`
- [x] `teacher-leave/route.ts` — 5 calls with leave templates
- [x] `session-requests/route.ts` — 5 calls with session templates  
- [x] `hr/users/route.ts` + `reset-password/route.ts` — onboarding template
- [x] `demo/[linkId]/route.ts` + `demo/requests/route.ts` — demo templates
- [x] `batch-sessions/` (weekly, daily, reminder) — schedule templates
- [x] `coordinator/rooms/[room_id]/notify/route.ts` — class templates
- [x] `lib/room-notifications.ts` — creation, reminder, go-live templates
- [x] `lib/timetable-auto.ts` — weekly schedule template
- [x] Skipped: `forgot-password` (OTP), `contact-violation` (internal)

### Approved Templates (11)
stibe_class_rescheduled(6), stibe_demo_confirmed(5), stibe_demo_waiting(2),
stibe_leave_impact(4), stibe_leave_req(4), stibe_leave_update(4),
stibe_onboarding(4), stibe_payment_due(5), stibe_receipt(4),
stibe_request_update(4), stibe_weekly_schedule(3)

### Pending Templates (17)
stibe_batch_assign, stibe_class_cancelled, stibe_class_live,
stibe_class_reminder, stibe_coord_summary, stibe_daily_schedule,
stibe_demo_req, stibe_invoice, stibe_payment_confirm,
stibe_payslip, stibe_session_cancel, stibe_session_moved,
stibe_session_request, stibe_student_class, stibe_teacher_class

### Deploy
- [x] TypeScript check: 0 errors
- [x] Production build: SUCCESS
- [x] Git commit `7109494`, pushed to origin/master
- [x] Deployed to production, PM2 restarted

### Remaining
- [ ] Complete Meta Business Verification (currently LIMITED sending)
- [ ] Monitor 17 pending templates for Meta approval
- [ ] End-to-end test: trigger a real notification and verify WA delivery

---

## Phase: Demo Session System (Mar 4, 2026)

### Database
- [ ] Migration 013: `demo_requests` table (link_id, student info, subject, portions, teacher, status chain, room_id)

### APIs  
- [ ] `GET /api/v1/demo/available-teachers` — teachers free for next N hours
- [ ] `POST /api/v1/demo/generate-link` — AO creates demo link
- [ ] `GET /api/v1/demo/[linkId]` — public: fetch link info + available subjects/teachers
- [ ] `POST /api/v1/demo/[linkId]/register` — public: student submits registration
- [ ] `PATCH /api/v1/demo/requests/[id]` — teacher accepts (creates room) / rejects
- [ ] `GET /api/v1/demo/requests` — list demo requests filtered by role

### Email Templates
- [ ] `demoTeacherRequestTemplate` — notify teacher of incoming demo request
- [ ] `demoStudentAcceptedTemplate` — student gets join link + scheduled time
- [ ] `demoStudentSearchingTemplate` — "we're finding a teacher" confirmation

### UI
- [ ] AO Dashboard: 'demo' tab + sidebar nav item
- [ ] AO Demo Tab: available teachers, generate link, demo requests list
- [ ] Public demo registration page: `/demo/[linkId]`
- [ ] Teacher Dashboard: demo requests with accept/reject

### Integration  
- [ ] Demo room creation on teacher accept (30-min, payment_status='exempt')
- [ ] Student joins via email link (no payment gate)

### Deploy
- [ ] TypeScript check
- [ ] Deploy migration + code to production
- [ ] Update DEV_FLOW.md

---

## Phase: Soft-Delete, Email Light Mode, Rejoining Students (Mar 4, 2026)

### Task 1: Soft-delete invoices (keep visible to students/parents)
- [x] Migration 011: Add `hidden_from_owner BOOLEAN DEFAULT FALSE` to `invoices`
- [x] Change DELETE handler → SET `hidden_from_owner = TRUE` instead of hard delete
- [x] Owner GET query: filter `WHERE hidden_from_owner = FALSE`
- [x] Student/parent queries: unchanged (they see all their invoices)

### Task 2: Force light theme on all emails
- [x] Add `<meta name="color-scheme" content="light only">` to masterLayout
- [x] Add `color-scheme: light only` CSS on html/body elements
- [x] Dark mode CSS override to force light colors on all email clients

### Task 3: Rejoining students system
- [x] Migration 011: Add `student_status` to `batch_students` (active/discontinued/on_break/rejoined)
- [x] Migration 011: Add `discontinued_at`, `rejoined_at`, `status_note` to `batch_students`
- [x] New API: `GET/PATCH /api/v1/student-status` — view and manage student status
- [x] Batch PATCH handler: smart upsert preserving student_status
- [x] Available students query: only excludes active-status students
- [x] TeacherView: Show "returning student" notification when rejoined student joins live session
- [x] AO dashboard: "Discontinued Students" panel with rejoin action
- [x] Coordinator dashboard: "Discontinued Students" panel with rejoin action
- [x] TypeScript: 0 errors
- [x] Git commit `20a8e4d`, deployed to production

---

## Phase: Combined Invoice — Schedule Group Payments (Mar 3, 2026)

### ✅ Completed
- [x] Migration 010: `schedule_group_id` on `batch_sessions` + `invoices` + unique index
- [x] `lib/payment.ts`: Replace per-session `generateBatchSessionInvoices` with `generateScheduleGroupInvoices`
  - Sums fees across ALL sessions in a group → 1 combined invoice per student
  - Per-session `session_payment` rows all point to same `invoice_id`
  - `completePayment()` marks all session_payments for an invoice as paid
- [x] `batch-sessions POST`: Accept `schedule_group_id`, no longer generates per-session invoices
- [x] NEW `POST /api/v1/batch-sessions/finalize-invoices`: Generates combined invoices for a schedule group
- [x] Frontend: Generate `crypto.randomUUID()` before scheduling loop, pass to each POST, call finalize after
- [x] `session-check`: Handle combined invoices (overdue + pending states)
- [x] Owner fees dashboard: Group by `schedule_group_id` (with `batch_session_id` fallback for legacy)
- [x] Migration 010 deployed to production
- [x] Fix: `getDatesForDays()` UTC→local date formatting bug (toISOString → getFullYear/getMonth/getDate)
- [x] TypeScript: 0 errors
- [x] Git commit `3b91d8b`, pushed to origin/master
- [ ] Production code deploy (pending GitHub deploy key)

---

## Phase: Session Integrity & Approval Flows (Current Sprint)

### ✅ Already Fixed
- [x] Payment callback: `participant_email` → `student_email` in `lib/payment.ts`
- [x] Teacher end class: `handleEndClass` now calls `DELETE /api/v1/room/${roomId}`
- [x] Teacher leave approve/reject: Fixed field names in AO dashboard (`leave_id→request_id`, `reason→notes`)

### Current Sprint
- [ ] Fix double DELETE: ControlBar + ClassroomWrapper both call DELETE. Remove from ClassroomWrapper.
- [ ] Student re-entry block: Join route checks `student_feedback` — if exists, return SESSION_COMPLETED
- [ ] Remove 60s auto-approve: StudentView rejoin fallback — require teacher approval only
- [ ] End-class coordinator approval: If ending before scheduled time → require coordinator approval
- [ ] Coordinator dashboard: Show pending end-class requests
- [ ] Deploy & verify all changes

### Deferred (Next Sprint)
- [ ] Batch coordinator UI rewrite with shared components
- [ ] Tablet teaching materials after screen share
- [ ] Razorpay live mode testing (combined invoices, mobile network error handling)

---

## Phase: Terminology Migration — "Class" → "Session" (Feb 28, 2026)

### Rename all user-facing "class" text to "session"
- [x] Student dashboard (StudentDashboardClient.tsx): 19 string changes — tabs, headings, badges, placeholders, empty states, attendance labels
- [x] Teacher dashboard (TeacherDashboardClient.tsx): 16 string changes — workflow rules, stat labels, payroll table headers
- [x] Classroom components (9 files): 27 string changes — TimeWarningDialog, TeacherView, StudentView, ControlBar, HeaderBar, ClassroomWrapper, ChatPanel, FeedbackDialog, ParticipantList
- [x] Join flow (2 files): 13 string changes — JoinRoomClient.tsx, join page.tsx
- [x] Owner dashboard (OwnerDashboardClient.tsx): 10 string changes — tab labels, live counts, section headers
- [x] Owner sub-pages (4 files): 17 string changes — SystemClient, OwnerTeachersClient, BatchesClient, PayrollClient
- [x] Parent/Ghost/HR/Coordinator dashboards (6 files): 24 string changes
- [x] Academic Operator dashboard: 29 string changes — schedule wizard, session management, timetable labels
- [x] Misc files (3 files): 9 string changes — layout.tsx meta, CreateUserForm role descriptions, ended page
- [x] TypeScript build: 0 errors
- [x] Production deploy: commit `e8a0d5f`, build success, PM2 online
- **Total: 28 files changed, ~120 user-facing string replacements, 174 lines modified**
- **Preserved: Grade labels ("Class 10"), CSS className, JS class keyword, DB field names, variable/function names**

---

## Phase: Complete Real-Life Workflow Re-Test (Feb 28, 2026 — Session 2)

### GET Endpoint Testing — All 8 Roles (Fresh Re-Run)
- [x] Owner: 33 PASS / 1 expected RBAC 403 (coordinator/student-performance)
- [x] Teacher: 6/6 PASS
- [x] Student: 6/6 PASS
- [x] Parent: 5/5 PASS
- [x] Coordinator: 4/4 PASS + 1 expected RBAC 401 (batches requires owner/AO)
- [x] Academic Operator: 8/8 PASS
- [x] HR: 7/7 PASS
- [x] Ghost: 1/1 PASS
- **Total: 70 GET endpoints tested, 70 PASS, 0 unexpected failures**

### Full Real-Life POST Workflow Tests
- [x] **Admission Pipeline**: create → registered → fee_confirmed → allocated → active (all 5 stages, auto user+profile creation)
- [x] **Batch Workflow**: create batch (201) → PATCH add students+teachers (200) → verify details
- [x] **Session Scheduling**: create session (201) → PATCH topic (200) → start (live) → end (ended) → create 2nd → DELETE cancel (200)
- [x] **Exam Lifecycle**: create exam with 5 MCQs (200) → publish (200) → student start attempt (200) → submit answers (100%, A+) → teacher grades (96%, A+)
- [x] **Payment/Fee**: create fee structure (200) → generate monthly invoices (200) → create manual invoice (200) → initiate payment order (200) → verify GET invoices
- [x] **Teacher Leave**: teacher submit (200) → AO approve (ao level) → HR approve (overall approved) → teacher withdraw (200)
- [x] **Session Requests**: student cancellation request (200) → coordinator approve (200)
- [x] **Room Creation**: create room with batch association (201) → coordinator_email auto-resolved from batch
- [x] **Cancellation Flow**: request cancel (201) → coordinator approve (200)
- [x] **HR User Creation**: create teacher account with auto-generated password + email (201)

### Bugs Found & Fixed This Session
- [x] **room_events FK violation**: `room_id='system'` didn't exist in rooms table → Created 'system' room row + migration 033
- [x] **room/create missing coordinator_email**: INSERT didn't include coordinator_email (NOT NULL) → Added auto-resolution from batch/caller
- [x] **Type assertion**: `coordinator_email` needed `as string` cast for TypeScript strict mode

### UI Page Load Verification (All 30 Pages)
- [x] Login: 200 ✅
- [x] Owner (13 pages): owner, batches, exams, fees, payroll, reports, roles, teachers, users, system, hr, academic-operator — all PASS
- [x] Coordinator (3 pages): dashboard, admissions, cancellations — all PASS
- [x] Academic Operator: 200 ✅
- [x] HR: 200 ✅
- [x] Teacher (2 pages): dashboard, exams — all PASS
- [x] Student (2 pages): dashboard, exams — all PASS
- [x] Parent: 200 ✅
- [x] Ghost (2 pages): dashboard, monitor — all PASS
- [x] Dev: 200 ✅
- [x] Dynamic pages (4): join/[room_id], classroom/[roomId], classroom/[roomId]/ended, student/exams/[id] — all PASS
- **Total: 30 pages, 30 PASS, 0 FAIL**

### Deployment
- [x] Commit b751278: room/create coordinator_email fix + migration 033
- [x] Commit c4e9d6b: TypeScript type assertion fix
- [x] Both deployed to production, build successful

---

## Phase: Full System Audit & Schema Alignment (Feb 27, 2026)

### System Health Audit
- [x] Read and map workflow.json institutional spec (337 lines, 12 sections + extras)
- [x] Complete project audit (100 API routes, 146 handlers, 31 pages, 50 tables)
- [x] Production health check (DB/Redis/LiveKit all ok)
- [x] Test 29 API endpoints on production — 19 PASS, 10 FAIL (500 errors)
- [x] Diagnose all 10 failures to root causes

### Migration 032: Catch-Up Schema
- [x] Create 9 missing tables (admission_requests, rejoin_requests, session_config, class_monitoring_events, monitoring_alerts, monitoring_reports, session_requests, student_availability, teacher_leave_requests)
- [x] Add 6 missing columns to rooms (batch_type, class_portion, class_remarks, created_by, batch_id, batch_session_id)
- [x] Add 4 columns to attendance_sessions (mic_off_count, camera_off_count, leave_request_count, attention_avg)
- [x] Rename payslips columns: loss_of_pay_paise→lop_paise, total_pay_paise→total_paise
- [x] Update constraints: room_events, email_log, generated_reports, attendance_logs
- [x] Record 11 unapplied migrations as applied

### Code Bug Fixes
- [x] HR attendance: ambiguous `status` column in JOINed queries → prefix with `a.`
- [x] Owner dashboard: `display_name` → `full_name` on portal_users (2 queries)
- [x] Payroll: `pp.start_date` → `pp.period_start`, `pp.end_date` → `pp.period_end` (4 locations)

### Deployment & Verification
- [x] Apply migration 032 to production via SSH
- [x] Deploy code fixes (2 commits, 0 TS errors)
- [x] Retest all 29 endpoints — **29 PASS / 0 FAIL** ✅

### Gap Analysis Report
- [x] Compare workflow.json spec vs actual implementation
- [x] Generate detailed gap analysis at portal_dev/GAP_ANALYSIS.md
- [x] Results: 27 fully implemented, 10 partial, 4 missing

---

## Remaining Gaps (Priority Order)

### ❌ Missing Features
- [ ] Website integration: Public enquiry form → admission pipeline
- [ ] Role-based theming: Per-role accent colors (all roles currently share green theme)

### ⚠️ Partial Features
- [ ] AI-generated reports: Current reports are algorithmic, not LLM-powered narrative
- [ ] Offline marks entry UI: API supports it, no dedicated teacher form
- [ ] Parent fees tab: API exists, parent dashboard nav missing fees link
- [ ] Student preferred timing UI: session-requests + availability APIs exist, no student form
- [ ] Mobile responsive audit: Desktop-first design, needs responsive testing
- [ ] Automated batch allocation: Manual allocation only in admission workflow
- [ ] "Batch" terminology: UI uses "Batch" but DB/API still uses "room" internally

---

## Previous Phases

### Phase: Session Management, Leave, LiveKit & Ghost Monitoring
- [x] Migration 029: session_requests, student_availability, teacher_leave_requests tables + rooms.batch_id/batch_session_id
- [x] API: /api/v1/session-requests — GET/POST with approve/reject/withdraw
- [x] API: /api/v1/student-availability — GET/POST with bulk_replace
- [x] API: /api/v1/teacher-leave — GET/POST with multi-level approval
- [x] 9 email templates (session + leave notifications)

### Dashboard Updates
- [x] Student: Requests tab (session requests + availability submission)
- [x] Parent: Requests tab (request/withdraw session changes)
- [x] Academic Operator: Requests tab (approve/reject sessions + teacher leave)
- [x] Teacher: Leave tab (request leave, view approval chain)
- [x] HR: Leave Requests tab (filter + approve/reject)
- [x] Owner: Leave overview section with owner-level approval

### LiveKit & Room System Updates
- [x] Auto-start: Bridge batch_sessions → rooms table (batch_id/batch_session_id)
- [x] Room create: Accept optional batch_id/batch_session_id
- [x] Ghost API: Return batch info, batch/teacher grouped views

### Ghost Dashboard Overhaul
- [x] Ghost dashboard: 3 view modes (All / By Batch / By Teacher)
- [x] Ghost monitor: Batch grouping, teacher filtering, combined monitoring
- [x] Combined monitor shortcut for all live sessions

### Nav Config & Verification
- [x] Nav config: Student→Requests, Parent→Requests, Teacher→Leave, AO→Requests, HR→Leave Requests, Ghost→By Batch/Teacher
- [x] TypeScript: 0 errors

---

## Phase: LiveKit Critical Fixes (Feb 28, 2026 — Session 2)

### Token Identity & Metadata
- [x] `/start` route: All token identities changed from raw email to `{role}_{email}` format
- [x] `/start` route: All tokens now include metadata (portal_user_id, portal_role, effective_role, room_name, device)
- [x] Fixes teacher showing "student" badge in People tab

### Attendance Webhook Fix
- [x] Added `extractEmail()` helper to parse real email from `{role}_{email}` identity
- [x] `recordJoin()` and `recordLeave()` now receive plain email via `extractEmail()`
- [x] Uses `metadata.portal_user_id` as primary email source with prefix-stripping fallback

### Payment Gate Fix
- [x] `session-check/route.ts`: Resolves `batch_session_id` → actual `room_id` before fee lookup
- [x] `join/route.ts`: Uses `actualRoomId` for `room_assignments` lookup, `calculateSessionFee()`, `checkSessionPayment()`, and rejoin detection

### Join Flow Fix
- [x] `join/[room_id]/page.tsx`: Passes resolved `room.room_id` to `JoinRoomClient` instead of raw URL param

### UI Fixes
- [x] Teacher dashboard: Classroom opens in new tab (`window.open`)
- [x] Hand-raise icon: Updated to Lucide-style SVG + filled `HandRaisedIcon` for active state
- [x] Ended page: Feedback submission persisted in sessionStorage to prevent duplicate prompts on refresh
- [x] Batch ID format: Changed to `stibe_{date}_{time}_{shortId}`

### Tablet Fixes
- [x] IST timing: Manual formatting instead of `DateFormat.format()` which used device timezone
- [x] Grade/section display: Added `grade`, `section` fields to `SessionData` model
- [x] Emojis → Material Icons: All emoji strings replaced with `Icon()` widgets
- [x] "Class" → "Session": 7 string replacements in dashboard labels and buttons
- [x] Null safety: Fixed `teacherToken` null assertion warning

### Verified Working
- [x] Student join gate: `CLASS_NOT_LIVE` returns 403, polling every 5s for 5min
- [x] AI features: MediaPipe attention monitoring, data channel broadcast, monitoring ingestion
- [x] Variable naming: Consistent across DB (snake_case), TypeScript, Flutter (camelCase)
- [x] Room ID/Session ID: Dual-lookup queries working in all critical routes

## Phase: Comprehensive Student Report (AO Dashboard)
- [x] Audit all 15+ tracked data sources across livekit classroom
- [x] Expand `StudentReportMetrics` interface with 14 new fields
- [x] Add SQL queries: phone detection, late joins, leave requests, mic/camera, rejoins, contact violations, feedback, alert breakdown
- [x] Update `generateStudentReport()` to populate all new fields
- [x] Update `generateStudentSummaryText()` with phone, punctuality, discipline, safety, feedback
- [x] Update `ReportMetrics` interface in UsersTab.tsx (13 new fields)
- [x] Add new UI sections: Punctuality & Discipline, Safety & Alerts, Session Feedback
- [x] Add phone detection to Behaviour Breakdown (now 7 cards)
- [x] Add alert breakdown pill tags
- [x] TypeScript check: 0 errors

## Phase: Homework Overhaul (`694ae43`)
- [x] Migration 035: homework_questions table, completion_status/file_urls/file_names/delay_days on submissions, due_time on assignments
- [x] File upload API: /api/v1/homework/upload (jpeg/png/pdf/docx/pptx, 20MB max, 5 files)
- [x] Room homework API rewrite: questions array in assign, file/status/delay in submit
- [x] Student homework API rewrite: questions fetch, new submission fields, delay calc
- [x] HomeworkPanel rebuild: teacher question-by-question form, student file upload + completion status selector
- [x] Student dashboard HomeworkTab: questions display, file upload UI, completion status, delay tracking
- [x] Teacher dashboard: new homework tab with batch-wide view, submission stats, inline grading
- [x] Teacher homework API: /api/v1/teacher/homework (all assignments across batches)
- [x] Session reports: homework data (questions, submissions, grades, delays) in generateSessionReport
- [x] SessionReportView: homework section with questions + submission table (visible in AO/BC dashboards)
- [x] TypeScript check: 0 errors
- [x] Deployed to production

## Phase: Demo System Bug Fixes

### Bug 1: "0 teachers free" on AO Dashboard (CRITICAL)
- **File**: `app/api/v1/demo/available-teachers/route.ts` line ~117
- **Cause**: Authenticated code path queries `student_name, room_type` from `rooms` — neither column exists → 500 error
- [ ] Remove `student_name, room_type` from rooms query; JOIN demo_requests for label info

### Bug 2: Stale "scheduled" rooms
- Rooms `demo_e9e32c8b-d55` (Mar 27) and `demo_732ceec1-16f` (Apr 7) still status='scheduled'
- [ ] Clean up stale rooms in DB
- [ ] Add `scheduled_start > NOW()` guard in conflict queries

### Bug 3: email_log FK violation on demo summary
- `email_log_room_id_fkey` fails when logging emails for deleted demo rooms
- [ ] Guard email_log insert against missing room_id

### Bug 4: schedule-demo FK race condition
- Room creation + demo_requests update not wrapped in transaction
- [ ] Wrap schedule-demo in transaction

### Bug 5: Demo link "not found" — records mass-deleted by AO
- Not a code bug — AO bulk-deleted demo_requests via DELETE endpoint
- Students clicking WhatsApp links see "Demo link not found"

---
---

# Feature: **Open Classroom** (formerly "General Teaching")

> AO-managed open teaching sessions — teachers host real LiveKit classrooms accessible via public link, with optional paid entry.

---

## Naming Options

| Name | Why |
|------|-----|
| **Open Classroom** ✅ | Clear intent — it's a real classroom open to anyone |
| Live Workshop | Sounds one-off, workshop-like |
| Public Session | Too generic |
| Open Session | Decent but less descriptive |
| Masterclass | Implies premium, not always the case |

**Recommended: "Open Classroom"** — It signals this is a *real* teaching session (not a conference call), but open to public participants.

---

## Architecture Overview

### What's Different from Conference

| Aspect | Conference (existing) | Open Classroom (new) |
|--------|----------------------|---------------------|
| **Purpose** | Meetings/calls | Real teaching sessions |
| **Host** | AO or any allowed role | Specifically a teacher |
| **UI** | ConferenceHostView / ConferenceUserView | TeacherView / StudentView (real classroom) |
| **Payment** | None | Optional per-participant fee |
| **Join gate** | Name input only | Name input → (optional payment) → join |
| **Roles** | admin/user | teacher/student |
| **Features** | Basic video/chat | Full classroom: homework panel, chat, exam push, AI monitoring, attendance |

### What's Reusable from Conference

- ✅ Token-based public links (admin_token / user_token pattern)
- ✅ WhatsApp bulk sharing with personalized links
- ✅ Instant / scheduled toggle
- ✅ Conference shares tracking table pattern
- ✅ Pre-join lobby (name input + countdown)

---

## Implementation Plan

### Phase 1: Database Migration (072_open_classrooms.sql)

```sql
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
  
  -- Status
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oc_host_token ON open_classrooms(host_token);
CREATE INDEX IF NOT EXISTS idx_oc_join_token ON open_classrooms(join_token);
CREATE INDEX IF NOT EXISTS idx_oc_teacher ON open_classrooms(teacher_email);
CREATE INDEX IF NOT EXISTS idx_oc_created_by ON open_classrooms(created_by);
CREATE INDEX IF NOT EXISTS idx_oc_participants ON open_classroom_participants(classroom_id);
CREATE INDEX IF NOT EXISTS idx_oc_shares ON open_classroom_shares(classroom_id);
```

---

### Phase 2: API Routes

#### `GET /api/v1/open-classroom` — List open classrooms
- Auth: AO, teacher, owner
- AO sees all they created; teacher sees ones they're assigned to

#### `POST /api/v1/open-classroom` — Create open classroom
- Auth: AO, owner
- Body: `{ title, description?, teacher_email, classroom_type, scheduled_at?, duration_minutes?, payment_enabled, price_paise?, currency?, max_participants? }`
- Generates host_token and join_token (12-char hex each)

#### `GET /api/v1/open-classroom/[token]` — Get classroom info (public)
- No auth required (public link)
- Returns: title, teacher name, scheduled_at, status, payment info

#### `POST /api/v1/open-classroom/[token]/join` — Join classroom
- Public endpoint
- Body: `{ name, email?, phone? }`
- If payment_enabled AND student:
  - Create invoice → return `{ requires_payment: true, invoice_id, payment_url }`
  - After payment → rejoin → get LiveKit token
- Generates real classroom roles (teacher/student)

#### `DELETE /api/v1/open-classroom/[token]` — End classroom
#### `PATCH /api/v1/open-classroom/[token]` — Edit/cancel
#### `POST /api/v1/open-classroom/share` — WhatsApp share

---

### Phase 3: Join Page (`/open-classroom/[token]`)

**Flow:**
1. Fetch classroom info → show lobby (title, teacher, description)
2. If scheduled → countdown timer
3. Name + email + phone input
4. Click Join:
   - If requires_payment → redirect to `/pay/{invoiceId}?returnUrl=/open-classroom/{token}`
   - After payment or if free → get LiveKit token
5. Store token in sessionStorage → redirect to `/classroom/{roomId}`
6. ClassroomWrapper renders TeacherView or StudentView (REAL classroom UI!)

---

### Phase 4: AO Dashboard Tab (`OpenClassroomTab`)

1. **Create form**: title, description, teacher picker, instant/scheduled, payment toggle + price, max participants
2. **Classroom list**: status cards with participant counts, revenue, actions
3. **Share panel**: copy link, WhatsApp bulk send
4. **Stats**: total, active, participants, revenue

---

### Phase 5: Nav + Integration

- Add to nav-config.ts under AO
- Add tab to AcademicOperatorDashboardClient.tsx
- Modify PayClient to support returnUrl redirect after payment

---

## File Changes

| File | Action |
|------|--------|
| `migrations/072_open_classrooms.sql` | CREATE |
| `app/api/v1/open-classroom/route.ts` | CREATE |
| `app/api/v1/open-classroom/[token]/route.ts` | CREATE |
| `app/api/v1/open-classroom/[token]/join/route.ts` | CREATE |
| `app/api/v1/open-classroom/share/route.ts` | CREATE |
| `app/open-classroom/[token]/page.tsx` | CREATE |
| `app/open-classroom/[token]/OpenClassroomClient.tsx` | CREATE |
| `components/dashboard/OpenClassroomTab.tsx` | CREATE |
| `components/dashboard/AcademicOperatorDashboardClient.tsx` | EDIT |
| `lib/nav-config.ts` | EDIT |
| `app/pay/[id]/PayClient.tsx` | EDIT |

---

## Implementation Order

- [ ] 1. Migration 072 — create tables
- [ ] 2. API: POST create + GET list
- [ ] 3. API: GET info + join + end
- [ ] 4. API: WhatsApp share
- [ ] 5. Join page: `/open-classroom/[token]` (lobby + payment gate)
- [ ] 6. Payment return flow (modify PayClient)
- [ ] 7. AO Dashboard: OpenClassroomTab component
- [ ] 8. Nav config + AO dashboard integration
- [ ] 9. Deploy + test full flow

---

## iOS Safari Fullscreen Fix — StudentView

**Problem**: On iPhone, clicking fullscreen in StudentView classroom doesn't actually go fullscreen. Browser chrome (address bar, bottom toolbar) remains visible. The "Add to homescreen" tip is useless. User wants YouTube-style true fullscreen on iOS Safari.

### Research Findings

**Root Cause**: iOS Safari on iPhone does NOT support the Fullscreen API (`Element.requestFullscreen()`) at all.
- caniuse Note 5: "Partial support refers to supporting only iPad, not iPhone"
- `document.documentElement.requestFullscreen()` silently fails on iPhone
- Current fallback: pseudo-fullscreen CSS (adds `classroom-fullscreen` class for `100lvh`) — browser chrome stays visible

**The YouTube Approach**: iOS Safari supports `HTMLVideoElement.webkitEnterFullscreen()` (Safari Mobile 4.2+). This enters the native iOS video player mode, completely hiding ALL browser chrome. This is the ONLY way to get true fullscreen on iPhone Safari.

**Key Video Element**: `WhiteboardComposite.tsx` has `<video ref={screenVideoRef}>` with `track.attach()` — this is the screen share video already rendering in StudentView. Currently NOT exposed to parent.

### Approach: Hybrid (Native Video Fullscreen on iOS + Standard API elsewhere)

When student taps fullscreen:
1. **iPhone + screen share active** → `videoElement.webkitEnterFullscreen()` on the screen share `<video>` (YouTube behavior — native fullscreen, video-only, all browser chrome hidden)
2. **iPhone + no screen share** → Find teacher camera `<video>` element and use `webkitEnterFullscreen()` on it (same native fullscreen for camera feed)
3. **iPhone fallback (no video at all)** → Improved pseudo-fullscreen (current CSS approach, enhanced)
4. **All other platforms** → Keep existing `requestFullscreen()` / `webkitRequestFullscreen()` (already works on Android, desktop)

### Why This Works
- Student's #1 need during fullscreen: see the teacher's screen share (whiteboard/slides) clearly
- `webkitEnterFullscreen()` provides the exact same experience as YouTube fullscreen on iPhone
- Chat/homework panels aren't needed during fullscreen — student exits fullscreen to access them
- Screen share is active 95%+ of classroom time

### Implementation Plan

#### Step 1: WhiteboardComposite — Expose video ref to parent
**File**: `components/classroom/WhiteboardComposite.tsx`
- Add `onVideoRef?: (el: HTMLVideoElement | null) => void` callback prop
- Call `onVideoRef(screenVideoRef.current)` in a useEffect when the video element mounts/unmounts
- Non-breaking change — prop is optional

#### Step 2: StudentView — Receive video ref
**File**: `components/classroom/StudentView.tsx`
- Add state: `const [screenVideoEl, setScreenVideoEl] = useState<HTMLVideoElement | null>(null)`
- Pass `onVideoRef={setScreenVideoEl}` to `<WhiteboardComposite>` component
- Also find teacher camera video for the no-screen-share fallback

#### Step 3: StudentView — Rewrite toggleFullscreen() for iOS
**File**: `components/classroom/StudentView.tsx` (lines 476-526)
- On iOS:
  - If `screenVideoEl` available → `screenVideoEl.webkitEnterFullscreen()`
  - Else if teacher camera video available → `cameraVideoEl.webkitEnterFullscreen()`
  - Else → improved pseudo-fullscreen (current CSS fallback)
- On non-iOS: Keep existing `requestFullscreen()` logic unchanged
- Add `webkitendfullscreen` event listener on the video element to track state changes
- Sync `effectiveFullscreen` with native video fullscreen state

#### Step 4: StudentView — Remove "Add to homescreen" iOS tip
**File**: `components/classroom/StudentView.tsx`
- Remove `showIOSTip` state declaration (line ~277)
- Remove `setShowIOSTip(true)` from toggleFullscreen (line ~506)
- Remove `setTimeout(() => setShowIOSTip(false), 8000)` (line ~507)
- Remove iOS tip popup JSX block (lines ~2190-2205)
- Remove `isStandalone` check associated with the tip

#### Step 5: StudentView — Auto-enter fullscreen fix for iOS
**File**: `components/classroom/StudentView.tsx` (lines 389-412)
- Auto-enter uses `requestFullscreen()` which silently fails on iOS
- On iOS: use `webkitEnterFullscreen()` on the video element (requires video to be mounted first)
- Add delay/guard: only auto-enter after screen share track is attached

#### Step 6: globals.css — Cleanup (optional)
**File**: `app/globals.css`
- `.classroom-scroll-trick` may no longer be needed for iOS (native fullscreen replaces it)
- Keep for backwards compatibility / Android edge cases

### Edge Cases to Handle
1. **Video not yet mounted** — Guard all `webkitEnterFullscreen()` calls with null checks + `webkitSupportsFullscreen` check
2. **Screen share starts/stops during fullscreen** — `webkitendfullscreen` event exits native fullscreen; user can re-enter
3. **Orientation** — Native iOS video fullscreen auto-handles landscape; no manual `lockLandscape()` needed
4. **Exit fullscreen** — User swipes down or taps the X in native player → `webkitendfullscreen` fires → sync `effectiveFullscreen = false`
5. **`forceRotate` interaction** — When in native video fullscreen, the CSS rotation is irrelevant (video handles its own layout)

### Files Changed Summary

| File | Change |
|------|--------|
| `components/classroom/WhiteboardComposite.tsx` | Add `onVideoRef` callback prop |
| `components/classroom/StudentView.tsx` | Rewrite iOS fullscreen logic, remove iOS tip, add native video fullscreen |
| `app/globals.css` | Optional cleanup of scroll-trick |

### Implementation Order
- [ ] 1. WhiteboardComposite: `onVideoRef` callback prop
- [ ] 2. StudentView: receive video ref + state
- [ ] 3. StudentView: rewrite `toggleFullscreen()` with iOS `webkitEnterFullscreen()`
- [ ] 4. StudentView: remove `showIOSTip` + iOS tip popup
- [ ] 5. StudentView: fix auto-enter fullscreen for iOS
- [ ] 6. Test on iPhone Safari
- [ ] 7. Deploy
