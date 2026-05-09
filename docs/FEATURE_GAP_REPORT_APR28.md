# stibe Portal — Feature Gap Report
**Date:** 28 April 2026
**Purpose:** Features found in codebase that are NOT yet covered in the testing plan or permissions doc.

---

## 🔴 CRITICAL GAPS — Must Add to Testing Plan

### 1. Pre-Join Lobby (Device Check)
**Component:** `PreJoinLobby.tsx`
**What it does:** Before a student/teacher enters the live room they see a device check screen — test mic, test camera, check network.
**Gap:** Never tested. A student with a broken mic is blocked here before even entering.
**Test needed:** Mic denied by browser → what happens? Camera not found → error or fallback?

---

### 2. Go-Live Approval Workflow (BC Heartbeat)
**Routes:** `room/[id]/go-live`, `batch-coordinator/go-live-requests`, `batch-coordinator/heartbeat`
**Migration:** 036, 037
**What it does:** Teacher cannot go live unless a BC has an active heartbeat (is present/online). Teacher sends go-live request → BC approves/denies.
**Gap:** The testing plan mentions "go live" but does not test the approval gating. If BC is offline when teacher tries to go live, does it block or allow?
**Test needed:** BC offline → teacher tries go live → blocked? BC online → approves → class starts.

---

### 3. Open Classroom (Public Learning)
**Routes:** `/api/v1/open-classroom/*`, `/open-classroom/[token]`
**Pages:** `/dashboard` → Open Classroom tab
**What it does:** AO/teacher creates a public classroom with a shareable token. Anyone can join without login. Has a materials library, join approval option, subject/grade filter.
**Gap:** Completely absent from testing plan. Entirely separate feature from batch sessions.
**Test needed:** Create OC → share link → student joins without login → materials visible → join approval flow.

---

### 4. Conference System (Separate from Rooms)
**Routes:** `/api/v1/conference/*`, `/conference/[token]`
**Component:** `ConferenceWrapper`, `ConferenceHostView`, `ConferenceUserView`
**What it does:** Separate video meeting space, different from batch sessions. Can be scheduled and shared.
**Gap:** Not in testing plan at all.
**Test needed:** Create conference → share link → participant joins → host controls → end.

---

### 5. Session Refund Requests
**Routes:** `/api/v1/student/refund-requests`, `/api/v1/student/refund-upload`, `/api/v1/academic-operator/refund-requests`
**Migration:** 054, 055
**What it does:** Student requests refund for unused credits → uploads bank details → AO approves/rejects.
**Gap:** Not tested. Refund is a core financial flow.
**Test needed:** Student with credits → raises refund request → uploads bank details → AO reviews → approves/rejects.

---

### 6. Session Extension Requests
**Routes:** `/api/v1/session-extension`, `/api/v1/room/[id]/selective-end`
**Migration:** 012, 039
**What it does:** Student requests more session time. Teacher can extend for ALL students or SELECTIVELY for specific students only.
**Gap:** Not tested. Selective extension (extend for student A but end for B) is a unique feature.
**Test needed:** Teacher ends class → student requests extension → teacher approves for specific students only.

---

### 7. Academic Calendar (Curriculum Planning)
**Routes:** `/api/v1/academic-calendars/*`
**Migration:** 070
**What it does:** AO/teacher maps curriculum topics to sessions. System suggests "next topics" based on what was taught. Sessions can be scheduled directly from calendar topics.
**Gap:** Completely absent from testing plan.
**Test needed:** Create academic calendar → map topics to batch → schedule sessions from topic → next-topic suggestion after session.

---

### 8. Teacher Controls Toggles (Per Batch / Academic Settings)
**Routes:** `/api/v1/teacher-controls`
**Migration:** 074
**Toggles:**
  - `go_live_skip_coordinator` — skip BC approval
  - `allow_go_live_before_schedule` — start class early
  - `allow_session_extend` — let session extend
  - `allow_homework_create` — teacher can assign homework
  - `allow_exam_push` — teacher can push exam to students
  - `allow_recording` — enable recording
**Gap:** These switches control what teachers can do. If `allow_exam_push = false`, teacher's exam button should disappear. Not tested.
**Test needed:** Disable each toggle → verify that feature is hidden/blocked for teacher. Re-enable → verify it returns.

---

### 9. Monitoring Tuning Parameters
**Routes:** `/api/v1/monitoring-tuning`
**Migration:** 083, 084
**Modes:**
  - `writing_aware_mode` — student writing notes, don't flag as "looking away"
  - `mobile_relaxed_thresholds` — relax sensitivity on phones
  - `exam_strict_mode` — strict attention during exams
  - `low_visibility_fallback` — handle poor lighting
  - Attention states: `thinking`, `reading_material`, `writing_notes`, `brief_absence`, `low_visibility`, `in_exam`
**Gap:** Policy was set (monthly reports only, liberal thresholds) but the tuning controls themselves are not tested.
**Test needed:** Enable exam_strict_mode → run exam → verify stricter alerts. Enable writing_aware_mode → student writes → verify NOT flagged.

---

### 10. Skip Payment Gate (Per Student Override)
**Migration:** 085 — `skip_payment_gate` flag on batch_students
**What it does:** AO can mark a specific student to bypass the credit check gate — they join regardless of credit balance. Different from scholarship/exempt status.
**Gap:** Testing plan only tests scholarship/exempt. This per-student flag is separate.
**Test needed:** Set skip_payment_gate for student → credits = 0 → student joins anyway.

---

### 11. Multiple Teachers Per Subject Per Batch
**Migration:** 087
**What it does:** A batch can have multiple teachers for the same subject. BC assigns which teacher takes which session.
**Gap:** Testing plan assumes one teacher per batch. Multi-teacher needs testing.
**Test needed:** 1:15 batch, subject=Math, teachers: Teacher A and Teacher B → BC schedules session 1 with A, session 2 with B → both see only their sessions.

---

### 12. Homework System (Full Flow)
**Routes:** `/api/v1/room/[id]/homework`, `/api/v1/student/homework`, `/api/v1/homework/upload`
**Component:** `HomeworkPanel.tsx`
**Migration:** 035, 071 (attachments)
**What it does:** Teacher creates homework during class. Students submit with file attachments. Teacher reviews submissions.
**Gap:** Only mentioned in passing in testing plan, never fully tested.
**Test needed:** Teacher creates homework → students submit with file attachment → teacher views all submissions.

---

### 13. Doubts System
**Routes:** `/api/v1/room/[id]/doubts`
**Component:** `DoubtPanel.tsx`
**What it does:** Students post questions/doubts during class. Teacher responds. Tracked per session.
**Gap:** Not in testing plan at all.
**Test needed:** Student posts doubt → teacher responds → doubt marked resolved.

---

### 14. Post-Session Feedback
**Component:** `FeedbackDialog.tsx`
**Routes:** `/api/v1/room/[id]/feedback`
**What it does:** After class ends, students/parents can rate the session.
**Gap:** Not tested. The dialog should appear automatically after session ends.
**Test needed:** Session ends → feedback dialog appears → student rates → rating saved.

---

### 15. Report Teacher (Misconduct)
**Component:** `ReportTeacherDialog.tsx`
**Routes:** `/api/v1/room/[id]/report-teacher`
**What it does:** Student can report teacher misconduct from inside the live room.
**Gap:** Not tested.
**Test needed:** Student → report teacher button → fill form → submit → AO/admin notified.

---

### 16. Enrollment Links (Self-Signup, Separate from Demo Links)
**Routes:** `/api/v1/enrollment-links`, `/enroll/[linkId]`
**Component:** `EnrollmentLinkModal.tsx`
**What it does:** AO creates a link and sends to a prospective student. Student opens link, fills their own details, pays enrollment fee, creates their account. Different from demo links (no class joining).
**Gap:** Testing plan confuses this with demo links. These are separate flows.
**Test needed:** AO creates enrollment link → student opens → fills details → pays → account created → assigned to batch.

---

### 17. Public Payment Page
**Route:** `/pay/[id]`
**Lib:** `lib/pay-token.ts` (HMAC-signed token)
**What it does:** Student can pay an invoice without being logged in — payment link sent via WhatsApp/email.
**Gap:** Testing plan tests Razorpay only from inside the student portal. The public /pay/[id] flow is untested.
**Test needed:** AO sends payment link → student opens /pay/[id] without login → pays → credits added.

---

### 18. Teacher Salary Tracking
**Routes:** `/api/v1/teacher/salary-live`, `/api/v1/payroll/*`
**What it does:** Teachers see live salary earned per session. HR manages payroll, generates payslips, exports.
**Gap:** HR role barely tested. Payroll not in testing plan.
**Test needed:** Teacher takes class → salary-live updates → HR generates payslip → payslip PDF correct.

---

### 19. Teacher Leave Requests
**Routes:** `/api/v1/teacher-leave`, `/api/v1/teacher-leave/upload`
**What it does:** Teacher requests leave → BC or HR approves → affected sessions flagged → substitute assigned. Medical cert can be uploaded.
**Gap:** Not in testing plan.
**Test needed:** Teacher applies leave → HR approves → sessions for that date flagged → BC assigns substitute.

---

### 20. Teacher App APK Releases
**Routes:** `/api/v1/teacher-app/releases`
**Component:** `TeacherAppUpdatesPanel.tsx`
**Migration:** 086
**What it does:** Owner/AO uploads new APK → sets version code, force-update flag → teachers prompted to update.
**Gap:** Not tested.
**Test needed:** Upload new APK → mark as force update → teacher app sees update prompt.

---

### 21. Sales Portal & Facebook Lead Sync
**Routes:** `/api/v1/sales/*`, `/api/v1/sales/fb-sync`
**Pages:** `/sales` dashboard
**What it does:** Sales team manages leads, activities, follow-ups. Facebook leads auto-synced via fb-sync.
**Gap:** Sales role not tested at all in testing plan.
**Test needed:** Sales login → view leads → add activity → mark follow-up → demo link sent to lead.

---

### 22. HR Portal Features
**Routes:** `/api/v1/hr/*`
**Pages:** `/hr` dashboard
**What it does:** HR manages all users, attendance tracking, payroll processing, performance reviews.
**Gap:** HR role not tested.
**Test needed:** HR login → view all users → reset a teacher password → process payroll → generate payslip.

---

### 23. Owner Portal Features
**Pages:** `/owner/*` (admins, teachers, batches, exams, fees, payroll, reports, roles, system, hr, academic-operator)
**What it does:** Full platform admin — manage everything. Override permissions, manage AOs, configure system.
**Gap:** Owner role not tested in testing plan.
**Test needed:** Owner login → set custom permissions for a BC → verify custom permissions apply → manage AO users.

---

### 24. Ghost Audit Log
**Migration:** 030
**What it does:** Every ghost observation session is logged — who observed, which room, how long.
**Gap:** Not tested. Ghost mode is tested but audit trail is not verified.
**Test needed:** Ghost enters room → ghost leaves → audit log entry created with duration.

---

### 25. Buji AI Chatbot
**Component:** `BujiChatbot.tsx` on login page
**Routes:** `/api/v1/chatbot`, `/api/v1/chatbot-context`
**What it does:** AI assistant on the login page helps with queries. Has memory context.
**Gap:** Not tested at all.
**Test needed:** Open login page → chat with Buji → verify response makes sense.

---

### 26. Time Warning Dialog
**Component:** `TimeWarningDialog.tsx`
**What it does:** When session approaches its scheduled end time, a warning dialog appears for teacher.
**Gap:** Not tested.
**Test needed:** Schedule 30-min session → at 25 min → warning dialog appears → teacher can extend or end.

---

### 27. Student Session History & Profile
**Routes:** `/api/v1/student/sessions`, `/api/v1/student/profile`
**What it does:** Student can view full session history, attendance, fees, credits, homework, exam results all in one place.
**Gap:** Student dashboard tested only for joining. Profile and history pages not tested.
**Test needed:** Student login → view past sessions → attendance history → fee statement → credit balance.

---

### 28. Parent Portal — Full Flow
**Routes:** `/api/v1/parent/*`
**Pages:** `/parent` dashboard
**What it does:** Parent views child's sessions, attendance, exam results, fees. Files complaints. Gets monthly monitoring reports.
**Gap:** Parent tested only as ghost observer. Parent dashboard features not tested.
**Test needed:** Parent login → view child's attendance → view fee balance → file a complaint about a session.

---

### 29. Contact Violation Detection — Full Test
**Route:** `/api/v1/room/contact-violation`
**Lib:** `lib/contact-detection.ts`
**What it does:** Detects phone numbers, WhatsApp links, Telegram/Instagram handles in chat. Triggers alert.
**Gap:** Mentioned in testing plan (Day 9) but not comprehensively tested across all violation types.
**Additional tests needed:** Telegram handle, Instagram handle, WhatsApp number with country code, short phone numbers.

---

### 30. CRM External API (Integration Points)
**Routes:** `/api/v1/external/*`
  - `create-demo-link` — CRM creates demo link
  - `create-enrollment-link` — CRM creates enrollment link
  - `schedule-demo` — CRM schedules demo
  - `available-teachers` — CRM queries available teachers
**What it does:** The CRM (`stibe-crm-stibe-online`) calls these external APIs to create demo/enrollment links and schedule demos without human intervention.
**Gap:** These integration points not tested. If CRM sends a bad request, what error does it return?
**Test needed:** Call each external endpoint with valid and invalid data — verify correct responses and that bad data is rejected.

---

## 🟡 PERMISSIONS GAPS

### Academic Operator is missing:
- `cancellations_manage: true` — AO should handle refund/cancellation approvals (currently false/unset)

### Batch Coordinator is missing explicit deny for:
- `fees_view: false` (explicitly set — ✓ already done)
- `batches_create: false` (already set — ✓)

### Sales role is incomplete:
Currently only `reports_view: true, users_view: false`. Should also have:
- Access to demo sending (`notifications_send: true` — to send demo links)

### No `enrollment_links_create` permission:
The enrollment link creation feature (AO creates self-signup links) has no dedicated permission. Any AO can create them, but there's no way to grant/revoke this per-user.

---

## 🟢 MINOR GAPS

| # | Feature | Gap |
|---|---|---|
| 1 | Session `lobby` state | Student joins but teacher hasn't gone live — lobby behavior not tested |
| 2 | `room/[id]/coordinator-status` | BC presence shown to teacher — not verified |
| 3 | `student-availability` API | Student online status for scheduling — not tested |
| 4 | Enrollment fee categories (region + board + grade matrix) | GCC vs Kerala vs other regions not fully covered |
| 5 | Multiple AOs creating students (data isolation) | Migration 082: AO A cannot see AO B's students |
| 6 | Payslip PDF generation | End-to-end payslip generation and email not tested |
| 7 | `egress-layout` page | Recording overlay layout — visual test needed |
| 8 | `dev/token` and `dev/livekit-test` | Should be disabled in production |
| 9 | Health check endpoint | `/api/v1/health` should return 200 with server status |
| 10 | WhatsApp webhook callback | Inbound WhatsApp messages handled correctly |

---

## SUMMARY

| Priority | Count | Items |
|---|---|---|
| 🔴 Critical gaps (must add to test plan) | 30 | See above |
| 🟡 Permission gaps | 4 | AO cancellations, sales notifications, enrollment_links perm |
| 🟢 Minor gaps | 10 | Lobby, AO isolation, payslip, dev routes, health check |

**Total uncovered features: 44**

---

*Gap report generated: 28 April 2026*
*Based on: Full codebase audit of /Users/pydart/Projects/stibe/stibe-portal*
