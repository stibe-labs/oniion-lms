# stibe — 400 Concurrent Students: Room Combination Guide

**Server**: OVH ADVANCE-2 | AMD EPYC 4344P (8 cores / 16 threads) | 64 GB DDR5 | 2 Gbps port | 25 TB/month cap
**Location**: Mumbai, India
**Prepared**: May 2026

This document answers: **"With 400 students online at the same time, what room combinations can the server handle — and what resources do they consume?"**

---

## Resource Quick Reference

### Server Available Headroom

| Resource | Total | OS Reserved | **Available** |
|---|---|---|---|
| RAM | 64 GB | 4 GB | **60 GB** |
| CPU | 16 threads | 2 threads | **14 threads** |
| Port speed | 2,000 Mbps | — | **2,000 Mbps** |
| Monthly data | 25 TB | — | **25 TB** |

### RAM Per Participant (measured from live server data)

| Participant | RAM |
|---|---|
| Teacher — cam + mic + screen share | **75 MB** |
| Student — camera + mic ON | **75 MB** |
| Student — camera OFF, mic ON | **40 MB** |
| Student — view only (lecture mode) | **20 MB** |

### Net Bandwidth Per Student (SFU outbound)

| Student Mode | SFU Net Outbound | Explanation |
|---|---|---|
| Camera + mic ON | **1,450 kbps** | 1,200 to student + 250 to teacher |
| Camera OFF, mic ON | **1,250 kbps** | 1,200 to student + 50 to teacher |
| View only (lecture) | **1,200 kbps** | 1,200 to student, nothing to teacher |

> Teacher always uploads cam (400 kbps) + mic (50 kbps) + screen share (1,500 kbps) = **1,950 kbps**.
> SFU downscales and forwards this as **1,200 kbps per student** (simulcast layer selection).

**Monthly data formula**: `Outbound_Mbps × 0.027 = TB/month` *(30 days × 2 h/day)*

---

## Section A — Full Camera ON (Batch Classes Only)

All students have **camera + mic on**. Teacher has cam + mic + screen share on (laptop or Flutter tablet).

| Batch Type | Rooms | Students | Teachers | Total Participants | RAM Used | RAM % | Port | Monthly Data | Status |
|---|:---:|:---:|:---:|:---:|---:|:---:|---:|---:|:---:|
| **1 : 1** private | 400 | 400 | 400 | 800 | **60.0 GB** | 100% | 580 Mbps | 15.7 TB | ⚠️ RAM at limit |
| **1 : 3** small group | 133 | 399 | 133 | 532 | **39.9 GB** | 67% | 579 Mbps | 15.6 TB | ✅ |
| **1 : 15** standard class | 27 | 405 | 27 | 432 | **32.4 GB** | 54% | 587 Mbps | 15.8 TB | ✅ |
| **1 : 30** large class | 13 | 390 | 13 | 403 | **30.2 GB** | 50% | 566 Mbps | 15.3 TB | ✅ |

**Bandwidth insight**: Regardless of room size, 400 students with all cameras on always uses ~**580 Mbps** (29% of 2 Gbps port). Bandwidth is never the bottleneck — **RAM is the key differentiator**.

**RAM insight**: 1:1 rooms use **2× more RAM** than 1:30 rooms for the same student count — because each 1:1 room needs a dedicated teacher process (75 MB), whereas a 1:30 room shares one teacher across 30 students.

---

## Section B — Camera OFF (Open Classroom / 1:Many)

Students join with **camera off** (mic available on hand raise). Teacher has cam + mic + screen share on.
This is the **default configuration** deployed on stibe for Open Classroom and 1:Many batch types.

| Configuration | Rooms | Students | RAM Used | RAM % | Port | Monthly Data | Status |
|---|:---:|:---:|---:|:---:|---:|---:|:---:|
| 1 room × 400 students | 1 | 400 | **16.1 GB** | 27% | 500 Mbps | 13.5 TB | ✅ |
| 2 rooms × 200 students | 2 | 400 | **16.2 GB** | 27% | 500 Mbps | 13.5 TB | ✅ |
| 4 rooms × 100 students | 4 | 400 | **16.3 GB** | 27% | 500 Mbps | 13.5 TB | ✅ |
| 8 rooms × 50 students | 8 | 400 | **16.6 GB** | 28% | 500 Mbps | 13.5 TB | ✅ |

> Turning cameras off reduces RAM by **73%** — from 60 GB (cam on) to 16 GB (cam off) for 400 students.
> Port usage drops 14% (580 → 500 Mbps). The teacher's stream still goes to every student.

---

## Section C — View Only / Lecture / Exam Mode

Students **cannot publish anything** (canPublish: false). Pure receive. Teacher only streams.

| Configuration | Rooms | Students | RAM Used | RAM % | Port | Monthly Data | Status |
|---|:---:|:---:|---:|:---:|---:|---:|:---:|
| 1 room × 400 students | 1 | 400 | **8.1 GB** | 13% | 480 Mbps | 13.0 TB | ✅ |
| 2 rooms × 200 students | 2 | 400 | **8.2 GB** | 14% | 480 Mbps | 13.0 TB | ✅ |
| 4 rooms × 100 students | 4 | 400 | **8.3 GB** | 14% | 480 Mbps | 13.0 TB | ✅ |

> Most efficient mode — 400 students consume only **8 GB RAM** and **480 Mbps**.
> Ideal for competitive exams, live tests, one-way webinars.

---

## Section D — Mixed Combinations (400 Students Total)

### Mix 1 — Premium Tutoring Day
*1:1 private sessions + 1:3 small groups running simultaneously*

| Segment | Rooms | Students | Mode |
|---|:---:|:---:|---|
| 1:1 private tutoring | 100 | 100 | Cam + mic ON |
| 1:3 small groups | 100 | 300 | Cam + mic ON |
| **Total** | **200** | **400** | |

| RAM | Port | Monthly Data | Status |
|---|---|---|---|
| 45.0 GB (75%) | 580 Mbps | 15.7 TB | ✅ |

---

### Mix 2 — Mixed Class Day *(Most Common Use Case)*
*Standard batch classes + open classroom for overflow or different subjects*

| Segment | Rooms | Students | Mode |
|---|:---:|:---:|---|
| 1:15 batch class | 13 | 195 | Cam + mic ON |
| Open classroom | 1 | 205 | Cam OFF, mic on raise |
| **Total** | **14** | **400** | |

| RAM | Port | Monthly Data | Status |
|---|---|---|---|
| 23.9 GB (40%) | 539 Mbps | 14.6 TB | ✅ Best balance |

---

### Mix 3 — Large Class + Open Classroom
*Large batch rooms + open classroom for supplementary sessions*

| Segment | Rooms | Students | Mode |
|---|:---:|:---:|---|
| 1:30 large batch | 6 | 180 | Cam + mic ON |
| Open classroom | 1 | 220 | Cam OFF, mic on raise |
| **Total** | **7** | **400** | |

| RAM | Port | Monthly Data | Status |
|---|---|---|---|
| 22.8 GB (38%) | 536 Mbps | 14.5 TB | ✅ |

---

### Mix 4 — All-in-One School Day
*Premium 1:1 + standard batch + large open classroom*

| Segment | Rooms | Students | Mode |
|---|:---:|:---:|---|
| 1:1 premium | 50 | 50 | Cam + mic ON |
| 1:15 standard batch | 10 | 150 | Cam + mic ON |
| Open classroom | 2 | 200 | Cam OFF, mic on raise |
| **Total** | **62** | **400** | |

| RAM | Port | Monthly Data | Status |
|---|---|---|---|
| 27.7 GB (46%) | 540 Mbps | 14.6 TB | ✅ |

---

### Mix 5 — Exam Day
*Some classes running normally + live exam in lecture mode for remaining students*

| Segment | Rooms | Students | Mode |
|---|:---:|:---:|---|
| 1:15 batch (normal) | 10 | 150 | Cam + mic ON |
| Lecture exam | 2 | 250 | View only |
| **Total** | **12** | **400** | |

| RAM | Port | Monthly Data | Status |
|---|---|---|---|
| 17.2 GB (29%) | 517 Mbps | 14.0 TB | ✅ Very efficient |

---

### Mix 6 — Maximum Variety (All Room Types Simultaneously)
*Every batch type + open classroom running at the same time*

| Segment | Rooms | Students | Mode |
|---|:---:|:---:|---|
| 1:1 private | 30 | 30 | Cam + mic ON |
| 1:3 small group | 20 | 60 | Cam + mic ON |
| 1:15 standard | 5 | 75 | Cam + mic ON |
| 1:30 large | 3 | 90 | Cam + mic ON |
| Open classroom | 1 | 145 | Cam OFF |
| **Total** | **59** | **400** | |

| RAM | Port | Monthly Data | Status |
|---|---|---|---|
| 29.4 GB (49%) | 551 Mbps | 14.9 TB | ✅ |

---

## Section E — All 6 Batch Types Running Simultaneously

Every combination below runs **all six types at once**: 1:1 · 1:3 · 1:15 · 1:30 · Open Class (cam off) · Lecture (view only).

> **RAM formula**: (teachers + cam-on students) × 75 MB + cam-off students × 40 MB + view-only students × 20 MB
> **Port formula**: all students × 1,200 kbps + cam-on students × 250 kbps + cam-off students × 50 kbps

---

### E1 — Balanced (equal weight across all types)

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 20 | 20 | 20 | Cam + mic ON |
| 1:3 | 10 | 30 | 10 | Cam + mic ON |
| 1:15 | 5 | 75 | 5 | Cam + mic ON |
| 1:30 | 2 | 60 | 2 | Cam + mic ON |
| Open class | 1 | 100 | 1 | Cam OFF |
| Lecture | 1 | 115 | 1 | View only |
| **Total** | **39 rooms** | **400** | **39** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 23.1 GB | 39% | 531 Mbps | 14.3 TB | ✅ |

---

### E2 — Premium Heavy (more 1:1 and 1:3)

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 50 | 50 | 50 | Cam + mic ON |
| 1:3 | 30 | 90 | 30 | Cam + mic ON |
| 1:15 | 4 | 60 | 4 | Cam + mic ON |
| 1:30 | 2 | 60 | 2 | Cam + mic ON |
| Open class | 1 | 80 | 1 | Cam OFF |
| Lecture | 1 | 60 | 1 | View only |
| **Total** | **88 rooms** | **400** | **88** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 30.5 GB | 51% | 549 Mbps | 14.8 TB | ✅ |

---

### E3 — Mass Education (more open class)

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 10 | 10 | 10 | Cam + mic ON |
| 1:3 | 5 | 15 | 5 | Cam + mic ON |
| 1:15 | 2 | 30 | 2 | Cam + mic ON |
| 1:30 | 2 | 60 | 2 | Cam + mic ON |
| Open class | 2 | 200 | 2 | Cam OFF |
| Lecture | 1 | 85 | 1 | View only |
| **Total** | **22 rooms** | **400** | **22** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 20.0 GB | 33% | 519 Mbps | 14.0 TB | ✅ |

---

### E4 — Small Classes Dominant (most rooms)

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 100 | 100 | 100 | Cam + mic ON |
| 1:3 | 50 | 150 | 50 | Cam + mic ON |
| 1:15 | 2 | 30 | 2 | Cam + mic ON |
| 1:30 | 1 | 30 | 1 | Cam + mic ON |
| Open class | 1 | 60 | 1 | Cam OFF |
| Lecture | 1 | 30 | 1 | View only |
| **Total** | **155 rooms** | **400** | **155** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 37.9 GB | 63% | 561 Mbps | 15.1 TB | ✅ |

> Most rooms — RAM cost is dominated by 155 teacher processes. Still safely within limits.

---

### E5 — Exam Day (lecture heavy)

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 5 | 5 | 5 | Cam + mic ON |
| 1:3 | 5 | 15 | 5 | Cam + mic ON |
| 1:15 | 2 | 30 | 2 | Cam + mic ON |
| 1:30 | 2 | 60 | 2 | Cam + mic ON |
| Open class | 1 | 40 | 1 | Cam OFF |
| Lecture / exam | 3 | 250 | 3 | View only |
| **Total** | **18 rooms** | **400** | **18** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 16.2 GB | 27% | 510 Mbps | 13.8 TB | ✅ Most efficient |

> Shifting students to exam/lecture mode is the most RAM-efficient configuration.

---

### E6 — Typical Tuition Centre

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 30 | 30 | 30 | Cam + mic ON |
| 1:3 | 20 | 60 | 20 | Cam + mic ON |
| 1:15 | 7 | 105 | 7 | Cam + mic ON |
| 1:30 | 2 | 60 | 2 | Cam + mic ON |
| Open class | 1 | 80 | 1 | Cam OFF |
| Lecture | 1 | 65 | 1 | View only |
| **Total** | **61 rooms** | **400** | **61** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 28.2 GB | 47% | 548 Mbps | 14.8 TB | ✅ |

---

### E7 — Large Class Dominant (fewest rooms)

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 5 | 5 | 5 | Cam + mic ON |
| 1:3 | 5 | 15 | 5 | Cam + mic ON |
| 1:15 | 5 | 75 | 5 | Cam + mic ON |
| 1:30 | 5 | 150 | 5 | Cam + mic ON |
| Open class | 1 | 100 | 1 | Cam OFF |
| Lecture | 1 | 55 | 1 | View only |
| **Total** | **22 rooms** | **400** | **22** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 25.1 GB | 42% | 546 Mbps | 14.7 TB | ✅ |

> Fewest rooms, lowest RAM overhead from teachers. Efficient for schools with few subjects.

---

### E8 — Open Classroom Heavy

| Type | Rooms | Students | Teachers | Student Mode |
|---|:---:|:---:|:---:|---|
| 1:1 | 10 | 10 | 10 | Cam + mic ON |
| 1:3 | 10 | 30 | 10 | Cam + mic ON |
| 1:15 | 2 | 30 | 2 | Cam + mic ON |
| 1:30 | 1 | 30 | 1 | Cam + mic ON |
| Open class | 2 | 240 | 2 | Cam OFF |
| Lecture | 1 | 60 | 1 | View only |
| **Total** | **26 rooms** | **400** | **26** | |

| RAM | RAM % | Port | Monthly Data | Status |
|---:|:---:|---:|---:|:---:|
| 20.3 GB | 34% | 517 Mbps | 14.0 TB | ✅ |

---

## Master Summary Table

All combinations for exactly 400 concurrent students:

| # | Combination | Rooms | RAM Used | RAM % | Port | Monthly Data | Verdict |
|---|---|:---:|---:|:---:|---:|---:|:---:|
| A1 | All 1:1 (cam on) | 400 | 60.0 GB | 100% | 580 Mbps | 15.7 TB | ⚠️ RAM at limit |
| A2 | All 1:3 (cam on) | 133 | 39.9 GB | 67% | 579 Mbps | 15.6 TB | ✅ |
| A3 | All 1:15 (cam on) | 27 | 32.4 GB | 54% | 587 Mbps | 15.8 TB | ✅ Recommended |
| A4 | All 1:30 (cam on) | 13 | 30.2 GB | 50% | 566 Mbps | 15.3 TB | ✅ Efficient |
| B1 | All open class (cam off) | 1–8 | 16.1 GB | 27% | 500 Mbps | 13.5 TB | ✅ Very light |
| C1 | All lecture (view only) | 1–4 | 8.1 GB | 13% | 480 Mbps | 13.0 TB | ✅ Lightest |
| D1 | 1:1 + 1:3 | 233 | 45.0 GB | 75% | 580 Mbps | 15.7 TB | ✅ |
| D2 | 1:15 + open class | 14 | 23.9 GB | 40% | 539 Mbps | 14.6 TB | ✅ **Best balance** |
| D3 | 1:30 + open class | 7 | 22.8 GB | 38% | 536 Mbps | 14.5 TB | ✅ |
| D4 | 1:1 + 1:15 + open class | 62 | 27.7 GB | 46% | 540 Mbps | 14.6 TB | ✅ |
| D5 | 1:15 + lecture exam | 12 | 17.2 GB | 29% | 517 Mbps | 14.0 TB | ✅ Exam day |
| D6 | All types + open class | 59 | 29.4 GB | 49% | 551 Mbps | 14.9 TB | ✅ |
| **E1** | **All 6 types — Balanced** | **39** | **23.1 GB** | **39%** | **531 Mbps** | **14.3 TB** | **✅** |
| **E2** | **All 6 types — Premium heavy** | **88** | **30.5 GB** | **51%** | **549 Mbps** | **14.8 TB** | **✅** |
| **E3** | **All 6 types — Mass education** | **22** | **20.0 GB** | **33%** | **519 Mbps** | **14.0 TB** | **✅** |
| **E4** | **All 6 types — Small classes** | **155** | **37.9 GB** | **63%** | **561 Mbps** | **15.1 TB** | **✅** |
| **E5** | **All 6 types — Exam day** | **18** | **16.2 GB** | **27%** | **510 Mbps** | **13.8 TB** | **✅ Most efficient** |
| **E6** | **All 6 types — Tuition centre** | **61** | **28.2 GB** | **47%** | **548 Mbps** | **14.8 TB** | **✅** |
| **E7** | **All 6 types — Large dominant** | **22** | **25.1 GB** | **42%** | **546 Mbps** | **14.7 TB** | **✅** |
| **E8** | **All 6 types — Open class heavy** | **26** | **20.3 GB** | **34%** | **517 Mbps** | **14.0 TB** | **✅** |

**Port is always under 30% of the 2 Gbps capacity across every combination. Monthly data stays 13–16 TB (52–63% of the 25 TB cap).**

---

## Visual Comparison: RAM Usage by Mode

```
400 Students — RAM Consumed (all 6 types simultaneously shown in bold)

All 1:1 (cam on)         ████████████████████  60.0 GB  ⚠️ limit
All 1:3 (cam on)         █████████████░░░░░░░  39.9 GB
E4 — small classes dom.  ████████████░░░░░░░░  37.9 GB  (all 6 types)
All 1:15 (cam on)        ██████████░░░░░░░░░░  32.4 GB
E2 — premium heavy       ██████████░░░░░░░░░░  30.5 GB  (all 6 types)
All 1:30 (cam on)        █████████░░░░░░░░░░░  30.2 GB
E6 — tuition centre      █████████░░░░░░░░░░░  28.2 GB  (all 6 types)
E7 — large dominant      ████████░░░░░░░░░░░░  25.1 GB  (all 6 types)
1:15 + open class        ███████░░░░░░░░░░░░░  23.9 GB
E1 — balanced all 6      ███████░░░░░░░░░░░░░  23.1 GB  (all 6 types) ← Recommended
E8 — open class heavy    ██████░░░░░░░░░░░░░░  20.3 GB  (all 6 types)
E3 — mass education      ██████░░░░░░░░░░░░░░  20.0 GB  (all 6 types)
All open (cam off)       █████░░░░░░░░░░░░░░░  16.1 GB
E5 — exam day            █████░░░░░░░░░░░░░░░  16.2 GB  (all 6 types) ← Most efficient
All lecture              ██░░░░░░░░░░░░░░░░░░   8.1 GB
                         0                   60 GB
```

---

## Built-In Server Protections (Already Live)

| Protection | What It Does | Impact |
|---|---|---|
| **Student camera OFF by default** | Students join without camera — they must manually enable | Reduces per-student RAM 45% in open classrooms |
| **AI monitoring still works** | Local camera stream used privately, not uploaded to server | No monitoring quality loss |
| **Default 480p quality** | Auto-drops to 144p on poor student network | Reduces downlink bandwidth 60% per affected student |
| **Screen share capped at 720p/15fps** | 1.5 Mbps ceiling (was 2.5 Mbps) | Saves 1 Mbps × number of rooms on teacher upload |
| **Student mic OFF by default** | Mic enables only on hand raise | Reduces background-noise streams |
| **20 TB monthly alert** | OVH control panel alert | 5 TB buffer before cap is reached |

---

## Key Takeaways

1. **400 concurrent students is very safe** — all non-1:1 combinations use ≤ 75% RAM, all use < 30% port
2. **1:1 rooms are expensive** — 150 MB per student-teacher pair; mix with larger rooms to stay comfortable
3. **Open classroom camera-off is 3× more RAM-efficient** than camera-on batch classes
4. **Bandwidth is never the bottleneck** — even at 400 students all-cam-on, port is only 29% utilised
5. **Monthly data for 400 students**: 13–16 TB per month — leaves **9–12 TB of the 25 TB cap unused**
6. **The server can scale beyond 400** — camera-off open classrooms can handle 1,000+ students; lecture mode can handle 1,500+

---

*Server: OVH ADVANCE-2 | Mumbai, India*
*Prepared: May 2026 | Based on live measured data from stibe production | Assumes 30 days × 2 h/day*
