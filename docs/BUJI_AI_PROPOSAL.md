
<h1 align="center">BUJI — Personal AI Trainer</h1>
<h3 align="center">Project Proposal & Development Blueprint</h3>
<p align="center"><strong>stibe Learning Ventures Pvt. Ltd.</strong></p>
<p align="center">Prepared by: Pydart Intelli Corp &nbsp;|&nbsp; Date: April 2026 &nbsp;|&nbsp; Version 1.0</p>

---

## Executive Summary

**Buji** is a first-of-its-kind Personal AI Trainer purpose-built for stibe Learning's online tutoring ecosystem. Unlike generic chatbots, Buji is a deeply integrated, continuously learning AI companion that knows every student personally — their academic history, classroom behavior, exam performance, attention patterns, strengths, weaknesses, and learning style.

Buji transforms stibe from a tutoring platform into an **intelligent learning partner** — available 24/7, infinitely patient, and increasingly personalized with every interaction.

**Timeline**: 2 months (4 phases)
**Current Status**: Working prototype deployed (basic chat, exam data, memory persistence)



## Table of Contents

1. [The Vision](#1-the-vision)
2. [Current State (Prototype)](#2-current-state-prototype)
3. [Complete Feature Specification](#3-complete-feature-specification)
4. [Technical Architecture](#4-technical-architecture)
5. [AI Training & Data Pipeline](#5-ai-training--data-pipeline)
6. [Role-Wise Buji Capabilities](#6-role-wise-buji-capabilities)
7. [Development Phases & Timeline](#7-development-phases--timeline)
9. [Success Metrics & KPIs](#9-success-metrics--kpis)
10. [Risk Mitigation](#10-risk-mitigation)
11. [Terms & Acceptance](#11-terms--acceptance)



## 1. The Vision

> *"Every student at stibe will have their own AI trainer who knows them better than any tutor ever could — one that never sleeps, never forgets, and gets smarter every day."*

### What Makes Buji Different

| Generic AI Chatbot | Buji — Personal AI Trainer |
|---|---|
| Generic answers from public data | Answers grounded in the student's **actual** data |
| No memory between sessions | **Persistent memory** — remembers goals, struggles, preferences |
| Cannot teach or explain | **Step-by-step academic coaching** with curriculum alignment |
| Text-only interaction | **Voice, image, document** — multimodal interaction |
| Same experience for everyone | **Hyper-personalized** — adapts to each student's learning style |
| No integration with platform | **Deep integration** — classroom, exams, attendance, fees, everything |
| Static capability | **Continuously learning** — improves with every conversation and data point |

### Core Philosophy

1. **Data-Driven Personalization** — Every response is informed by real academic data
2. **Curriculum-First Intelligence** — Aligned to CBSE, ICSE, ISC, and State Boards
3. **Proactive, Not Reactive** — Buji reaches out, not just responds
4. **Multi-Stakeholder Value** — Serves students, parents, teachers, and administrators
5. **Privacy by Design** — Each user sees only their own data, fully compliant with data protection norms



## 2. Current State (Prototype)

The working prototype validates Buji's core architecture. Currently deployed at `stibelearning.online`:

### What's Built

| Feature | Status |
|---|---|
| Chat interface (text + file upload) | Live |
| Server-side comprehensive data fetching (16 data sections) | Live |
| Persistent memory across sessions | Live |
| Full exam question-level data (Q&A, options, correct answers) | Live |
| Per-session AI monitoring breakdown | Live |
| Attendance, fees, credits data awareness | Live |
| Image analysis (vision model) | Live |
| PDF document analysis | Live |
| Parent dashboard integration | Live |
| Fault-tolerant data pipeline (section isolation) | Live |
| Auto memory extraction (goals, weak subjects, study habits) | Live |

### What's Planned (This Proposal)

The complete Buji system expands from this foundation into a full-spectrum AI trainer with 40+ features across 8 capability domains.



## 3. Complete Feature Specification

### 3.1 Academic Coaching Engine

The heart of Buji — a teaching AI that explains, not just answers.

| # | Feature | Description |
|---|---|---|
| 1 | **Step-by-Step Problem Solving** | When a student gets a question wrong, Buji explains *why* the correct answer is right and *why* their answer was wrong — with mathematical/scientific reasoning |
| 2 | **Doubt Resolution** | Students can type or photograph any question from textbook/homework. Buji solves it with full working, aligned to their board & curriculum |
| 3 | **Concept Explanation** | Ask "What is an equivalence relation?" and Buji explains at the student's level, referencing topics from their actual classes |
| 4 | **Multi-Step Solution Builder** | For complex problems (integration, chemical equations, derivations), Buji builds solutions step-by-step with option to expand each step |
| 5 | **Practice Question Generator** | "Give me 5 more questions like Q2 from my last exam" — Buji generates similar-difficulty questions on weak topics |
| 6 | **Topic Deep Dive** | Student selects any topic from their curriculum → Buji generates a structured mini-lesson with examples, practice problems, and a quick quiz |
| 7 | **Formula & Theorem Reference** | Instant recall of relevant formulas, theorems, and derivations — curriculum-aligned (CBSE/ICSE/State) |
| 8 | **Exam Preparation Coach** | Before exams: Buji creates a personalized study plan based on weak areas, time available, and exam syllabus |
| 9 | **Handwriting & Image Analysis** | Photograph handwritten work → Buji reads it, checks for errors, suggests corrections |
| 10 | **Multi-Subject Expertise** | Mathematics, Physics, Chemistry, Biology, English, Hindi, Social Science — board-specific content |

### 3.2 Performance Analytics & Insights

Buji as the student's personal data analyst.

| # | Feature | Description |
|---|---|---|
| 11 | **Exam Score Analysis** | Detailed breakdown of every exam — per-question analysis, topic-wise accuracy, time management insights |
| 12 | **Strength & Weakness Mapping** | Continuously updated profile: "You're strong in Relations & Functions but weak in Equivalence Classes" |
| 13 | **Trend Detection** | "Your Math scores improved 15% over the last 3 exams" or "Your attention scores are declining in Chemistry" |
| 14 | **Comparative Insight** | Performance relative to batch averages (anonymized) — "You scored above 80% of your class in this exam" |
| 15 | **Attention & Behavior Reports** | Natural language summary of AI monitoring data — "You were distracted 4 times in Tuesday's Math class, mainly in the last 20 minutes" |
| 16 | **Weekly Performance Digest** | Auto-generated weekly summary: attendance, exams, attention, homework status — delivered proactively |
| 17 | **Parent-Friendly Reports** | Simplified insights for parents: "Tishnu attended 4/5 classes this week. Math exam score improved." |

### 3.3 Study Planning & Scheduling

Buji as the student's personal academic planner.

| # | Feature | Description |
|---|---|---|
| 18 | **Smart Study Planner** | Input: available hours, exam dates, weak subjects → Output: day-by-day personalized study schedule |
| 19 | **Revision Reminders** | Spaced repetition engine — "It's been 5 days since you studied Organic Chemistry. Time for revision!" |
| 20 | **Homework Tracker** | "You have 2 pending homework assignments. Chemistry is due tomorrow." |
| 21 | **Session Preparation Tips** | Before each class: "Today's Math class covers Integration by Parts. Here's a quick refresher on substitution..." |
| 22 | **Goal Setting & Tracking** | "I want to score 90% in Physics" → Buji creates milestones, tracks progress, adjusts plan |

### 3.4 Multimodal Interaction

Beyond text — natural, accessible communication.

| # | Feature | Description |
|---|---|---|
| 23 | **Voice Input (Speech-to-Text)** | Students can speak their questions — especially useful for younger students or during study sessions |
| 24 | **Voice Response (Text-to-Speech)** | Buji reads answers aloud — helpful for revision while commuting or before sleep |
| 25 | **Image-Based Q&A** | Photograph textbook pages, whiteboard notes, or handwritten problems → Buji analyzes and responds |
| 26 | **PDF Analysis** | Upload previous year papers, study material, or notes → Buji summarizes, creates flashcards, or generates practice tests |
| 27 | **Multi-Language Support** | Primary: English & Hindi. Buji detects language automatically and responds in the same language |
| 28 | **LaTeX Math Rendering** | Mathematical expressions rendered beautifully — fractions, integrals, matrices displayed correctly |

### 3.5 Proactive Intelligence

Buji doesn't wait to be asked — it reaches out.

| # | Feature | Description |
|---|---|---|
| 29 | **Class Reminders** | "Your Chemistry class starts in 30 minutes. Don't forget to join!" (push notification + chat message) |
| 30 | **Low Attendance Alerts** | "You've missed 3 Chemistry classes this month. Your attendance is at 60%. Let's fix this!" |
| 31 | **Fee Reminders** | "You have 2 overdue invoices. Would you like me to guide you to the payment page?" |
| 32 | **Credit Warnings** | "You have only 6 Math credits remaining out of 50. Ask your parents to renew." |
| 33 | **Post-Exam Follow-up** | After every exam: "You scored 40% on your Math exam. Want me to go through the questions you got wrong?" |
| 34 | **Motivational Nudges** | "You've improved 12% in Chemistry this month! Keep going, Tishnu!" |
| 35 | **Inactivity Check-In** | If a student hasn't chatted in 5+ days: "Hey Tishnu, haven't heard from you! How are your studies going?" |

### 3.6 Classroom Integration

Buji connected to the live classroom experience.

| # | Feature | Description |
|---|---|---|
| 36 | **Post-Class Summary** | After each live class: Buji generates a summary of topics covered, key formulas, and homework assigned |
| 37 | **In-Class Quick Reference** | During live sessions, students can ask Buji quick questions without leaving the classroom |
| 38 | **Recording Notes** | When class recordings are available: Buji generates topic-wise timestamps and key takeaways |
| 39 | **Teacher Feedback Relay** | If teachers leave comments on homework or exams, Buji notifies and explains the feedback |

### 3.7 Parent Experience

Different Buji for parents — focused on monitoring and communication.

| # | Feature | Description |
|---|---|---|
| 40 | **Child Progress Dashboard** | "How is my child doing?" → Comprehensive updates across all subjects, attendance, behavior |
| 41 | **Attendance Alerts** | Instant notification when child misses a class or joins late |
| 42 | **Exam Results Notification** | "Your child scored 85% in today's Mathematics exam" — with detailed breakdown |
| 43 | **Fee Management** | "What fees are pending?" → Exact amounts, due dates, payment links |
| 44 | **Teacher Communication** | "Can you tell the Math teacher my child will miss class tomorrow?" → Routes to appropriate channel |
| 45 | **Weekly Parent Report** | Auto-generated digestible report: attendance, exam scores, behavior, teacher comments |

### 3.8 Learning & Memory System

Buji's persistent intelligence layer.

| # | Feature | Description |
|---|---|---|
| 46 | **Conversation Memory** | Remembers what was discussed — "Last time you asked about Integration. Want to continue?" |
| 47 | **Student Profile Learning** | Learns study habits, preferred explanation styles, weak topics, goals — builds over time |
| 48 | **Adaptive Difficulty** | Adjusts explanation complexity based on the student's demonstrated understanding level |
| 49 | **Knowledge Graph** | Internal map of what each student knows and doesn't know — used to personalize every response |
| 50 | **Feedback Loop** | "Was this explanation helpful?" → Student feedback fine-tunes Buji's approach for that student |



## 4. Technical Architecture

### 4.1 Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| **LLM Core** | Groq Cloud API (Llama 3.3 70B) | Text reasoning, academic coaching, analysis |
| **Vision AI** | Groq Cloud API (Llama 3.2 11B Vision) | Image analysis, handwriting recognition |
| **Speech-to-Text** | Web Speech API / Whisper | Voice input processing |
| **Text-to-Speech** | Web Speech API / ElevenLabs | Voice response generation |
| **Database** | PostgreSQL 15 | Student data, exam records, memory storage |
| **Cache** | Redis | Response caching, rate limiting, hot memory |
| **Framework** | Next.js 16 (App Router) | API routes, SSR, real-time UI |
| **Frontend** | React + Tailwind + shadcn/ui | Chat interface, quick actions |
| **Notifications** | BullMQ + SMTP + WhatsApp API | Proactive alerts and digests |
| **Math Rendering** | KaTeX | LaTeX equation display in chat |
| **Curriculum Data** | Custom DB (CBSE/ICSE/State) | Board-aligned content generation |



## 5. AI Training & Data Pipeline

### 5.1 How Buji Learns

Buji uses a **three-layer learning system**:

```
Layer 1: REAL-TIME CONTEXT (per-request)
├── 16 data sections fetched live from PostgreSQL
├── Full exam Q&A, attendance, monitoring, fees
├── Always current — no stale data
└── ~8,000-20,000 chars of structured context

Layer 2: PERSISTENT MEMORY (per-student)
├── Extracted insights from every conversation
├── Goals, weak subjects, study habits, preferences
├── Learning style, emotional state, family context
├── Grows over time — Buji gets smarter per student
└── Stored in chatbot_memory table

Layer 3: CURRICULUM KNOWLEDGE (global)
├── CBSE, ICSE, ISC, State Board syllabi
├── Subject-wise topic trees with prerequisites
├── Formula banks, theorem databases
├── Previous year question patterns
└── Updated annually for syllabus changes
```

### 5.2 Continuous Training Cycle

```
 ┌─────────────────────────────────────────────────┐
 │              CONTINUOUS LEARNING LOOP           │
 │                                                 │
 │  Student Interacts ──► Data Captured            │
 │         │                    │                  │
 │         ▼                    ▼                  │
 │  Memory Extracted     Feedback Logged           │
 │         │                    │                  │
 │         ▼                    ▼                  │
 │  Profile Updated      Response Quality Tracked  │
 │         │                    │                  │
 │         ▼                    ▼                  │
 │  Next Response ◄── Personalization Applied      │
 │                                                 │
 └─────────────────────────────────────────────────┘
```

### 5.3 Data Sources for Buji Intelligence

| Data Source | Volume | Updates |
|---|---|---|
| Student profiles | 1 per student | On profile change |
| Exam results + full Q&A | 20+ per student | After each exam |
| AI monitoring events | 50+ events per session | Real-time during class |
| Attendance records | 1 per session per student | After each session |
| Homework submissions | Varies | On submission |
| Fee & payment records | Monthly | On payment |
| Session credits | Per enrollment | On usage |
| Conversation history | 10 recent turns | Per chat |
| Persistent memory | 30+ entries per student | Per conversation |
| Curriculum data | CBSE/ICSE/State | Annual update |



## 6. Role-Wise Buji Capabilities

### For Students

| Capability | Example Interaction |
|---|---|
| Doubt solving | *"Explain the difference between permutation and combination with examples"* |
| Exam review | *"Go through my wrong answers from today's exam and teach me"* |
| Study planning | *"Create a study plan for my Physics exam next Monday"* |
| Performance check | *"How am I doing in Chemistry compared to last month?"* |
| Homework help | *"Help me solve this integration problem" (uploads photo)* |
| Quick reference | *"What's the formula for centripetal acceleration?"* |
| Practice questions | *"Give me 5 tough questions on electromagnetic induction"* |
| Motivation | *"I'm feeling stressed about exams"* |
| Platform queries | *"When is my next Math class?"* |
| Fee queries | *"How many credits do I have left?"* |

### For Parents

| Capability | Example Interaction |
|---|---|
| Daily check-in | *"How was my child's day at stibe?"* |
| Attendance query | *"Has Tishnu been attending all classes?"* |
| Exam results | *"How did my child do in today's exam?"* |
| Behavior report | *"Is my child paying attention in class?"* |
| Fee check | *"What fees are pending?"* |
| Weekly summary | *"Give me this week's report"* |
| Teacher interaction | *"Who is teaching Mathematics to my child?"* |
| Credits | *"How many session credits are remaining?"* |

### For Teachers (Future Phase)

| Capability | Example Interaction |
|---|---|
| Class insights | *"How is my Batch A performing overall?"* |
| Student flags | *"Which students need attention in Math?"* |
| Exam analytics | *"What topics were students weakest in?"* |
| Attendance trends | *"Show me attendance trends for this month"* |

### For Batch Coordinators (Future Phase)

| Capability | Example Interaction |
|---|---|
| Batch overview | *"Give me today's session status"* |
| Student alerts | *"Which students have declining performance?"* |
| Session summary | *"Summarize today's monitoring alerts"* |



## 7. Development Phases & Timeline

### Phase 1: Foundation (Month 1, Week 1–2) — *Elevate the Prototype*

| Task | Details |
|---|---|
| **Academic Coaching Engine** | Step-by-step problem solving, doubt resolution with curriculum alignment |
| **Enhanced Memory System** | Knowledge graph per student, adaptive difficulty, feedback loop |
| **Improved Chat UI** | Quick action buttons, message reactions, copy/share, LaTeX rendering |
| **Intent Classification** | Route queries to specialized handlers (academic, admin, analytics) |
| **Error Recovery** | Graceful handling of all edge cases, fallback responses |
| **Response Quality** | Improve prompts, test across subjects, validate accuracy |

**Deliverable**: Production-ready academic coaching for students

### Phase 2: Intelligence (Month 1, Week 3–4) — *Make Buji Smart*

| Task | Details |
|---|---|
| **Strength/Weakness Engine** | Topic-level mastery tracking from exam + homework data |
| **Trend Analysis** | Week-over-week, subject-wise performance trends |
| **Practice Question Generator** | Generate curriculum-aligned questions targeting weak areas |
| **Study Planner** | Smart scheduling based on exam dates, weak subjects, available time |
| **Revision System** | Spaced repetition reminders based on forgetting curve |
| **Comparative Analytics** | Anonymized batch-level comparisons |

**Deliverable**: Intelligent analytics and personalized study planning

### Phase 3: Multimodal & Proactive (Month 2, Week 1–2) — *Beyond Text*

| Task | Details |
|---|---|
| **Voice Input** | Speech-to-text integration for hands-free interaction |
| **Voice Response** | Text-to-speech for audio explanations |
| **Advanced Image Analysis** | Handwriting recognition, diagram analysis, whiteboard capture |
| **Proactive Notifications** | Class reminders, fee alerts, exam follow-ups, inactivity nudges |
| **Post-Class Summaries** | Auto-generated class summaries with topic timestamps |
| **WhatsApp Integration** | Buji responses mirrored to WhatsApp for parents |

**Deliverable**: Multimodal interaction + proactive engagement system

### Phase 4: Scale & Polish (Month 2, Week 3–4) — *Production Excellence*

| Task | Details |
|---|---|
| **Parent Buji** | Full parent experience — progress reports, alerts, fee management |
| **Response Caching** | Redis cache for frequent queries, reduced API costs |
| **Rate Limiting** | Per-user rate limits to prevent abuse |
| **Analytics Dashboard** | Usage metrics, satisfaction tracking, popular queries |
| **Load Testing** | Performance optimization for 500+ concurrent users |
| **Documentation** | Admin guide, teacher guide, student onboarding materials |
| **UAT & Bug Fixes** | User acceptance testing across all roles and devices |

**Deliverable**: Production-ready, fully-featured Buji AI Trainer



## 8. Competitive Advantage

### 8.1 Market Comparison

| Feature | Byju's AI | Toppr AI | Vedantu AI | **stibe Buji** |
|---|:---:|:---:|:---:|:---:|
| Real student data awareness | No |  | No | Yes |
| Live classroom integration | No |  | Partial | Yes |
| AI monitoring behavior data | No |  | No | Yes |
| Exam Q&A-level coaching | No | Basic | No | Yes |
| Persistent memory | No |  | No | Yes |
| Parent AI assistant | No |  | No | Yes |
| Proactive outreach | No |  | No | Yes |
| Voice interaction | No |  | No | Yes |
| Fee & admin queries | No |  | No | Yes |
| Curriculum-aligned practice | Yes |  | Partial | Yes |

### 8.2 Cost Breakdown

> **Scope & Pricing Note:** This estimate covers development and integration with the stibe online portal only. Integration with any offline ERP system and custom AI model training are **not included** in this scope. As features scale and training data volume grows, costs may increase. All revisions will be agreed upon in advance.

| Category | Amount (₹) | % | Details |
|---|---:|---:|---|
| **AI Development & Engineering** | 2,40,000 | 55.8% | Core AI logic, context pipeline, memory system, intent routing, academic coaching engine, practice generation, analytics |
| **Frontend & UI/UX** | 60,000 | 14.0% | Chat redesign, voice UI, quick actions, LaTeX rendering, mobile optimization, parent interface |
| **Multimodal Integration** | 40,000 | 9.3% | Voice I/O, advanced image processing, handwriting recognition, PDF intelligence |
| **Proactive System** | 30,000 | 7.0% | Notification engine, class reminders, auto-reports, WhatsApp integration, scheduling |
| **Testing & QA** | 25,000 | 5.8% | Academic accuracy validation, load testing, cross-device testing, edge case handling |
| **AI API Costs (6 months)** | 20,000 | 4.7% | Groq Cloud API usage for development and initial production period |
| **Documentation & Training** | 15,000 | 3.5% | Admin docs, user guides, onboarding materials, video walkthroughs |
| **TOTAL** | **4,30,000** | **100%** | |

> **Optional Add-on — 3D Character Development**: A custom animated 3D avatar for Buji (idle, talking, thinking, celebrating states) is available as a separate engagement. Cost quoted on request based on character design complexity and animation requirements. Not included in the ₹4,30,000 estimate above.

#### Recurring Costs (Post-Launch)

| Item | Estimated Monthly Cost |
|---|---|
| Groq API (at scale) | ₹3,000–8,000/month (usage-based) |
| Server resources (incremental) | ₹0 (uses existing stibe servers) |
| Maintenance & updates | Included in platform SLA |

### 8.3 Unique Selling Points

1. **Zero-Setup Personalization**: Buji knows the student from day one — no quizzes or onboarding required
2. **Classroom-Connected**: Only AI that has live classroom behavior data (attention, engagement, tab switches)
3. **Full Academic Lifecycle**: Covers pre-class prep → live class → post-class review → exam prep → results analysis
4. **Parent Partner**: Keeps parents informed without manual teacher effort
5. **Continuous Learning**: Gets smarter with every interaction — not a static chatbot

### 8.4 Investment & Payment

> **Note on Pricing:** The cost of ₹4,30,000 is an **estimated figure** for development and integration with the stibe online portal only. Integration with any offline ERP system and custom AI model training are **not included** in this estimate. As the number of features, students, and training data grows, the actual cost may increase. Any scope changes will be communicated and agreed upon before execution.

| Item | Details |
|---|---|
| **Estimated Total Cost** | ₹4,30,000 (Four Lakhs Thirty Thousand Only) |
| **Timeline** | 2 months from project kickoff |
| **Payment — Advance (50%)** | ₹2,15,000 — on project kickoff |
| **Payment — Mid (30%)** | ₹1,29,000 — on Phase 2 completion |
| **Payment — Final (20%)** | ₹86,000 — on final delivery & UAT sign-off |
| **Warranty** | 30 days post-launch bug fixes included |



## 9. Success Metrics & KPIs

### Engagement Metrics

| Metric | Target (3 months) | Target (6 months) |
|---|---|---|
| Daily active users (students) | 40% of enrolled | 70% of enrolled |
| Avg. messages per student/week | 10+ | 20+ |
| Returning users (weekly) | 60% | 80% |
| Parent adoption rate | 30% | 50% |

### Academic Impact Metrics

| Metric | Target |
|---|---|
| Exam score improvement (Buji users vs non-users) | +15% average |
| Homework completion rate | +25% improvement |
| Attendance improvement for flagged students | +20% |
| Student-reported confidence increase | 70% positive |



## 10. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|---|:---:|:---:|---|
| LLM gives incorrect academic answers | Medium | High | Multi-layer validation: curriculum DB cross-check, confidence scoring, "I'm not sure" fallback, teacher review flagging |
| API cost escalation at scale | Medium | Medium | Response caching, rate limiting, smaller model for simple queries, batch processing |
| Student over-dependence on AI | Low | Medium | Encourage self-solving first, Socratic method (ask questions back), teacher notification for repeated help requests |
| Data privacy concerns | Low | High | Strict role isolation, no cross-student data leakage, DPDPA compliance, audit logging |
| LLM provider downtime | Low | Medium | Fallback to cached responses, queue mechanism, multi-provider support |
| Low adoption by students | Medium | Medium | Gamification (streaks, badges), proactive engagement, teacher endorsement, onboarding nudges |



## 11. Terms & Acceptance

### Delivery Terms

- **Estimated Total Cost**: ₹4,30,000 (Rupees Four Lakhs Thirty Thousand Only)
- **Timeline**: 2 months from project kickoff
- **Payment Schedule**:
  - 50% advance on project kickoff — ₹2,15,000
  - 30% on Phase 2 completion — ₹1,29,000
  - 20% on final delivery & UAT sign-off — ₹86,000
- **Warranty**: 30 days post-launch bug fixes included

> The above cost is an estimate for stibe online portal integration only. Due to the scale of features and the volume of data required, labour and infrastructure costs may increase. Any revisions will be discussed and approved in advance.

### What's Included

- Complete Buji AI system (50 features as specified)
- Student, Parent, and Admin interfaces
- Voice input/output integration
- Proactive notification system
- WhatsApp integration for parents
- Deployment to production servers
- User documentation and training materials

### What's Not Included

- Integration with any offline ERP or third-party school management system
- Custom AI model training or fine-tuning on proprietary datasets
- Hardware or infrastructure procurement
- Features outside the scope defined in Section 3



<p align="center">
<br/>
<strong>Prepared by</strong><br/>
Pydart Intelli Corp<br/>
<em>AI & Full-Stack Engineering</em><br/>
<br/>
<strong>For</strong><br/>
stibe Learning Ventures Pvt. Ltd.<br/>
<br/>
April 2026
</p>
