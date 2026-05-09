# AI Monitoring Refinement Plan — Real Classroom Behavior

**Date:** 2026-04-21
**Status:** Planning
**Goal:** Eliminate false-positive "out of frame / attention drop" flags during legitimate note-taking, writing, and textbook-reading in live online tutoring classes.

---

## 1. Current System Study

### Pipeline (`hooks/useAttentionMonitor.ts`)

1. MediaPipe `FaceLandmarker` runs every **1.5s** on the student's camera feed.
2. Extracts 478 landmarks + 52 blendshapes + 4×4 head transform matrix.
3. Derives: `eyesClosed`, `gazeAway`, `headYaw`, `headPitch`, `yawning`, `eyesDownward`.
4. Computes a `faceScore` (0–100) → rolling average over ~60s → broadcast via LiveKit data channel + batched server events every 30s.
5. Classifier emits one `MonitorEventType` per tick.

### Current States (12)
`attentive` · `looking_away` · `eyes_closed` · `not_in_frame` · `low_engagement` · `distracted` · `tab_switched` · `multiple_faces` · `yawning` · `inactive` · `head_turned` · `in_exam`

### Current Thresholds
| Signal | Threshold | Sustained Count |
|--------|-----------|-----------------|
| Eye blink | >0.55 | 2 ticks (~3s) |
| Gaze away (horizontal/up) | >0.4 | 3 ticks (~4.5s) |
| Head yaw | >35° | 3 ticks (~4.5s) |
| Head pitch | >30° | 3 ticks (~4.5s) |
| Jaw open (yawn) | >0.6 | 3 ticks (~4.5s) |
| No face | `faceCount === 0` | **0 ticks — immediate** ⚠️ |
| Multiple faces | `faceCount > 1` | **0 ticks — immediate** ⚠️ |
| Tab hidden | `document.hidden` | **0 ticks — immediate** ⚠️ |

### Existing Note-Taking Logic
Already handles: head pitch **≤35°** downward + eyes looking down + yaw <15° → `isNoteTaking = true` → suppresses `head_turned` and `looking_away` penalties.

**Works for:** student tilts head slightly down while reading on-screen notes or writing in a notebook held up near the laptop.

**Fails for:** student lowers head/notebook further such that the **face leaves the frame entirely** → detector returns 0 faces → immediate `not_in_frame` → attention score crashes.

---

## 2. Real-World Scenarios Causing False Positives

| # | Scenario | Current Misclassification | Root Cause |
|---|---|---|---|
| 1 | Student writes on notebook below laptop/camera | `not_in_frame` | Face fully out of frame, 0-tick gating |
| 2 | Student reads textbook laid flat on desk | `not_in_frame` or `head_turned` | Extreme pitch + partial occlusion |
| 3 | Student flips page / grabs pen / pencil drops | `not_in_frame` brief spike | Momentary occlusion |
| 4 | Student uses calculator on desk | `head_turned` + pitch > 30° | Yaw exceeds 35° briefly |
| 5 | Sibling / parent walks behind student | `multiple_faces` alarm | 0-tick gating |
| 6 | Ceiling fan / backlight / dim room | `not_in_frame` flickers | Detection confidence drops |
| 7 | Student drinks water / eats biscuit | `yawning` false positive | jawOpen >0.6 |
| 8 | Student wears hoodie / hijab / large glasses | Low confidence → intermittent `not_in_frame` | Face feature occlusion |
| 9 | Mobile student moves phone while talking | `head_turned` continuous | Camera-relative pose, not student pose |
| 10 | Teacher shares whiteboard; student copies to notebook (1–5 min stretch) | `not_in_frame` accumulates minutes | No persistent writing-session awareness |

**User's primary pain point:** scenarios **1, 2, 3** — the student is **actively engaged** (writing what the teacher is explaining), but the system marks them as absent.

---

## 3. Refinement Strategy

### Principle: **"Assume engagement unless proven otherwise."**
Writing and note-taking are the **core learning activity** in tuition. The monitor must not penalize them.

### 3.1 Core Changes

#### A. Temporal gating on `not_in_frame` (CRITICAL)
Currently immediate. Change to:
- **0–2 ticks (0–3s) absence:** no state change — stay in last state.
- **2–6 ticks (3–9s):** emit `writing_notes` (new state — positive/neutral) **IF** recent context was note-taking.
- **6–10 ticks (9–15s):** emit `brief_absence` (new state — neutral).
- **>10 ticks (>15s):** emit `not_in_frame` (genuine absence).

#### B. Persistent "writing session" context
Track rolling window of last 90s:
- If student entered `isNoteTaking` zone or `writing_notes` state **≥3 times** in last 90s → mark `inWritingSession = true` for next 3 min.
- While `inWritingSession`:
  - Tolerance for `not_in_frame` extended to **30s** before flagging.
  - `attentionScore` **decay is dampened** during absence (floor at 70 instead of 0).
  - UI label changes from "Out of Frame" → "📝 Taking Notes".

#### C. Last-known-score grace decay
Currently: `faceCount === 0` → `faceScore = 0` → rolling avg plummets.
New: during brief absences, **carry forward the last faceScore with linear decay** (−5 points per tick) rather than hard zero. Resumes normal scoring when face returns.

#### D. Multiple-faces temporal gating
Require **4 consecutive ticks (~6s)** before emitting `multiple_faces`. Covers family members walking behind.

#### E. Yawn vs. drinking/eating
Add heuristic: if `jawOpen > 0.6` AND `mouthClose < 0.1` for **≥3 ticks** AND no horizontal head motion → yawn. Otherwise treat as `brief_mouth_open` (ignored).

#### F. Low-visibility / poor-lighting fallback
Track `minFaceDetectionConfidence` output. If rolling 30s average confidence <0.5 → emit `low_visibility` (neutral, not a distraction). Prevents noisy rooms from polluting reports.

#### G. Mobile-aware thresholds
On mobile devices:
- Yaw threshold: 45° (instead of 35°)
- Pitch threshold: 40° (instead of 30°)
- `not_in_frame` gate: 15 ticks (vs. 10) — phone motion common.

#### H. Writing-session score floor
When `inWritingSession`:
- `attentionScore` cannot fall below **65** due to frame exits alone.
- Teacher dashboard shows "📝 Writing" badge instead of red alert.

### 3.2 New States

Add 3 positive/neutral states to `MonitorEventType`:

```typescript
| 'writing_notes'     // student intentionally below frame (note-taking)
| 'brief_absence'     // 9-15s absence, not yet alarming
| 'low_visibility'    // camera/lighting problem, not a behavior issue
```

Update `lib/monitoring.ts` `MonitoringEventType` to match. These count as **engaged time** in reports, not distracted time.

### 3.3 Reports Impact (`lib/monitoring-reports.ts`)

Add new columns to aggregation:
- `writing_notes_minutes`
- `brief_absence_minutes` (neutral — not distracted)
- `low_visibility_minutes` (neutral)

Subtract these from `attention_issues_total`. Report shows:
> "Engaged time: 42 min (includes 8 min note-taking)"

### 3.4 Teacher UI Changes (`StudentView.tsx`, teacher grid)

- Red badge "Out of Frame" → Blue badge "📝 Writing" when `writing_notes`.
- Attention ring on student tile stays **green** during writing sessions.
- Tooltip: "Student is taking notes — this is normal."

### 3.5 Academic Operator Settings (extend `TeacherControlsTab`)

Add toggle group **"AI Monitoring Tuning"**:
- [x] Writing-aware mode (default ON) — treat note-taking as engaged
- [x] Mobile relaxed thresholds (default ON)
- [ ] Strict mode for exam sessions (default OFF) — overrides writing-aware

Store in `academic_settings.setting_key = 'monitoring_tuning'`.

---

## 4. Training-Data Strategy

For continuous improvement, we need **labeled real classroom footage**:

### 4.1 Data collection
- During beta: enable **consent-based local sample capture** on 10 volunteer students.
- Capture 5-second clips on every state transition (anonymized, blurred background).
- Store locally; opt-in upload for review.

### 4.2 Labeling taxonomy
For each clip, human-label:
- `engaged_watching`
- `writing_notes`
- `reading_textbook`
- `truly_distracted` (phone, unrelated activity)
- `left_session`
- `ambient_issue` (lighting, camera angle)

### 4.3 Threshold calibration
Run grid-search on thresholds (yaw, pitch, sustained counts) against labeled set. Optimize for:
- Minimize false positives on `writing_notes` + `reading_textbook`.
- Maintain true positives on `truly_distracted` + `left_session`.
- Target F1 ≥ 0.9 on distraction detection.

### 4.4 Regression test suite
Persist labeled clip set as `test/monitoring/fixtures/`. New threshold changes must pass all fixtures.

---

## 5. Implementation Phases

### Phase 1 — Quick wins (core fix)
- [ ] Add temporal gating to `not_in_frame` (SUSTAINED_ABSENCE_COUNT = 3 for initial soft-flag, 10 for hard-flag)
- [ ] Carry-forward score during brief absences
- [ ] Add `writing_notes` and `brief_absence` states
- [ ] Update `StudentView.tsx` self-tile UI to show "Writing" badge
- [ ] Update `TeacherView.tsx` student grid badge styling

### Phase 2 — Context awareness
- [ ] Implement `inWritingSession` rolling window
- [ ] Score floor during writing session
- [ ] Multiple-faces temporal gating
- [ ] Yawn vs. eating/drinking heuristic

### Phase 3 — Reports & visibility
- [ ] Extend `lib/monitoring-reports.ts` with new buckets
- [ ] Teacher report UI: separate "Engaged (incl. notes)" from "Distracted"
- [ ] Parent dashboard: show positive framing

### Phase 4 — AO settings
- [ ] Add `monitoring_tuning` key + API
- [ ] `TeacherControlsTab` new section
- [ ] Wire toggles into `useAttentionMonitor` config

### Phase 5 — Advanced (optional)
- [ ] Low-visibility fallback
- [ ] Mobile-aware thresholds
- [ ] Training-data capture + labeling pipeline
- [ ] Threshold auto-calibration from labeled data

---

## 6. Affected Files

| File | Change |
|---|---|
| `hooks/useAttentionMonitor.ts` | Core algorithm changes, new states, gating |
| `lib/monitoring.ts` | Add 3 states to `MonitoringEventType` union |
| `lib/monitoring-reports.ts` | New aggregation buckets |
| `components/classroom/StudentView.tsx` | Self-tile writing badge |
| `components/classroom/TeacherView.tsx` | Student grid writing-aware badge |
| `components/classroom/CoordinatorLiveView.tsx` | Same badge treatment |
| `components/dashboard/StudentReportsTab.tsx` | Split engaged vs. distracted |
| `components/dashboard/TeacherControlsTab.tsx` | Monitoring tuning section |
| `app/api/v1/teacher-controls/route.ts` | `monitoring_tuning` keys |
| `app/api/v1/monitoring/events/route.ts` | Accept new event types |
| `migrations/0xx_monitoring_new_states.sql` | If DB enum used — add values |

---

## 7. Verification Plan

### Manual test scenarios (must all pass before deploy)
1. ✅ Student writes in notebook below laptop for 5 min → stays `writing_notes`, score ≥65
2. ✅ Student stands up to get water (15s) → `brief_absence` → returns to `attentive`
3. ✅ Student leaves room for 2 min → `not_in_frame` fires correctly
4. ✅ Sibling walks behind for 3s → NOT flagged as `multiple_faces`
5. ✅ Student uses phone for 30s while head down → flagged correctly (phone detection separate)
6. ✅ Student tilts laptop lid causing angle shift → does NOT trigger `head_turned`
7. ✅ Exam mode (strict) — writing-aware disabled → note-taking flagged as distracted

### Automated tests
- Synthetic blendshape sequence unit tests for classifier state machine
- Fixture-based regression: replay labeled clip landmark streams → assert state sequence

---

## 8. Success Metrics

Before → After (target):
- False-positive `not_in_frame` rate: ~40% → **<5%**
- Teacher-reported "student was actually writing" complaints: baseline → **zero**
- Student attention-score average during class: ~60 → **~80** (reflects real engagement)
- Distracted-minute reports accuracy (vs. teacher manual review): ~70% → **>90%**

---

## 9. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Students exploit writing-aware mode to hide (phone in lap) | Strict mode flag; `inWritingSession` times out after 3 min without a head-return |
| Genuine absences missed | Hard threshold at 15s still fires `not_in_frame` |
| Report metrics change baseline | Version reports; flag reports generated under new algorithm |
| Mobile device users over-tolerated | Gate mobile mode by explicit device-type check, not UA spoofing |

---

## 10. Open Questions

1. Should `writing_notes` count toward attendance time as 100% engaged, or 90%?
2. Should teachers have a one-click "Student is writing" override to suppress alerts manually?
3. Do we want audio-based engagement signal (voice activity when teacher asks questions)?
4. Should exam mode auto-disable writing-aware, or just raise thresholds?
