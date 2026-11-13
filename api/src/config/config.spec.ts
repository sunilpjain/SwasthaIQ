import { loadConfig } from './config';

const base = {
  COGNITO_USER_POOL_ID: 'ap-south-1_ABC',
  COGNITO_APP_CLIENT_IDS: 'android, admin',
};

describe('loadConfig', () => {
  it('reads DATABASE_URL locally and derives the Cognito issuer', async () => {
    const c = await loadConfig({ ...base, DATABASE_URL: 'postgres://u:p@localhost/db' });
    expect(c.env).toBe('local');
    expect(c.databaseUrl).toBe('postgres://u:p@localhost/db');
    expect(c.databaseSsl).toBe(false);
    expect(c.cognito.issuer).toBe('https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_ABC');
    expect(c.cognito.appClientIds).toEqual(['android', 'admin']);
    expect(c.port).toBe(3000);
  });

  it('builds the DB URL from Secrets Manager and enables SSL', async () => {
    const fetch = jest.fn(async (arn: string) =>
      arn === 'db-arn'
        ? JSON.stringify({
            username: 'app',
            password: 'p@ss/word',
            host: 'rds.local',
            port: 5432,
            dbname: 'swasthyaiq',
          })
        : JSON.stringify({ sarvamApiKey: 'sk-test' }),
    );
    const c = await loadConfig(
      { ...base, APP_ENV: 'dev', DB_SECRET_ARN: 'db-arn', APP_SECRET_ARN: 'app-arn' },
      fetch,
    );
    expect(c.databaseUrl).toBe('postgres://app:p%40ss%2Fword@rds.local:5432/swasthyaiq');
    expect(c.databaseSsl).toBe(true);
    expect(c.sarvamApiKey).toBe('sk-test');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails clearly when required settings are missing', async () => {
    await expect(loadConfig({ COGNITO_APP_CLIENT_IDS: 'x', DATABASE_URL: 'x' })).rejects.toThrow(
      /COGNITO_USER_POOL_ID/,
    );
    await expect(loadConfig({ ...base })).rejects.toThrow(/DATABASE_URL/);
    await expect(loadConfig({ ...base, APP_ENV: 'prod', DATABASE_URL: 'x' })).rejects.toThrow(/APP_ENV/);
    await expect(
      loadConfig({ ...base, DB_SECRET_ARN: 'a' }, async () => JSON.stringify({ username: 'u' })),
    ).rejects.toThrow(/incomplete/);
  });
});
