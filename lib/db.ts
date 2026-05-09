import { Pool, type PoolClient, type QueryResult, types } from 'pg';

// Return DATE (1082) and TIME (1083) columns as plain strings instead of
// JavaScript Date/string objects so template literals like
// `${row.scheduled_date}T${row.start_time}+05:30` work correctly.
types.setTypeParser(1082, (val: string) => val); // DATE  → "YYYY-MM-DD"
types.setTypeParser(1083, (val: string) => val); // TIME  → "HH:MM:SS"

/**
 * PostgreSQL client singleton with connection pooling.
 * Reuses the same pool across hot reloads in Next.js dev mode.
 * Connects to DATABASE_URL from environment.
 */

const globalForDb = globalThis as unknown as {
  pgPool: Pool | undefined;
};

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Raised from 10 → 50 for high-concurrency live sessions:
    // 100+ students joining simultaneously triggers many concurrent queries
    // (webhook recordJoin, attendance polling, lobby polling, room status).
    // PostgreSQL default max_connections is 100, so 50 leaves headroom for
    // the worker process and other clients.
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgPool = pool;
}

/**
 * PostgreSQL database access layer.
 *
 * Usage:
 *   const result = await db.query('SELECT * FROM rooms WHERE room_id = $1', [roomId]);
 *   const rows = result.rows;
 *
 * Transaction usage:
 *   const total = await db.withTransaction(async (client) => {
 *     await client.query('UPDATE rooms SET status = $1 WHERE room_id = $2', ['live', id]);
 *     await client.query('INSERT INTO room_events ...');
 *     return 'ok';
 *   });
 */
export const db = {
  /** Execute a parameterised SQL query against the pool. */
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    return pool.query<T>(sql, params);
  },

  /** Get a raw pool client — caller MUST call client.release(). */
  getClient: (): Promise<PoolClient> => {
    return pool.connect();
  },

  /**
   * Run a function inside a database transaction.
   * Automatically calls BEGIN, COMMIT on success, ROLLBACK on error.
   * Returns whatever the callback returns.
   */
  withTransaction: async <T>(
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  pool,
};

/**
 * Resolve a room identifier (room_id OR batch_session_id) to the canonical room_id.
 * Many routes receive batch_session_id from URLs but DB data uses the LiveKit room_id.
 */
export async function resolveRoomId(idOrSessionId: string): Promise<string> {
  const r = await db.query<{ room_id: string }>(
    'SELECT room_id FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1',
    [idOrSessionId],
  );
  return r.rows[0]?.room_id ?? idOrSessionId;
}
