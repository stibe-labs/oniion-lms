# Code Changes Needed — Role Workflow Corrections

**Date:** 28 April 2026
**Priority:** 🟡 Important — implement before launch
**Context:** The target workflow has AO handling batch creation + coordinator assignment only;
BC handles day-to-day session scheduling. The current codebase has AO doing session scheduling
instead of BC. These changes bring the code in line with the intended role design.

---

## Summary of Target Role Boundaries

| Responsibility | Target Role | Current State |
|---|---|---|
| Batch creation | AO only | ✅ AO only (correct) |
| Assign coordinators to batches | AO only | ✅ AO only (correct) |
| Session scheduling (create/edit/cancel/recurring) | BC only | ❌ AO does it (needs move) |
| Teacher assignment per session | BC only | ❌ AO does it (needs move) |
| Academic calendar creation / topics | AO + Teacher | ✅ AO + Teacher (correct) |
| Live monitoring + go-live approval | BC only | ✅ BC only (correct) |

---

## Change 1 — Add Session Scheduling to BC Dashboard

**File:** `components/dashboard/BCDashboard.tsx`
**Status:** 🔴 Feature missing — needs to be built

### What to add
Add a **Sessions tab** to the BC dashboard with the following capabilities:

1. **Session list** — show all sessions for BC's assigned batches (date, time, batch, teacher, status)
2. **Create session modal** — fields:
   - Batch (dropdown — BC's assigned batches only)
   - Date + Time
   - Duration (minutes)
   - Subject
   - Teacher (dropdown — teachers assigned to that batch)
   - Link to academic calendar topic (optional)
   - Recurring toggle (daily/weekly, N weeks)
3. **Edit session** — reschedule date/time, change teacher
4. **Cancel session** — with reason; triggers student + parent notification
5. **Assign teacher per session** (separate from batch-level teacher assignment)

### Nav entry to add
**File:** `lib/nav-config.ts`
```typescript
// In BATCH_COORDINATOR_NAV array, add:
{ label: 'Sessions', hash: 'sessions', icon: CalendarIcon }
```

---

## Change 2 — Remove Session Scheduling from AO Dashboard

**File:** `components/dashboard/AcademicOperatorDashboard.tsx`
**Status:** 🟡 AO has session scheduling today; needs to be removed once BC scheduling is live

### What to remove / hide
- Remove the "New Session" / "Create Session" button/modal from AO's Sessions tab
- AO should still be able to **view** all sessions across all batches (read-only)
- AO should still be able to **cancel** sessions for administrative reasons (keep this)
- Remove recurring session creation from AO tab

> **Do this AFTER BC session scheduling is implemented and tested.** Do not remove from AO until BC can fully replace it.

---

## Change 3 — API Route Access Control Updates

**File:** `app/api/v1/batch-sessions/route.ts`
**Status:** 🟡 Verify and update role guards

### Required changes

```typescript
// POST (create session) — change from:
allowedRoles: ['academic_operator', 'academic']
// to:
allowedRoles: ['batch_coordinator']  // BC creates, AO can no longer create

// GET (list sessions) — keep both roles:
allowedRoles: ['academic_operator', 'academic', 'batch_coordinator']  // both can view

// PATCH / DELETE (edit/cancel) — change from:
allowedRoles: ['academic_operator', 'academic', 'batch_coordinator']  // both
// to (after BC UI is live):
allowedRoles: ['batch_coordinator']  // BC manages; AO admin-cancel kept separately
```

> Check: `app/api/v1/batch-sessions/[id]/route.ts` for individual session PATCH/DELETE routes — apply same role guard change.

---

## Change 4 — Proxy Middleware Route Access

**File:** `proxy.ts`
**Status:** 🟡 Verify BC has full access to batch-sessions routes

Check that the following routes are accessible to `batch_coordinator`:
```
/api/v1/batch-sessions          (GET, POST)
/api/v1/batch-sessions/[id]     (GET, PATCH, DELETE)
/api/v1/batch-sessions/recurring (POST)
```

Also verify `academic_operator` POST access is removed from batch-sessions after Change 3 is live.

---

## Change 5 — BC Dashboard Data Scope (batch filter)

**File:** `components/dashboard/BCDashboard.tsx` and related API calls
**Status:** 🟡 Must enforce on server side, not just UI

BC must only see sessions for **their assigned batches**. When BC calls `GET /api/v1/batch-sessions`,
the API must filter by `batches.coordinator_email = req.user.email`.

**Check:** Does the current `batch-sessions` GET endpoint already filter by coordinator? If not, add:
```sql
-- In the GET handler for BC role:
JOIN batches ON batch_sessions.batch_id = batches.id
WHERE batches.coordinator_email = $1  -- req.user.email
```

---

## Change 6 — Teacher Assignment Flow (session-level)

**File:** `app/api/v1/batch-sessions/[id]/assign-teacher/route.ts` (may not exist yet)
**Status:** 🟢 Low priority — implement with BC scheduling UI

BC needs to assign teachers **per session**, not just per batch. The current teacher assignment
is at the batch level (`batch_teachers` table). Add session-level override:

```sql
-- Already exists in migrations:
-- batch_sessions has a `teacher_email` column — just expose it via API for BC
```

API: `PATCH /api/v1/batch-sessions/[id]` with body `{ teacher_email }` — BC only.

---

## Change 7 — Notifications After BC Schedules

When BC creates or modifies a session, the following notifications must fire:
- **Students in that batch** — join link email + WhatsApp
- **Teacher assigned** — session confirmation email
- **On reschedule** — updated time email + WA to students + teacher
- **On cancel** — cancellation email + WA with reason to students, teacher, parents

These notifications already exist for AO-created sessions. Verify the same triggers fire
when the session is created by a `batch_coordinator` role (check the `created_by` field
or role check in notification logic).

---

## Implementation Order

| Step | Task | Depends On |
|---|---|---|
| 1 | Add Sessions tab + create modal to `BCDashboard.tsx` | — |
| 2 | Update API route guards (Change 3) | Step 1 |
| 3 | Add BC proxy access (Change 4) | Step 1 |
| 4 | Add batch scope filter to GET endpoint (Change 5) | Step 2 |
| 5 | Add session-level teacher assignment (Change 6) | Steps 1–4 |
| 6 | Verify notifications fire for BC-created sessions (Change 7) | Steps 1–5 |
| 7 | Remove session creation from AO dashboard (Change 2) | Steps 1–6 fully tested |
| 8 | Update testing plan Day 4 role from AO → BC after code is live | Step 7 |

---

## Notes

- Do **not** remove session scheduling from AO until Step 7 is complete and tested.
  Both roles can schedule during the transition window — AO as fallback, BC as primary.
- BC session scheduling should be tested against all batch types: 1:1, 1:3, 1:15, 1:30, lecture.
- The academic calendar (topic mapping) remains AO + Teacher only — BC only links topics to sessions.
- The `TESTING_PLAN_APR29_MAY15.md` currently has AO in Day 4 scheduling tests to reflect the actual
  current code. Update Day 4 role to BC once this implementation is complete and verified.
