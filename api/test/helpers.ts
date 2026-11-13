import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';
import { sql } from 'kysely';
import { createApp } from '../src/bootstrap';
import { CognitoAdmin } from '../src/auth/cognito-admin';
import { CognitoTokenVerifier } from '../src/auth/token-verifier';
import { createDb, type Db } from '../src/db/database';
import { migrate } from '../src/db/migrate';
import { seed } from '../src/seed/seed';

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://swasthyaiq:localdev@localhost:5432/swasthyaiq_test';
export const ISSUER = 'https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_TEST';
export const CLIENT_ID = 'android-client';

export class FakeCognitoAdmin extends CognitoAdmin {
  calls: string[] = [];
  async globalSignOut(username: string): Promise<void> {
    this.calls.push(`signOut:${username}`);
  }
  async setEnabled(username: string, enabled: boolean): Promise<void> {
    this.calls.push(`setEnabled:${username}:${enabled}`);
  }
}

export interface TokenOpts {
  username: string;
  groups?: string[];
  iat?: number; // seconds
  expiresIn?: number; // seconds
  tokenUse?: string;
  clientId?: string;
  issuer?: string;
}

export interface Keys {
  privateKey: KeyLike;
  jwk: JWK;
}

export async function makeKeys(): Promise<Keys> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  return { privateKey, jwk };
}

export function localVerifier(keys: Keys): CognitoTokenVerifier {
  return new CognitoTokenVerifier(ISSUER, [CLIENT_ID], createLocalJWKSet({ keys: [keys.jwk] }));
}

const DEFAULT_GROUPS: Record<string, string[]> = {
  saiyam: ['doctor'],
  samradnyee: ['doctor'],
  admin: ['admin'],
};

export async function token(keys: Keys, o: TokenOpts): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const iat = o.iat ?? now;
  return new SignJWT({
    token_use: o.tokenUse ?? 'access',
    client_id: o.clientId ?? CLIENT_ID,
    username: o.username,
    'cognito:groups': o.groups ?? DEFAULT_GROUPS[o.username] ?? [],
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(`sub-${o.username}`)
    .setIssuer(o.issuer ?? ISSUER)
    .setIssuedAt(iat)
    .setExpirationTime(iat + (o.expiresIn ?? 3600))
    .sign(keys.privateKey);
}

/** Drops and recreates the schema, runs migrations and the seed. */
export async function freshDb(): Promise<Db> {
  const db = createDb({ connectionString: TEST_DB_URL, max: 5 });
  await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(db);
  await sql`CREATE SCHEMA public`.execute(db);
  await migrate(db);
  await seed(db);
  return db;
}

export interface TestApp {
  app: INestApplication;
  db: Db;
  keys: Keys;
  cognito: FakeCognitoAdmin;
  tokenFor: (username: string, extra?: Partial<TokenOpts>) => Promise<string>;
}

export async function startApp(statusTtlMs = 0): Promise<TestApp> {
  const db = await freshDb();
  const keys = await makeKeys();
  const cognito = new FakeCognitoAdmin();
  const app = await createApp({
    db,
    verifier: localVerifier(keys),
    cognitoAdmin: cognito,
    version: 'test',
    statusTtlMs,
  });
  await app.init();
  return { app, db, keys, cognito, tokenFor: (username, extra) => token(keys, { username, ...extra }) };
}
