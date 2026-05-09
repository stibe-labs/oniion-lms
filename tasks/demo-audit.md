# Demo Workflow — Full Audit Report

**Date:** June 2025  
**Scope:** End-to-end demo flow from AO dashboard → link creation → student registration → teacher assignment → classroom session → exam → session end → notifications

---

## Status Flow (Current)

```
link_created → submitted (no teacher match) → DEAD END ❌
link_created → pending_teacher (auto-matched) → accepted → live → completed ✅
pending_teacher → rejected → DEAD END ❌
Any → cancelled (AO) — no status guard ❌
link_created → expired (48h, lazy check only)
```

---

## P0 — Critical (Broken Functionality)

### 1. AO Dashboard tabs invisible to `academic_operator` role
- **File:** `app/(portal)/academic-operator/AcademicOperatorDashboardClient.tsx` L626
- **Bug:** `{userRole === 'owner' && (<TabBar ... />)}` — entire tab bar (Demo, Students, Teachers, etc.) only renders for `owner`
- **Impact:** AO users see no tabs at all, can't access Demo management
- **Fix:** Change condition to `['owner', 'academic_operator'].includes(userRole)` or remove the guard

### 2. `submitted` status = dead-end (no teacher match)
- **File:** `app/api/v1/demo/requests/route.ts` PATCH handler + `components/dashboard/DemoTab.tsx`
- **Bug:** When student registers and no teacher matches, status becomes `submitted` with no AO action to manually assign a teacher
- **Impact:** Demo request is permanently stuck; student never gets a session
- **Fix:** Add "Assign Teacher" action button in DemoTab for `submitted` status, new PATCH action `assign_teacher`

### 3. Teacher rejection = permanent dead-end
- **File:** `app/api/v1/demo/requests/route.ts` PATCH reject handler
- **Bug:** After teacher rejects, status = `rejected` with no mechanism to reassign to another teacher
- **Impact:** Rejected demos are lost forever; AO must create a new link from scratch
- **Fix:** Add "Reassign" button for rejected status, reset to `pending_teacher` with new teacher

### 4. Demo outcome `cancelled_by_teacher` misclassification
- **File:** `app/api/v1/room/[room_id]/route.ts` L253-259
- **Bug:** If teacher ends demo (normal completion, no exam), outcome = `cancelled_by_teacher`. Should only be "cancelled" if ended significantly early.
- **Impact:** All teacher-ended demos without exams show as "cancelled" in reports  
- **Fix:** Check elapsed time vs scheduled duration. If >70% elapsed → `completed`, else → `cancelled_by_teacher`

### 5. No summary notifications on LiveKit timeout
- **File:** `app/api/v1/webhook/livekit/route.ts` L75-106
- **Bug:** `sendDemoSummaryNotifications()` only called in DELETE handler, not in webhook `room_finished`
- **Impact:** If room ends via LiveKit auto-close (not teacher DELETE), no summary emails sent
- **Fix:** Add `sendDemoSummaryNotifications(roomId)` call in webhook's `room_finished` for demo rooms

### 6. `participant_email` not in sessionStorage → wrong feedback email
- **Files:** `app/(portal)/join/[room_id]/JoinRoomClient.tsx` L251-261, `app/(portal)/classroom/[roomId]/ended/page.tsx` L77
- **Bug:** JoinRoomClient stores `participant_name` and `participant_role` but not `participant_email`. Ended page reads nonexistent `participant_email`.
- **Impact:** Demo student feedback has display name in email field instead of actual email
- **Fix:** Store `participant_email` in JoinRoomClient; read it in ended page

---

## P1 — High (Security / Data Integrity)

### 7. Teacher emails leaked in public endpoint
- **File:** `app/api/v1/demo/available-teachers/route.ts` L110-116
- **Bug:** Public `linkId` query returns `email: t.email` for each teacher. Comment says "limited info" but code includes email.
- **Impact:** PII leak — anyone with a demo link can see teacher email addresses
- **Fix:** Remove `email` from public response, use teacher ID or name only

### 8. Cancel action has no status guard
- **File:** `app/api/v1/demo/requests/route.ts` L180-186
- **Bug:** Cancel runs `UPDATE ... SET status = 'cancelled'` without checking current status
- **Impact:** Can cancel already-completed or live sessions, corrupting data
- **Fix:** Add `WHERE status NOT IN ('completed', 'cancelled', 'live')`

### 9. DELETE orphans rooms/assignments/events
- **File:** `app/api/v1/demo/requests/route.ts` DELETE handler L429-437
- **Bug:** Only deletes `demo_exam_results` + `demo_requests`. Leaves orphaned `rooms`, `room_assignments`, `room_events`.
- **Impact:** Orphaned data accumulates in DB
- **Fix:** Delete related records in `room_events`, `room_assignments`, `rooms` before deleting demo_requests

### 10. Race condition on double form submission
- **File:** `app/api/v1/demo/[linkId]/route.ts` POST handler
- **Bug:** No DB transaction or row lock when student submits demo form. Two clicks = two requests processed.
- **Impact:** Duplicate demo requests or double teacher assignments
- **Fix:** Add `BEGIN/COMMIT` transaction with `SELECT ... FOR UPDATE` on demo_requests row

### 11. `window.close()` unreliable for demo students
- **File:** `app/(portal)/classroom/[roomId]/ended/page.tsx` L92-115
- **Bug:** Demo students arrive via direct link (not `window.open`). `window.close()` blocked by browsers.
- **Impact:** Student stuck on "Thank You" page with no navigation option
- **Fix:** Add fallback: "Return to stibe" link to homepage, or show "You can close this tab"

---

## P2 — Medium (Missing Features / UX)

### 12. No AO notification when no teacher match
- **File:** `app/api/v1/demo/[linkId]/route.ts` POST handler
- **Bug:** When student registers and no teacher matches, status silently becomes `submitted`. AO gets no alert.
- **Impact:** AO doesn't know a student is waiting; may see it hours/days later
- **Fix:** Send email/WA to AO when status becomes `submitted`

### 13. No timeout on `pending_teacher` status
- **File:** None (missing feature)
- **Bug:** If assigned teacher never responds (no accept/reject), demo stays `pending_teacher` forever
- **Impact:** Student waits indefinitely
- **Fix:** Add 2-hour timeout. Cron job or lazy check — if >2h pending, notify AO + auto-escalate

### 14. False `exam_complete` on abandoned exam
- **Files:** `components/classroom/StudentView.tsx` L1172-1210
- **Bug:** If student opens exam tab, closes without finishing, then returns to classroom — `window.focus` fires `exam_complete` to teacher
- **Impact:** Teacher thinks student completed exam, but no results in DB
- **Fix:** Check `exam_complete` flag from server (poll exam results API) before sending data channel msg

### 15. Cross-midnight batch_session time query
- **File:** `app/api/v1/demo/available-teachers/route.ts` 
- **Bug:** Time range comparisons for batch sessions break when session crosses midnight
- **Impact:** Teachers incorrectly shown as available when they have evening sessions crossing midnight
- **Fix:** Handle midnight crossover in SQL time comparison

### 16. `check-email` false positive
- **File:** `app/api/v1/demo/check-email/route.ts`
- **Bug:** Returns "has pending demo" for `link_created` status (link exists but student hasn't registered)
- **Impact:** Student might be blocked from registering on a different demo link
- **Fix:** Exclude `link_created` and `expired` from the "has pending" check

### 17. Exam POST forces `completed` status
- **File:** `app/api/v1/demo/exam/route.ts` L218-222
- **Bug:** Exam submission unconditionally sets `status = 'completed'` regardless of current status
- **Impact:** Could overwrite other statuses, though mostly benign since exam happens during live session
- **Fix:** Only update status if current status is `live` or `accepted`

### 18. No teacher-side exam score in-session
- **File:** `components/classroom/TeacherView.tsx`
- **Bug:** `exam_complete` data channel only signals completion, not the actual score
- **Impact:** Teacher has no in-session visibility of how the student performed
- **Fix:** Include score/grade in the `exam_complete` data channel payload, display in TeacherView

---

## P3 — Low (Performance / Code Quality)

### 19. N+1 API calls for lead email checking
- **File:** `components/dashboard/DemoTab.tsx` L210-225
- **Bug:** Each lead row triggers individual `/api/v1/demo/check-email?email=X` call
- **Fix:** Batch endpoint that takes array of emails

### 20. LIMIT 100, no pagination
- **File:** `app/api/v1/demo/requests/route.ts` GET handler
- **Bug:** Hard limit of 100 rows, no cursor/offset pagination
- **Fix:** Add `page` + `limit` query params with cursor-based pagination

### 21. No WA send rate limit or tracking
- **File:** `app/api/v1/demo/send-link/route.ts`
- **Bug:** No record of WA sends in DB, no rate limiting, no "already sent" check
- **Fix:** Log sends in `demo_wa_sends` table, prevent duplicate sends within 5 min

### 22. Hard DELETE loses data permanently
- **File:** `app/api/v1/demo/requests/route.ts` DELETE handler
- **Bug:** Physical delete of demo_requests + exam_results. No recovery possible.
- **Fix:** Soft delete (`deleted_at` column) or archive pattern

### 23. Dead code: no-op forEach
- **File:** `app/api/v1/demo/[linkId]/route.ts` L79
- **Bug:** `busyTeachers.forEach(() => {})` — literal no-op with misleading comment
- **Fix:** Remove dead code

### 24. 48h expiry lazy-only check
- **File:** `app/api/v1/demo/[linkId]/route.ts` GET handler
- **Bug:** Link expiry only checked when someone accesses the link, not proactively
- **Impact:** AO dashboard shows stale "link_created" entries that are actually expired
- **Fix:** Check expiry in GET /demo/requests listing or add periodic cleanup

### 25. Multiple `exam_complete` data channel sends
- **File:** `components/classroom/StudentView.tsx` L1200-1207  
- **Bug:** Both `window.focus` handler and 8-minute `setTimeout` can fire `exam_complete`
- **Fix:** Track send state; only send once

---

## Implementation Priority

**Phase 19A (P0 — ship first) — DEPLOYED `0ad28a4`:**
- [x] Fix 1: AO tab visibility
- [x] Fix 4: Demo outcome misclassification  
- [x] Fix 5: Summary notifications in webhook
- [x] Fix 6: Store participant_email in sessionStorage

**Phase 19B (P1 — security/integrity) — DEPLOYED `0ad28a4`:**
- [x] Fix 7: Remove teacher emails from public endpoint
- [x] Fix 8: Cancel status guard
- [x] Fix 10: Double-submit race condition (atomic UPDATE WHERE status guard)
- [x] Fix 11: window.close() fallback

**Phase 19C (P0 — workflow dead-ends, bigger changes) — DEPLOYED `4dd2ee2`:**
- [x] Fix 2: Manual teacher assignment for `submitted`
- [x] Fix 3: Reassignment for rejected demos
- [x] Fix 9: DELETE cascading cleanup
- [x] Fix 12: AO notification on no teacher match

**Phase 19D (P2 — improvements) — DEPLOYED `0ad28a4`:**
- [x] Fix 14: False exam_complete fix (double-send prevention)
- [x] Fix 16: check-email false positive
- [x] Fix 17: Exam status guard
- [x] Fix 18: Teacher-side exam score (fetch + display after exam_complete)
- [x] Fix 23: Remove dead code
- [x] Fix 25: Multiple exam_complete sends

**Phase 19E (remaining fixes) — DEPLOYING:**
- [x] Fix 10: Double-submit race condition (atomic claim via UPDATE WHERE status = 'link_created')
- [x] Fix 13: pending_teacher 2h auto-expire (lazy check in GET /demo/requests)
- [x] Fix 15: Cross-midnight batch_session query (full timestamp arithmetic)
- [x] Fix 18: Teacher exam score display (fetch results on exam_complete, overlay UI)
- [x] Fix 19: N+1 email check → single batch query (GET /hr/users?emails=...)
- [x] Fix 24: Expired link_created lazy cleanup (covered by Fix 13 lazy cleanup)
