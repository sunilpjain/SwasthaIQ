import { ApiClient, ApiError } from './client';
import { resolveEnv } from '../config/env';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('ApiClient', () => {
  it('sends the bearer token and returns typed data', async () => {
    const f = fakeFetch(200, [{ patient: { token: 'G1' } }]);
    const api = new ApiClient('https://api.test', async () => 'tok', f.impl);
    const q = await api.queue();
    expect(q[0]?.patient.token).toBe('G1');
    expect(f.calls[0]?.url).toBe('https://api.test/queue');
    expect((f.calls[0]?.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('calls /health without a token', async () => {
    const f = fakeFetch(200, { status: 'ok', db: 'up' });
    const api = new ApiClient('https://api.test', async () => null, f.impl);
    await expect(api.health()).resolves.toMatchObject({ status: 'ok' });
    expect((f.calls[0]?.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('maps API errors to ApiError with the server code', async () => {
    const f = fakeFetch(401, { code: 'session_revoked', message: 'Signed out by admin' });
    const api = new ApiClient('https://api.test', async () => 'tok', f.impl);
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('session_revoked');
    expect((err as ApiError).needsLogin).toBe(true);
  });

  it('refuses authenticated calls when not signed in, and reports network failure', async () => {
    const api = new ApiClient('https://api.test', async () => null, fakeFetch(200, {}).impl);
    await expect(api.queue()).rejects.toMatchObject({ code: 'not_signed_in' });
    const offline = new ApiClient('https://api.test', async () => 't', (async () => {
      throw new Error('down');
    }) as unknown as typeof fetch);
    await expect(offline.queue()).rejects.toMatchObject({ code: 'network', status: 0 });
  });

  it('URL-encodes ids and search terms', async () => {
    const f = fakeFetch(200, []);
    const api = new ApiClient('https://api.test', async () => 't', f.impl);
    await api.searchPatients('Kanta ben');
    await api.openConsult('a/b', true);
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://api.test/patients?q=Kanta%20ben',
      'https://api.test/queue/a%2Fb/open?force=true',
    ]);
  });
});

describe('resolveEnv', () => {
  it('defaults to dev, switches to demo, and accepts a local override', () => {
    expect(resolveEnv({}).apiBaseUrl).toBe('https://dev-api.swasthyaiq.cognihealth.in');
    expect(resolveEnv({ EXPO_PUBLIC_APP_ENV: 'demo' })).toMatchObject({
      appEnv: 'demo',
      apiBaseUrl: 'https://api.swasthyaiq.cognihealth.in',
      wsUrl: 'wss://api.swasthyaiq.cognihealth.in/ws',
    });
    expect(resolveEnv({ EXPO_PUBLIC_API_URL: 'http://10.0.2.2:3000/' })).toMatchObject({
      apiBaseUrl: 'http://10.0.2.2:3000',
      wsUrl: 'ws://10.0.2.2:3000/ws',
    });
  });
});
