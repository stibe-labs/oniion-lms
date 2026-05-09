# Owner Dashboard Strip-Down Plan

**Goal:** Reduce Owner role to a pure **monitoring + governance hub**. Remove all CRUD that duplicates HR / AO / BC. Keep only what only the Owner should be doing (system-wide monitoring, fee policy, role/permission/admin governance).

---

## Final Owner Sidebar (proposed)

| # | Label | Href | Purpose |
|---|-------|------|---------|
| 1 | Overview | `/owner` | Live KPIs, charts, ghost-observation log, live-now strip |
| 2 | Live Monitor | `/owner#live` | All live sessions in a grid (read-only ghost links) |
| 3 | Sessions | `/owner#sessions` | Read-only session list across all batches |
| 4 | Users | `/owner#users` | Read-only directory: every user, role, status, attendance summary |
| 5 | Finance | `/owner#finance` | Revenue/collection KPIs, recent payments, invoice status (read-only) |
| 6 | Invoices | `/owner/invoices` | Operational: send reminders, bulk delete, view all student invoices (renamed from `/owner/fees`) |
| 7 | Fee Settings | `/owner/fee-settings` | **NEW** — global default fee rates, batch-type pricing templates |
| 8 | Payroll Monitor | `/owner#payroll` | Read-only payroll period KPIs + slip viewer (no CRUD) |
| 9 | Reports | `/owner/reports` | Existing 9-report module (kept) |
| 10 | Approvals | `/owner#approvals` | Existing triage cards (kept) |
| 11 | Ghost Mode | `/ghost` | Existing observation tool |
| 12 | Admins | `/owner/admins` | Owner-only: create other admin users |
| 13 | Roles & Permissions | `/owner/roles` | Owner-only: customize per-role permissions |
| 14 | System | `/owner/system` | Owner-only: health, global config |

---

## Items to REMOVE from Owner sidebar

- [ ] `Batches` → `/owner/batches` — duplicates `/academic-operator#batches`
- [ ] `Academic Ops` → `/owner/academic-operator` — was a redirect stub
- [ ] `Teachers` → `/owner/teachers` — duplicates `/hr#teachers`
- [ ] `HR` → `/owner/hr` — was a redirect stub
- [ ] `Exams` → `/owner/exams` — duplicates AO/teacher exam creation
- [ ] `Teacher Reports` standalone — already inside Reports module
- [ ] `Conference` standalone — out of scope for owner monitoring
- [ ] `Payroll` standalone — HR owns payroll CRUD; owner sees read-only KPIs

These pages stay accessible via direct URL (in case of bookmarks) but are removed from the sidebar to declutter.

---

## Implementation Steps

### Step 1 — Trim sidebar
- [ ] Edit `lib/nav-config.ts` `OWNER_NAV` to the 14-item list above.
- [ ] Verify `proxy.ts` owner-bypass still allows direct URL access to deprecated routes.

### Step 2 — Add Live Monitor + Users + Sessions tabs in dashboard
- [ ] Update `OwnerDashboardClient.tsx` `TabKey` to: `'overview' | 'live' | 'sessions' | 'users' | 'finance' | 'payroll' | 'approvals'`.
- [ ] Replace existing `classes` tab with two distinct tabs: `live` (just running sessions, large tiles, ghost-link per tile) and `sessions` (full session list, read-only, search/filter).
- [ ] Add `users` tab — a read-only `<UsersTab>` reuse (same component HR/AO use) with all CRUD buttons hidden via a new `readOnly` prop.
- [ ] Move `payroll` summary out of Finance tab into its own tab (read-only KPIs + slip viewer link).

### Step 3 — Build Fee Settings page (NEW)
- [ ] Create `app/(portal)/owner/fee-settings/page.tsx` + `FeeSettingsClient.tsx`.
- [ ] DB: extend `system_config` (or new `fee_settings` table) to store global defaults: per-batch-type default rates (`one_to_one`, `one_to_three`, group_15, group_30, mass), late-fee %, GST %, currency.
- [ ] API: `GET/PUT /api/v1/fee-settings` (owner only).
- [ ] UI: Cards per batch-type with editable rate; save button.

### Step 4 — Rename Fees → Invoices
- [ ] Move `app/(portal)/owner/fees/` → `app/(portal)/owner/invoices/`. Update internal links.
- [ ] Sidebar label: "Invoices".

### Step 5 — Make `UsersTab` support read-only mode
- [ ] Add `readOnly?: boolean` prop to `components/dashboard/UsersTab.tsx`.
- [ ] When `readOnly`: hide create/edit/delete/deactivate buttons; show a "Manage in HR" link.

### Step 6 — Remove unused owner sub-pages from sidebar (already deleted from nav)
- Pages remain on filesystem (still reachable by URL) but won't clutter UI:
  - `/owner/batches/*`
  - `/owner/teachers/*`
  - `/owner/exams/*`
  - `/owner/payroll/*` (replaced by in-dashboard read-only tab)
  - `/owner/academic-operator/*` (stub)
  - `/owner/hr/*` (stub)

### Step 7 — Type-check & deploy

---

## Out of Scope (this iteration)

- Moving exam creation to AO (separate task).
- Migrating Owner-created batches to AO if any exist (data migration not needed since both produce the same `batches` rows).
- Deleting deprecated route files entirely (can be done in a cleanup pass once confirmed nothing links to them).
