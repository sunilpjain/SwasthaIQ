import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool, types } from 'pg';
import type { Database } from './schema';

// Return DATE columns as 'YYYY-MM-DD' strings, not JS Dates shifted by timezone.
types.setTypeParser(1082, (v: string) => v);

export type Db = Kysely<Database>;
export const DB = Symbol('DB');

export interface DbConnectionOptions {
  connectionString: string;
  ssl?: boolean;
  max?: number;
}

export function createDb(opts: DbConnectionOptions): Db {
  const pool = new Pool({
    connectionString: opts.connectionString,
    max: opts.max ?? 10,
    ssl: opts.ssl ? { rejectUnauthorized: false } : undefined,
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

export async function pingDb(db: Db): Promise<boolean> {
  try {
    await sql`select 1`.execute(db);
    return true;
  } catch {
    return false;
  }
}
