# Academic Calendar → Auto-Session Scheduling

## Deep Analysis & Development Plan

---

## 1. CALENDAR DATA ANALYSIS

### 1.1 Files & Structure

6 Excel files covering 2 regions × 3 grades, academic year **March 2026 – February 2027**:

| File | Region | Grade | Board | Categories (Sheets) |
|------|--------|-------|-------|-------------------|
| GCC_8th_CBSE | GCC | 8 | CBSE | Average, Good, Excellent |
| GCC_9th_CBSE | GCC | 9 | CBSE | Average, Good, Excellent |
| GCC_10th_CBSE | GCC | 10 | CBSE | Average, Good, Excellent |
| STATE_8th | STATE | 8 | State Board | Average only |
| STATE_9th | STATE | 9 | State Board | Average only |
| STATE_10th | STATE | 10 | State Board | Average only |

**Total: 12 unique calendars** (9 GCC with 3 categories each + 3 State with 1 category each)

### 1.2 Calendar Grid Structure

Each sheet is a **12-month calendar grid** (March 2026 → Feb 2027):
- **Columns B–H** = Mon through Sun (weekly grid)
- **Cell format**: `"date_number\nSubject - TOPIC DETAIL"` (e.g., `"2\nPhysics - FORCE & PRESSURE PART 1"`)
- **Summary column** (K/L/M/N): Per-subject session counts + total (e.g., `PHY - 23`, `TOTAL - 114`)

### 1.3 Fixed Day-of-Week → Subject Mapping (ALL calendars)

This is the **most critical discovery**. Across ALL 12 calendars, the subject-to-day mapping is **identical and fixed**:

| Day | Subject | Notes |
|-----|---------|-------|
| **Monday** | Physics | Every Monday is Physics |
| **Tuesday** | Biology | Every Tuesday is Biology |
| **Wednesday** | Mathematics | Part 1/Part 2/Part 3 of topics |
| **Thursday** | Mathematics | Workout/next topic |
| **Friday** | Chemistry | Every Friday is Chemistry |
| **Saturday** | Special Class | Weekly exam or review class |
| **Sunday** | OFF | No sessions ever |

**4 subjects, 6 class days/week, Math gets 2 days (Wed+Thu)**

### 1.4 Session Types Found in Cells

| Type | Count Pattern | Description |
|------|--------------|-------------|
| `session` | Subject - TOPIC DETAIL | Regular teaching session with topic/portion |
| `special_class` | Special Class (EXAM ...) | Saturday exam review |
| `new_batch` | Special Class / New Batch / | Post-syllabus phase — reusable slot |
| `exam_special` | EXAM Special Class | February exam preparation |
| `holiday` | CHRISTMAS HOLIDAY | Only 1 holiday (Dec 25) |
| `empty` | Just date number | Sunday / blank day |

### 1.5 Academic Calendar Phases

Each calendar has **3 distinct phases**:

1. **Subject Sessions Phase** (Mar–Jul/Aug/Sep depending on category):
   - Mon–Fri: Regular subject sessions with specific topics
   - Saturday: Weekly exam/special class
   - Topics progress sequentially: PART 1 → PART 2 → PART 3 → WORKOUT

2. **New Batch / Revision Phase** (Aug/Sep–Jan):
   - All weekdays become "Special Class / New Batch"
   - These slots are available for new student batches or revision
   - Saturdays: Some special classes, some new batch

3. **Exam Phase** (February 2027):
   - All days (Mon–Sun): "EXAM Special Class"
   - Full month dedicated to final exam prep

### 1.6 Session Count Summary

| Calendar | Total Sessions | PHY | CHE | BIO | MATH | Special | Duration |
|----------|:-------------:|:---:|:---:|:---:|:----:|:-------:|----------|
| GCC Gr8 CBSE Average | 114 | 23 | 21 | 22 | 48 | 33 | Mar–Aug (6 mo) |
| GCC Gr8 CBSE Good | 110 | 23 | 21 | 22 | 44 | 32 | Mar–Aug (5.5 mo) |
| GCC Gr8 CBSE Excellent | 108 | 23 | 21 | 22 | 42 | 32 | Mar–Jul (5 mo) |
| GCC Gr9 CBSE Average | 112 | 22 | 22 | 16 | 52 | 35 | Mar–Aug (6 mo) |
| GCC Gr9 CBSE Good | 104 | 22 | 22 | 16 | 44 | 31 | Mar–Jul (5 mo) |
| GCC Gr9 CBSE Excellent | 104 | 22 | 22 | 16 | 44 | 31 | Mar–Jul (5 mo) |
| GCC Gr10 CBSE Average | 126 | 24 | 24 | 24 | 54 | 35 | Mar–Aug (6 mo) |
| GCC Gr10 CBSE Good | 112 | 20 | 20 | 20 | 52 | 31 | Mar–Aug (5 mo) |
| GCC Gr10 CBSE Excellent | 96 | 17 | 17 | 18 | 44 | 25 | Mar–Jul (4.5 mo) |
| STATE Gr8 Average | 129 | 24 | 23 | 22 | 60 | 39 | Mar–Sep (7 mo) |
| STATE Gr9 Average | 157 | 34 | 33 | 32 | 58 | 44 | Mar–Oct (8 mo) |
| STATE Gr10 Average | 148* | 30 | 30 | 29 | 59 | 40 | Mar–Sep (7 mo) |

**Key insight**: "Category" controls how many sessions = how fast the syllabus is covered.
- **Average** = most sessions, slowest pace (6+ months)
- **Excellent** = fewest sessions, fastest pace (4.5 months)
- Only **GCC CBSE** has all 3 categories. **State Board** has only Average.

### 1.7 Topic/Portion Data

Each session has a **specific topic** with progressive structure:
```
Physics - FORCE & PRESSURE PART 1
Physics - FORCE & PRESSURE PART 2
Physics - FORCE & PRESSURE PART 3
Physics - FORCE & PRESSURE PART 4
Physics - FORCE & PRESSURE WORKOUT     ← Review/practice
Physics - FRICTION PART 1              ← Next chapter
...
```

Saturday special classes reference chapter exams:
```
Special Class (MATHS EXAM CHAPTER - 1)
Special Class (BIOLOGY EXAM CHAPTER -1)
Special Class (MATHS EXAM CHAPTER - 2)
Special Class (CHEMISTRY EXAM CHAPTER - 1)
Special Class (PHYSICS EXAM CHAPTER - 1)
```

---

## 2. EXISTING SYSTEM ANALYSIS (How Batch Sessions Work Today)

### 2.1 Current Session Creation Flow

```
AO Dashboard → Select Batch → "Session" tab → Add Session form
  ↓
Fill: subject, teacher, date, time, duration
  ↓
POST /api/v1/batch-sessions (one at a time)
  ↓
Backend: validate conflicts, create batch_sessions row
  ↓
scheduleTimetableUpdate() → 30s debounce → email timetable to all
```

**For recurring**: Frontend loops over dates, calls POST N times with same `schedule_group_id`

### 2.2 Key Tables Involved

- `batches` — has `grade`, `board`, `subjects[]`, `batch_type`
- `batch_sessions` — individual sessions with `subject`, `topic`, `scheduled_date`, `start_time`, `schedule_group_id`
- `batch_teachers` — which teacher teaches which subject in the batch
- `invoices` — combined per `schedule_group_id`
- `session_payments` — per-session per-student tracking
- `student_session_credits` — prepaid session balance
- `enrollment_fee_structure` — fee lookup by region/board/batch_type/grade

### 2.3 Invoice Generation Flow

```
Sessions created with schedule_group_id
  ↓
POST /api/v1/batch-sessions/finalize-invoices { schedule_group_id }
  ↓
For each student:
  1. Lookup fee (enrollment_fee_structure → session_fee_rates)
  2. Check prepaid credits per subject
  3. Consume credits, mark prepaid sessions
  4. Create invoice for billable remainder
  5. Create session_payment rows
  ↓
Send invoice emails
```

### 2.4 What's Missing for Calendar Feature

1. **No academic calendar storage** — calendars exist only in Excel files
2. **No automatic session generation** — AO manually adds each session
3. **No topic/portion tracking** — sessions have optional `topic` field but it's manually entered
4. **No category awareness** — system doesn't know Average/Good/Excellent
5. **No "Apply Calendar" workflow** — no way to bulk-create sessions from a template

---

## 3. FEATURE DESIGN: Academic Calendar Auto-Session Scheduling

### 3.1 Concept

When an AO selects a batch and clicks "Auto-Schedule from Calendar", the system should:
1. Match the batch to the correct calendar (based on batch's region, grade, board)
2. Show the matched calendar with session counts and topics
3. Let AO select a category (Average/Good/Excellent) if multiple exist
4. Let AO assign a time slot per day-of-week (Mon=10:00 AM, Tue=11:00 AM, etc.)
5. Let AO map teachers to subjects (auto-filled from `batch_teachers` if already assigned)
6. Generate ALL sessions in one click with:
   - Correct dates, subjects, topics/portions
   - Saturday special classes
   - Schedule group for combined invoicing
   - Teacher assignments
7. Show preview with total sessions, per-subject breakdown, estimated fees
8. On confirm: bulk-create all sessions, generate invoices, send timetable

### 3.2 Database Schema

#### New Table: `academic_calendars`
```sql
CREATE TABLE academic_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2026-27',
  region TEXT NOT NULL,              -- 'GCC' or 'STATE'
  grade TEXT NOT NULL,               -- '8', '9', '10'
  board TEXT NOT NULL,               -- 'CBSE' or 'State Board'
  category TEXT NOT NULL,            -- 'Average', 'Good', 'Excellent'
  start_date DATE NOT NULL,          -- 2026-03-02
  end_date DATE NOT NULL,            -- 2027-02-28
  total_sessions INT NOT NULL,       -- 114
  summary JSONB NOT NULL,            -- {"PHY": 23, "CHE": 21, "BIO": 22, "MATH": 48, "TOTAL": 114}
  source_file TEXT,                  -- original xlsx filename
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (academic_year, region, grade, board, category)
);
```

#### New Table: `academic_calendar_sessions`
```sql
CREATE TABLE academic_calendar_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES academic_calendars(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,         -- 'Mon', 'Tue', etc.
  subject TEXT,                      -- 'Physics', 'Chemistry', 'Biology', 'Mathematics', NULL for special
  topic TEXT,                        -- 'FORCE & PRESSURE PART 1'
  session_type TEXT NOT NULL,        -- 'session', 'special_class', 'new_batch', 'exam_special', 'holiday'
  session_order INT NOT NULL,        -- Sequential number within calendar (1, 2, 3...)
  subject_session_number INT,        -- Per-subject sequence (Physics #1, #2, #3...)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (calendar_id, session_date)
);
```

#### New Table: `calendar_schedule_runs` (audit log)
```sql
CREATE TABLE calendar_schedule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES academic_calendars(id),
  batch_id TEXT NOT NULL REFERENCES batches(batch_id),
  schedule_group_id TEXT NOT NULL,    -- Links to batch_sessions created
  created_by TEXT NOT NULL,           -- AO email
  sessions_created INT NOT NULL,
  special_sessions_created INT DEFAULT 0,
  time_slots JSONB NOT NULL,         -- {"Mon": "10:00", "Tue": "11:00", ...}
  teacher_map JSONB NOT NULL,        -- {"Physics": "teacher@email", "Chemistry": "teacher2@email"}
  include_special_classes BOOLEAN DEFAULT TRUE,
  include_new_batch BOOLEAN DEFAULT FALSE,
  include_exam_special BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 API Endpoints

#### `GET /api/v1/academic-calendars`
List available calendars. Filter by `region`, `grade`, `board`.
Returns calendar metadata + summary counts.

#### `GET /api/v1/academic-calendars/:id/sessions`
Get all sessions for a specific calendar. Used to show preview.

#### `GET /api/v1/academic-calendars/match?batch_id=xxx`
Auto-match a batch to its calendar(s) based on batch's grade + board.
Region derived from batch's student profiles or batch coordinator's region.
Returns matching calendar(s) with category options.

#### `POST /api/v1/academic-calendars/import`
Admin-only. Import calendars from parsed JSON (run Python parser → upload JSON).
Idempotent: UPSERT based on (academic_year, region, grade, board, category).

#### `POST /api/v1/academic-calendars/schedule`
Main endpoint. Auto-create sessions from calendar for a batch.
```typescript
Body: {
  calendar_id: string,           // Which calendar to use
  batch_id: string,              // Which batch
  time_slots: {                  // Time per day
    Mon: "10:00",
    Tue: "11:00",
    Wed: "14:00",
    Thu: "14:00",
    Fri: "10:00",
    Sat: "10:00"
  },
  teacher_map: {                 // Teacher per subject
    Physics: "teacher1@email.com",
    Chemistry: "teacher2@email.com",
    Biology: "teacher3@email.com",
    Mathematics: "teacher4@email.com"
  },
  include_special_classes: boolean,  // Include Saturday sessions
  include_new_batch: boolean,        // Include new batch phase sessions
  include_exam_special: boolean,     // Include Feb exam sessions
  duration_minutes?: number,         // Default 90
  start_from_date?: string,          // Skip sessions before this date (for mid-year joins)
  dry_run?: boolean                  // Preview only, don't create
}

Response (dry_run=true):
{
  success: true,
  data: {
    preview: {
      total_sessions: 147,
      per_subject: { Physics: 23, Chemistry: 21, Biology: 22, Mathematics: 48, "Special Class": 33 },
      date_range: { start: "2026-03-02", end: "2027-01-30" },
      estimated_fee_per_student: { amount_paise: 102600, currency: "INR", breakdown: "..." },
      conflicts: [],
      calendar_summary: {...}
    }
  }
}

Response (dry_run=false):
{
  success: true,
  data: {
    schedule_group_id: "grp_cal_xxx",
    sessions_created: 147,
    run_id: "uuid",
    message: "147 sessions created from GCC 8th CBSE Average calendar"
  }
}
```

### 3.4 Frontend UI Flow

#### Step 1: Calendar Selection (in AO Dashboard → Batch → Sessions tab)
```
[Auto-Schedule from Calendar] button
  ↓
Modal/Drawer opens
  ↓
Auto-detect: "Batch 'GCC 8A Physics' → Grade 8, CBSE"
  ↓
Show matching calendars:
  ┌─────────────────────────────────────────────────────┐
  │ 📅 GCC 8th CBSE Academic Calendar 2026-27           │
  │                                                     │
  │ Select Category:                                    │
  │ ○ Average (114 sessions, ~6 months, Mar-Aug)        │
  │ ○ Good (110 sessions, ~5.5 months, Mar-Aug)         │
  │ ○ Excellent (108 sessions, ~5 months, Mar-Jul)      │
  │                                                     │
  │ Per-Subject Breakdown:                              │
  │ ┌──────────┬──────┬──────┬──────┐                   │
  │ │          │ Avg  │ Good │ Exc  │                   │
  │ │ Physics  │  23  │  23  │  23  │                   │
  │ │ Chemistry│  21  │  21  │  21  │                   │
  │ │ Biology  │  22  │  22  │  22  │                   │
  │ │ Maths    │  48  │  44  │  42  │                   │
  │ │ Special  │  33  │  32  │  32  │                   │
  │ │ TOTAL    │ 114  │ 110  │ 108  │                   │
  │ └──────────┴──────┴──────┴──────┘                   │
  └─────────────────────────────────────────────────────┘
```

#### Step 2: Time Slot & Teacher Assignment
```
  ┌─────────────────────────────────────────────────────┐
  │ Configure Schedule                                  │
  │                                                     │
  │ Day        Subject       Time      Teacher          │
  │ ─────────────────────────────────────────────       │
  │ Monday     Physics       [10:00 ▼] [Mr. Kumar ▼]   │
  │ Tuesday    Biology       [11:00 ▼] [Ms. Priya ▼]   │
  │ Wednesday  Mathematics   [14:00 ▼] [Mr. Singh ▼]   │
  │ Thursday   Mathematics   [14:00 ▼] [Mr. Singh ▼]   │
  │ Friday     Chemistry     [10:00 ▼] [Dr. Rao  ▼]    │
  │ Saturday   Special Class [10:00 ▼] [Rotating  ▼]   │
  │                                                     │
  │ Duration: [90 min ▼]  Teaching: [75 min ▼]          │
  │                                                     │
  │ ☑ Include Saturday Special Classes (33 sessions)    │
  │ ☐ Include New Batch/Revision Phase                  │
  │ ☐ Include February Exam Phase                       │
  │                                                     │
  │ Start from: [2026-03-02 📅] (default: calendar start)│
  └─────────────────────────────────────────────────────┘
```

#### Step 3: Preview & Confirm
```
  ┌─────────────────────────────────────────────────────┐
  │ Preview: 147 sessions will be created               │
  │                                                     │
  │ 📊 Summary:                                         │
  │   Physics:     23 sessions (Mon 10:00 AM)           │
  │   Biology:     22 sessions (Tue 11:00 AM)           │
  │   Mathematics: 48 sessions (Wed+Thu 2:00 PM)        │
  │   Chemistry:   21 sessions (Fri 10:00 AM)           │
  │   Special:     33 sessions (Sat 10:00 AM)           │
  │                                                     │
  │ 📅 Date Range: Mar 2, 2026 → Jan 30, 2027          │
  │ 💰 Est. Fee/Student: ₹1,026 (₹9/session × 114)    │
  │ ⚠️ Conflicts: None                                   │
  │                                                     │
  │ Topics include:                                     │
  │   Physics: FORCE & PRESSURE → FRICTION → SOUND →   │
  │            LIGHT → SOLAR SYSTEM                     │
  │   Maths: RATIONAL NUMBER → LINEAR EQN → ...        │
  │                                                     │
  │ [Cancel]  [← Back]  [🚀 Create All Sessions]       │
  └─────────────────────────────────────────────────────┘
```

#### Step 4: Post-Creation
```
  ┌─────────────────────────────────────────────────────┐
  │ ✅ 147 sessions created successfully!                │
  │                                                     │
  │ Schedule Group: grp_cal_1713038400                  │
  │                                                     │
  │ [Generate Invoices]  [View Sessions]  [Close]       │
  └─────────────────────────────────────────────────────┘
```

### 3.5 Calendar → Session Mapping Logic

```typescript
for each calendar_session in selected_calendar:
  if session_type === 'session':
    subject = calendar_session.subject       // "Physics"
    topic = calendar_session.topic           // "FORCE & PRESSURE PART 1"
    teacher = teacher_map[subject]           // from user config
    time = time_slots[calendar_session.day]  // "10:00"
    
    → Create batch_session {
      batch_id, subject, teacher_email: teacher,
      scheduled_date: calendar_session.session_date,
      start_time: time,
      topic: topic,                          // ← Auto-filled from calendar!
      schedule_group_id,
      duration_minutes
    }
    
  if session_type === 'special_class' && include_special_classes:
    // Saturday exam/review session
    → Create batch_session {
      batch_id, subject: "Special Class",
      topic: calendar_session.topic,  // "MATHS EXAM CHAPTER - 1"
      scheduled_date, start_time: time_slots.Sat,
      schedule_group_id
    }
```

### 3.6 How Batch Matches Calendar

```
Batch attributes needed for matching:
  - grade (8, 9, 10) → matches calendar grade
  - board (CBSE, State Board) → matches calendar board
  - region: derived from:
    1. batch.coordinator_email → user_profiles.assigned_region → GCC/STATE
    2. OR first student's assigned_region
    3. OR manual selection
```

### 3.7 Conflict Handling

Before creating sessions:
1. **Teacher max 4/day**: Group by teacher+date, flag days exceeding 4
2. **Time overlap**: Check teacher's existing sessions for same date+time
3. **Batch overlap**: Check if batch already has sessions on any calendar date
4. **Show conflicts in preview**: Let AO adjust times or skip conflicting dates

---

## 4. IMPLEMENTATION PLAN

### Phase 1: Database & Calendar Import
- [ ] Migration: Create `academic_calendars` + `academic_calendar_sessions` + `calendar_schedule_runs` tables
- [ ] Python parser script → export JSON
- [ ] `POST /api/v1/academic-calendars/import` API to seed calendar data
- [ ] `GET /api/v1/academic-calendars` list API
- [ ] `GET /api/v1/academic-calendars/:id/sessions` detail API
- [ ] `GET /api/v1/academic-calendars/match` batch-matching API

### Phase 2: Auto-Schedule API
- [ ] `POST /api/v1/academic-calendars/schedule` with dry_run support
- [ ] Conflict detection logic
- [ ] Bulk session creation with topics
- [ ] Integration with existing `schedule_group_id` and invoice flow
- [ ] Teacher assignment validation

### Phase 3: Frontend UI
- [ ] "Auto-Schedule from Calendar" button in AO Dashboard batch view
- [ ] Calendar selection + category picker
- [ ] Time slot + teacher mapping form
- [ ] Preview panel with session breakdown, topics, fee estimate
- [ ] Confirm + create flow
- [ ] Post-creation: direct link to finalize invoices

### Phase 4: Polish & Edge Cases
- [ ] Mid-year joins: `start_from_date` support
- [ ] Calendar management UI (owner): view/upload/deactivate calendars
- [ ] Handle batch with no matching calendar gracefully
- [ ] Session cancellation cascading (if calendar session cancelled)
- [ ] Timetable email auto-trigger after bulk create

---

## 5. TECHNICAL DECISIONS

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Calendar storage | DB tables, not Excel runtime | Excel is import-time only; DB enables querying, matching |
| Import flow | Python → JSON → API seed | Excel parsing too complex for Node; JSON intermediate is portable |
| Category selection | User choice in UI | Can't auto-detect; AO assigns based on student ability |
| Region detection | From batch coordinator profile | Most reliable; fallback to manual |
| Schedule group | Single group per calendar run | Enables 1 invoice per student for entire year |
| Saturday sessions | Optional checkbox | Not all batches want special classes |
| Topic field | Auto-populated from calendar | Major UX win — no manual topic entry |
| Conflict handling | Preview-time warnings | Don't block; let AO decide |
| New Batch phase | Excluded by default | These are placeholder slots, not real sessions |
| Exam phase | Excluded by default | February is a separate planning concern |

---

## 6. KEY DATA FOR IMPLEMENTATION

### Subject → Day Mapping (hardcoded, all calendars)
```typescript
const DAY_SUBJECT_MAP: Record<string, string> = {
  Mon: 'Physics',
  Tue: 'Biology',
  Wed: 'Mathematics',
  Thu: 'Mathematics',
  Fri: 'Chemistry',
  Sat: 'Special Class',
};
```

### Calendar Selection Matrix
```
batch.grade='8' + batch.board='CBSE' → GCC_8_CBSE (3 categories available)
batch.grade='8' + batch.board='State Board' → STATE_8 (1 category: Average)
batch.grade='9' + batch.board='CBSE' → GCC_9_CBSE (3 categories available)
batch.grade='9' + batch.board='State Board' → STATE_9 (1 category: Average)
batch.grade='10' + batch.board='CBSE' → GCC_10_CBSE (3 categories available)
batch.grade='10' + batch.board='State Board' → STATE_10 (1 category: Average)
```

### Region Logic
```
GCC regions: Dubai, Abu Dhabi, Sharjah, Ajman, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman
STATE regions: Kerala (and any non-GCC region)
```
