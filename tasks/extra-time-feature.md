# Extra Time Feature — Full Implementation Plan

## Status: IN PROGRESS

## Overview

Enhance the existing session extension system with:
1. YouTube recording alert delay (1 min after class start)
2. Rename "Present" → "On Time" in attendance
3. Owner-configurable extra time fee tiers
4. Payment notifications on teacher approval (email + WhatsApp to student + parent)
5. BC extension approval UI in Live Monitor
6. Join gate blocking students with unpaid extension invoices

## What Already Exists

- [x] `session_extension_requests` table (migration 012)
- [x] API: POST (student request) + GET (fetch) + PATCH (approve/reject) at `/api/v1/session-extension`
- [x] Teacher availability check (rooms + batch_sessions conflict detection)
- [x] Student UI: warning banner "Request Extra Time" + modal (30/60/120 min)
- [x] Teacher UI: data channel listener + approve/reject panel
- [x] `applyExtension()`: extends room duration, creates overdue invoice
- [x] Data channels: `extension_request` + `extension_control`

## Implementation Tasks

### Phase 1: Quick Fixes
- [ ] **1.1** YouTube recording alert: delay `setShowRecordingPrompt(true)` by 1 min
- [ ] **1.2** AttendancePanel: change `label: 'Present'` to `label: 'On Time'`

### Phase 2: Owner Extra Time Fee Config
- [ ] **2.1** Migration 038: `extra_time_rates` table (duration_minutes, rate_paise, currency)
- [ ] **2.2** API: `/api/v1/payment/extra-time-rates` (GET, POST, PUT, DELETE)
- [ ] **2.3** New tab in Owner FeesClient: "Extra Time Rates" — CRUD tiers

### Phase 3: Extension API Enhancements
- [ ] **3.1** Use `extra_time_rates` for fee calculation (fallback to `calculateBatchSessionFee`)
- [ ] **3.2** Show configured prices in Student extension modal

### Phase 4: Notifications on Approval
- [ ] **4.1** Email template: extension invoice with direct payment link
- [ ] **4.2** Send email + WhatsApp to student AND parent on extension approval
- [ ] **4.3** Use `stibe_alert` Meta template with custom message

### Phase 5: BC Extension Approval UI
- [ ] **5.1** Add extension request panel in LiveMonitorClient
- [ ] **5.2** Poll `GET /api/v1/session-extension?status=pending_coordinator` for active requests
- [ ] **5.3** Approve/reject buttons calling PATCH

### Phase 6: Join Gate for Unpaid Extensions
- [ ] **6.1** In `room/join/route.ts`, check for unpaid extension invoices (status='overdue')
- [ ] **6.2** Block join with 402 `EXTENSION_FEE_DUE` + descriptive message
- [ ] **6.3** Student dashboard: show extension dues with payment link

## Suggested Enhancements (Beyond User Request)
- Auto-expire pending extension requests after 5 minutes
- Timer updates in real-time for all participants when extension approved
- Extension history in student/parent dashboard
- Allow teacher to also initiate extension (proactive)
