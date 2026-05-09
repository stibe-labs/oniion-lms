// ═══════════════════════════════════════════════════════════════
// Auto-Schedule from Calendar — POST /api/v1/academic-calendars/schedule
//
// Bulk-creates batch_sessions from an academic calendar template.
// Supports dry_run for preview, conflict detection, and
// teacher assignment from batch_teachers.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { scheduleTimetableUpdate } from '@/lib/timetable-auto';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const user = await verifySession(token);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  let body: ScheduleRequest;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    calendar_id, batch_id, time_slots, teacher_map,
    day_subject_map = {},
    include_special_classes = true,
    include_new_batch = false,
    include_exam_special = false,
    duration_minutes = 90,
    teaching_minutes = 75,
    start_from_date,
    start_date,
    end_date,
    dry_run = false,
  } = body;

  if (!calendar_id || !batch_id || !time_slots || !teacher_map) {
    return NextResponse.json({
      success: false,
      error: 'calendar_id, batch_id, time_slots, and teacher_map are required',
    }, { status: 400 });
  }

  // Validate batch exists
  const batchRes = await db.query('SELECT * FROM batches WHERE batch_id = $1', [batch_id]);
  if (batchRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  }
  const batch = batchRes.rows[0] as Record<string, unknown>;

  // AO access check
  if (user.role === 'academic_operator' && batch.academic_operator_email !== user.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }
  // BC access check
  if (user.role === 'batch_coordinator' && batch.coordinator_email !== user.id) {
    return NextResponse.json({ success: false, error: 'Not your batch' }, { status: 403 });
  }

  // Get calendar + sessions
  const calRes = await db.query('SELECT * FROM academic_calendars WHERE id = $1 AND is_active = TRUE', [calendar_id]);
  if (calRes.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Calendar not found or inactive' }, { status: 404 });
  }
  const calendar = calRes.rows[0] as Record<string, unknown>;

  const sessRes = await db.query(
    `SELECT session_date, day_of_week, subject, topic, session_type, session_order
     FROM academic_calendar_sessions
     WHERE calendar_id = $1
     ORDER BY session_order`,
    [calendar_id]
  );
  const calendarSessions = sessRes.rows as unknown as CalendarSession[];

  // ── Day-of-week helpers ──────────────────────────────────
  // DB stores full names (Monday/Tuesday/...) but time_slots keys use abbreviated names (Mon/Tue/...)
  const DAY_ABBR: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };
  const DOW_INDEX: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };

  // When start_date is provided, pre-compute the first occurrence of each day-of-week
  // on or after start_date. Each pointer advances by 7 days every time a session is assigned.
  // IMPORTANT: use local date parts (not toISOString which is UTC) to avoid off-by-one on IST servers.
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const dayPointers: Record<string, Date> = {};
  if (start_date) {
    const base = new Date(start_date + 'T00:00:00');
    for (const [fullDay, dowIdx] of Object.entries(DOW_INDEX)) {
      const d = new Date(base);
      while (d.getDay() !== dowIdx) d.setDate(d.getDate() + 1);
      dayPointers[fullDay] = d;
    }
  }

  // Filter sessions by type
  const sessionsToCreate: SessionPlan[] = [];
  const conflicts: Conflict[] = [];

  // Only schedule subjects that belong to this batch (ignore calendar subjects outside the batch)
  const batchSubjects: string[] = Array.isArray(batch.subjects) ? (batch.subjects as string[]) : [];

  for (const cs of calendarSessions) {
    // Without start_date: keep original filter by calendar date
    if (!start_date && start_from_date && cs.session_date < start_from_date) continue;

    let include = false;
    if (cs.session_type === 'session') include = true;
    if (cs.session_type === 'special_class' && include_special_classes) include = true;
    if (cs.session_type === 'new_batch' && include_new_batch) include = true;
    if (cs.session_type === 'exam_special' && include_exam_special) include = true;
    if (!include) continue;

    // Skip regular sessions for subjects not in this batch
    if (cs.session_type === 'session' && cs.subject && batchSubjects.length > 0 && !batchSubjects.includes(cs.subject)) continue;

    const fullDay = cs.day_of_week; // e.g. "Monday"
    const dayAbbr = DAY_ABBR[fullDay] ?? fullDay; // e.g. "Mon"
    const time = time_slots[dayAbbr] ?? time_slots[fullDay]; // support both abbreviated and full keys
    if (!time) {
      // No time slot for this day (e.g. Sunday) — record as conflict
      conflicts.push({
        type: 'no_time_slot',
        date: cs.session_date,
        message: `${cs.session_date} (${fullDay}) — ${cs.subject || 'Special Class'}: Skipped — no time slot configured for ${fullDay}`,
      });
      continue;
    }

    // Determine session date
    let sessionDate: string;
    if (start_date) {
      // Remap: assign topics in calendar sequence to real dates starting from start_date
      const ptr = dayPointers[fullDay];
      if (!ptr) {
        conflicts.push({ type: 'no_time_slot', date: cs.session_date, message: `Unknown day: ${fullDay}` });
        continue;
      }
      sessionDate = localDateStr(ptr);
      // Stop if this date is beyond the end_date
      if (end_date && sessionDate > end_date) continue;
      // Advance this day's pointer by one week for the next session on this day
      dayPointers[fullDay] = new Date(ptr.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      sessionDate = cs.session_date;
    }

    let teacherEmail: string | null = null;
    let teacherName: string | null = null;
    // day_subject_map override: use the subject the user assigned to this day
    const dayOverrideSubject = day_subject_map[dayAbbr];
    // Apply override: for special/non-regular sessions use the day-level override if set
    const subject = (cs.session_type !== 'session' && dayOverrideSubject)
      ? dayOverrideSubject
      : (cs.subject || 'Special Class');

    if (cs.session_type === 'session' && cs.subject) {
      teacherEmail = teacher_map[cs.subject] || null;
    } else if (cs.session_type === 'special_class') {
      // Use day-level subject override first, then fallback keys
      teacherEmail = (dayOverrideSubject ? teacher_map[dayOverrideSubject] : null)
        || teacher_map['Special Class'] || teacher_map['Saturday'] || null;
    }

    sessionsToCreate.push({
      date: sessionDate,
      day: dayAbbr,
      time,
      subject,
      topic: cs.topic || null,
      session_type: cs.session_type,
      teacher_email: teacherEmail,
      teacher_name: teacherName,
    });
  }

  // Count per-subject breakdown
  const perSubject: Record<string, number> = {};
  for (const s of sessionsToCreate) {
    perSubject[s.subject] = (perSubject[s.subject] || 0) + 1;
  }

  // Conflict detection: check teacher's existing load per date
  if (!dry_run || true) { // Always check conflicts for preview
    const teacherDates: Record<string, Set<string>> = {};
    for (const s of sessionsToCreate) {
      if (!s.teacher_email) continue;
      const key = `${s.teacher_email}|${s.date}`;
      if (!teacherDates[key]) teacherDates[key] = new Set();
      teacherDates[key].add(s.time);
    }

    // Check each unique teacher+date against existing sessions
    const uniqueTeacherDates = Object.keys(teacherDates);
    for (const key of uniqueTeacherDates) {
      const [email, date] = key.split('|');
      const newCount = teacherDates[key].size;

      const existingRes = await db.query(
        `SELECT COUNT(*) AS cnt FROM batch_sessions
         WHERE teacher_email = $1 AND scheduled_date = $2::date AND status IN ('scheduled', 'live')`,
        [email, date]
      );
      const existingCount = parseInt((existingRes.rows[0] as { cnt: string }).cnt, 10);

      if (existingCount + newCount > 4) {
        conflicts.push({
          type: 'teacher_overload',
          date,
          teacher_email: email,
          message: `Teacher already has ${existingCount} sessions on ${date}, adding ${newCount} would exceed 4/day limit`,
        });
      }
    }

    // Check batch already has sessions on same dates
    const planDates = [...new Set(sessionsToCreate.map(s => s.date))];
    if (planDates.length > 0) {
      const existingBatchRes = await db.query(
        `SELECT scheduled_date, COUNT(*) AS cnt FROM batch_sessions
         WHERE batch_id = $1 AND scheduled_date = ANY($2::date[]) AND status IN ('scheduled', 'live')
         GROUP BY scheduled_date`,
        [batch_id, planDates]
      );
      for (const row of existingBatchRes.rows as Array<{ scheduled_date: string; cnt: string }>) {
        conflicts.push({
          type: 'batch_overlap',
          date: row.scheduled_date,
          message: `Batch already has ${row.cnt} session(s) on ${row.scheduled_date}`,
        });
      }
    }
  }

  // Dry run: return preview
  if (dry_run) {
    const allDates = sessionsToCreate.map(s => s.date).sort();
    const dateRange = allDates.length > 0
      ? { start: allDates[0], end: allDates[allDates.length - 1] }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        preview: {
          total_sessions: sessionsToCreate.length,
          per_subject: perSubject,
          date_range: dateRange,
          conflicts,
          calendar: {
            region: calendar.region,
            grade: calendar.grade,
            board: calendar.board,
            category: calendar.category,
          },
          sessions: sessionsToCreate.map(s => ({
            date: s.date, day: s.day, time: s.time,
            subject: s.subject, topic: s.topic,
            session_type: s.session_type, teacher_email: s.teacher_email,
          })),
        },
      },
    });
  }

  // ── Actual creation ───────────────────────────────────────
  const scheduleGroupId = `sg_cal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let created = 0;
  let specialCreated = 0;

  for (const s of sessionsToCreate) {
    const shortId = Math.random().toString(36).substring(2, 8);
    const roomName = `stibe_${s.date.replace(/-/g, '')}_${s.time.replace(/:/g, '').substring(0, 4)}_${shortId}`;

    await db.query(
      `INSERT INTO batch_sessions (
        batch_id, subject, teacher_email, teacher_name,
        scheduled_date, start_time,
        duration_minutes, teaching_minutes, prep_buffer_minutes,
        livekit_room_name, topic, notes, created_by, schedule_group_id
      ) VALUES ($1, $2, $3, $4, $5, $6::time, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        batch_id, s.subject, s.teacher_email, s.teacher_name,
        s.date, s.time,
        duration_minutes, teaching_minutes, 15,
        roomName, s.topic, null, user.id, scheduleGroupId,
      ]
    );

    created++;
    if (s.session_type !== 'session') specialCreated++;
  }

  // Record the run in audit log
  await db.query(
    `INSERT INTO calendar_schedule_runs
     (calendar_id, batch_id, schedule_group_id, created_by, sessions_created, special_sessions_created, time_slots, teacher_map, include_special_classes, include_new_batch, include_exam_special)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      calendar_id, batch_id, scheduleGroupId, user.id,
      created, specialCreated,
      JSON.stringify(time_slots), JSON.stringify(teacher_map),
      include_special_classes, include_new_batch, include_exam_special,
    ]
  );

  // Trigger timetable email (debounced)
  scheduleTimetableUpdate(batch_id);

  return NextResponse.json({
    success: true,
    data: {
      schedule_group_id: scheduleGroupId,
      sessions_created: created,
      special_sessions_created: specialCreated,
      per_subject: perSubject,
    },
    message: `${created} sessions created from ${calendar.region} Grade ${calendar.grade} ${calendar.board} ${calendar.category} calendar`,
  }, { status: 201 });
}

// ── Types ───────────────────────────────────────────────────
interface ScheduleRequest {
  calendar_id: string;
  batch_id: string;
  time_slots: Record<string, string>;
  teacher_map: Record<string, string>;
  day_subject_map?: Record<string, string>;
  include_special_classes?: boolean;
  include_new_batch?: boolean;
  include_exam_special?: boolean;
  duration_minutes?: number;
  teaching_minutes?: number;
  start_from_date?: string;
  start_date?: string;  // Batch start date: topics assigned in calendar sequence from this date (ignores calendar dates)
  end_date?: string;    // Optional upper bound: sessions beyond this date are skipped
  dry_run?: boolean;
}

interface CalendarSession {
  session_date: string;
  day_of_week: string;
  subject: string | null;
  topic: string | null;
  session_type: string;
  session_order: number;
}

interface SessionPlan {
  date: string;
  day: string;
  time: string;
  subject: string;
  topic: string | null;
  session_type: string;
  teacher_email: string | null;
  teacher_name: string | null;
}

interface Conflict {
  type: string;
  date: string;
  teacher_email?: string;
  message: string;
}
