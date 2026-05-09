# Phase 18 — New Fee Structure + Full Enrollment Registration Form

**Status**: ✅ COMPLETE — all items implemented and deployed

---

## Research Summary

### Current System State
- `session_fee_rates` table: keyed by `batch_id + subject + grade + currency`, stores `per_hour_rate_paise`
- `enrollment_links` table: `student_name, student_email, student_phone, student_grade, selected_subjects[], minimum_sessions, amount_paise, status`
- Current enrollment flow: student clicks WhatsApp link → selects subjects → pays `rate × 50 sessions × subjects`
- Fee dashboard: Tabs — Invoices, Session Payments, Session Rates, Add Rate, Extra Time Rates. No concept of region/board/batch_type in rates.

### New Fee Structure (2026-27)
Source: `public/fee-structure-2026-27.json` (complete, no category missing)

| Category | Batch Type | Grade 8 | Grade 9 | Grade 10 | HSS (11/12) | Unit |
|---|---|---|---|---|---|---|
| GCC CBSE | 1:1 | ₹700 | ₹800 | ₹900 | ₹1,000 | per session |
| GCC CBSE | 1:3 | ₹450 | ₹500 | ₹550 | ₹600 | per session |
| GCC CBSE | 1:15 | ₹40,000 | ₹50,000 | ₹60,000 | ₹60,000 | per year |
| Kerala CBSE | 1:1 | ₹700 | ₹800 | ₹900 | ₹1,000 | per session |
| Kerala CBSE | 1:3 | ₹450 | ₹500 | ₹550 | ₹600 | per session |
| Kerala CBSE | 1:30 | ₹30,000 | ₹33,000 | ₹36,000 | ₹39,000 | per year |
| Kerala State | 1:1 | ₹700 | ₹800 | ₹900 | ₹1,000 | per session |
| Kerala State | 1:3 | ₹450 | ₹500 | ₹550 | ₹600 | per session |
| Kerala State | 1:15 | ₹20,000 | ₹25,000 | ₹30,000 | ₹30,000 | per year |
| Kerala State | 1:50-1:100 | ₹11,000 | ₹11,500 | ₹12,000 | ₹14,000 | per year |

**Key rules:**
- GCC countries (Dubai, Abu Dhabi, Sharjah, Ajman, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman) → always GCC CBSE
- India (Kerala) + CBSE board → Kerala CBSE
- India (Kerala) + State Board → Kerala State  
- Other regions → default to Kerala/CBSE pricing
- Session-based (1:1, 1:3): fee per session per subject × minimum_sessions
- Annual (1:15, 1:30, 1:50-1:100): flat annual fee, covers all subjects, no subject selection

### Student Form Fields (from academic-operator CreateUserForm)
**Basic**: full_name, email, phone, whatsapp, dob
**Academic**: grade (Class 1-12), board (CBSE/State Board/etc), region (from STUDENT_REGIONS), section
**Guardian**: parent_name, parent_email, parent_phone, parent_password

### Available Constants
- **STUDENT_REGIONS**: Dubai, Abu Dhabi, Sharjah, Ajman, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, India, Malaysia, Singapore, UK, USA, Other
- **BOARDS**: CBSE, ICSE, ISC, State Board, IB, IGCSE, NIOS, SSC, HSC, Matriculation, Anglo Indian, Others
- **BATCH_TYPE_LABELS**: one_to_one→1:1, one_to_three→1:3, one_to_five→1:5, one_to_many→1:15, lecture→Lecture, custom→Custom
- Need to add: `one_to_thirty` → 1:30

---

## Implementation Plan

### Step 1 — DB Migration 061 (stibe) ✅ JSON already done

**New table: `enrollment_fee_structure`**
```sql
CREATE TABLE enrollment_fee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL DEFAULT '2026-27',
  region_group  TEXT NOT NULL,   -- 'GCC' | 'Kerala'
  board         TEXT NOT NULL,   -- 'CBSE' | 'State Board'
  batch_type    TEXT NOT NULL,   -- 'one_to_one' | 'one_to_three' | 'one_to_many' | 'one_to_thirty' | 'lecture'
  grade         TEXT NOT NULL,   -- '8' | '9' | '10' | '11' | '12'
  fee_paise     INT  NOT NULL,
  fee_unit      TEXT NOT NULL,   -- 'session' | 'year'
  currency      TEXT NOT NULL DEFAULT 'INR',
  is_active     BOOL NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year, region_group, board, batch_type, grade)
);
-- seed all 50 rows from fee-structure-2026-27.json
```

**Add columns to `enrollment_links`:**
```sql
ALTER TABLE enrollment_links
  ADD COLUMN student_whatsapp       TEXT,
  ADD COLUMN student_section        TEXT,
  ADD COLUMN student_board          TEXT,
  ADD COLUMN student_region         TEXT,
  ADD COLUMN student_parent_name    TEXT,
  ADD COLUMN student_parent_email   TEXT,
  ADD COLUMN student_parent_phone   TEXT,
  ADD COLUMN preferred_batch_type   TEXT,
  ADD COLUMN enrollment_region_group TEXT,  -- derived: 'GCC' | 'Kerala'
  ADD COLUMN enrollment_category    TEXT;   -- derived: 'GCC_CBSE' | 'KERALA_CBSE' | 'KERALA_STATE'
```

---

### Step 2 — New lib/enrollment-fee.ts (stibe)

Pure function helpers:
- `getRegionGroup(region: string): 'GCC' | 'Kerala'`  
- `getEnrollmentCategory(region: string, board: string): 'GCC_CBSE' | 'KERALA_CBSE' | 'KERALA_STATE'`
- `getAvailableBatchTypes(category: string): string[]`
- `isSessionBased(batchType: string): boolean`
- `lookupFee(category, batchType, grade, db): Promise<{fee_paise, fee_unit}>`

---

### Step 3 — API Updates (stibe)

**GET /api/v1/enroll/[linkId]** — extend response:
```json
{
  "link": {
    "student_name": "...",
    "student_email": "...",
    "student_phone": "...",
    "student_grade": "...",
    "student_board":  null,
    "student_region": null,
    "preferred_batch_type": null
  },
  "fee_structure": [...],         // full enrollment_fee_structure rows
  "subjects": [...],              // existing session_fee_rates (used for session-based subject selection)
  "constants": {
    "student_regions": [...],
    "boards": [...],
    "batch_types": {
      "GCC_CBSE": ["one_to_one","one_to_three","one_to_many"],
      ...
    }
  }
}
```

**PATCH /api/v1/enroll/[linkId]** — NEW endpoint, save student profile before payment:
```json
{
  "student_name": "...",
  "student_email": "...",
  "student_phone": "...",
  "student_whatsapp": "...",
  "student_board": "CBSE",
  "student_region": "Dubai",
  "student_section": "A",
  "student_parent_name": "...",
  "student_parent_email": "...",
  "student_parent_phone": "...",
  "preferred_batch_type": "one_to_one",
  "student_grade": "Class 9"
}
```
→ Updates enrollment_links, sets `enrollment_region_group` and `enrollment_category`, returns fee lookup result

**POST /api/v1/enroll/[linkId]** — updated to handle both annual + session-based:
- For annual: `selected_subjects = []`, looks up annual fee from `enrollment_fee_structure`
- For session-based: existing logic, looks up per-subject rate, total = rate × sessions × subject_count
- Fails if profile not yet saved (board/region not set)

---

### Step 4 — New Multi-step EnrollmentClient

Replace current single-screen EnrollmentClient with a 5-step wizard.

**File**: `app/enroll/[linkId]/EnrollmentClient.tsx`

**Steps:**
1. **Personal Details** — pre-fill from link data
   - Full Name (editable)
   - Email (editable)
   - Phone (editable)
   - WhatsApp Number (optional, defaults to phone)

2. **Academic Details** — determines fee category
   - Grade (pre-fill from CRM, dropdown: Class 8–12 only as per fee structure, with fallback for other grades)
   - Board (dropdown: CBSE / State Board / etc.)
   - Region (dropdown: full STUDENT_REGIONS list)
   - Section (optional text)
   - Batch Type Preference (radio buttons, dynamically filtered by derived region+board category)
     - Shows human labels: "1:1 Individual", "1:3 Small Group", "1:15 Group Class", etc.
     - Annual vs session-based clearly labeled

3. **Parent / Guardian Details**
   - Parent / Guardian Name (required)
   - Parent Email (required)
   - Parent Phone (optional)

4. **Subject Selection** (conditional — only shown for session-based 1:1 / 1:3)
   - Checkbox list of subjects
   - Live fee calc: `₹{rate} × {sessions} sessions × {n} subjects = ₹{total}`
   - Skipped entirely for annual batch types

5. **Fee Summary + Payment**
   - For session-based: shows per-subject breakdown + total
   - For annual: shows "₹{fee}/year — All subjects included" + grade
   - Razorpay checkout button
   - "Enrollment includes a minimum of 50 sessions" note (session-based only)

**UX notes:**
- Step progress bar at top (1–5 or 1–4 if annual)
- Each step validated before advancing
- Back button on each step
- On successful payment: thank-you screen with student name + "Our team will contact you within 24 hours"

---

### Step 5 — Update lib/payment.ts completePayment()

When enrollment invoice is paid, populate portal user more completely:
- `user_profiles.board` ← `enrollment_links.student_board`
- `user_profiles.assigned_region` ← `enrollment_links.student_region`
- `user_profiles.subjects` ← `enrollment_links.selected_subjects` (or all for annual)
- Create `portal_users` for parent if `student_parent_email` is set (role=parent)
- `user_profiles.parent_email` ← `enrollment_links.student_parent_email`

---

### Step 6 — Owner Fee Dashboard — New Tab

Add "Enrollment Fee Structure" tab to `app/(portal)/owner/fees/FeesClient.tsx`:

- Tab key: `'enrollment-fees'`
- Shows matrix grouped by category (GCC CBSE / Kerala CBSE / Kerala State)
- Each category: table of batch_type × grade with fee amounts
- Color coding: session-based (green), annual (blue)
- "Manage" button → opens crud modal to edit a specific rate
- Add Rate button → form to add/edit via `enrollment_fee_structure` CRUD API

**New API needed**: `GET/POST/PUT/DELETE /api/v1/payment/enrollment-fees`
- Owner/HR only
- CRUD for `enrollment_fee_structure` rows

---

### Step 7 — Update External API (create-enrollment-link)

`POST /api/v1/external/create-enrollment-link` — accept optional extra fields from CRM:
- `student_board?: string`
- `student_region?: string`

So if CRM already knows the student's region (from WhatsApp/lead data), it can pre-fill these.

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `public/fee-structure-2026-27.json` | ✅ DONE — complete fee structure reference |
| `migrations/061_enrollment_fee_structure.sql` | DB migration — new table + enrollment_links columns |
| `lib/enrollment-fee.ts` | Pure helper: region → category, fee lookup |
| `app/api/v1/payment/enrollment-fees/route.ts` | CRUD API for enrollment_fee_structure (owner/HR) |

### Modified Files
| File | Change |
|------|--------|
| `app/api/v1/enroll/[linkId]/route.ts` | GET: extend response; PATCH: new handler; POST: handle annual + use profile |
| `app/enroll/[linkId]/EnrollmentClient.tsx` | Full rewrite — multi-step wizard |
| `app/enroll/[linkId]/page.tsx` | Pass extended data to client |
| `app/(portal)/owner/fees/FeesClient.tsx` | Add "Enrollment Fees" tab |
| `lib/payment.ts` | Populate more profile fields on enrollment payment |
| `app/api/v1/external/create-enrollment-link/route.ts` | Accept board/region optionally |

---

## Build Order

1. [x] Migration 061 SQL — write + apply on server
2. [x] `lib/enrollment-fee.ts` — helpers (118 lines)
3. [x] `app/api/v1/payment/enrollment-fees/route.ts` — CRUD (GET/POST/DELETE)
4. [x] `app/api/v1/enroll/[linkId]/route.ts` — GET + PATCH + POST updates (~310 lines)
5. [x] `app/enroll/[linkId]/EnrollmentClient.tsx` — 5-step wizard (884 lines)
6. [x] `app/enroll/[linkId]/page.tsx` — pass extended props (133 lines)
7. [x] `app/(portal)/owner/fees/FeesClient.tsx` — "Enrollment Fees" tab added
8. [x] `lib/payment.ts` — enrich profile on payment (~1650 lines total)
9. [x] `app/api/v1/external/create-enrollment-link/route.ts` — accepts board/region/manually_paid
10. [x] TypeScript check + build + deploy

---

## Review Section

### Implementation Summary (Completed)

**Migration 061** — `enrollment_fee_structure` table created with 50 seed rows covering all 3 categories (GCC CBSE, Kerala CBSE, Kerala State) × 5 grades × batch types. `enrollment_links` extended with 11 new columns for student profile, parent info, and derived category fields.

**lib/enrollment-fee.ts** (118 lines) — Pure helpers:
- `STUDENT_REGIONS` (15 regions), `ENROLLMENT_BOARDS`, `ELIGIBLE_GRADES` (8–12)
- `BATCH_TYPE_LABELS` — 6 types with human-readable labels
- `getRegionGroup()` → GCC / Kerala
- `getEnrollmentCategory()` → GCC_CBSE / KERALA_CBSE / KERALA_STATE
- `getAvailableBatchTypes()` → filtered by category
- `isSessionBased()` → true for one_to_one, one_to_three
- `normalizeGrade()` → strips "Class " prefix
- `getSubjectsForGradeBoard()` → CBSE (Hindi) vs State Board (Malayalam) subject maps

**Enrollment API** (GET/PATCH/POST) — Full 3-endpoint flow:
- GET returns link data + fee structure + subjects + constants
- PATCH saves student profile, derives region_group + category
- POST creates invoice — session-based: `fee × 50 sessions` per subject; annual: flat fee_paise

**EnrollmentClient.tsx** (884 lines) — 5-step wizard:
1. Personal Details (name, email, phone, WhatsApp)
2. Academic Details (grade, board, region, section, batch type preference)
3. Parent/Guardian Details (name, email, phone)
4. Subject Selection (session-based only; skipped for annual)
5. Fee Summary + Razorpay Payment

**Owner Fees Dashboard** — "Enrollment Fees" tab in `/owner/fees`:
- Grouped display by region+board category
- Per-grade × per-batch-type matrix with fee amounts
- Full CRUD via `/api/v1/payment/enrollment-fees` (owner/HR auth)

**Payment Completion** — `completePayment()` enriches profiles:
- Creates student `portal_users` + full `user_profiles` (board, region, category, address, DOB, section)
- Creates parent account if parent email provided
- Resolves student category from demo exam grades
- Creates prepaid session credits via `createSessionCreditsFromEnrollment()`
- Sends welcome emails + CRM webhook

**External API** — `create-enrollment-link` accepts `student_board`, `student_region`, plus `manually_paid` mode for offline CRM enrollment.

### Fee Structure Reference (2026-27)

| Category | Batch Type | Grade 8 | Grade 9 | Grade 10 | Grade 11 | Grade 12 | Unit |
|---|---|---:|---:|---:|---:|---:|---|
| GCC CBSE | 1:1 | ₹700 | ₹800 | ₹900 | ₹1,000 | ₹1,000 | /session |
| GCC CBSE | 1:3 | ₹450 | ₹500 | ₹550 | ₹600 | ₹600 | /session |
| GCC CBSE | 1:15 | ₹40,000 | ₹50,000 | ₹60,000 | ₹60,000 | ₹60,000 | /year |
| Kerala CBSE | 1:1 | ₹700 | ₹800 | ₹900 | ₹1,000 | ₹1,000 | /session |
| Kerala CBSE | 1:3 | ₹450 | ₹500 | ₹550 | ₹600 | ₹600 | /session |
| Kerala CBSE | 1:30 | ₹30,000 | ₹33,000 | ₹36,000 | ₹39,000 | ₹39,000 | /year |
| Kerala State | 1:1 | ₹700 | ₹800 | ₹900 | ₹1,000 | ₹1,000 | /session |
| Kerala State | 1:3 | ₹450 | ₹500 | ₹550 | ₹600 | ₹600 | /session |
| Kerala State | 1:15 | ₹20,000 | ₹25,000 | ₹30,000 | ₹30,000 | ₹30,000 | /year |
| Kerala State | 1:50–1:100 | ₹11,000 | ₹11,500 | ₹12,000 | ₹14,000 | ₹14,000 | /year |

**50 total rows** seeded in `enrollment_fee_structure` table (migration 061).

### Key Files

| File | Lines | Status |
|------|------:|--------|
| `migrations/061_enrollment_fee_structure.sql` | — | ✅ Applied |
| `public/fee-structure-2026-27.json` | 182 | ✅ Reference data |
| `lib/enrollment-fee.ts` | 118 | ✅ Pure helpers |
| `app/api/v1/enroll/[linkId]/route.ts` | ~310 | ✅ GET/PATCH/POST |
| `app/api/v1/payment/enrollment-fees/route.ts` | — | ✅ CRUD (owner/HR) |
| `app/enroll/[linkId]/EnrollmentClient.tsx` | 884 | ✅ 5-step wizard |
| `app/enroll/[linkId]/page.tsx` | 133 | ✅ SSR + props |
| `app/(portal)/owner/fees/FeesClient.tsx` | — | ✅ Enrollment tab |
| `lib/payment.ts` | ~1650 | ✅ Profile enrichment |
| `app/api/v1/external/create-enrollment-link/route.ts` | — | ✅ board/region/manual |
