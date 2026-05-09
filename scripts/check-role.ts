import { db } from '../lib/db';

async function main() {
  const r = await db.query(
    `SELECT email, portal_role FROM portal_users WHERE portal_role IN ('coordinator', 'batch_coordinator')`
  );
  console.log('Results:', r.rows);
  process.exit(0);
}
main();
