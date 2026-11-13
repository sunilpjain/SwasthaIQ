import 'reflect-metadata';
import { AwsCognitoAdmin } from './auth/cognito-admin';
import { CognitoTokenVerifier } from './auth/token-verifier';
import { createApp } from './bootstrap';
import { loadConfig } from './config/config';
import { createDb } from './db/database';
import { migrate } from './db/migrate';
import { logger } from './logging/logger';

async function main(): Promise<void> {
  const config = await loadConfig();
  const db = createDb({ connectionString: config.databaseUrl, ssl: config.databaseSsl });

  if (process.env.MIGRATE_ON_START !== 'false') {
    const ran = await migrate(db);
    if (ran.length) logger.info({ applied: ran }, 'migrations applied');
  }

  const app = await createApp({
    db,
    verifier: new CognitoTokenVerifier(
      config.cognito.issuer,
      config.cognito.appClientIds,
      undefined,
      config.cognito.jwksUrl,
    ),
    cognitoAdmin: new AwsCognitoAdmin(config.cognito.userPoolId, config.awsRegion),
    version: config.version,
  });
  await app.listen(config.port, '0.0.0.0');
  logger.info({ port: config.port, env: config.env, version: config.version }, 'api listening');
}

main().catch((err: unknown) => {
  logger.fatal({ err: (err as Error).message }, 'api failed to start');
  process.exit(1);
});
