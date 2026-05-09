# Day 1 — 29 April 2026
## FULL PLATFORM FIRST RUN — Checklist
> Enroll Students → Create Batches → Schedule → Run Live Classes → All Features
>
> **Actual execution order:** Phase B (create batches) → Phase A (enroll into batches) → Phase C (schedule) → Phase D (live class) → Phase E (edge cases)
>
> **Test accounts (password `stibe@2026`):**
> - Owner: `stibelearningventures@gmail.com` · `owner@stibeedu.in`
> - HR: `hr@stibeedu.in`
> - AO (Academic Operator): `chinjurp333@gmail.com`
> - BC (Batch Coordinator): `Academiccoordinator1SUO@gmail.com`
> - Teacher — Math: `salihr@stibeedu.in` (Salih R)
> - Teacher — Physics: `salehl@stibeedu.in` (Saleh L)
> - Teacher — Chemistry: `bilal@stibeedu.in` (Bilal)
> - Teacher — Biology: `shafivk@stibeedu.in` (Shafi VK)
> - Students: create 30 fresh accounts during enrollment (S1–S30)
>
> **Phase key:** 🔴 Critical — fix immediately | 🟡 Important — fix before launch | 🟢 Polish

---

## PHASE B — Batch Creation & Assignment
> Do this FIRST so batches appear in the enrollment dropdown.

- [ ] **B1** 🔴 — AO creates **1:1** batch — Name: "QA 1:1 Math", Grade=Class 10, Board=CBSE, Subject=Math → `max_students=1`
- [ ] **B2** 🔴 — AO creates **1:3** batch — Name: "QA 1:3 Math", Grade=10, Board=CBSE, Subject=Math → `max_students=3`
- [ ] **B3** 🔴 — AO creates **1:15** batch — Name: "QA 1:15 Science", Grade=10, Board=CBSE, Subject=Science → `max_students=15`
- [ ] **B4** 🔴 — AO creates **1:30** batch — Name: "QA 1:30 English", Grade=10, Board=CBSE, Subject=English → `max_students=30`
- [ ] **B5** 🔴 — AO creates **Lecture** batch — Name: "QA Lecture Physics", Grade=11, Board=CBSE, Subject=Physics → `max_students=50+`
- [ ] **B6** 🔴 — AO assigns BC (`Academiccoordinator1SUO@gmail.com`) to all 5 batches → BC dashboard shows all 5
- [ ] **B7** 🔴 — AO assigns teachers as primary to each batch: Math→`salihr@stibeedu.in`, Physics→`salehl@stibeedu.in`, Chemistry→`bilal@stibeedu.in`, Biology→`shafivk@stibeedu.in`
- [ ] **B8** 🔴 — BC login (`Academiccoordinator1SUO@gmail.com`) → Batches → **only the 5 QA batches visible**
- [ ] **B9** 🔴 — BC tries Batches → New → **no "New Batch" button available**
- [ ] **B10** 🔴 — AO views Batches → **ALL platform batches visible** (not filtered)

---

## PHASE A — Student Enrollment (Manual, by AO)
> AO uses the 3-step Manual Enroll modal: Step 1=Student Info · Step 2=Parent & Batch · Step 3=Payment.

### Form validation
- [ ] **A1** 🔴 — AO login on Desktop Chrome → Dashboard loads, all tabs visible
- [ ] **A2** 🔴 — Students tab → Manual Enroll → 3-step modal opens with Step 1 "Student Info"
- [ ] **A3** 🔴 — Fill Step 1: Name, Email, Phone, Grade=Class 10, Board=CBSE, Region=India, Category=A, DOB, Password → all fields accept input
- [ ] **A4** 🔴 — Submit Step 1 with empty name → Error: "Student name is required"
- [ ] **A5** 🔴 — Enter "notanemail" in email field → Error: "Invalid email address"
- [ ] **A6** 🔴 — Step 2: fill parent info (optional) → leaving parent fields blank is allowed
- [ ] **A7** 🔴 — Batch dropdown on Step 2 → all 5 QA batches listed with name, grade, board, student count/max
- [ ] **A8** 🔴 — Select 1:1 batch → batch info card shows: Type=1:1, Students=0/1
- [ ] **A9** 🔴 — Click Next without selecting batch → Error: "Please select a batch"
- [ ] **A10** 🔴 — Step 3: "No payment now" → Submit → enrollment succeeds, no invoice generated
- [ ] **A11** 🔴 — Step 3: "Full payment", Cash, ₹5000 → Submit → enrollment succeeds, invoice + receipt generated
- [ ] **A12** 🔴 — Step 3: Advance, UPI, ₹2000, transaction ref → advance payment recorded, partial credit
- [ ] **A13** 🔴 — Success screen: student email, batch name, invoice number, receipt number, amount paid all shown
- [ ] **A14** 🔴 — "Enroll Another" → modal resets to Step 1

### Bulk enrollment (30 students)
- [ ] **A15** 🔴 — Enroll **S1** into 1:1 QA batch (no payment) → welcome email sent
- [ ] **A16** 🔴 — Enroll **S2, S3, S4** into 1:3 QA batch
- [ ] **A17** 🔴 — Enroll **S5–S19** (15 students) into 1:15 QA batch → batch fills up
- [ ] **A18** 🔴 — Enroll **S20–S29** (10 students) into 1:30 QA batch
- [ ] **A19** 🔴 — Enroll **S30** into Lecture QA batch
- [ ] **A20** 🔴 — AO → Students tab → all 30 students visible with correct batch assignments
- [ ] **A21** 🔴 — Try to enroll S1's email again → Error: "Email already registered"
- [ ] **A22** 🔴 — Try to enroll 2nd student into 1:1 batch → Error: batch is full
- [ ] **A23** 🔴 — Check S1's inbox → welcome email with login credentials and dashboard link received
- [ ] **A24** 🟡 — Check parent email (if provided) → parent gets login credentials
- [ ] **A25** 🔴 — S1 logs in with credentials from welcome email → dashboard loads, sees batch + upcoming sessions

---

## PHASE C — Session Scheduling
> AO schedules one session per batch, all at the same time (T+30 min from now).

- [ ] **C1** 🔴 — AO schedules session for **1:1 batch** — Date=today, Time=T+30min, Duration=60min, Teacher=`salihr@stibeedu.in` → status=scheduled
- [ ] **C2** 🔴 — AO schedules session for **1:3 batch** — same params → created
- [ ] **C3** 🔴 — AO schedules session for **1:15 batch** → created
- [ ] **C4** 🔴 — AO schedules session for **1:30 batch** → created
- [ ] **C5** 🔴 — AO schedules session for **Lecture batch** → created
- [ ] **C6** 🔴 — All enrolled students receive session join link via email (+ WA if configured)
- [ ] **C7** 🔴 — Wait for T+15 min → WhatsApp + email reminder auto-sent to all students and parents
- [ ] **C8** 🔴 — AO changes teacher on 1:3 session (swap `salihr` → `salehl`) → teacher updated, new teacher notified, old teacher loses session
- [ ] **C9** 🟡 — AO reschedules 1:1 session time by +5 min → students re-notified with new time
- [ ] **C10** 🟡 — Create session without assigning teacher → Warning: "teacher not assigned" shown

---

## PHASE D — Live Class (All 5 Batches Simultaneously)
> Teacher, students, BC, and AO all join at the same time. Run through every control.

### Go-live flow
- [ ] **D1** 🔴 — BC (`Academiccoordinator1SUO@gmail.com`) logs in, go-live approval panel ready → request appears when teacher tries to start
- [ ] **D2** 🔴 — Teacher enters room (1:3 batch) → video tile shows; waiting for BC approval
- [ ] **D3** 🔴 — BC clicks Approve → room status = live; students can now join

### All batch types join
- [ ] **D4** 🔴 — S2, S3, S4 join 1:3 batch → all 3 tiles appear, attendance recording starts
- [ ] **D5** 🔴 — S5–S19 join 1:15 batch → all 15 tiles render, no layout crash
- [ ] **D6** 🔴 — S20–S29 join 1:30 batch → all 10 tiles render, grid adapts
- [ ] **D7** 🔴 — S1 joins 1:1 batch → 1:1 room with teacher only
- [ ] **D8** 🔴 — S30 joins Lecture batch → mic/cam controls **disabled** for student

### Teacher controls — audio/video
- [ ] **D9** 🔴 — Teacher toggles mic on/off → audio cuts for all students, icon updates
- [ ] **D10** 🔴 — Teacher toggles camera on/off → video freezes/resumes for all students
- [ ] **D11** 🔴 — Teacher starts screen share (Chrome) → students see teacher's screen
- [ ] **D12** 🔴 — Teacher stops screen share → returns to camera view, no black screen

### Student controls
- [ ] **D13** 🔴 — S2 toggles mic in 1:3 batch → teacher and other students hear the change
- [ ] **D14** 🔴 — S3 toggles camera in 1:3 batch → shown/hidden correctly
- [ ] **D15** 🔴 — S30 tries to unmute in lecture batch → mic button disabled, cannot publish audio

### Raise hand & chat
- [ ] **D16** 🔴 — Student clicks Raise Hand → teacher sees hand indicator on tile
- [ ] **D17** 🔴 — Teacher clicks lower hand on student → indicator clears
- [ ] **D18** 🔴 — Student sends chat message → appears for teacher and all students
- [ ] **D19** 🔴 — Teacher sends chat message → all students receive it

### Whiteboard & annotation
- [ ] **D20** 🔴 — Teacher opens whiteboard / annotation → drawing visible to all students in real time

### Teacher moderation controls
- [ ] **D20a** 🔴 — Teacher right-clicks S3 → Mute → S3 audio cuts; mute icon updates on tile; sound effect plays
- [ ] **D20b** 🟡 — Teacher right-clicks S3 → Unmute → S3 mic reactivates; icon updates
- [ ] **D20c** 🔴 — Teacher removes S4 from room → S4 disconnected; sees "You have been removed"
- [ ] **D20d** 🔴 — S4 opens join link again → "Removed from session" — access denied, no crash
- [ ] **D20e** 🟡 — Teacher → Announcement → type "Check page 42" → Send → banner overlays all student views; auto-dismisses
- [ ] **D20f** 🟡 — Teacher clicks S2 tile → Spotlight → S2 tile enlarges to main stage; others move to strip

### Doubts panel
- [ ] **D20g** 🟡 — S5 → Doubts panel → type question → Submit → question appears in teacher's doubts sidebar
- [ ] **D20h** 🟡 — Teacher → Doubts → S5's question → type reply → Send → S5 sees reply in their panel

### Violation detection
- [ ] **D20i** 🟡 — S6 switches browser tab during session → teacher sees tab-switch alert with S6's name + sound cue
- [ ] **D20j** 🟡 — S7 types "+91 9876543210" in chat → blocked/flagged; teacher notified; warning shown to S7
- [ ] **D20k** 🟡 — S8 types "@username" in chat → blocked/flagged; teacher notified

### Recording
- [ ] **D20l** 🟡 — Teacher starts recording (`allowRecording=true`) → REC badge appears; recording begins
- [ ] **D20m** 🟡 — Teacher stops recording → REC badge gone; recording URL saved and accessible later

### Virtual background
- [ ] **D20n** 🟢 — Teacher → Background → Blur → background blurred; students see blurred background
- [ ] **D20o** 🟢 — Teacher → Background → Select image → custom image shown behind teacher
- [ ] **D20p** 🟢 — Teacher → Background → Off → normal camera feed restored

### Media request (lecture mode)
- [ ] **D20q** 🟡 — S30 (lecture) → Request Mic → teacher hears sfxMediaRequest; notification in panel
- [ ] **D20r** 🟡 — Teacher approves S30 media request → S30 can speak; all other lecture students stay muted
- [ ] **D20s** 🟡 — Teacher denies S30 → stays muted; denial notification shown to S30

### Teacher tablet
- [ ] **D20t** 🟡 — 2nd device logs in as `teacher_screen` role → joins session → tablet appears as secondary screen-share source; students see it

### Observer roles
- [ ] **D21** 🔴 — AO (`chinjurp333@gmail.com`) ghost joins 1:15 session → invisible in participant list; can see all tiles and hear audio
- [ ] **D22** 🔴 — BC opens CoordinatorLiveView for 1:15 batch → all student tiles + attention states shown
- [ ] **D23** 🔴 — Participant count badge → shows correct number present (ghost not counted)

### Session exam & homework
- [ ] **D24** 🔴 — Teacher → Exam tab → Create MCQ → Push to students → all students get exam overlay
- [ ] **D25** 🔴 — All students answer MCQs → submit → auto-graded; all submissions recorded
- [ ] **D26** 🟡 — Teacher → Homework tab → New → title + description → assign → visible in student homework list

### End session & post-class
- [ ] **D27** 🔴 — Teacher ends class (1:3 batch) → all participants disconnected; status = ended
- [ ] **D28** 🔴 — AO/BC checks attendance report → join time, leave time, duration correct for all students
- [ ] **D29** 🔴 — After session ends → each student + parent gets exam result email
- [ ] **D30** 🟡 — Feedback/rating dialog auto-appears for student immediately after end

### Session control toggles
- [ ] **D31** 🔴 — AO sets `go_live_skip_coordinator = true` → teacher goes live immediately without BC approval dialog
- [ ] **D32** 🟡 — AO sets `allow_go_live_before_schedule = true` → teacher goes live 10 min early → no error
- [ ] **D33** 🟡 — Teacher continues class past 60-min mark → overtime timer shows; no auto-disconnect
- [ ] **D34** 🟡 — Teacher → End Early → BC approval dialog → BC approves → class ends; attendance closed at actual time
- [ ] **D35** 🟡 — Teacher → End Early → BC denies → class continues; teacher sees "denied" notification

---

## PHASE E — Additional Scenarios (Mid/Post Session)

### Batch & student management
- [ ] **E1** 🔴 — AO adds S20 (already in 1:30) to 1:3 batch mid-series → backfilled tokens for upcoming sessions
- [ ] **E2** 🔴 — S20 uses backfilled join link → enters room successfully for next session
- [ ] **E3** 🟡 — AO tries to change teacher while session is live → not allowed mid-session OR updates for next session
- [ ] **E4** 🟡 — AO removes S4 from batch → S4 removed; future join tokens invalidated
- [ ] **E5** 🟡 — S4 tries old join link after removal → "Access denied" or "Session not found" — no crash

### Role boundary checks
- [ ] **E6** 🔴 — BC tries to navigate to fees/invoices → not in nav; direct URL access → denied
- [ ] **E7** 🔴 — BC tries to reassign coordinator of their own batch → no option available
- [ ] **E8** 🟡 — Student uses another student's join link → access denied (not the assigned student)

### Batch lifecycle
- [ ] **E9** 🟡 — AO deactivates a batch → greyed out; cannot schedule new sessions
- [ ] **E10** 🟡 — AO reactivates batch → schedulable again

### Multi-teacher per batch
- [ ] **E11** 🟡 — AO adds `salehl@stibeedu.in` (Saleh L) to 1:15 batch for Physics alongside `salihr` → both listed; either can be assigned per session
- [ ] **E12** 🔴 — AO changes teacher of scheduled session: `salihr` → `salehl` → updated; Saleh L notified; Salih R loses session
- [ ] **E13** 🔴 — Saleh L (`salehl@stibeedu.in`) logs in → new session appears in My Sessions
- [ ] **E14** 🔴 — Salih R (`salihr@stibeedu.in`) logs in → session no longer in My Sessions

### Cross-device joins
- [ ] **E15** 🔴 — Student opens join link on **Android Chrome** → room loads, mic and camera work
- [ ] **E16** 🔴 — Student opens join link on **iOS Safari** → room loads, permissions prompt shown
- [ ] **E17** 🔴 — Student opens join link on **Desktop Firefox** → room loads, all controls work
- [ ] **E18** 🟡 — Student opens join link on **Desktop Edge** → room loads

### Pre-join lobby edge cases
- [ ] **E19** 🔴 — Browser popup → deny mic → enter room → "Mic denied" warning shown; can still enter
- [ ] **E20** 🔴 — Device has no camera → "No camera found" shown; can still enter

### Link edge cases
- [ ] **E21** 🔴 — Open join link after session has ended → "Session has ended" — no crash
- [ ] **E22** 🔴 — Open `/join/abc123` (random invalid link) → "Link not found" page

### Visibility checks
- [ ] **E23** 🔴 — BC views Batches list → **only their assigned batches** shown
- [ ] **E24** 🔴 — AO views Sessions → **all 5 QA sessions** visible in one list
- [ ] **E25** 🔴 — `GET /api/v1/health` → returns 200 with server status

---

## Summary Counters

| Phase | Total | 🔴 Critical | 🟡 Important | 🟢 Polish |
|---|---|---|---|---|
| B — Batch Creation | 10 | 10 | 0 | 0 |
| A — Enrollment | 25 | 22 | 3 | 0 |
| C — Scheduling | 10 | 8 | 2 | 0 |
| D — Live Class | 35 | 17 | 15 | 3 |
| E — Edge Cases | 25 | 14 | 10 | 1 |
| **Total** | **105** | **71** | **30** | **4** |

---

## Bug Log — Day 1

| Bug ID | Test | Description | Severity | Status |
|---|---|---|---|---|
| BUG-0429-001 | | | 🔴 | Open |

---

> **Format:** `BUG-MMDD-###` · **Severity:** 🔴 Critical / 🟡 Important / 🟢 Polish
