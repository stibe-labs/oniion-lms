# Meeting Minutes — stibe Platform Review
**Date:** 28 April 2026
**Attendees:** CEO, Development Team
**Type:** Internal Strategy Meeting

---

## 1. Current Status — Live Batch Sessions

- Bugs have been identified in the improved live batch session flow.
- **Decision:** Until all critical bugs are fully cleared and tested, all live classes will be conducted via **Google Meet** as a temporary fallback.
- Development team to prioritize bug resolution before resuming platform-hosted sessions.

---

## 2. Daily Testing Plan

- **Daily testing sessions** to be conducted with staff members and offline students.
- Test all batch types:
  | Batch Type | Max Students |
  |---|---|
  | 1:1 | 1 |
  | 1:3 | 3 |
  | 1:15 | 15 |
  | 1:Many | 50+ |
- Testing across **multiple devices:** Android, iOS, Desktop (Chrome, Safari, Firefox).
- Separate test batches to be created specifically for QA — not to interfere with real batches.

---

## 3. Testing Phases — Traffic Light System

Testing to be conducted in three structured phases:

### 🔴 Phase 1 — Red Zone (Critical)
Issues that block basic class functionality. Must be resolved before any other phase.
- Room join / token failures
- Video/audio not publishing
- Teacher unable to go live
- Student cannot enter room
- App crash on join

### 🟡 Phase 2 — Yellow Zone (Important)
Functional but degraded experience. Must be resolved before full launch.
- Join request button behavior
- Mic on/off reliability across devices
- Camera toggle issues on mobile (Android/iOS)
- Screen share on desktop
- Chat delivery reliability
- Attendance recording accuracy
- Session timer / countdown errors

### 🟢 Phase 3 — Green Zone (Polish)
Platform is usable; these improve experience and are launch-ready indicators.
- Overlay auto-hide behavior on mobile
- Notification delivery (WhatsApp/email) timing
- Sidebar tab responsiveness
- Virtual background stability
- Exam tab during live session
- Recording start/stop reliability

> **Definition of Done:** All Red resolved → Yellow resolved → Green resolved = platform cleared for production use.

---

## 4. Student-Friendly UI Adjustments

- **Join Request Button:** Redesign to be more prominent and intuitive for students.
- **Mic / Camera Controls:** Simplify toggle behavior — clear on/off visual state, consistent across Android, iOS, Desktop.
- General UX pass to ensure all in-room controls are self-explanatory without guidance.
- Reduce number of steps to perform common actions (raise hand, chat, leave).
- Action items to be tracked in a separate UI/UX task sheet.

---

## 5. AI Monitoring — Policy Adjustments

- Current AI monitoring (attention tracking via MediaPipe) is considered too aggressive.
- **Changes decided:**
  - Make monitoring features **more liberal** — reduce sensitivity thresholds to reduce false alerts.
  - **Limit real-time alert sending to parents** — do not push every event.
  - **Daily reports to parents: discontinued.** Replace with **Monthly Reports only.**
  - Internal alerts to coordinator/teacher remain active for classroom use.
  - Review alert types: only critical events (e.g., prolonged absence from frame) should be escalated.

---

## 6. Server Capacity Planning

- Current infrastructure needs to be studied and documented.
- **Target capacity:**
  | Segment | Target Scale |
  |---|---|
  | Offline Students (DB records) | 3,000 |
  | Online Students (active users) | 3,000 – 10,000 |
- **Decision:** Server upgrade is required before scaling to these numbers.
- Tasks:
  - Audit current DB size, connection pool limits, and query performance.
  - Review Redis cache capacity and BullMQ queue throughput.
  - Benchmark LiveKit server (SFU) under load for 50+ concurrent rooms.
  - Identify bottlenecks and propose upgraded server/cloud tier.
  - Estimate costs for upgraded infrastructure.

---

## 7. New Student Enquiry — Guest Demo Access

- For prospective students making enquiries, the following flow was decided:
  - Sales/BC adds the student as a **guest participant** in the next scheduled live session.
  - Student joins via a guest link — no account creation required.
  - Guest can observe the class (view-only, similar to ghost mode).
  - After the demo, sales team follows up for enrollment.
- This replaces the current separate `/demo/[linkId]` flow for new enquiries.
- Development to implement a **"Add Guest to Session"** feature in the coordinator dashboard.

---

## 8. Action Items

| # | Action | Owner | Priority | Target |
|---|---|---|---|---|
| 1 | Fix all Red Zone bugs (room join, audio/video) | Dev Team | 🔴 Critical | Immediate |
| 2 | Create formal Test Document & Testing Plan | Dev + QA | 🔴 Critical | This week |
| 3 | Set up test batches (1:1, 1:3, 1:15, 1:many) | Batch Coordinator | 🔴 Critical | This week |
| 4 | Daily device testing sessions with staff + offline students | BC + Dev | 🔴 Critical | Daily until Green |
| 5 | Redesign join request button + mic/camera controls | Dev (Frontend) | 🟡 Important | Phase 2 |
| 6 | Adjust AI monitoring thresholds — reduce sensitivity | Dev (Backend) | 🟡 Important | Phase 2 |
| 7 | Switch parent reports from daily → monthly only | Dev (Backend) | 🟡 Important | Phase 2 |
| 8 | Audit server capacity — DB, Redis, LiveKit SFU | Dev (Infra) | 🟡 Important | This week |
| 9 | Propose server upgrade plan with cost estimates | Dev (Infra) | 🟡 Important | Next week |
| 10 | Implement "Add Guest to Session" for demo/enquiry | Dev (Full Stack) | 🟢 Normal | Phase 3 |
| 11 | Maintain Google Meet as fallback until Green phase cleared | Operations | 🟢 Normal | Ongoing |
| 12 | Complete fee structure integration into web app | Dev (Full Stack) | 🟡 Important | Within 10 days |
| 13 | Begin iOS & Android app development (students + parents) | Dev (Mobile) | 🟢 Normal | After web launch |
| 14 | Complete mobile app development | Dev (Mobile) | 🟢 Normal | 1 month after start |
| 15 | Mobile app testing phase | Dev + QA | 🟢 Normal | 15 days after dev complete |

---

## 9. Product Roadmap & Milestones

### Web Application
| Milestone | Target Date |
|---|---|
| Bug-free, fully tested web platform | **15 May 2026** |
| Fee structure fully integrated | Within 10 days (by ~8 May 2026) |

> **15 May 2026** is the hard deadline for a fully functional, bug-free web product.

### Mobile Applications (iOS & Android)
- **Scope:** Student app + Parent app
- **Start Date:** After web app is fully functional (~8–10 May 2026)
- **Development Duration:** 1 month
- **Testing Duration:** 15 days
- **Estimated Completion:** ~Late June / Early July 2026

| Phase | Duration | Estimated Dates |
|---|---|---|
| Web app finalized | — | By 15 May 2026 |
| Mobile development | 1 month | ~10 May – 10 June 2026 |
| Mobile testing | 15 days | ~10 June – 25 June 2026 |
| Mobile launch | — | ~Late June 2026 |

---

## 10. Next Meeting

- Review Red Zone bug status after daily testing sessions begin.
- Present server capacity audit findings.
- Demo the redesigned student UI controls.
- Review fee structure integration progress.

---

*Minutes recorded: 28 April 2026*
*Distribution: CEO, Development Team, Batch Coordinators*