import { loadConfig } from '../config/config';
import { createDb } from './database';
import { migrate } from './migrate';
import { logger } from '../logging/logger';

async function main(): Promise<void> {
  const config = await loadConfig();
  const db = createDb({ connectionString: config.databaseUrl, ssl: config.databaseSsl, max: 1 });
  try {
    const ran = await migrate(db);
    logger.info({ applied: ran }, ran.length ? 'migrations applied' : 'schema up to date');
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  logger.error({ err }, 'migration failed');
  process.exit(1);
});
