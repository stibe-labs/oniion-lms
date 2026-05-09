# stibe Portal — Lessons Learned

## Email-Token Auth Does Not Set Session Cookie

**Pattern:** Users who authenticate via `email_token` (demo students, email-invite links) get a valid `user` object in the join API but NO session cookie. All downstream APIs that require `verifySession()` fail silently with 401.

**Rule:** Whenever adding an alternative auth path (email token, magic link, etc.), always ensure the response sets a session cookie so downstream API calls from the browser work. Check all APIs the client calls after join (monitoring, feedback, attendance, etc.).

**Symptom:** Feature works for logged-in users (normal sessions) but fails silently for email-token users (demo sessions). No visible error — just missing data.

---

## Migration Drift

**Pattern:** Migrations exist as files but aren't applied to production, causing 500 errors.

**Rule:** After creating any migration file, ALWAYS:
1. Apply it to production immediately via SSH
2. Verify the `_migrations` table has the new entry
3. Test the affected API endpoints

**Root cause:** Some migrations were created during development sessions but only selectively applied. Over time, 9+ migrations accumulated as unapplied, causing 10 API endpoints to fail with missing-table/column errors.

---

## Column Name Mismatches

**Pattern:** DB migration uses one column name (e.g., `total_pay_paise`, `loss_of_pay_paise`, `period_start`), but application code uses a different name (e.g., `total_paise`, `lop_paise`, `start_date`).

**Rule:** When writing new SQL queries, ALWAYS check the actual DB column names by reading the migration file that created them. Never assume column names from memory.

**Fix strategy:** If the code consistently uses one name across 10+ files and the DB uses another, rename the DB column to match the code (cheaper than changing many files). Use `ALTER TABLE ... RENAME COLUMN`.

---

## Ambiguous Column References in JOINs

**Pattern:** When JOINing tables that share column names (e.g., `status` exists on both `attendance_sessions` and `rooms`), PostgreSQL throws "column reference is ambiguous".

**Rule:** ALWAYS prefix column names with table alias in any JOIN query. Even if it works now, future schema changes could introduce conflicts.

---

## display_name vs full_name

**Pattern:** The `portal_users` table uses `full_name`, not `display_name`. Code written from memory used the wrong column name.

**Rule:** When referencing portal_users columns, the correct names are: `email`, `full_name`, `portal_role`, `phone`, `is_active`, `password_hash`, `branch_id`, `custom_permissions`.

---

## PowerShell Cookie Handling

**Pattern:** `Invoke-RestMethod -SessionVariable` doesn't properly pass cookies in subsequent calls. 

**Rule:** Use `Invoke-WebRequest -WebSession $ws -UseBasicParsing` instead. Create the session variable with `-WebSession $ws` on the login call, then reuse `$ws` on subsequent calls.

---

## Test After Every Deploy

**Pattern:** Always test the specific endpoints affected by your changes after deploying.

---

## Batch-Related Column Names

**Pattern:** The `batches` table uses `batch_id`, `batch_name`, `batch_type` — NOT `id`, `name`, `type`. Many route files were written with the shorter names, causing 500 errors.

**Rule:** When querying the `batches` table, ALWAYS use the prefixed column names: `batch_id`, `batch_name`, `batch_type`. If you need shorter names in the response object, use SQL aliases: `b.batch_id AS id, b.batch_name AS name`.

---

## WhatsApp Cannot Send to Own Business Number

**Pattern:** Sending WhatsApp messages to the business's own phone number (`917356072106`) always returns "Invalid parameter" error from Meta API, even with approved templates.

**Rule:** When testing WhatsApp sends, ALWAYS use an external number (not the business number). The Meta Cloud API does not allow messaging your own registered WhatsApp Business number.

---

## WhatsApp Template Params Must Be Strings

**Pattern:** Meta Cloud API requires all template parameters to be strings. Passing numbers or undefined values causes "Invalid parameter" errors.

**Rule:** Always cast all `waParams` values to `String()` before sending. The `fireWhatsApp()` function handles this, but when constructing params at call sites, ensure no `undefined` or `null` values leak in.

---

## WhatsApp Regex Extraction Is Fragile

**Pattern:** The original approach of extracting template parameters from email HTML using regex (`META_EMAIL_TEMPLATE_MAP`) was fragile — regex patterns broke when email template wording changed.

**Rule:** Always pass structured `waTemplate` + `waParams` at the call site instead of relying on regex extraction from email body. The regex fallback (`META_EMAIL_TEMPLATE_MAP`) is kept for backward compatibility only.

---

## Meta System User Token Never Expires

**Pattern:** The WhatsApp Business API uses a "Permanent System User" token that never expires (expires: 0). This is different from the short-lived User Access Token that expires in hours.

**Rule:** Use the System User token for production. Never use a regular User Access Token for server-side WhatsApp sends — it will expire and break notifications silently.

---

## attendance_sessions Column Names

**Pattern:** Multiple inconsistencies between code and DB:
- `is_late` → actual column is `late_join`
- `time_in_class_seconds` → actual column is `total_duration_sec`
- `late_by_seconds` → actual column is `late_by_sec`
- `student_email` → actual column is `participant_email`
- `participant_type` → actual column is `participant_role`
- `left_at` / `joined_at` / `session_date` → don't exist; use `last_leave_at`, `first_join_at`, filter via JOIN to `rooms.scheduled_start`

**Rule:** Before writing any query on `attendance_sessions`, always check these correct column names. Use SQL aliases if the frontend expects the old names.

---

## batch_students Has No is_active Column

**Pattern:** `batch_students` table only has: `id`, `batch_id`, `student_email`, `parent_email`, `added_at`. There is no `is_active` column.

**Rule:** Don't filter on `bs.is_active` when querying `batch_students`. All enrolled students are assumed active.

---

## exam_attempts Has No total_questions Column

**Pattern:** `exam_attempts` table has: `id`, `exam_id`, `student_email`, `student_name`, `started_at`, `submitted_at`, `score`, `total_marks`, `percentage`, `grade_letter`, `status`, `created_at`. No `total_questions` column.

**Rule:** Use `ea.percentage` directly instead of calculating from `total_questions`.

---

## exams Has No batch_id Column

**Pattern:** `exams` table has no `batch_id` — only `grade`, `subject`, and other metadata. Cannot filter exams by batch.

**Rule:** Filter exams by `grade` only, not by `batch_id`.

**Rule:** After any production deploy, run the full endpoint test suite (29 endpoints) to catch regressions immediately. Don't assume green locally means green in production.

---

## rooms Table Has Strict NOT NULL + CHECK Constraints

**Pattern:** The `rooms` table requires: `room_id`, `room_name`, `subject`, `grade`, `coordinator_email`, `status`, `scheduled_start`, `duration_minutes`, `open_at`, `expires_at`. Status must be one of: `scheduled`, `live`, `ended`, `cancelled`. Duration must be > 0.

**Rule:** When inserting into `rooms`, ALWAYS include `coordinator_email`. Auto-resolve it from the batch's `coordinator_email`, or from the caller if they are a coordinator. Never skip NOT NULL columns.

---

## room_events FK Requires Valid room_id

**Pattern:** `room_events.room_id` has a foreign key to `rooms.room_id`. Using `'system'` as a room_id for system-level events fails unless a `'system'` room row exists.

**Rule:** For non-room events (admission status changes, etc.), either use a dedicated `'system'` room (must be pre-created in DB), or use the `notifications` table, or wrap the event logging in try-catch so it doesn't break the main operation.

---

## exam_questions.correct_answer Is Integer, Not Text

**Pattern:** `correct_answer` column in `exam_questions` is `integer` type — it represents the 0-based index of the correct option in the `options` array, NOT the answer text.

**Rule:** When creating exams via API, send `correct_answer` as an integer index (0, 1, 2, 3...), not as the option text string.
---

## Non-Portal Users Have No Phone in user_profiles

**Pattern:** Demo students register via public links — their data goes into `demo_requests`, NOT `user_profiles` or `portal_users`. When `lookupPhone(email)` queries only `user_profiles`, WhatsApp fails silently for these external users.

**Rule:** When sending WhatsApp to recipients who may not be portal users (demo students, leads, external contacts), ALWAYS pass `recipientPhone` directly via the `SendEmailOptions.recipientPhone` field. Never rely solely on `user_profiles` for phone lookup.

---

## sessionStorage Must Be Set Before Classroom Navigation

**Pattern:** Navigating to `/classroom/[roomId]` via `<a href>` or `router.push()` without first setting `sessionStorage` (`lk_token`, `lk_url`, etc.) causes "Missing session data" error because `ClassroomWrapper` reads from sessionStorage.

**Rule:** Before navigating to a classroom URL, ALWAYS either: (a) set sessionStorage with token data from the API response, or (b) use `/api/v1/room/join` to fetch a fresh token, store it, then navigate. Never use plain `<a href>` links to `/classroom/`.

---

## PowerShell Dollar Signs Corrupt SSH Heredocs

**Pattern:** When using `ssh stibe-portal "cat > /path << 'EOF' ... EOF"` from PowerShell, `$` variables in the content (like Nginx `$host`, `$proxy_add_x_forwarded_for`) get expanded by PowerShell, corrupting the file.

**Rule:** When deploying config files with `$` variables to a remote server from PowerShell, create the file locally first and SCP it, rather than using heredoc over SSH.
---

## API Response Structure Consistency

**Pattern:** Backend API wraps successful responses with `{ success: true, data: { ... } }`, but frontend code assumes data is at top level (e.g., `data.requests` instead of `data.data.requests`).

**Rule:** When creating API GET endpoints that return collections:
1. Backend: Always use `ok({ requests: [...], counts: {...} })` � wraps in success/data envelope
2. Frontend: Access nested data: `data.data?.requests` (double data access)
3. Check session-requests API for reference � it correctly uses `data.data?.requests`

**Symptom:** Empty state shows "No items yet" even though items exist in database. Network tab shows 200 response with data, but UI doesn't display it.

**Fix strategy:** Search for all `await fetch('/api/v1/teacher-leave')` calls and verify data path is `data.data?.requests`, not `data.requests`.

---

## Multi-Level Approval Status Display

**Pattern:** System has approval chain (AO ? HR ? Owner), but UI only shows overall `status` field. When AO approves but HR hasn't, `status='pending'` confuses users ("I approved it, why is it still pending?").

**Rule:** For multi-level approval workflows:
1. Store individual level status fields: `ao_status`, `hr_status`, `owner_status`
2. Overall `status` becomes 'approved' only when workflow completes
3. UI must interpret approval chain state and show meaningful labels:
   - "Pending AO Review" (initial submission)
   - "Pending HR Approval" (AO approved, waiting for HR)
   - "Pending Owner Approval" (AO+HR approved, waiting for Owner)
   - "Approved" (fully approved)
4. Use warning badge variant (amber) for in-progress approvals vs. gray for initial pending
5. Always keep individual level status indicators visible (??? icons) for transparency

**Implementation pattern:**
`typescript
const getDisplayStatus = (item) => {
  if (item.status === 'approved') return { status: 'approved', label: 'Approved' };
  if (item.status === 'rejected') return { status: 'rejected', label: 'Rejected' };
  if (item.ao_status === 'approved' && item.hr_status === 'pending')
    return { status: 'warning', label: 'Pending HR Approval' };
  // ... etc
};
`

**Affected components:** Teacher dashboard, Coordinator dashboard, AO dashboard (any approval chain workflow).

---

## Always Verify DB Schema Before Writing UPDATE Queries

**Pattern:** The exam regenerate PATCH handler used `updated_at = NOW()` in the UPDATE query, but the `session_exam_questions` table has no `updated_at` column. The query silently failed (caught by try/catch), returning a 500 error that the client handled by just logging to console — making the regenerate button appear to do nothing.

**Rule:** Before writing any UPDATE/INSERT query, ALWAYS verify the actual table columns exist. Don't assume columns like `updated_at` exist — check the migration or query `information_schema.columns`. Also: when a feature "silently doesn't work," check for DB column mismatches FIRST — they're the most common cause.

**Debugging lesson:** When server logs show "no requests" for an endpoint, verify the endpoint has success logging — not just error logging. The absence of log entries might mean the endpoint IS being called but only logs on errors.
