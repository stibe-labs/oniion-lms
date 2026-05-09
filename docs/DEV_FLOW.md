# stibe Portal — Development Flow & Status

---

**Portal Project:** `/Users/pydart/Projects/stibe-portal`  
**Teacher App:** `/Users/pydart/Projects/stibe-teacher`  
**Server Build:** `/Users/pydart/Projects/server_build` (2 servers — media + portal)  
**Last Updated:** May 2026  
**Latest Commit:** `9abfaa7` — Allow sibling parent reuse and block non-parent role conflicts during enrollment

### Recent Fixes (May 2026)

- Enrollment PATCH (`/api/v1/enroll/[linkId]`) now normalizes parent email and blocks submission when that email already exists in `portal_users` with a non-`parent` role.
- External enrollment-link API (`/api/v1/external/create-enrollment-link`) enforces the same parent role guard server-side to prevent role collision before link creation.
- Existing parent-role emails are now explicitly supported for sibling enrollment reuse without forcing duplicate parent accounts.

### Recent Fixes (April 2026)

- Teacher session exam upload now supports up to 50 MB per file, and classroom upload UI reflects the same limit.
- Session exam ingestion now accepts broader office formats and normalizes them through LibreOffice conversion before extraction.
- Teacher exam tab now includes selected-topic live exam lifecycle tracking (sent, reached, started, camera-waiting, completed) with topic-aware resend logic.
- Exam tab compliance details now surface fullscreen-exit violations from submitted exam telemetry.
- AO dashboard now treats session status as source-of-truth from persisted DB state, so overtime live sessions no longer auto-flip to ended in list/calendar views.
- `ended` is now shown only when session status is explicitly updated to `ended` (manual teacher/AO end action).
- Student dashboard class status now ends based on actual teacher go-live time (`batch_sessions.started_at`) instead of only scheduled start time.
- `GET /api/v1/student/rooms` now joins `batch_sessions` and returns `started_at` for accurate live/ended classification in student UI.
- Added global teacher control toggle `allow_go_live_before_schedule` so AO/Owner can allow or block early Go Live before scheduled start time.
- Teacher classroom GO LIVE button and `/api/v1/room/[room_id]/go-live` now both respect this toggle to keep UI and backend behavior consistent.
- Student classroom rendering now supports tablet-only (`teacher_screen`) screen-share host and includes explicit screen-share audio playback to reduce blank-screen/audio issues during Flutter screen sharing.

---

## Architecture

```
┌──────────────────────────────────┐     ┌─────────────────────────┐
│       stibe Portal             │     │   LiveKit Media Server  │
│  stibelearning.online          │◄───►│   76.13.244.54:7880     │
│                                  │     │                         │
│  Next.js 16.1.6 (Turbopack)     │     │  WebRTC Rooms           │
│  329 source files                │     │  Video / Audio          │
│  ~101,000 LOC                    │     │  Data Channels (Chat)   │
│  152 API Routes                  │     │  Screen Share            │
│  8 Role Dashboards               │     └─────────────────────────┘
│  29 Classroom Components         │
│  LiveKit Token Generation        │     ┌─────────────────────────┐
│  Email Notifications (33+ tpl)   │     │  stibe Teacher App    │
│  WhatsApp Cloud API (29 tpl)     │     │  Flutter / Android       │
│  PostgreSQL Auth (bcrypt)        │     │                         │
│  Redis + BullMQ Queue            │     │  17 Dart files, ~6,824 LOC│
│  Permission System (RBAC)        │     │  LiveKit screen share    │
│  Batch Management System         │     │  FCM push notifications  │
│  Exam System (Live + AI Gen)     │     │  Deep link from emails   │
│  Payment & Fee Management        │     │  Foreground service      │
│  Payroll Engine                  │     └─────────────────────────┘
│  Attendance Tracking             │
│  Groq Cloud API (text + vision)  │
│  Student Reports (recharts)      │
│  Teacher Reports & Ratings       │
│  AI Monitoring (MediaPipe)       │
```

**Two-Server Stack:**

| Server | IP | Domain | Stack |
|--------|-----|--------|-------|
| LiveKit Media | `76.13.244.54` | `media.stibelearning.online` | LiveKit 1.9.11 · Nginx |
| Portal | `76.13.244.60` | `stibelearning.online` | Next.js 16.1.6 · PostgreSQL 15 · Redis 7 · PM2 · Groq Cloud API |
| ERP Frontend | `76.13.244.60` | `stibelearning.net` | Next.js · PM2 (`stibe-erp`, port 3001) |

**Nginx Sites (Portal Server 76.13.244.60):**

| Config | Domain(s) | Upstream | Notes |
|--------|-----------|----------|-------|
| `stibe-online` | `stibelearning.online` | `localhost:3000` | Portal — Cloudflare SSL, self-signed origin cert at `/etc/ssl/stibe-portal/` |
| `erp` | `stibelearning.net` | `localhost:3001` | ERP Frontend — separate PM2 process |
| `stibe-portal` | `stibe.pydart.com` | `localhost:3000` | Legacy domain (same portal) |

---

## Brand Theme & Design System

### Brand Palette (defined in `globals.css`)

| Token | Value | Hex | Usage |
|-------|-------|-----|-------|
| `--brand-green` | `oklch(0.723 0.191 145)` | `#22C55E` | Primary Green — CTAs, active states, sidebar |
| `--brand-green-dark` | `oklch(0.627 0.194 145)` | `#16A34A` | Hover states, email headers |
| `--brand-green-light` | `oklch(0.792 0.209 148)` | `#4ADE80` | Highlights, badges |
| `--brand-teal` | `oklch(0.679 0.132 175)` | `#14B8A6` | Accent Teal — secondary buttons, info cards |
| `--brand-teal-dark` | `oklch(0.600 0.130 175)` | `#0D9488` | Teal hover states |
| `--brand-teal-light` | `oklch(0.750 0.140 180)` | `#2DD4BF` | Teal highlights |

### Semantic Colors

| Purpose | Color | CSS Class |
|---------|-------|-----------|
| Success | Green | `text-green-600`, `.status-success` |
| Warning | Amber | `text-amber-600`, `.status-warning` |
| Danger | Red | `text-red-600`, `.status-cancelled` |
| Info | Blue | `text-blue-600`, `.status-info` |
| Live | Green pulse | `.status-live`, `.live-pulse` |

### CSS Utilities (globals.css)

| Class | Description |
|-------|-------------|
| `.bg-brand-gradient` | `linear-gradient(135deg, green → teal)` |
| `.text-brand-gradient` | Gradient text with `background-clip: text` |
| `.btn-brand` | Gradient button with hover brightness+translate |
| `.status-live/scheduled/ended/cancelled` | Status badge color presets |
| `.classroom-root` | Disables touch callout/highlight for classroom |

### Dark Mode

Root `<html>` has `className="dark"`. All CSS custom properties have dark-mode variants with brighter brand colors and near-black backgrounds with green tint. Sidebar uses dedicated dark palette (`oklch(0.145 0.02 145)` base).

### Fonts

Geist + Geist Mono (loaded via `next/font/google`).

### Animations (4 keyframes)

| Name | Purpose |
|------|---------|
| `livePulse` | 2s opacity pulse for live indicators |
| `sidebar-ripple` | Click ripple on sidebar nav items |
| `sidebar-indicator` | Active nav indicator bar entrance |
| `sidebar-fade-in` | Sidebar item slide-in entrance |

---

## Shared Component Library

### `components/dashboard/shared.tsx` — 1,168 lines, 72 exports

The design system foundation. Every dashboard imports from this file. Organized in 15 sections:

| Section | Components | Key Exports |
|---------|------------|-------------|
| **Buttons** | 2 | `Button` (6 variants × 4 sizes, `loading` prop shows Loader2 spinner), `IconButton` |
| **Inputs** | 5 | `Input`, `Textarea`, `Select`, `SearchInput` (with search icon), `Toggle` (switch) |
| **Layout** | 4 | `PageHeader` (icon + title + action slot), `RefreshButton`, `TabBar` (pill-style), `UnderlineTabBar` |
| **Filters** | 1 | `FilterSelect` (small inline dropdown) |
| **Forms** | 4 | `FormPanel` (bordered panel), `FormField` (label + error/hint), `FormGrid` (1–4 col responsive), `FormActions` (cancel/submit bar) |
| **Modal** | 1 | `Modal` (centered overlay, body scroll lock, 4 widths: sm/md/lg/xl) |
| **Confirm** | 2 | `ConfirmProvider` + `useConfirm()` hook → `confirm({title, message, variant})` returns `Promise<boolean>` |
| **Cards** | 4 | `Card`, `StatCard` (large KPI), `StatCardSmall` (compact KPI), `InfoCard` (detail field) |
| **Tables** | 4 | `TableWrapper` (scrollable + footer), `THead`, `TH`, `TRow` (hover + selection) |
| **Detail** | 2 | `DetailPanel` (loading/empty states), `DetailHeader` (title + close) |
| **Badges** | 4 | `Badge` (7 variants), `StatusBadge` (16 auto-mapped statuses), `RoleBadge`, `ActiveIndicator` |
| **Roles** | 2 | `ROLE_CONFIG` (10 roles with label/variant/icon/color/bg), `RoleBadge` |
| **Loading** | 4 | `LoadingState`, `Spinner` (3 sizes), `Skeleton`, `EmptyState` |
| **Alerts** | 3 | `Alert` (4 variants, dismissible), `ToastProvider` + `useToast()` (success/error/warning/info, 4s auto-dismiss) |
| **Avatar** | 1 | `Avatar` (initials circle, 3 sizes) |
| **Utils** | 1 | `money(paise, currency?)` → formats to `₹1,500.00` |

**Button variants:** `primary` (emerald), `secondary` (gray), `outline` (border), `ghost` (transparent), `danger` (red), `success` (green)  
**Button sizes:** `xs`, `sm`, `md`, `lg`

### `components/dashboard/DashboardShell.tsx` — 328 lines

Wraps every dashboard page. Provides:
- **Collapsible sidebar** (256px expanded / 72px collapsed) with brand gradient header
- **Navigation** via `getNavForRole()` from `lib/nav-config.ts`
- **Active nav detection** supporting hash-based routes (e.g., `/hr#payroll`)
- **User card** at sidebar bottom with avatar, name, email, logout
- **Mobile drawer** with backdrop overlay
- **Click ripple animation** on nav items (`useRipple` hook)

### `components/dashboard/CreateUserForm.tsx` — 1,063 lines

Reusable multi-step user creation wizard. Used by HR module and Batch Wizard.

**Exports:**

| Export | Type | Purpose |
|--------|------|---------|
| `SUBJECTS` | `string[]` | 7 subjects (Physics, Chemistry, Mathematics, etc.) |
| `GRADES` | `string[]` | Class 1 through Class 12 |
| `BOARDS` | `string[]` | CBSE, ICSE, State Board, IB, Cambridge, Others |
| `GCC_REGIONS` | `string[]` | Dubai, Abu Dhabi, Sharjah, Qatar, Saudi Arabia, etc. |
| `QUALIFICATIONS` | `string[]` | 15 entries (B.Ed, M.Ed, M.Sc, PhD, etc.) |
| `PwdInput` | component | Password input with show/hide toggle |
| `SubjectSelector` | component | Multi-select checkbox dropdown with tag chips |
| `QualificationSelector` | component | Select with "Other" free-text fallback |
| `CredentialsPanel` | component | Post-creation credential display with copy buttons |
| `CreateUserModal` | component | Full wizard: basic → teaching → academic → guardian → notes → review |

**Wizard steps** are dynamic per role — students get `academic` + `guardian` steps; teachers get `teaching` step.

**Features:**
- Debounced 500ms email existence check (`GET /api/v1/hr/users/:email`)
- Student parent auto-creation (creates parent account + sends credentials)
- Embedded mode (flat inline form for batch wizard) vs full overlay mode
- Post-creation `CredentialsPanel` with copy-to-clipboard + "Add Another"

---

## Navigation System (`lib/nav-config.ts` — 214 lines)

### Per-Role Navigation Items

| Role | Items | Routes |
|------|-------|--------|
| **Owner** | 11 | `/owner`, `/owner/batches`, `/owner/academic-operator`, `/owner/teachers`, `/owner/hr`, `/owner/fees`, `/owner/exams`, `/owner/reports`, `/owner#teacher-reports`, `/ghost`, `/owner/system` |
| **Batch Coordinator** | 6 | `/batch-coordinator`, `/batch-coordinator/live`, `/batch-coordinator#batches`, `/batch-coordinator#student-reports`, `/batch-coordinator#leave`, `/batch-coordinator#teacher-reports` |
| **Academic Operator** | 10 | `/academic-operator`, `#students`, `#teachers`, `#batches`, `#student-reports`, `#requests`, `#materials`, `#exam-topics`, `#teacher-reports`, `#demo` |
| **HR** | 10 | `/hr`, `#teachers`, `#coordinators`, `#academic_operators`, `#ghost_observers`, `#cancellations`*, `#attendance`*, `#payroll`*, `#fee_rates`, `#leave_requests` |
| **Teacher** | 11 | `/teacher`, `#profile`, `#batches`, `#schedule`, `#student-reports`, `/teacher/exams`*, `#salary`*, `#ratings`, `#materials`, `#leave`, `#demo` |
| **Student** | 12 | `/student`, `#batches`, `#classes`*, `#sessions`, `#attendance`, `#exams`*, `#reports`, `#homework`, `#fees`*, `#materials`, `#profile`, `#requests` |
| **Parent** | 8 | `/parent`, `#attendance`*, `#exams`*, `#fees`*, `#reports`*, `#monitoring`, `#complaints`*, `#requests` |
| **Ghost** | 5 | `/ghost`, `/ghost` (observe)*, `/ghost/monitor`*, `#batch`*, `#teacher`* |

Items marked * are permission-gated — hidden if `permissions[key] === false`.

### Functions

- `getNavForRole(role, permissions?)` — returns filtered `NavItemConfig[]`
- `resolveActiveNav(items, pathname, hash?)` — determines active nav (hash-based matching for single-page tabs, longest-prefix for sub-routes)

---

## Permission System (`lib/permissions.ts` — 253 lines, `lib/permissions-server.ts` — 33 lines)

### Architecture

```
Owner (implicit all permissions)
  │
  └─→ Sets custom_permissions JSONB per user in portal_users
        │
        └─→ getEffectivePermissions(email, role)
              │
              ├─ if role === 'owner' → return {} (all granted)
              └─ else → merge ROLE_DEFAULTS[role] + customOverrides
```

### Permission Categories (8)

| Category | Permissions |
|----------|-------------|
| **Rooms** | `rooms_create`, `rooms_manage`, `rooms_view` |
| **Users** | `users_create`, `users_edit`, `users_deactivate`, `users_reset_password` |
| **Attendance** | `attendance_view`, `attendance_mark` |
| **Exams** | `exams_create`, `exams_view` |
| **Finance** | `fees_view`, `fees_manage`, `salary_view`, `payroll_manage` |
| **Admissions** | `admissions_manage`, `cancellations_manage` |
| **Reports** | `reports_view` |
| **Ghost** | `ghost_observe` |

### Default Permissions by Role

| Permission | Coordinator | AO | HR | Teacher | Student | Parent | Ghost |
|------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `rooms_create/manage` | ✅/✅ | ✅/✅ | ❌/❌ | ❌/❌ | ❌/❌ | ❌/❌ | ❌/❌ |
| `users_create/edit/deactivate` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `attendance_view/mark` | ✅/✅ | ✅/❌ | ✅/❌ | ✅/✅ | ✅/❌ | ✅/❌ | ❌ |
| `cancellations_manage` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payroll_manage / salary_view` | ❌ | ❌ | ✅/✅ | ❌/✅ | ❌ | ❌ | ❌ |
| `ghost_observe` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `complaints_file` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

Owner can override any permission for any user via the Roles management page.

---

## Inter-Module Communication

### Module Relationship Diagram

```
                    ┌──────────────┐
                    │    Owner     │ ← Full access to all modules
                    │  (implicit)  │   Sets permissions, manages roles
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │      HR      │  │ Academic Op  │  │    Ghost     │
  │  User CRUD   │  │ Batch CRUD   │  │  Observe     │
  │  Attendance  │  │ Sessions     │  │  Monitor     │
  │  Payroll     │  │ Timetables   │  └──────────────┘
  │  Cancellation│  │ Auto-emails  │
  └──────┬───────┘  └──────┬───────┘
         │                 │
         │    ┌────────────┤
         ▼    ▼            ▼
  ┌──────────────┐  ┌──────────────┐
  │ Coordinator  │  │   Teacher    │
  │ Monitor rooms│  │  Classroom   │
  │ Admissions   │  │  Attendance  │
  │ Cancellations│  │  Exam grading│
  └──────────────┘  └──────────────┘
                           │
                    ┌──────┴───────┐
                    ▼              ▼
             ┌──────────┐  ┌──────────┐
             │ Student  │  │  Parent  │
             │ Classes  │  │ Observe  │
             │ Exams    │  │ Fees     │
             │ Profile  │  │ Reports  │
             └──────────┘  └──────────┘
```

### Data Flow Between Modules

| From | To | Mechanism | Data |
|------|----|-----------|------|
| HR → All | User creation | `POST /api/v1/hr/users` | Creates `portal_users` + `user_profiles`, sends credential email |
| HR → Teacher | Password reset | `POST /api/v1/hr/users/[email]/reset-password` | New password + email notification |
| AO → Batch | Batch creation | `POST /api/v1/batches` | Creates batch, assigns teachers/students/coordinator |
| AO → Sessions | Session scheduling | `POST /api/v1/batch-sessions` | Creates individual or recurring sessions |
| AO → LiveKit | Session start | `POST /api/v1/batch-sessions/[id]/start` | Creates LiveKit room, generates join tokens |
| AO → Email | Timetable send | `POST /api/v1/batch-sessions/weekly-timetable` | Sends timetable to all stakeholders |
| AO → Auto | Polling (60s) | `POST /api/v1/batch-sessions/auto-start` | Auto-starts sessions in prep window |
| AO → Auto | Polling (5min) | `POST /api/v1/batch-sessions/daily-timetable` | Sends morning timetable (deduped) |
| AO → Auto | Polling (60s) | `POST /api/v1/batch-sessions/session-reminder` | Sends join links 30min before class |
| Session change → Auto | Timetable update | `scheduleTimetableUpdate()` in `timetable-auto.ts` | Debounced 5s, sends updated timetable to all |
| Coordinator → Monitor | Room status | `GET /api/v1/coordinator/rooms` | Live room monitoring with student join status |
| Teacher → Classroom | LiveKit join | Token-based auth | WebRTC room connection |
| Student → Classroom | LiveKit join | Token-based auth | WebRTC room connection |
| Parent → Observe | Ghost mode | Token-based auth | Silent observation |
| Webhook → Events | LiveKit events | `POST /api/v1/webhook/livekit` | Room started/finished, join/leave tracking |

### Batch–Session–Room Lifecycle

```
Batch (persistent group)
  │
  ├── students[] (enrolled via AO wizard)
  ├── teachers[] (per subject, assigned via AO wizard)
  ├── coordinator (assigned at creation)
  │
  └── Sessions (scheduled classes within batch)
        │
        ├── status: scheduled → live → ended/cancelled
        │
        └── On START:
              ├── Creates LiveKit room (livekit_room_name)
              ├── Generates join tokens for teacher, students, parents, coordinator
              ├── Returns join URLs for distribution
              │
              └── On END:
                    ├── Records attendance (join/leave times, lateness)
                    ├── Collects teacher rating + student feedback
                    └── LiveKit room destroyed
```

---

## 10 Role Dashboards

All dashboards use `DashboardShell` (sidebar + header) and shared components from `shared.tsx`.

### Owner Dashboard — `OwnerDashboardClient.tsx` (1,122 lines)

**Route:** `/owner`  
**Sub-routes:** `/owner/roles` (786), `/owner/batches` (1,856), `/owner/fees` (814), `/owner/reports` (212), `/owner/exams` (481), `/owner/payroll` (381), `/owner/system` (330)

**API:** `GET /api/v1/owner/dashboard` (single call returns all data via 8 parallel queries)

**Layout:**
```
┌─ Greeting banner + Refresh + Notification bell ─────────────────┐
├─ KPI Cards (2×2→4-col): Batches, Live Now, Users, Cancelled 30d│
├─ Status Mini-Cards (4-col): Scheduled, Completed, Live, Cancel  │
├─ Charts Row: Area (30d activity) + Pie (subject distribution)   │
├─ Charts Row: Bar (batches by grade) + Users by Role grid         │
├─ Live Classes Alert (green banner, Ghost View button)            │
├─ Recent Batches Table (search + status filter, 25 rows)          │
├─ Recently Added Users (avatar, role badge, date)                 │
└─ Quick Access Cards: Fees, Reports, HR, Ghost Mode               │
```

**Charts:** Recharts — `AreaChart` (conducted vs cancelled), `PieChart` (subjects), `BarChart` (grades)

**Key features:**
- Auto-heals stale `live` rooms → `ended` on the API side
- Ghost View button links to `/classroom/{id}?mode=ghost` for live rooms
- Quick Access cards link to sub-modules

**Owner Sub-Modules:**

| Sub-route | Client Component | Lines | Purpose |
|-----------|-----------------|------:|---------|
| `/owner/roles` | `RolesClient.tsx` | 786 | Role management — per-user permission toggles, role reassignment |
| `/owner/batches` | `BatchesClient.tsx` | 1,856 | Full batch management (mirrors AO but with owner-level controls) |
| `/owner/fees` | `FeesClient.tsx` | 814 | Fee structure management, invoice generation |
| `/owner/reports` | `ReportsClient.tsx` | 212 | Individual student reports via StudentReportsBrowser |
| `/owner/exams` | `ExamsClient.tsx` | 481 | Exam overview and management |
| `/owner/payroll` | `PayrollClient.tsx` | 381 | Payroll period management, payslip generation |
| `/owner/system` | `SystemClient.tsx` | 330 | System settings, academic config |

---

### HR Dashboard — `HRDashboardClient.tsx` (1,937 lines)

**Route:** `/hr`  
**Tabs:** 11 (Overview, Teachers, Students, Parents, Coordinators, Academic Operators, HR Associates, Ghost Observers, Cancellations*, Attendance*, Payroll*)  
*Permission-gated tabs

**API Endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/hr/stats` | Role headcounts, alerts (students without parents, teachers without subjects) |
| `GET /api/v1/hr/users?role=X&q=Y` | Paginated user list with search |
| `POST /api/v1/hr/users` | Create user (auto-generates password, sends credentials email) |
| `PATCH /api/v1/hr/users/[email]` | Update user profile fields |
| `DELETE /api/v1/hr/users/[email]` | Soft deactivate (default) or permanent delete (`?permanent=true`) |
| `POST /api/v1/hr/users/[email]/reset-password` | Reset password, email new credentials |
| `GET /api/v1/cancellations` | List cancellation requests |
| `POST /api/v1/cancellations` | Approve/reject cancellation (HR is final approver for teacher-initiated) |
| `GET /api/v1/hr/attendance?resource=X&days=Y` | Attendance summary, per-teacher, per-student breakdowns |
| `GET/POST /api/v1/payroll` | Payroll periods, pay configs, payslip generation, finalization |

**Inline Sub-Components (7):**

| Component | Purpose |
|-----------|---------|
| `OverviewTab` | Stats dashboard + monitoring priority banners + role breakdown cards |
| `UsersTab` | Generic user list (reused for all 7 role tabs) — search, filter, CRUD, expandable rows |
| `UserDetailPanel` | Expanded row with all profile fields in `InfoCard` grid |
| `EditUserModal` | Edit form with role-specific fields (subjects for teachers, grade for students, etc.) |
| `ResetPasswordModal` | Password reset with auto-generate option |
| `CancellationsTab` | Cancellation request management with approval chain visualization |
| `AttendanceTab` | Attendance monitoring (7/14/30/60/90-day periods), stacked bar charts, teacher/student tables |
| `PayrollTab` | Payroll periods, pay configs, payslip generation + finalization |

**Key Workflows:**
- **User creation** → `CreateUserModal` opens → multi-step form → `POST /api/v1/hr/users` → credentials email sent → `CredentialsPanel` shown
- **Student creation with parent** → If parent email doesn't exist → auto-creates parent account in same transaction → both get credential emails
- **Cancellation approval chain** → Teacher requests → Coordinator approves → Admin approves → Academic approves → **HR gives final approval**
- **Payroll flow** → Create period → Set per-teacher pay configs → Generate payslips (auto-calculates from attendance) → Finalize → Mark Paid

---

### Academic Operator Dashboard — `AcademicOperatorDashboardClient.tsx` (7,960 lines)

**Route:** `/academic-operator`  
**Tabs:** 10 (Overview, Students, Teachers, Batches, Student Reports, Leave Requests, Materials, Exam Questions, Teacher Reports, Demo)

**The largest component in the codebase — the operational heart of stibe.**

**API Endpoints (20+):**

| Domain | Endpoints |
|--------|-----------|
| Batches | `GET/POST/PATCH/DELETE /api/v1/batches`, `GET /api/v1/batches/[id]`, `GET /api/v1/batches/people` |
| Sessions | `GET/POST/PATCH/DELETE /api/v1/batch-sessions`, `POST /api/v1/batch-sessions/[id]/start` |
| Timetable | `GET/POST /api/v1/batch-sessions/weekly-timetable` |
| Auto-processes | `POST /api/v1/batch-sessions/auto-start`, `daily-timetable`, `session-reminder` |
| People | `GET /api/v1/batches/people`, `GET /api/v1/hr/users` (coordinators, AOs) |
| Settings | `GET /api/v1/academics/settings` |

**Inline Sub-Components (10):**

| Component | Lines | Purpose |
|-----------|------:|---------|
| `OverviewTab` | ~74 | 6 stat cards + live session alert + today's agenda + batch summary |
| `BatchesTab` | ~270 | Batch list table with search/filter, expandable rows, action buttons |
| `WeeklyTimetableModal` | ~246 | Mon–Sat timetable grid, send/update email, stats bar |
| `EditBatchModal` | ~624 | 4-step edit wizard (students → details → teachers → review) |
| `BatchDetailInline` | ~488 | Inline expansion: info, students/parents, sessions grouped by subject |
| `SessionCard` | ~178 | Standalone session card with start/cancel/observe actions |
| `SessionsTab` | ~508 | All sessions table grouped by subject, multi-select bulk cancel, **Calendar View** toggle (FullCalendar month/week/day with drag-drop rescheduling) |
| `EditSessionModal` | ~28+ | Edit session fields (subject, teacher, date, time, duration, topic) |
| `TimePicker12` | ~25 | 12-hour time picker (Hour × Minute × AM/PM selects) |
| `ScheduleSessionModal` | ~773 | **Schedule Wizard** — the recurring session scheduling engine |

**Batch Templates (4 types):**

| Type | Label | Max Students |
|------|-------|:---:|
| `one_to_one` | One-to-One | 1 |
| `one_to_three` | One-to-Three | 3 |
| `one_to_many` | Classroom | 15 |
| `custom` | Custom | 999 |

**CreateBatchWizard (5 steps):**

```
template → students → details → teachers → review
   │          │          │          │          └─ Summary, confirm create
   │          │          │          └─ Subject toggle chips + per-subject teacher dropdown
   │          │          └─ Grade (auto-section), name, board, coordinator, AO, notes
   │          └─ Student search/select, parent linking, "Add Parent" modal
   └─ 4 batch type cards (One-to-One / One-to-Three / Classroom / Custom)
```

- Grade selection auto-assigns next available section (skips sections used by other batches)
- Batch name auto-generated: `"Class {grade} {section}"`
- Teacher dropdown filtered by subject competency (from `user_profiles.subjects[]`)
- Parent creation opens embedded `CreateUserModal` → auto-links parent to student via `PATCH /api/v1/hr/users/[email]`

**ScheduleSessionModal (Schedule Wizard, 4–5 steps):**

```
[batch] → class → schedule → details → review
   │        │        │          │         └─ Summary + participant list
   │        │        │          └─ Topic + notes (optional)
   │        │        └─ Date, time (12h), duration (6 presets), recurring toggle
   │        └─ Subject dropdown, teacher auto-select (override option)
   └─ Batch picker (only if no batch pre-selected)
```

**Recurring scheduling:**
- Select weekdays (Mon–Sun toggle buttons)
- Unit: Weeks (1–24) or Months (1–12)
- `getDatesForDays()` generates all dates
- Preview shows all generated dates
- Submit loops through dates, creating one session per date via separate `POST` calls
- Reports created/failed counts

**Conflict detection:**
- Fetches existing sessions for the batch on mount
- `findAvailableTime()` auto-adjusts start time to avoid overlaps
- Shows warning banner if manual time creates conflict

**Background Auto-Processes (3 polling effects):**

| Process | Interval | Endpoint | Purpose |
|---------|----------|----------|---------|
| Auto-start | 60s | `POST /api/v1/batch-sessions/auto-start` | Starts sessions when prep window opens |
| Daily timetable | 5 min | `POST /api/v1/batch-sessions/daily-timetable` | Morning timetable email (deduped) |
| Session reminders | 60s | `POST /api/v1/batch-sessions/session-reminder` | Sends join links 30min before class |

**Timetable Auto-Send (`lib/timetable-auto.ts` — 219 lines):**
- Triggered after session changes (create/edit/cancel)
- Debounced 5 seconds per batch_id (prevents spam during bulk operations)
- Derives weekly pattern from all sessions → sends `weeklyTimetableTemplate()` email
- Fire-and-forget (errors logged, never blocks API response)

---

### Batch Coordinator Dashboard — `CoordinatorDashboardClient.tsx` (1,251 lines)

**Route:** `/batch-coordinator`  
**Tabs:** 6 (Overview, Live Monitor, Batches, Student Reports, Leave Requests, Teacher Reports)  
**Sub-routes:** `/batch-coordinator/live` (Live Monitor), `/batch-coordinator/admissions` (AdmissionsClient), `/batch-coordinator/cancellations` (CancellationsClient)

**Role:** Monitoring-focused (not creation). Watches live rooms, tracks student join status, handles admissions and cancellations.

**Features:**
- Room card list with status filter + search
- Expandable cards showing assigned students' join/leave status
- Stats: total rooms, live, scheduled, ended
- Links to Admissions and Cancellations sub-routes

**Coordinator vs Academic Operator:**

| Aspect | Coordinator | Academic Operator |
|--------|-------------|-------------------|
| Primary function | **Monitor** rooms, admissions, cancellations, reports | **Create & manage** batches, schedule sessions, exams |
| Component size | 1,251 lines | 7,960 lines |
| Batch creation | ❌ | ✅ Full wizard |
| Session scheduling | ❌ | ✅ Recurring scheduler |
| Room observation | ✅ | ✅ |
| Admissions | ✅ Dedicated sub-route | ✅ Permission exists |
| Cancellations | ✅ Dedicated sub-route | ❌ |

Both are linked via `batches` table: `coordinator_email` + `academic_operator_email` columns.

---

### Teacher Dashboard — `TeacherDashboardClient.tsx` (2,711 lines)

**Route:** `/teacher`  
**Tabs:** 11 (Overview, My Profile, My Batches, Schedule, Student Reports, Exams, Salary, Ratings, Materials, Leave Requests, Demo)  
**Sub-routes:** `/teacher/exams` (466 lines)

**Features:**
- Live class join banner with countdown
- Today's schedule timeline
- Stats: live rooms, upcoming, completed, total hours
- Class list with status filter + search, expandable detail rows
- Profile tab with personal info + avatar upload
- Salary tab (permission-gated): earnings overview
- Exam management: create exams, enter marks, publish results
- Student Reports: browse student reports by batch via `StudentReportsBrowser`
- Teacher ratings from students
- Materials: read-only view of assigned teaching materials
- Leave request submission
- Demo session management: accept/reject/start demos

---

### Student Dashboard — `StudentDashboardClient.tsx` (3,397 lines)

**Route:** `/student`  
**Tabs:** 12 (Dashboard, Batches, Classes, Sessions, Attendance, Exams, Reports, Homework, Fees, Materials, Profile, Requests)  
**Sub-routes:** `/student/exams/[id]` (TakeExamClient, 420 lines)

**Features:**
- Live class join button with countdown
- Payment status alerts
- Stats: upcoming classes, completed, total hours
- Class list with search + expandable detail
- Batch list with subject breakdown
- Session timeline
- Attendance tracking with present/late/absent stats
- Exam results and history
- Comprehensive student reports (daily/weekly/overall) via `StudentReportsTab`
- Homework submissions
- Fee ledger + payment history
- Teaching materials (read-only)
- Profile tab with avatar
- Session change requests

---

### Parent Dashboard — `ParentDashboardClient.tsx` (1,686 lines)

**Route:** `/parent`  
**Tabs:** 8 (Dashboard, Attendance, Exams, Fee Ledger, Reports, AI Monitoring, Complaints, Requests)

**Features:**
- Child's class schedule + live class observe button
- Attendance tracking with present/late/absent stats
- Exam results viewing
- Fee ledger + payment history + PDF receipt download
- Per-child detailed student reports (daily/weekly/overall) via `StudentReportsTab`
- AI monitoring overview per child
- Complaint filing system
- Session change requests

---

### Ghost Dashboard — `GhostDashboardClient.tsx` (379 lines)

**Route:** `/ghost`  
**Tabs:** 5 (Dashboard, Observe, Oversight, By Batch, By Teacher)  
**Sub-routes:** `/ghost/monitor` (GhostMonitorClient)

**Features:**
- Live room list with "Observe Silently" buttons
- Upcoming rooms list
- Multi-room monitor grid (`/ghost/monitor`) with 30s auto-refresh

---

### Dev Dashboard — `dev/page.tsx` (380 lines)

**Route:** `/dev` (blocked in production)

**Features:**
- Role launcher (quick-switch to any dashboard)
- Health panel (DB, Redis, LiveKit connectivity test)
- LiveKit room test
- Token generation for testing

---

## Build Status

| Step | Name | Spec Doc | Status |
|------|------|----------|--------|
| 01 | Project Setup | `01_PROJECT_SETUP.md` | ✅ Complete |
| 02 | Database Schema | `02_DATABASE_SCHEMA.md` | ✅ Complete (66+ tables, 43 migrations) |
| 03 | Auth & Sessions | `03_MOCK_AUTH.md` | ✅ Complete (DB-based bcrypt, forgot-password OTP) |
| 04 | API Routes | `04_API_ROUTES.md` | ✅ Complete (152 routes) |
| 05 | Email System | `05_EMAIL_SYSTEM.md` | ✅ Complete (33+ templates, SMTP + queue, payment/payroll emails) |
| 06 | Payment Gateway | `06_PAYMENT_GATEWAY.md` | ✅ Complete (fee structures, invoices, receipts, PDF generation) |
| 07 | Room Lifecycle | `07_ROOM_LIFECYCLE.md` | ✅ Complete (auto-exit, warnings, join rejection, selective end) |
| 08 | Coordinator Workflow | `08_COORDINATOR_WORKFLOW.md` | ✅ Complete (monitoring, admissions, cancellations, go-live approval, heartbeat) |
| 09 | Join Flow | `09_JOIN_FLOW.md` | ✅ Complete (PreJoin lobby, camera preview) |
| 10 | Teacher Classroom | `10_TEACHER_CLASSROOM.md` | ✅ Complete (LiveKit, Go Live, controls, chat, exam controls) |
| 11 | Whiteboard Overlay | `11_WHITEBOARD_OVERLAY.md` | ✅ Complete (two-device setup, MediaPipe) |
| 12 | Student View | `12_STUDENT_VIEW.md` | ✅ Complete (fullscreen, auto-hiding overlay, inline exam) |
| 13 | Ghost Mode | `13_GHOST_MODE.md` | ✅ Complete (silent observe, multi-room monitor, audit log) |
| 14 | Test Dashboards | `14_TEST_DASHBOARDS.md` | ✅ Dev dashboard with role launcher |
| — | HR Module | (additional) | ✅ Full CRUD, payroll, attendance, cancellations, fee rates, leave requests |
| — | Academic Operator | (additional) | ✅ Batches, sessions, timetables, auto-processes, students, teachers, materials, exam topics, demo |
| — | Owner Module | (additional) | ✅ Dashboard, roles, batches, fees, exams, payroll, system, teacher reports |
| — | Permission System | (additional) | ✅ RBAC with owner overrides |
| — | Batch Management | (additional) | ✅ CRUD, multi-subject, recurring schedule |
| — | Exam System | (additional) | ✅ Create, take (learner's test style), grade, publish, highlights |
| — | **Live Session Exams** | (additional) | ✅ **Complete** — Teacher generates AI questions during class, sends to students, anti-cheat (tab detection, screenshot prevention, fullscreen enforcement, watermark, violation recording), timed exam, auto-grading |
| — | **AI Exam Generation** | (additional) | ✅ **Complete** — Groq Cloud API (text + vision), PDF→page images→question extraction, QP/topic modes, generation progress polling, cancel support, question viewer with solution steps |
| — | Payment & Fees | (additional) | ✅ Fee structures, invoices, receipts, PDF generation, session rates, extra-time billing |
| — | Timetable System | (additional) | ✅ Weekly Mon–Sat, auto-send, manual send |
| — | Attendance Tracking | (additional) | ✅ Join/leave, media events, attention reports, mark absent, reminders |
| — | WhatsApp Integration | (additional) | ✅ Meta Cloud API, 29 templates, auto-mirror from email, standalone sends |
| — | Teacher Flutter App | (additional) | ✅ **Complete** — Login, dashboard, screen share, materials (Samsung Notes edit), sessions, batches, leave, profile edit, bottom nav, deep links, forgot password |
| — | **Demo Session System** | (additional) | ✅ **Complete** — registration, teacher accept+scheduling, live class, exam, summary, notifications |
| — | **Teaching Materials Library** | (additional) | ✅ **Complete** — multi-batch assignment, edit support, library model |
| — | **Leave & Session Requests** | (additional) | ✅ **Complete** — teacher/coordinator leave requests with multi-level approval (AO→HR→Owner), per-session management (substitute/cancel/reschedule), session change requests (reschedule/cancel), email+WhatsApp notifications |
| — | **Student Reports** | (additional) | ✅ **Complete** — Comprehensive daily/weekly/overall reports with exam summaries, attendance by subject, AI monitoring behavior breakdown, recharts trend graphs. Available across all dashboards (Student, Teacher, BC, AO, Owner, Parent) via `StudentReportsTab` + `StudentReportsBrowser` |
| — | **Teacher Reports** | (additional) | ✅ **Complete** — Teacher performance reports with ratings, session history. `TeacherReportsTab` component available across dashboards |
| — | **AI Monitoring** | (additional) | ✅ **Complete** — MediaPipe FaceLandmarker attention detection, blendshape analysis, tab/inactivity tracking, coordinator live view, parent monitoring dashboard, behavior event recording |
| — | **Session Extension** | (additional) | ✅ **Complete** — Per-student selective time extension, fee calculation, invoice generation, coordinator approval chain |

---

## Teaching Materials System

**Purpose:** Academic Operators upload study resources (PDFs, documents, images) that are shared with students and teachers via batch assignments. Materials live in a central library and can be assigned to multiple batches simultaneously.

### Architecture: Library + Multi-Batch Assignment

```
┌─────────────────────┐         ┌──────────────────────────────┐
│ teaching_materials   │────────▸│ material_batch_assignments   │
│                     │  1:N    │                              │
│ id (UUID PK)        │         │ material_id (FK)             │
│ subject             │         │ batch_id    (FK → batches)   │
│ title               │         │ assigned_at                  │
│ description         │         │ assigned_by                  │
│ file_url            │         └──────────────────────────────┘
│ file_name           │
│ material_type       │   Upload once → assign to many batches
│ uploaded_by         │   Deleting batch removes assignment only
│ created_at          │   Deleting material cascades to all assignments
│ updated_at          │
│ file_size / mime    │
└─────────────────────┘
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/teaching-materials` | List materials (role-scoped: teacher sees their batches, student sees enrolled, AO sees own uploads, owner sees all). Supports `?batch_id=` filter. Returns `batches[]` array per material. |
| POST | `/api/v1/teaching-materials` | Upload file + metadata. Accepts `batch_ids` (JSON array) for multi-batch assignment. Max 50 MB. |
| PATCH | `/api/v1/teaching-materials` | Update title, description, type, and batch assignments. Full replace of assignments. |
| DELETE | `/api/v1/teaching-materials?id=` | Delete material + file from disk. Junction rows cascade. |

### Key Features

- **Multi-batch assignment:** Upload a material once, assign to any number of batches
- **Smart batch selector:** "Select all", "Clear", and "Select [subject] batches" shortcuts
- **Edit support:** Update title, description, type, and batch assignments after upload
- **Type filter:** Notes, Assignment, Resource, Video, Other
- **Batch pills:** Material cards show all assigned batch names as pills
- **Backward compatible:** API returns `batch_name`/`batch_id` for Flutter tablet app compatibility

### Files

| File | Purpose |
|------|---------|
| `migrations/021_materials_library.sql` | Junction table migration + data migration from old single-batch FK |
| `app/api/v1/teaching-materials/route.ts` | GET/POST/PATCH/DELETE handlers with junction table queries |
| `AcademicOperatorDashboardClient.tsx` → `MaterialsTab` | Full CRUD: upload with multi-batch, edit modal, delete, filters |
| `TeacherDashboardClient.tsx` → `TeacherMaterialsTab` | Read-only: multi-batch pills, subject/type filters |
| `StudentDashboardClient.tsx` → `StudentMaterialsTab` | Read-only: multi-batch pills, batch/type filters |

---

## Demo Session System

**Purpose:** Allows prospective students to book a free one-on-one demo class, experience the live classroom, and be converted to enrolled students.

### End-to-End Flow

```
Student visits /demo/[linkId]
       │
       ├─ Fills registration form (name, email, phone, grade, topics)
       ├─ System auto-matches available teacher  
       └─ Teacher gets notified (email + WhatsApp)
               │
               ├─ Teacher opens TeacherDemoTab → picks comfortable time → Accept
               └─ System creates LiveKit room, notifies student + AO (email + WhatsApp)
                       │
                       ├─ Scheduled time − 5min: Teacher sees countdown + "Start Demo" button
                       ├─ Teacher clicks Start Demo → enters classroom, clicks GO LIVE
                       └─ Student joins via /join/[roomId]?token=...
                               │
                               ├─ Live class (whiteboard optional, no tablet required)
                               ├─ AI attention monitoring active
                               └─ Teacher ends session directly (no coordinator approval needed)
                                       │
                                       ├─ Optional: demo exam (grade-aware questions)
                                       ├─ Student feedback (1–5 ★ rating)
                                       ├─ Summary notifications: teacher + AO + student (email + WhatsApp)
                                       └─ Student closes → redirected to /login (not student dashboard)
```

### Demo-Specific API Routes (7)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/demo/[linkId]` | GET, POST | Fetch demo link info; student registration |
| `/api/v1/demo/requests` | GET, POST, PATCH | List requests; submit; accept/reject/cancel/assign |
| `/api/v1/demo/available-teachers` | GET | Find available teachers for auto-match |
| `/api/v1/demo/check-email` | GET | Check if student email already exists in portal |
| `/api/v1/demo/send-link` | POST | AO generates and sends demo link via WhatsApp |
| `/api/v1/demo/exam` | GET, POST | Fetch demo exam questions; submit answers |
| `/api/v1/demo/summary/[roomId]` | GET | Full post-session summary (attendance, AI, exam, feedback) |

### Database Tables

| Table | Migration | Purpose |
|-------|-----------|---------|
| `demo_requests` | `013_demo_system.sql` | Core demo request record: student info, teacher, AO, status, scheduled_start, room_id, outcome |
| `demo_exam_results` | `014_demo_exam_results.sql` | Per-question exam results; grade letter; linked to demo_request |

**`demo_requests` status flow:**
```
submitted → pending_teacher → accepted → live → completed / completed_with_exam
                           └→ rejected
          └→ cancelled  (AO action at any stage)
```

### Key Source Files

| File | Lines | Purpose |
|------|------:|---------|
| `app/demo/[linkId]/page.tsx` | ~280 | Student registration page (mobile-first, IST time display) |
| `app/demo-exam/[demoRequestId]/page.tsx` | ~350 | In-browser demo exam UI |
| `app/(portal)/classroom/[roomId]/ended/page.tsx` | ~504 | Post-session screen: feedback for regular students, close+login for demo students |
| `components/dashboard/TeacherDemoTab.tsx` | ~551 | Teacher demo management: pending list, countdown, accept with time picker, inline rich summary |
| `components/dashboard/DemoTab.tsx` | ~1,100 | AO demo management: leads table, student details, convert to enrolled, send link, bulk delete |
| `lib/demo-summary.ts` | ~383 | `collectDemoSummary()` aggregates all session data; `sendDemoSummaryNotifications()` |
| `app/api/v1/demo/requests/route.ts` | ~593 | PATCH: accept (time picker, notify student+AO), reject, cancel, assign teacher |
| `app/api/v1/demo/exam/route.ts` | ~270 | Grade-aware question generation (8 subjects × 4 grade bands); score + grade letter |
| `app/api/v1/demo/summary/[roomId]/route.ts` | 61 | Auth-gated summary data endpoint for dashboard |

### Email & WhatsApp Templates (Demo-specific)

| Template / WA Template | Direction | Trigger |
|------------------------|-----------|---------|
| `demoWaitingTemplate` / `stibe_demo_waiting` | → Student | Demo registered, searching for teacher |
| `demoStudentAcceptedTemplate` / `stibe_demo_confirmed` | → Student | Teacher accepted; includes IST time + join link |
| `demoAOAcceptedTemplate` / `stibe_alert` | → AO | Teacher accepted; includes teacher/student/time summary |
| `demoStudentRejectedTemplate` / `stibe_alert` | → Student | Demo rejected or cancelled |
| `demoSummaryTeacherTemplate` | → Teacher | Post-session: attendance, AI score, exam result, feedback |
| `demoSummaryAOTemplate` | → AO | Post-session: full report with outcome tag |
| `demoSummaryStudentTemplate` | → Student | Post-session: thank you + exam result |

### Category & Grading System

| Exam % | Grade Letter | Student Category |
|--------|-------------|-----------------|
| ≥90% | A+ | A |
| ≥75% | A | A |
| ≥60% | B+ | B |
| ≥45% | B | B |
| ≥30% | C+ | C |
| <30% | C | C |

Category is stored on `demo_requests.exam_grade` and used when converting lead → enrolled student via AO dashboard.

### Session Duration Tracking

- Primary: `attendance_sessions.total_duration_sec` (updated when participant leave event fires)
- Fallback: `first_join_at → ended_at` (used when leave events didn't fire before summary collection)
- Room `go_live_at` used as secondary fallback if `first_join_at` is null
- Summary webhook fires 15s after room ends (giving attendance records time to settle)

### Demo Classroom Behaviour (vs Regular)

| Aspect | Regular Session | Demo Session |
|--------|----------------|-------------|
| Tablet required | Yes (whiteboard) | Optional |
| GO LIVE requires students | Yes (`students.length > 0`) | No (0 students allowed) |
| Teacher can end directly | No (needs coordinator) | Yes (logged as `demo_ended_by_teacher`) |
| Post-session screen | Attendance + feedback form → dashboard | Feedback form → `/login` |
| AO approval to end | Required | Bypassed |

### AO Dashboard — Demo Leads Tab

- Lists all demo requests with status filter
- Shows student details, subject, grade, teacher name, scheduled time, outcome
- Category badge derived from `exam_grade` (A+/A → Cat A, B+/B → Cat B, C+/C → Cat C)
- Actions: View Details, Convert to Student (pre-fills CreateUserModal), Send Demo Link via WhatsApp, Bulk Delete
- Converts lead → enrolled student: opens batch wizard pre-filled with grade + category
- Batch wizard student list filtered by both grade AND category

### Teacher Dashboard — Demo Sessions Tab

- Lists pending demo requests with student info
- Accept opens time picker modal (no auto-navigate to classroom)
- Accepted sessions show live countdown; "Start Demo" button appears 5 minutes before
- Completed sessions show expandable inline summary:
  - Session overview (outcome, duration, scheduled/ended times)
  - Student details (name, email, phone, grade, topics)
  - Attendance (join/leave IST times, time in class, late indicator)
  - AI monitoring (attention score bar, per-category breakdown, alerts)
  - Exam results (score, grade, per-question breakdown)
  - Student feedback (stars, text, tags)

---

## Live Session Exam System

**Purpose:** Teachers generate AI-powered MCQ exams during live classes and push them to students in real-time. Includes full anti-cheat enforcement, timed questioning, auto-grading, and comprehensive result tracking.

### Teacher Flow (in TeacherView)

```
Teacher clicks Exam button (control bar)
       │
       ├─ SessionExamDialog opens → Pick source:
       │     ├─ QP (question paper) → select topic → generate from QP
       │     ├─ Topic → select topic → choose count → generate
       │     └─ Material → select material → generate
       │
       ├─ AI generates questions (Groq Cloud API): progress bar with 5 stages
       │     ├─ Querying → Extracting → Generating → Parsing → Ready
       │     └─ Cancel button available during generation
       │
       ├─ Questions ready → Teacher clicks "Start Exam"
       │     ├─ Sends exam data via LiveKit data channel to all students
       │     ├─ question_count, time_per_question (60s), questions
       │     └─ Teacher sees live student progress
       │
       └─ Exam ends → Results fetched → Summary displayed
```

### Student Flow (inline in StudentView)

```
Student receives exam via data channel
       │
       ├─ Fullscreen overlay (z-300) renders over classroom
       │     ├─ Camera stays on (anti-cheat enforcement)
       │     ├─ 60-second timer per question
       │     └─ Sequential question flow (no skip, no back)
       │
       ├─ Anti-cheat monitoring:
       │     ├─ Tab switch detection → recorded as violation
       │     ├─ Screenshot prevention (blur on tab switch)
       │     ├─ Fullscreen enforcement
       │     ├─ Watermark overlay with student name
       │     └─ Violations stored in `session_exam_results`
       │
       ├─ Student answers all questions → auto-submit
       │     └─ POST /api/v1/session-exam (grades answers server-side)
       │
       └─ beforeunload guard prevents accidental exit
              └─ navigator.sendBeacon fallback for partial submissions
```

### Key Files

| File | Purpose |
|------|---------|
| `components/classroom/SessionExamDialog.tsx` (187) | Teacher exam source picker + generation UI |
| `components/classroom/TeacherView.tsx` (exam section) | Exam button, data channel send, live progress |
| `components/classroom/StudentView.tsx` (exam section) | Inline exam overlay, anti-cheat, timer, submission |
| `app/api/v1/session-exam/route.ts` | Student-facing: serve questions, grade answers |
| `app/api/v1/session-exam/results/route.ts` | Fetch exam results |
| `app/api/v1/room/[room_id]/exams/route.ts` | In-room exam management |
| `migrations/045_exam_violations.sql` | Violation recording schema |

---

## AI Exam Question Generation (Groq Cloud API)

**Purpose:** Upload question papers (PDFs) or specify topics, and AI generates MCQ questions with answers and solution steps using Groq's LLM-as-a-service.

### Architecture

```
Upload PDF / Select Topic
       │
       ├─ PDF mode:
       │     ├─ pdf-parse extracts text (if searchable)
       │     ├─ sharp converts pages to images
       │     ├─ Groq Vision API (Scout model) extracts questions from images
       │     └─ Groq Text API generates MCQ options + answers + solution steps
       │
       ├─ Topic mode:
       │     ├─ User selects Grade → Board → Subject → Chapter → Topic
       │     ├─ curriculum-data.ts provides CBSE/ICSE/ISC/State Board reference
       │     └─ Groq Text API generates MCQs from topic description
       │
       └─ Output: session_exam_questions rows with:
             question_text, options[], correct_answer, difficulty, marks, solution_steps, image_url
```

### API Endpoints

| Route | Purpose |
|-------|---------|
| `POST /api/v1/session-exam-topics` | Upload topic with PDF files |
| `POST /api/v1/session-exam-topics/generate` | Start async AI generation (fire-and-forget) |
| `POST /api/v1/session-exam-topics/generate/cancel` | Cancel in-progress generation |
| `GET /api/v1/session-exam-topics/questions` | View generated questions |
| `GET /api/v1/session-exam-topics/questions/steps` | Get solution steps |

### Key Files

| File | Lines | Purpose |
|------|------:|---------|
| `lib/ai-exam-generator.ts` | 841 | Groq vision+text pipeline, PDF→image, MCQ parsing |
| `lib/curriculum-data.ts` | 896 | CBSE/ICSE/ISC/State Board chapters & topics per grade |
| `lib/exam-notifications.ts` | 117 | Exam notification helpers |
| `migrations/040_exam_topic_files.sql` | Multi-file upload per topic |
| `migrations/041_exam_topic_categorization.sql` | Board, category, chapter, topic fields |
| `migrations/042_generation_progress.sql` | Progress tracking (status, progress fields) |
| `migrations/043_question_image_url.sql` | Image URL on questions |
| `migrations/044_question_solution_steps.sql` | Solution steps on questions |

---

## Student Reports System

**Purpose:** Comprehensive daily/weekly/overall student reports aggregating exam results, attendance by subject, and AI monitoring behavior breakdown. Available across all 6 role dashboards.

### Architecture

```
GET /api/v1/student-reports?email=...&period=daily|weekly|overall
       │
       ├─ Queries:
       │     ├─ session_exam_results → exam_summary (total, avg_score, grade_distribution)
       │     ├─ attendance_sessions → attendance_summary (by_subject: present, late, absent, hours)
       │     ├─ class_monitoring_events → monitoring_summary (behavior breakdown by event type)
       │     ├─ monitoring_alerts → alert breakdown (by severity)
       │     └─ daily_trend → combined metrics per day for trend charts
       │
       ├─ Period windows:
       │     ├─ daily   → today
       │     ├─ weekly  → last 7 days
       │     └─ overall → last 90 days
       │
       └─ Role access control:
             ├─ student → own reports only
             ├─ teacher → students in their batches
             ├─ batch_coordinator → students in their batches
             ├─ academic_operator, owner, hr → all students
             └─ parent → children via batch_students.parent_email check
```

### Components

| Component | Lines | Purpose |
|-----------|------:|---------|
| `StudentReportsTab.tsx` | 522 | Reusable 4-section report view (Overview/Exams/Attendance/AI Monitor) with recharts AreaChart, BarChart, MiniStat color boxes, period selector |
| `StudentReportsBrowser.tsx` | 177 | 3-level drill-down picker: batch list → student list (with search) → StudentReportsTab |

### Dashboard Integration

| Dashboard | How integrated |
|-----------|----------------|
| Student | Direct `<StudentReportsTab>` on #reports tab |
| Teacher | `<StudentReportsBrowser>` on #student-reports tab (fetches `/api/v1/teacher/my-batches`) |
| Batch Coordinator | `<StudentReportsBrowser>` on #student-reports tab |
| Academic Operator | `<StudentReportsBrowser>` on #student-reports tab |
| Owner | `<StudentReportsBrowser>` in `/owner/reports` page |
| Parent | Per-child `<StudentReportsTab>` within #reports tab |

### AI Monitoring Behavior Labels (9 types)

| Event Type | Label | Color |
|------------|-------|-------|
| `attention_low` | Low Attention | Red |
| `attention_high` | High Attention | Green |
| `tab_switched` | Tab Switch | Orange |
| `tab_returned` | Tab Return | Blue |
| `looking_away` | Looking Away | Amber |
| `inactivity` | Inactivity | Gray |
| `multiple_faces` | Multiple Faces | Purple |
| `no_face` | No Face | Red |
| `yawning` | Yawning | Yellow |

---

## AI Classroom Monitoring System

**Purpose:** Real-time student behavior monitoring during live classes using MediaPipe FaceLandmarker for attention tracking, face detection, and anomaly alerts. Integrates with coordinator dashboards, parent reports, and automated alert emails.

### Architecture

```
Student browser (StudentView.tsx)
       │
       ├─ useAttentionMonitor hook (604 lines)
       │     ├─ MediaPipe FaceLandmarker (68 blendshapes)
       │     ├─ Runs every 600ms (configurable)
       │     └─ Detects:
       │           ├─ Attention level (eye blendshapes: eyeSquint, eyeBlink)
       │           ├─ Looking away (head rotation via transform matrix)
       │           ├─ Multiple faces / no face
       │           ├─ Yawning (jawOpen blendshape > 0.3)
       │           └─ Inactivity (mouse/keyboard idle > 60s)
       │
       ├─ Tab tracking
       │     ├─ visibilitychange → tab_switched / tab_returned events
       │     └─ Records timestamp + duration
       │
       └─ Events batched & posted:
             POST /api/v1/monitoring/events
                    │
                    ├─ lib/monitoring.ts (631 lines) — event processing, storage
                    ├─ Aggregated into monitoring sessions
                    └─ Threshold-based alert generation:
                          POST /api/v1/monitoring/alerts
                          │
                          └─ lib/monitoring-reports.ts (787 lines) — report generation
```

### Event Types

| Event Type | Detection Method | Threshold |
|------------|-----------------|-----------|
| `attention_high` | Eye blendshapes + face forward | Sustained 3s+ |
| `attention_low` | Low eye openness + head down | Sustained 3s+ |
| `looking_away` | Head rotation angle > 30° | 2s+ duration |
| `tab_switched` | `visibilitychange` API | Immediate |
| `tab_returned` | `visibilitychange` API | Immediate |
| `multiple_faces` | FaceLandmarker face count > 1 | Immediate |
| `no_face` | FaceLandmarker face count = 0 | 3s+ sustained |
| `yawning` | `jawOpen` blendshape > 0.3 | Immediate |
| `inactivity` | No mouse/keyboard events | 60s timeout |

### Key Files

| File | Lines | Purpose |
|------|------:|---------|
| `hooks/useAttentionMonitor.ts` | 604 | MediaPipe FaceLandmarker + blendshape analysis + event dispatch |
| `lib/monitoring.ts` | 631 | Event storage, session aggregation, threshold alerts |
| `lib/monitoring-reports.ts` | 787 | Report generation, per-student analysis, trend computation |
| `lib/contact-detection.ts` | 166 | Contact info sharing detection in chat messages |
| `lib/early-exit-alert.ts` | 131 | Early session exit detection + parent/AO email alerts |

### Dashboard Integration

| Dashboard | Component | Purpose |
|-----------|-----------|---------|
| BC (`CoordinatorLiveView`) | AI monitor panel | Live attention scores + alerts for all students in session |
| Student (`StudentReportsTab`) | AI Monitor section | Personal behavior breakdown + trends |
| Parent (`StudentReportsTab`) | AI Monitor section | Child's behavior + attention metrics |
| Owner/AO/Teacher | `StudentReportsBrowser` | Drill-down to any student's AI monitoring reports |

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/monitoring/events` | GET, POST | Store/retrieve behavior events |
| `/api/v1/monitoring/alerts` | GET, POST | Generate/retrieve behavior alerts |
| `/api/v1/monitoring/reports` | GET, POST | Generate comprehensive monitoring reports |
| `/api/v1/monitoring/reports/[reportId]` | GET | Individual report detail |
| `/api/v1/monitoring/session/[roomId]` | GET | Per-session monitoring data |
| `/api/v1/attention` | GET | Legacy attention data endpoint |

---

## Teacher Reports System

**Purpose:** Track teacher performance via student ratings, session history, and class metrics. Available across Owner, BC, AO dashboards.

### Component

| File | Lines | Purpose |
|------|------:|---------|
| `TeacherReportsTab.tsx` | 371 | Teacher performance view with ratings summary, session metrics |

### API

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/teacher-reports` | GET, POST | Teacher performance report data |
| `/api/v1/teacher/ratings` | GET | Teacher ratings from students |

---

## Auth System

- **Login**: PostgreSQL DB auth via `lib/auth-db.ts` — bcrypt hash comparison
- JWT sessions via `jose` (HS256, 8-hour expiry, httpOnly cookie `stibe-session`)
- **HR creates users** with generated passwords; users receive credentials by email
- Proxy route protection with role-based access control (`proxy.ts`)
- Owner role bypasses all route restrictions

**Auth APIs:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/login` | POST | Authenticate via `portal_users` (bcrypt) |
| `/api/v1/auth/logout` | POST | Clear session cookie |
| `/api/v1/auth/me` | GET | Return current user from JWT |

**Portal Roles (10):**

| Portal Role | Dashboard Route | Nav Items |
|-------------|----------------|:---------:|
| `owner` | `/owner` | 11 |
| `batch_coordinator` | `/batch-coordinator` | 6 |
| `academic_operator` | `/academic-operator` | 10 |
| `hr` | `/hr` | 10 |
| `teacher` | `/teacher` | 11 |
| `student` | `/student` | 12 |
| `parent` | `/parent` | 8 |
| `ghost` | `/ghost` | 5 |
| `teacher_screen` | (internal — tablet device) | — |
| `academic` | → `/academic-operator` (legacy alias) | — |

**Test Accounts (password `Test@1234`):**

| Email | Role | Name |
|-------|------|------|
| `stibelearningventures@gmail.com` | owner | Admin Owner |
| `official4tishnu@gmail.com` | coordinator | Seema Verma |
| `dev.poornasree@gmail.com` | academic_operator | Dr. Mehta |
| `tech.poornasree@gmail.com` | hr | Ayesha Khan |
| `abcdqrst404@gmail.com` | teacher | Priya Sharma |
| `official.tishnu@gmail.com` | student | Rahul Nair |
| `idukki.karan404@gmail.com` | parent | Nair P. |
| `info.pydart@gmail.com` | ghost | Nour Observer |

---

## Database

**66 tables** across 43 migrations on PostgreSQL 15:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `portal_users` | 002 | User accounts: email (PK), `full_name`, `portal_role`, `password_hash`, `is_active`, `custom_permissions` JSONB |
| `user_profiles` | 004 | Extended profile: phone, subjects TEXT[], grade, board, parent_email, qualification, etc. |
| `batches` | 018 | Batch groups: name, type, grade, section, subjects, coordinator, AO, max_students, status |
| `batch_students` | 018 | Batch enrollment: student_email, parent_email, added_at |
| `batch_teachers` | 019 | Batch teacher assignments: teacher_email, subject, is_primary |
| `batch_sessions` | 021 | Scheduled sessions: subject, teacher, date, time, duration, status, livekit_room_name, schedule_group_id |
| `rooms` | 001 | Class room records (legacy — now sessions are primary) |
| `room_events` | 001 | Event log (created, started, ended, joined, left, etc.) |
| `room_assignments` | 001 | Teacher/student assignments with join_token |
| `attendance_sessions` | 006 | Attendance records: join/leave times, late detection |
| `attendance_logs` | 006 | Detailed join/leave/rejoin timeline |
| `email_log` | 001 | Email delivery tracking (12+ template types) |
| `payment_attempts` | 001 | Payment records |
| `fee_structures` | 009 | Fee configurations per grade/board |
| `invoices` | 010 | Student invoices with line items; `schedule_group_id` for combined invoices |
| `exam_papers` | 008 | Exam definitions: subject, grade, marks, date |
| `exam_marks` | 008 | Per-student exam scores |
| `payroll_periods` | 010 | Payroll period definitions |
| `payroll_payslips` | 010 | Teacher payslips with breakdown |
| `teacher_pay_configs` | 010 | Per-teacher pay rates |
| `session_extension_requests` | 012 | Extension request approval chain: student→teacher→coordinator, fee calc, invoice link |
| `session_fee_rates` | 011 | Per-batch/subject/grade session fee rates |
| `session_payments` | 011 | Links invoices to batch sessions |
| `school_config` | 001 | Key-value platform settings |
| `session_exam_topics` | 028 | Exam topic uploads: title, subject, grade, board, category (QP/topic), chapter/topic names, status, files |
| `session_exam_questions` | 028 | AI-generated MCQs: question_text, options[], correct_answer, difficulty, marks |
| `session_exam_results` | 028 | Student exam results: answers, scores, grades |
| `exam_topic_files` | 040 | Multi-file per topic: file_url, file_name, mime_type, file_size |
| `_migrations` | — | Migration tracking |

**Key columns:**
- `portal_users.full_name` — always use `full_name`, NOT `name`
- `portal_users.custom_permissions` — JSONB for owner overrides
- `batches.coordinator_email` + `batches.academic_operator_email` — links to people
- `batch_sessions.livekit_room_name` — set on session start, NULL before

---

## API Routes (152 total)

### Auth (6)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/auth/login` | POST | DB auth with bcrypt |
| `/api/v1/auth/logout` | POST | Clear session cookie |
| `/api/v1/auth/me` | GET | Current user from JWT |
| `/api/v1/auth/forgot-password` | POST | Send OTP for password reset |
| `/api/v1/auth/verify-otp` | POST | Verify OTP code |
| `/api/v1/auth/reset-password` | POST | Reset password with verified OTP |

### Owner (7)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/owner/dashboard` | GET | Full dashboard data (8 parallel queries) |
| `/api/v1/owner/overview` | GET | Room overview (legacy) |
| `/api/v1/owner/user-stats` | GET | User counts by role |
| `/api/v1/owner/roles` | GET, POST | Role management + permission overrides |
| `/api/v1/owner/users/[email]` | GET, PATCH | Per-user management |
| `/api/v1/owner/permissions/[email]` | GET, PATCH | Per-user permission toggles |

### HR (7)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/hr/users` | GET, POST | List + create users with credential emails |
| `/api/v1/hr/users/[email]` | GET, PATCH, DELETE | User detail, update, deactivate |
| `/api/v1/hr/users/[email]/reset-password` | POST | Reset password + email |
| `/api/v1/hr/stats` | GET | Role headcounts, alerts |
| `/api/v1/hr/attendance` | GET | Attendance breakdowns (summary/by_teacher/by_student) |
| `/api/v1/hr/students/[email]/performance` | GET | Student performance data |
| `/api/v1/hr/teachers/[email]/performance` | GET | Teacher performance data |

### Batches & Sessions (10)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/batches` | GET, POST | List + create batches |
| `/api/v1/batches/[batchId]` | GET, PATCH, DELETE | Batch detail, update, archive |
| `/api/v1/batches/people` | GET | List students/teachers for picker |
| `/api/v1/batch-sessions` | GET, POST, DELETE | List + create + bulk-cancel sessions |
| `/api/v1/batch-sessions/[sessionId]` | PATCH, DELETE | Update/cancel single session |
| `/api/v1/batch-sessions/[sessionId]/start` | POST | Start session → create LiveKit room + join tokens |
| `/api/v1/batch-sessions/auto-start` | POST | Auto-start sessions in prep window |
| `/api/v1/batch-sessions/weekly-timetable` | GET, POST | Get/send weekly timetable |
| `/api/v1/batch-sessions/daily-timetable` | POST | Send daily timetable (deduped) |
| `/api/v1/batch-sessions/session-reminder` | POST | Send session reminders (30min) |

### Room Lifecycle (18)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/room/create` | POST | Create room + LiveKit room |
| `/api/v1/room/join` | POST | Auth + issue LiveKit token |
| `/api/v1/room/reminders` | GET | Cron: 30/5-min reminders |
| `/api/v1/room/[room_id]` | DELETE | End class, destroy LiveKit room |
| `/api/v1/room/[room_id]/go-live` | POST | Transition scheduled → live |
| `/api/v1/room/[room_id]/attendance` | GET | Room attendance records |
| `/api/v1/room/[room_id]/attendance/mark-absent` | POST | Mark student absent |
| `/api/v1/room/[room_id]/attendance/remind` | POST | Send attendance reminder |
| `/api/v1/room/[room_id]/feedback` | GET, POST | Student feedback + teacher rating |
| `/api/v1/room/[room_id]/chat` | GET | Chat history |
| `/api/v1/room/[room_id]/coordinator-status` | GET | Coordinator online status |
| `/api/v1/room/[room_id]/doubts` | GET, POST | Student doubt requests |
| `/api/v1/room/[room_id]/end-request` | POST | Request to end session |
| `/api/v1/room/[room_id]/exams` | GET, POST | In-session exam management |
| `/api/v1/room/[room_id]/homework` | GET, POST | Session homework |
| `/api/v1/room/[room_id]/lobby` | GET, POST | Lobby presence tracking |
| `/api/v1/room/[room_id]/recording` | GET, POST | Session recording |
| `/api/v1/room/[room_id]/recording/upload` | POST | Upload recording |
| `/api/v1/room/[room_id]/report-teacher` | POST | Student reports teacher |
| `/api/v1/room/[room_id]/report` | GET | Session report data |
| `/api/v1/room/[room_id]/selective-end` | POST | End session for specific students |

### Coordinator (8)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/coordinator/rooms` | GET, POST | List + create rooms |
| `/api/v1/coordinator/rooms/[room_id]` | GET, PATCH, DELETE | Room CRUD |
| `/api/v1/coordinator/rooms/[room_id]/students` | GET, POST | Student management |
| `/api/v1/coordinator/rooms/[room_id]/notify` | POST | Send email invites |
| `/api/v1/coordinator/rooms/[room_id]/notify-status` | GET | Email send progress poll |
| `/api/v1/coordinator/student-performance` | GET | Student performance metrics |
| `/api/v1/batch-coordinator/go-live-requests` | GET, POST | Go-live approval requests |
| `/api/v1/batch-coordinator/heartbeat` | POST | Coordinator online/offline heartbeat |
| `/api/v1/batch-coordinator/live-sessions` | GET | Live session monitoring data |

### Participant Control (3)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/room/participants/[identity]` | DELETE | Kick participant |
| `/api/v1/room/participants/[identity]/mute` | POST | Mute audio |
| `/api/v1/room/contact-violation` | POST | Contact info violation alert |

### Payment & Fees (13)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/payment/initiate` | POST | Start Razorpay payment order |
| `/api/v1/payment/callback` | POST | Payment gateway callback + receipt email |
| `/api/v1/payment/ledger` | GET | Fee ledger |
| `/api/v1/payment/invoices` | GET | Invoice list (auto-flips overdue) |
| `/api/v1/payment/generate-monthly` | POST | Auto-generate monthly invoices + email notifications |
| `/api/v1/payment/fee-structures` | GET, POST | Fee structure CRUD |
| `/api/v1/payment/receipt/[id]` | GET | Printable receipt/invoice HTML (redesigned: white bg, logo, description table) |
| `/api/v1/payment/invoice-pdf/[id]` | GET | Professional invoice/receipt PDF (with parsed description table) |
| `/api/v1/payment/send-reminder` | POST | Send payment reminder email |
| `/api/v1/payment/session-check` | POST | Session payment verification (combined invoices) |
| `/api/v1/payment/session-rates` | GET, POST | Per-session fee rates |
| `/api/v1/batch-sessions/finalize-invoices` | POST | Generate combined invoices for a schedule group |

### Session Exam Topics (7)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/session-exam-topics` | GET, POST, DELETE | List topics (with generated_questions count), upload topic with files, delete topic + files |
| `/api/v1/session-exam-topics/generate` | POST | AI question extraction/generation — renders PDF pages, sends to Groq vision/text model |
| `/api/v1/session-exam-topics/generate/cancel` | POST | Cancel in-progress generation |
| `/api/v1/session-exam-topics/questions` | GET, POST | View/manage generated questions |
| `/api/v1/session-exam-topics/questions/steps` | GET | Solution steps for questions |
| `/api/v1/session-exam` | GET, POST | Student-facing: serve questions (no answers), grade submitted answers |
| `/api/v1/session-exam/results` | GET | Fetch exam results |

### Exams (3)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/exams` | GET, POST | List + create exams |
| `/api/v1/exams/[id]` | GET, PATCH, DELETE | Exam CRUD |
| `/api/v1/exams/[id]/marks` | GET, POST | Marks entry + retrieval |

### Other (30+)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/health` | GET | DB, Redis, LiveKit connectivity |
| `/api/v1/admissions` | GET, POST | Admission requests |
| `/api/v1/cancellations` | GET, POST | Cancellation workflow |
| `/api/v1/teacher-leave` | GET, POST, PATCH, DELETE | Teacher & coordinator leave requests: multi-level approval (AO→HR→Owner), per-session management (substitute/cancel/reschedule), bulk delete |
| `/api/v1/session-requests` | GET, POST, PATCH | Session change requests (reschedule/cancel): teacher & coordinator submission, AO approval |
| `/api/v1/session-extension` | GET, POST, PATCH | Session time extension requests with fee calculation |
| `/api/v1/attention` | GET | Attention monitoring |
| `/api/v1/monitoring/session/[roomId]` | GET | AI monitoring session data |
| `/api/v1/monitoring/events` | GET, POST | AI monitoring events (behavior tracking) |
| `/api/v1/monitoring/alerts` | GET, POST | AI monitoring alerts (violations) |
| `/api/v1/monitoring/reports` | GET, POST | AI monitoring reports |
| `/api/v1/monitoring/reports/[reportId]` | GET | Individual monitoring report |
| `/api/v1/notifications` | GET | Notification list |
| `/api/v1/payroll` | GET, POST | Payroll CRUD |
| `/api/v1/payroll/payslip-pdf/[id]` | GET | Payslip PDF download |
| `/api/v1/reports` | GET | Reports generation |
| `/api/v1/student-reports` | GET | Comprehensive student reports (exam, attendance, AI monitoring) |
| `/api/v1/teacher-reports` | GET, POST | Teacher performance reports |
| `/api/v1/recording` | GET, POST | Session recording |
| `/api/v1/recording/requests` | GET, POST | Recording access requests |
| `/api/v1/question-bank` | GET, POST | Question bank for exams |
| `/api/v1/academics/settings` | GET, PATCH | Academic settings (subjects list) |
| `/api/v1/users/search` | GET | Search with subject filter |
| `/api/v1/student-availability` | GET | Student schedule availability |
| `/api/v1/student-status` | GET | Student enrollment status |
| `/api/v1/token/validate` | POST | Validate join-token JWT |
| `/api/v1/webhook/livekit` | POST | LiveKit event webhook |
| `/api/v1/homework/upload` | POST | Homework file upload |
| `/api/v1/email/test` | POST | Dev: test email templates |
| `/api/v1/dev/token` | POST | Dev: generate tokens |
| `/api/v1/dev/livekit-test` | GET | Dev: LiveKit connectivity |
| Role-specific | GET | `/api/v1/teacher/rooms`, `/api/v1/teacher/profile`, `/api/v1/teacher/profile/avatar`, `/api/v1/teacher/my-batches`, `/api/v1/teacher/my-sessions`, `/api/v1/teacher/schedule`, `/api/v1/teacher/ratings`, `/api/v1/teacher/homework` |
| Role-specific | GET | `/api/v1/student/rooms`, `/api/v1/student/profile`, `/api/v1/student/batches`, `/api/v1/student/sessions`, `/api/v1/student/attendance`, `/api/v1/student/fees`, `/api/v1/student/homework` |
| Role-specific | GET | `/api/v1/parent/rooms`, `/api/v1/parent/attendance`, `/api/v1/parent/exams`, `/api/v1/parent/complaints`, `/api/v1/parent/reports` |
| Role-specific | GET | `/api/v1/ghost/rooms` |

---

## Email System

- **SMTP:** Gmail via `info.pydart@gmail.com` (App Password)
- **45 templates** in `lib/email-templates.ts` (2,685 lines)
- **Queue:** BullMQ on Redis, concurrency 5, priority levels
- **Logging:** All emails tracked in `email_log` table
- **Auth error handling:** No retry on EAUTH/535 errors, transporter cache flushed
- **WhatsApp mirror:** Every `sendEmail()` call auto-mirrors to WhatsApp via Meta Cloud API (see WhatsApp section)

**Template Types (45):**

| Template | Purpose |
|----------|---------|
| `teacherInviteTemplate` | Teacher assigned to room |
| `studentInviteTemplate` | Student added to room |
| `paymentConfirmationTemplate` | Payment received |
| `roomReminderTemplate` | 30/5-min class reminders |
| `roomCancelledTemplate` | Class cancelled |
| `roomRescheduledTemplate` | Class rescheduled |
| `coordinatorSummaryTemplate` | Coordinator room summary |
| `credentialsTemplate` | New user credentials (HR creates) |
| `roomStartedTemplate` | Class is LIVE now |
| `batchCoordinatorNotifyTemplate` | BC batch notification |
| `batchTeacherNotifyTemplate` | Teacher batch notification |
| `batchStudentNotifyTemplate` | Student batch notification |
| `batchParentNotifyTemplate` | Parent batch notification |
| `dailyTimetableTemplate` | Morning daily schedule |
| `sessionReminderTemplate` | Join link reminder (30min before) |
| `weeklyTimetableTemplate` | Manual/auto timetable send |
| `sessionRequestSubmittedTemplate` | Session change request to AO |
| `sessionRequestApprovedTemplate` | Session request approved |
| `sessionRequestRejectedTemplate` | Session request rejected |
| `sessionRescheduledNotifyTemplate` | Session rescheduled notification |
| `sessionCancelledNotifyTemplate` | Session cancellation notification |
| `sessionSubstituteNotifyTemplate` | Substitute teacher notification |
| `leaveRequestSubmittedTemplate` | Teacher leave request notification |
| `leaveRequestApprovedTemplate` | Leave approved (AO/HR) |
| `leaveRequestRejectedTemplate` | Leave rejected notification |
| `leaveSessionsAffectedTemplate` | Leave impact on affected sessions |
| `leaveHRApprovedTemplate` | Leave HR-level approval |
| `leaveAOActionRequiredTemplate` | AO action needed for leave |
| `invoiceGeneratedTemplate` | Invoice generated notification |
| `paymentReceiptTemplate` | Payment receipt notification |
| `payslipNotificationTemplate` | Payslip notification |
| `paymentReminderTemplate` | Payment due reminder |
| `passwordResetOtpTemplate` | Password reset OTP code |
| `demoTeacherRequestTemplate` | Demo request to teacher |
| `demoStudentAcceptedTemplate` | Student accepted for demo |
| `demoAOAcceptedTemplate` | AO demo acceptance notification |
| `demoStudentSearchingTemplate` | Demo confirmation to student (searching) |
| `demoStudentRejectedTemplate` | Student rejected from demo |
| `demoSummaryTeacherTemplate` | Post-demo summary for teacher |
| `demoSummaryAOTemplate` | Post-demo summary for AO |
| `demoSummaryStudentTemplate` | Post-demo summary for student |
| `teacherReportNotifyTemplate` | Student reported teacher alert |
| `earlyExitAlertTemplate` | Student left session early alert |
| `absentNotificationTemplate` | Student absent notification |
| `joinReminderTemplate` | Join reminder for late students |

---

## WhatsApp Cloud API Integration

- **Provider:** Meta Cloud API (Graph API v21.0)
- **Phone:** `+91 73560 72106` (Phone Number ID: `1012055651991416`)
- **WABA ID:** `2348821842224273`
- **App:** ID `1268950381861371`, name "stibe"
- **Auth:** Permanent System User token (never expires)
- **Status:** LIVE mode, TIER_250, quality GREEN
- **Business verification:** Not yet completed (LIMITED sending)

**Architecture:** Every `sendEmail()` call → `mirrorToWhatsApp()` → `fireWhatsApp()` → Meta template send

**Priority chain in `fireWhatsApp()`:**
1. Direct `waTemplate` + `waParams` (structured, preferred)
2. Legacy `META_EMAIL_TEMPLATE_MAP` regex extraction (fallback)
3. Free-form text message (24h window only)

**Phone resolution (`lookupPhone()` — 3-tier):**
1. `overridePhone` parameter (direct pass via `recipientPhone` in `SendEmailOptions`)
2. `user_profiles.whatsapp` / `user_profiles.phone` (portal users)
3. `demo_requests.student_phone` fallback (external demo students not in portal)

**Standalone export:** `sendWA(recipientEmail, templateName, params[], lang)` for WA-only sends

### Meta Templates (29 total)

| Template Name | Params | Status |
|---------------|:------:|--------|
| `stibe_class_rescheduled` | 6 | APPROVED |
| `stibe_demo_confirmed` | 5 | APPROVED |
| `stibe_demo_waiting` | 2 | APPROVED |
| `stibe_leave_impact` | 4 | APPROVED |
| `stibe_leave_req` | 4 | APPROVED |
| `stibe_leave_update` | 4 | APPROVED |
| `stibe_onboarding` | 4 | APPROVED |
| `stibe_payment_due` | 5 | APPROVED |
| `stibe_receipt` | 4 | APPROVED |
| `stibe_request_update` | 4 | APPROVED |
| `stibe_weekly_schedule` | 3 | APPROVED |
| `stibe_batch_assign` | 4 | PENDING |
| `stibe_class_cancelled` | 4 | PENDING |
| `stibe_class_live` | 5 | PENDING |
| `stibe_class_reminder` | 5 | PENDING |
| `stibe_coord_summary` | 4 | PENDING |
| `stibe_daily_schedule` | 3 | PENDING |
| `stibe_demo_req` | 4 | PENDING |
| `stibe_invoice` | 4 | PENDING |
| `stibe_payment_confirm` | 4 | PENDING |
| `stibe_payslip` | 4 | PENDING |
| `stibe_session_cancel` | 6 | PENDING |
| `stibe_session_moved` | 6 | PENDING |
| `stibe_session_request` | 6 | PENDING |
| `stibe_student_class` | 6 | PENDING |
| `stibe_teacher_class` | 6 | PENDING |

### Integration Points (39 call sites across 14 files)

| File | Calls | Templates Used |
|------|:-----:|----------------|
| `lib/email.ts` (15 wrappers) | 15 | All convenience wrappers pass `waTemplate` + `waParams` |
| `teacher-leave/route.ts` | 5 | `leave_update`, `leave_req`, `leave_impact` |
| `session-requests/route.ts` | 5 | `request_update`, `session_cancel`, `session_moved`, `session_request` |
| `hr/users/route.ts` | 2 | `onboarding` |
| `hr/users/[email]/reset-password/route.ts` | 1 | `onboarding` |
| `demo/[linkId]/route.ts` | 2 | `demo_req`, `demo_waiting` |
| `demo/requests/route.ts` | 1 | `demo_confirmed` |
| `batch-sessions/weekly-timetable/route.ts` | 1 | `weekly_schedule` |
| `batch-sessions/daily-timetable/route.ts` | 1 | `daily_schedule` |
| `batch-sessions/session-reminder/route.ts` | 1 | `class_reminder` |
| `coordinator/rooms/[room_id]/notify/route.ts` | 1 | `teacher_class`, `student_class` |
| `lib/room-notifications.ts` | 4 | `teacher_class`, `student_class`, `class_reminder`, `class_live` |
| `lib/timetable-auto.ts` | 1 | `weekly_schedule` |

**Skipped (intentionally):** `forgot-password` (OTP sensitive), `contact-violation` (internal alert)

**Environment variables (`.env.local`):**
```env
WHATSAPP_TOKEN=<permanent-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=1012055651991416
```

---

## Classroom System (29 components, ~14,484 LOC)

| Component | Lines | Purpose |
|-----------|------:|---------|
| `TeacherView.tsx` | 3,002 | Google Meet-style layout, student grid, sidebar, media controls, exam controls |
| `StudentView.tsx` | 2,274 | YouTube-fullscreen immersive view, auto-hiding overlay, media approval, inline exam |
| `CoordinatorLiveView.tsx` | 1,246 | BC live monitoring: audio, chat, AI monitoring, student panels |
| `GhostView.tsx` | 884 | Silent observation, private notes, multi-room support |
| `HomeworkPanel.tsx` | 556 | In-session homework assignment and submission |
| `RoomMonitor.tsx` | 524 | Room monitoring component for BC dashboard |
| `ControlBar.tsx` | 519 | Google Meet-style SVG control buttons, exam button |
| `AttendancePanel.tsx` | 505 | Post-session attendance + teacher rating dialog |
| `ClassroomWrapper.tsx` | 478 | LiveKit `<Room>` provider, 1080p capture, simulcast, auto-exit |
| `StudentSidePanel.tsx` | 395 | Student detail side panel in classroom |
| `DoubtPanel.tsx` | 394 | Student doubt request system |
| `ChatPanel.tsx` | 358 | Real-time chat via LiveKit data channel |
| `ScreenDeviceView.tsx` | 268 | Tablet screen share (1920×1080 @ 15fps) |
| `ReportTeacherDialog.tsx` | 256 | Student reports teacher dialog |
| `VideoQualitySelector.tsx` | 237 | Auto/360p/720p/1080p quality picker |
| `StudentDetailPanel.tsx` | 234 | Per-student detail view in classroom |
| `ParticipantList.tsx` | 229 | Participant sidebar with mute/kick controls |
| `HeaderBar.tsx` | 225 | Live countdown, 5-min warning, expired banner |
| `TeacherOverlay.tsx` | 218 | MediaPipe AI background segmentation |
| `PreJoinLobby.tsx` | 218 | Camera/mic preview + device selection |
| `VideoTile.tsx` | 199 | Reusable video tile with avatar fallback + network quality badge |
| `FeedbackDialog.tsx` | 188 | Post-session student feedback |
| `SessionExamDialog.tsx` | 187 | Live session exam controls (teacher-side) |
| `WhiteboardComposite.tsx` | 178 | Tablet screen + teacher camera composite |
| `DemoExamDialog.tsx` | 170 | Demo exam dialog for demo sessions |
| `VirtualBackgroundPanel.tsx` | 154 | Virtual background selection |
| `icons.tsx` | 153 | Google Meet-style SVG icons |
| `TimeWarningDialog.tsx` | 140 | 5-minute warning modal |
| `MaterialsPanel.tsx` | 95 | In-session materials viewer |

**Two-device teacher setup:**
1. Teacher laptop → `TeacherView` (webcam + controls + chat + student grid)
2. Teacher tablet (Flutter app) → `ScreenDeviceView` → shares screen as whiteboard
3. `WhiteboardComposite` composites tablet screen + teacher webcam overlay
4. `TeacherOverlay` uses MediaPipe to segment teacher background

**Video quality system:**
- Capture: 1080p, simulcast h360/h720/h1080 layers
- Subscribe: `setVideoQuality(LOW|MEDIUM|HIGH)` via `VideoQualitySelector`
- Screen share: 1920×1080 @ 15fps, 3 Mbps

**Chat system:**
- Teacher: sidebar panel (320px), toggled via sidebar tabs
- Student: slide-from-right panel, toggled via overlay button
- Transport: LiveKit data channel, topic `chat`

---

## Lib Files (38 files, ~14,524 LOC)

| File | Lines | Key Exports | Purpose |
|------|------:|-------------|---------|
| `email-templates.ts` | 2,685 | 45 template functions + interfaces | HTML email templates with master layout |
| `reports.ts` | 1,232 | Report generation functions | AI-powered academic report generation |
| `curriculum-data.ts` | 896 | CBSE/ICSE/ISC/State Board chapters & topics per grade | Exam curriculum reference data |
| `ai-exam-generator.ts` | 841 | Groq Cloud API: PDF→images→vision extraction, text generation, MCQ parsing | AI exam question generation |
| `payment.ts` | 814 | Payment initiation, callback, ledger | Fee management backend |
| `monitoring-reports.ts` | 787 | AI monitoring report generation | Classroom behavior analysis |
| `whatsapp.ts` | 786 | `fireWhatsApp()`, `sendWA()`, Meta templates | WhatsApp Cloud API (Meta Graph v21.0) — 29 templates |
| `monitoring.ts` | 631 | AI monitoring event tracking | Real-time classroom monitoring |
| `demo-exam-questions.ts` | 533 | Demo exam question bank | Grade-aware demo exam questions |
| `exam.ts` | 530 | Exam CRUD, marks management | Exam system backend |
| `email.ts` | 453 | `sendEmail()`, convenience senders | Nodemailer SMTP + WhatsApp mirror (15 wrappers) |
| `demo-summary.ts` | 424 | `collectDemoSummary()`, notifications | Demo session post-summary aggregation |
| `attendance.ts` | 362 | `recordJoin()`, `recordLeave()`, late detection | Attendance tracking |
| `recording.ts` | 288 | Session recording management | Recording system |
| `youtube.ts` | 282 | YouTube Live integration | YouTube streaming + recording |
| `livekit.ts` | 266 | `createLiveKitToken()`, `ensureRoom()` | LiveKit SDK, role-based grants |
| `email-queue.ts` | 261 | `enqueueEmail()`, BullMQ worker | Background email queue |
| `permissions.ts` | 253 | `ROLE_DEFAULT_PERMISSIONS`, `mergePermissions()` | Client-side RBAC definitions |
| `timetable-auto.ts` | 249 | `scheduleTimetableUpdate()`, `deriveWeeklySlots()` | Debounced auto-send timetable |
| `payroll.ts` | 245 | Payroll period/payslip CRUD | Payroll engine |
| `room-notifications.ts` | 220 | Auto-notify: create, remind, go-live | Room lifecycle emails |
| `nav-config.ts` | 214 | `getNavForRole()`, `resolveActiveNav()` | Navigation structure |
| `contact-detection.ts` | 166 | Contact info leak detection | Safety monitoring |
| `users.ts` | 164 | `searchUsers()`, subject/coordinator search | User search with GIN index |
| `early-exit-alert.ts` | 131 | Early exit alert system | Student early exit notifications |
| `sounds.ts` | 126 | `sfxHandRaise()`, `hapticTap()` | Web Audio API SFX |
| `utils.ts` | 122 | `cn()`, `fmtTimeIST()`, `toISTDateValue()` | Tailwind merge, IST formatting |
| `exam-notifications.ts` | 117 | Exam notification helpers | Exam email/WhatsApp notifications |
| `db.ts` | 96 | `db.query()`, `db.withTransaction()` | PostgreSQL pool singleton |
| `auth-db.ts` | 72 | `dbLogin()` | bcrypt authentication |
| `auth-utils.ts` | 51 | `getServerUser()`, `requireRole()` | Server-side auth guards |
| `invoice-description.ts` | 49 | Invoice description parser | Parse invoice line item descriptions |
| `session.ts` | 36 | `signSession()`, `verifySession()` | JWT session (jose HS256) |
| `pdf-logo.ts` | 36 | Base64-encoded logo for PDFs | PDF document logo embed |
| `pay-token.ts` | 36 | Payment token helpers | Secure payment token generation |
| `permissions-server.ts` | 33 | `getEffectivePermissions()` | DB lookup + merge permissions |
| `redis.ts` | 24 | `redis` singleton | ioredis with lazy connect |
| `auth.ts` | 13 | Auth re-export | Auth module entry point |

---

## Hooks (6 files, ~1,300 LOC)

| Hook | Lines | Purpose |
|------|------:|---------|
| `useAttentionMonitor.ts` | 604 | MediaPipe FaceLandmarker — blendshape-based attention detection, tab/inactivity tracking, behavior event recording |
| `useTeacherOverlay.ts` | 291 | MediaPipe selfie segmenter — per-frame GPU-accelerated background removal |
| `useClassRecorder.ts` | 273 | Client-side class recording — MediaRecorder API, canvas compositing |
| `useNetworkStatus.ts` | 79 | Browser offline/online detection + Network Information API (effectiveType, downlink, rtt) |
| `useSession.ts` | 40 | Client auth — fetches `/api/v1/auth/me`, returns `{ user, loading, logout }` |
| `useWhiteboard.ts` | 13 | Stub — placeholder for whiteboard composite logic |

---

## Proxy / Middleware (`proxy.ts`)

| Path Pattern | Behavior |
|-------------|----------|
| `/login`, `/expired`, `/api/v1/auth/login`, `/api/v1/health` | **Public** — always allowed |
| `/api/*` | **Pass-through** — each route handles its own auth |
| `/join/*`, `/classroom/*` | **Allowed** — token-based auth |
| `/dev*` | **Dev only** — blocked in production |
| All other routes | **Session required** — redirects to `/login` if invalid |

**Role → Route map:**

| Route Prefix | Allowed Roles |
|-------------|---------------|
| `/owner` | owner |
| `/batch-coordinator` | batch_coordinator, owner |
| `/academic-operator` | academic_operator, academic, owner |
| `/hr` | hr, owner |
| `/teacher` | teacher, owner |
| `/student` | student, owner |
| `/parent` | parent, owner |
| `/ghost` | ghost, owner |

---

## Types (`types/index.ts`)

| Type | Kind | Fields |
|------|------|--------|
| `PortalRole` | Union | 10 values: teacher, teacher_screen, student, batch_coordinator, academic_operator, academic, hr, parent, owner, ghost |
| `stibeUser` | Interface | id, name, role, batch_id?, token? |
| `SessionPayload` | Interface | extends stibeUser + iat, exp |
| `ClassRoom` | Interface | Room entity with all DB columns |
| `JoinTokenPayload` | Interface | sub, name, role, room_id, batch_id, class_session_id, permissions (6 booleans) |
| `ApiResponse<T>` | Generic | `{ success, data?, error?, message? }` |
| `GhostRoomSummary` | Interface | Ghost monitor card data |

---

## Migrations (43 files)

| File | What it does |
|------|-------------|
| `001_initial.sql` | Core schema: rooms, room_events, room_assignments, payment_attempts, email_log, school_config |
| `006_rooms_nullable_columns.sql` | Make rooms columns nullable for flexibility |
| `007_rooms_drop_notnull.sql` | Drop remaining NOT NULL constraints on rooms |
| `008_end_session_events_and_go_live.sql` | Session end event types + go-live workflow |
| `009_session_invoicing.sql` | Fee structures + invoices tables |
| `010_schedule_group.sql` | Schedule group for batch sessions |
| `011_soft_delete_student_status.sql` | Soft delete + student status tracking |
| `012_session_extension_requests.sql` | Extension request approval chain: student→teacher→coordinator, fee calc, invoice link |
| `013_demo_requests.sql` | demo_requests table for demo session management |
| `014_demo_exam_results.sql` | demo_exam_results table + outcome/exam_result_id on demo_requests |
| `015_demo_email_types.sql` | Demo email template types |
| `016_user_category.sql` | User category field (A/B/C from exam grading) |
| `017_demo_ended_event_type.sql` | `demo_ended_by_teacher` event type |
| `018_demo_student_board.sql` | Board field on demo requests |
| `019_demo_summary_email_types.sql` | Demo summary email template types |
| `020_demo_ao_accepted_email_type.sql` | Demo AO accepted notification type |
| `021_materials_library.sql` | Junction table migration + data migration from old single-batch FK |
| `022_requests_redesign.sql` | Leave & session requests system redesign |
| `023_leave_workflow_overhaul.sql` | Leave workflow: teacher_leave_requests, leave_session_actions, requester_role |
| `024_notification_log_external_id.sql` | External ID on notification log for dedup |
| `025_monitoring_v2_event_types.sql` | AI monitoring v2 event types (blendshapes, tab, inactivity) |
| `025_session_payments_cancelled_status.sql` | Cancelled status on session_payments |
| `026_teacher_reports.sql` | Teacher reports table |
| `027_doubts_homework.sql` | Doubts and homework system tables |
| `028_session_exams.sql` | session_exam_topics + session_exam_questions + session_exam_results |
| `029_youtube_recording.sql` | YouTube recording integration |
| `030_ghost_audit_log.sql` | Ghost observer audit log |
| `031_video_access_requests.sql` | Video access request management |
| `032_chat_logs_playlists_batch_types.sql` | Chat logs, playlists, batch type columns |
| `033_exam_answer_attachments.sql` | Exam answer file attachments |
| `034_lobby_presence.sql` | Lobby presence tracking |
| `035_homework_overhaul.sql` | Homework system overhaul |
| `036_go_live_approval.sql` | Go-live approval workflow (BC must approve) |
| `037_bc_heartbeat.sql` | BC coordinator online/offline heartbeat |
| `038_extra_time_rates.sql` | Extra time billing rates |
| `039_selective_extension.sql` | Selective per-student time extension |
| `040_exam_topic_files.sql` | exam_topic_files — multi-file upload per topic |
| `041_exam_topic_categorization.sql` | board, category, paper_type, chapter_name, topic_name on session_exam_topics |
| `042_generation_progress.sql` | AI generation progress tracking (status, progress fields) |
| `043_question_image_url.sql` | Image URL on generated questions |
| `044_question_solution_steps.sql` | Solution steps on exam questions |
| `045_exam_violations.sql` | Exam violation recording (tab_switched, screenshot_attempt, etc.) |
| `046_room_events_session_extended.sql` | `session_extended` event type in room_events CHECK constraint |

---

## stibe Teacher — Flutter App

**Project:** `/Users/pydart/Projects/stibe-teacher`  
**Package:** `com.stibe.screenshare`  
**Platform:** Android (min SDK 24)

### Structure (17 Dart files, ~6,824 LOC)

| File | Lines | Purpose |
|------|------:|---------|
| `main.dart` | 69 | App entry, Firebase init, routing |
| `theme.dart` | 95 | Dark theme matching portal |
| `screens/login_screen.dart` | 262 | Email/password login |
| `screens/forgot_password_screen.dart` | 488 | OTP-based forgot password flow |
| `screens/dashboard_screen.dart` | 451 | Room list, join, refresh |
| `screens/home_shell.dart` | 191 | Bottom navigation shell |
| `screens/classroom_screen.dart` | 457 | LiveKit room, screen share, foreground service |
| `screens/batches_screen.dart` | 493 | Batch list with subject breakdown |
| `screens/sessions_screen.dart` | 438 | Session schedule timeline |
| `screens/materials_screen.dart` | 705 | Teaching materials viewer (Samsung Notes edit) |
| `screens/leave_screen.dart` | 512 | Leave request submission |
| `screens/profile_screen.dart` | 642 | Profile edit with avatar upload |
| `services/api.dart` | 1,133 | HTTP client, cookie-based auth |
| `services/session.dart` | 60 | SharedPreferences persistence |
| `services/notifications.dart` | 191 | FCM push + local notifications |
| `services/deep_link.dart` | 226 | App Links for join URLs |
| `services/connectivity.dart` | 61 | Network connectivity monitoring |
| `widgets/no_internet_overlay.dart` | 186 | No internet overlay UI |

### Native Android

| File | Lines | Purpose |
|------|------:|---------|
| `MainActivity.kt` | 37 | MethodChannel for foreground service |
| `ScreenCaptureService.kt` | 78 | MediaProjection foreground service |

---

## Server Infrastructure

| Service | Host | Port | Protocol |
|---------|------|------|----------|
| PostgreSQL | 76.13.244.60 | 5432 | TCP |
| Redis | 76.13.244.60 | 6379 | TCP (password auth) |
| LiveKit | 76.13.244.54 | 7880 | WebSocket |
| LiveKit WebRTC | 76.13.244.54 | 50000-60000 | UDP |
| Next.js (PM2) | 76.13.244.60 | 3000 | HTTP → Nginx → HTTPS |
| Groq Cloud API | api.groq.com | 443 | HTTPS (external) |

---

## Environment Variables (19)

```env
NEXT_PUBLIC_APP_URL=https://stibelearning.online
JWT_SECRET=<secret>
NEXT_PUBLIC_LIVEKIT_URL=ws://76.13.244.54:7880
LIVEKIT_API_KEY=APIrPJx5TK4Uccx
LIVEKIT_API_SECRET=<secret>
DATABASE_URL=postgresql://stibe:<password>@76.13.244.60:5432/stibe_portal
REDIS_URL=redis://:<password>@76.13.244.60:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info.pydart@gmail.com
SMTP_PASS=<app-password>
EMAIL_FROM_NAME=stibe Classes
EMAIL_FROM_ADDRESS=info.pydart@gmail.com
PORTAL_BASE_URL=https://stibelearning.online
EMAIL_MODE=smtp
OWNER_EMAIL=stibelearningventures@gmail.com
OWNER_PASSWORD=Test@1234
WHATSAPP_TOKEN=<permanent-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=1012055651991416
```

---

## File Inventory

### Portal (`stibe-portal/`) — 329 source files, ~101,000 LOC

```
stibe-portal/
├── .env.local                              19 environment variables
├── proxy.ts                                Route protection + role-based access
├── next.config.ts                          CORS + MediaPipe WASM headers + serverExternalPackages
├── package.json                            Next.js 16.1.6 + dependencies
│
├── types/index.ts                          7 types: PortalRole, stibeUser, etc.
│
├── lib/                                    38 files, ~14,524 LOC
│   ├── auth-db.ts                          PostgreSQL bcrypt login (72)
│   ├── auth-utils.ts                       getServerUser(), requireRole() (51)
│   ├── auth.ts                             Auth re-export (13)
│   ├── db.ts                               PostgreSQL pool singleton (96)
│   ├── email.ts                            Nodemailer SMTP + WA mirror, 15 wrappers (453)
│   ├── email-queue.ts                      BullMQ queue + worker (261)
│   ├── email-templates.ts                  33+ HTML templates with master layout (2,685)
│   ├── livekit.ts                          LiveKit SDK, grants matrix, room CRUD (266)
│   ├── sounds.ts                           Web Audio API SFX + vibration (126)
│   ├── redis.ts                            ioredis singleton (24)
│   ├── room-notifications.ts              Auto-notify: create, remind, go-live (220)
│   ├── session.ts                          JWT sign/verify, jose HS256 (36)
│   ├── users.ts                            User search, subject/coordinator search (164)
│   ├── utils.ts                            cn(), IST formatters, ID generator (122)
│   ├── nav-config.ts                       Per-role navigation structure (214)
│   ├── permissions.ts                      RBAC definitions + merge logic (253)
│   ├── permissions-server.ts               DB lookup for effective permissions (33)
│   ├── timetable-auto.ts                   Debounced auto-send timetable (249)
│   ├── attendance.ts                       Join/leave tracking, late detection (362)
│   ├── exam.ts                             Exam CRUD, marks management (530)
│   ├── exam-notifications.ts              Exam email/WhatsApp notifications (117)
│   ├── payment.ts                          Fee/invoice/receipt management (814)
│   ├── payroll.ts                          Payroll engine (245)
│   ├── reports.ts                          AI-powered report generation (1,232)
│   ├── recording.ts                        Session recording (288)
│   ├── youtube.ts                          YouTube Live integration (282)
│   ├── contact-detection.ts                Contact info leak detection (166)
│   ├── whatsapp.ts                         WhatsApp Cloud API — 29 Meta templates (786)
│   ├── ai-exam-generator.ts                Groq Cloud API: PDF→images→vision extraction (841)
│   ├── curriculum-data.ts                  CBSE/ICSE/ISC/State Board chapters & topics (896)
│   ├── monitoring.ts                       AI monitoring event tracking (631)
│   ├── monitoring-reports.ts              AI monitoring report generation (787)
│   ├── demo-exam-questions.ts              Demo exam question bank (533)
│   ├── demo-summary.ts                     Demo session summary aggregation (424)
│   ├── early-exit-alert.ts                 Early exit alert system (131)
│   ├── invoice-description.ts             Invoice description parser (49)
│   ├── pdf-logo.ts                         PDF document logo embed (36)
│   └── pay-token.ts                        Payment token helpers (36)
│
├── hooks/                                  6 files, ~1,300 LOC
│   ├── useAttentionMonitor.ts              MediaPipe FaceLandmarker attention detection (604)
│   ├── useTeacherOverlay.ts                MediaPipe background segmentation (291)
│   ├── useClassRecorder.ts                 Client-side class recording (273)
│   ├── useNetworkStatus.ts                 Network status detection (79)
│   ├── useSession.ts                       Client auth hook (40)
│   └── useWhiteboard.ts                    Whiteboard stub (13)
│
├── components/
│   ├── auth/                               LoginForm (190), LoginSlideshow (126)
│   ├── dashboard/                          14 files, ~9,861 LOC
│   │   ├── shared.tsx                      Shared component library (1,168) — 72 exports
│   │   ├── DashboardShell.tsx              Sidebar + header layout (328)
│   │   ├── CreateUserForm.tsx              Multi-step user creation wizard (1,063)
│   │   ├── UsersTab.tsx                    Reusable users table component (2,517)
│   │   ├── DemoTab.tsx                     AO demo leads management (1,224)
│   │   ├── TeacherDemoTab.tsx              Teacher demo management (829)
│   │   ├── SessionReportView.tsx           Session report viewer (560)
│   │   ├── StudentReportsTab.tsx           Student reports (exam/attendance/monitoring) (522)
│   │   ├── SessionCalendar.tsx             FullCalendar session calendar (502)
│   │   ├── TeacherReportsTab.tsx           Teacher performance reports (371)
│   │   ├── ImageCropModal.tsx              Avatar image crop modal (232)
│   │   ├── DiscontinuedStudentsPanel.tsx   Discontinued students list (219)
│   │   ├── StudentReportsBrowser.tsx       Batch → Student drill-down picker (177)
│   │   └── ExtensionRequestsPanel.tsx      Extension request management (149)
│   ├── classroom/                          29 files, ~14,484 LOC
│   └── ui/                                 7 shadcn/custom primitives
│
├── app/
│   ├── layout.tsx + page.tsx               Root layout (dark theme) + redirect
│   ├── globals.css                         Brand theme + animations + utilities
│   ├── (auth)/login/                       Login page
│   ├── (portal)/
│   │   ├── layout.tsx + providers.tsx       Session guard + context providers
│   │   ├── owner/                          Dashboard (1,122) + 7 sub-modules (~4,860 LOC)
│   │   ├── hr/                             Dashboard (1,937)
│   │   ├── academic-operator/              Dashboard (7,960)
│   │   ├── batch-coordinator/              Dashboard (1,251) + sub-modules
│   │   ├── teacher/                        Dashboard (2,711) + exams (466)
│   │   ├── student/                        Dashboard (3,397) + exams (420)
│   │   ├── parent/                         Dashboard (1,686)
│   │   ├── ghost/                          Dashboard (379) + monitor
│   │   ├── classroom/[roomId]/             Classroom + ended page (504)
│   │   ├── join/[room_id]/                 PreJoin + JoinClient (391)
│   │   └── dev/                            Dev tools (380)
│   ├── demo/                               Demo session registration
│   ├── demo-exam/                          Demo exam UI
│   └── api/v1/                             152 API routes
│
├── migrations/                             43 SQL files
├── scripts/                                migrate.ts, seed-users.ts, debug-login, shell scripts
└── USERS.md                                Test accounts reference
```

---

## Git Commit History (latest 50)

```
83689c0 Add comprehensive student reports: exam, attendance, AI monitoring with daily/weekly/overall views across all dashboards
4f58d3a Fix exam submit: studentEmail was always empty due to wrong auth/me data path
47b75ef Fix exam generation: inherit grade from batch when room grade is empty
c209cec Add session_extended to room_events event_type constraint (migration 046)
88b9ff0 Fix extension approval: handle duplicate session_payments with upsert
ea7a47f Fix session-extension PATCH: cast $2 to integer for interval math
6cee89a Fix camera stuck + 1 min per question: render exam inline, not new tab
e3f82fc Fix exam workflow: dynamic question count, beforeunload guard, generation progress bar
6c8dbac Fix: suppress tab_switched alerts when student is taking exam
48131ac Exam: fix send to students, remove skip, camera enforcement, anti-cheat monitoring
7ce6d54 Exam dialog: sequential flow - pick source type first, always generate, then start
fbd0982 Exam dialog: popup with QP/topic/material dropdowns, remove sidebar duplicate
a6e610a Move extension button to student control bar, add exam button to teacher control bar
3d07689 fix: QP extraction — generate real answers + solution steps instead of placeholder options
0effdba feat: live session exams — teacher exam flow (daily/weekly/model), always-visible extension button
d410421 Topic mode: ask question count before generating, pass count to API
199e8a9 Fix page detection: better prompt, robust parsing, intelligent inference fallback
a9fa1a8 Show full page images instead of cropping questions
6ebbe22 Increase min crop to 30% of page, center-based positioning
047f30a Simplify crop: equal division with 40% overlap, remove unreliable gap detection
0edd218 Hybrid crop: dark-pixel gap detection + equal-division snapping + overlap padding
a957f87 Remove test PDFs from repo
ecdb78c Improve QP extraction: study structure, handle OR/sub-questions, extract marks
9b40be1 Replace AI position detection with deterministic equal-division cropping
c993ad8 feat: two-pass cropping - dedicated position detection per page
9455062 fix: TS error - use Map for crop y_end instead of mutating typed objects
6d5b486 fix: crop from Q start to next Q start, remove padding
97c52ad feat: crop question images, fullscreen viewer, solution steps
72790ed feat: show QP page images alongside generated questions
66efd45 fix: aggressive LaTeX-to-plaintext sanitizer + stronger vision prompt
a48a96e fix: batch vision images in chunks of 5 (Scout model limit)
585dbdb fix: Groq Scout max_tokens 16384→8192, cancel uses ready status
c116b3e docs: update all docs to reflect Groq Cloud API replacing Ollama
db50090 feat: Groq-only AI pipeline with vision for exact QP extraction
ff7db7a fix: raise MAX_OCR_PAGES from 8 to 15 for larger scanned PDFs
335855e fix: OCR threshold strips page markers before checking text length
4d8b3a7 fix: cancel works after refresh, read GROQ key at runtime
e522ca5 feat: cancel generation button
2d32300 feat: Groq cloud API as primary LLM with Ollama fallback
b4e2960 feat: QPs extract all questions (up to 50), view generated questions modal
8ef1aad fix: sanitize LaTeX in AI JSON responses to prevent parse failures
b7b26e0 feat: generation progress indicator with timer and stage tracking
65c4ad6 feat: async generation — fire-and-forget API + UI polling
eacdae7 fix: set num_ctx=16384 for Ollama, add 5min timeout, reduce content to 4K
2f25e53 fix: remove hardcoded count=20 from generate button, use server default (10)
4ce85cc fix: robust AI question generation — retry, logging, reduced defaults
befa9ea docs: update DEV_FLOW — 312 files, 97.5K LOC, 149 APIs, 38 migrations, Ollama AI stack, exam system
3cc0ce0 fix: externalize pdf-parse from Next.js bundler (worker file missing)
403ab13 fix: OCR scanned PDFs via pdftoppm + minicpm-v vision model
0b47384 feat: AI question generation from uploaded exam files
f19b4a9 fix(exam): show all grades/boards/subjects instead of batch-derived
```

---

## Known Issues

| Severity | Location | Issue |
|----------|----------|-------|
| LOW | `useWhiteboard.ts` | Stub hook — not wired into classroom |
| LOW | `email-queue.ts` | BullMQ worker never auto-started (emails sent directly) |
| LOW | `student/rooms` | Exposes `join_token` in list response |
| FIXED | `TeacherDemoTab` | “Missing session data” when opening demo classroom — fixed `80c6c85` |
| FIXED | `whatsapp.ts` | Demo student WhatsApp not delivered (non-portal user) — fixed `80c6c85` |
| FIXED | `demo/requests` | Student WhatsApp showed raw ISO time (e.g. `2026-03-07T18:42:00.000Z`) — fixed `4cdca00` |
| FIXED | `CreateUserForm.tsx` | `examGradeToCategory`: grade C mapped to Category B instead of C — fixed `4cdca00` |
| FIXED | `demo-summary.ts` | Session duration always 0 min (attendance leave events race condition) — fixed `4cdca00` |
| FIXED | `StudentView.tsx` | Redundant teacher camera PIP overlay when camera is already full-screen — fixed `d9d9fb3` |
| FIXED | `ended/page.tsx` | Demo students redirected to `/student` dashboard after session ends — fixed `d9d9fb3` |
| FIXED | `AcademicOperatorDashboardClient.tsx` | Batch wizard student list not filtered by category — fixed `d9d9fb3` |
| FIXED | `session-extension` | CAST($2 AS integer) for interval math — fixed `ea7a47f` |
| FIXED | `session_payments` | Duplicate key on upsert — fixed `88b9ff0` |
| FIXED | `room_events` | `session_extended` not in CHECK constraint — fixed `c209cec` (migration 046) |
| FIXED | `room/[room_id]/route.ts` | Room grade empty → exam generation did nothing — fixed `47b75ef` (grade inheritance from batch) |
| FIXED | `StudentView.tsx` | studentEmail always empty due to wrong auth/me data path — fixed `4f58d3a` |

---

## Dev Commands

```bash
# ── Portal (Next.js) ──────────────────────────────
cd /Users/pydart/Projects/stibe-portal

npm run dev                    # Start dev server (Turbopack)
npx next build                 # Production build
npx tsc --noEmit               # Type check
npm run db:migrate             # Run migrations
npm run db:seed                # Seed test users
npm run db:reset               # Reset + re-migrate

# ── Deploy to production ──────────────────────────
git add -A && git commit -m "message" && git push origin master
ssh stibe-portal "cd /var/www/stibe-portal && git pull origin master && npm run build 2>&1 | tail -15 && pm2 restart stibe-portal"

# ── Access servers ────────────────────────────────
ssh stibe                    # Media server (76.13.244.54)
ssh stibe-portal             # Portal server (76.13.244.60)

# ── Database ──────────────────────────────────────
# Pipe SQL via stdin for quote safety:
echo "SELECT * FROM rooms LIMIT 5;" | ssh stibe-portal "sudo -u postgres psql -d stibe_portal"

# ── Database ownership note ───────────────────────
# Tables are owned by 'postgres', not 'stibe'.
# All DDL migrations must go through SSH:
cat migrations/046_session_extended.sql | ssh stibe-portal "sudo -u postgres psql -d stibe_portal"

# ── Teacher App (Flutter) ─────────────────────────
cd /Users/pydart/Projects/stibe-teacher

flutter run                    # Run on connected device
flutter build apk --release    # Build release APK
```
