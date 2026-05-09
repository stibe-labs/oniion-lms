# Combined Invoice Plan — Schedule Group Payments

## Problem
Currently, scheduling 20 recurring sessions × 10 students = 200 separate invoices.
User wants: 1 combined invoice per student covering ALL sessions in a scheduling batch.

## Design: `schedule_group_id`

When the AO schedules sessions (single or recurring), a `schedule_group_id` UUID groups them.
One combined invoice per student covers all sessions in the group.

### Flow
1. Frontend generates `schedule_group_id` before the scheduling loop
2. Each session POST includes `schedule_group_id`
3. After all sessions created, frontend calls `POST /api/v1/batch-sessions/finalize-invoices`
4. That endpoint sums all session fees → creates 1 invoice per student
5. Each session still gets a `session_payments` row (for per-session tracking), all pointing to the same `invoice_id`
6. `completePayment()` already does `UPDATE session_payments SET status='paid' WHERE invoice_id=$1` — so paying the combined invoice marks ALL sessions as paid

### Why existing payment gating still works
- `checkBatchSessionPayment(sessionId, email)` → finds `session_payments` row for that session → checks status
- When combined invoice is paid, ALL session_payments for that invoice are set to 'paid'
- So checking any individual session still returns `paid=true`

### DB Changes (migration 010)
- `batch_sessions.schedule_group_id TEXT`
- `invoices.schedule_group_id TEXT`
- Indexes on both

### Files Changed
1. `migrations/010_schedule_group.sql` — new columns + indexes
2. `lib/payment.ts` — replace `generateBatchSessionInvoices` with `generateScheduleGroupInvoices`
3. `app/api/v1/batch-sessions/route.ts` — accept `schedule_group_id`, remove per-session invoicing
4. `app/api/v1/batch-sessions/finalize-invoices/route.ts` — NEW endpoint
5. `app/(portal)/academic-operator/AcademicOperatorDashboardClient.tsx` — generate group_id, call finalize
6. `app/api/v1/payment/invoices/route.ts` — add `schedule_group_id` to SELECT
7. `app/(portal)/owner/fees/FeesClient.tsx` — group by `schedule_group_id`
