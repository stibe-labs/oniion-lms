# Media Server Capacity Plan

**Server**: OVH ADVANCE-2 — AMD EPYC 4344P, 64 GB DDR5, 2× 960 GB NVMe  
**Location**: Asia Pacific — Mumbai, India  
**Network**: 2 Gbps public port, 25 TB/month traffic cap (outbound)  
**Purpose**: LiveKit SFU (WebRTC media server) for stibe live classrooms

---

## How the SFU Works (Architecture)

The stibe classroom is a **hub-and-spoke model**, NOT a mesh:

```
Each student  → receives: teacher screen share + teacher cam + teacher mic
Teacher       → receives: all N student cams + all N student mics
BC / AO       → receives: all N student cams + all N student mics (same as teacher)
Students      → do NOT receive each other's video/audio
```

This means server load scales **O(N)** per room — adding one student adds one fixed cost, not N² cost.

---

## Bandwidth Rate Card (per track)

| Track | Direction | Bitrate |
|-------|-----------|---------|
| Teacher screen share | Upload to SFU | 2,000 kbps |
| Teacher camera | Upload to SFU | 400 kbps |
| Teacher mic | Upload to SFU | 50 kbps |
| **Teacher → each student** (screen+cam+mic) | SFU download | **1,200 kbps** |
| Student camera | Upload to SFU | 200 kbps |
| Student mic | Upload to SFU | 50 kbps |
| **Student → teacher** (cam+mic) | SFU download | **200 kbps** |
| Student mic only → teacher | SFU download | **50 kbps** |

> Teacher uploads high quality; SFU downscales to simulcast-low (150 kbps cam) for students.  
> Screen share uses VP9 content mode — 1,000 kbps for slides, up to 2,000 kbps for video.

---

## SFU Bandwidth Formula

For **R rooms**, each with **N students**, teacher with cam + mic + screen share, students with cam + mic:

```
Outbound (SFU → participants):
  To N students:   R × N × 1,200 kbps   (teacher streams)
  To teacher:      R × N × 200 kbps     (all student cams+mics)
  ─────────────────────────────────────
  Total outbound:  R × N × 1,400 kbps

Inbound (participants → SFU):
  From R teachers: R × 2,450 kbps       (negligible)
  From N students: R × N × 250 kbps
  ─────────────────────────────────────
  Total inbound:   R × N × 250 kbps + R × 2,450 kbps
```

**OVH traffic cap** counts outbound only. Port speed (2 Gbps) is peak in either direction.

---

## Scenario Table

### Assumptions for monthly data calculations
- School days per month: **22**
- Daily class hours (all rooms running): **1.5 hours**
- Total monthly class hours: **33 hours** (22 × 1.5h)

---

### Scenario 1 — Maximum Load (3 Rooms × 300 Students, All On)
**Teacher: cam + mic + screen share | Students: cam + mic**

| Metric | Value |
|--------|-------|
| Total outbound | 3 × 300 × 1,400 = **1,260 Mbps** |
| Total inbound | 3 × 300 × 250 + 3 × 2,450 = **233 Mbps** |
| Peak total bandwidth | **1,493 Mbps (1.49 Gbps)** |
| Port utilisation | **74.7% of 2 Gbps** ✅ |
| Daily outbound data | 1,260 Mbps × 5,400s ÷ 8 = **850 GB** |
| Monthly outbound data | 850 × 22 = **18.7 TB** ✅ |
| 25TB cap headroom | **6.3 TB remaining** ✅ |

**Result: Fits comfortably. ✅**

---

### Scenario 2 — Normal Operation (3 Rooms × 200 Students, All On)
**Teacher: cam + mic + screen share | Students: cam + mic**

| Metric | Value |
|--------|-------|
| Total outbound | 3 × 200 × 1,400 = **840 Mbps** |
| Total inbound | 3 × 200 × 250 = **153 Mbps** |
| Peak total bandwidth | **993 Mbps (0.99 Gbps)** |
| Port utilisation | **49.7% of 2 Gbps** ✅ |
| Daily outbound data | **567 GB** |
| Monthly outbound data | **12.5 TB** ✅ |

**Result: Very comfortable, large safety margin. ✅**

---

### Scenario 3 — Two Large Rooms (2 Rooms × 300 Students, All On)
**Teacher: cam + mic + screen share | Students: cam + mic**

| Metric | Value |
|--------|-------|
| Total outbound | 2 × 300 × 1,400 = **840 Mbps** |
| Total inbound | 2 × 300 × 250 = **153 Mbps** |
| Peak total bandwidth | **993 Mbps (0.99 Gbps)** |
| Port utilisation | **49.7% of 2 Gbps** ✅ |
| Monthly outbound data | **12.5 TB** ✅ |

**Result: Identical load to 3 rooms × 200 students. ✅**

---

### Scenario 4 — Single Large Room (1 Room × 300 Students, All On)
**Teacher: cam + mic + screen share | Students: cam + mic**

| Metric | Value |
|--------|-------|
| Total outbound | 1 × 300 × 1,400 = **420 Mbps** |
| Peak total bandwidth | **497 Mbps (0.50 Gbps)** |
| Port utilisation | **24.9% of 2 Gbps** ✅ |
| Monthly outbound data | **6.3 TB** ✅ |

**Result: Only uses 25% of available bandwidth. ✅**

---

### Scenario 5 — Lecture Mode (3 Rooms × 500 Students, Students View Only)
**Teacher: cam + mic + screen share | Students: NO cam, NO mic**

Students cannot publish (`canPublish: false` — Lecture batch type enforces this)

| Metric | Value |
|--------|-------|
| Per-student cost | 1,200 kbps (teacher → student only; teacher receives nothing) |
| Total outbound | 3 × 500 × 1,200 = **1,800 Mbps** |
| Total inbound | 3 × 2,450 = **7 Mbps** (only teacher uploads) |
| Peak total bandwidth | **1,807 Mbps (1.81 Gbps)** |
| Port utilisation | **90.3% of 2 Gbps** ✅ |
| Daily outbound data | **1,215 GB** |
| Monthly outbound data | **26.7 TB** ⚠️ EXCEEDS 25TB cap by 1.7TB |

**Result: Bandwidth fits, but monthly cap is exceeded. Reduce to 470 students per room or fewer school days.**

> **Safe lecture mode limit: 3 rooms × 460 students = 24.9 TB/month ✅**

---

### Scenario 6 — Students Mic Only, No Camera (3 Rooms × 400 Students)
**Teacher: cam + mic + screen share | Students: mic only, NO camera**

| Metric | Value |
|--------|-------|
| Per-student outbound | 1,200 + 50 = **1,250 kbps** (teacher → student + student mic → teacher) |
| Total outbound | 3 × 400 × 1,250 = **1,500 Mbps** |
| Total inbound | 3 × 400 × 50 + 3 × 2,450 = **68 Mbps** |
| Peak total bandwidth | **1,568 Mbps (1.57 Gbps)** |
| Port utilisation | **78.4% of 2 Gbps** ✅ |
| Monthly outbound data | **22.3 TB** ✅ |

**Result: Good choice for large audio-participation classes. ✅**

> Removing student cameras saves very little bandwidth because the dominant cost is
> teacher screen share being sent to every student. Student cams only matter for teacher-side load.

---

### Scenario 7 — High Frequency (3 Rooms × 300, 2 Sessions Per Day)
**Teacher: cam + mic + screen share | Students: cam + mic | 2 × 1.5h sessions/day**

| Metric | Value |
|--------|-------|
| Peak bandwidth | **1,493 Mbps (same as Scenario 1)** ✅ |
| Daily outbound data | **1,700 GB** (2 sessions) |
| Monthly outbound data | **37.4 TB** ❌ EXCEEDS 25TB cap |

**Result: Two full-capacity sessions per day exceeds the 25TB cap.**

> For 2 daily sessions, reduce to 3 rooms × 150 students = 18.7 TB/month.

---

## Bandwidth Limits Summary

| Limit | Students per room | Rooms | Condition |
|-------|------------------:|------:|-----------|
| **2 Gbps port (hard max)** | **~476** | 3 | All cam+mic on |
| **25 TB/month cap (1 session/day)** | **~405** | 3 | All cam+mic on, 22 days |
| **25 TB/month cap (1 session/day)** | **~460** | 3 | Lecture mode (students view-only) |
| **25 TB/month cap (2 sessions/day)** | **~200** | 3 | All cam+mic on, 22 days |
| **Recommended safe operating point** | **300** | 3 | All cam+mic, 1 session/day |

---

## Current Code Limits (Must Update)

Before the server upgrade matters, these code caps need to be raised:

| File | Current | Must Change To |
|------|---------|---------------|
| `lib/livekit.ts` → `ensureRoom()` → `maxParticipants` | `210` | `320` |
| `app/api/v1/room/create/route.ts` → `batchMaxMap.lecture` | `50` | `320` |
| `app/api/v1/room/create/route.ts` → `batchMaxMap.one_to_many` | `50` | `320` |
| `app/api/v1/room/create/route.ts` → `batchMaxMap.custom` | `50` | `320` |
| LiveKit config `max_participants` | `250` (updated today) | `320` |

---

## Monthly Traffic Cap Alert

Set an OVH bandwidth alert at **20 TB** in the OVH control panel:  
`OVH Manager → Bare Metal → Your server → Bandwidth → Alert threshold`

If you hit 20 TB before month end, reduce concurrent room count or disable student cameras.

---

## Migration Checklist (New Server Setup)

- [ ] Provision server (Ubuntu 22.04)
- [ ] Copy `/etc/livekit/config.yaml` with updated limits (max_participants: 320, num_tracks: 4000, bytes_per_sec: 2684354560)
- [ ] Copy `/usr/local/bin/livekit-start.sh` wrapper script
- [ ] Copy `/etc/systemd/system/livekit.service` (Type=forking, PIDFile=/run/livekit.pid)
- [ ] Install LiveKit binary: `curl -sSL https://get.livekit.io | bash`
- [ ] Install Redis: `apt install redis-server`
- [ ] Enable and start: `systemctl enable livekit && systemctl start livekit`
- [ ] Update portal `.env` on `stibe-portal`: `LIVEKIT_URL=http://<new-ip>:7880` and `NEXT_PUBLIC_LIVEKIT_URL=wss://media.stibelearning.online`
- [ ] Update DNS: `media.stibelearning.online` → new IP
- [ ] Deploy code changes (raise `maxParticipants` caps above)
- [ ] Run a 50-student test session to verify
- [ ] Decommission old server (`76.13.244.54`)

---

*Last updated: May 7, 2026*  
*Calculated for: OVH ADVANCE-2, Mumbai — 2 Gbps / 25 TB cap*
