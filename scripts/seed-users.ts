// ═══════════════════════════════════════════════════════════════
// stibe Portal — Seed Script
// Seeds portal_users with the owner account.
// Default password: Test@1234
//
// Run: npx tsx scripts/seed-users.ts
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';
import { hash } from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_PASSWORD = 'Test@1234';

const users: [string, string, string][] = [
  ['stibelearningventures@gmail.com', 'Admin Owner', 'owner'],
];

async function seed() {
  console.log('🔐 Hashing passwords...');
  const passwordHash = await hash(DEFAULT_PASSWORD, 12);

  console.log('📥 Seeding portal_users...\n');

  for (const [email, name, role] of users) {
    await pool.query(
      `INSERT INTO portal_users (email, full_name, portal_role, password_hash, plain_password, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         full_name      = $2,
         portal_role    = $3,
         password_hash  = $4,
         plain_password = $5,
         is_active      = TRUE,
         updated_at     = NOW()`,
      [email, name, role, passwordHash, DEFAULT_PASSWORD]
    );
    console.log(`  ✅ ${email.padEnd(35)} → ${role}`);
  }

  console.log('\n📋 Current portal_users:');
  const res = await pool.query(
    `SELECT email, full_name, portal_role,
            CASE WHEN password_hash IS NOT NULL THEN '✓ set' ELSE '✗ not set' END AS password
     FROM portal_users ORDER BY portal_role`
  );
  console.table(res.rows);

  console.log(`\n✅ Owner account seeded. Default password: ${DEFAULT_PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
