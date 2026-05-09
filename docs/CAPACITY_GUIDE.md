# stibe Portal — Capacity Guide (400-Student Maximum)

> **Hard ceiling**: LiveKit media server configured with `max_participants: 500` per room and `num_tracks: 7000` globally.  
> **Design target**: 400 simultaneous students across all active rooms.  
> **Infrastructure**: AMD EPYC 9355P (4 vCPU / 15 GB RAM), 2 Gbps physical port, 25 TB/month OVH cap.

---

## 1. Track Budget (Most Binding Constraint)

LiveKit uses a track-based limit (`num_tracks: 7000`). Each active room consumes:

| Who | Audio tracks | Video tracks | Data tracks | Total per participant |
|-----|-------------|-------------|-------------|----------------------|
| Teacher | 1 | 1 | 1 | 3 |
| Each student (cam+mic on) | 1 | 1 | 1 | 3 |
| Each student (cam off, mic on) | 1 | 0 | 1 | 2 |
| Each student (lecture mode — no publish) | 0 | 0 | 1 | 1 |
| Screen share device | 0 | 1 | 0 | 1 |

**Formula per room (N students, all cam+mic on)**: `3 (teacher) + 3N (students) = 3N + 3`  
**Formula per room (N students, lecture mode)**: `3 (teacher) + N (students) = N + 3`

---

## 2. Bandwidth Budget

| Metric | Value |
|--------|-------|
| Physical port | 2 Gbps |
| Student receive bandwidth (video+audio) | ~1,400 kbps each |
| Teacher upload → SFU (fanout, not multiplied) | ~2,000 kbps |
| 400 students total download | ~560 Mbps (28% of 2 Gbps) ✅ |
| Monthly at 400 students × 2h/day × 30 days | ~11.1 TB (44% of 25 TB cap) ✅ |

---

## 3. Batch Type Definitions

| Batch Type | DB Value | Default Max | Students Can Publish | Typical Use |
|------------|----------|-------------|----------------------|-------------|
| 1:1 | `one_to_one` | 1 | ✅ Full cam+mic | Private tutoring |
| 1:3 | `one_to_three` | 3 | ✅ Full cam+mic | Small group |
| 1:5 | `one_to_five` | 5 | ✅ Full cam+mic | Small group |
| 1:15 | `one_to_fifteen` | 15 | ✅ Full cam+mic | Standard class |
| 1:30 | `one_to_thirty` | 30 | ✅ Full cam+mic | Large class |
| 1:Many | `one_to_many` | 0 (unlimited) | ✅ Full cam+mic | Open class |
| Lecture | `lecture` | 0 (unlimited) | ❌ Listen-only | Mass lecture |
| Improvement | `improvement_batch` | 0 (unlimited) | ✅ Full cam+mic | Remedial |
| Custom | `custom` | 0 (unlimited) | ✅ Full cam+mic | Custom |
| Open Classroom | `open_classrooms` table | 0 (unlimited) | ✅/❌ depends | AO-managed open class |

---

## 4. Bug Fixes Applied (Capacity Hardening)

| File | Bug | Fix Applied |
|------|-----|-------------|
| `lib/livekit.ts` | `maxParticipants: 320` hard cap | → `0` (unlimited; server `max_participants: 500` governs) |
| `app/api/v1/room/create/route.ts` | `batchMaxMap` large types had `320`, fallback `?? 50` | → `0` for `one_to_many`, `lecture`, `improvement_batch`, `custom`; fallback `?? 0` |
| `app/api/v1/coordinator/rooms/[room_id]/students/route.ts` | Always blocked when `currentCount + students > maxParticipants` | → Skip check when `maxParticipants = 0` |
| `app/api/v1/coordinator/rooms/route.ts` | Default `max_participants = 50`, hard reject `> 500` | → Default `400`, reject only `< 0`; duration cap 300 → 600 min |
| `app/api/v1/open-classroom/route.ts` | `maxParticipants = Math.max(1, ... \|\| 100)` — forced default 100 | → `Number(...) \|\| 0` — 0 means unlimited |
| `app/api/v1/open-classroom/[token]/route.ts` | `can_join` flag never checked capacity | → Gate added: `can_join = false` when `student_count >= max_participants` (skips when 0) |
| Media server `livekit/config.yaml` | `num_tracks: 2000` — too low for bulk rooms | → `7000` (supports ~900 concurrent students) |

---

## 5. Combination Scenarios at 400 Students Maximum

All scenarios below stay within:
- Track budget: ≤ 7,000 tracks
- Bandwidth: ≤ 2,000 Mbps
- Monthly: ≤ 25 TB

### 5A. Pure Lecture Mode (Most Scalable)

Students in `lecture` batch type get **listen-only tokens** — no cam/mic publish.  
Track formula per room: `N + 3` (students send 1 data track only; teacher sends 3).

| Configuration | Rooms | Students/room | Total students | Total tracks | Bandwidth | Monthly TB |
|---------------|-------|--------------|----------------|--------------|-----------|-----------|
| 4× lecture rooms | 4 | 100 | 400 | 412 ✅ | 560 Mbps ✅ | 11.1 TB ✅ |
| 2× lecture rooms | 2 | 200 | 400 | 406 ✅ | 560 Mbps ✅ | 11.1 TB ✅ |
| 1× lecture room | 1 | 400 | 400 | 403 ✅ | 560 Mbps ✅ | 11.1 TB ✅ |

> **Best case**: A single lecture room of 400 students uses only **403 tracks** — 6,597 tracks headroom.

---

### 5B. Full Cam+Mic (1:30 Classes)

Track formula: `3N + 3` per room of N students.

| Configuration | Rooms | Students/room | Total students | Total tracks | Bandwidth | Monthly TB |
|---------------|-------|--------------|----------------|--------------|-----------|-----------|
| 13× 1:30 | 13 | 30 | 390 | 1,222 ✅ | 546 Mbps ✅ | 10.8 TB ✅ |
| 10× 1:30 + 2× 1:15 | 12 | mix | 330+30=360 | 1,122 ✅ | 504 Mbps ✅ | 10.0 TB ✅ |
| 8× 1:30 + 4× 1:15 | 12 | mix | 240+60=300 | 942 ✅ | 420 Mbps ✅ | 8.3 TB ✅ |

---

### 5C. Mixed Classes (1:Many + 1:30)

`one_to_many` rooms where students CAN publish cam+mic.

| Configuration | Rooms | Details | Total students | Total tracks | Bandwidth | Monthly TB |
|---------------|-------|---------|----------------|--------------|-----------|-----------|
| 8× 1:Many (50 students each) | 8 | 8 × (50×3+3) | 400 | 1,224 ✅ | 560 Mbps ✅ | 11.1 TB ✅ |
| 4× 1:Many (100 students each) | 4 | 4 × (100×3+3) | 400 | 1,212 ✅ | 560 Mbps ✅ | 11.1 TB ✅ |
| 2× 1:Many (100) + 6× 1:30 | 8 | 200+180 | 380 | 1,194 ✅ | 532 Mbps ✅ | 10.5 TB ✅ |

---

### 5D. Open Classroom Scenarios (AO-Managed)

Open classrooms use `one_to_many` batch type internally.

| Configuration | Open Classrooms | Students/class | Total students | Tracks | Notes |
|---------------|----------------|----------------|----------------|--------|-------|
| 1 large open class | 1 | 400 | 400 | 1,203 ✅ | Students with cam on |
| 2 open classes | 2 | 200 each | 400 | 1,206 ✅ | |
| 4 open classes | 4 | 100 each | 400 | 1,212 ✅ | |
| 1 open class (lecture mode) | 1 | 400 | 400 | 403 ✅ | Most efficient |

---

### 5E. Real-World Mixed Platform (Recommended Typical Day)

| Component | Count | Students | Tracks |
|-----------|-------|----------|--------|
| 1:1 private sessions | 5 | 5 | 30 |
| 1:3 small groups | 10 | 30 | 120 |
| 1:15 standard classes | 8 | 120 | 984 |
| 1:30 large classes | 4 | 120 | 372 |
| 1 open classroom (50 students) | 1 | 50 | 153 |
| 1 lecture (75 students) | 1 | 75 | 78 |
| **TOTAL** | **30 rooms** | **400** | **1,737 ✅** | 

Bandwidth: ~560 Mbps | Monthly: ~11.1 TB | Tracks used: **1,737 / 7,000 (25%)**

---

## 6. Payment Gates by Batch Type (Join Blockers)

These are **legitimate gates** — not bugs — that may prevent joining for financial reasons.

| Batch Type | Payment Gate Active? | Gate Logic |
|------------|---------------------|------------|
| `one_to_one` | ✅ Per-class credits | `student_session_credits` exhausted → block |
| `one_to_three` | ✅ Per-class credits | Same as 1:1 |
| `one_to_five` | ❌ None | No payment gate |
| `one_to_fifteen` | ✅ Overdue invoice | Any `invoices.status = 'overdue'` → block |
| `one_to_thirty` | ✅ Overdue invoice | Same as 1:15 |
| `one_to_many` | ✅ Overdue invoice | Same as 1:15 |
| `lecture` | ✅ Overdue invoice | Same as 1:15 |
| `improvement_batch` | ❌ (via `skip_payment_gate`) | Usually skipped |
| Open Classroom | ✅ If `payment_enabled` | Razorpay pay wall |
| All types | ✅ Quarterly due date | `batch_students.quarterly_due_date` past → block |

> **Skip flag**: Any batch can bypass the overdue invoice check via `batch_students.skip_payment_gate = true`.

---

## 7. Other Join Gates (Non-Capacity)

Checks inside `app/api/v1/room/join/route.ts` that may block students:

1. **Room cancelled/ended** — immediate block
2. **Demo rooms** — agent must join before student (when demo has `agent_email`)
3. **Quarterly due date** past — block (skippable via `skip_payment_gate`)
4. **Per-class credits exhausted** — 1:1 and 1:3 only
5. **Room assignment `payment_status`** overdue/pending — 1:1 and 1:3 only
6. **Overdue invoices** — group batches (1:15, 1:30, 1:many, lecture)
7. **Already submitted feedback** — prevents rejoin after feedback submitted
8. **15-min early lobby** — students can join max 15 min before scheduled start
9. **`open_at` / `expires_at` window** — blocks outside session window
10. **Class time ended** — blocks if `scheduled_start + duration_minutes < now` (non-live rooms)

> **No count gate at join time** — the portal does NOT enforce "room full" at join. LiveKit server enforces `max_participants: 500` directly on the WebRTC connection level.

---

## 8. LiveKit Server Configuration

```yaml
# /etc/livekit/config.yaml (media.stibelearning.online)
room:
  max_participants: 500      # per-room ceiling
  
rtc:
  num_tracks: 7000           # global track budget across all rooms
  bytes_per_sec: 1073741824  # 1 GB/s internal SFU bandwidth
```

**Track capacity equation**: `7000 tracks ÷ (3N+3) per room` = how many rooms of N students fit.

| Students/room | Max rooms at 7000 tracks | Max students |
|--------------|--------------------------|--------------|
| 400 (lecture, N+3) | 17 rooms | 6,783 students (theoretical) |
| 400 (full cam, 3N+3) | 5 rooms | 2,000 students (theoretical) |
| 100 (full cam) | 23 rooms | 2,300 students |
| 50 (full cam) | 46 rooms | 2,300 students |
| 30 (full cam) | 77 rooms | 2,310 students |
| 15 (full cam) | 155 rooms | 2,325 students |

> Portal design target is **400 students** leaving 83% of track budget free for growth.

---

## 9. Scaling Beyond 400 Students

If you need to go beyond 400 students:

1. **Lecture mode** — switch all group sessions to `lecture` type. Students become listen-only. Track budget becomes near-unlimited (N+3 instead of 3N+3).  
2. **Increase `num_tracks`** — raise to 14000 in `/etc/livekit/config.yaml`. Test stability first.  
3. **Upgrade server** — 4 vCPU is the limiting factor for SFU CPU. Upgrading to 8 vCPU allows ~800 students with full cam.  
4. **Sharding** — run a second LiveKit SFU and load-balance rooms across servers.
5. **CDN egress distribution** — for pure lecture (no student upload), a CDN can reduce SFU load significantly.

---

*Last updated: Jan 2025 | Server: media.stibelearning.online (76.13.244.54)*
