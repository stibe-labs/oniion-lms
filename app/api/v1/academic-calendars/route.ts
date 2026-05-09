// ═══════════════════════════════════════════════════════════════
// Academic Calendars API — GET (list) + POST (import)
// GET  /api/v1/academic-calendars                — List calendars
// POST /api/v1/academic-calendars                — Import calendars from JSON
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function getUser(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

// ── GET — List calendars ────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user || !['owner', 'academic_operator', 'batch_coordinator'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const region = url.searchParams.get('region');
  const grade = url.searchParams.get('grade');
  const board = url.searchParams.get('board');
  const batchId = url.searchParams.get('batch_id');

  let conditions = ['is_active = TRUE'];
  const params: unknown[] = [];
  let idx = 1;

  // If batch_id provided, auto-match by batch's grade + board + resolve student category
  let recommendedCategory: string | null = null;
  let studentRegions: string[] = [];
  if (batchId) {
    const batchRes = await db.query('SELECT grade, board FROM batches WHERE batch_id = $1', [batchId]);
    if (batchRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    const batch = batchRes.rows[0] as { grade: string; board: string };
    if (batch.grade) { conditions.push(`grade = $${idx++}`); params.push(batch.grade); }
    if (batch.board) { conditions.push(`board = $${idx++}`); params.push(batch.board); }

    // Find dominant student category for badge recommendation
    const catRes = await db.query(
      `SELECT up.category, COUNT(*)::int AS cnt
       FROM batch_students bs
       JOIN user_profiles up ON bs.student_email = up.email
       WHERE bs.batch_id = $1 AND up.category IS NOT NULL
       GROUP BY up.category
       ORDER BY cnt DESC, up.category
       LIMIT 1`,
      [batchId]
    );
    if (catRes.rows.length > 0) {
      const studentCat = (catRes.rows[0] as { category: string }).category;
      const catMap: Record<string, string> = { A: 'Excellent Category', B: 'Good Category', C: 'Average Category' };
      recommendedCategory = catMap[studentCat] || null;
    }

    // Fetch student regions for timezone display
    const regRes = await db.query(
      `SELECT COALESCE(up.assigned_region, 'India') AS region
       FROM batch_students bs
       LEFT JOIN user_profiles up ON bs.student_email = up.email
       WHERE bs.batch_id = $1`,
      [batchId]
    );
    studentRegions = (regRes.rows as { region: string }[]).map(r => r.region);
  } else {
    if (region) { conditions.push(`region = $${idx++}`); params.push(region); }
    if (grade) { conditions.push(`grade = $${idx++}`); params.push(grade); }
    if (board) { conditions.push(`board = $${idx++}`); params.push(board); }
  }

  const res = await db.query(
    `SELECT id, academic_year, region, grade, board, category,
            start_date, end_date, total_sessions, summary, source_file,
            created_at
     FROM academic_calendars
     WHERE ${conditions.join(' AND ')}
     ORDER BY region, grade::int, board, category`,
    params
  );

  return NextResponse.json({ success: true, data: res.rows, recommended_category: recommendedCategory, student_regions: studentRegions });
}

// ── POST — Import calendars from parsed JSON ────────────────
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user || user.role !== 'owner') {
    return NextResponse.json({ success: false, error: 'Owner only' }, { status: 403 });
  }

  let body: { calendars: CalendarImport[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.calendars) || body.calendars.length === 0) {
    return NextResponse.json({ success: false, error: 'calendars array required' }, { status: 400 });
  }

  let imported = 0;
  let updated = 0;

  for (const cal of body.calendars) {
    // Find date range from sessions
    const sessionDates = cal.sessions
      .filter((s: SessionImport) => s.type === 'session')
      .map((s: SessionImport) => s.date)
      .sort();
    const startDate = sessionDates[0] || cal.sessions[0]?.date || '2026-03-02';
    const endDate = sessionDates[sessionDates.length - 1] || '2027-02-28';
    const totalSessions = cal.sessions.filter((s: SessionImport) => s.type === 'session').length;

    // Upsert calendar
    const upsertRes = await db.query(
      `INSERT INTO academic_calendars (academic_year, region, grade, board, category, start_date, end_date, total_sessions, summary, source_file)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (academic_year, region, grade, board, category) DO UPDATE SET
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         total_sessions = EXCLUDED.total_sessions,
         summary = EXCLUDED.summary,
         source_file = EXCLUDED.source_file,
         updated_at = NOW()
       RETURNING id, (xmax = 0) AS is_new`,
      [
        '2026-27', cal.region, cal.grade, cal.board, cal.category,
        startDate, endDate, totalSessions,
        JSON.stringify(cal.summary || {}), cal.source_file || null,
      ]
    );

    const row = upsertRes.rows[0] as { id: string; is_new: boolean };
    const calendarId = row.id;
    if (row.is_new) imported++; else updated++;

    // Delete existing sessions for this calendar (fresh import)
    await db.query('DELETE FROM academic_calendar_sessions WHERE calendar_id = $1', [calendarId]);

    // Bulk-insert sessions (batch of 100)
    const sessions = cal.sessions.filter((s: SessionImport) => s.date && s.type);
    // Compute subject_session_number and session_order
    const subjectCounters: Record<string, number> = {};
    let sessionOrder = 0;

    for (let i = 0; i < sessions.length; i += 100) {
      const chunk = sessions.slice(i, i + 100);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      for (const s of chunk) {
        sessionOrder++;
        let subjectNum: number | null = null;
        if (s.subject && s.type === 'session') {
          subjectCounters[s.subject] = (subjectCounters[s.subject] || 0) + 1;
          subjectNum = subjectCounters[s.subject];
        }

        const base = values.length;
        values.push(calendarId, s.date, s.day, s.subject || null, s.topic || null, s.type, sessionOrder, subjectNum);
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`);
      }

      await db.query(
        `INSERT INTO academic_calendar_sessions (calendar_id, session_date, day_of_week, subject, topic, session_type, session_order, subject_session_number)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: { imported, updated, total: body.calendars.length },
    message: `${imported} calendars imported, ${updated} updated`,
  });
}

// Types for import
interface SessionImport {
  date: string;
  day: string;
  subject: string | null;
  topic: string | null;
  type: string;
}

interface CalendarImport {
  region: string;
  grade: string;
  board: string;
  category: string;
  summary: Record<string, number>;
  source_file?: string;
  sessions: SessionImport[];
}
