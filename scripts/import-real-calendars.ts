// ═══════════════════════════════════════════════════════════════
// Import Real Academic Calendars from docs/calendar/parsed_calendars.json
//
// Clears all previously auto-generated calendars (region='India')
// and imports only the 12 real stibe calendars:
//   CBSE GCC   Grade 8/9/10 × Average/Good/Excellent Category
//   State Board Grade 8/9/10 × Average Category
//
// Run: npx tsx scripts/import-real-calendars.ts
// ═══════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

const DAY_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

interface RawSession {
  date: string;
  day: string;
  subject: string | null;
  topic: string | null;
  type: string;
}

interface RawCalendar {
  region: string;
  grade: string;
  board: string;
  category: string;
  summary: Record<string, number>;
  sessions: RawSession[];
}

async function run() {
  const jsonPath = path.join(__dirname, '../docs/calendar/parsed_calendars.json');
  const calendars: RawCalendar[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const client = await pool.connect();

  try {
    // ── Step 1: Delete auto-generated calendars (region = 'India') ──
    const del = await client.query(
      `DELETE FROM academic_calendars WHERE region = 'India' RETURNING id, board, grade`
    );
    if (del.rowCount && del.rowCount > 0) {
      console.log(`Deleted ${del.rowCount} auto-generated calendars (region=India)`);
    }

    let imported = 0;
    let updated = 0;

    for (const cal of calendars) {
      // Filter out empty/null sessions; keep all meaningful types
      const sessions = cal.sessions.filter(s => s.type !== 'empty');

      // Date range from actual session rows
      const sessionDates = cal.sessions
        .filter(s => s.type === 'session')
        .map(s => s.date)
        .sort();
      const startDate = sessionDates[0] ?? cal.sessions.find(s => s.date)?.date ?? '2026-03-02';
      const endDate = sessionDates[sessionDates.length - 1] ?? '2027-02-28';
      const totalSessions = sessionDates.length;

      // Upsert calendar header
      const upsert = await client.query(
        `INSERT INTO academic_calendars
           (academic_year, region, grade, board, category, start_date, end_date, total_sessions, summary, source_file, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
         ON CONFLICT (academic_year, region, grade, board, category) DO UPDATE SET
           start_date     = EXCLUDED.start_date,
           end_date       = EXCLUDED.end_date,
           total_sessions = EXCLUDED.total_sessions,
           summary        = EXCLUDED.summary,
           source_file    = EXCLUDED.source_file,
           is_active      = TRUE,
           updated_at     = NOW()
         RETURNING id, (xmax = 0) AS is_new`,
        [
          '2026-27', cal.region, cal.grade, cal.board, cal.category,
          startDate, endDate, totalSessions,
          JSON.stringify(cal.summary),
          `parsed_calendars.json`,
        ]
      );

      const row = upsert.rows[0] as { id: string; is_new: boolean };
      const calId = row.id;
      if (row.is_new) imported++; else updated++;

      // Delete existing sessions for fresh import
      await client.query('DELETE FROM academic_calendar_sessions WHERE calendar_id = $1', [calId]);

      // Bulk insert in chunks of 200
      const subjectCounters: Record<string, number> = {};
      let sessionOrder = 0;

      for (let i = 0; i < sessions.length; i += 200) {
        const chunk = sessions.slice(i, i + 200);
        const values: unknown[] = [];
        const placeholders: string[] = [];

        for (const s of chunk) {
          sessionOrder++;
          let subjectNum: number | null = null;
          if (s.subject && s.type === 'session') {
            subjectCounters[s.subject] = (subjectCounters[s.subject] || 0) + 1;
            subjectNum = subjectCounters[s.subject];
          }
          const dayFull = DAY_FULL[s.day] ?? s.day;
          const b = values.length;
          values.push(calId, s.date, dayFull, s.subject, s.topic, s.type, sessionOrder, subjectNum);
          placeholders.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`);
        }

        await client.query(
          `INSERT INTO academic_calendar_sessions
             (calendar_id, session_date, day_of_week, subject, topic, session_type, session_order, subject_session_number)
           VALUES ${placeholders.join(',')}`,
          values
        );
      }

      const subjLine = Object.entries(cal.summary)
        .filter(([k]) => k !== 'TOTAL')
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      console.log(`  ${row.is_new ? 'NEW' : 'UPD'} ${cal.board} Grade ${cal.grade} [${cal.region}] ${cal.category} — ${totalSessions} sessions [${subjLine}]`);
    }

    // ── Step 3: Verify ──
    const verify = await client.query(
      `SELECT board, grade, region, category, total_sessions,
              (SELECT COUNT(*) FROM academic_calendar_sessions WHERE calendar_id = ac.id) AS rows
       FROM academic_calendars ac
       ORDER BY board, grade::int, region, category`
    );
    console.log(`\n── Production DB after import ──`);
    for (const r of verify.rows as { board: string; grade: string; region: string; category: string; total_sessions: number; rows: string }[]) {
      console.log(`  ${r.board} Grade ${r.grade} [${r.region}] ${r.category}: ${r.total_sessions} sessions (${r.rows} rows)`);
    }
    console.log(`\n✓ Done — ${imported} imported, ${updated} updated. Total in DB: ${verify.rows.length}`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
