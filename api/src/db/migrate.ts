import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from 'kysely';
import type { Db } from './database';

export const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const LOCK_KEY = 727274;

/**
 * Applies every migrations/NNN_*.sql file not yet recorded in schema_migrations,
 * each in its own transaction, in file-name order. Safe to run on every deploy.
 * Returns the names of the files applied in this run.
 */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

  // Pin one connection so the advisory lock and its unlock use the same session.
  return db.connection().execute(async (conn) => {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`.execute(conn);
    await sql`SELECT pg_advisory_lock(${LOCK_KEY})`.execute(conn);
    try {
      const done = await sql<{ name: string }>`SELECT name FROM schema_migrations`.execute(conn);
      const applied = new Set(done.rows.map((r) => r.name));
      const ran: string[] = [];
      for (const file of files) {
        if (applied.has(file)) continue;
        const body = await readFile(join(dir, file), 'utf8');
        await conn.transaction().execute(async (trx) => {
          await sql.raw(body).execute(trx);
          await sql`INSERT INTO schema_migrations (name) VALUES (${file})`.execute(trx);
        });
        ran.push(file);
      }
      return ran;
    } finally {
      await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`.execute(conn);
    }
  });
}
