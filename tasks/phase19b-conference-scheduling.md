# Phase 19b – Conference Scheduling & UI Polish

## Changes

### 1. DB Migration 068 — Add scheduling columns to `conferences`
```sql
ALTER TABLE conferences ADD COLUMN scheduled_at TIMESTAMPTZ;     -- NULL = instant
ALTER TABLE conferences ADD COLUMN duration_minutes INT DEFAULT 60;
ALTER TABLE conferences ADD COLUMN conference_type TEXT DEFAULT 'instant'; -- 'instant' | 'scheduled'
```

### 2. Conference API Updates (`app/api/v1/conference/route.ts`)
- **POST**: Accept optional `scheduled_at`, `duration_minutes`, `conference_type`
  - If `scheduled_at` provided → `conference_type = 'scheduled'`
  - Otherwise → `conference_type = 'instant'` (current behavior)
- **GET**: Return new fields in response

### 3. Join API Gate (`app/api/v1/conference/[token]/join/route.ts`)
- For `scheduled` conferences:
  - Allow join if current time ≥ `scheduled_at - 5 minutes`
  - Reject with error + time remaining if too early
  - Admin bypass: admins can join anytime
- For `instant`: no time restriction (current behavior)

### 4. Conference Info API (`app/api/v1/conference/[token]/route.ts`)
- Return `scheduled_at`, `duration_minutes`, `conference_type` in GET response
- Return `can_join` boolean + `opens_at` timestamp for time-gating info

### 5. ConferenceWrapper Update (Lobby time gate)
- Show countdown timer in lobby for scheduled conferences not yet open
- Show "Opens in X min" message
- Admin bypass: admin always sees Join button
- Users: Join button disabled until 5 min before scheduled_at

### 6. ConferenceTab UI Overhaul
- **Theme fix**: Use shared.tsx patterns (Card borders, emerald buttons, proper input focus)
- **Two creation modes**: Tab-style toggle between "Instant" and "Scheduled"
  - Instant: Title + Create (current)
  - Scheduled: Title + Date picker + Time picker + Duration + Create
- **Conference list**: Show scheduled_at, countdown for upcoming, better card layout
- **Status badges**: Add 'scheduled' status with amber badge

### 7. Hide "New Batch" Button
- AO dashboard: Add 'conference' to the exclusion array `['monitoring', 'conference']`

## File Changes
| File | Action |
|------|--------|
| `migrations/068_conference_scheduling.sql` | CREATE — add columns |
| `app/api/v1/conference/route.ts` | EDIT — scheduled fields in POST/GET |
| `app/api/v1/conference/[token]/route.ts` | EDIT — return scheduling info + can_join |
| `app/api/v1/conference/[token]/join/route.ts` | EDIT — time gate logic |
| `components/conference/ConferenceWrapper.tsx` | EDIT — lobby countdown |
| `components/dashboard/ConferenceTab.tsx` | REWRITE — theme + scheduling UI |
| `AcademicOperatorDashboardClient.tsx` | EDIT — hide New Batch on conference |
