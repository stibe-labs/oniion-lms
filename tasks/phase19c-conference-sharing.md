# Phase 19c – Conference WhatsApp Sharing & Nav Restriction

## Overview
1. Restrict conference nav to owner + academic_operator only
2. After conference creation, show a share panel with:
   - **Admin link sharing**: Select staff users (owner, teacher, HR, BC, AO) → bulk WhatsApp send
   - **User link sharing**: Select students/parents by batch, or staff → bulk WhatsApp send
   - Manual number entry for users without WhatsApp, and external people

## Changes

### 1. Nav Config — Remove conference from BC, HR, Teacher
**File**: `lib/nav-config.ts`
- Remove `Conference` from `BATCH_COORDINATOR_NAV`, `HR_NAV`, `TEACHER_NAV`
- Keep in `OWNER_NAV` and `ACADEMIC_OPERATOR_NAV` only

### 2. Dashboard Tab Cleanup — Remove conference tab from BC, HR, Teacher
**Files**: 3 dashboard files
- `CoordinatorDashboardClient.tsx` — Remove 'conference' from TabId, validTabs, remove ConferenceTab import+render
- `HRDashboardClient.tsx` — Remove 'conference' from HRTab, tabs array, remove ConferenceTab import+render
- `TeacherDashboardClient.tsx` — Remove 'conference' from validTabs, remove ConferenceTab import+render

### 3. API Route — Fetch users for sharing
**New File**: `app/api/v1/conference/users/route.ts`
- GET `?type=admin` — Returns staff users: owners, teachers, HRs, BCs, AOs with name, email, phone, whatsapp
- GET `?type=user` — Returns all users + batch-based filtering
- GET `?type=user&batch_id=xxx` — Returns students + parents for that batch
- GET `?batches=1` — Returns list of active batches for dropdown

**SQL for staff**:
```sql
SELECT u.email, u.full_name, u.portal_role, u.phone, up.whatsapp
FROM portal_users u
LEFT JOIN user_profiles up ON up.email = u.email
WHERE u.portal_role IN ('owner','teacher','hr','batch_coordinator','academic_operator','academic')
AND u.is_active = TRUE
ORDER BY u.portal_role, u.full_name
```

**SQL for batch students+parents**:
```sql
SELECT bs.student_email, u.full_name, u.portal_role, u.phone, up.whatsapp,
       bs.parent_email, pu.full_name AS parent_name, pup.whatsapp AS parent_whatsapp, pup.phone AS parent_phone
FROM batch_students bs
JOIN portal_users u ON u.email = bs.student_email
LEFT JOIN user_profiles up ON up.email = bs.student_email
LEFT JOIN portal_users pu ON pu.email = bs.parent_email
LEFT JOIN user_profiles pup ON pup.email = bs.parent_email
WHERE bs.batch_id = $1 AND bs.student_status = 'active'
```

### 4. API Route — Bulk WhatsApp send
**New File**: `app/api/v1/conference/share/route.ts`
- POST body:
```json
{
  "conference_id": "uuid",
  "link_type": "admin" | "user",
  "recipients": [
    { "name": "...", "phone": "91xxxxxxxxxx", "email": "..." },
    { "name": "Manual Person", "phone": "91xxxxxxxxxx" }
  ]
}
```
- Uses `metaSendTemplate()` with `stibe_alert` template (or `metaSend()` for free text)
- Sends conference title, link, scheduled time to each recipient
- Returns `{ sent, failed, errors[] }`

### 5. ConferenceTab Rewrite — Share Panel UI
**File**: `components/dashboard/ConferenceTab.tsx`

After conference creation OR from list, show share panel with two tabs:

**Share Admin Link tab:**
- Grouped user list: Owners, Teachers, HRs, BCs, AOs
- Each user row: checkbox, name, role badge, WhatsApp number (green if present, red "No number" with manual input)
- "Select All" per group
- "Add External" button → name + phone input
- "Send via WhatsApp" bulk button with count

**Share User Link tab:**
- Same staff groups as above
- Batch selector dropdown → loads students + parents under batch
- Student rows: checkbox, name, "Student" badge, WhatsApp
- Parent rows: checkbox, name, "Parent" badge, WhatsApp
- Same "Add External" + manual entry
- "Send via WhatsApp" bulk button

**Shared UI elements:**
- Search filter across all users
- WhatsApp number input modal for users missing numbers
- Send progress indicator
- Success/failure summary after send

### 6. Conference List Enhancement
- Each conference in list gets "Share" button
- Opens same share panel for that conference
- Shows "Admin Link" / "User Link" sharing tabs

## File Summary
| File | Action |
|------|--------|
| `lib/nav-config.ts` | EDIT — remove Conference from BC, HR, Teacher navs |
| `CoordinatorDashboardClient.tsx` | EDIT — remove conference tab |
| `HRDashboardClient.tsx` | EDIT — remove conference tab |
| `TeacherDashboardClient.tsx` | EDIT — remove conference tab |
| `app/api/v1/conference/users/route.ts` | CREATE — user listing for share panel |
| `app/api/v1/conference/share/route.ts` | CREATE — bulk WhatsApp send |
| `components/dashboard/ConferenceTab.tsx` | REWRITE — full share panel + scheduling |
