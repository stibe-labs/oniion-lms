# stibe Platform — Master Workflow Test Guide

> **Version:** May 2026  
> **Purpose:** Complete end-to-end hands-on walkthrough — from CRM lead creation to live classroom with AI monitoring, exams, and real-time communication. Follow every step in order with real clicks.  
> **Time to complete:** ~60–90 minutes for the full run.

---

## 🔑 Test Accounts

| Role | Email | Password | URL |
|------|-------|----------|-----|
| **CRM Agent** | `stibelearningventures@gmail.com` | `stibe@2026` | https://crm.stibelearning.online |
| **Owner** | `stibelearningventures@gmail.com` | `stibe@2026` | https://stibelearning.online/owner |
| **Academic Operator (AO)** | `chinjurp333@gmail.com` | `stibe@2026` | https://stibelearning.online/academic-operator |
| **Batch Coordinator (BC)** | `Academiccoordinator1SUO@gmail.com` | `stibe@2026` | https://stibelearning.online/batch-coordinator |
| **Teacher** | `salihr@stibeedu.in` | `stibe@2026` | https://stibelearning.online/teacher |

> **Tip:** Use separate browser windows or incognito tabs for each role so you can switch quickly during classroom testing.

---

## 📋 Overview — What We're Testing

```
Phase 1  CRM → Create 2 student leads (1:1 + 1:15)
Phase 2  Enrollment links → students self-enroll + pay
Phase 3  AO Portal → verify enrollments, create batches, assign teacher + BC
Phase 4  BC Portal → auto-schedule sessions (date range)
Phase 5  Fee & Payment checks — per-session credits (1:1) vs annual invoice (1:15)
Phase 6  Start class → verify notifications
Phase 7  Live classroom — AI monitoring, click-and-hold PTT, exam generation
Phase 8  Post-class — reports, attendance, results
```

---

# PHASE 1 — CRM: Add Two Student Leads

> **Login:** CRM → `stibelearningventures@gmail.com` / `stibe@2026`
> **URL:** https://crm.stibelearning.online

---

### 1.1 — Add Lead A (1:1 Student)

- [ ] Go to **Leads** in the left sidebar.
- [ ] Click **+ Add Lead** (top-right button).
- [ ] Fill in the form:
   - **Name:** `Arjun Menon`
   - **Phone:** `9876543201`
   - **Email:** `arjun.test2026@gmail.com`
   - **Grade:** `10`
   - **Board:** `CBSE`
   - **Region:** `Kerala`
   - **Batch Type interest:** `1:1 Individual`
- [ ] Click **Save**.

- [ ] ✅ **Checkpoint:** Lead `Arjun Menon` appears in Leads table with status **Inquiry** or **New**.

---

### 1.2 — Check Fee in Lead Drawer

- [ ] Click on **Arjun Menon** to open the Lead Drawer (right panel).
- [ ] Find the **Fee Checker** tab or section inside the drawer.
- [ ] Look at the 1:1 fee card for Grade 10, CBSE, Kerala.

- [ ] ✅ **Checkpoint:** Card shows `₹900/session` (Grade 10, Kerala CBSE 1:1). OTP/advance amount shown. No blank/error state.

---

### 1.3 — Send Enrollment Link (Lead A)

- [ ] Still inside the Lead Drawer for Arjun Menon.
- [ ] Click **Send Enrollment Link**.
- [ ] Confirm the popup shows correct name and phone.
- [ ] Click **Send**.

- [ ] ✅ **Checkpoint:** Success toast fires. Lead timeline/notes shows "Enrollment link sent".
- [ ] ✅ **Checkpoint:** WhatsApp message received on `9876543201` with an enrollment link (if WhatsApp is configured).
- [ ] 📋 **Copy the enrollment link URL** — paste it into a Notepad for next phase.

---

### 1.4 — Add Lead B (1:15 Student)

Repeat steps 1.1–1.3 with:
- **Name:** `Divya Krishnan`
- **Phone:** `9876543202`
- **Email:** `divya.test2026@gmail.com`
- **Grade:** `9`
- **Board:** `CBSE`
- **Region:** `Kerala`
- **Batch Type interest:** `1:15 Group`

- [ ] ✅ **Checkpoint:** Fee card shows annual fee for 1:15 Grade 9 Kerala CBSE (e.g. `₹33,000/year`).
- [ ] ✅ **Checkpoint:** Enrollment link sent. Copy the URL.

---

### 1.5 — Verify Lead Status & Fee Screen in CRM (Both Leads)

> Do this after sending both enrollment links — still in the CRM.

**For Arjun Menon:**

- [ ] Go back to the **Leads** list and click on **Arjun Menon**.
- [ ] Check the lead **status** — should have updated to `Enrolled` or `Closed Won`.
- [ ] Open the **Fee** tab (or Payments section) inside the lead drawer.
- [ ] ✅ **Checkpoint:** Fee entry shows the amount charged (e.g. ₹900) and payment status `Paid`.
- [ ] ✅ **Checkpoint:** Lead stage shows **Closed / Enrolled** — no longer in Inquiry or Follow-up.

**For Divya Krishnan:**

- [ ] Click on **Divya Krishnan** in the Leads list.
- [ ] Check lead status → `Enrolled` / `Closed Won`.
- [ ] Open **Fee** tab → annual fee (₹33,000) shown as `Paid`.
- [ ] ✅ **Checkpoint:** Divya's lead is closed with payment confirmed in CRM.

> Open the enrollment links in **Incognito / Private Browser** so no CRM session interferes.

---

### 2.1 — Arjun Menon Self-Enrolls (1:1)

- [ ] Open the enrollment link for Arjun in a new incognito window.
- [ ] **Step 1 — Student Details:**
   - Full Name: `Arjun Menon` (pre-filled — confirm it)
   - DOB: `2010-03-15`
   - Gender: `Male`
   - Phone: `9876543201`
   - Email: `arjun.test2026@gmail.com`
   - Click **Next**
- [ ] **Step 2 — Guardian Details:**
   - Parent Name: `Rajan Menon`
   - Relationship: `Father`
   - Phone: `9876543211`
   - Email: `rajan.parent2026@gmail.com`
   - Click **Next**
- [ ] **Step 3 — Academic:**
   - Grade: `10`, Board: `CBSE`, Region: `Kerala`
   - Click **Next**
- [ ] **Step 4 — Batch Selection:**
   - Select `1:1 Individual` batch type
   - Subject: `Mathematics` (or as available)
   - Click **Next**
- [ ] **Step 5 — Payment:**
   - Amount shown: `₹900` (OTP / advance for 1st session or pack)
   - Click **Pay Now**
   - Use Razorpay test card: `4111 1111 1111 1111` | Exp: `12/27` | CVV: `123`
   - Complete payment

- [ ] ✅ **Checkpoint:** "Enrollment Successful" confirmation screen appears.
- [ ] ✅ **Checkpoint:** Email/WhatsApp received at `arjun.test2026@gmail.com` with login credentials.
- [ ] ✅ **Checkpoint:** Login credentials include portal URL, email, and a temporary password.

---

### 2.2 — Divya Krishnan Self-Enrolls (1:15)

Open Divya's enrollment link in a separate incognito window. Repeat the same steps:
- **Grade:** `9`, **Board:** `CBSE`, **Region:** `Kerala`
- **Batch Type:** `1:15 Group`
- **Payment:** Annual fee `₹33,000` (or whatever amount shows — use Razorpay test card)

- [ ] ✅ **Checkpoint:** Enrollment success screen for Divya.
- [ ] ✅ **Checkpoint:** Login credentials received.

> **Expected Difference:** Arjun (1:1) pays per-session credits. Divya (1:15) pays an annual lump sum that creates a dated invoice covering the full academic year.

---

# PHASE 3 — AO Portal: Verify, Create Batches & Assign

> **Login:** AO → `chinjurp333@gmail.com` / `stibe@2026`
> **URL:** https://stibelearning.online/academic-operator

---

### 3.1 — Verify Enrollments

- [ ] Go to **Students** tab in the AO dashboard.
- [ ] Search for `Arjun` — his record should appear.
- [ ] Click his name to open the student profile.

- [ ] ✅ **Checkpoint:** Arjun's profile shows:
  - Portal role: `student`
  - Grade: 10, Board: CBSE, Region: Kerala
  - **Payment status:** Paid (credits added for 1:1)
  - Batch: None (not yet assigned)

- [ ] Search for `Divya` — repeat verification.

- [ ] ✅ **Checkpoint:** Divya's profile shows:
  - **Payment status:** Paid (annual invoice, covers full year)
  - Batch: None (not yet assigned)

---

### 3.2 — Create Batch A (1:1 for Arjun)

- [ ] Click the **Batches** tab in AO dashboard.
- [ ] Click **+ New Batch** or **Create Batch**.
- [ ] Fill in:
   - **Batch Name:** `Grade 10 CBSE 1:1 — Arjun Menon`
   - **Grade:** `10`
   - **Board:** `CBSE`
   - **Region:** `Kerala`
   - **Batch Type:** `1:1 Individual`
   - **Subject:** `Mathematics`
   - **Max Students:** `1`
- [ ] Click **Create**.

- [ ] ✅ **Checkpoint:** New batch appears in the Batches list with status `Active`.

---

### 3.3 — Create Batch B (1:15 for Divya)

Repeat 3.2 with:
- **Batch Name:** `Grade 9 CBSE 1:15 — Group`
- **Batch Type:** `1:15 Group`
- **Max Students:** `15`

- [ ] ✅ **Checkpoint:** Both batches now visible in Batches list.

---

### 3.4 — Add Students to Batches

**For Arjun (1:1 batch):**

- [ ] Click on `Grade 10 CBSE 1:1 — Arjun Menon` to open batch detail.
- [ ] Go to **Students** sub-tab.
- [ ] Click **Add Student**.
- [ ] Search `Arjun Menon` → select him.
- [ ] Click **Add / Confirm**.

- [ ] ✅ **Checkpoint:** Arjun appears in the batch student list. Welcome email sent automatically.

**For Divya (1:15 batch):**

- [ ] Open the `Grade 9 CBSE 1:15 — Group` batch.
- [ ] Repeat: Add **Divya Krishnan** to the batch.

- [ ] ✅ **Checkpoint:** Divya appears in the 1:15 batch student list.

> **Alternate path:** From the **Students** tab, find the student, click **Assign to Batch**, and pick the batch — both paths lead to the same result.

---

### 3.5 — Assign Teacher to Batches

**For Arjun's batch:**

- [ ] Inside `Grade 10 CBSE 1:1 — Arjun Menon`, go to **Teachers** sub-tab.
- [ ] Click **Assign Teacher**.
- [ ] Select `Salih R` (`salihr@stibeedu.in`) → Subject: `Mathematics`.
- [ ] Tick **Primary Teacher** → click **Assign**.

- [ ] ✅ **Checkpoint:** Teacher name appears in the batch with subject and "Primary" tag.

**For Divya's batch:**

- [ ] Open `Grade 9 CBSE 1:15 — Group`, repeat — assign the same or a different teacher.

---

### 3.6 — Assign Batch Coordinator

**For both batches:**

- [ ] Inside each batch detail, look for **Coordinator** section or **Settings**.
- [ ] Click **Assign Coordinator**.
- [ ] Select `Academiccoordinator1SUO@gmail.com` (Batch Coordinator).
- [ ] Click **Save**.

- [ ] ✅ **Checkpoint:** Coordinator name shown on the batch detail page for both batches.

---

# PHASE 4 — BC Portal: Auto-Schedule Sessions

> **Login:** BC → `Academiccoordinator1SUO@gmail.com` / `stibe@2026`
> **URL:** https://stibelearning.online/batch-coordinator

---

### 4.1 — Open Batches List

- [ ] Go to the **Batches** tab in the BC dashboard.
- [ ] Both batches should appear (assigned in Phase 3).

- [ ] ✅ **Checkpoint:** Both `Grade 10 CBSE 1:1 — Arjun Menon` and `Grade 9 CBSE 1:15 — Group` appear.

---

### 4.2 — Auto-Schedule Sessions for the 1:1 Batch

- [ ] Click on `Grade 10 CBSE 1:1 — Arjun Menon`.
- [ ] Look for **Schedule Sessions** or **Auto-Schedule** button.
- [ ] Select **Auto-Schedule** mode.
- [ ] Fill in:
   - **From Date:** `2026-05-05` (tomorrow)
   - **To Date:** `2026-05-30`
   - **Days:** Monday, Wednesday, Friday
   - **Time:** `06:00 PM`
   - **Duration:** `60 min`
   - **Teacher:** Salih R (auto-filled from batch)
- [ ] Click **Generate / Schedule**.

- [ ] ✅ **Checkpoint:** Session list shows all Mon/Wed/Fri sessions from May 5–30 (approx 12 sessions). Each session has status **Scheduled**, teacher assigned, and the correct time.
- [ ] ✅ **Checkpoint:** Teacher (`Salih R`) receives an email/WhatsApp notification listing the scheduled sessions.
- [ ] ✅ **Checkpoint:** Student (`Arjun Menon`) receives a schedule summary by email/WhatsApp.

---

### 4.3 — Auto-Schedule Sessions for the 1:15 Batch

Repeat 4.2 for `Grade 9 CBSE 1:15 — Group`:
- **Days:** Tuesday, Thursday
- **Time:** `07:00 PM`
- **Duration:** `90 min`
- **From:** `2026-05-06`, **To:** `2026-05-29`

- [ ] ✅ **Checkpoint:** Sessions generated (approx 8–10 sessions). All students in the batch (Divya + any others) get the schedule notification.

---

# PHASE 5 — Payment & Invoice Verification

---

### 5.1 — 1:1 Credit Check (Arjun)

> **Login:** AO or Owner dashboard → Student → Arjun Menon → Fees tab

- [ ] Open Arjun's student profile.
- [ ] Click **Fees / Payments** tab.
- [ ] Check the **session credit balance** — should reflect remaining sessions from his initial payment.
- [ ] Note: Each session attended will **deduct 1 credit**.

- [ ] ✅ **Checkpoint:**
  - Initial credit balance shown (e.g. 1 session for OTP payment, or pack size)
  - Sessions listed with status: upcoming
  - No "Payment Required" gate on upcoming sessions yet (if credits exist)

**What to expect for 1:1 gating:**  
When credit balance reaches 0, Arjun will see a **"Payment Required"** gate before joining his next session. He must top up via the student dashboard → Fees → Pay.

---

### 5.2 — 1:15 Annual Invoice Check (Divya)

> **Login:** AO or Owner dashboard → Student → Divya Krishnan → Fees tab

- [ ] Open Divya's profile → **Fees / Payments** tab.

- [ ] ✅ **Checkpoint:**
  - An **annual invoice** exists for the full academic year amount (e.g. ₹33,000).
  - Invoice **status:** `Paid`
  - Invoice has a **period_start** and **period_end** covering the academic year (e.g. April 2026 – March 2027)
  - No session credit counter — 1:15 students are gated by invoice date (not credits)

**What to expect for 1:15 gating:**  
Divya will be blocked from sessions that fall **outside her paid invoice period**. If she tries to join a session scheduled after her annual plan expires, she'll see a fee gate. Within the paid period, all sessions are open.

---

### 5.3 — Check Invoice in Owner Dashboard

> **Login:** Owner → `stibelearningventures@gmail.com` / `stibe@2026`

- [ ] Go to **Fees** tab in Owner dashboard.
- [ ] Search for Arjun and Divya's invoices.

- [ ] ✅ **Checkpoint:**
  - Arjun: Per-session invoice(s) — each paid invoice has `amount_paise` matching ₹900 (Grade 10 1:1)
  - Divya: Annual invoice — `amount_paise` matches ₹33,000 (Grade 9 1:15), status `paid`, full date range visible

---

# PHASE 6 — Start Class & Verify Notifications

> Approximately 5 minutes before the session start time. Or use **"Start Now"** option to start immediately.

---

### 6.1 — Teacher Starts Session

> **Login:** Teacher → `salihr@stibeedu.in` / `stibe@2026`
> **URL:** https://stibelearning.online/teacher

- [ ] Go to **Sessions** tab.
- [ ] Find today's upcoming session for Arjun's batch.
- [ ] Click **Start Class** (or **Go Live** button).

- [ ] ✅ **Checkpoint:** Browser asks for camera + microphone permission → allow both.
- [ ] ✅ **Checkpoint:** Teacher enters the waiting room / lobby.

---

### 6.2 — BC Approves Go-Live

> **Login:** BC tab/window

- [ ] BC dashboard should show a **Go-Live Request** alert for this session.
- [ ] Click **Approve**.

- [ ] ✅ **Checkpoint:** Teacher view transitions to **Live** state. Green "LIVE" indicator appears.
- [ ] ✅ **Checkpoint:** BC dashboard shows the session status as **Live**.

---

### 6.3 — Notifications Verification

Check the following notifications fired within 1–2 minutes of go-live:

| Recipient | Channel | Expected Message |
|-----------|---------|-----------------|
| Arjun Menon (student) | WhatsApp + Email | "Your class is live now — join here: [link]" |
| Rajan Menon (parent) | WhatsApp + Email | "Arjun's class has started" |
| AO | Email | Session started notification |
| BC | Dashboard | Session status → Live |

- [ ] ✅ **Checkpoint:** WhatsApp message received on student's registered phone within 2 minutes.
- [ ] ✅ **Checkpoint:** Parent WhatsApp received (if parent phone on record).
- [ ] ✅ **Checkpoint:** No notification errors in Owner → System Logs (if accessible).

---

### 6.4 — Student Joins

> Open a new browser tab / incognito and log in as the student.

> **Student login:** `arjun.test2026@gmail.com` / (password from enrollment email)

- [ ] Go to **Sessions** tab on student dashboard.
- [ ] Click **Join Class** on the live session.

- [ ] ✅ **Checkpoint:** Student enters the classroom and appears as a participant in the teacher's view.
- [ ] ✅ **Checkpoint:** Teacher sees student's video tile (1:1 mode — full screen layout).

---

# PHASE 7 — Live Classroom Testing

---

### 7.1 — Teacher View Basics

> In the **Teacher** browser tab

- [ ] Confirm the **Google Meet-style** layout with your own video large + student tiles on side.
- [ ] Test the toolbar:
   - [ ] Mute/unmute mic
   - [ ] Camera on/off
   - [ ] Screen share (click → pick a window)
- [ ] Open the **Chat** panel — type a test message.

- [ ] ✅ **Checkpoint:** Student sees teacher's screen share in their view.
- [ ] ✅ **Checkpoint:** Chat message appears on both teacher and student screens.

---

### 7.2 — AI Monitoring (Attention Tracker)

> The AI attention monitoring runs automatically in the student's browser.

- [ ] In the **Student** browser tab, look at the video feed — the system is tracking face position.
- [ ] Simulate low-attention events (yourself):
   - Look away from the screen for 5 seconds
   - Look down for 5 seconds
   - Block the camera with your hand briefly

- [ ] ✅ **Checkpoint (Teacher side):** After ~10 seconds, a **monitoring alert** badge or indicator appears on the student's tile showing low attention.

- [ ] ✅ **Checkpoint (AO side):**
> **Login:** AO → **Today's Live** tab (or Monitoring tab)

The AO monitoring panel shows:
- Arjun Menon → attention score dropping
- Event type: `looking_away` or `face_not_visible`
- Real-time graph updates

---

### 7.3 — BC Live Monitoring

> **Login:** BC → `Academiccoordinator1SUO@gmail.com` / `stibe@2026`  
> Go to **Live Monitor** tab

- [ ] BC should see the active session for Arjun's batch.
- [ ] Click into the session — Coordinator Live View opens.
- [ ] Verify BC can see:
   - Teacher video/audio stream
   - Student attendance status
   - AI monitoring score for each student
   - Chat feed

- [ ] ✅ **Checkpoint:** BC Live View shows teacher stream and Arjun's monitoring status.

---

### 7.4 — Click-and-Hold: Push-to-Talk (PTT)

> This lets the BC or a coordinator communicate directly with the teacher during class without interrupting the session audio.

**In the BC Coordinator Live View:**

- [ ] Find the **Push-to-Talk** button (microphone icon with "Hold to Talk" label).
- [ ] **Click and hold** the PTT button.
- [ ] While holding, speak a message: _"Teacher, please check Arjun's attention — he seems distracted."_
- [ ] **Release** the button to stop.

- [ ] ✅ **Checkpoint:** While holding the PTT button, a visual indicator shows "Transmitting..." or the mic is highlighted.
- [ ] ✅ **Checkpoint (Teacher side):** Teacher hears the BC's voice as a private overlay — students do NOT hear it.
- [ ] ✅ **Checkpoint:** After releasing, the teacher's audio resumes normally for students.

> **Note:** PTT uses a private data channel. Students' audio is not affected. Teacher hears BC in their headphones only.

---

### 7.5 — Raise Hand (Student Side)

> **In the Student browser tab**

- [ ] Find the **Raise Hand** button (hand icon).
- [ ] Click it.

- [ ] ✅ **Checkpoint:** Teacher sees a hand icon appear on Arjun's video tile.
- [ ] ✅ **Checkpoint:** Teacher can click **Lower Hand** or acknowledge from their toolbar.

---

### 7.6 — In-Session Exam Generation

> **In the Teacher** browser tab

- [ ] Look for the **Exam** panel or **Push Exam** button in the classroom toolbar.
- [ ] Click **Generate Exam** or **Push MCQ Exam**.
- [ ] Select:
   - **Topic:** (pick any curriculum topic shown, e.g. "Quadratic Equations")
   - **Questions:** `5`
   - **Time Limit:** `3 min`
- [ ] Click **Send Exam to Students**.

- [ ] ✅ **Checkpoint:** After 5–10 seconds (AI generation time), the exam appears on the teacher's side with the generated questions.
- [ ] ✅ **Checkpoint:** Student browser shows a popup/overlay: **"Exam Started — 3:00 remaining"** with 5 MCQ questions.

---

### 7.7 — Student Answers Exam

> **In the Student browser tab**

- [ ] Answer all 5 questions (right or wrong — it's a test).
- [ ] Click **Submit**.

- [ ] ✅ **Checkpoint:** Submission confirmation shown. Timer stops.
- [ ] ✅ **Checkpoint (Teacher side):** Teacher sees `1/1 students submitted` or a progress indicator.

---

### 7.8 — View Exam Results (Teacher)

- [ ] After time is up or all submitted, teacher sees **Show Results** button.
- [ ] Click it — results overlay appears showing each student's score.

- [ ] ✅ **Checkpoint:** Arjun's score shown as X/5. Correct/wrong answers highlighted.

---

### 7.9 — Anti-Cheat Check

> Verify the anti-cheat enforcement is active during the exam.

**In the Student browser:** While the exam is active:
- [ ] Try to switch to another browser tab — the tab switch should be recorded.
- [ ] Come back to the exam tab.

- [ ] ✅ **Checkpoint (Teacher side):** Teacher sees a **Tab Switch Alert** on Arjun's tile or in the monitoring panel.

---

# PHASE 8 — End Class & Post-Class

---

### 8.1 — Teacher Ends Class

> **Teacher browser tab**

- [ ] Click **End Class** button.
- [ ] Confirm the dialog: "End session for all participants?"
- [ ] Click **End**.

- [ ] ✅ **Checkpoint:** All participants are disconnected. Room shows "Ended" state.
- [ ] ✅ **Checkpoint:** Teacher redirected to post-session summary page.

---

### 8.2 — Post-Session Notifications

| Recipient | Expected |
|-----------|---------|
| Arjun (student) | Session ended + exam result email |
| Rajan (parent) | Session attendance summary |
| AO | Session completed notification |
| Teacher | Attendance summary + session log |

- [ ] ✅ **Checkpoint:** Email received at `arjun.test2026@gmail.com` with exam score.
- [ ] ✅ **Checkpoint:** WhatsApp received at student's number with session recap.

---

### 8.3 — Attendance Check

> **AO Login → Students → Arjun Menon → Attendance tab**

- [ ] ✅ **Checkpoint:** Today's session appears with:
  - Status: `Present`
  - Join time and leave time recorded
  - Duration close to actual session time

---

### 8.4 — Monitoring Report

> **AO Login → Monitoring tab** or **Student → Arjun → Reports**

- [ ] ✅ **Checkpoint:** AI monitoring report for today's session shows:
  - Total attention score %
  - Events breakdown: `looking_away`, `face_not_visible`, etc.
  - Timeline graph with dips at the times you looked away (Phase 7.2)

---

### 8.5 — Student Report (Student Login)

> **Student login:** `arjun.test2026@gmail.com`

- [ ] Go to **Reports** tab on student dashboard.

- [ ] ✅ **Checkpoint:** Dashboard shows:
  - Sessions attended: 1
  - Exam score from today: X/5
  - Attention score from today
  - "View Full Report" button works

---

# PHASE 9 — 1:15 Batch: Additional Checks

---

### 9.1 — Schedule & Start a 1:15 Session

Repeat Phases 6–7 for **Divya's batch** (Grade 9 CBSE 1:15 Group).

Key differences to verify:
- 15-student capacity (currently only Divya is enrolled — that's OK)
- Session layout changes to **YouTube-style** for 1:15 (teacher large, students in a grid strip)
- Students see each other's video tiles (not just teacher)

- [ ] ✅ **Checkpoint:** Classroom layout is different from 1:1 — teacher is prominent, student tiles are smaller.

---

### 9.2 — Invoice Date Gate Test (1:15)

> To simulate expiry, ask the dev team to temporarily set Divya's invoice `period_end` to yesterday in the DB. Then:

- [ ] Try joining as Divya for a scheduled session.

- [ ] ✅ **Checkpoint:** Student sees a **Fee Gate** screen: "Your annual plan has expired. Renew to continue."
- [ ] ✅ **Checkpoint:** A **Pay Now** button links to the renewal payment page.

> Restore the invoice date after testing.

---

# ✅ FINAL SIGN-OFF CHECKLIST

## Must Pass (Critical)

- [ ] CRM lead created → fee shown correctly
- [ ] Enrollment link sent and received
- [ ] CRM lead status closed and fee verified in CRM fee screen
- [ ] Student self-enrolled and paid via Razorpay
- [ ] Student appears in AO dashboard after enrollment
- [ ] Batch created, teacher assigned, BC assigned
- [ ] Sessions auto-scheduled from date range
- [ ] Notifications sent at each step (enrollment, schedule, go-live)
- [ ] Teacher starts class → BC approves → goes live
- [ ] Student joins → teacher sees them
- [ ] 1:1 credit balance reduces correctly
- [ ] 1:15 annual invoice shows full year coverage
- [ ] AI attention monitoring shows events in real time
- [ ] BC Live View shows session monitoring
- [ ] PTT (click-and-hold) heard by teacher, not students
- [ ] In-session exam generated by AI
- [ ] Student receives and submits exam
- [ ] Exam results shown to teacher
- [ ] Anti-cheat tab-switch recorded
- [ ] Class ended → attendance + results recorded
- [ ] Post-class emails/WhatsApp received

## Should Pass (Important)

- [ ] Parent receives attendance notification
- [ ] 1:15 invoice date gate blocks expired student
- [ ] Raise Hand visible to teacher
- [ ] Screen share visible to student
- [ ] AI monitoring report generated post-session
- [ ] Student reports page shows correct data

## Nice to Verify (Polish)

- [ ] Reminder notification 15 min before session
- [ ] Session countdown clock accurate on student dashboard
- [ ] Monitoring graph shows timeline correctly in AO
- [ ] Fee gate shows amount and reason clearly (not just a generic block)
- [ ] WhatsApp messages not truncated or broken on mobile

---

## 🔧 Common Issues & Quick Fixes

| Issue | Likely Cause | Quick Fix |
|-------|-------------|-----------|
| Enrollment link shows "expired" | Link > 7 days old | Generate a new one from CRM drawer |
| Student not appearing in AO after enrollment | Enrolled with different email | Check enrolled email vs CRM lead email |
| BC doesn't see Go-Live request | BC not logged in or session is in different batch | Verify batch coordinator assignment in Phase 3.6 |
| PTT not working | Browser blocked mic permission | Check browser address bar for mic permission icon → allow |
| AI monitoring not tracking | Camera not granted or face not visible | Ensure face is well-lit and centered in camera frame |
| Exam generation timeout | Groq API slow | Wait 15 sec and retry; check network tab for errors |
| Student sees Fee Gate unexpectedly | Invoice date issue | Check `period_start/period_end` in Owner → Fees → Invoice detail |
| Ghost can see themselves in participant list | Role metadata issue | Check `portal_role` in LiveKit metadata — should be `ghost` |

---

*Document version: May 4, 2026 — stibe Platform Master Workflow Test*
