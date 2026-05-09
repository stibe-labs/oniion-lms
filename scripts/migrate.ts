/**
 * stibe Portal — Database Migration Runner
 *
 * Reads all .sql files from migrations/ in alphabetical order.
 * Skips files already recorded in the _migrations table.
 *
 * Run:   npm run db:migrate          (apply pending migrations)
 *        npm run db:reset            (drop ALL tables, re-run all migrations)
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load .env.local for local development
dotenv.config({ path: join(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Check .env.local');
  process.exit(1);
}

const isReset = process.argv.includes('--reset');

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // ── Reset mode: drop everything and start fresh ──────────
    if (isReset) {
      console.log('⚠️  RESET MODE — dropping all tables...\n');
      await client.query('DROP SCHEMA public CASCADE');
      await client.query('CREATE SCHEMA public');
      await client.query('GRANT ALL ON SCHEMA public TO public');
      console.log('  ✅ Schema reset complete.\n');
    }

    // Ensure _migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Get already-applied migrations
    const { rows: applied } = await client.query(
      'SELECT filename FROM _migrations ORDER BY filename'
    );
    const appliedSet = new Set(applied.map((r: { filename: string }) => r.filename));

    // Read migration files
    const migrationsDir = join(process.cwd(), 'migrations');
    let files: string[];
    try {
      files = (await readdir(migrationsDir))
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch {
      console.error('❌ No migrations/ directory found.');
      process.exit(1);
    }

    if (files.length === 0) {
      console.log('ℹ  No migration files found in migrations/');
      return;
    }

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} — already applied`);
        continue;
      }

      console.log(`  ▸ Applying ${file}...`);
      const sql = await readFile(join(migrationsDir, file), 'utf-8');

      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        appliedCount++;
        console.log(`  ✅ ${file} — applied`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // The migration uses a RAISE EXCEPTION to skip if already applied within a transaction
        if (msg.includes('already applied')) {
          console.log(`  ✓ ${file} — already applied (detected inside SQL)`);
          // Record it so we don't attempt again
          await client.query(
            'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
        } else {
          console.error(`  ❌ ${file} — FAILED:`, msg);
          throw err;
        }
      }
    }

    if (appliedCount === 0) {
      console.log('\n✅ Database is up to date — no new migrations.');
    } else {
      console.log(`\n✅ Applied ${appliedCount} migration(s) successfully.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
