/** Writes api/openapi.json without a database or AWS (uses inert stand-ins). */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApi, createApp } from '../src/bootstrap';
import type { Db } from '../src/db/database';
import { CognitoAdmin } from '../src/auth/cognito-admin';
import { TokenVerifier, type VerifiedToken } from '../src/auth/token-verifier';

class NoVerifier extends TokenVerifier {
  verify(): Promise<VerifiedToken> {
    return Promise.reject(new Error('not used'));
  }
}
class NoCognito extends CognitoAdmin {
  globalSignOut(): Promise<void> {
    return Promise.resolve();
  }
  setEnabled(): Promise<void> {
    return Promise.resolve();
  }
}

async function main(): Promise<void> {
  const version = process.env.APP_VERSION ?? '0.1.0';
  const app = await createApp({
    db: {} as Db,
    verifier: new NoVerifier(),
    cognitoAdmin: new NoCognito(),
    version,
  });
  const doc = buildOpenApi(app, version);
  const out = join(__dirname, '..', 'openapi.json');
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  await app.close();
  console.log(`wrote ${out}`);
}

void main();
