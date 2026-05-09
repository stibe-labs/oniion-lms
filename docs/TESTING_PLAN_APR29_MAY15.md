# stibe Platform — Daily Testing Plan
**Period:** 29 April 2026 – 15 May 2026
**Goal:** Fully bug-free, production-ready web platform by 15 May 2026
**Testers:** Dev Team, Staff, Offline Students
**Devices:** Android, iOS, Desktop (Chrome, Safari, Firefox, Edge, Internet Explorer)

---

## Test Accounts — `stibe@2026`

| Role | Email | Name |
|------|-------|------|
| Owner | `stibelearningventures@gmail.com` | Admin Owner |
| Owner | `owner@stibeedu.in` | — |
| HR | `hr@stibeedu.in` | — |
| Academic Operator | `chinjurp333@gmail.com` | Academic Operator |
| Batch Coordinator | `Academiccoordinator1SUO@gmail.com` | Batch Coordinator |
| Teacher (Math) | `salihr@stibeedu.in` | Salih R |
| Teacher (Physics) | `salehl@stibeedu.in` | Saleh L |
| Teacher (Chemistry) | `bilal@stibeedu.in` | Bilal |
| Teacher (Biology) | `shafivk@stibeedu.in` | Shafi VK |

---

## Operational Flow (How the Platform Is Actually Used)

```
STEP 1 — Platform Configuration (one-time, pre-launch)
  Owner configures fee structures
  → AO configures academic settings

STEP 2 — Student Acquisition
  Sales gets lead → demo (guest session if live class nearby, else demo link)
  → prospect observes/attends demo → sales follows up → lead converts
  [NOTE: "Add Guest to Session" feature pending — see ENROLLMENT_FLOW_CHANGES.md]

STEP 3 — Enrollment (after lead closes)
  Sales sends enrollment link via CRM
  → student self-enrolls: fills details + pays via Razorpay
  → account created, credits added
  [Special case only: AO manually adds student — offline payment, exceptions]

STEP 4 — Batch Setup (after student is enrolled)
  AO creates batch for the enrolled student's grade/type (if not already existing)
  → AO assigns coordinator to batch
  → AO assigns enrolled student to batch → join tokens created → welcome email sent

STEP 5 — Academic Calendar & Scheduling
  AO/Teacher sets up academic calendar → maps curriculum topics
  → AO schedules sessions (single + recurring) → assigns teachers
  → topics linked to sessions from calendar
  [NOTE: BC session scheduling UI not yet implemented — see CODE_CHANGES_NEEDED.md]

STEP 5 — Pre-Class
  Session reminder sent 15 min before → student gets WhatsApp/email
  → student opens join link → pre-join lobby (device check)
  → BC online (heartbeat active) → teacher enters room

STEP 6 — Live Class
  Teacher goes live (BC approves) → students join → class runs
  → controls (mic, cam, screen share, whiteboard) → chat, raise hand
  → session exam (optional) → homework assigned → teacher ends class

STEP 7 — Post-Class
  Attendance recorded → feedback collected → exam auto-graded
  → result emails sent → monitoring report generated

STEP 8 — Ongoing Operations
  New student added mid-batch → tokens backfilled → joins next session
  Teacher leave → substitute assigned
  Student non-payment → gate blocks → payment reminder sent
  Parent monitors via parent portal
  AO/ghost monitors live classes silently
```

---

## Workflow Suggestions & Pending Improvements

> Identified during planning and codebase study. Prioritised by launch impact.
> Implementation details in `docs/CODE_CHANGES_NEEDED.md`.

| # | Suggestion | Priority | Reason |
|---|---|---|---|
| 1 | **Batch optional in ManualEnrollModal** — Step 2 currently requires batch selection. Allow AO to enroll a student without assigning a batch immediately (assign later). | 🔴 | AO may add student before a suitable batch exists |
| 2 | **Enrollment link → auto-assign batch** — When AO creates an enrollment link, allow linking a target batch. After student pays, auto-assign and send join links without AO intervention. | 🔴 | Removes the manual "assign to batch" step; faster student onboarding |
| 3 | **BC go-live timeout** — If BC does not respond to go-live request within 2 min, allow teacher to go live with AO notification. Currently blocks indefinitely if BC is offline. | 🔴 | Classes stall when BC is briefly unavailable |
| 4 | **BC session scheduling (pending)** — Implement BC session scheduling UI (see `docs/CODE_CHANGES_NEEDED.md`). Day-to-day scheduling should be BC's job, not AO's. | 🔴 | AO is overloaded; BC is the right role for daily session management |
| 5 | **Session reminder — configurable window** — Allow per-batch reminder timing (15 min / 30 min / 1 hour). Currently hardcoded at 15 min for all batches. | 🟡 | Evening classes and long sessions need earlier reminders |
| 6 | **Auto-link academic topic to session** — When scheduling a session, suggest the next unfinished topic from the academic calendar for auto-linking. Currently fully manual. | 🟡 | Reduces AO workload; keeps curriculum tracking accurate automatically |
| 7 | **Session gate prompt — add context** — When student is blocked, show: batch name, how many sessions, exact amount, and fee breakdown. Currently shows only total amount. | 🟡 | Students don't understand why they're blocked or how much to pay |
| 8 | **Enrollment link expiry — configurable** — Currently fixed at 7 days. Allow AO to set custom expiry per link (24h for urgent enrollments, 30d for campaigns). | 🟡 | Different sales cycles need different expiry windows |
| 9 | **WhatsApp join link — shortened URL** — Current join links are long tokens. Consider a URL shortener or cleaner format for better mobile display in WA. | 🟢 | Long URLs wrap awkwardly in some WhatsApp clients |
| 10 | **Parent notification preferences** — Allow parents to opt in/out of specific notification types (exam results, attendance alerts, fee reminders). Currently all-or-nothing. | 🟢 | Reduces notification fatigue while keeping critical alerts |

---

## Testing Phases

| Phase | Label | Meaning |
|---|---|---|
| 🔴 Red | Critical | Blocks usage — stop everything, fix immediately |
| 🟡 Yellow | Important | Degraded experience — fix before launch |
| 🟢 Green | Polish | Minor UX — fix before launch, lower urgency |

---

## Batch Types

| Batch | Students | Behaviour |
|---|---|---|
| 1:1 | 1 | Private — student can publish mic/cam |
| 1:3 | 3 | Small group — students can publish |
| 1:15 | 15 | Medium group — students can publish |
| 1:30 | 30 | Large group — students can publish |
| 1:Many / Lecture | 50+ | Lecture mode — mic/cam disabled for students |

---

## Browsers & Devices

| Browser | Desktop | Android | iOS |
|---|---|---|---|
| Chrome | ✓ | ✓ | ✓ |
| Safari | ✓ Mac | — | ✓ |
| Firefox | ✓ | ✓ | ✓ |
| Edge | ✓ | ✓ | — |
| Internet Explorer | ✓ Win | — | — |
| Samsung Internet | — | ✓ | — |

> IE has no WebRTC — must show a graceful "browser not supported" page, never a blank crash.

---

## Role Responsibilities

| Role | Key Responsibilities |
|---|---|
| **Academic Operator (AO)** | Creates batches · assigns coordinators · **schedules sessions** (current implementation) · adds students manually · verifies CRM students · manages payments · ghost monitors · full reports |
| **Batch Coordinator (BC)** | **Session scheduling (pending implementation)** · assigns teachers to sessions · live monitoring · attendance · cancellations · batch-level reports (assigned batches only) |
| **Teacher** | Joins room · teaches · controls (mic/cam/screen/whiteboard) · attendance · homework · exams |
| **Student** | Joins via link · attends class · chat · raise hand · exams · homework submission |
| **Owner** | Complete platform monitoring · view all batches/sessions/users/reports · permission management for all roles · system config (read-only) |
| **HR** | User management · payroll · teacher leave approvals |
| **Sales** | Leads · demo link sending · pipeline |
| **Parent** | View child attendance/fees/exams · file complaints |
| **Ghost** | Silent observer — invisible to all participants |

> **AO currently schedules sessions.** BC session scheduling is planned but not yet implemented in code.
> **BC cannot create batches or access finance.** AO handles these.
> **BC sees only assigned batches**, not all platform batches.
> See `docs/CODE_CHANGES_NEEDED.md` for the BC session scheduling implementation plan.

---

## Bug Report Format

```
Bug ID    : BUG-[MMDD]-[###]    e.g. BUG-0501-001
Feature   : e.g. Session Gate
Batch Type: 1:1 / 1:3 / 1:15 / 1:30 / 1:many
Device    : Android / iOS / Desktop
Browser   : Chrome / Safari / Firefox / Edge / IE
Role      : Student / Teacher / BC / AO / Owner / HR / Sales / Parent / Ghost
Steps     : 1. ...  2. ...  3. ...
Expected  : What should happen
Actual    : What happened
Phase     : 🔴 / 🟡 / 🟢
Status    : Open / In Progress / Fixed / Verified
```

---
---

# DAILY TEST SCHEDULE

---

## Day 1 — 29 April 2026
### Theme: FULL PLATFORM FIRST RUN — Enroll Students → Create Batches → Schedule → Run Live Classes → All Features
> End-to-end first-run test. 30 students manually enrolled by AO, batches built, all batch types run simultaneously.
> Three phases: **Setup** (students + batches + schedule) → **Live** (run all classes) → **Scenarios** (edge cases mid-session and post-session).

---

### PHASE A — Student Enrollment (Manual, by AO)
> AO manually enrolls 30 test students using the 3-step Manual Enrollment form (Students tab → Manual Enroll button).
> Form steps: Step 1 = Student Info · Step 2 = Parent & Batch · Step 3 = Payment.
> Batches must exist BEFORE enrolling — create batches first (Phase B), then come back to enroll students into them.
> **Actual order on Day 1:** Create batches (Phase B) → enroll students into them (Phase A).

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| A1 | AO login on Desktop Chrome | AO | Login → check dashboard | Dashboard loads, all tabs visible (Batches, Students, Sessions, Finance, Reports) | 🔴 |
| A2 | Open Manual Enrollment modal | AO | Students tab → Manual Enroll button | 3-step modal opens: Step 1 "Student Info" shown | 🔴 |
| A3 | Step 1 — fill student info | AO | Name, Email, Phone, Grade=Class 10, Board=CBSE, Region=India, Category=A, DOB, Password | All fields accept input, validation on invalid email shows error | 🔴 |
| A4 | Step 1 — missing name → blocked | AO | Submit Step 1 with empty name | Error: "Student name is required" — cannot proceed | 🔴 |
| A5 | Step 1 — invalid email → blocked | AO | Enter "notanemail" in email field | Error: "Invalid email address" | 🔴 |
| A6 | Step 2 — parent info (optional) | AO | Parent Name, Parent Email, Parent Phone, Parent Password | Fields accept input; leaving blank is allowed | 🔴 |
| A7 | Step 2 — batch dropdown loads | AO | Batch selector on Step 2 | All active batches listed with name, grade, board, student count/max | 🔴 |
| A8 | Step 2 — select 1:1 batch | AO | Choose 1:1 batch from dropdown | Batch info card shows: Type=1:1, Students=0/1 | 🔴 |
| A9 | Step 2 — no batch selected → blocked | AO | Click Next without selecting batch | Error: "Please select a batch" | 🔴 |
| A10 | Step 3 — payment mode: None | AO | Leave "No payment now" selected → Submit | Enrollment succeeds, no invoice generated | 🔴 |
| A11 | Step 3 — payment mode: Full, Cash | AO | Select "Full payment", method=Cash, amount=₹5000 → Submit | Enrollment succeeds, invoice + receipt generated | 🔴 |
| A12 | Step 3 — payment mode: Advance, UPI | AO | Advance, UPI, amount=₹2000, transaction ref | Advance payment recorded, partial credit | 🔴 |
| A13 | Success screen shown | AO | After submit | "Student Enrolled!" screen shows: student email, batch name, invoice number, receipt number, amount paid | 🔴 |
| A14 | "Enroll Another" resets form | AO | Click "Enroll Another" on success screen | Modal resets to Step 1, ready for next student | 🔴 |
| A15 | Enroll 1 student into 1:1 batch | AO | Manual enroll → 1:1 QA batch → no payment | Student S1 enrolled, welcome email sent | 🔴 |
| A16 | Enroll 3 students into 1:3 batch | AO | Repeat x3 → 1:3 QA batch | Students S2, S3, S4 enrolled | 🔴 |
| A17 | Enroll 15 students into 1:15 batch | AO | Repeat x15 → 1:15 QA batch | S5–S19 enrolled, batch fills up | 🔴 |
| A18 | Enroll 10 students into 1:30 batch | AO | Repeat x10 → 1:30 QA batch | S20–S29 enrolled | 🔴 |
| A19 | Enroll 1 student into lecture batch | AO | Repeat x1 → lecture QA batch | S30 enrolled | 🔴 |
| A20 | Total: 30 students enrolled | AO | View Students tab | All 30 students visible in list with correct batch assignments | 🔴 |
| A21 | Duplicate email rejected | AO | Try to enroll S1's email again | Error: "Email already registered" — not a silent duplicate | 🔴 |
| A22 | 1:1 batch full — cannot add more | AO | Enroll 2nd student into 1:1 batch | Error: batch is full / max students reached | 🔴 |
| A23 | Student welcome email received | Student | Check S1 email inbox | Welcome email with login credentials and dashboard link received | 🔴 |
| A24 | Parent welcome email received | Parent | Check parent email (if provided) | Parent gets login credentials | 🟡 |
| A25 | Enrolled student can login | Student | Use credentials from welcome email → login | Dashboard loads, student sees their batch and upcoming sessions | 🔴 |

---

### PHASE B — Batch Creation & Assignment
> AO creates all batch types for QA testing. Do this BEFORE Phase A so batches appear in the enrollment dropdown.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| B1 | AO creates batch — 1:1 | AO | Batches → New → Type=1:1, Name="QA 1:1 Math", Grade=Class 10, Board=CBSE, Subject=Math | Batch saved, max_students=1, appears in list | 🔴 |
| B2 | AO creates batch — 1:3 | AO | Type=1:3, Name="QA 1:3 Math", Grade=10, Board=CBSE, Subject=Math | max_students=3 | 🔴 |
| B3 | AO creates batch — 1:15 | AO | Type=1:15, Name="QA 1:15 Science", Grade=10, Board=CBSE, Subject=Science | max_students=15 | 🔴 |
| B4 | AO creates batch — 1:30 | AO | Type=1:30, Name="QA 1:30 English", Grade=10, Board=CBSE, Subject=English | max_students=30 | 🔴 |
| B5 | AO creates batch — lecture | AO | Type=lecture, Name="QA Lecture Physics", Grade=11, Board=CBSE, Subject=Physics | max_students=50+ | 🔴 |
| B6 | AO assigns BC to all batches | AO | Each batch → Edit → Coordinator = official4tishnu@gmail.com | BC sees all 5 QA batches in their dashboard | 🔴 |
| B7 | AO assigns primary teacher to each batch | AO | Each batch → Teachers → Add → abcdqrst404@gmail.com, subject=match batch subject | Teacher assigned as primary | 🔴 |
| B8 | BC login — sees only assigned batches | BC | Login → Batches | Only the 5 QA batches visible — no other platform batches | 🔴 |
| B9 | BC cannot create batch | BC | Try Batches → New | No "New Batch" button or option available | 🔴 |
| B10 | AO views all batches platform-wide | AO | Batches list | ALL batches across platform shown, not filtered by BC | 🔴 |

---

### PHASE C — Session Scheduling
> AO schedules one session per batch, all at the same time (e.g., today + 30 min from now), to run simultaneously.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| C1 | AO schedules session — 1:1 batch | AO | Sessions → New → QA 1:1 batch, Date=today, Time=T+30min, Duration=60min, Subject=Math, Teacher=abcdqrst404@gmail.com | Session created, status=scheduled | 🔴 |
| C2 | AO schedules session — 1:3 batch | AO | Same params, QA 1:3 batch, same time | Session created | 🔴 |
| C3 | AO schedules session — 1:15 batch | AO | Same, QA 1:15 batch | Session created | 🔴 |
| C4 | AO schedules session — 1:30 batch | AO | Same, QA 1:30 batch | Session created | 🔴 |
| C5 | AO schedules session — lecture batch | AO | Same, QA Lecture batch | Session created | 🔴 |
| C6 | Students receive join link emails | Students | After scheduling | All enrolled students receive session join link via email (+ WA if configured) | 🔴 |
| C7 | Session reminder at 15 min before | Auto | Wait until T+15 min | WhatsApp + email reminder sent to all students and parents | 🔴 |
| C8 | AO changes teacher on scheduled session | AO | Sessions → QA 1:3 session → Edit → change teacher | Teacher updated, new teacher notified, old teacher loses session | 🔴 |
| C9 | AO reschedules session time | AO | Sessions → QA 1:1 session → Edit → change time by +5 min | Session time updated, students re-notified | 🟡 |
| C10 | Session without teacher — warning shown | AO | Create new session without assigning teacher | Warning: "teacher not assigned" shown | 🟡 |

---

### PHASE D — Live Class (All 5 Batches Running Simultaneously)
> Teacher, students, BC, and AO all join at the same time. Test all controls, connectivity, and features.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| D1 | BC approves teacher go-live — 1:3 batch | BC | BC logs in, opens go-live approval panel | Go-live request appears when teacher tries to start | 🔴 |
| D2 | Teacher enters room — 1:3 batch | Teacher | Session → Join → pre-join lobby → enter room | Room loads, teacher's own video tile shows, waiting for BC approval | 🔴 |
| D3 | BC approves → class goes live | BC | BC → Approve go-live | Room status changes to live, students can now join | 🔴 |
| D4 | Students join — 1:3 batch (3 students) | S2, S3, S4 | Open join link → lobby → enter room | All 3 students appear in room, attendance recording starts | 🔴 |
| D5 | Students join — 1:15 batch (15 students) | S5–S19 | Open join links → enter room | All 15 tiles render correctly, no layout crash | 🔴 |
| D6 | Students join — 1:30 batch (10 students) | S20–S29 | Open join links → enter room | All 10 tiles render, grid adapts | 🔴 |
| D7 | Student joins — 1:1 batch | S1 | Open join link → enter room | 1:1 room with teacher only — correct | 🔴 |
| D8 | Student joins — lecture batch | S30 | Open join link → enter room | Lecture mode: mic/cam controls disabled for student | 🔴 |
| D9 | Teacher mic on/off | Teacher | Toggle mic button | Audio cuts for all students, icon reflects state | 🔴 |
| D10 | Teacher camera on/off | Teacher | Toggle camera button | Video freezes/resumes for all students | 🔴 |
| D11 | Teacher screen share — Desktop Chrome | Teacher | Screen share button → select window | Students see teacher's screen instead of camera | 🔴 |
| D12 | Screen share stops | Teacher | Stop sharing | Teacher camera resumes | 🔴 |
| D13 | Student mic on/off — 1:3 batch | Student S2 | Toggle mic | Audio heard by teacher + other students in 1:3 | 🔴 |
| D14 | Student camera on/off — 1:3 batch | Student S3 | Toggle camera | Video shown/hidden correctly | 🔴 |
| D15 | Lecture mode: student cannot unmute | Student S30 | Try to unmute in lecture batch | Mic button disabled or blocked — cannot publish audio | 🔴 |
| D16 | Raise hand | Student | Raise Hand button | Teacher sees raised hand indicator on student tile | 🔴 |
| D17 | Teacher lowers hand | Teacher | Click lower hand on student | Hand indicator clears | 🔴 |
| D18 | Chat — student sends message | Student | Type in chat → send | Message appears for teacher and all students | 🔴 |
| D19 | Chat — teacher sends message | Teacher | Type and send | All students receive message | 🔴 |
| D20 | Teacher whiteboard / annotation | Teacher | Open whiteboard or annotation tool | Drawing visible to all students in real time | 🔴 |
| D20a | Mute individual student | Teacher | Right-click S3 tile → Mute | S3's audio cuts; mute icon updates on tile for all viewers; sound effect plays | 🔴 |
| D20b | Unmute individual student | Teacher | Right-click S3 tile → Unmute | S3's mic reactivates; icon updates | 🟡 |
| D20c | Remove student from room | Teacher | Controls → Remove S4 → confirm | S4 disconnected immediately; sees "You have been removed" message | 🔴 |
| D20d | Removed student blocked from rejoin | S4 | S4 opens join link again | "Removed from session" — access denied, not a blank crash | 🔴 |
| D20e | Teacher announcement bar | Teacher | Toolbar → Announcement → type "Check page 42" → Send | Announcement banner overlays all student views; auto-dismisses after timeout | 🟡 |
| D20f | Spotlight student | Teacher | Click S2 tile → Spotlight | S2's tile enlarges to main stage; all others move to strip | 🟡 |
| D20g | Student submits doubt | Student S5 | Doubts panel → type question → Submit | Question appears in teacher's doubts list in sidebar | 🟡 |
| D20h | Teacher responds to doubt | Teacher | Doubts → S5's question → type reply → Send | S5 sees teacher's reply in their doubts panel | 🟡 |
| D20i | Tab switch detection — teacher notified | Student S6 | S6 switches browser tab during session | Teacher sees tab-switch violation alert with S6's name + sound cue | 🟡 |
| D20j | Contact violation — phone number in chat | Student S7 | S7 types "+91 9876543210" in chat | Message blocked or flagged; teacher notified; warning shown to S7 | 🟡 |
| D20k | Contact violation — social handle | Student S8 | S8 types "@username" in chat | Blocked or flagged; teacher notified | 🟡 |
| D20l | Recording start | Teacher | Controls → Record (allowRecording=true) | REC badge appears for teacher; recording begins server-side | 🟡 |
| D20m | Recording stop | Teacher | Click Stop Recording | REC badge gone; recording URL saved; accessible later | 🟡 |
| D20n | Virtual background — blur | Teacher | Settings → Background → Blur | Teacher's background blurred; students see blurred background | 🟢 |
| D20o | Virtual background — custom image | Teacher | Settings → Background → Select image | Custom image shown behind teacher | 🟢 |
| D20p | Virtual background — disable | Teacher | Settings → Background → Off | Normal camera feed restored | 🟢 |
| D20q | Media request — lecture student requests mic | S30 | Lecture batch → Request Mic button → submit | Teacher hears sfxMediaRequest; media request notification appears in panel | 🟡 |
| D20r | Teacher approves media request | Teacher | Media Requests panel → Approve S30 | S30 can speak; all other lecture students remain muted | 🟡 |
| D20s | Teacher denies media request | Teacher | Deny S30 | S30 stays muted; denial notification shown to S30 | 🟡 |
| D20t | Teacher tablet joins (teacher_screen role) | Teacher | 2nd device → login as teacher_screen → join session | Tablet appears as secondary screen-share source in room; students see it | 🟡 |
| D21 | AO ghost joins 1:15 session | AO | Open session as ghost / AO role | AO invisible in participant list, can see all tiles and hear audio | 🔴 |
| D22 | BC monitoring view — 1:15 batch | BC | CoordinatorLiveView → 1:15 room | All student tiles + attention states shown | 🔴 |
| D23 | Student count badge — correct | Teacher | Check participant count display | Shows correct number present (not counting ghost) | 🔴 |
| D24 | Teacher pushes session exam | Teacher | Exam tab → Create MCQ → Push to students | All students get exam overlay in their view | 🔴 |
| D25 | Students submit exam | All students | Answer MCQs → submit before timer | All submissions recorded, auto-graded | 🔴 |
| D26 | Teacher assigns homework | Teacher | Homework tab → New → title, description → assign | Homework visible in student homework list | 🟡 |
| D27 | Teacher ends class — 1:3 batch | Teacher | End Session button | All participants disconnected, session status → ended | 🔴 |
| D28 | Attendance recorded after end | AO/BC | Check attendance report | Join time, leave time, duration correct for all students | 🔴 |
| D29 | Exam results emailed | Students + Parents | After session ends | Each student gets exam result email | 🔴 |
| D30 | Post-session feedback dialog | Student | Immediately after end | Feedback/rating dialog appears for student | 🟡 |
| D31 | Go-live skip toggle (bypass BC approval) | AO | AO → Batch settings → `go_live_skip_coordinator = true` → teacher goes live | Goes live immediately without BC request — no approval dialog | 🔴 |
| D32 | Go-live before schedule (early start) | AO | AO → `allow_go_live_before_schedule = true` → teacher goes live 10 min early | Room goes live before scheduled time; no error | 🟡 |
| D33 | Session runs past scheduled end (overtime) | Teacher | Continue class past 60-min mark | Overtime timer shows; session stays live; no auto-disconnect | 🟡 |
| D34 | Teacher requests early end → BC approves | Teacher + BC | Teacher → End Early → BC sees approval dialog → Approves | Class ends; all disconnected; attendance closed at actual end time | 🟡 |
| D35 | Teacher requests early end → BC denies | Teacher + BC | Teacher → End Early → BC denies | Class continues; teacher sees "denied" notification | 🟡 |

---

### PHASE E — Additional Scenarios (Mid/Post Session)
> Edge cases, role boundaries, and batch management scenarios.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| E1 | Add student to batch mid-series | AO | Batch → Add existing student (S20) to 1:3 batch (already in 1:30) | Student added to second batch, backfilled tokens for upcoming sessions | 🔴 |
| E2 | New student backfill — join link works | S20 | Use backfilled join link | Enters room successfully for the next session | 🔴 |
| E3 | Change teacher after session is live | AO | Session (still live) → Edit → assign different teacher | Not allowed mid-session OR updated and takes effect next session | 🟡 |
| E4 | AO removes student from batch | AO | Batch → Students → remove S4 | S4 removed, future join tokens invalidated | 🟡 |
| E5 | Removed student cannot join | S4 | Try old join link | "Access denied" or "Session not found" — not a crash | 🟡 |
| E6 | BC cannot access finance | BC | Try to navigate to fees/invoices | Not in nav, access denied if URL typed directly | 🔴 |
| E7 | BC changes coordinator — not possible | BC | Try to reassign coordinator of their own batch | No option available | 🔴 |
| E8 | Student joins wrong batch link | Student | Use another student's join link | Access denied — not the assigned student | 🟡 |
| E9 | AO deactivates a batch | AO | Batch → set inactive | Batch greyed out, cannot schedule new sessions | 🟡 |
| E10 | AO reactivates batch | AO | Batch → set active | Schedulable again | 🟡 |
| E11 | Multiple teachers per subject | AO | 1:15 batch → Teachers → add Teacher B for Science (same subject as Teacher A) | Both teachers listed; AO can assign either per session | 🟡 |
| E12 | AO changes teacher of scheduled session | AO | Session → Edit → change teacher from A to B | Session updated, Teacher B notified, Teacher A loses session | 🔴 |
| E13 | Teacher sees updated session | Teacher B | Dashboard → My Sessions | New session appears | 🔴 |
| E14 | Teacher A no longer sees session | Teacher A | Dashboard → My Sessions | Session removed from Teacher A's list | 🔴 |
| E15 | Student joins — Android Chrome | Student | Open join link on Android Chrome | Room loads, mic and camera work | 🔴 |
| E16 | Student joins — iOS Safari | Student | Open join link on iPhone Safari | Room loads, permissions prompt shown | 🔴 |
| E17 | Student joins — Desktop Firefox | Student | Open join link on Firefox | Room loads, all controls work | 🔴 |
| E18 | Student joins — Desktop Edge | Student | Open join link on Edge | Room loads | 🟡 |
| E19 | Pre-join lobby — mic denied | Student | Browser popup → deny mic → enter | "Mic denied" warning shown, can still enter room | 🔴 |
| E20 | Pre-join lobby — no camera | Student | Device has no camera | "No camera found" shown, can still enter | 🔴 |
| E21 | Expired join link | Student | Use join link after session ended | "Session has ended" — not a crash | 🔴 |
| E22 | Invalid join link | Student | Open random /join/abc123 | "Link not found" page | 🔴 |
| E23 | BC sees only assigned batches | BC | Batches list | Only QA batches assigned to this BC visible | 🔴 |
| E24 | AO views all sessions across platform | AO | AO → Sessions | All 5 QA sessions visible in one list | 🔴 |
| E25 | Health check endpoint | Dev | GET /api/v1/health | Returns 200 with server status | 🔴 |

---

## Day 2 — 30 April 2026
### Theme: LIVEKIT ADVANCED — All Batch Sizes, All Devices, Connectivity & Resilience
> Day 1 covered every LiveKit feature once in a controlled 1:3 setup on Desktop Chrome.
> Day 2 stress-tests everything across ALL batch sizes under real load, ALL devices students use,
> connectivity failure scenarios, and advanced configurations.
> By end of Day 2, every LiveKit feature has been verified across every environment.

---

### PART 1 — All Batch Sizes Under Load

| # | Scenario | Role / Batch | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 1 | 1:15 — all 15 students join simultaneously | 15 students + Teacher | All 15 open join link at same time → enter room | All 15 tiles render correctly; grid layout adapts; no crash; no missing participant | 🔴 |
| 2 | 1:15 — teacher audio stable with 15 connected | Teacher + 15 | Run class for 5 min, teacher talks | No audio glitches; all 15 hear teacher clearly throughout | 🔴 |
| 3 | 1:15 — teacher screen share to all 15 | Teacher | Screen share → select window | All 15 students see the shared screen simultaneously, no black tiles | 🔴 |
| 4 | 1:15 — mute all students at once | Teacher | Teacher controls → Mute All | All 15 muted simultaneously; all mic icons update on their tiles | 🟡 |
| 5 | 1:30 — all 30 students join | 30 students + Teacher | All 30 open links → enter room | All 30 tiles visible; grid scrollable; layout stable; no crash | 🔴 |
| 6 | 1:30 — teacher whiteboard visible to 30 | Teacher | Open whiteboard → draw circles | All 30 students see drawing in real time; no lag | 🔴 |
| 7 | 1:30 — raise hand from 10 students | 10 students | All 10 click Raise Hand | Teacher sees all 10 raise-hand notifications; queue shown | 🟡 |
| 8 | 1:30 — end class for 30 gracefully | Teacher | End Session → confirm | All 30 disconnected; session status = ended; no hanging connections | 🔴 |
| 9 | Lecture — 50 students join | 50 students + Teacher | 50 open links → enter | All 50 tiles render in lecture grid; no crash | 🔴 |
| 10 | Lecture — no student can publish audio/video | 50 students | Any student tries mic or cam button | All mic/cam controls disabled or hidden for every student | 🔴 |

---

### PART 2 — Connectivity & Resilience

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 11 | Student drops mid-class → rejoins | Student | Close tab → reopen join link 2 min later | Re-enters room; attendance time accumulates (20 min + 2 min gap + rejoined time) | 🔴 |
| 12 | 3 students drop and rejoin simultaneously | 3 students | All 3 close tabs at same second → all reopen | All 3 rejoin; no race condition; all 3 attendance records correct | 🔴 |
| 13 | Teacher internet drops briefly | Teacher | Throttle teacher's connection → restore after 20s | Students see "teacher disconnected" placeholder; teacher reconnects; class resumes normally | 🔴 |
| 14 | Long class — 90 min, no timeout | Teacher + 3 students | Run 1:3 class for 90 min continuously | No auto-disconnect; no session timeout; all controls still work at 90-min mark | 🔴 |
| 15 | Student joins on two devices simultaneously | Same student | Phone + laptop both open same join link | Both join OR system handles gracefully (shows "already in session" on 2nd device) | 🟡 |

---

### PART 3 — All Devices & Browsers

| # | Scenario | Device / Browser | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 16 | Pre-join lobby — Android Chrome | Android Chrome | Open join link → lobby screen | Lobby loads; mic test works; camera preview shows; Enter button accessible | 🔴 |
| 17 | Pre-join lobby — iOS Safari | iOS Safari | Open join link → lobby | Lobby loads; permission prompts shown correctly; keyboard doesn't overlap Enter button | 🔴 |
| 18 | Full join + mic/cam — Firefox Desktop | Firefox | Open join link → enter room → toggle mic + cam | Room loads; mic/cam toggle works; chat works | 🔴 |
| 19 | Full join + screen share — Safari Mac | Safari Desktop | Join → toggle mic/cam → start screen share | Room loads; controls work; screen share requires permission prompt | 🟡 |
| 20 | Full join — Edge Desktop | Edge | Open join link → enter room | Room loads; all basic controls functional | 🔴 |
| 21 | IE — graceful unsupported page | IE Desktop | Open join link in Internet Explorer | "Browser not supported" page with helpful upgrade message — no crash, no blank page | 🔴 |
| 22 | Samsung Internet — join or fallback | Samsung browser | Open join link on Samsung phone | Room loads OR graceful "please use Chrome" message — no crash | 🟡 |
| 23 | Mobile — landscape orientation | Android + iOS | Rotate phone to landscape while in room | UI fills landscape correctly; controls accessible; no layout break | 🟡 |
| 24 | Mobile — overlay auto-hide | Android Chrome | Be in room for 3+ sec without touching | Video controls fade after inactivity | 🟡 |
| 25 | Mobile — overlay reappear on tap | Android Chrome | Tap screen after controls fade | Controls reappear immediately | 🟡 |

---

### PART 4 — AI Monitoring + Advanced Observer Features

| # | Scenario | Role / Device | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 26 | AI monitoring — Firefox Desktop | Student on Firefox | Student joins → monitoring initialises | MediaPipe loads silently; no errors in browser console | 🔴 |
| 27 | AI monitoring — iOS Safari | Student on iPhone | Student joins → monitoring initialises | AI monitoring active on mobile Safari; no crashes | 🔴 |
| 28 | AI monitoring — attention alert fires | Student | Student looks away from camera for 30+ seconds | Alert fires in teacher's Monitoring sidebar tab; alert type logged | 🟡 |
| 29 | AI monitoring — writing mode suppresses alerts | Student | Writing mode ON → student looks down to write | NOT flagged as "looking away" — writing-mode exception works | 🟡 |
| 30 | BC records session from CoordinatorLiveView | BC | CoordinatorLiveView → live room → Start Recording | YouTube egress recording starts; REC indicator shows; recording URL available after end | 🟡 |

---

## Day 3 — 1 May 2026
### Theme: ENROLLMENT LINK + PAYMENTS + CREDITS — Full Self-Enrollment & Billing Lifecycle
> Day 1 covered manual enrollment. Day 3 tests the self-enrollment path and the complete billing lifecycle.
> Flow: AO creates link → student fills form → Razorpay payment → account created → AO assigns to batch →
> credits → session gate. These two flows are tested together because enrollment triggers payment, and payment unlocks class access.

---

### PART 1 — Enrollment Link (Tests 1–15)

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 1 | AO creates enrollment link | AO | Enrollment → Create Link → grade=10, board=CBSE, region=India | Unique `/enroll/[linkId]` URL generated; visible in enrollment links list | 🔴 |
| 2 | AO sends link via WhatsApp button | AO | Click "Send via WhatsApp" → enter student phone | WhatsApp message with link delivered to student phone | 🔴 |
| 3 | Student opens link — Desktop Chrome | Student | Open `/enroll/[linkId]` in Chrome | Form loads; grade/board pre-filled from link config | 🔴 |
| 4 | Student opens link — Android Chrome | Student | Open link on Android phone | Form loads on mobile; all fields accessible; scrollable | 🔴 |
| 5 | Student opens link — iOS Safari | Student | Open on iPhone Safari | Form loads; keyboard does not cover Submit button | 🔴 |
| 6 | Student fills enrollment form | Student | Full Name, Email, Phone, Grade, Board, Region → Next | All fields validated; email format check; required fields enforced | 🔴 |
| 7 | Student proceeds to Razorpay | Student | Click Pay/Next | Razorpay opens with correct amount (grade + board + region fee) | 🔴 |
| 8 | Student completes Razorpay test payment | Student | Select test card → complete | Payment succeeds; account created; success screen shown | 🔴 |
| 9 | Welcome email with credentials sent | Student | Check inbox after payment | Email: login URL, email address, password — arrives within 2 min | 🔴 |
| 10 | Student logs in with received credentials | Student | Login page → use email credentials | Student dashboard loads; sees batch/session area | 🔴 |
| 11 | AO assigns self-enrolled student to batch | AO | AO → Students → pick student → Assign to Batch → 1:3 QA | Student added; join tokens generated; session links emailed | 🔴 |
| 12 | Student enters session via join link | Student | Open join link → lobby → enter room | Enters room successfully; attendance records start | 🔴 |
| 13 | Enrollment link expired | Student | Open link after 7+ days | "Link expired" page — not a 500 error, not a blank crash | 🟡 |
| 14 | Enrollment link already used | Student | Re-open same used link | "Already enrolled" message | 🟡 |
| 15 | Razorpay payment failure | Student | Use test-failure card | Failure handled gracefully; retry shown; no account created | 🔴 |

---

### PART 2 — Payments, Invoices & Credits (Tests 16–30)

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 16 | AO generates session-based invoice | AO | Student → Generate Invoice → 1:3 batch, 4 sessions | INV-YYYYMM-##### format; correct amount for batch type × region × board | 🔴 |
| 17 | Invoice email with payment link sent | Student | After generation | Invoice email arrives; contains `/pay/[token]` link | 🔴 |
| 18 | Public payment page — no login required | Student | Open `/pay/[token]` in incognito | Razorpay checkout opens without login; no redirect to login page | 🔴 |
| 19 | Student pays via Razorpay test | Student | Test card → complete | Payment verified; receipt created; credits added | 🔴 |
| 20 | Credits added after payment — correct count | Auto | AO checks student credit balance | Credits match amount paid / fee structure | 🔴 |
| 21 | Receipt email — student + parent | Auto | After payment | Both receive receipt: amount, date, invoice number, receipt number | 🔴 |
| 22 | `/pay/invalid` — graceful error | Student | Open `/pay/invalid123` | "Invalid or expired link" page — not a 500 crash | 🔴 |
| 23 | Invoice already paid — cannot double-pay | Student | Re-open payment link for paid invoice | "Already paid" message; student not charged twice | 🟡 |
| 24 | Session gate — student WITH credits | Student | Join session link (credits > 0) | Enters room; credit deducted | 🔴 |
| 25 | Session gate — student ZERO credits | Student | Credits = 0 → open join link | Blocked: payment prompt with amount due — cannot enter | 🔴 |
| 26 | Pay from gate prompt → rejoin | Student | Tap "Pay Now" → Razorpay → complete → reopen link | Credits added; student enters room | 🔴 |
| 27 | Skip payment gate flag (AO sets) | AO + Student | AO → `skip_payment_gate = true` → student with 0 credits joins | Enters without payment prompt | 🟡 |
| 28 | Monthly invoice — lecture batch | AO | AO → Invoices → Generate Monthly → lecture batch | All enrolled students receive monthly invoices; correct amounts | 🟡 |
| 29 | Student views own fee history | Student | Student portal → Fees tab | Invoice list, paid/unpaid status, credit balance all correct | 🟡 |
| 30 | AO credit check preview before invoicing | AO | AO → Credit Preview → select batch | Each student's credit balance shown before invoices are generated | 🟡 |

---

## Day 4 — 2 May 2026
### Theme: ACADEMIC CALENDAR & SESSION SCHEDULING
> AO sets up the academic calendar, maps topics, and schedules a full week of sessions. BC session scheduling is not yet implemented — AO is the scheduler in the current codebase.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 1 | AO/Teacher creates academic calendar | AO | Academic Calendar → New → batch, academic year, start/end dates | Calendar created for the batch | 🔴 |
| 2 | Add curriculum topics to calendar | Teacher/AO | Calendar → Add Topic → subject, chapter, topic name, session number | Topics listed in calendar for the term | 🔴 |
| 3 | View next suggested topic | BC/Teacher | Calendar → Next Topics | System suggests next unfinished topic for each subject | 🟡 |
| 4 | AO schedules session linked to topic | AO | New Session → pick topic from calendar | Session created, topic linked, visible in calendar view | 🔴 |
| 5 | AO schedules a full week — Monday | AO | New Session → 1:3 batch, Monday date, Math, Teacher A, 10am, 60 min | Monday session created | 🔴 |
| 6 | AO schedules — Tuesday | AO | Same batch, Tuesday, Science, Teacher B, 11am | Tuesday session created | 🔴 |
| 7 | AO schedules — Wednesday | AO | Same, Wednesday, English | Wednesday created | 🔴 |
| 8 | AO schedules — Thursday | AO | Same, Thursday, Math | Thursday created | 🔴 |
| 9 | AO schedules — Friday | AO | Same, Friday, Science | Friday created | 🔴 |
| 10 | All 5 sessions visible in calendar | AO | AO → Calendar → week view | Mon–Fri sessions shown on correct dates | 🔴 |
| 11 | Students get join links for all 5 sessions | Students | After scheduling | Each student receives 5 join tokens/emails | 🔴 |
| 12 | AO sets up recurring sessions — 4 weeks | AO | Auto Schedule → batch, day=Wednesday, time=10am, duration=60, weeks=4 | 4 sessions on correct Wednesday dates | 🔴 |
| 13 | Recurring sessions on correct dates | AO | Calendar view | Each recurring session falls on the right day | 🔴 |
| 14 | AO assigns teacher to each session | AO | Session → assign teacher | Each session has a teacher | 🔴 |
| 15 | Multiple teachers per subject (same batch) | AO | Assign Teacher A and Teacher B to Math | AO can assign either teacher per session | 🟡 |
| 16 | AO assigns different teacher to session 2 | AO | Session 2 → assign Teacher B | Teacher B sees session 2, Teacher A does not | 🟡 |
| 17 | AO reschedules one session | AO | Session → Edit → new date/time | Updated, students notified | 🔴 |
| 18 | AO cancels one session | AO | Session → Cancel → reason | Cancelled, students + parents notified | 🔴 |
| 19 | Cancel one session in recurring series | AO | Cancel week 2 only | Weeks 1, 3, 4 unaffected | 🟡 |
| 20 | Session without teacher — warning | AO | Create session without assigning teacher | Warning: "teacher not assigned" | 🟡 |
| 21 | Past date rejection | AO | Try to schedule for yesterday | Error: cannot schedule in the past | 🟡 |
| 22 | Teacher daily limit (4 sessions) | AO | Try to schedule 5th session for same teacher same day | Error: daily limit reached | 🟡 |
| 23 | Student gets all week's join links | Student | Check email | 5 separate join links received, one per session | 🔴 |
| 24 | New student added mid-week | AO | AO adds student to batch after Mon–Fri scheduled | Student gets backfilled tokens for Tue–Fri (remaining sessions) | 🔴 |
| 25 | New student's backfilled links work | New Student | Student opens backfilled join link | Enters room successfully | 🔴 |
| 26 | Add topic from calendar to existing session | Teacher/AO | Session → link topic from academic calendar | Topic shown in session details | 🟡 |
| 27 | Topic marked taught after session | Auto/Teacher | After session ends | Topic marked as covered in academic calendar | 🟡 |
| 28 | Next topic suggestion updates | Teacher/AO | View next topics after session completed | System now suggests next topic in sequence | 🟡 |
| 29 | BC calendar monthly view | BC | Calendar → Monthly | All sessions shown on correct dates, colour by status | 🟢 |
| 30 | AO views sessions across all batches | AO | AO dashboard → sessions | All batches' sessions visible to AO | 🟡 |

---

### AI EXAM GENERATION PIPELINE (Groq Cloud)
> AO uploads PDF/image files per topic → triggers AI generation → reviews questions → teacher uses them in session exams.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 31 | AO creates exam topic | AO | AO → Exam Questions → New Topic → subject=Math, grade=Class 10, board=CBSE, chapter=Algebra, category=topic | Topic created, status=draft; appears in list | 🔴 |
| 32 | AO uploads files to topic | AO | Topic → Upload Files → attach PDF (≤20 MB) + PNG image | Files uploaded; list shows name, size, type | 🔴 |
| 33 | AO triggers AI generation | AO | Topic → Generate Questions → page_range="1-5" → confirm | Progress indicator shown; Groq API called server-side | 🔴 |
| 34 | AI returns questions — correct format | Auto | After generation completes | Questions list: text, 4 options, correct_answer index, marks, difficulty all populated | 🔴 |
| 35 | AO reviews and approves questions | AO | Review each question → Approve → status = ready | Topic status changes to "ready" | 🔴 |
| 36 | Teacher selects ready topic in session exam | Teacher | In-class Exam tab → Select Topic | Only "ready" topics visible; teacher selects one | 🔴 |
| 37 | Teacher pushes AI-generated exam to students | Teacher | Exam → Push to Students | Exam overlay appears for all students in room | 🔴 |

---

### QUESTION BANK (Manual)
> Teacher/AO manually create reusable MCQ questions tagged by subject/grade/difficulty. Used across multiple session exams.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 38 | Teacher creates question in question bank | Teacher | Teacher → Questions tab → New Question → subject, grade, text, 4 options, correct_answer, difficulty | Question saved and tagged; appears in bank | 🔴 |
| 39 | AO creates question | AO | AO → Exam Questions → New Question | Saved; visible to teachers of same subject/grade | 🟡 |
| 40 | Filter questions by subject, grade, difficulty | Teacher | Questions list → apply filters | List narrows to matching questions only | 🟡 |
| 41 | Teacher picks questions from bank for session exam | Teacher | In-class Exam → Pick from Question Bank → select 5 | Selected questions added to exam | 🔴 |
| 42 | Student takes exam built from question bank | Student | Exam overlay appears | Questions display correctly; student can answer and submit | 🔴 |

---

### TEACHING MATERIALS
> AO/Teacher uploads files (PDFs, videos, slides, archives) → assigns to one or many batches → students download.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 43 | AO uploads PDF material to a batch | AO | AO → Materials tab → Upload → Title, PDF file, assign to 1:3 batch | Material saved; visible in list with name, size, batch | 🔴 |
| 44 | AO assigns same material to multiple batches | AO | Material → Assign to Batch → add 1:15 batch | Material linked to both batches | 🟡 |
| 45 | Student sees materials for their batch | Student | Student → Classes or Materials section | Materials for student's batch listed with download button | 🔴 |
| 46 | Student downloads material | Student | Click material → download | File downloads; correct filename and format | 🔴 |
| 47 | Teacher uploads material from teacher dashboard | Teacher | Teacher → Materials tab → Upload | Material uploaded; linked to teacher's assigned batches | 🟡 |
| 48 | AO removes material from batch | AO | Material → Unassign from batch | Material no longer visible to that batch's students | 🟡 |

---

### STUDENT AVAILABILITY
> Students submit preferred time slots → AO/Coordinator views for optimal scheduling.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 49 | Student submits availability slot | Student | Student → Requests → Availability → Day=Monday, Start=10:00, End=12:00, preference=preferred | Slot saved; visible in student's profile | 🟡 |
| 50 | Student adds multiple slots | Student | Repeat for Tuesday and Wednesday | All 3 slots stored correctly | 🟡 |
| 51 | AO views student availability | AO | AO → Students → click student → Availability tab | All submitted slots shown with day/time/preference | 🟡 |
| 52 | AO uses availability to inform scheduling | AO | Cross-reference availability while creating sessions | AO can see which days students prefer before picking session time | 🟢 |

---

## Day 5 — 3 May 2026
### Theme: PRE-CLASS FLOW — Reminders, Lobby, Teacher Enters, BC Goes Live
> From "15 minutes before class" to "teacher is live and ready." This is the daily handshake.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 1 | Session reminder — WhatsApp (15 min before) | Auto | Schedule session 20 min from now, wait 5 min | WhatsApp arrives exactly at 15 min mark for student | 🔴 |
| 2 | Session reminder — email (15 min before) | Auto | Same session | Email reminder also received | 🔴 |
| 3 | Parent receives reminder | Auto | Same session | Parent WA/email received too | 🟡 |
| 4 | Student opens join link from reminder | Student | Click link in WA message | Pre-join lobby loads | 🔴 |
| 5 | Pre-join lobby loads | Student | Lobby screen | Device check screen shown before room entry | 🔴 |
| 6 | Mic test in lobby | Student | Speaks in lobby | Audio meter moves | 🔴 |
| 7 | Camera test in lobby | Student | Enables camera | Video preview shown | 🔴 |
| 8 | Mic denied by browser — lobby handles it | Student | Browser popup → deny mic | Lobby shows "mic denied" warning, can still enter | 🔴 |
| 9 | Camera not found — lobby handles it | Student | Device has no camera | Lobby shows "no camera found", can still enter | 🔴 |
| 10 | Poor network warning in lobby | Student | Throttle connection | Lobby shows "poor connection" warning | 🟡 |
| 11 | Student skips device check | Student | Click "Enter anyway" | Enters room without completing checks | 🟡 |
| 12 | Student enters room — waits for teacher | Student | Enter before teacher goes live | Waiting state shown, not an error | 🟡 |
| 13 | Teacher login | Teacher | Login on Chrome | Dashboard, today's session card visible | 🔴 |
| 14 | Teacher pre-join lobby | Teacher | Click Join → lobby | Device check for teacher | 🔴 |
| 15 | Teacher enters room | Teacher | Enter from lobby | Room loads, teacher's own video tile shows | 🔴 |
| 16 | BC is online (heartbeat active) | BC | BC logs in, stays on dashboard | BC heartbeat active, coordinator-status = online | 🔴 |
| 17 | Teacher sends go-live request | Teacher | Click Go Live | Request sent to BC | 🔴 |
| 18 | BC sees go-live approval dialog | BC | BC dashboard / notification | Dialog appears with approve/deny | 🔴 |
| 19 | BC approves go-live | BC | Click Approve | Room status → live | 🔴 |
| 20 | Students auto-enter after go-live | Students | Were waiting in room | Students who were waiting now see the live room | 🟡 |
| 21 | BC offline — go-live blocked | BC | BC logs out → teacher → Go Live | Request either queued or teacher sees "coordinator offline" | 🔴 |
| 22 | Go-live skip toggle (bypass approval) | AO | Set `go_live_skip_coordinator = true` → teacher → Go Live | Goes live immediately, no BC needed | 🔴 |
| 23 | Early start toggle | AO | Set `allow_go_live_before_schedule = true` → teacher goes live 10 min early | Room goes live before scheduled time | 🟡 |
| 24 | BC denies go-live request | BC | BC clicks Deny | Teacher sees denied, must wait or re-request | 🟡 |
| 25 | Teacher denied — re-requests | Teacher | Teacher re-sends go-live request | BC gets second notification | 🟡 |
| 26 | Student joins before class (no teacher yet) | Student | Opens link 10 min before scheduled time | Lobby or waiting room shown, not error | 🟡 |
| 27 | Student joins via email link — no login needed | Student | Click pre-auth token link | Enters directly without login screen | 🔴 |
| 28 | Join link from reminder works on Android | Student | Open WA → tap link on Android | Pre-join lobby opens in mobile browser | 🔴 |
| 29 | Join link from reminder works on iOS | Student | Open WA → tap link on iPhone | Pre-join lobby opens in Safari | 🔴 |
| 30 | Room shows "live" to BC after approval | BC | BC checks live dashboard | Room card shows LIVE status | 🔴 |

---

## Day 6 — 5 May 2026
### Theme: LIVE CLASS — Core Features (1:1 and 1:3, Desktop)
> Class is live. Test every feature a teacher and student use in a normal class.

| # | Scenario | Steps | Expected | Phase |
|---|---|---|---|---|
| 1 | Teacher mic on/off | Teacher toggles mic | Icon updates, student hears change instantly | 🔴 |
| 2 | Teacher camera on/off | Teacher toggles camera | Video tile shows/hides, student sees change | 🔴 |
| 3 | Student mic on/off (1:1 and 1:3) | Student toggles mic | Teacher hears change | 🔴 |
| 4 | Student camera on/off | Student toggles camera | Teacher sees change | 🔴 |
| 5 | Both teacher and student video visible | Both cameras on | Each sees the other clearly | 🔴 |
| 6 | Teacher screen share — Chrome | Screen share → select entire screen | Student sees teacher's full screen | 🔴 |
| 7 | Teacher screen share — specific window | Teacher shares one app window | Only that window shown | 🟡 |
| 8 | Stop screen share | Teacher stops | Returns to camera view, no black screen | 🔴 |
| 9 | Teacher whiteboard | Opens whiteboard → draws | Student sees drawing in real time | 🟡 |
| 10 | Switch from screen share to whiteboard | Teacher switches | Smooth transition | 🟡 |
| 11 | Student raises hand | Student clicks ✋ | Teacher sees notification + sound | 🔴 |
| 12 | Teacher lowers hand | Teacher dismisses | Notification cleared | 🟡 |
| 13 | Multiple raises (1:3) | All 3 students raise hand | All 3 in queue on teacher side | 🟡 |
| 14 | Teacher mutes student | Right-click tile → Mute | Student muted, icon updates both sides | 🔴 |
| 15 | Teacher unmutes student | Right-click → Unmute | Student mic activates | 🟡 |
| 16 | Chat — student sends | Student types + send | Seen by teacher and all students | 🔴 |
| 17 | Chat — teacher sends | Teacher sends | All students see it | 🔴 |
| 18 | Contact violation — phone in chat | Student types phone number | Blocked / warning shown | 🟡 |
| 19 | Teacher spotlight student | Teacher clicks student → spotlight | Tile enlarges for teacher view | 🟡 |
| 20 | Teacher removes student | Teacher removes student from room | Student disconnects, sees "removed" message | 🔴 |
| 21 | Removed student tries to rejoin | Student opens link again | "Removed from session" — blocked | 🔴 |
| 22 | Teacher announcement | Teacher → Announcement bar → types | Students see/hear announcement overlay | 🟡 |
| 23 | Time warning dialog | Approach scheduled end time | Warning dialog appears for teacher | 🟡 |
| 24 | Teacher creates homework in room | Homework tab → create assignment | Homework visible to students | 🟡 |
| 25 | Teacher pushes session exam | Exam tab → start exam | Exam pushed to all students in room | 🔴 |
| 26 | Student answers session exam | Student selects answers | Answers saved, 60s timer shown | 🔴 |
| 27 | Exam auto-graded | All submit | Scores calculated, grade letters assigned | 🔴 |
| 28 | Teacher ends class | End Class → confirm | All disconnected, status → ended | 🔴 |
| 29 | Post-class feedback dialog | Session ends | Feedback/rating dialog auto-appears for student | 🟡 |
| 30 | Attendance recorded | After session | All students marked with correct status and duration | 🔴 |

---

## Day 7 — 7 May 2026
### Theme: LIVE CLASS — All Batch Types & All Devices
> Same class, scaled up to all batch sizes and all devices students actually use.

| # | Scenario | Batch / Device | Expected | Phase |
|---|---|---|---|---|
| 1 | 1:15 — all 15 students join | 1:15 | All 15 visible, grid adapts, no crash | 🔴 |
| 2 | 1:15 — teacher audio reaches all | 1:15 | Stable audio to 15 students | 🔴 |
| 3 | 1:15 — teacher screen share | 1:15 | All 15 see the share | 🔴 |
| 4 | 1:15 — mute all / unmute one | 1:15 | Mute all works; unmute one only activates that student | 🟡 |
| 5 | 1:30 — all 30 students join | 1:30 | All 30 visible, grid scrollable, no crash | 🔴 |
| 6 | 1:30 — teacher audio stable | 1:30 | Stable to 30 students | 🔴 |
| 7 | 1:30 — end class gracefully | 1:30 | All 30 disconnected, session ended | 🔴 |
| 8 | Lecture — student mic/cam hidden | Lecture | No mic/camera controls for students | 🔴 |
| 9 | Lecture — 50 students join | Lecture | All 50 enter, no crash | 🔴 |
| 10 | Lecture — student raises hand | Lecture | Raise hand works even with mic disabled | 🔴 |
| 11 | Lecture — media request (student requests mic) | Lecture | Teacher sees request → approve/deny | 🟡 |
| 12 | Student joins — Desktop Chrome | Desktop Chrome | Room loads, video/audio works | 🔴 |
| 13 | Student joins — Desktop Firefox | Desktop Firefox | Same | 🔴 |
| 14 | Student joins — Desktop Edge | Desktop Edge | Same | 🔴 |
| 15 | Student joins — Desktop Safari (Mac) | Desktop Safari | Room loads, permissions work | 🔴 |
| 16 | Student joins — Internet Explorer | IE | Graceful "browser not supported" page — no crash | 🔴 |
| 17 | Student joins — Android Chrome | Android Chrome | Room loads, video/audio works | 🔴 |
| 18 | Student joins — iOS Safari | iOS Safari | Room loads, mic/cam permissions correct | 🔴 |
| 19 | Student joins — Samsung Internet | Samsung Internet | Loads or graceful fallback | 🟡 |
| 20 | Student via email link (no login) | Any device | Pre-auth token works, enters without login | 🔴 |
| 21 | Overlay auto-hide (mobile) | Android/iOS | Controls fade after 3s inactivity | 🟡 |
| 22 | Tap to reveal overlays | Android/iOS | Controls reappear on tap | 🟡 |
| 23 | Landscape rotation | Android/iOS | UI fills landscape, no layout breaks | 🟡 |
| 24 | Teacher mic/cam — iOS | iOS Safari | Toggles correctly | 🔴 |
| 25 | Teacher mic/cam — Android | Android Chrome | Toggles correctly | 🔴 |
| 26 | Screen share — Firefox | Desktop Firefox | Works correctly | 🔴 |
| 27 | Screen share — Safari | Desktop Safari | Works with permissions | 🟡 |
| 28 | AI monitoring loads — Chrome | Chrome Desktop | Loads silently | 🔴 |
| 29 | AI monitoring loads — iOS Safari | iPhone | Loads on mobile Safari | 🔴 |
| 30 | AI monitoring loads — Android | Android Chrome | Loads on Android | 🔴 |

---

## Day 8 — 8 May 2026
### Theme: LIVE CLASS — Edge Cases, Teacher Controls & Advanced Features
> Things that happen unexpectedly. Advanced teacher tools.

| # | Scenario | Steps | Expected | Phase |
|---|---|---|---|---|
| 1 | Student drops mid-class (tab closed) | Student closes tab → reopens link 2 min later | Rejoins seamlessly, attendance time accumulates | 🔴 |
| 2 | Teacher internet drops briefly | Simulate brief disconnect | Students see "teacher disconnected" → teacher reconnects | 🔴 |
| 3 | Teacher mic fails mid-class | Mic drops unexpectedly | Students see mic-off icon; teacher can re-enable | 🔴 |
| 4 | Teacher camera drops mid-class | Cam disconnects | Students see avatar tile; teacher can re-enable | 🔴 |
| 5 | 3 students join simultaneously | All 3 click join at same second | All 3 enter, no race condition, all attendance recorded | 🔴 |
| 6 | Student joins on two devices | Same student: phone + laptop | Second join shown or blocked gracefully | 🟡 |
| 7 | Long class — 90 minutes | Run 1:1 class for 90 min | No timeout, no auto-disconnect | 🔴 |
| 8 | Session extended beyond scheduled time | Teacher continues past end | Timer shows overtime, session stays live | 🟡 |
| 9 | Session extension request | Student requests more time → teacher approves | Session extended | 🟡 |
| 10 | Selective session extension | Extend for student A, end for student B | A stays, B disconnects | 🟡 |
| 11 | Teacher requests early end — BC approves | Teacher → End Early → BC approves | Class ends | 🟡 |
| 12 | Teacher requests early end — BC denies | BC denies | Class continues | 🟡 |
| 13 | Virtual background — blur | Teacher → background blur | Blur applied, smooth video | 🟢 |
| 14 | Virtual background — image | Teacher sets background image | Image shown behind teacher | 🟢 |
| 15 | Video quality selector | Teacher changes quality to Low | Bitrate drops | 🟢 |
| 16 | Recording start | Teacher → start recording | Recording begins, REC indicator shown | 🟡 |
| 17 | Recording stop | Teacher stops | URL saved | 🟡 |
| 18 | Teacher tablet (screen-share role) | Teacher joins second device as teacher_screen | Tablet screen visible in room | 🟡 |
| 19 | Student posts doubt | Doubt panel → type question → submit | Doubt logged, teacher notified | 🟡 |
| 20 | Teacher responds to doubt | Teacher → Doubts → responds | Student sees reply | 🟡 |
| 21 | Student submits homework | Homework panel → upload file → submit | Submission received | 🟡 |
| 22 | Teacher views all homework submissions | Teacher → Homework | All submissions listed | 🟡 |
| 23 | Report teacher button | Student → report teacher → fills form → submit | Report saved, AO notified | 🟡 |
| 24 | Teacher controls toggle — disable exam | AO sets `allow_exam_push = false` → teacher UI | Exam button hidden for teacher | 🟡 |
| 25 | Teacher controls toggle — disable recording | AO sets `allow_recording = false` | Recording button hidden | 🟡 |
| 26 | Teacher controls toggle — disable homework | AO sets `allow_homework_create = false` | Homework button hidden | 🟡 |
| 27 | Contact violation — Telegram handle | Student types @handle in chat | Blocked/warned | 🟡 |
| 28 | Contact violation — Instagram link | Student types Instagram URL | Blocked/warned | 🟡 |
| 29 | Session ends — all students disconnected gracefully | Teacher ends with students in room | No hanging connections | 🔴 |
| 30 | Session status after end | BC/AO checks | Status = ended, correct start/end times | 🔴 |

---

## Day 9 — 9 May 2026
### Theme: POST-CLASS — Attendance, Exam Results, Feedback, Reports
> Everything that happens after the class ends.

| # | Scenario | Steps | Expected | Phase |
|---|---|---|---|---|
| 1 | Present — on-time join | Student joins within 5 min | Status = present | 🔴 |
| 2 | Late — joins 10 min after start | Student joins at 10 min | Status = late, late_by_sec = 600 | 🔴 |
| 3 | Absent — never joined | Student never opens link | Status = absent after session ends | 🔴 |
| 4 | Left early — short session | Student joins 10 min, leaves, no rejoin | Duration = 10 min, status = left_early or present | 🔴 |
| 5 | Duration accumulates across rejoins | Join 20 min → leave → rejoin 15 min | Total ~35 min | 🔴 |
| 6 | Attendance for 30 students | 30 students join at various times | All 30 entries, none missing | 🔴 |
| 7 | Teacher manual attendance override | Teacher → Attendance tab → mark "excused" | Override saved | 🟡 |
| 8 | BC views attendance post-session | BC → Session → Attendance | All students listed with duration, status, join time | 🟡 |
| 9 | AO views attendance | AO → Batch → Session → Attendance | Same data visible to AO | 🟡 |
| 10 | Parent views child's attendance | Parent → Attendance | Correct status for this session | 🟡 |
| 11 | Student views own attendance | Student → Attendance | Correct status shown | 🟡 |
| 12 | Exam result email — student | After auto-grade | Student receives result email with score + grade letter | 🔴 |
| 13 | Exam result email — parent | Same | Parent also receives result email | 🔴 |
| 14 | Teacher views all exam scores | Teacher → Exam Results tab | All student scores with grade letters | 🟡 |
| 15 | Session exam — tab switch violation | Student switches tab during exam | Violation logged, teacher notified | 🟡 |
| 16 | Session exam — auto-submit on timeout | No answer → timer runs out | Auto-submitted with current state | 🟡 |
| 17 | Post-session feedback saved | Student submits rating | Rating stored, visible to AO/owner | 🟡 |
| 18 | No daily AI monitoring report to parent | Session ends with monitoring events | Parent does NOT get daily email | 🔴 |
| 19 | Monthly report only | Check report config | Only monthly frequency configured | 🔴 |
| 20 | Monthly monitoring report content | View generated monthly report | Attention score, alert breakdown, time-in-states shown | 🟢 |
| 21 | Session report generated | AO/BC → Session → Report | Report shows summary: attendance, exam scores, duration | 🟡 |
| 22 | Batch report generated | BC → Batch Report | Attendance trends across sessions shown | 🟡 |
| 23 | Attendance after teacher ends early | BC approves early end | Attendance closed at actual end time, not scheduled | 🟡 |
| 24 | Attendance export PDF | BC → Export | PDF downloads correctly | 🟢 |
| 25 | Topic marked taught after session | Academic Calendar | Session's linked topic marked as covered | 🟡 |
| 26 | Next topic suggestion updated | Teacher/AO | Next Topics view | Shows next in sequence, not the just-covered one | 🟡 |
| 27 | Student session history updated | Student | Student → My Sessions | Just-completed session appears with status | 🟡 |
| 28 | Teacher session history | Teacher | Teacher → My Sessions | Session shown with attendance count, exam results | 🟡 |
| 29 | Recurring session: attendance across 4 weeks | Run 4 sessions | History shows all 4 sessions per student | 🟡 |
| 30 | AO full reports — platform-wide | AO | AO → Reports | Attendance, revenue, teacher perf, student progress all available | 🔴 |

---

### STANDALONE EXAMS (Assigned to Batch, Not Live-Pushed)
> Teacher creates exam in dashboard → assigns to batch with due date → students take it from their Exams tab.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 31 | Teacher creates standalone exam | Teacher | Teacher → Exams tab → New Exam → title, add questions from question bank | Exam created, status=draft | 🔴 |
| 32 | Teacher assigns exam to batch with due date | Teacher | Exam → Assign to Batch → 1:15 QA batch → due in 3 days | All students in batch can see the exam | 🔴 |
| 33 | Student sees pending exam in dashboard | Student | Student → Exams tab | Exam listed with title, due date, status=pending | 🔴 |
| 34 | Student takes standalone exam | Student | Student → Exams → Start → answer MCQs → Submit | Auto-graded; score and grade letter shown immediately | 🔴 |
| 35 | Teacher reviews all submissions | Teacher | Teacher → Exams → click exam → Submissions | All student attempts listed: score, grade, time taken | 🟡 |
| 36 | AO views all exams platform-wide | AO | AO → Exam Questions / Exams list | All exams: creator, question count, attempt count visible | 🟡 |

---

### TEACHER RATINGS & FEEDBACK
> Students rate the teacher after each session via the post-class feedback dialog.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 37 | Student submits post-session rating | Student | Post-class feedback dialog → star rating (1–5) + optional comment → Submit | Rating stored; associated with teacher + session | 🔴 |
| 38 | Teacher sees cumulative ratings in Ratings tab | Teacher | Teacher → Ratings tab | Average stars, per-session breakdown, comments all listed | 🟡 |
| 39 | AO sees teacher rating summary | AO | AO → Teachers → click teacher profile | Rating history with averages visible | 🟡 |
| 40 | Owner sees all teacher ratings | Owner | Owner → Teacher Reports | All teachers listed with average rating and trend | 🟢 |

---

## Day 10 — 12 May 2026
### Theme: STUDENT MANAGEMENT — Add Mid-Batch, Block, Remove, Ongoing Operations
> Ongoing daily operations: students join mid-series, get blocked, removed, re-added.

| # | Scenario | Steps | Expected | Phase |
|---|---|---|---|---|
| 1 | Add student mid-recurring batch | AO adds student after 4-week recurring series exists | Student gets backfilled tokens for all remaining future sessions | 🔴 |
| 2 | New student joins backfilled session | New student opens backfilled join link | Enters room successfully, attendance recorded | 🔴 |
| 3 | Add 3rd student to 1:3 batch mid-series | After recurring sessions exist → add student 3 | Student 3 gets all future tokens | 🔴 |
| 4 | New student's gate check | New student with credits → joins | Enters; without credits → blocked | 🔴 |
| 5 | Block student | AO → Student → Block | Account suspended | 🔴 |
| 6 | Blocked student login | Blocked student tries to login | "Account suspended" — not blank | 🔴 |
| 7 | Blocked student join link | Blocked student tries join link | "Account suspended" gate | 🔴 |
| 8 | Unblock student | AO → Unblock | Login and join restored | 🔴 |
| 9 | Remove student from batch | AO → Batch → Remove student | Student removed, future tokens invalidated | 🔴 |
| 10 | Removed student's old join link | After removal → old link | "No longer enrolled in this batch" — not a crash | 🔴 |
| 11 | Remove student mid-recurring batch | 5 sessions remain → remove student | All 5 future tokens invalidated | 🔴 |
| 12 | Re-add removed student | AO re-adds same student | Back in batch, tokens backfilled again | 🟡 |
| 13 | Delete student from system | AO deletes student entirely | All join links invalid, account gone | 🔴 |
| 14 | Teacher deactivated | AO → Users → Teacher → deactivate | Teacher cannot login | 🔴 |
| 15 | Deactivated teacher's sessions flagged | BC checks sessions | Flagged: "teacher unavailable" | 🔴 |
| 16 | BC assigns substitute teacher | BC → flagged session → assign substitute | Substitute sees session | 🔴 |
| 17 | Teacher reactivated | AO → reactivate | Teacher can login and teach | 🔴 |
| 18 | Teacher leave request | Teacher → Apply Leave | Leave request submitted | 🔴 |
| 19 | HR approves teacher leave | HR → Teacher Leave → approve | Approved, sessions flagged | 🔴 |
| 20 | BC assigns substitute after leave approved | BC → flagged session → assign substitute | Substitute assigned | 🔴 |
| 21 | Student full profile view | AO | AO → Students → click any student | Name, email, grade, board, region, credits, attendance %, batch list all visible | 🟡 |
| 22 | Multiple teachers per subject — AO assigns per session | AO | 1:15 batch → Sessions → assign Teacher A to Monday, Teacher B to Wednesday | Each teacher sees only their own assigned sessions in dashboard | 🟡 |
| 23 | Edit student details | AO → Student → Edit phone/grade | Updated correctly | 🟡 |
| 24 | Add parent email to student | AO → Student → add parent email | Parent linked, receives future emails | 🟡 |
| 25 | Student self-registration blocked | Student goes to /login | No self-registration option | 🔴 |
| 26 | Student profile page | Student login → profile | Name, batch, attendance, credits, exams all shown | 🟡 |
| 27 | Parent files complaint | Parent → Complaints → file | Submitted, AO notified | 🟡 |
| 28 | AO views complaint | AO → dashboard | Complaint visible | 🟡 |
| 29 | CRM verifies students | AO | AO checks students from stibelearningventures@gmail.com | Students verifiable and assignable | 🔴 |
| 30 | Ghost audit log entry | AO/Ghost observes class → leaves | ghost_audit_log entry created | 🟡 |

---

### TEACHER LEAVE — FULL 5-STEP WORKFLOW
> Tests 18–20 above cover the basic path. These cover the complete approval chain with email notifications at every step.
> Flow: Teacher submits → AO reviews affected sessions → AO sets resolution plan → HR approves → AO confirms.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 31 | Teacher submits leave request | Teacher | Teacher → Leave Requests → Apply Leave → start_date, end_date, leave_type=sick, reason | Request created, status=pending_ao; AO notified | 🔴 |
| 32 | AO sees pending leave request | AO | AO → Leave Requests tab | New request listed: teacher name, dates, affected session count | 🔴 |
| 33 | AO views affected sessions | AO | Open request → affected sessions | All sessions within the leave date range listed | 🔴 |
| 34 | AO assigns substitute for each session | AO | Affected session → assign substitute teacher | Substitute field updated; resolution plan saved | 🔴 |
| 35 | AO forwards to HR with resolution plan | AO | Request → Forward to HR → add notes | Status = pending_hr; HR notified by email | 🔴 |
| 36 | HR reviews and approves plan | HR | HR → Leave Requests → open → Approve | Status = approved; AO notified by email | 🔴 |
| 37 | AO confirms approved leave | AO | Request → Confirm | Status = confirmed; substitute teacher receives session notification | 🔴 |
| 38 | Substitute teacher sees new session | Sub Teacher | Login → My Sessions | New session with original batch appears; original teacher name shown for reference | 🔴 |
| 39 | Students notified of teacher change | Students | Check email/WA | Notification: session date, new teacher name, subject | 🔴 |
| 40 | Teacher withdraws pending request | Teacher | Teacher → Leave Requests → Withdraw (before AO confirms) | Status = withdrawn; sessions unaffected; HR notified | 🟡 |

---

### SESSION REQUESTS WORKFLOW
> Students, parents, or teachers submit reschedule/cancel requests → AO approves/rejects → notification chain fires.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 41 | Student submits reschedule request | Student | Student → Requests tab → New Request → type=reschedule, session, reason, proposed_date | Request submitted, status=pending; AO notified by email | 🔴 |
| 42 | Parent submits reschedule request | Parent | Parent → Requests tab → New Request | Request submitted on behalf of child | 🟡 |
| 43 | AO views all pending session requests | AO | AO → Leave Requests / Requests section | Pending requests listed: type, requester role, session name, proposed date | 🔴 |
| 44 | AO approves → session rescheduled | AO | Request → Approve → confirm | Session time updated; all enrolled students + parents notified via WA + email | 🔴 |
| 45 | AO rejects → requester notified with reason | AO | Request → Reject → enter rejection_reason | Status = rejected; email with reason sent to requester | 🔴 |
| 46 | Teacher submits cancel request | Teacher | Teacher → via dashboard → cancel session request | Request created; AO reviews; teacher notified of outcome | 🟡 |

---

### ADMISSIONS WORKFLOW
> Structured pipeline: enquiry → registered → fee_confirmed → allocated → active.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 47 | AO creates admission request | AO | AO → Admissions → New → name, grade, board, contact | Admission record created, status=enquiry | 🟡 |
| 48 | AO advances to registered | AO | Admission → Update Status → registered | Status updated; timestamp recorded | 🟡 |
| 49 | AO advances to fee_confirmed | AO | Update → fee_confirmed | Status updated | 🟡 |
| 50 | AO allocates to batch | AO | Update → allocated → link batch | Status = allocated; batch linked to record | 🟡 |
| 51 | AO marks as active | AO | Update → active | Student fully onboarded; record status = active | 🟡 |
| 52 | HR views admission pipeline | HR | HR login → view Admissions | All admission records visible with current status and count per stage | 🟡 |

---

## Day 11 — 13 May 2026
### Theme: AI MONITORING, GHOST MODE & BC LIVE MONITORING
> Silent observation, attention tracking, alert policies.

| # | Scenario | Steps | Expected | Phase |
|---|---|---|---|---|
| 1 | AI monitoring loads — Chrome | Desktop Chrome student | MediaPipe loads silently, no errors | 🔴 |
| 2 | AI monitoring loads — Firefox | Desktop Firefox | No errors | 🔴 |
| 3 | AI monitoring loads — Safari Mac | Desktop Safari | Works or graceful disable | 🔴 |
| 4 | AI monitoring loads — iOS Safari | iPhone | Active on mobile Safari | 🔴 |
| 5 | AI monitoring loads — Android Chrome | Android | Active on Android | 🔴 |
| 6 | Short blink — NO alert | Student blinks normally | No alert | 🟡 |
| 7 | Sustained eyes closed (3+ min) — alert | Student closes eyes 3+ min | Alert in teacher monitoring tab | 🟡 |
| 8 | Looking away — alert | Student looks away continuously | Alert after threshold | 🟡 |
| 9 | Not in frame | Student leaves camera view | "Not in frame" event logged | 🟡 |
| 10 | Tab switch detection | Student switches browser tab | Tab-switch shown to teacher | 🟡 |
| 11 | Writing aware mode ON | Student writes notes (mode enabled) | NOT flagged as "looking away" | 🟡 |
| 12 | Exam strict mode | Exam running + strict mode on | Stricter alerts during exam | 🟡 |
| 13 | Mobile relaxed thresholds | Student on phone + mode enabled | Fewer false alerts on mobile | 🟡 |
| 14 | Low visibility state | Student in poor lighting | "Low visibility" state, not false alert | 🟡 |
| 15 | Teacher sees monitoring tab | Teacher → Monitoring sidebar tab | Real-time alerts shown | 🟡 |
| 16 | BC sees monitoring alerts | CoordinatorLiveView → Monitoring | Same alerts | 🟡 |
| 17 | Dismiss an alert | Teacher/BC clicks dismiss | Alert removed from list | 🟡 |
| 18 | No daily report to parent | Session ends | Parent does NOT receive daily email | 🔴 |
| 19 | Monthly report confirmed | Check config | Monthly frequency only | 🔴 |
| 20 | Ghost (Owner) joins live session | Owner enters live room | Invisible to all, can see everything | 🔴 |
| 21 | Ghost not in participant list | Teacher/students check list | Ghost not listed, count unaffected | 🔴 |
| 22 | Ghost sees all student tiles | GhostView | All participant tiles shown | 🔴 |
| 23 | Ghost view modes switch | Control → Teacher → Student | Layout changes correctly | 🟡 |
| 24 | Ghost/AO is view-only in classroom | AO ghost → tries to unmute or publish | Audio/video publish blocked — ghost is always view-only | 🔴 |
| 25 | Parent ghost — view only | Parent joins as ghost | Cannot publish or announce | 🟡 |
| 26 | BC live monitoring dashboard | BC → Live | All active rooms for assigned batches listed | 🔴 |
| 27 | BC enters room from dashboard | BC clicks live room card | CoordinatorLiveView loads, BC hidden | 🔴 |
| 28 | BC sees all participants | Inside CoordinatorLiveView | Full grid + attention states visible | 🔴 |
| 29 | BC starts recording | CoordinatorLiveView → Record | YouTube egress starts | 🟡 |
| 30 | Ghost audit log entry | AO observes class → leaves | ghost_audit_log entry created with room, observer, duration | 🟡 |

---

### AI MONITORING PARAMETER TUNING
> Teacher configures alert thresholds per-session from the Monitoring tab inside the classroom.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 31 | Teacher opens monitoring settings in classroom | Teacher | Inside classroom → Monitoring tab → Settings icon | Tuning panel opens with threshold controls | 🟡 |
| 32 | Teacher adjusts writing-mode look-down angle threshold | Teacher | Slider for writing-mode angle → increase value | Value saved; applies to this session | 🟡 |
| 33 | Teacher saves tuning config | Teacher | Save Settings | Confirmation shown; config persisted for this teacher | 🟡 |
| 34 | Reduced false alerts after tuning | Teacher + students | Run 15-min class with active note-taking | Writing-mode false alerts suppressed; genuine attention alerts still fire | 🟡 |

---

### GHOST MODE — BY BATCH, BY TEACHER & OVERSIGHT DASHBOARD

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 35 | Ghost → filter sessions by batch | Ghost/Owner | Ghost → By Batch tab → select batch | All live sessions for that batch listed | 🔴 |
| 36 | Ghost → filter sessions by teacher | Ghost/Owner | Ghost → By Teacher tab → select teacher | Live sessions where that teacher is active shown | 🟡 |
| 37 | Ghost Oversight dashboard (`/ghost/monitor`) | Ghost | Ghost → Oversight nav item | Cross-session monitoring view — all live rooms visible at once | 🔴 |
| 38 | Ghost enters room from By Batch view | Ghost | Click live room card → enter | GhostView loads; ghost invisible to all participants; audit log entry created | 🔴 |

---

### BC TEACHER REPORTS

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 39 | BC views teacher performance report | BC | BC dashboard → Teacher Reports tab | Each teacher's session count, attendance rate, avg exam score — filtered to assigned batches only | 🟡 |
| 40 | BC exports teacher report | BC | Teacher Reports → Export | CSV or PDF downloads with correct data | 🟢 |
| 41 | AO views teacher reports platform-wide | AO | AO → Teacher Reports | All teachers; filterable by batch, subject, date range | 🟡 |

---

## Day 12 — 14 May 2026
### Theme: OWNER, HR, SALES & PARENT PORTALS
> Every remaining role tested end to end.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 1 | Owner login | Owner | Login → dashboard | Full platform: all users, batches, stats | 🔴 |
| 2 | Owner sets custom permission for BC | Owner | Permissions → BC user → add `fees_view = true` | Permission saved | 🔴 |
| 3 | Custom permission applies to that BC | BC | BC logs in → fees section | Fee data now visible | 🔴 |
| 4 | Owner views AO users | Owner | Owner → Admins → view AO user list | All AO users visible, read-only | 🟡 |
| 5 | Owner views global reports | Owner | Owner → Reports | All types: revenue, attendance, teacher performance, student progress — read-only | 🔴 |
| 6 | Owner views system settings | Owner | Owner → System | Config visible, read-only — no edits | 🟡 |
| 7 | HR login | HR | Login → HR dashboard | Users, attendance, payroll visible | 🔴 |
| 8 | HR resets teacher password | HR | HR → Users → Teacher → Reset Password | New password sent, teacher can login | 🔴 |
| 9 | HR approves teacher leave | HR | Teacher Leave → approve | Leave approved, sessions flagged | 🔴 |
| 10 | Teacher salary live tracking | Teacher | Teacher → Salary | Earnings updated after each session | 🟡 |
| 11 | HR generates payslip | HR | Payroll → generate payslip | Payslip created | 🟡 |
| 12 | Payslip PDF download | HR | Download payslip PDF | PDF correct, proper amounts | 🟡 |
| 13 | Sales login | Sales | Login → Sales dashboard | Leads, pipeline, activities visible | 🔴 |
| 14 | Sales sends demo link | Sales | Sales → Lead → Send Demo Link | WA message sent to prospect | 🔴 |
| 15 | Sales views leads | Sales | Sales → Leads | Full lead list with status | 🟡 |
| 16 | Facebook lead sync | Sales | Sales → FB Sync | Leads from Facebook imported | 🟢 |
| 17 | Parent login | Parent | Login → Parent dashboard | Child's sessions, attendance, fees visible | 🔴 |
| 18 | Parent views child attendance | Parent | Parent → Attendance | Correct status for recent sessions | 🔴 |
| 19 | Parent views child exam results | Parent | Parent → Exams | Exam results shown | 🟡 |
| 20 | Parent views child fees | Parent | Parent → Fees | Invoice history, credit balance | 🟡 |
| 21 | Parent files complaint | Parent | Complaints → file | Complaint submitted, AO notified | 🟡 |
| 22 | Open Classroom — create | AO | Open Classroom → New → subject, grade | OC created, shareable URL generated | 🟡 |
| 23 | Open Classroom — public join | Anyone | Open `/open-classroom/[token]` without login | Joins as viewer | 🟡 |
| 24 | Open Classroom — join approval | Host | OC with approval → request join → host approves | Works | 🟡 |
| 25 | Conference — create | Teacher | Conference → create | Conference room created | 🟡 |
| 26 | Conference — join via token | Anyone | `/conference/[token]` | Joins conference | 🟡 |
| 27 | Buji AI chatbot | Anyone | Login page → chat with Buji | Responds correctly | 🟢 |
| 28 | Dev routes disabled in production | Dev | GET `/api/v1/dev/token` in production | 404 or 403 — not accessible | 🔴 |
| 29 | Health check | Dev | GET `/api/v1/health` | 200 with server status | 🔴 |
| 30 | WhatsApp webhook callback | Auto | Inbound WA message arrives | Processed without 500 error | 🟢 |

---

### DEMO SESSION — FULL FLOW
> Sales creates demo link → prospect joins without login → attends class → takes demo exam → post-demo summary sent.

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 31 | Sales creates demo link from Sales dashboard | Sales | Sales → Leads → Lead card → Send Demo Link | Demo link generated; WhatsApp message sent to prospect's phone | 🔴 |
| 32 | Prospect opens demo link without login | Guest | Open `/demo/[linkId]` in browser | Demo landing page loads: class name, subject, teacher name shown | 🔴 |
| 33 | Prospect fills name and contact on demo page | Guest | Name, Phone → Join | Proceeds to pre-join lobby | 🔴 |
| 34 | Guest joins live session room | Guest | Enter from lobby | Guest tile appears in room; teacher sees "guest joined" in demo tab | 🔴 |
| 35 | Teacher sees guest in Demo tab | Teacher | Teacher sidebar → Demo tab | Guest name, join time listed | 🟡 |
| 36 | Teacher pushes demo exam to guest | Teacher | Demo tab → Push Exam to Guest | Guest receives exam overlay with MCQ questions | 🟡 |
| 37 | Guest submits demo exam | Guest | Answer questions → Submit before timer | Answers recorded; score shown to guest; result saved | 🟡 |
| 38 | Post-demo summary email sent to sales team | Auto | After demo session ends | Email: guest name, time-in-class, exam score, next-step prompt | 🟡 |
| 39 | AO views demo session history | AO | AO → Demo tab | All demo sessions: date, teacher, guest name, duration, exam score | 🟡 |
| 40 | Teacher views own demo sessions | Teacher | Teacher → Demo tab | Own demo sessions listed with guest details and status | 🟡 |

---

### SALES DASHBOARD — PIPELINE, ACTIVITIES, REMINDERS, REPORTS

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 41 | Sales creates lead manually | Sales | Sales → Leads → New Lead → name, phone, grade, board, interest | Lead created, status=new; visible in leads list | 🔴 |
| 42 | Sales moves lead through pipeline stages | Sales | Lead → drag to Contacted → Interested → Negotiation → Converted | Stage updates; timestamp recorded in timeline | 🟡 |
| 43 | Sales logs activity against lead | Sales | Lead → Activities → Add → type=call, notes, date | Activity saved; visible in lead timeline | 🟡 |
| 44 | Sales sets follow-up reminder | Sales | Lead → Reminders → Add → due date, note | Reminder created in system | 🟡 |
| 45 | Reminder fires notification on due date | Auto | Wait for reminder due date | Sales sees in-app notification or email alert | 🟡 |
| 46 | Sales views sales reports | Sales | Sales → Reports tab | Conversion rate, leads by stage, demos booked, revenue this month — all shown | 🟡 |

---

### HR DASHBOARD — REMAINING TABS

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 47 | HR sets fee rate per teacher | HR | HR → Fee Rates tab → select teacher → set rate per session | Rate saved; affects next payslip calculation | 🟡 |
| 48 | HR views cancellation records | HR | HR → Cancellations tab | All cancelled sessions listed: reason, teacher, date, batch | 🟡 |
| 49 | HR creates new HR user (HR Credentials) | HR | HR → HR Credentials → New HR User → email, name | New HR account created; welcome email sent | 🟡 |

---

### AO SETTINGS TAB

| # | Scenario | Role | Steps | Expected | Phase |
|---|---|---|---|---|---|
| 50 | AO views platform settings | AO | AO → Settings tab | Settings visible: notification timing, fee defaults, go-live rules, session gate config | 🟡 |
| 51 | AO updates session reminder timing | AO | Settings → reminder_minutes → change 15 → 30 → Save | Setting persisted; next scheduled session uses 30-min reminder window | 🟡 |

---

## Day 13 — 15 May 2026 (Morning)
### Theme: EMAIL & WHATSAPP NOTIFICATIONS + FINAL CROSS-BROWSER VERIFICATION
> Test all critical notification types: delivery, content accuracy, links, and timing.
> Then final cross-browser pass on key flows not fully covered in Days 6–8.

#### Part 1 — Notification Testing

| # | Notification | Trigger | Recipients | Checks | Phase |
|---|---|---|---|---|---|
| 1 | Welcome email — manual enroll | AO enrolls student | Student | Arrives within 2 min, login link works, password correct | 🔴 |
| 2 | Welcome email — parent linked | AO enrolls with parent email | Parent | Arrives, parent login link works | 🟡 |
| 3 | Welcome email — enrollment link | Student self-enrolls + pays | Student | Arrives within 2 min, credentials correct | 🔴 |
| 4 | Invoice email | AO generates invoice | Student | Arrives, `/pay/[token]` link works, correct amount | 🔴 |
| 5 | Receipt email | Student pays invoice | Student + Parent | Both arrive, correct amount + invoice number | 🔴 |
| 6 | Session join link email | AO schedules session (student assigned) | Student | Arrives, join link is correct and functional | 🔴 |
| 7 | Session reminder — WhatsApp (15 min before) | Auto trigger | Student | WA message arrives at 15-min mark, tap-to-join link works | 🔴 |
| 8 | Session reminder — email (15 min before) | Auto trigger | Student | Email arrives at 15-min mark, join link works | 🔴 |
| 9 | Session reminder — parent | Auto trigger | Parent | Parent also receives WA + email reminder | 🟡 |
| 10 | Session cancellation notification | AO cancels session | Student + Parent | Both notified: session name, date, reason | 🔴 |
| 11 | Session reschedule notification | AO edits session time | Student + Parent | Notified with old time and new time | 🟡 |
| 12 | Teacher change notification | AO changes teacher on session | Student + New Teacher | Student gets new teacher info; new teacher sees session | 🟡 |
| 13 | Exam result email | Session ends → auto-grade | Student + Parent | Score, grade letter, session name in email | 🔴 |
| 14 | Payment reminder | AO sends reminder on unpaid invoice | Student + Parent | WA + email delivered with invoice details and payment link | 🟡 |
| 15 | Demo summary email | Demo session ends | Sales team | Post-demo summary: attendees, duration, prospect details | 🟢 |

#### Part 2 — Final Cross-Browser Verification

| # | Scenario | Browser / Device | Expected | Phase |
|---|---|---|---|---|
| 16 | Full class flow — Firefox Desktop | Firefox | Teacher + student join, all controls work end-to-end | 🔴 |
| 17 | Full class flow — Edge Desktop | Edge | Same | 🔴 |
| 18 | Full class flow — Safari Mac | Safari Desktop | Same | 🔴 |
| 19 | IE — graceful unsupported page | IE Desktop | "Browser not supported" — no crash, no blank page, helpful message | 🔴 |
| 20 | Screen share — Firefox | Firefox Desktop | Works, prompts screen selection | 🔴 |
| 21 | Screen share — Safari Mac | Safari Desktop | Works with permissions prompt | 🟡 |
| 22 | AI monitoring — Firefox | Firefox Desktop | Active, no errors | 🔴 |
| 23 | AI monitoring — Safari Mac | Safari Desktop | Active or graceful disable | 🔴 |
| 24 | iOS Safari — mic + camera permission | iPhone | Both permission prompts shown; allow → activate | 🔴 |
| 25 | Android Firefox — join + basic controls | Android Firefox | Room loads, mic/cam toggle work | 🟡 |
| 26 | Samsung Internet — join | Samsung browser | Room loads or shows graceful "switch to Chrome" | 🟡 |
| 27 | Role boundary: BC cannot schedule sessions (pending) | BC | No session scheduling option visible in BC nav | 🔴 |
| 28 | Role boundary: BC cannot see other batches | BC | Only assigned batches in list | 🔴 |
| 29 | Role boundary: BC cannot access finance | BC | Finance tab not in nav; direct URL access denied | 🔴 |
| 30 | Role boundary: student cannot self-register | Student | No signup option on login page; /register returns 404 or redirect | 🔴 |

---

## Day 14 — 15 May 2026 (Afternoon)
### Theme: FINAL REGRESSION — Full Flow, All Batch Types, All Devices
> The complete real-life journey from batch creation to class completion.

### Full 1:3 Lifecycle (Covers all Days 1–9)
| # | Step | Role | Device | Expected |
|---|---|---|---|---|
| 1 | AO creates 1:3 batch | AO | Desktop Chrome | Batch created |
| 2 | AO checks fee structure | AO | Desktop Chrome | Correct fee for 1:3, Kerala, CBSE shown |
| 3 | AO assigns coordinator | AO | Desktop | BC assigned |
| 4 | AO manually adds 2 students | AO | Desktop | Both added, welcome emails sent |
| 5 | AO creates academic calendar | AO | Desktop Firefox | Calendar created for batch |
| 6 | AO adds topics to calendar | AO | Desktop | Chapters/topics listed |
| 7 | AO schedules 3 recurring weekly sessions linked to topics | AO | Desktop Firefox | 3 sessions on correct dates, topics linked |
| 8 | BC assigns teacher to each session | BC | Desktop | Teacher sees all 3 sessions |
| 9 | AO generates invoices → students pay → credits added | AO + Students | Desktop | Credits added via Razorpay test |
| 10 | AO manually adds 3rd student (mid-series) | AO | Desktop | 3rd student gets backfilled tokens for all 3 sessions |
| 11 | 3rd student pays → gate unlocked | Student 3 | Desktop | Credits added |
| 12 | Gate test: 0 credits → join | Student 3 | iOS Safari | Blocked with payment prompt |
| 13 | Restore credits → join | Student 3 | iOS Safari | Enters successfully |
| 14 | Session reminder arrives 15 min before | All students | WA + email | Delivered at correct time |
| 15 | Students open lobby, check device | All 3 | Mixed devices | Lobby loads, device check works |
| 16 | BC approves teacher go-live | BC | Desktop | Room goes live |
| 17 | All 3 students join | S1: Chrome, S2: Android, S3: iOS | Mixed | All present, attendance records created |
| 18 | Teacher mic/cam/screen share | Teacher | Desktop | All 3 students see/hear correctly |
| 19 | Student 2 raises hand, teacher acknowledges | — | Mixed | Works |
| 20 | Chat: all 3 send messages | — | Mixed | All messages delivered |
| 21 | Teacher pushes session exam | Teacher | Desktop | Exam sent to all 3 |
| 22 | All 3 students submit exam | — | Mixed | Auto-graded, grade letters shown |
| 23 | Teacher ends class | Teacher | Desktop | All disconnected, session ended |
| 24 | Attendance: all 3 present, correct durations | BC | Desktop | Verified |
| 25 | Topic marked taught in academic calendar | — | — | Calendar updated |
| 26 | Exam result emails received | Students + Parents | — | All 6 emails arrived |
| 27 | AO ghost monitors the next session | AO | Desktop | Invisible, sees everything, audit log entry created |
| 28 | IE shows graceful error | Student 1 | IE Desktop | No crash, helpful message |
| 29 | No daily monitoring report to parents | Auto | — | Parent inbox: no daily email |
| 30 | Monthly-only report confirmed | — | — | Only monthly report in config |

---
---

# RUNNING ISSUES TRACKER

## 🔴 Red Zone — Open
| Bug ID | Feature | Description | Assigned | Status |
|---|---|---|---|---|
| — | — | — | — | — |

## 🟡 Yellow Zone — Open
| Bug ID | Feature | Description | Assigned | Status |
|---|---|---|---|---|
| — | — | — | — | — |

## 🟢 Green Zone — Open
| Bug ID | Feature | Description | Assigned | Status |
|---|---|---|---|---|
| — | — | — | — | — |

## ✅ Resolved
| Bug ID | Feature | Fix Summary | Fixed On | Verified By |
|---|---|---|---|---|
| — | — | — | — | — |

---
---

# DAILY SIGN-OFF CHECKLIST

```
Date          : ___________
Tester(s)     : ___________
Batch Types   : [ ] 1:1   [ ] 1:3   [ ] 1:15   [ ] 1:30   [ ] 1:many
Devices       : [ ] Desktop Chrome   [ ] Desktop Safari   [ ] Desktop Firefox
                [ ] Desktop Edge     [ ] IE               [ ] Android Chrome
                [ ] Android Firefox  [ ] iOS Safari       [ ] iOS Chrome
Bugs Found    : ___   🔴 Critical: ___   🟡 Important: ___   🟢 Polish: ___
Bugs Closed   : ___
Blocked Tests : ___
Overall Status: 🔴 / 🟡 / 🟢
Notes         : ___________
Sign-off      : ___________
```

---
---

# GREEN LAUNCH CRITERIA — 15 May 2026

### Platform Setup
- [ ] All batch types create correctly (1:1, 1:3, 1:15, 1:30, lecture)
- [ ] Fee structures correct for all region/board/batch-type combinations
- [ ] AO assigns coordinators; BC sees only assigned batches
- [ ] AO schedules sessions (BC session scheduling pending implementation); BC cannot create batches or access finance

### Student Acquisition & Enrollment
- [ ] AO manually adds student — account created, welcome email delivered, student can login
- [ ] Enrollment link → student self-signup → Razorpay payment → account created
- [ ] AO assigns enrolled student to batch → join tokens generated
- [ ] Batch created AFTER student enrolls — AO creates batch to house the student group
- [ ] Invoice → Razorpay → credits added end-to-end
- [ ] Public payment page `/pay/[id]` works without login
- [ ] Session gate blocks zero-credit students with payment prompt
- [ ] Demo link (secondary flow) → WhatsApp → prospect opens on mobile → guest joins as view-only
- [ ] CRM students (stibelearningventures@gmail.com) verifiable by AO

### Academic Calendar & Scheduling
- [ ] Academic calendar created, topics mapped to sessions
- [ ] Full week scheduled: 5 sessions across different subjects
- [ ] Recurring sessions on correct dates
- [ ] New student added mid-batch → backfill tokens → joins successfully
- [ ] BC assigns teachers per session (including multiple teachers per subject)

### Pre-Class
- [ ] Session reminder (WhatsApp + email) arrives exactly 15 min before
- [ ] Pre-join lobby loads; handles mic/cam denied and no camera gracefully
- [ ] BC go-live approval flow works (and bypass toggle works)

### Live Class
- [ ] Audio and video stable on Desktop, Android, iOS
- [ ] Screen share works on Chrome, Firefox, Safari
- [ ] All batch types stable (1:30 and lecture with 30/50 students)
- [ ] IE shows graceful "browser not supported" — no crash
- [ ] Teacher controls (mute, remove, spotlight, whiteboard, recording) all work
- [ ] Session exam push → student answers → auto-grade → result email

### Post-Class & Ongoing
- [ ] Attendance correct: present/late/absent/duration for all batch sizes
- [ ] Block/unblock student → gate applies correctly
- [ ] Deactivate teacher → sessions flagged → substitute assignable
- [ ] No daily parent AI report — monthly only confirmed
- [ ] Ghost observer is fully invisible; ghost_audit_log entry created

### Other Portals
- [ ] Owner custom permissions override role defaults
- [ ] HR approves teacher leave → sessions flagged
- [ ] Sales can send demo links
- [ ] Parent views attendance, fees, exam results

### Final
- [ ] All 14 daily sign-offs complete — zero open 🔴 bugs
- [ ] 420 test cases passed or documented
- [ ] Health check `/api/v1/health` returns 200
- [ ] Dev routes (`/dev/token`, `/dev/livekit-test`) inaccessible in production

---

*Document version: 4 (rewritten 28 April 2026)*
*Owner: Dev Team + Batch Coordinators*
*Review: CEO, Academic Operator*
*Deadline: 15 May 2026 | Total: 420 test cases*
