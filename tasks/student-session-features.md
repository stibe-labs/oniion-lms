# Student Live Session — Missing Features Implementation Plan

## Overview
Based on analysis of both PDF documents ("Full Scope of ERP" and "Operations of Online ERP")
vs the current StudentView UI, 9 features are missing. Implementation order is by priority + dependency.

---

## Feature 1: Early Exit → Parent & Coordinator Alert ✦ HIGH PRIORITY
**PDF Ref:** "If Student leaves early: Alert to Parent, Alert to Batch Coordinator"

### What
When a student disconnects from a live session before scheduled end time (and without approved leave),
automatically notify the parent (email+WhatsApp) and batch coordinator.

### Where
- `app/api/v1/webhook/livekit/route.ts` — add logic in `participant_left` handler
- No new DB tables needed — uses existing `monitoring_alerts` + `email_log`

### Implementation
1. In webhook `participant_left` for students:
   - Check if room is still live (not ended)
   - Check if student has approved leave (attendance_sessions.leave_approved)  
   - If NOT approved and room still live → it's an early/unapproved exit
   - Look up parent email from `user_profiles.parent_email`
   - Look up coordinator from `rooms.coordinator_email`
   - Send email+WhatsApp to parent: "Your child left class early"
   - Send email to coordinator: "Student left without permission"
   - Insert `monitoring_alerts` with type 'unusual_leave'

---

## Feature 2: Doubt Raising System ✦ HIGH PRIORITY
**PDF Ref:** "Raise doubt option · Subject-wise doubt submission · Doubt resolution tracking"

### What
Students can raise structured doubts during live session. Teacher sees them in a "Doubts" panel.
Doubts are tracked with status (open/answered/deferred).

### DB
- New table `session_doubts` (migration 027)

### Components
- `components/classroom/DoubtPanel.tsx` — student raises doubts, teacher answers
- Add "Doubts" tab to `StudentSidePanel.tsx`
- Add data channel topic `'doubt'` for real-time doubt notifications
- API: `POST/GET /api/v1/room/[room_id]/doubts`

---

## Feature 3: In-Session Announcements ✦ MEDIUM PRIORITY
**PDF Ref:** "Academic announcements · Exam notifications · Emergency alerts"

### What
Coordinator/AO/Owner can push announcements to live sessions.
Students see them as a banner or notification overlay.

### Implementation
- New data channel topic `'announcement'` — teacher/coordinator broadcasts
- StudentView shows announcement banner overlay
- API: `POST /api/v1/room/[room_id]/announcement` — coordinator can push
- No new DB table — announcements are ephemeral in live session

---

## Feature 4: Teaching Material Access in Session ✦ MEDIUM PRIORITY
**PDF Ref:** "Teaching Material Upload · Academic Instructions Panel"

### What
Students can view batch-assigned teaching materials during live session.
Teaching materials table + API already exist.

### Implementation  
- Add "Materials" tab to `StudentSidePanel.tsx`
- Fetch from existing `/api/v1/teaching-materials?batch_id=X`
- Show list with download links
- No new DB tables needed

---

## Feature 5: Homework Panel in Session ✦ MEDIUM PRIORITY
**PDF Ref:** "Homework upload by teacher · Submission upload by student · Deadline tracking"

### What
Teacher can assign homework during session. Students see assigned homework.

### DB
- New table `homework_assignments` (in migration 027)

### Components
- Teacher: homework assignment form in TeacherView
- Student: homework list in StudentSidePanel "Homework" tab
- API: `POST/GET /api/v1/room/[room_id]/homework`

---

## Feature 6: Exam Alert/Notification ✦ LOW PRIORITY
**PDF Ref:** "Exam notifications · Upcoming Exams alert"

### What
When student is in a live session, show upcoming exams for their batch.

### Implementation
- Add "Exams" section to StudentSidePanel or use announcement system
- Fetch from existing exams table: `GET /api/v1/exams?batch_id=X&upcoming=true`
- Show as a subtle info banner

---

## Feature 7: Class Recording Access ✦ MEDIUM PRIORITY
**PDF Ref:** "Access to recorded sessions · Replay option · Limited access period"

### What
Students can access previous class recordings from their dashboard (not live session UI).

### Implementation
- This is a dashboard feature, not a live session feature
- Student dashboard: "Recordings" section
- Query rooms with recording_url for student's batches
- Access control: only own batch, configurable expiry

---

## Feature 8: Student-to-Student DM Prevention ✦ LOW PRIORITY (mostly done)
**PDF Ref:** "Private chat disabled between students"

### What
Already handled — single shared chat channel, no private messaging.
Just need to verify no workaround exists.

### Implementation
- Audit ChatPanel — confirmed single topic 'chat' shared by all
- No DM functionality exists → requirement satisfied
- ✅ ALREADY COMPLETE

---

## Feature 9: AI Session Report (Post-Class) ✦ MEDIUM PRIORITY
**PDF Ref:** "AI-generated class reports after every session"

### What
After each class ends, auto-generate a comprehensive session report.

### Implementation
- `autoGenerateSessionReport()` already exists in lib/reports.ts
- Already called in webhook room_finished handler
- Need to verify report content covers: topics covered, attendance summary,
  engagement level, teacher performance, class duration
- May need enhancement of existing report generator

---

## Implementation Order
1. ☐ Migration 027 (doubts + homework tables)
2. ☐ Feature 1: Early Exit Alert (webhook modification)
3. ☐ Feature 2: Doubt Raising System (API + components + data channel)
4. ☐ Feature 3: In-Session Announcements (data channel + UI)
5. ☐ Feature 4: Teaching Material Access (new SidePanel tab)
6. ☐ Feature 5: Homework Panel (API + components)
7. ☐ Feature 6: Exam Alert (fetch + display)
8. ☐ Feature 9: AI Session Report Enhancement (verify/enhance)
9. ☐ Build, test, deploy
