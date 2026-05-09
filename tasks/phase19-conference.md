# Phase 19 — Conference Feature

## Overview
A new "Conference" feature allowing admins to create conference links with separate admin/user token URLs. Admins see all user tiles in a scrollable grid (max 5 columns). Users see all admin faces. No approval needed — users join instantly.

---

## Architecture Plan

### 1. Database (`067_conferences.sql`)

```sql
-- conferences table
CREATE TABLE IF NOT EXISTS conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES portal_users(email),
  admin_token TEXT NOT NULL UNIQUE,   -- 12-char random hex for admin link
  user_token TEXT NOT NULL UNIQUE,    -- 12-char random hex for user link  
  livekit_room_name TEXT,             -- set when first admin joins
  status TEXT NOT NULL DEFAULT 'created',  -- created | live | ended
  max_participants INT DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- track who joined
CREATE TABLE IF NOT EXISTS conference_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,                         -- optional for users (may not be logged in)
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

CREATE INDEX idx_conf_admin_token ON conferences(admin_token);
CREATE INDEX idx_conf_user_token ON conferences(user_token);
CREATE INDEX idx_conf_participants ON conference_participants(conference_id);
```

### 2. Roles & Grants

**New roles in PortalRole type:**
- `conference_host` — admin in conference (publish + subscribe + roomAdmin)
- `conference_user` — user in conference (publish + subscribe, no admin)

**LiveKit grants:**
```
conference_host: roomJoin, canPublish, canPublishData, canSubscribe, hidden: false, roomAdmin: true
conference_user: roomJoin, canPublish, canPublishData, canSubscribe, hidden: false
```

### 3. API Routes

#### `POST /api/v1/conference` — Create conference
- Auth: session cookie (owner, academic_operator, batch_coordinator, hr, teacher)
- Body: `{ title: string }`
- Returns: `{ id, title, admin_token, user_token, admin_link, user_link }`
- Admin link: `/conference/{admin_token}?role=admin`
- User link: `/conference/{user_token}`

#### `GET /api/v1/conference/[token]` — Get conference info by token
- No auth required (public link)
- Determines role from token match (admin_token → admin, user_token → user)
- Returns: `{ id, title, status, role, livekit_room_name }`

#### `POST /api/v1/conference/[token]/join` — Join conference
- Body: `{ name: string }` (display name for participants)
- Creates LiveKit room if first join
- Generates LiveKit token with appropriate grants
- Records in conference_participants
- Returns: `{ livekit_token, livekit_url, role, participant_name }`

#### `DELETE /api/v1/conference/[token]` — End conference (admin only)
- Destroys LiveKit room, sets status='ended'

#### `GET /api/v1/conference` — List conferences for dashboard
- Auth: session cookie
- Returns all conferences created by current user (or all for owner)

### 4. Pages & Routing

#### `/conference/[token]` — Conference entry page
- Public route (add to proxy allowlist like `/demo`)
- Renders `ConferenceWrapper` — reads token from URL, fetches conference info
- Shows name input + "Join" button
- On join → gets LiveKit token → enters room

#### `ConferenceWrapper` — Client component
- Fetches `GET /api/v1/conference/[token]` to determine role
- On join: calls `POST /api/v1/conference/[token]/join`
- Stores token in sessionStorage, mounts `<LiveKitRoom>`
- Routes to `ConferenceHostView` or `ConferenceUserView` based on role

### 5. UI Components

#### `ConferenceHostView` (Admin)
- **Layout**: Full viewport, dark bg
- **Top bar**: Conference title, participant count, End button
- **Grid**: All users displayed as tiles
  - Max 5 columns, auto-adjusting tile size
  - CSS grid: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))` capped at 5
  - Scrollable container when many users (overflow-y: auto)
  - Each tile: video + name overlay
- **Bottom bar**: Mic toggle, Camera toggle, Screen share, Leave
- **Pattern**: Reference TeacherView's student grid rendering

#### `ConferenceUserView` (User)
- **Layout**: Full viewport, dark bg  
- **Top section**: Admin faces displayed prominently (larger tiles)
  - All admins shown in a row/grid similar to how StudentView shows teacher
- **Bottom bar**: Mic toggle, Camera toggle, Leave
- **Pattern**: Reference StudentView's teacher display

### 6. Navigation

Add "Conference" to nav config for these roles:
- `owner` — full access
- `batch_coordinator` — can create
- `academic_operator` — can create  
- `hr` — can create
- `teacher` — can create

Nav item: `{ label: 'Conference', href: '/[role]#conference', icon: Video }`

### 7. Dashboard Tab — `ConferenceTab`

Embedded in each dashboard that gets the nav item:
- **Create Conference**: Title input + Create button → shows admin + user links
- **Conference List**: Table of past/active conferences with status, created date, copy links
- **Active indicator**: Green dot for "live" conferences

### 8. Proxy Updates

Add `/conference` to public paths in proxy.ts (like `/demo`):
```typescript
if (pathname.startsWith('/conference')) {
  return NextResponse.next();
}
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `migrations/067_conferences.sql` | CREATE | DB tables |
| `types/index.ts` | EDIT | Add conference_host, conference_user to PortalRole |
| `lib/livekit.ts` | EDIT | Add conference_host, conference_user grants |
| `app/api/v1/conference/route.ts` | CREATE | List + Create conference |
| `app/api/v1/conference/[token]/route.ts` | CREATE | Get conference info |
| `app/api/v1/conference/[token]/join/route.ts` | CREATE | Join + get LiveKit token |
| `app/conference/[token]/page.tsx` | CREATE | Conference entry page |
| `components/conference/ConferenceWrapper.tsx` | CREATE | LiveKit room setup + role router |
| `components/conference/ConferenceHostView.tsx` | CREATE | Admin grid view |
| `components/conference/ConferenceUserView.tsx` | CREATE | User view showing admins |
| `lib/nav-config.ts` | EDIT | Add Conference nav to 5 roles |
| `components/dashboard/ConferenceTab.tsx` | CREATE | Dashboard tab for create + list |
| `proxy.ts` | EDIT | Allow /conference/* public access |
| Each dashboard (Owner, AO, BC, HR, Teacher) | EDIT | Mount ConferenceTab |

---

## Implementation Order

1. Migration → 2. Types → 3. LiveKit grants → 4. API routes → 5. Proxy → 6. Conference page + wrapper → 7. HostView + UserView → 8. Nav config → 9. Dashboard tab → 10. Mount in dashboards → 11. Type check → 12. Deploy

---

## Status
- [ ] Plan approved
- [ ] Implementation started
