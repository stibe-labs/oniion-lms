import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';
import { compare } from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TEST_EMAIL = 'official.tishnu@gmail.com';
const TEST_PASS  = 'Test@1234';

const res = await pool.query(
  `SELECT email, full_name, portal_role, is_active,
          CASE WHEN password_hash IS NOT NULL THEN 'set' ELSE 'NULL' END AS pwd_status,
          password_hash
   FROM portal_users WHERE email = $1`,
  [TEST_EMAIL]
);

if (res.rows.length === 0) {
  console.log('❌ User not found in DB');
} else {
  const row = res.rows[0];
  console.log('DB row:', {
    email:       row.email,
    full_name:   row.full_name,
    portal_role: row.portal_role,
    is_active:   row.is_active,
    pwd_status:  row.pwd_status,
    pwd_prefix:  row.password_hash?.substring(0, 10) ?? 'null',
  });

  if (row.password_hash) {
    const valid = await compare(TEST_PASS, row.password_hash);
    console.log('bcrypt compare result:', valid);
  } else {
    console.log('❌ password_hash is NULL — need to re-seed');
  }
}

await pool.end();
