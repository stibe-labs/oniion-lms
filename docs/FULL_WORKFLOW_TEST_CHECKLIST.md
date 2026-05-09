# stibe Platform — Full Workflow Test Checklist

> **Purpose**: End-to-end manual QA covering CRM → Enrollment → Portal → Classroom → Demo Guest flow.
> Complete every checkbox in order. Mark ✅ pass / ❌ fail with notes.


---

## Accounts Used

| Role | Email | Notes |
|------|-------|-------|
| Academic Operator | *(AO account)* | |
| Batch Coordinator | *(BC account)* | |
| Teacher | *(teacher account)* | |
| Student *(test)* | *(created during test)* | |
| Ghost | *(ghost account)* | Observer in classroom test |

---

## SECTION A — CRM Lead Creation & Fee Check

### Test 1 — Add a New Lead in CRM
- [ ] Log into CRM as an agent/admin
- [ ] Navigate to **Leads** → click **Add Lead**
- [ ] Fill in: Name, Phone, Email, Grade (e.g. 10), Board (e.g. CBSE), Region (e.g. Kerala)
- [ ] Save lead
- [ ] **Verify**: Lead appears in the Leads table with status `Inquiry` / `New`

---

### Test 2 — Fee Checker in Lead Drawer
- [ ] Click on the lead to open the **Lead Drawer**
- [ ] Navigate to the **Fee Checker** tab (or section)
- [ ] **Verify**: Batch types matching the lead's grade + board are displayed (e.g. 1:1, 1:5, 1:15)
- [ ] **Verify**: Each card shows fee amount, OTP (advance) amount, and a savings badge (if applicable)
- [ ] **Verify**: No "Failed to load" or blank state errors

---

### Test 3 — Send Enrollment Link
- [ ] In the Lead Drawer, click **Send Enrollment Link**
- [ ] Confirm the modal shows the correct student name and phone
- [ ] Click **Send**
- [ ] **Verify**: Success toast appears
- [ ] **Verify**: Lead timeline/notes shows an event like "Enrollment link sent"
- [ ] *(If WhatsApp configured)* **Verify**: WhatsApp message received on test phone with the enrollment link
- [ ] Copy the enrollment link URL for next steps

---

## SECTION B — Student Enrollment (Public Flow)

### Test 4 — Open Enrollment Link
- [ ] Open the enrollment link in a fresh browser (incognito)
- [ ] **Verify**: Welcome screen loads with student's pre-filled name and grade
- [ ] **Verify**: Multi-step form header shows steps (Student → Guardian → Academic → Batch → Payment)

---

### Test 5 — Step 1: Student Details
- [ ] Fill in: Full name, DOB, gender, phone, email
- [ ] Click **Next**
- [ ] **Verify**: Validation fires for empty required fields
- [ ] **Verify**: Proceeds to next step

---

### Test 6 — Step 2: Guardian Details
- [ ] Fill in: Parent/Guardian name, relationship, phone, email
- [ ] Click **Next**
- [ ] **Verify**: Form saves and moves to Academic step

---

### Test 7 — Step 3: Academic Preferences
- [ ] Select Grade, Board (e.g. CBSE), Region (e.g. Kerala)
- [ ] **Verify**: Board options are derived from available fee structure (not hardcoded)
- [ ] **Verify**: Region options filter correctly
- [ ] Click **Next**

---

### Test 8 — Step 4: Batch Type Selection
- [ ] **Verify**: Batch type cards are shown (e.g. 1:1, 1:5, 1:15) derived from fee structure
- [ ] Select **1:15** batch type
- [ ] **Verify**: Fee card shows: total fee, OTP/advance amount, savings badge (if any)
- [ ] **Verify**: A suitable batch is shown (or "no batch yet — preferences saved" message)
- [ ] Select the batch (if available) or proceed without one
- [ ] Click **Next**

---

### Test 9 — Step 5: Payment
- [ ] **Verify**: Payment summary shows correct amount (OTP/advance for per-class, or full fee)
- [ ] Click **Pay Now** → Razorpay checkout opens
- [ ] Use test card: `4111 1111 1111 1111`, CVV `123`, Expiry `12/28`
- [ ] Complete payment
- [ ] **Verify**: Success screen shows with confirmation message
- [ ] **Verify**: Student receives confirmation email/WhatsApp *(check inbox)*

---

## SECTION C — Post-Enrollment Verification

### Test 10 — CRM Lead Stage Updated
- [ ] Return to CRM → find the lead created in Test 1
- [ ] **Verify**: Lead stage has changed to **Enrolled** / **Closed** / **Won**
- [ ] **Verify**: Lead timeline shows "Enrolled via link" or equivalent event

---

### Test 11 — Fee Payment Record in CRM
- [ ] Open the lead drawer → go to **Payments** / **Fees** tab
- [ ] **Verify**: Payment record is visible with: amount, date, payment ID (Razorpay)
- [ ] **Verify**: Status shows **Paid** / **Completed**

---

### Test 12 — Student in AO Dashboard (Students List)
- [ ] Log into portal as **Academic Operator**
- [ ] Go to **Students** tab
- [ ] **Verify**: The newly enrolled student appears in the list
- [ ] Click on student → **Verify**: profile shows correct Grade, Board, preferred batch type (`one_to_fifteen`)
- [ ] **Verify**: Fee record is linked and visible

---

### Test 13 — Student Portal Login
- [ ] Log into portal with the student credentials (email set during enrollment)
- [ ] **Verify**: Student dashboard loads with correct role
- [ ] **Verify**: No server errors or broken tabs
- [ ] **Verify**: Fees tab shows payment history

---

## SECTION D — Batch Creation & Configuration

### Test 14 — AO Creates a Batch
- [ ] Log in as **Academic Operator**
- [ ] Go to **Batches** tab → click **Create Batch**
- [ ] Fill in: Batch name, Batch Type = **1:15**, Grade = 10, Board = CBSE, Subject(s)
- [ ] Add Notes (optional)
- [ ] Click **Create**
- [ ] **Verify**: Batch appears in the batch list with correct type label "1:15"
- [ ] **Verify**: No 500 error (`batches_batch_type_check` constraint — should now allow `one_to_fifteen`)

---

### Test 15 — Add Student to Batch
- [ ] Open the batch created in Test 14
- [ ] Click **Add Student**
- [ ] Search for the enrolled student (from Test 9)
- [ ] **Verify**: Student appears with their preferred batch type badge
- [ ] Add student → **Verify**: Student is listed in batch roster
- [ ] **Verify**: Student's portal dashboard now shows the batch

---

### Test 16 — Assign Teacher to Batch
- [ ] In the batch panel, click **Add Teacher**
- [ ] Select teacher, assign subject (e.g. Physics)
- [ ] Mark as **Primary Teacher**
- [ ] **Verify**: Teacher appears on the batch panel with subject label
- [ ] Log in as Teacher → **Verify**: Batch appears in teacher's **Batches** tab

---

### Test 17 — Assign Batch Coordinator
- [ ] In the batch panel, set Batch Coordinator
- [ ] Save
- [ ] Log in as Batch Coordinator → **Verify**: Batch appears in their dashboard
- [ ] **Verify**: BC can see batch students and teacher

---

## SECTION E — Session Scheduling & Classroom

### Test 18 — AO Schedules a Session
- [ ] Log in as **Academic Operator**
- [ ] Go to **Sessions** tab → **Schedule Session**
- [ ] Select the batch created in Test 14
- [ ] Set date/time (e.g. today + 5 minutes from now for live testing)
- [ ] Set duration (e.g. 60 min), subject
- [ ] Save session
- [ ] **Verify**: Session appears in the batch session list
- [ ] **Verify**: Teacher receives notification/email of upcoming session

---

### Test 19 — Teacher Starts the Session
- [ ] Log in as **Teacher**
- [ ] Go to **Sessions** tab → find the scheduled session
- [ ] Click **Start Session** / **Go Live**
- [ ] **Verify**: Session transitions to `live` status
- [ ] **Verify**: LiveKit room is created (no connection errors)
- [ ] **Verify**: Teacher is inside the classroom UI

---

### Test 20 — BC Approves Go-Live (If Required)
- [ ] Log in as **Batch Coordinator** in another browser/tab
- [ ] **Verify**: Go-live approval request appears in BC dashboard / bell icon
- [ ] Click **Approve**
- [ ] **Verify**: Session shows as fully live after approval
- [ ] **Verify**: AO's "Today's Live" sidebar shows the session as live

---

### Test 21 — Teacher Classroom Controls
> Tester stays inside teacher view after Test 19/20

- [ ] **Camera**: Toggle off and on — tile updates
- [ ] **Mic**: Mute/unmute — mic indicator updates
- [ ] **Screen Share**: Start screen share — students see shared screen
- [ ] **Hand Raise**: A student raises hand → teacher sees the notification
- [ ] **Chat**: Teacher sends a message → appears in chat panel
- [ ] **Mute Student**: Teacher mutes a specific student tile
- [ ] **Kick Student**: Test kick button on a guest/test tile (use ghost account)
- [ ] **Recording**: Start recording — recording indicator appears
- [ ] **Whiteboard**: If using Flutter tablet app, broadcast cutout overlay
- [ ] **Requests Bell**: Open requests dropdown — see pending hand raises / leave requests

---

### Test 22 — Student Joins Classroom
- [ ] Log in as **Student** (enrolled student from Test 9)
- [ ] Go to **Sessions** / **Join Class** button for the live session
- [ ] **Verify**: Student enters classroom (YouTube-style immersive view)
- [ ] **Verify**: Student can see teacher video tile
- [ ] **Verify**: Student can send chat messages
- [ ] **Verify**: Student can raise hand (hand icon → teacher notified)
- [ ] **Verify**: Student **cannot** mute or kick other participants
- [ ] **Verify**: Attention monitoring (AI) is running (no console errors re: MediaPipe)

---

### Test 23 — Batch Coordinator Classroom Controls
- [ ] Log in as **Batch Coordinator**
- [ ] Join session as observer / coordinator view
- [ ] **Verify**: BC sees all participant tiles
- [ ] **Verify**: BC sees critical alert bell (engagement drops)
- [ ] **Verify**: BC can approve/deny teacher requests (hand raise requests if configured)
- [ ] **Verify**: BC's approved/denied decision shows as badge on teacher side (auto-dismiss timer)
- [ ] **Verify**: Overtime badge appears if session runs past scheduled end time
- [ ] **Verify**: BC can click **Observe** link (opens coordinator live view)

---

### Test 24 — Ghost Observer Joins
- [ ] Log in as **Ghost**
- [ ] Navigate to ghost dashboard → find live session → click Observe
- [ ] **Verify**: Ghost enters class silently (no mic/camera prompt)
- [ ] **Verify**: Ghost is NOT visible to teacher or students
- [ ] **Verify**: Ghost can see all video tiles and chat

---

### Test 25 — Teacher Ends Session
- [ ] Teacher clicks **End Class**
- [ ] Confirm end class dialog
- [ ] **Verify**: All participants are disconnected
- [ ] **Verify**: Session status changes to `ended` in the dashboard
- [ ] **Verify**: Attendance is recorded for the student (AO → Attendance tab)
- [ ] **Verify**: Session summary email is sent (check teacher inbox)
- [ ] **Verify**: Recording stops and upload begins (if recording was started in Test 21)

---

## SECTION F — CRM Demo / Guest Link Flow

### Test 26 — Add New Prospect Lead in CRM
- [ ] Log into CRM
- [ ] Add a new lead: Name, Phone, Grade, Board — stage = **Inquiry** / **New**
- [ ] **Verify**: Lead created successfully

---

### Test 27 — Find Live Session & Send Guest Link
- [ ] Ensure a session is live (use teacher account to start another session, or reuse Test 19 session)
- [ ] Open the **new lead** drawer in CRM
- [ ] Click **Send Demo / Guest Link**
- [ ] **Verify**: Session picker modal opens and shows the live session with a green **LIVE** badge
- [ ] Select the live session
- [ ] Click **Send Link** (for live) or **Schedule Link** (for upcoming)
- [ ] **Verify**: Success toast appears
- [ ] **Verify**: WhatsApp message sent to lead's phone with the guest link

---

### Test 28 — Guest Enters Classroom (Live Session)
- [ ] Open the WhatsApp guest link in a fresh browser
- [ ] **Verify**: Guest waiting page loads with student name
- [ ] **Verify**: If session is live → guest joins immediately (or after lobby wait)
- [ ] Inside classroom:
  - [ ] Guest tile has a **purple "Guest" badge** visible to teacher
  - [ ] Guest can see class video
  - [ ] Guest **cannot** unmute mic or enable camera (read-only)
- [ ] Teacher sees guest in participant list

---

### Test 29 — Guest Exits Class
- [ ] Guest clicks **Leave** button
- [ ] **Verify**: Guest exits cleanly (no error)
- [ ] **Verify**: Other participants are unaffected
- [ ] **Verify**: Teacher can see guest left in participant list

---

### Test 30 — CRM Stage Updated After Demo
- [ ] Return to CRM → open the lead from Test 26
- [ ] **Verify**: Lead stage has changed to **Demo Completed** / **Demo Success** / **Trial Done**
- [ ] **Verify**: Lead timeline shows "Guest joined session" / "Demo completed" event
- [ ] **Verify**: Next action suggestion is shown (e.g. "Follow up and convert")

---

### Test 31 — Upcoming Session Guest Link (Scheduled Demo)
- [ ] Create another new lead in CRM
- [ ] Schedule a session 10 minutes into the future (AO dashboard)
- [ ] In lead drawer → Send Guest Link
- [ ] **Verify**: Session picker shows the upcoming session with an amber **Upcoming · in X min** badge
- [ ] Click **Schedule Link**
- [ ] Open the guest link immediately
- [ ] **Verify**: Guest sees "Waiting for class to start" / lobby screen
- [ ] Start the session (teacher side)
- [ ] **Verify**: Guest auto-joins within ~4 seconds (polling picks up `status=live`)

---

### Test 32 — Teacher Can Kick a Guest
- [ ] With a guest inside the classroom (from Test 28 or 31)
- [ ] Teacher clicks the **⋮ / Kick** option on the guest tile
- [ ] **Verify**: Kick API succeeds (no error toast on teacher side)
- [ ] **Verify**: Guest is immediately removed from the room
- [ ] **Verify**: Guest sees a "You have been removed" or redirect screen

## Test Run Summary

| Section | Tests | Pass | Fail | Blocked |
|---------|-------|------|------|---------|
| A — CRM Lead & Fee Check | 1–3 | | | |
| B — Enrollment Flow | 4–9 | | | |
| C — Post-Enrollment | 10–13 | | | |
| D — Batch Setup | 14–17 | | | |
| E — Session & Classroom | 18–25 | | | |
| F — Guest / Demo Flow | 26–32 | | | |
| **Total** | **32** | | | |

---

## Known Issues / Notes

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| | | | |

---

## Sign-off

| Tester | Date | Result |
|--------|------|--------|
| | | Pass / Fail / Partial |
