import { loadConfig } from '../config/config';
import { createDb } from '../db/database';
import { logger } from '../logging/logger';
import { seed } from './seed';

async function main(): Promise<void> {
  const config = await loadConfig();
  const db = createDb({ connectionString: config.databaseUrl, ssl: config.databaseSsl, max: 1 });
  try {
    const result = await seed(db);
    logger.info(result, 'seed complete');
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  logger.error({ err: (err as Error).message }, 'seed failed');
  process.exit(1);
});
