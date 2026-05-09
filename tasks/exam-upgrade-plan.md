# Session Exam Upgrade — Teacher Verification + Exam Tab + Marklist

## Current Flow (What Exists)

```
Teacher clicks "Start Exam" (ControlBar) → Opens exam modal
  → Select exam type (daily/weekly/model)
  → Select source (question paper / topic / material / upload)
  → Configure (page numbers, question count 5-50)
  → Click "Generate Questions"
  → AI generates via Groq (polls every 3s for progress)
  → examFlow transitions: open → generating → ready
  → "ready" state shows: topic title + question count + "▶ Start Exam — Send to Students"
  → Teacher clicks "Start Exam" → IMMEDIATELY publishes to students via data channel
  → NO PREVIEW OF QUESTIONS. Teacher NEVER sees the Q&A before sending.
  → Students get 30s auto-start dialog → take exam
  → Results trickle in via data channel → shown in sidebar above chat tabs
  → No summary notification when all students finish
```

### Current ExamFlow State Machine
```
closed → open → generating → ready → [clicks Start] → closed (exam sent)
```

### Current Sidebar Tabs (TeacherView)
```
[chat] [homework] [participants] [attendance] [monitoring]
```

### Current Results Display
- Inline box ABOVE sidebar tabs (not a tab itself)
- Shows as it comes via data channel
- No "all done" notification
- No marklist summary

---

## Proposed Upgrade

### 1. Teacher Question Preview & Verification (Before Exam Start)

**Problem**: After generation, teacher only sees "10 questions loaded" — no way to review actual questions + answers before pushing to students.

**Solution**: Add a new `reviewing` step between `ready` and pushing.

**New ExamFlow State Machine**:
```
closed → open → generating → ready → reviewing → [verified] → closed (exam sent)
                                         ↓
                                    [regenerate] → generating
```

**`reviewing` step UI** (inside the existing exam modal):
- Fetch questions via `GET /api/v1/session-exam-topics/questions?topic_id=xxx` (endpoint already exists, returns Q + A + options + solution_steps)
- Show scrollable list of all questions with:
  - Question number + text
  - 4 MCQ options (A/B/C/D) with correct answer highlighted in green
  - Solution steps (if present) in a collapsible section
- Bottom action bar:
  - **"← Regenerate"** button → goes back to `generating` state, calls generate API again with same config
  - **"✓ Approve & Send to Students"** button → publishes to students (existing `handleStartSessionExam`)

**Files to modify**:
- `components/classroom/TeacherView.tsx` — Add `reviewing` to ExamFlowStep type, add review UI, wire regenerate button
- No API changes needed — `GET /api/v1/session-exam-topics/questions` already returns everything

**New state**:
```ts
type ExamFlowStep = 'closed' | 'open' | 'generating' | 'ready' | 'reviewing';
const [previewQuestions, setPreviewQuestions] = useState<Array<{
  id: string; question_text: string; options: string[];
  correct_answer: string; marks: number; difficulty: string;
  solution_steps: string | null; image_url: string | null;
}>>([]); 
const [loadingPreview, setLoadingPreview] = useState(false);
```

**Flow change in `ready` step**:
- Currently: "ready" shows "Start Exam — Send to Students"
- New: "ready" shows "👁 Review Questions" button instead
- Clicking it fetches questions → transitions to `reviewing`

---

### 2. Add Exam Tab in Sidebar (Replacing Inline Results)

**Problem**: Exam results are shown as an inline box above the sidebar tabs. Not a dedicated tab. No persistent exam management area.

**Solution**: Add `exam` as a 6th sidebar tab.

**New Sidebar Tabs**:
```
[chat] [homework] [exam] [participants] [attendance] [monitoring]
```

**Exam Tab Content** (3 sections):

#### Section A: Exam Launcher (when no exam sent yet)
- Button: "📝 Start New Exam" → opens the exam flow modal (`setExamFlow('open')`)
- If `examFlow !== 'closed'`: show "Exam generation in progress…" status

#### Section B: Active Exam Status (when exam sent, results incoming)
- Header: "📊 Exam in Progress — {topicTitle}"
- Student count: "3 of 8 students completed"
- Live results list (same as current inline, but in the tab body)
- Each result: name, score, grade badge, percentage bar

#### Section C: Exam Complete Summary (when all students done or teacher dismisses)
- Full marklist table:
  - Rank | Name | Score | Percentage | Grade
- Class statistics: Average, Highest, Lowest, Pass %
- "Start Another Exam" button

**Files to modify**:
- `components/classroom/TeacherView.tsx` — Add 'exam' to sidebar tab array, add exam tab content, remove inline results box

**State changes**:
```ts
// sidebarTab type expands:
type SidebarTab = 'chat' | 'homework' | 'exam' | 'participants' | 'attendance' | 'monitoring';

// Track total expected students for completion detection:
const [examTotalStudents, setExamTotalStudents] = useState(0);
```

---

### 3. Exam Finish Notification with Complete Marklist

**Problem**: When exam finishes, results just sit quietly in the sidebar. No completion notification.

**Solution**: When all students complete (or teacher manually triggers), show a summary toast + auto-switch to exam tab.

**Detection**: When `sessionExamResults.length >= students.length` (all current participants submitted):
- Auto-switch sidebar to 'exam' tab
- Show toast: "🎉 All students completed! Avg: 72%"
- Sort marklist by rank (highest score first)

**Files to modify**:
- `components/classroom/TeacherView.tsx` — Add completion detection useEffect, add toast, auto-switch tab

---

## Implementation Steps (Ordered)

### Step 1: Add `reviewing` state + question preview UI
- [ ] Expand `ExamFlowStep` type to include `'reviewing'`
- [ ] Add `previewQuestions` state + `loadingPreview` state
- [ ] In `ready` step: replace "Start Exam" with "Review Questions" button
- [ ] Add fetch logic: on entering `reviewing`, call questions API
- [ ] Build preview UI: scrollable Q&A list in exam modal
- [ ] Add "Regenerate" button → re-triggers generation with same params
- [ ] Add "Approve & Send" button → calls existing `handleStartSessionExam`

### Step 2: Add exam tab to sidebar
- [ ] Add `'exam'` to sidebar tab type and tab rendering array
- [ ] Add exam tab icon (📝/clipboard SVG)
- [ ] Move exam results display from inline box into exam tab body
- [ ] Remove the old inline results box above sidebar tabs
- [ ] Add exam launcher section (Start New Exam button when no exam active)

### Step 3: Exam completion detection + marklist summary
- [ ] Track enrolled student count for completion detection
- [ ] Add useEffect to detect all-complete state
- [ ] Show completion toast with class average
- [ ] Auto-switch to exam tab on completion
- [ ] Display ranked marklist with stats (avg, highest, lowest, pass %)

### Step 4: Polish & edge cases
- [ ] Handle regenerate: preserve exam type + source + count when going back
- [ ] Handle partial completion: "Mark as Complete" button for teacher
- [ ] Ensure exam tab shows "No exam started" state initially
- [ ] Responsive design for question preview (scrollable, mobile-friendly)
- [ ] Test data channel flow end-to-end

---

## Files Changed (Total: 1 file)

| File | Changes |
|------|---------|
| `components/classroom/TeacherView.tsx` | ExamFlowStep expansion, preview states, reviewing UI, exam sidebar tab, completion detection, marklist |

## No Backend Changes Required
- `GET /api/v1/session-exam-topics/questions?topic_id=xxx` already exists and returns full Q&A with answers
- `POST /api/v1/session-exam-topics/generate` already supports re-generation
- Data channels already handle exam start/complete
