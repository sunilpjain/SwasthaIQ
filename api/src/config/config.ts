import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface AppConfig {
  env: 'local' | 'test' | 'dev' | 'demo';
  port: number;
  version: string;
  databaseUrl: string;
  databaseSsl: boolean;
  awsRegion: string;
  cognito: {
    userPoolId: string;
    appClientIds: string[];
    /** Override for tests; defaults to the pool's public JWKS URL. */
    jwksUrl?: string;
    issuer: string;
  };
  sarvamApiKey: string | null;
}

/** Shape of the JSON secret created by the CDK data stack (RDS-generated + app keys). */
interface AppSecret {
  username?: string;
  password?: string;
  host?: string;
  port?: number | string;
  dbname?: string;
  sarvamApiKey?: string;
}

type Env = Record<string, string | undefined>;
type SecretFetcher = (arn: string, region: string) => Promise<string>;

const defaultFetcher: SecretFetcher = async (arn, region) => {
  const client = new SecretsManagerClient({ region });
  const out = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!out.SecretString) throw new Error('secret has no string value');
  return out.SecretString;
};

function required(env: Env, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`missing required environment variable ${key}`);
  return v;
}

/**
 * Builds config from environment variables. On AWS, DB credentials and API keys
 * come from Secrets Manager (DB_SECRET_ARN / APP_SECRET_ARN) — never from code or env files.
 */
export async function loadConfig(
  env: Env = process.env,
  fetchSecret: SecretFetcher = defaultFetcher,
): Promise<AppConfig> {
  const appEnv = (env.APP_ENV ?? 'local') as AppConfig['env'];
  if (!['local', 'test', 'dev', 'demo'].includes(appEnv)) throw new Error(`invalid APP_ENV ${appEnv}`);
  const region = env.AWS_REGION ?? 'ap-south-1';

  let databaseUrl = env.DATABASE_URL ?? '';
  let sarvamApiKey = env.SARVAM_API_KEY ?? null;

  if (env.DB_SECRET_ARN) {
    const s = JSON.parse(await fetchSecret(env.DB_SECRET_ARN, region)) as AppSecret;
    if (!s.username || !s.password || !s.host) throw new Error('database secret is incomplete');
    const user = encodeURIComponent(s.username);
    const pass = encodeURIComponent(s.password);
    databaseUrl = `postgres://${user}:${pass}@${s.host}:${s.port ?? 5432}/${s.dbname ?? 'swasthyaiq'}`;
  }
  if (env.APP_SECRET_ARN) {
    const s = JSON.parse(await fetchSecret(env.APP_SECRET_ARN, region)) as AppSecret;
    sarvamApiKey = s.sarvamApiKey ?? sarvamApiKey;
  }
  if (!databaseUrl) throw new Error('missing DATABASE_URL or DB_SECRET_ARN');

  const userPoolId = required(env, 'COGNITO_USER_POOL_ID');
  const poolRegion = userPoolId.split('_')[0] ?? region;
  const issuer = env.COGNITO_ISSUER ?? `https://cognito-idp.${poolRegion}.amazonaws.com/${userPoolId}`;

  return {
    env: appEnv,
    port: Number(env.PORT ?? 3000),
    version: env.APP_VERSION ?? 'dev',
    databaseUrl,
    databaseSsl: env.DATABASE_SSL === 'true' || Boolean(env.DB_SECRET_ARN),
    awsRegion: region,
    cognito: {
      userPoolId,
      appClientIds: required(env, 'COGNITO_APP_CLIENT_IDS')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      jwksUrl: env.COGNITO_JWKS_URL,
      issuer,
    },
    sarvamApiKey,
  };
}
