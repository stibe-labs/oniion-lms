import { db } from '../lib/db';

async function main() {
  // Fix Feb 26 session stuck as 'live' → 'ended'
  const r1 = await db.query(
    `UPDATE batch_sessions
     SET status = 'ended', ended_at = NOW()
     WHERE session_id = 'sess_141e6975-917' AND status = 'live'`
  );
  console.log(`Fixed live→ended: ${r1.rowCount} row(s)`);

  // Fix Feb 25 session that was never started → 'cancelled'
  const r2 = await db.query(
    `UPDATE batch_sessions
     SET status = 'cancelled', cancelled_at = NOW(),
         cancel_reason = 'Auto-cancelled: past session never started'
     WHERE session_id = 'sess_9326b7bb-94e' AND status = 'scheduled'`
  );
  console.log(`Fixed scheduled→cancelled: ${r2.rowCount} row(s)`);

  // Verify final state
  const all = await db.query(
    `SELECT session_id, scheduled_date::text, start_time::text, status FROM batch_sessions ORDER BY scheduled_date, start_time`
  );
  console.log('\nFinal session states:');
  all.rows.forEach(r => console.log(` ${r.scheduled_date} ${r.start_time}  [${r.status}]  ${r.session_id}`));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
