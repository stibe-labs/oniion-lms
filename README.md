# stibe Portal

Live classroom platform for Indian school students (Class 1–12). Built with Next.js, LiveKit, PostgreSQL, and Redis.

## Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | App Router, server components, API routes |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling (via PostCSS) |
| PostgreSQL | 15.16 | Primary database |
| Redis | 7.0.15 | Session cache, BullMQ email queue |
| LiveKit | 1.9.11 | WebRTC video/audio/screen share |
| Nodemailer | 6.x | Gmail SMTP email delivery |
| jose | 6.x | JWT sign/verify (HS256) |
| bcryptjs | 3.x | Password hashing |
| shadcn/ui | — | UI component library |

## Architecture

```
stibe Portal (stibelearning.online)    ← this project
    ↕ LiveKit SDK
LiveKit Media (media.stibelearning.online)
```

- **Portal** owns users, rooms, sessions, payments, email, dashboards
- **LiveKit** handles WebRTC video/audio

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
npm run db:migrate

# Seed test users
npm run db:seed

# Start dev server
npm run dev
```

Open http://localhost:3000 — redirects to `/login`.

## Environment

Required variables in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=<64-char-random>

NEXT_PUBLIC_LIVEKIT_URL=ws://76.13.244.54:7880
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>

DATABASE_URL=postgresql://stibe:<pass>@76.13.244.60:5432/stibe_portal
REDIS_URL=redis://:<pass>@76.13.244.60:6379

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail>
SMTP_PASS=<app-password>
EMAIL_FROM_NAME=stibe Classes
EMAIL_FROM_ADDRESS=<email>
EMAIL_MODE=smtp
```

## Project Structure

```
app/
├── (auth)/login/           Login page
├── (portal)/               Protected dashboard pages (8 roles)
│   ├── coordinator/        Room CRUD, student management, notifications
│   ├── teacher/            Assigned rooms
│   ├── student/            Enrolled rooms with payment status
│   ├── academic-operator/  All rooms read-only + Phase 2 placeholders
│   ├── hr/                 User account management
│   ├── parent/             Child's rooms
│   ├── owner/              System overview + ghost access
│   ├── ghost/              Live room monitoring + /monitor grid
│   ├── classroom/[roomId]/ LiveKit classroom (stubs)
│   └── join/[room_id]/     Pre-join flow
└── api/v1/                 REST API routes

lib/                        Server utilities (db, redis, livekit, email, auth)
components/                 React components (auth, dashboard, classroom, ui)
migrations/                 SQL migration files
types/                      TypeScript type definitions
hooks/                      Client-side React hooks
scripts/                    Seed users, migrate DB
```

## Roles

8 portal roles:

| Role | Dashboard | LiveKit Access |
|------|-----------|---------------|
| **owner** | `/owner` | Ghost (invisible) to all rooms |
| **coordinator** | `/coordinator` | Create rooms, observe |
| **academic_operator** | `/academic-operator` | Read-only, observe |
| **hr** | `/hr` | User account management |
| **teacher** | `/teacher` | Full publish (video/audio/screen) |
| **student** | `/student` | Publish video/audio, subscribe |
| **parent** | `/parent` | Read-only observe |
| **ghost** | `/ghost` | Invisible monitoring |

## API Routes

See [DEV_FLOW.md](DEV_FLOW.md) for the complete route table.

## Database

PostgreSQL tables: `rooms`, `room_events`, `room_assignments`, `payment_attempts`, `email_log`, `school_config`, `portal_users`, `user_profiles`.

Migrations in `migrations/` — run with `npm run db:migrate`.

## Servers

| Server | IP | Domain |
|--------|-----|--------|
| LiveKit Media | `76.13.244.54` | `media.stibelearning.online` |
| Portal | `76.13.244.60` | `stibelearning.online` |

## Development

```bash
npm run dev          # Start dev server
npx tsc --noEmit     # Type check
npm run db:migrate   # Run migrations
npm run db:seed      # Seed test users
```

## Documentation

- [DEV_FLOW.md](DEV_FLOW.md) — Build progress, file inventory, known issues
- [USERS.md](USERS.md) — Test accounts and credentials
- `portal_dev/` — Build specification
- `server_build/` — Server setup logs
