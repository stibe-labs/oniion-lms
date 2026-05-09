# stibe Portal — Payment System Migration Plan

> **Objective:** Rebuild stibe's payment system using Stibe CRM's proven patterns — official Razorpay SDK, USD pricing with live INR conversion, GST, JWT pay tokens, subscription-based plans, dynamic pricing, Zod validation, audit logging, and centralized error handling.

---

## Current vs Target — Side-by-Side

| Aspect | stibe (Current) | Target (Stibe CRM Pattern) |
|--------|-------------------|---------------------------|
| **Billing Model** | Per-session/per-student invoices | Subscription plans by batch type |
| **Price Unit** | INR paise (hardcoded) | USD cents → live INR conversion |
| **GST** | Not applied | 18% GST on all payments |
| **Razorpay** | Manual `fetch()` to API | Official `razorpay` npm SDK |
| **Pay Tokens** | HMAC-SHA256 (16 hex chars, no expiry) | JWT via `jose` (7-day expiry) |
| **Plans/Tiers** | fee_structures by batch_type | Named plans with feature limits |
| **Dynamic Pricing** | Static DB rows | `platform_settings` JSON overrides |
| **Currency Conversion** | Multi-symbol display only | Live USD→INR API + Redis cache (1hr) |
| **Billing Cycles** | Per-session / monthly only | Monthly / Quarterly / Annual + discounts |
| **Input Validation** | Manual checks | Zod schemas on all routes |
| **Error Handling** | Inline try/catch | Centralized `withErrorHandler` |
| **Audit Logging** | None | Full audit trail per payment event |
| **Feature Gating** | None | Plan-based feature access |
| **Discounts** | None | Quarterly 10%, Annual 2 months free |

---

## stibe Context: Subscription Plans for EdTech

stibe bills **students/parents** for tutoring sessions. Stibe CRM bills **tenant organizations** for SaaS access. The adaptation:

| Stibe CRM Concept | stibe Adaptation |
|-------------------|--------------------|
| Tenant subscribes to a plan | **Student/parent subscribes** to a tuition plan |
| Plan tiers: Basic / Pro / Pro+ | **Plan tiers by batch type**: 1:1, 1:3, Regular (1:15/1:30), Lecture |
| Per-user pricing ($10/additional) | **Per-subject add-on pricing** |
| Plan limits: leads, storage, users | **Plan limits**: subjects, sessions/month, exam access |
| Feature flags per plan | **Feature access**: AI monitoring, recordings, reports |
| Public plan page (JWT token) | **Enrollment plan page** (JWT token, replaces enrollment link) |
| Admin purchases plan | **Parent/student pays** for plan |

### Proposed stibe Plan Structure

```
┌─────────────────┬──────────┬──────────┬──────────────┬──────────┐
│                 │  1:1     │  1:3     │  Regular     │  Lecture │
│                 │  (Indiv) │  (Small) │  (1:15/1:30) │  (1:100) │
├─────────────────┼──────────┼──────────┼──────────────┼──────────┤
│ USD/month       │  $XX     │  $XX     │  $XX         │  $XX     │
│ Sessions/month  │  12      │  12      │  20          │  30      │
│ Subjects incl.  │  1       │  1       │  2           │  All     │
│ Extra subject   │  $XX/mo  │  $XX/mo  │  $XX/mo      │  —       │
│ AI monitoring   │  ✓       │  ✓       │  ✓           │  ✗       │
│ Session records │  ✓       │  ✓       │  on request  │  ✗       │
│ Exam access     │  ✓       │  ✓       │  ✓           │  ✓       │
│ Parent reports  │  daily   │  daily   │  weekly      │  monthly │
└─────────────────┴──────────┴──────────┴──────────────┴──────────┘
```

> **Note**: Actual pricing and limits to be configured by the owner via platform_settings. The plan structure above is a starting template.

---

## Migration Phases

### Phase 1: Foundation Layer (New Lib Files)

**Goal:** Build the core payment infrastructure — Razorpay SDK, currency conversion, plans, JWT tokens.

#### 1.1 Install Razorpay SDK
```bash
npm install razorpay
```
- Replace manual `fetch('https://api.razorpay.com/v1/orders')` with SDK
- Keep existing env vars: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

#### 1.2 Create `lib/razorpay.ts` (NEW — replaces inline Razorpay calls in payment.ts)
```
- createOrder({ amount, currency, receipt, notes }) → Razorpay order
- verifyPaymentSignature(orderId, paymentId, signature) → boolean
- Uses razorpay npm SDK (not fetch)
- Matches Stibe CRM's lib/razorpay.ts pattern exactly
```

#### 1.3 Create `lib/currency.ts` (NEW)
```
- getUsdToInrRate() → number (via open.er-api.com, Redis cached 1hr, fallback 85.0)
- usdCentsToInrPaise(cents) → { inrPaise, exchangeRate }
- formatInr(paise) → "₹1,234.56"
- formatUsd(cents) → "$12.34"
- Matches Stibe CRM's lib/currency.ts pattern exactly
```

#### 1.4 Create `lib/plans.ts` (NEW — replaces fee_structures concept)
```
- PLANS config: 4 tiers (one_to_one, one_to_three, regular, lecture)
  - Each: key, name, price (USD cents), priceDisplay, features[], limits{}
- getDynamicPlan(key) → reads platform_settings.plan_pricing override, falls back to defaults
- getDynamicPlans() → all plans
- getDynamicGSTRate() → reads platform_settings.gst_rate (default 0.18)
- getDynamicAdditionalSubjectPrice() → reads platform_settings
- calculatePeriodEnd(startDate, cycle) → Date
- calculateGraceDate(periodEnd) → Date (+3 days)
- Matches Stibe CRM's lib/plans.ts pattern
```

#### 1.5 Create `lib/plan-token.ts` (NEW — replaces HMAC pay-token.ts)
```
- createPlanToken({ studentEmail, planKey, enrollmentLinkId? }) → JWT (7-day expiry, jose)
- verifyPlanToken(token) → payload
- Used for: enrollment plan page links, pay links (replaces HMAC tokens)
```

#### 1.6 Create `lib/api-error-handler.ts` (NEW — if doesn't exist)
```
- withErrorHandler(handler) → wrapped NextResponse handler
- Catches errors, returns structured JSON responses
- Handles ZodError, ValidationError, ForbiddenError
- Matches Stibe CRM's centralized error pattern
```

#### 1.7 Create `lib/api-response.ts` (NEW — if doesn't exist)
```
- apiSuccess(data, status?) → NextResponse.json({ success: true, data })
- Consistent response shape across all payment routes
```

---

### Phase 2: Database Schema Migration

**Goal:** Add subscription tables, platform_settings, update existing tables.

#### 2.1 Migration: `xxx_subscription_plans.sql`
```sql
-- Platform settings table (dynamic pricing, GST rate, etc.)
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  TEXT REFERENCES portal_users(email),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO platform_settings (key, value) VALUES
  ('plan_pricing', '{"one_to_one": 4900, "one_to_three": 2900, "regular": 1900, "lecture": 990}'::jsonb),
  ('gst_rate', '0.18'::jsonb),
  ('additional_subject_price', '1500'::jsonb),
  ('billing_cycles', '{"monthly": 1.0, "quarterly": 0.9, "annual": 0.833}"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Student subscription payments (mirrors Stibe's subscription_payments)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email        TEXT NOT NULL REFERENCES portal_users(email),
  parent_email         TEXT REFERENCES portal_users(email),
  razorpay_order_id    TEXT UNIQUE,
  razorpay_payment_id  TEXT,
  razorpay_signature   TEXT,
  plan                 TEXT NOT NULL,           -- one_to_one, one_to_three, regular, lecture
  amount               INTEGER NOT NULL,        -- USD cents
  amount_inr           INTEGER NOT NULL,        -- INR paise (total incl GST)
  gst_amount           INTEGER NOT NULL DEFAULT 0,
  exchange_rate        NUMERIC(10,4) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'INR',
  billing_cycle        TEXT NOT NULL DEFAULT 'monthly', -- monthly | quarterly | annual
  payment_type         TEXT NOT NULL DEFAULT 'plan_subscription',
  -- plan_subscription | additional_subjects | plan_renewal | enrollment
  additional_subjects  INTEGER DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'created',
  -- created | attempted | paid | failed | refunded
  failure_reason       TEXT,
  period_start         TIMESTAMPTZ,
  period_end           TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  metadata             JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_payments_student ON subscription_payments(student_email);
CREATE INDEX idx_sub_payments_status ON subscription_payments(status);
CREATE INDEX idx_sub_payments_order ON subscription_payments(razorpay_order_id);
```

#### 2.2 Migration: `xxx_student_subscriptions.sql`
```sql
-- Student subscription state (like Stibe's tenant billing fields)
CREATE TABLE IF NOT EXISTS student_subscriptions (
  student_email         TEXT PRIMARY KEY REFERENCES portal_users(email),
  parent_email          TEXT REFERENCES portal_users(email),
  billing_plan          TEXT,                    -- current plan key
  plan_started_at       TIMESTAMPTZ,
  plan_expires_at       TIMESTAMPTZ,
  plan_grace_until      TIMESTAMPTZ,            -- +3 days after expiry
  billing_cycle         TEXT DEFAULT 'monthly',  -- monthly | quarterly | annual
  monthly_amount        INTEGER,                 -- USD cents
  subjects_included     INTEGER DEFAULT 1,       -- from plan default
  additional_subjects   INTEGER DEFAULT 0,       -- purchased extras
  batch_id              TEXT REFERENCES batches(batch_id),
  status                TEXT DEFAULT 'active',   -- active | grace | expired | cancelled
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Student plan features (like Stibe's tenant_features)
CREATE TABLE IF NOT EXISTS student_plan_features (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email   TEXT NOT NULL REFERENCES portal_users(email),
  feature_key     TEXT NOT NULL,
  is_enabled      BOOLEAN DEFAULT TRUE,
  enabled_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_email, feature_key)
);
```

#### 2.3 Migration: `xxx_audit_log.sql` (if doesn't exist)
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
```

---

### Phase 3: Subscription API Routes

**Goal:** Build subscription API routes matching Stibe CRM's pattern.

#### 3.1 `app/api/v1/subscription/plans/route.ts` (NEW)
```
GET — List all available plans with INR pricing
- getDynamicPlans() + getUsdToInrRate() + getDynamicGSTRate()
- Returns: plans[], exchange_rate, gst_rate
- PUBLIC route (no auth needed)
- Matches Stibe CRM's /subscription/plans exactly
```

#### 3.2 `app/api/v1/subscription/create-order/route.ts` (NEW)
```
POST — Create Razorpay order for plan subscription
- Auth: student or parent role
- Input: { plan, billing_cycle } (Zod validated)
- Calculate USD → INR → GST → total
- createOrder() via Razorpay SDK
- INSERT subscription_payments
- Returns: order_id, amounts, key_id
```

#### 3.3 `app/api/v1/subscription/verify/route.ts` (NEW)
```
POST — Verify Razorpay payment, activate plan
- Auth: student or parent
- Input: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
- verifyPaymentSignature()
- UPDATE subscription_payments → paid
- UPSERT student_subscriptions (activate plan)
- SYNC student_plan_features
- Send receipt email
- Audit log
```

#### 3.4 `app/api/v1/subscription/add-subjects/route.ts` (NEW)
```
POST — Purchase additional subjects
- Auth: student or parent
- Input: { count: number }
- Dynamic per-subject pricing
- Same create-order → verify flow
```

#### 3.5 `app/api/v1/subscription/status/route.ts` (NEW)
```
GET — Get student's current subscription status
- Auth: student, parent, or admin roles
- Returns: plan, status (active|grace|expired|none), days_remaining, features
- Redis cached (60s)
```

#### 3.6 `app/api/v1/subscription/public/` routes (NEW — 3 routes)
```
GET  /public/token-info  — Validate JWT plan token, return student info
POST /public/create-order — Token-based Razorpay order (no login needed)
POST /public/verify       — Token-based payment verification + plan activation
- Used for enrollment links (CRM → JWT email → plan page → pay → activate)
- Replaces current HMAC-based /pay/[id] and /enroll/[linkId] flows
```

---

### Phase 4: Update Existing Payment Flows

**Goal:** Migrate existing code to use new patterns without breaking current functionality.

#### 4.1 Refactor `lib/payment.ts`
- **Remove**: `createPaymentOrder()` (replaced by `lib/razorpay.ts` `createOrder()`)
- **Remove**: `verifyRazorpaySignature()` (replaced by `lib/razorpay.ts` `verifyPaymentSignature()`)
- **Remove**: Mock payment mode (production-ready only with SDK)
- **Keep**: `createInvoice()`, `completePayment()`, `getStudentInvoices()` (for legacy/transition)
- **Keep**: `generateInvoiceNumber()`, `generateReceiptNumber()`
- **Keep**: `calculateSessionFee()`, `calculateBatchSessionFee()` (fallback for non-subscribed students)
- **Update**: `formatAmount()` to use `lib/currency.ts` helpers
- **Update**: All Razorpay calls to use SDK

#### 4.2 Replace `lib/pay-token.ts`
- Current: HMAC-SHA256, no expiry, 16 hex chars
- Target: JWT via jose, 7-day expiry, rich payload
- Update all callers: `/pay/[id]`, invoice emails, WhatsApp buttons
- Backward compat: Support both HMAC and JWT during transition

#### 4.3 Update Payment API Routes (14 existing)
For each route, add:
- Zod input validation
- `withErrorHandler` wrapper
- `apiSuccess()` response format
- Audit logging for mutations

Priority order:
1. `/api/v1/payment/initiate/route.ts` — Use Razorpay SDK
2. `/api/v1/payment/public-initiate/route.ts` — Use JWT tokens
3. `/api/v1/payment/callback/route.ts` — Use SDK verification
4. `/api/v1/payment/invoices/route.ts` — Add Zod + error handler
5. Remaining 10 routes — Zod + error handler + audit

#### 4.4 Update Enrollment Flow
- Current: `/enroll/[linkId]` → enrollment form → fee calc → invoice → `/pay/[id]?t=HMAC`
- Target: `/enroll/[linkId]` → enrollment form → plan selection → `/plans?token=JWT` → Razorpay → activate
- `lib/enrollment-fee.ts` — Map region/board/grade to plan recommendations
- enrollment_links → store selected plan + JWT token

---

### Phase 5: Dashboard UI Updates

**Goal:** Add subscription management UI to dashboards.

#### 5.1 Student Dashboard — Subscription Tab
```
- Current plan status (active/expired/grace/none)
- Plan details: name, price (USD + INR), sessions remaining, subjects
- Billing cycle selector (monthly/quarterly/annual)
- "Upgrade Plan" / "Renew" / "Add Subject" buttons
- Payment history (subscription_payments)
- Replace or augment existing "Fees" tab
```

#### 5.2 Parent Dashboard — Subscription Tab
```
- Per-child subscription status
- Pay on behalf of child
- Payment history
```

#### 5.3 Owner Dashboard — Pricing Management Tab
```
- View/edit plan pricing (reads/writes platform_settings)
- Set GST rate
- Set additional subject price
- Set billing cycle discounts
- View all subscription_payments (admin report)
- Revenue analytics (charts)
```

#### 5.4 Public Plans Page — `/plans` (NEW)
```
- Display all plans with INR pricing
- Plan comparison table
- "Subscribe" / "Enroll" CTAs
- JWT-token-based payment (for enrollment links)
```

---

### Phase 6: Email & Notifications

**Goal:** Update payment emails/WhatsApp to reflect subscription model.

#### 6.1 New Email Templates
```
- subscription_activated — Plan name, period, amount (USD + INR), features
- subscription_renewed — Renewal confirmation
- subscription_expiring — 3 days before expiry warning
- subscription_expired — Plan expired, renew CTA
- payment_receipt — ISO receipt with GST breakdown (USD + INR)
- plan_selection — JWT link to choose plan (for enrollment)
```

#### 6.2 New WhatsApp Templates
```
- stibe_subscription_receipt — Payment confirmation with amount
- stibe_plan_expiring — Expiry warning with renew CTA
- stibe_plan_link — Plan selection page link
```

#### 6.3 Update Existing Templates
```
- Invoice emails → Include GST breakdown, USD + INR amounts
- Enrollment emails → Link to /plans page instead of /pay page
```

---

### Phase 7: BullMQ Jobs

**Goal:** Automated subscription lifecycle management.

#### 7.1 Subscription Expiry Check (daily cron)
```
- Query student_subscriptions WHERE plan_expires_at < NOW()
- If within grace period → status = 'grace', send warning
- If past grace → status = 'expired', disable features
- Send expiry email/WhatsApp
```

#### 7.2 Renewal Reminder (7 days before)
```
- Query student_subscriptions WHERE plan_expires_at BETWEEN NOW() AND NOW()+7days
- Send renewal reminder email/WhatsApp with renew link
```

#### 7.3 Exchange Rate Refresh (hourly)
```
- getUsdToInrRate() auto-caches in Redis for 1hr
- BullMQ job can pre-warm the cache
```

---

## Implementation Order (Priority)

```
Phase 1: Foundation Layer        [WEEK 1]
  1.1 npm install razorpay
  1.2 lib/razorpay.ts
  1.3 lib/currency.ts
  1.4 lib/plans.ts
  1.5 lib/plan-token.ts
  1.6 lib/api-error-handler.ts
  1.7 lib/api-response.ts

Phase 2: Database Migrations     [WEEK 1]
  2.1 platform_settings + subscription_payments
  2.2 student_subscriptions + student_plan_features
  2.3 audit_log

Phase 3: Subscription API        [WEEK 2]
  3.1 GET  /subscription/plans
  3.2 POST /subscription/create-order
  3.3 POST /subscription/verify
  3.4 POST /subscription/add-subjects
  3.5 GET  /subscription/status
  3.6 /subscription/public/* (3 routes)

Phase 4: Migrate Existing        [WEEK 2-3]
  4.1 Refactor lib/payment.ts
  4.2 Replace lib/pay-token.ts
  4.3 Update 14 payment API routes
  4.4 Update enrollment flow

Phase 5: Dashboard UI            [WEEK 3-4]
  5.1 Student subscription tab
  5.2 Parent subscription tab
  5.3 Owner pricing management
  5.4 Public /plans page

Phase 6: Email & Notifications   [WEEK 4]
  6.1 New email templates
  6.2 New WhatsApp templates
  6.3 Update existing templates

Phase 7: BullMQ Jobs             [WEEK 4]
  7.1 Expiry check cron
  7.2 Renewal reminder
  7.3 Exchange rate pre-warm
```

---

## Files Affected (Summary)

### New Files (16)
| File | Purpose |
|------|---------|
| `lib/razorpay.ts` | Razorpay SDK wrapper |
| `lib/currency.ts` | USD→INR conversion + Redis cache |
| `lib/plans.ts` | Plan config + dynamic pricing |
| `lib/plan-token.ts` | JWT plan tokens (replaces pay-token.ts) |
| `lib/api-error-handler.ts` | Centralized error handler |
| `lib/api-response.ts` | Standardized API responses |
| `migrations/xxx_subscription_plans.sql` | platform_settings + subscription_payments |
| `migrations/xxx_student_subscriptions.sql` | student_subscriptions + plan_features |
| `migrations/xxx_audit_log.sql` | Audit log table |
| `app/api/v1/subscription/plans/route.ts` | List plans |
| `app/api/v1/subscription/create-order/route.ts` | Create Razorpay order |
| `app/api/v1/subscription/verify/route.ts` | Verify payment + activate |
| `app/api/v1/subscription/add-subjects/route.ts` | Buy extra subjects |
| `app/api/v1/subscription/status/route.ts` | Subscription status |
| `app/api/v1/subscription/public/token-info/route.ts` | Validate plan token |
| `app/api/v1/subscription/public/create-order/route.ts` | Token-based order |
| `app/api/v1/subscription/public/verify/route.ts` | Token-based verify |

### Modified Files (20+)
| File | Changes |
|------|---------|
| `lib/payment.ts` | Remove Razorpay calls, keep invoice/receipt logic |
| `lib/pay-token.ts` | Deprecate HMAC, add JWT support, keep backward compat |
| `lib/enrollment-fee.ts` | Map to plan recommendations |
| `lib/email-templates.ts` | Add 6 subscription templates |
| `lib/whatsapp.ts` | Add 3 subscription WhatsApp templates |
| `lib/email.ts` | Add subscription email sending wrappers |
| `app/api/v1/payment/initiate/route.ts` | Use Razorpay SDK + Zod |
| `app/api/v1/payment/public-initiate/route.ts` | Use JWT tokens |
| `app/api/v1/payment/callback/route.ts` | Use SDK verification |
| `app/api/v1/payment/invoices/route.ts` | Add Zod validation |
| `app/api/v1/payment/fee-structures/route.ts` | Plans compatibility |
| (remaining 9 payment routes) | Zod + error handler + audit |
| `components/dashboard/StudentDashboard.tsx` | Add subscription tab |
| `components/dashboard/ParentDashboard.tsx` | Add subscription tab |
| `components/dashboard/OwnerDashboard.tsx` | Add pricing management |
| `app/enroll/[linkId]/page.tsx` | Link to plan selection |
| `app/pay/[id]/page.tsx` | Support JWT tokens |
| `proxy.ts` | Add subscription route permissions |
| `lib/nav-config.ts` | Add subscription nav items |

### Deprecated (kept for transition)
| File | Reason |
|------|--------|
| `lib/pay-token.ts` (HMAC functions) | Replaced by JWT plan-token.ts, kept for existing links |
| Per-session payment flow | Replaced by subscription model, kept as fallback |

---

## Backward Compatibility Strategy

1. **Existing paid invoices** — untouched, legacy invoices table remains
2. **Existing enrolled students** — auto-create `student_subscriptions` rows with `status = 'active'` for current students based on their batch type
3. **HMAC pay tokens** — Support both HMAC and JWT during transition period
4. **Session-based billing** — Keep as fallback for non-subscribed students or one-off sessions
5. **Enrollment links** — Existing links continue to work, new links use JWT flow
6. **Payroll system** — Completely unaffected (separate domain)

---

## Testing Checklist

- [ ] Plan listing returns correct USD + INR + GST amounts
- [ ] Exchange rate fetched and cached correctly
- [ ] Razorpay SDK order creation works
- [ ] Payment signature verification works
- [ ] Student subscription activates after payment
- [ ] Plan features synced correctly
- [ ] Plan expiry/grace period works
- [ ] JWT plan tokens generate and verify
- [ ] Public plan page works with JWT token
- [ ] Enrollment → plan selection → payment works end-to-end
- [ ] Existing invoice payment still works (backward compat)
- [ ] Owner can update pricing via dashboard
- [ ] Subscription emails/WhatsApp sent correctly
- [ ] BullMQ expiry cron runs correctly
- [ ] All 14 existing payment routes have Zod + error handler
- [ ] Audit log records all payment events
