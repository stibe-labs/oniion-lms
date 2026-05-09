# stibe Portal — Complete Codebase Study

**Date:** April 19, 2026  
**Scope:** Full codebase analysis — 81 migrations, 197+ API routes, 9 role dashboards, 31 classroom components, 40+ lib modules

---

## 1. ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────────────┐
│              stibe Learning Portal                  │
│              stibelearning.online                    │
├──────────────────────────────────────────────────────┤
│  Next.js 16.1.6 (App Router + Turbopack)             │
│  TypeScript · Tailwind CSS 4 · shadcn/ui             │
├──────────────────────────────────────────────────────┤
│  PostgreSQL 15 │ Redis 7 │ LiveKit 1.9 │ Razorpay   │
│  62+ tables    │ BullMQ  │ WebRTC      │ Multi-curr │
│  81 migrations │ queues  │ Data chan   │ INR/AED/USD│
├──────────────────────────────────────────────────────┤
│  AI: MediaPipe (attention) · Groq LLM (exam gen)    │
│  Comms: SMTP + WhatsApp (Meta Cloud API)             │
│  Recording: YouTube Live (LiveKit Egress → RTMP)     │
└──────────────────────────────────────────────────────┘
```

### Servers
- **Portal**: 76.13.244.60 (PM2 `stibe-portal`)
- **LiveKit Media**: 76.13.244.54 (media.stibelearning.online:7880)
- **Domain**: stibelearning.online (Cloudflare SSL + Nginx)

---

## 2. DATABASE SCHEMA (62+ Tables, 81 Migrations)

### Core User System
| Table | PK | Purpose |
|-------|-----|---------|
| `portal_users` | email | All users (11 roles), credentials, permissions |
| `user_profiles` | email FK | Extended info: DOB, subjects, grade, parent_email, per_hour_rate |
| `branches` | branch_id | Organization branches with manager_emails |
| `school_config` | key | System settings (KV store) |
| `academic_settings` | id | Curriculum config (TEXT arrays) |
| `session_config` | id | Session defaults (90min, 75 teach, 15 prep) |

### Batch & Session System
| Table | Purpose |
|-------|---------|
| `batches` | Batch definitions (1:1, 1:3, 1:many, custom types) |
| `batch_students` | Student→batch enrollment (UNIQUE per batch) |
| `batch_teachers` | Teacher→batch by subject (UNIQUE per batch+subject) |
| `batch_sessions` | Scheduled sessions (subject, teacher, date, time, duration) |
| `rooms` | Active LiveKit rooms (status, recording, fees) |
| `room_assignments` | Participant→room with join_token, payment_status |
| `room_events` | Audit log (lifecycle, payments, recording, exams) |

### Payment & Finance (8 tables)
| Table | Purpose |
|-------|---------|
| `fee_structures` | Pricing by batch_type/grade/subject, multi-currency |
| `session_fee_rates` | Per-batch hourly rates |
| `invoices` | Student invoices (pending/paid/overdue/refunded) |
| `session_payments` | Payment records per session |
| `payment_attempts` | Gateway integration (Razorpay order tracking) |
| `payment_receipts` | Confirmation receipts with gateway_response JSONB |
| `teacher_pay_config` | Per-teacher rate + incentive rules JSONB |
| `teacher_session_earnings` | Per-session earnings records |

### Payroll (2 tables)
| Table | Purpose |
|-------|---------|
| `payroll_periods` | Payroll cycles (draft/finalized/paid) |
| `payslips` | Teacher payslips (classes, rates, incentives, deductions) |

### Exam System (8+ tables)
| Table | Purpose |
|-------|---------|
| `exams` | Exam definitions (MCQ/descriptive, scheduled) |
| `exam_questions` | Questions with options JSONB, difficulty, topic |
| `exam_attempts` | Student attempts (score, grade_letter) |
| `exam_answers` | Per-question answers |
| `exam_batch_assignments` | Exam→room assignment |
| `exam_topic_files` | File attachments for AI exam gen |
| `session_exam_results` | Results tied to live sessions |
| `exam_violations` | Student violation tracking |

### Monitoring & Attendance (6 tables)
| Table | Purpose |
|-------|---------|
| `attendance_sessions` | Per-participant aggregates (duration, late_by, engagement) |
| `attendance_logs` | Granular join/leave/mic/camera events |
| `class_monitoring_events` | AI attention events (14 types) |
| `monitoring_alerts` | Escalated alerts (18 types, 3 severities) |
| `monitoring_reports` | Daily/weekly/monthly student+teacher reports |
| `contact_violations` | Inappropriate message detection |

### CRM / Sales (4 tables)
| Table | Purpose |
|-------|---------|
| `crm_leads` | Full lead tracking (10 sources, 9 pipeline stages) |
| `crm_activities` | Call/whatsapp/email/meeting logs |
| `crm_reminders` | Follow-up task scheduling |
| `crm_tags` | Lead categorization tags |

### Other Systems
| Table | Purpose |
|-------|---------|
| `admission_requests` | 6-stage admission workflow |
| `enrollment_links` | Public enrollment URLs |
| `teacher_leave_requests` | Multi-level leave approval (AO→HR→Owner) |
| `cancellation_requests` | 6-stage cancellation workflow |
| `session_requests` | Student reschedule/cancel requests |
| `homework_assignments/submissions/grades` | Homework system |
| `teaching_materials` + `material_batch_assignments` | Resource library |
| `conferences` + `conference_participants/shares` | Video conferences |
| `academic_calendars` + sessions + `calendar_schedule_runs` | Calendar scheduling |
| `open_classrooms` | Broadcast/public classrooms |
| `email_log` | Email audit trail (20+ template types) |
| `notification_log` | WhatsApp/email/push notifications |
| `generated_reports` | 11 report types with JSONB data |
| `parent_complaints` | Support tickets (7 categories) |
| `session_ratings` | Student→teacher ratings (4 dimensions) |
| `student_feedback` | Post-session feedback |
| `rejoin_requests` | Student rejoin approvals |

---

## 3. ROLES & PERMISSIONS

### 11 Portal Roles

| Role | Dashboard | Tabs | Key Powers |
|------|-----------|:----:|-----------|
| `owner` | `/owner` | 6 | **Full access**, system config, roles, fees, payroll |
| `academic_operator` | `/academic-operator` | 13 | Batch mgmt, sessions, leave approval, materials, exams, demos |
| `batch_coordinator` | `/batch-coordinator` | 5+live | Go-live approval, live monitoring, end-class authorization |
| `hr` | `/hr` | 14 | User CRUD, payroll, attendance, cancellations, fee rates |
| `teacher` | `/teacher` | 11 | Sessions, homework, exams, salary, ratings, leave requests |
| `student` | `/student` | 8 | Classes, attendance, exams, homework, fees, Buji chatbot |
| `parent` | `/parent` | 8 | Multi-child monitoring, fees, exams, AI reports, complaints |
| `ghost` | `/ghost` | 3 modes | Silent observation, multi-view grid, invisible in rooms |
| `sales` | `/sales` | 6 | CRM leads, pipeline kanban, activities, reminders |
| `teacher_screen` | internal | — | Tablet whiteboard device (screen-share only) |
| `academic` | → `/academic-operator` | — | Legacy alias |

### 32 Permissions (8 Categories)

**Rooms**: rooms_create, rooms_manage, rooms_view, batches_create, batches_manage  
**Users**: users_create, users_edit, users_deactivate, users_reset_password, users_view, admissions_manage, cancellations_manage  
**Attendance**: attendance_view, attendance_mark  
**Exams**: exams_create, exams_grade, exams_view, exams_take  
**Finance**: fees_view, fees_manage, payments_view, salary_view, payroll_manage  
**Reports**: reports_view  
**Observation**: ghost_observe  
**Communication**: complaints_file, notifications_send  

Owner always has ALL permissions. Other roles have defaults + custom_permissions JSONB overrides.

---

## 4. API ROUTES (197+ Endpoints)

### Auth (6 routes)
- `POST /auth/login` — bcrypt verify → JWT cookie
- `POST /auth/logout` — clear cookie
- `GET /auth/me` — current user from JWT
- `POST /auth/forgot-password` — OTP email (rate-limited 3/10min)
- `POST /auth/verify-otp` — verify → 5-min reset token
- `POST /auth/reset-password` — update password

### Rooms & Sessions (~15 routes)
- Room CRUD, join (LiveKit token), participant management, mute, reminders
- Batch sessions: list, create, bulk cancel, auto-start, credit-check, timetable, finalize invoices

### Batches & People (~10 routes)
- Batch CRUD, people management, coordinator live sessions

### User Management (~15 routes)
- Profile get/update, search, image upload
- Owner: dashboard, admins CRUD, user stats, permissions
- HR: users CRUD, attendance, stats, students, teachers

### Student (~8 routes)
- Batches, rooms, credits, fees, session-exams, attendance, refund requests

### Teacher (~12 routes)
- My batches/sessions/students, schedule, exam summary, homework, rooms, ratings, salary-live, profile

### Exams (~10 routes)
- Exam CRUD, session-exam (questions/submit/results), question bank, demo exam

### Payments (~14 routes)
- Initiate (Razorpay), callback, invoices, receipts, fee structures, session rates, monthly generation, reminders, ledger, public-initiate

### Payroll (~3 routes)
- List/create/manage payroll, payslip PDF

### Monitoring & Reports (~10 routes)
- Alerts (list/dismiss), events (ingest), monitoring reports (generate/list)
- Reports: generate 11 types, teacher reports, student reports

### Other Domains
- **Admissions** (2 routes) — list/advance admission workflow
- **Enrollment** (2 routes) — create links, verify (public)
- **Demo** (5 routes) — requests, available teachers, exam, send link
- **Leave** (3 routes) — submit/withdraw/approve, upload medical cert
- **Cancellations** (2 routes) — list/process
- **Materials** (4 routes) — CRUD teaching materials
- **Recording** (2 routes) — start/stop/status, list recordings
- **Attention** (2 routes) — store/retrieve engagement data
- **Notifications** (2 routes) — send WhatsApp, get log
- **Chatbot** (2 routes) — Buji AI (Groq LLM), context
- **Sales/CRM** (5 routes) — leads CRUD, dashboard, FB sync
- **Conferences** — multi-room video conferencing
- **Open Classrooms** — broadcast/public sessions

---

## 5. CLASSROOM SYSTEM (31 Components)

### View Architecture
```
ClassroomWrapper (orchestrator)
├── TeacherView     — Google Meet-style, sidebar tabs, whiteboard, student grid
├── StudentView     — YouTube fullscreen immersive, auto-hide overlays, AI attention
├── CoordinatorView — 3 modes (control/teacher/student), recording, end-class approval
├── GhostView       — Silent observer, invisible, monitoring alerts
└── ScreenDeviceView — Teacher tablet whiteboard (Flutter companion app)
```

### LiveKit Integration
- **Data Channels**: chat, attention_update, hand_raise, media_request, session_control
- **Role-Based Grants**:
  - Teacher: full publish + admin + record
  - Student: camera+mic only
  - Coordinator: data only + subscribe (hidden)
  - Ghost/Parent: subscribe-only (hidden)
  - Teacher_screen: screen-share only (sources 3,4)

### AI Attention Pipeline
```
Student camera → MediaPipe FaceLandmarker (1.5s intervals)
→ 468 landmarks + 53 blendshapes → head pose (yaw/pitch/roll)
→ Temporal gating (3-4 consecutive = 4.5-6s sustained)
→ Rolling 40-window score → broadcast every 30s
→ POST /api/v1/monitoring/events → monitoring_events table
```
**Context-aware**: Head-down ≤35° = note-taking (NOT flagged), brief glances normal

### Teacher Overlay Pipeline
```
ImageSegmenter 256×256 → requestVideoFrameCallback
→ Binary threshold 0.45 → pre-alloc RGBA mask
→ Canvas composite (destination-in alpha blend)
```

---

## 6. KEY FEATURE SYSTEMS

### Email & WhatsApp (45 templates)
- Nodemailer SMTP with connection pooling
- BullMQ queue (stibe-email-queue)
- Auto WhatsApp mirror via Meta Cloud API (29 templates)
- CRM webhook integration on payment/enrollment events

### Payment Gateway
- **Primary**: Razorpay (test/live mode)
- **Currencies**: INR, AED, SAR, QAR, KWD, OMR, BHD, USD
- Invoice numbers: `INV-YYYYMM-00001`
- Receipt numbers: `RCT-YYYYMM-00001`
- Public payment page: `/pay/[id]`

### AI Exam Generation
- Groq Cloud API: `llama-3.3-70b-versatile` (text) + `llama-4-scout-17b-16e` (vision)
- Input: PDF (max 20 pages), images, PPT/PPTX (LibreOffice headless conversion)
- Page range selection: `"1-3,5,7-9"`
- Output: MCQ with options, correct_answer, marks, difficulty, solution_steps

### Payroll System
- Period-based: draft → finalized → paid
- Per-teacher config: rate_per_class, incentive_rules JSONB
- Payslip: classes conducted/missed/cancelled, base_pay, incentives, LOP, total
- PDF generation

### Leave Management
- Multi-level: AO → HR → Owner approval tracks
- Session resolution plan required
- Medical certificate upload support
- Auto-withdraw on teacher deletion

### Admission Pipeline
- 6 stages: enquiry → registered → fee_confirmed → allocated → active → rejected
- Enrollment links (public, CRM integration)
- WhatsApp invite sending

### Conference System
- Instant/scheduled video conferences
- Admin + user tokens
- Participant tracking + link sharing

### Open Classrooms
- Public broadcast sessions
- Payment-enabled (optional)
- Teacher-hosted with join tokens

### Sales CRM Module
- 10 lead sources (manual, FB, Instagram, WhatsApp CTWA, demo, referral, etc.)
- 9 pipeline stages (new → enrolled/lost)
- Activities: calls, WhatsApp, email, meetings, notes
- Reminders with snooze/complete
- FB lead sync, UTM tracking, lead scoring

---

## 7. FRONTEND ARCHITECTURE

### Dashboard Shell
```
┌────────────────────────────────────────┐
│ Header: Logo │ Dark/Light │ User Menu  │
├──────────┬─────────────────────────────┤
│ Sidebar  │ Tab Content                 │
│ (role    │ (hash-based navigation)     │
│  items)  │                             │
└──────────┴─────────────────────────────┘
```

### Shared Components (components/dashboard/shared.tsx — 1,168 lines)
- Buttons (6 variants), Inputs, Forms (4-col grid), Modals
- StatCard, StatusBadge, RoleBadge, Avatar
- TableWrapper, TabBar, LoadingState, EmptyState
- useToast(), useConfirm(), money() formatter

### Navigation Pattern
- Path-based: full page loads (`/teacher/exams`)
- Hash-based: client-side tab switches (`/teacher#salary`)
- Permission-gated: nav items hidden if permission denied
- Config: `lib/nav-config.ts` (role → tab array mapping)

### Key Dashboard Sizes
| Component | Lines |
|-----------|------:|
| AcademicOperatorDashboard | 7,960 |
| StudentDashboard | 3,397 |
| TeacherDashboard | 2,711 |
| UsersTab (HR) | 2,517 |
| HRDashboard | 1,937 |
| ParentDashboard | 1,686 |
| BCDashboard | 1,251 |
| OwnerDashboard | 1,122 |

---

## 8. AUTH & MIDDLEWARE

### Auth Flow
```
POST /auth/login → bcrypt verify (lib/auth-db.ts) → JWT cookie (365d, HS256)
→ proxy.ts middleware → verifySession() → role-based route protection
→ Token refresh: 7-day sliding window
```

### Public Routes (no auth)
- `/login`, `/demo*`, `/conference*`, `/open-classroom*`
- `/enroll*`, `/pay*`, `/egress-layout*`
- `/uploads/`, `/mediapipe/`
- `/join/*`, `/classroom/*` (sessionStorage token auth)

### Route Protection
- Each dashboard path mapped to allowed roles
- Owner bypasses all restrictions
- Violators redirected to their role's dashboard

---

## 9. HOOKS

| Hook | Lines | Purpose |
|------|------:|---------|
| useAttentionMonitor | 604 | MediaPipe face landmark + blendshape AI engagement |
| useTeacherOverlay | 291 | MediaPipe background segmentation |
| useClassRecorder | 273 | Session recording (VP9/VP8 → YouTube) |
| useNetworkStatus | ~80 | Network quality + offline detection |
| useSession | ~50 | Client auth (GET /auth/me) |
| useWhiteboard | stub | Whiteboard composite (planned) |

---

## 10. DEPLOYMENT

```bash
# Dev
npm run dev                    # Turbopack dev server

# Build & Deploy
git add -A && git commit -m "msg" && git push origin master
ssh stibe-portal "cd /var/www/stibe-portal && git pull origin master && npm run build 2>&1 | tail -15 && pm2 restart stibe-portal"

# DB Operations (via SSH)
echo "SQL" | ssh stibe-portal "sudo -u postgres psql -d stibe_portal"
cat migrations/XXX.sql | ssh stibe-portal "sudo -u postgres psql -d stibe_portal"
```
