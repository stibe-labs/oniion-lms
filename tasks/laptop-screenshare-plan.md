# Feature: Laptop Screen Share + Source Switching in Live Classes

## Current State Analysis

### What Exists Today
- **Tablet screen share**: Separate `teacher_screen` participant joins via Flutter app, publishes `Track.Source.ScreenShare` at 3 Mbps. Gated behind Go Live.
- **Laptop screen share**: Teacher can toggle via ControlBar → `setScreenShareEnabled()`. Available anytime (no Go Live gate). Uses LiveKit's built-in mechanism.
- **WhiteboardComposite**: Core renderer. Priority logic: `const screenSource = teacherScreenDevice || teacher` — **tablet always wins** when present.
- **TeacherOverlay (MediaPipe)**: Background-removed teacher cutout overlaid on screen share.

### Per-View Screen Detection

| View                  | Detects Tablet? | Passes `teacherScreenDevice` to WBC? | Shows Laptop Screen? |
|-----------------------|:-:|:-:|:-:|
| **TeacherView**       | ✅ (line 1053)  | ✅ (line 1860) | ✅ (via `isLocalScreenShare`) |
| **StudentView**       | ✅ (line 551)   | ✅ (line 1412) | Only if no tablet connected |
| **CoordinatorLiveView** | ❌ MISSING    | ❌             | ✅ (only from teacher participant) |
| **GhostView**         | ❌ MISSING      | ❌             | ✅ (only from teacher participant) |
| **Egress Layout**     | No distinction  | N/A            | Takes first `ScreenShare` track blindly |

### Gaps
1. **No switch toggle** — If tablet is connected + sharing, laptop screen share is invisible to students
2. **CoordinatorLiveView & GhostView** don't detect tablet participant at all
3. **Egress** takes first screen share track — no intelligence about which source
4. **No data channel** for screen source preference broadcasting

---

## Architecture Decision

### Approach: Data Channel + Auto-Detection Hybrid

**Why not just track priority?** Teacher needs explicit control. They might want to show a laptop presentation while tablet whiteboard stays connected in background.

**Why not participant metadata?** Requires server roundtrip. Data channel is instant + reliable.

**Chosen flow:**
1. Teacher toggles screen source preference in TeacherView UI
2. Teacher publishes a `screen_source` data channel message: `{ source: 'laptop' | 'tablet' }`
3. All subscribers (StudentView, GhostView, CoordinatorLiveView, Egress) receive and update local state
4. WhiteboardComposite gets new `preferLaptopScreen` prop to override its default tablet-first priority
5. **Auto-detection for late joiners**: If teacher's laptop screen share track exists → default to laptop; else tablet

**Edge cases:**
- Teacher starts laptop share → broadcasts `screen_source: laptop`
- Teacher stops laptop share → auto-falls back to tablet (if connected)
- Tablet disconnects → auto-falls back to laptop (if sharing)
- Late-joining student → detects active tracks, defaults to whichever has an active screen share track (laptop preferred if both active)

---

## Implementation Plan

### Phase 1: WhiteboardComposite Enhancement
**File:** `components/classroom/WhiteboardComposite.tsx`

- [ ] Add `preferLaptopScreen?: boolean` prop to `WhiteboardCompositeProps`
- [ ] Change priority logic from `teacherScreenDevice || teacher` to:
  ```ts
  const screenSource = preferLaptopScreen ? teacher : (teacherScreenDevice || teacher);
  ```
- [ ] When `preferLaptopScreen` is true AND teacher has no screen share track, fall back to tablet
- [ ] Ensure subscription management works for both sources

### Phase 2: TeacherView — Source Toggle UI + Broadcasting
**File:** `components/classroom/TeacherView.tsx`

- [ ] Add `screenSourcePref` state: `'tablet' | 'laptop'` (default: `'tablet'`)
- [ ] Auto-set to `'laptop'` when teacher starts laptop screen share AND tablet is connected  
- [ ] Auto-set to `'tablet'` when teacher stops laptop screen share
- [ ] Broadcast `screen_source` data channel message on every change
- [ ] Add toggle button in the teacher's whiteboard/screen area (NOT in ControlBar — too crowded):
  - Show only when BOTH laptop screen share AND tablet are active
  - Simple pill toggle: 🖥 Laptop | 📱 Tablet
  - Clear visual indicator of current source
- [ ] Pass `preferLaptopScreen={screenSourcePref === 'laptop'}` to WhiteboardComposite

### Phase 3: StudentView — Listen for Source Switch
**File:** `components/classroom/StudentView.tsx`

- [ ] Add `screenSourcePref` state (default: auto-detect from tracks)
- [ ] Add `useDataChannel('screen_source', ...)` listener that updates state
- [ ] Auto-detection for initial load / late join:
  ```ts
  // If teacher's primary participant has ScreenShare → laptop is preferred
  const teacherHasLaptopScreen = teacher?.getTrackPublication(Track.Source.ScreenShare)?.track;
  const tabletHasScreen = screenDevice?.getTrackPublication(Track.Source.ScreenShare)?.track;
  // Default: if both exist, wait for data channel; else show whichever is active
  ```
- [ ] Pass `preferLaptopScreen` to WhiteboardComposite
- [ ] Update `hasScreenShare` detection to include both sources

### Phase 4: CoordinatorLiveView — Add Tablet Detection + Source Switch
**File:** `components/classroom/CoordinatorLiveView.tsx`

- [ ] Add `isTeacherScreen()` helper (same pattern as StudentView)
- [ ] Extract `teacherScreenDevice` from remote participants
- [ ] Add `screenSourcePref` state + `screen_source` data channel listener
- [ ] Fix `hasScreenShare` to include tablet screen share
- [ ] Pass `teacherScreenDevice` and `preferLaptopScreen` to all WhiteboardComposite calls (3 instances)
- [ ] Fix subscription management for tablet tracks

### Phase 5: GhostView — Add Tablet Detection + Source Switch
**File:** `components/classroom/GhostView.tsx`

- [ ] Add `isTeacherScreen()` helper
- [ ] Extract `screenDevice` from remote participants  
- [ ] Add `screenSourcePref` state + `screen_source` data channel listener
- [ ] Fix `hasScreenShare` to include tablet screen share
- [ ] Pass `teacherScreenDevice` and `preferLaptopScreen` to WhiteboardComposite

### Phase 6: Egress Layout — Smart Source Selection
**File:** `app/egress-layout/page.tsx`

- [ ] Add tablet participant detection
- [ ] Add `screen_source` data channel listener
- [ ] Instead of `screenTracks[0]` (first random), pick based on:
  1. Data channel preference (if received)
  2. Auto-detect: laptop screen if available, else tablet
- [ ] Ensure teacher camera PiP + MediaPipe still works regardless of source

### Phase 7: Testing & Edge Cases

- [ ] Test: Teacher starts tablet share only → all views show tablet ✅
- [ ] Test: Teacher starts laptop share (no tablet) → all views show laptop ✅
- [ ] Test: Both active → teacher toggles between them → all views follow ✅
- [ ] Test: Teacher stops laptop share while on laptop mode → auto-fallback to tablet ✅
- [ ] Test: Tablet disconnects while on tablet mode → auto-fallback to laptop ✅
- [ ] Test: Late-joining student sees correct source ✅
- [ ] Test: CoordinatorLiveView sees tablet for first time ✅
- [ ] Test: GhostView sees tablet for first time ✅
- [ ] Test: Egress/YouTube stream follows source switch ✅
- [ ] Test: Recording composites correct source ✅

---

## Data Channel Protocol

**Topic:** `screen_source`

**Message format (JSON):**
```json
{
  "source": "laptop" | "tablet",
  "timestamp": 1713200000000
}
```

**Publisher:** Teacher's primary participant (TeacherView)
**Subscribers:** StudentView, CoordinatorLiveView, GhostView, Egress Layout

**Behavior:**
- `reliable: true` (TCP-like delivery)
- Teacher broadcasts on every explicit toggle
- Auto-broadcast when laptop screen share starts (if tablet connected)
- No broadcast needed when only one source exists (recipients auto-detect)

---

## Files Changed (Summary)

| File | Changes | LOC Est. |
|------|---------|:--------:|
| `WhiteboardComposite.tsx` | Add `preferLaptopScreen` prop + priority logic | ~15 |
| `TeacherView.tsx` | Source toggle state + UI + data channel broadcast | ~60 |
| `StudentView.tsx` | Data channel listener + auto-detect + pass prop | ~30 |
| `CoordinatorLiveView.tsx` | Tablet detection + listener + fix WBC calls | ~50 |
| `GhostView.tsx` | Tablet detection + listener + fix WBC call | ~40 |
| `app/egress-layout/page.tsx` | Source selection logic + data channel | ~30 |
| **Total** | | **~225** |

---

## Non-Goals (Out of Scope)

- Simultaneous display of both sources (split-screen) — not requested
- Student choosing their own preferred source — teacher controls it
- Persisting source preference to DB — volatile per session
- Changing tablet Flutter app — no changes needed there
