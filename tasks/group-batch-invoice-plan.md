# Feature Plan: Group Batch Invoice Generation + Payment Type Selection

## Context
Manual enrollment for group batches (1:15, 1:30, 1:many) currently:
- Does NOT generate invoices when no payment is recorded
- Has no explicit OTP vs SPO (split/quarterly) selector
- Does NOT generate a balance invoice when advance payment is made
- Payment gate on class join is not linked to invoice status

1:1 / 1:3 (per-class batches) already work correctly → **must not be touched**.

---

## Current Behavior (Broken)

| Scenario | Current | Should Be |
|---|---|---|
| Enroll group, no payment | No invoice created | Pending invoice for OTP or Q1 SPO amount |
| Enroll group, advance ₹3k (fee ₹10k) | 1 paid invoice ₹3k | 1 paid ₹3k + 1 pending ₹7k balance |
| Enroll group, full payment | 1 paid invoice for entered amount | 1 paid invoice for correct fee amount |
| SPO Q1 paid → Q2/Q3/Q4 | Only if quarterly toggle ON | Always auto-generate Q2/Q3/Q4 as scheduled |
| Payment gate on join | Only blocks if quarterly_due_date past | Block if any outstanding invoice exists |

---

## Fee Calculation Reference

From `lib/fee-display.ts` → `computeFeeBreakdown()`:

- **Base** = `early_bird_fee_paise` if offer active, else `fee_paise`
- **OTP** = Base × 90% (no offer) or Regular × 75% (offer active)
- **SPO Total** = Base × 95% (no offer) or Regular × 80% (offer active)
- **Q1 = Q2 = Q3** = 30% of SPO Total
- **Q4** = SPO Total − (Q1 × 3)

---

## Implementation Plan

### Phase 1: UI Changes — `ManualEnrollModal.tsx`

**1a. Add payment type selector for group batches (OTP / SPO)**

Replace `quarterlyPlan` boolean toggle with a 2-card selector:
```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  ● OTP — One Time Payment       │  │  ○ SPO — Split Payment Option   │
│  Pay once, save more            │  │  Pay in 4 quarters              │
│  ₹9,000 total                   │  │  Q1: ₹7,200 | Q2/Q3: ₹2,400   │
│  (Save ₹1,000)                  │  │  Q4: ₹800                       │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

- Only shown when `preferredBatchType` or selected batch type is group (1:15/1:30/1:many)
- Amounts calculated from `computeFeeBreakdown()` using the current fee row

**1b. Invoice Preview Panel**

Show below the payment amount:
```
Invoice Preview:
• OTP selected + no payment:    → 1 pending invoice: ₹9,000 (due in 30 days)
• OTP selected + advance ₹3k:  → 1 paid receipt ₹3k + 1 pending balance ₹6,000
• OTP selected + full:          → 1 paid invoice ₹9,000
• SPO + no payment:             → Q1 pending ₹2,400 + Q2/Q3/Q4 scheduled
• SPO + advance ₹1k:           → Q1 partial paid ₹1k + Q1 balance ₹1,400 pending + Q2/Q3/Q4 scheduled
• SPO + full (Q1 only):        → Q1 paid ₹2,400 + Q2/Q3/Q4 scheduled
```

**1c. Remove old quarterlyPlan toggle**

Replace with the payment type selector above.

**1d. Send to backend**
- `payment_type: 'otp' | 'spo'` (instead of `payment_plan: 'quarterly' | 'otp'`)
- `fee_otp_paise`: computed OTP amount from fee structure
- `fee_spo_q123_paise`: Q1/Q2/Q3 amount
- `fee_spo_q4_paise`: Q4 amount

---

### Phase 2: Backend Changes — `app/api/v1/enrollment/manual/route.ts`

**2a. Accept new params**
```typescript
const paymentType = ['spo', 'otp'].includes(String(body.payment_type)) 
  ? String(body.payment_type) as 'otp' | 'spo' 
  : 'otp'; // default to OTP
const feeOtpPaise = Math.max(0, parseInt(String(body.fee_otp_paise || 0), 10));
const feeSpoQ123Paise = Math.max(0, parseInt(String(body.fee_spo_q123_paise || 0), 10));
const feeSpoQ4Paise  = Math.max(0, parseInt(String(body.fee_spo_q4_paise  || 0), 10));
```

**2b. Group batch invoice generation logic**

Replace the current "Step 5" (payment recording) for group batches:

```
FOR GROUP BATCHES (not one_to_one / one_to_three):

IF paymentType === 'otp':
  totalFee = feeOtpPaise (or amountPaise if no fee data)
  
  IF paymentMode === 'none':
    → Create 1 invoice: status='pending', amount=totalFee, due=today+30days
    → Set quarterly_due_date = today+30days on batch_students
    
  IF paymentMode === 'advance':
    balance = totalFee - amountPaise
    → Create invoice 1: status='paid', amount=amountPaise (receipt too)
    IF balance > 0:
      → Create invoice 2: status='pending', amount=balance, due=today+30days
      → Set quarterly_due_date = today+30days on batch_students
      
  IF paymentMode === 'full':
    → Create 1 invoice: status='paid', amount=amountPaise (receipt too)
    → Set quarterly_due_date = NULL (gate bypassed for now)

IF paymentType === 'spo':
  q1 = feeSpoQ123Paise, q2 = feeSpoQ123Paise, q3 = feeSpoQ123Paise, q4 = feeSpoQ4Paise
  remaining = amountPaise
  
  FOR each quarter Q1 → Q4:
    dueDate = today + (q-1)*3months
    quarterAmount = q1/q2/q3/q4
    
    IF remaining >= quarterAmount:
      → status='paid', receipt created, remaining -= quarterAmount
    ELSE IF remaining > 0:
      → status='paid' for partial, receipt created for remaining
      → ALSO status='pending' invoice for (quarterAmount - remaining) balance
      remaining = 0
    ELSE (remaining == 0):
      IF Q1: status='pending' (due now)
      ELSE:  status='scheduled' (future)
  
  → Set quarterly_due_date = Q1_due_date (= today) on batch_students
```

**2c. Remove old quarterly invoice generation (Step 7)**

The new logic above replaces the existing Q2/Q3/Q4 scheduled invoice creation.

**2d. Notification enhancement**

For group batches with pending invoice (no payment / advance):
- Send **invoice notification email** (not payment receipt) with the pending amount and due date
- For advance: send payment receipt + separate "balance invoice" email

---

### Phase 3: DB Migration

Add `payment_type` column to `batch_students`:
```sql
ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS payment_type varchar(10) DEFAULT 'otp';
```
Store 'otp' or 'spo' so the payment gate can reset `quarterly_due_date` correctly
when a quarterly payment is marked as paid.

---

### Phase 4: Payment Gate Wiring

The current gate in `room/join/route.ts` already blocks students when `quarterly_due_date` is past.

**What needs to change:**
- When `payment_mode='full'` + OTP → set `quarterly_due_date = NULL` → no gate
- When any pending invoice exists → `quarterly_due_date` is set → gate fires
- When AO marks an invoice as paid → update `quarterly_due_date` to next installment date

**No code change needed in room/join** — the gate logic is already correct.
Only need to ensure `quarterly_due_date` is populated correctly during enrollment.

---

## Files to Change

| File | Change |
|---|---|
| `components/dashboard/ManualEnrollModal.tsx` | Replace quarterly toggle with OTP/SPO selector, invoice preview |
| `app/api/v1/enrollment/manual/route.ts` | New group invoice logic |
| `migrations/0XX_batch_students_payment_type.sql` | Add `payment_type` column |
| `lib/email-templates.ts` | Possibly add pending invoice email template |

---

## What Stays the Same (Do NOT change)

- 1:1 / 1:3 per-class session credit logic
- Flat-fee batch types (improvement_batch, special, custom, lecture)
- Payment receipt generation for actual paid amounts
- BackfillSessionInvoices logic

---

## Open Questions (need user confirmation)

1. **When `payment_mode = 'full'` for SPO** — does AO mean "paying Q1 only" or "paying all 4 quarters"?
   - Likely Q1 only (SPO means split), so Q2/Q3/Q4 stay scheduled.
   - If "paying Q1 only", should we call it "advance" or "full"?

2. **OTP due date for `payment_mode = 'none'`** — how many days? 30 days suggested.

3. **SPO Q2/Q3/Q4 payment gate** — when Q1 is paid, should the gate auto-advance to Q2?
   - This requires the AO's "record payment" flow to update `quarterly_due_date`.
   - Currently the AO quarterly payment route exists at `/api/v1/academic-operator/quarterly-payment`.

4. **Invoice email for pending invoices** — should we send an invoice PDF or just a notification email?
