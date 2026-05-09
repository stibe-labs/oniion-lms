# stibe Portal — Complete Role-Wise Feature Listing

**Generated:** March 2026  
**Codebase:** ~42,900 LOC · 197 source files · 132 API routes · 10 role dashboards  
**Status:** Phase 1 Complete (all audit gaps resolved — commit 6ca9f17)

---

## Table of Contents

1. [Student](#1-student)
2. [Teacher](#2-teacher)
3. [Parent](#3-parent)
4. [Batch Coordinator](#4-batch-coordinator)
5. [Academic Operator](#5-academic-operator)
6. [Owner](#6-owner)
7. [HR Associate](#7-hr-associate)
8. [Ghost Observer](#8-ghost-observer)
9. [Cross-Role: Classroom Features](#9-cross-role-classroom-features)
10. [Cross-Role: Notification System](#10-cross-role-notification-system)
11. [Platform Services Summary](#11-platform-services-summary)

---

## 1. STUDENT

**Dashboard:** `/student` → `StudentDashboardClient.tsx`  
**Page Routes:** `/student`, `/student/exams`, `/student/exams/[id]`

### 1.1 Dashboard Tabs (9)

| Tab | Features |
|-----|----------|
| **Overview** | Live class join banner · Payment alert · 5-stat grid (Batches, Live Now, Upcoming, Completed, Attendance Rate%) · Exam & Fee stats (4 cards) · Fee overdue alert · Quick Actions |
| **Batches** | Batch list with type badge (1:1, 1:3, 1:Many, Lecture, Custom) · Subject, grade, section info · Teacher assignments · Session statistics |
| **Sessions** | Room details with teacher info · Subject, grade, section · Scheduled time & status · Recording availability · Request reschedule/cancel |
| **Attendance** | Summary: total, present, absent, late, rate · Average time in class · Total rejoins · Color-coded rate (green ≥75%, yellow ≥50%, red <50%) |
| **Exams** | Exam list by subject · Attempt status · Score, percentage, grade letter · Duration & total marks · Pass/fail status |
| **Fees** | Invoice list (number, amount, status, due date) · Payment history · Pending amounts · Pay button (Razorpay) |
| **Materials** | Teaching materials list · File type, size · Direct download · Subject association |
| **Profile** | Name, email, phone, WhatsApp, DOB · Grade, section, board · Parent email · Admission date |

### 1.2 Quick Actions
- Join Live Class
- Take Exam
- Make Payment
- View Materials

### 1.3 API Endpoints Accessible

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/student/batches` | GET | Batch memberships |
| `/api/v1/student/rooms` | GET | Assigned rooms |
| `/api/v1/student/sessions` | GET | Batch sessions list |
| `/api/v1/student/attendance` | GET | Attendance records + summary |
| `/api/v1/student/fees` | GET | Fee overview (invoiced/paid/balance) |
| `/api/v1/exams` | GET | Exam list (role-filtered) |
| `/api/v1/exams/[id]` | GET | Exam detail with questions |
| `/api/v1/exams/[id]/report-card` | GET | Printable HTML report card (own only) |
| `/api/v1/session-exam` | GET, POST | Fetch questions · Submit & grade answers |
| `/api/v1/session-exam/results` | GET | Exam results |
| `/api/v1/session-requests` | GET, POST, PATCH | Submit/view reschedule/cancel requests |
| `/api/v1/session-extension` | GET, POST | Request session extension |
| `/api/v1/student-availability` | GET, POST, PATCH | Submit time slot availability |
| `/api/v1/recording/requests` | GET, POST | Request video access to recordings |
| `/api/v1/room/join` | POST | Get LiveKit token for room |
| `/api/v1/room/[room_id]/feedback` | POST | Submit class feedback (1-5 rating) |
| `/api/v1/room/[room_id]/chat` | POST | Store chat message |
| `/api/v1/room/[room_id]/doubts` | GET, POST | Raise doubts · View teacher replies |
| `/api/v1/room/[room_id]/homework` | GET, POST | View assignments · Submit homework |
| `/api/v1/room/[room_id]/report-teacher` | POST | Report teacher misconduct |
| `/api/v1/room/[room_id]/recording/upload` | POST | Upload WebM recording blob |
| `/api/v1/monitoring/events` | POST | Send attention monitoring events |
| `/api/v1/academics/settings` | GET | Academic settings (subjects, grades) |
| `/api/v1/payment/fee-structures` | GET | View fee structures |

### 1.4 Classroom Features (StudentView)
- **Layout:** Fullscreen immersive, overlays auto-hide after 3.5s
- **Controls:** Mic toggle · Camera toggle · Hand Raise · Chat · Leave
- **Content:** Teacher video (main) · Whiteboard mode (tablet screen share fills background)
- **PIPs:** Teacher cam + self-cam (float, fade with overlays)
- **Dialogs:** Time warning (5 min) · Demo exam · Session exam · Feedback (end of class)
- **AI Monitoring:** MediaPipe attention tracking runs locally (eye closure, gaze, head pose, tab visibility, inactivity, multiple faces)
- **Video Quality:** Low (h360) / Medium (h720) / High (h1080)

### 1.5 Notifications Received

| Trigger | Channel |
|---------|---------|
| Class Reminder (30 min, 5 min) | Email + WhatsApp |
| Class Started (Go Live) | Email + WhatsApp |
| Class Cancelled | Email + WhatsApp |
| Class Rescheduled | Email + WhatsApp |
| Room Invite | Email + WhatsApp |
| Batch Assignment | Email + WhatsApp |
| Invoice Generated | Email + WhatsApp |
| Payment Confirmed | Email + WhatsApp |
| Payment Receipt | Email + WhatsApp |
| Exam Scheduled | Email + WhatsApp |
| Results Published | Email + WhatsApp |
| Video Access Approved/Rejected | WhatsApp |
| Timetable Update | Email |

### 1.6 Exam Features
- **Page:** `/student/exams` → Exam listing
- **Page:** `/student/exams/[id]` → Take exam interface with timer, question navigation, auto-submit
- **Types:** MCQ (auto-graded) · Descriptive (teacher grades) · File upload for answer sheets
- **Session Exam:** In-class topic assessment during live session
- **Demo Exam:** Trial exam for demo/trial students

---

## 2. TEACHER

**Dashboard:** `/teacher` → `TeacherDashboardClient.tsx`  
**Page Routes:** `/teacher`, `/teacher/exams`

### 2.1 Dashboard Tabs (9)

| Tab | Features |
|-----|----------|
| **Overview** | Live class overlay warning with countdown · Today's session summary (total, live, upcoming, completed, cancelled) · Stats grid (sessions this week/month, feedback rating) · Session progress timeline with Start Session button · Batches assigned summary |
| **My Batches** | Batch list with type badge · Grade, section, board · Subject assignments · Student count · Session stats (total, completed, upcoming, live, cancelled) · Expandable student roster |
| **Schedule** | Week-view calendar grid · Sessions grouped by day · Countdown (prep/live phase) · Start session action · Session detail popup (topic, notes, students) |
| **My Profile** | Name, email, avatar, phone, WhatsApp, DOB · Subjects, qualification, experience · Region |
| **Salary** | Payslips: period, classes conducted/missed/cancelled, rate, base pay, incentive, LOP, total, status · Summary stats (total earned, pending) |
| **Ratings** | Averages: punctuality, teaching quality, communication, overall · Monthly trends chart · Recent ratings with session info |
| **Materials** | Teaching materials list · Upload/download · Subject, file info · Share to batches |
| **Leave** | Leave request form (type, dates, reason) · Leave request status tracking |
| **Demo** | Demo session management |

### 2.2 Quick Actions
- Start Session (opens classroom in new tab)
- View Session Detail / Edit Topic
- Upload Materials
- Submit Leave Request

### 2.3 API Endpoints Accessible

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/teacher/rooms` | GET | Rooms assigned to teacher |
| `/api/v1/teacher/my-batches` | GET | Batches + session stats |
| `/api/v1/teacher/schedule` | GET | Week's schedule |
| `/api/v1/teacher/profile` | GET, PATCH | Profile info · Update profile |
| `/api/v1/teacher/profile/avatar` | POST | Upload profile photo |
| `/api/v1/exams` | GET, POST | List exams · Create exam |
| `/api/v1/exams/[id]` | GET, PUT | Exam detail (includes answers for creators) · Update exam |
| `/api/v1/exams/[id]/marks` | POST | Enter marks for descriptive/offline exams |
| `/api/v1/exams/[id]/report-card` | GET | Generate report card |
| `/api/v1/session-exam-topics` | GET, POST | Upload topic PDF → AI generates MCQs |
| `/api/v1/session-exam` | GET, POST | Fetch/submit exam questions |
| `/api/v1/question-bank` | GET, POST | Question bank management |
| `/api/v1/teacher-leave` | GET, POST, PATCH, DELETE | Leave request workflow |
| `/api/v1/teacher-reports` | GET | View teacher reports |
| `/api/v1/session-requests` | GET, POST, PATCH | Session reschedule/cancel requests |
| `/api/v1/recording` | GET, POST | Recording management (start/stop/status) |
| `/api/v1/payroll` | GET | View own payslips |
| `/api/v1/payroll/payslip-pdf/[id]` | GET | Download payslip |
| `/api/v1/room/[room_id]` | GET, PATCH | Room status/detail · Update (go-live) |
| `/api/v1/room/[room_id]/go-live` | POST | Teacher clicks "Go Live" |
| `/api/v1/room/[room_id]/end-request` | POST | Request early end (coordinator approves) |
| `/api/v1/room/[room_id]/chat` | POST | Store chat message |
| `/api/v1/room/[room_id]/doubts` | GET, POST | View/answer doubts |
| `/api/v1/room/[room_id]/homework` | GET, POST | Assignments · Grading |
| `/api/v1/room/[room_id]/attendance` | GET | Session attendance |
| `/api/v1/room/[room_id]/recording` | GET, POST | Recording status · Start recording |
| `/api/v1/room/[room_id]/recording/upload` | POST | Upload WebM to YouTube |
| `/api/v1/room/[room_id]/exams` | GET | Upcoming exams for room |
| `/api/v1/monitoring/alerts` | GET, POST | View/dismiss monitoring alerts |
| `/api/v1/demo/requests` | GET | Own demo requests |

### 2.4 Classroom Features (TeacherView)
- **Layout:** Google Meet-style with sidebar (320px collapsible)
- **Header:** Room name · LIVE badge · Countdown timer · Participant count
- **Controls:** Mic · Camera · Screen Share · Whiteboard · Chat · Virtual Background · Record · End Class
- **Content Modes:** Grid view (auto-responsive) · Whiteboard mode (tablet + teacher overlay)
- **Sidebar Tabs (6):** Chat · Doubts · Homework · Participants · Attendance · Monitoring
- **Chat:** Real-time data channel, contact detection blocks phone/email/URLs
- **Doubts:** Student Q&A with statuses (open/answered/deferred/closed)
- **Homework:** Create assignments · View submissions · Grade
- **Participants:** List with hand-raise badges · Local audio mute · Kick controls
- **Attendance:** Live presence · Join times · Late indicators · Duration
- **Monitoring:** Real-time AI attention scores · Multi-face alerts · Tab switch alerts
- **Recording:** Toggle YouTube Live recording (RTMP egress via LiveKit)
- **Early End:** Requires coordinator approval (polls every 2s, 60s timeout)
- **Virtual Background:** MediaPipe background blur/replace (requires GPU)
- **Teacher Overlay:** Zero-lag background-removed camera over whiteboard

### 2.5 Notifications Received

| Trigger | Channel |
|---------|---------|
| Room Invite (teacher link + tablet link) | Email + WhatsApp |
| Class Reminder (30 min, 5 min) | Email + WhatsApp |
| Batch Assignment | Email + WhatsApp |
| Payslip Generated | Email + WhatsApp |
| Leave Request Status Change | Email |

### 2.6 Exam Features
- **Page:** `/teacher/exams` → Create/manage exams
- **Exam Creation:** Manual questions · AI-generated from PDF (Groq Cloud API)
- **Question Types:** MCQ (auto-grade) · Descriptive (manual grade) · File upload
- **Grading:** Manual marks entry for descriptive answers
- **Question Bank:** Save/retrieve reusable questions

---

## 3. PARENT

**Dashboard:** `/parent` → `ParentDashboardClient.tsx`  
**Page Routes:** `/parent`

### 3.1 Dashboard Tabs (8)

| Tab | Features |
|-----|----------|
| **Overview** | Alerts widget (overdue payments, missed sessions, upcoming sessions) · Child sessions quick view · Fee summary card · Attendance snapshot |
| **Attendance** | Per-child summary (total, present, absent, late, rate) · Recent sessions per child · Engagement metrics (attention score, mic/camera events) |
| **Exams** | Per-child exam summary (total taken, average %, best/worst, passed/failed) · Individual exam results (marks, percentage, grade letter, pass/fail) |
| **Fees** | Fee summary (invoices, paid, outstanding) · Invoice list with pay button (Razorpay) · Payment history/receipts · Ledger (debit/credit/running balance) |
| **Reports** | Performance reports (daily/weekly/monthly) · AI monitoring reports (distraction, engagement, attention trends) |
| **Complaints** | Submit complaint (subject, category, description, priority) · Complaint list with status tracking |
| **Monitoring** | AI distraction metrics · Engagement score · Attention trends · Alert history |
| **Requests** | Session request form (reschedule/cancel) · Pending requests list with withdrawal option |

### 3.2 Quick Actions
- Make Payment
- View Full Report
- View Recordings
- Submit Complaint

### 3.3 API Endpoints Accessible

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/parent/rooms` | GET | Rooms children are assigned to |
| `/api/v1/parent/exams` | GET | Exam results for children |
| `/api/v1/parent/reports` | GET | Generated reports for children |
| `/api/v1/parent/complaints` | GET, POST | Submit/view complaints |
| `/api/v1/session-requests` | GET, POST, PATCH | Reschedule/cancel requests |
| `/api/v1/monitoring/reports/[reportId]` | GET | Monitoring report for child |
| `/api/v1/payment/fee-structures` | GET | Fee structures |
| `/api/v1/academics/settings` | GET | Academic settings |

### 3.4 Classroom Features (GhostView — Read-Only)
- **View:** Student grid with attention badges · Whiteboard display · Chat (read-only) · Attendance · Monitoring alerts
- **No Controls:** Cannot send audio/video/chat · Cannot interact with classroom
- **Badges:** 🟢 attentive · 🟡 distracted · 🔴 low engagement

### 3.5 Notifications Received

| Trigger | Channel |
|---------|---------|
| Invoice Generated | Email + WhatsApp |
| Payment Receipt | Email + WhatsApp |
| Payment Due (7 days) | WhatsApp |
| Payment Overdue | WhatsApp |
| Class Cancelled | Email |
| Class Rescheduled | Email |
| Batch Assignment | Email + WhatsApp |
| Exam Scheduled | WhatsApp |
| Results Published | Email + WhatsApp |
| Student Absent | WhatsApp |
| Early Exit Alert | Email |
| Timetable Update | Email |

---

## 4. BATCH COORDINATOR

**Dashboard:** `/batch-coordinator` → `CoordinatorDashboardClient.tsx`  
**Page Routes:** `/batch-coordinator`, `/batch-coordinator/admissions`, `/batch-coordinator/cancellations`

### 4.1 Dashboard Tabs (8)

| Tab | Features |
|-----|----------|
| **Overview** | Session stats grid (6 cols: total, live, scheduled, ended, alerts, cancelled) · Live sessions card (up to 5 with Observe button) · Recent alerts card (severity color-coding) · Quick Actions bar · Pending Video Requests widget |
| **Batches** | Batch list (name, type, grade, section, subjects, student count, session stats) · Batch detail with student roster & teacher assignments |
| **Live Sessions** | Live session list with status · Participant count real-time · Observe/manage actions |
| **Monitoring** | Critical alerts section · Student alert details (attention score, looking away minutes, eyes closed, distracted, etc.) · Class engagement score · Event summary |
| **Reports** | Report list (daily/weekly/monthly) · Report generation form (target, role, period) |
| **Students** | Student performance list (attendance rate, exams taken, avg score) · Student dismissal panel · Batch-wise distribution |
| **Leave** | Teacher leave requests · Approval workflow |
| **Teacher Reports** | Teacher incident/complaint reports |

### 4.2 Additional Pages
- `/batch-coordinator/admissions` → Student admission workflows (enquiry → registered → active)
- `/batch-coordinator/cancellations` → Cancellation request handling

### 4.3 API Endpoints Accessible

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/batches` | GET, POST | List/create batches |
| `/api/v1/batches/[batchId]` | GET, PATCH, DELETE | Batch detail/update/archive |
| `/api/v1/batches/people` | GET | Available people for assignment |
| `/api/v1/batches/[batchId]/students/bulk` | POST | Bulk CSV student upload |
| `/api/v1/batch-sessions` | GET, POST, DELETE | Session list/create/bulk cancel |
| `/api/v1/batch-sessions/[sessionId]` | GET, PATCH, DELETE | Session detail/update/cancel |
| `/api/v1/batch-sessions/[sessionId]/start` | POST | Create LiveKit room + tokens |
| `/api/v1/batch-sessions/weekly-timetable` | GET, POST | Timetable pattern/send emails |
| `/api/v1/batch-sessions/finalize-invoices` | POST | Generate invoices after scheduling |
| `/api/v1/recording` | GET, POST | Recording management |
| `/api/v1/recording/requests` | GET, POST, PATCH | Video access approval |
| `/api/v1/room/create` | POST | Create room in DB + LiveKit |
| `/api/v1/room/[room_id]` | GET, PATCH, DELETE | Room management |
| `/api/v1/room/[room_id]/attendance` | GET | Attendance records |
| `/api/v1/room/[room_id]/end-request` | POST | Early end decision |
| `/api/v1/monitoring/session/[roomId]` | GET | Live monitoring data |
| `/api/v1/monitoring/reports` | GET, POST | Monitoring reports |
| `/api/v1/monitoring/alerts` | GET, POST | Alerts (view/dismiss) |
| `/api/v1/reports` | GET, POST | Generate/retrieve reports |
| `/api/v1/teacher-leave` | GET, POST, PATCH, DELETE | Leave approval |
| `/api/v1/teacher-reports` | GET, PATCH | Teacher incident reports |
| `/api/v1/student-status` | GET, PATCH | Student enrollment status |
| `/api/v1/session-requests` | GET, POST, PATCH | Session request approval |
| `/api/v1/session-extension` | GET, POST, PATCH | Extension approval |
| `/api/v1/admissions` | GET, POST, PATCH, DELETE | Admission workflow |
| `/api/v1/exams` | GET, POST | Exam management |
| `/api/v1/exams/[id]` | GET, PUT | Exam detail/update |
| `/api/v1/exams/[id]/marks` | POST | Enter exam marks |
| `/api/v1/exams/[id]/report-card` | GET | Generate report card |
| `/api/v1/hr/students/[email]/performance` | GET | Student performance data |
| `/api/v1/hr/teachers/[email]/performance` | GET | Teacher performance data |
| `/api/v1/users/search` | GET | Search users |
| `/api/v1/demo/send-link` | POST | Send demo registration link |
| `/api/v1/demo/available-teachers` | GET | Available teachers |
| `/api/v1/demo/summary/[roomId]` | GET | Demo session summary |

### 4.4 Classroom Features (GhostView — Read-Only)
- Same as Parent ghost view + full monitoring sidebar
- Can observe any live session
- Access to monitoring alerts & student attention data

### 4.5 Notifications Received (Coordinator-Specific)

| Trigger | Channel |
|---------|---------|
| Room Created (coordinator summary) | Email |
| Contact Violation Alert | Email |
| Teacher Report/Incident | Email |
| Early End Request from Teacher | In-App (polls) |
| Student Early Exit Alert | Email |

---

## 5. ACADEMIC OPERATOR

**Dashboard:** `/academic-operator` → `AcademicOperatorDashboardClient.tsx`  
**Page Routes:** `/academic-operator`

### 5.1 Dashboard Tabs (11)

| Tab | Features |
|-----|----------|
| **Overview** | Batch stats grid · Session summary · Quick action cards (Create Batch, Schedule Session, Assign Teachers, View Requests) |
| **Batches** | Full batch management (create, edit, archive) · Student/teacher assignment · Type selection (1:1, 1:3, 1:5, 1:Many, Lecture, Custom) |
| **Sessions** | Calendar view + list view · Session creation modal (batch, date/time, duration, topic, recurring) · Status management |
| **Students** | Student list (batch assignments, parent info, attendance, status) · Enrollment management |
| **Teachers** | Teacher list (subjects, qualification, experience, batches, ratings) · Teacher Readiness widget (online/offline by last_login) |
| **Materials** | Material list (title, subject, file info, batch associations) · Upload/edit/delete |
| **Exam Topics** | Upload topic PDF → AI generates/extracts MCQs via Groq Cloud API |
| **Monitoring** | Alerts dashboard · Student-level monitoring data · Dismiss actions · Attendance summary widget (global stats) |
| **Requests** | Session requests (reschedule/cancel) with approve/reject · Leave requests with resolution planning · Video access requests with approve/reject |
| **Demo** | Demo request list · Demo session management |
| **Teacher Reports** | Incident reports with update actions |

### 5.2 API Endpoints Accessible
All Batch Coordinator endpoints PLUS:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/hr/users` | GET, POST | List/create users |
| `/api/v1/hr/users/[email]` | GET, PATCH, DELETE | User management |
| `/api/v1/hr/users/[email]/reset-password` | POST | Reset user password |
| `/api/v1/hr/users/[email]/avatar` | POST | Upload user avatar |
| `/api/v1/payment/generate-monthly` | POST | Generate monthly invoices |
| `/api/v1/batch-sessions/daily-timetable` | POST | Send morning timetable |
| `/api/v1/batch-sessions/auto-start` | POST | Auto-start sessions in prep window |
| `/api/v1/batch-sessions/session-reminder` | POST | Send session reminders |
| `/api/v1/session-exam-topics` | GET, POST | Exam topic management |
| `/api/v1/demo/requests` | GET | Demo requests list |

### 5.3 Classroom Features
- GhostView (same as Coordinator)
- Full monitoring access

### 5.4 Notifications Received

| Trigger | Channel |
|---------|---------|
| Contact Violation | Email |
| Teacher Report/Incident | Email |
| Session Request Submitted | In-Dashboard |
| Leave Request Submitted | In-Dashboard |

---

## 6. OWNER

**Dashboard:** `/owner` → `OwnerDashboardClient.tsx`  
**Page Routes:** `/owner`, `/owner/batches`, `/owner/teachers`, `/owner/academic-operator`, `/owner/hr`, `/owner/fees`, `/owner/payroll`, `/owner/exams`, `/owner/reports`, `/owner/roles`, `/owner/system`

### 6.1 Dashboard Tabs (5)

| Tab | Features |
|-----|----------|
| **Overview** | Urgent attention banner (pending counts) · Today's sessions stats (5 cols) · Main KPI grid (batches, live, users, cancelled) · Revenue KPI grid (collected, pending, overdue, 30-day trend) · Live classes marquee with Ghost View · Users by role cards |
| **Sessions** | Session list with filters (status, search) · Status badges · Teacher/coordinator info · Participant count |
| **Finance** | Session activity chart (30-day, conducted vs cancelled) · Revenue trend (6-month bars) · Subject distribution pie · Grade distribution bars · Payment stats · Recent payments list |
| **Approvals** | Pending actions summary · Cancellation/reschedule/leave request cards · Approve/reject with notes |
| **Teacher Reports** | Teacher incident reports |

### 6.2 Sub-Pages (10)

| Page | Purpose |
|------|---------|
| `/owner/batches` | Batch management UI |
| `/owner/teachers` | Teacher management & configuration |
| `/owner/academic-operator` | Academic operations oversight (shares AO dashboard) |
| `/owner/hr` | HR management (shares HR dashboard) |
| `/owner/fees` | Fee structure & invoice management |
| `/owner/payroll` | Teacher salary processing & payslips |
| `/owner/exams` | Exam catalog & results overview |
| `/owner/reports` | Business analytics & financial reports |
| `/owner/roles` | Role definitions & permission management |
| `/owner/system` | System settings, configuration, maintenance |

### 6.3 API Endpoints Accessible
ALL endpoints in the system (owner has implicit full access), PLUS:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/owner/overview` | GET | All rooms overview |
| `/api/v1/owner/user-stats` | GET | User counts by role |
| `/api/v1/owner/dashboard` | GET | All dashboard metrics & charts |
| `/api/v1/owner/users/[email]` | GET, PATCH | User detail/update (email, password, status) |
| `/api/v1/payment/send-reminder` | POST | Manual payment reminder |
| `/api/v1/payment/fee-structures` | GET, POST | Fee structure CRUD (POST = owner only) |
| `/api/v1/academics/settings` | GET, PUT | Academic settings management |

### 6.4 Report Types Available (11)
1. **Attendance Report** — Class-wise attendance rates
2. **Revenue Report** — Fee collection, invoicing metrics
3. **Teacher Performance Report** — Classes, feedback, hours, student retention
4. **Student Progress Report** — Grades, attendance, engagement
5. **Batch Summary Report** — Batch-level metrics
6. **Exam Analytics Report** — Scores, grade distribution, weak topics
7. **Payroll Summary Report** — Teacher salary overview
8. **Session Report** — Room-level session data
9. **Parent Monthly Report** — AI behavior summary
10. **Daily Business Report** — Daily operational snapshot
11. **Weekly Sales Report** — Revenue velocity tracking

### 6.5 Classroom Features
- GhostView (silent observation)
- Ghost View button on live sessions marquee
- Full monitoring access

### 6.6 Notifications Received

| Trigger | Channel |
|---------|---------|
| All system alerts | Email |
| Contact violations | Email |
| Critical monitoring alerts | In-Dashboard |

---

## 7. HR ASSOCIATE

**Dashboard:** `/hr` → `HRDashboardClient.tsx`  
**Page Routes:** `/hr`

### 7.1 Dashboard Tabs (13)

| Tab | Features |
|-----|----------|
| **Overview** | Requires attention banner · Quick stats grid (6 cols: total users, active, teachers, students, parents, coordinators) · Role breakdown cards (total/active/inactive per role) · Alerts (students without parent, teachers without subjects) |
| **Teachers** | User list (avatar, name, email, subjects, qualification, experience, status) · Create/edit/deactivate · Detail modal (all profile fields) |
| **Students** | User list (name, email, grade, section, board, parent linked, admission date) · Create/edit · Detail modal |
| **Parents** | Parent user management · Children linked view |
| **Batch Coordinators** | Coordinator user management |
| **Academic Operators** | AO user management |
| **HR Associates** | HR user management |
| **Ghost Observers** | Ghost user management |
| **Cancellations** | Filter tabs (all, awaiting HR, teacher/parent initiated, approved, rejected) · Multi-step approval workflow (coordinator → academic → HR) |
| **Attendance** | Aggregate attendance data across all rooms · Per-student/teacher summaries |
| **Payroll** | Payslip management (generate, finalize, mark paid, download) · Teacher pay config · Incentive rules |
| **Fee Rates** | Fee configuration per role/batch type · Rate tables |
| **Leave Requests** | Teacher leave list · Approval/rejection · Substitute teacher assignment · Affected sessions tracking |

### 7.2 API Endpoints Accessible

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/hr/stats` | GET | Headcount per role + recent signups |
| `/api/v1/hr/users` | GET, POST | List users by role · Create user + send credentials |
| `/api/v1/hr/users/[email]` | GET, PATCH, DELETE | User detail/update/deactivate |
| `/api/v1/hr/users/[email]/reset-password` | POST | Issue new credentials |
| `/api/v1/hr/users/[email]/avatar` | POST | Upload avatar |
| `/api/v1/hr/attendance` | GET | Aggregate attendance |
| `/api/v1/hr/students/[email]/performance` | GET | Student performance |
| `/api/v1/hr/teachers/[email]/performance` | GET | Teacher performance |
| `/api/v1/payroll` | GET, POST, PATCH | Payroll management |
| `/api/v1/payroll/payslip-pdf/[id]` | GET | Payslip download |
| `/api/v1/reports` | GET, POST | Report generation |
| `/api/v1/teacher-leave` | GET, POST, PATCH, DELETE | Leave approval |
| `/api/v1/admissions` | GET, POST, PATCH, DELETE | Admission workflow |

### 7.3 User Management Actions
- Create user (role-specific form with all profile fields)
- Edit user details
- Activate/deactivate user accounts
- Reset password & issue new credentials (email sent)
- Upload user avatars
- View user performance metrics

### 7.4 Notifications Received

| Trigger | Channel |
|---------|---------|
| Leave request awaiting HR approval | In-Dashboard |
| Cancellation request awaiting HR | In-Dashboard |

---

## 8. GHOST OBSERVER

**Dashboard:** `/ghost` → `GhostDashboardClient.tsx`  
**Page Routes:** `/ghost`, `/ghost/monitor`

### 8.1 Dashboard View Modes (3)

| View | Features |
|------|----------|
| **All Sessions** | Stats grid (live, scheduled, total) · Live sessions section ("Enter Silently") · Scheduled sessions section · Enter Ghost button per session |
| **By Batch** | Batch group cards · Expandable room list · Monitor All button · Live indicator badges |
| **By Teacher** | Teacher group cards (avatar, name, email) · Expandable room list · Monitor All button |

### 8.2 Special Features
- **Silent Entry:** Does not appear in participant lists
- **Invisible:** Camera and mic disabled, no visibility to students/teachers
- **Multi-Room:** Can observe multiple sessions simultaneously
- **Oversight Console:** `/ghost/monitor` — Multi-view grid of ALL live sessions
- **Combined Monitor:** Watch all N live sessions at once

### 8.3 API Endpoints Accessible

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/monitoring/session/[roomId]` | GET | Live monitoring data |
| `/api/v1/monitoring/reports` | GET | Monitoring reports list |
| `/api/v1/monitoring/reports/[reportId]` | GET | Specific monitoring report |
| `/api/v1/hr/students/[email]/performance` | GET | Student performance |
| `/api/v1/hr/teachers/[email]/performance` | GET | Teacher performance |
| `/api/v1/demo/summary/[roomId]` | GET | Demo session summary |
| `/api/v1/room/join` | POST | Get LiveKit token (hidden mode) |

### 8.4 Classroom Features (GhostView)
- All student cameras in responsive grid
- Click to enlarge student tile
- Attention badges: 🟢 attentive · 🟡 distracted · 🔴 low engagement
- Hand raise badges
- **Sidebar Tabs (4):** Chat (read-only) · People · Attendance · Monitoring
- Real-time violations (multiple faces, tab switch, inactivity)
- Ephemeral observer notes (local-only)

---

## 9. CROSS-ROLE: CLASSROOM FEATURES

### 9.1 Components (16)

| Component | Used By | Purpose |
|-----------|---------|---------|
| ClassroomWrapper | All | Router — determines which view based on role |
| TeacherView | Teacher | Full controls, sidebar, recording |
| StudentView | Student | Fullscreen immersive with auto-hide overlays |
| GhostView | Ghost, Owner, Coordinator, AO, Parent | Silent read-only observation |
| ScreenDeviceView | Teacher (tablet) | Tablet input display |
| HeaderBar | All | Room info, timer, participant count |
| ControlBar | Teacher, Student | Media controls |
| ChatPanel | Teacher, Student, Ghost (RO) | Real-time text + contact detection |
| DoubtPanel | Teacher, Ghost | Student Q&A system |
| HomeworkPanel | Teacher, Ghost | Assignment creation + grading |
| AttendancePanel | Teacher, Ghost | Live presence + join logs |
| ParticipantList | Teacher, Ghost | Participant management |
| WhiteboardComposite | Teacher, Student | Tablet screen + teacher overlay |
| VideoTile | All | Individual participant video |
| VideoQualitySelector | Teacher, Student | Bandwidth control |
| VirtualBackgroundPanel | Teacher | MediaPipe background blur/replace |
| FeedbackDialog | Student | End-of-class rating |
| ReportTeacherDialog | Student | Misconduct reporting |
| DemoExamDialog | Teacher, Student | Demo room exam |
| SessionExamDialog | Teacher, Student | In-class timed exam |
| TimeWarningDialog | Teacher, Student | 5-min warning |
| TeacherOverlay | Teacher (whiteboard) | Background-removed camera |

### 9.2 Hooks (4)

| Hook | Purpose |
|------|---------|
| `useAttentionMonitor` | MediaPipe biometric tracking — eye closure, gaze, head pose, yawning, tab visibility, inactivity, multiple faces. Score 0-100, 11 states. Runs locally, broadcasts via data channel + batched to API. |
| `useTeacherOverlay` | MediaPipe zero-lag background removal for teacher camera over whiteboard |
| `useSession` | Client-side JWT session auth (user, loading, logout) |
| `useWhiteboard` | Whiteboard source resolution (tablet vs desktop screen share) |

### 9.3 Data Channels (5)
- `chat` — Real-time text messages
- `hand_raise` — Student hand raise/lower
- `doubt` — Doubt submission/response
- `attention` — Biometric attention data (every 1.5s)
- `go_live` — Teacher go-live signal

### 9.4 LiveKit Role Grants

| Role | Publish | Subscribe | Hidden | Room Admin |
|------|---------|-----------|--------|------------|
| teacher | ✅ Audio+Video+Data | ✅ | ❌ | ❌ |
| teacher_screen | ✅ Screen only | ✅ | ❌ | ❌ |
| student | ✅ Audio+Video+Data | ✅ | ❌ | ❌ |
| batch_coordinator | ❌ | ✅ | ✅ | ❌ |
| academic_operator | ❌ | ✅ | ✅ | ❌ |
| parent | ❌ | ✅ | ✅ | ❌ |
| owner | ❌ | ✅ | ✅ | ❌ |
| ghost | ❌ | ✅ | ✅ | ❌ |

---

## 10. CROSS-ROLE: NOTIFICATION SYSTEM

### 10.1 WhatsApp Templates (8)

| # | Template | Parameters | Recipients |
|---|----------|------------|------------|
| 1 | class_reminder | studentName, subject, time, teacherName, batchName | Students |
| 2 | payment_due | parentName, studentName, amount, dueDate | Parents (7-day advance) |
| 3 | payment_overdue | parentName, studentName, amount, dueDate | Parents (overdue) |
| 4 | exam_scheduled | studentName, examTitle, date, subject | Students + Parents |
| 5 | exam_result | studentName, examTitle, score, grade, percentage | Students + Parents |
| 6 | attendance_alert | parentName, studentName, date, status | Parents |
| 7 | video_access | studentName, roomName, status | Students |
| 8 | general | recipientName, message | Any user |

### 10.2 Email Templates (21)

| # | Template | Trigger | Recipients |
|---|----------|---------|------------|
| 1 | Teacher Room Invite | Room creation | Teachers |
| 2 | Student Room Invite | Room creation | Students |
| 3 | Room Reminder (30 min) | Cron job | All participants |
| 4 | Room Reminder (5 min) | Cron job | All participants |
| 5 | Room Started (Go Live) | Teacher go-live | Students |
| 6 | Room Cancelled | Room delete/cancel | All participants |
| 7 | Room Rescheduled | Room reschedule | All participants |
| 8 | Coordinator Summary | After invites sent | Coordinator |
| 9 | Payment Confirmation | Payment webhook | Student |
| 10 | Payment Receipt | Payment webhook | Student + Parent |
| 11 | Invoice Generated | Monthly cron | Student + Parent |
| 12 | Payment Reminder | Manual/cron | Parent |
| 13 | Batch Coordinator Notify | Batch creation | Coordinator |
| 14 | Batch Teacher Notify | Batch creation | Teacher |
| 15 | Batch Student Notify | Batch creation | Student |
| 16 | Batch Parent Notify | Batch creation | Parent |
| 17 | Payslip Notification | Payroll processing | Teachers |
| 18 | Contact Violation Alert | Chat violation detected | Coordinator + Admin |
| 19 | Teacher Report | Student misconduct report | Coordinator + Support |
| 20 | Credentials/Welcome | User onboarding | New user |
| 21 | Timetable Update | Session schedule change | Students + Parents |

### 10.3 Notification Lifecycle Flows

**Room Lifecycle:**
```
Room Created → Teacher Invite + Student Invite (Email + WA)
    → 30 min before → Reminder (Email + WA)
    → 5 min before → Reminder (Email + WA)
    → Go Live → Students notified (Email + WA)
    → Room Cancelled/Rescheduled → All notified (Email + WA)
```

**Payment Lifecycle:**
```
Invoice Generated → Student + Parent (Email + WA)
    → 7 days before due → Payment Due reminder (WA)
    → 1 day before due → Payment Due reminder (WA)
    → Overdue → Payment Overdue (WA)
    → Payment Made → Confirmation + Receipt (Email + WA)
```

**Exam Lifecycle:**
```
Exam Published → Students + Parents (Email + WA exam_scheduled)
    → Results Released → Students + Parents (Email + WA exam_result)
```

### 10.4 Phone Lookup Hierarchy
1. `user_profiles.whatsapp` (registered)
2. `user_profiles.phone` (fallback)
3. `demo_requests.student_phone` (demo students)
4. `null` (skip WhatsApp)

---

## 11. PLATFORM SERVICES SUMMARY

### 11.1 Core Services (36 lib/ files)

| Service | Key Functions |
|---------|--------------|
| **db.ts** | PostgreSQL pool · Transactions · `resolveRoomId()` |
| **session.ts** | JWT sign/verify (jose) · 8h expiry |
| **auth.ts** | API route auth helper |
| **auth-utils.ts** | Server-side user & role verification |
| **auth-db.ts** | bcrypt password verification |
| **users.ts** | User CRUD · Search · Role queries |
| **permissions.ts** | RBAC with 40+ permission keys · 8 categories |
| **permissions-server.ts** | Server-side permission fetch + merge |
| **livekit.ts** | Room service · Webhook receiver · Role grants |
| **email.ts** | Nodemailer + queue + WhatsApp mirroring |
| **email-templates.ts** | 21 HTML templates with dark mode |
| **email-queue.ts** | BullMQ background email queue via Redis |
| **whatsapp.ts** | Meta Cloud API · 8 templates · Fire-and-forget |
| **exam.ts** | Exam CRUD · Grading · Batch assignment |
| **exam-notifications.ts** | Exam scheduled/results notifications |
| **ai-exam-generator.ts** | Groq Cloud API → MCQ extraction/generation from PDF |
| **demo-exam-questions.ts** | Pre-built question bank (grade-aware) |
| **payment.ts** | Razorpay orders · Signature verification · Invoicing |
| **invoice-description.ts** | Parse pipe-delimited invoice descriptions |
| **payroll.ts** | Teacher salary: pay config · Period · Payslip calc · Notifications |
| **attendance.ts** | Join/leave recording · Late detection · Summary |
| **monitoring.ts** | AI event logging · Alert creation · Thresholds |
| **monitoring-reports.ts** | Post-session analytics · AI summaries |
| **contact-detection.ts** | Chat scanning (phone, email, social, URLs) |
| **early-exit-alert.ts** | Parent/coordinator alert on student early leave |
| **recording.ts** | YouTube Live RTMP egress · Start/stop · URL retrieval |
| **youtube.ts** | OAuth2 · Broadcast creation · Playlist management |
| **reports.ts** | 11 report types · AI narratives |
| **room-notifications.ts** | Room lifecycle email notifications |
| **timetable-auto.ts** | Weekly timetable digest · Debounced · Rate-limited |
| **demo-summary.ts** | Post-demo session summaries |
| **nav-config.ts** | Per-role navigation sidebar config |
| **sounds.ts** | Web Audio API synthesis · Haptic feedback |
| **utils.ts** | cn(), IST date formatters, room name generator |
| **pdf-logo.ts** | Logo caching for PDF/HTML generation |
| **redis.ts** | Redis client singleton |

### 11.2 Database Tables (25+)

**Core:** portal_users · rooms · batches · batch_sessions · batch_students · room_assignments  
**Attendance:** attendance_sessions · attendance_logs  
**Monitoring:** monitoring_events · monitoring_alerts  
**Exams:** exams · exam_questions · exam_attempts · exam_answers · exam_batch_assignments  
**Finance:** invoices · payment_receipts · payments · teacher_pay_config · payroll_periods · payslips  
**Communication:** email_logs · notification_log · class_recordings  
**Reports:** reports  
**Admissions:** admissions · demo_requests

### 11.3 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.1.6, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, PostgreSQL 15, Redis 7 |
| Video | LiveKit 1.9.11 (WebRTC), RTMP Egress |
| AI | MediaPipe (face landmarks, image segmentation), Groq Cloud API (question extraction/generation) |
| Email | Nodemailer + BullMQ queue |
| WhatsApp | Meta Cloud API |
| Payments | Razorpay |
| Recording | YouTube Live API (OAuth2, unlisted broadcasts) |
| Auth | JWT (jose), bcrypt, session cookies |
| Deploy | PM2, Nginx, Cloudflare SSL |

### 11.4 Status

**Phase 1: COMPLETE** — All 106 features implemented, all audit gaps resolved (commit 6ca9f17).  
No pending missing features identified.
