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
    expect(resolveEnv({}).apiBaseUrl).toBe('https://dev-api.swasthyaiq.in');
    expect(resolveEnv({ EXPO_PUBLIC_APP_ENV: 'demo' })).toMatchObject({
      appEnv: 'demo',
      apiBaseUrl: 'https://api.swasthyaiq.in',
      wsUrl: 'wss://api.swasthyaiq.in/ws',
    });
    expect(resolveEnv({ EXPO_PUBLIC_API_URL: 'http://10.0.2.2:3000/' })).toMatchObject({
      apiBaseUrl: 'http://10.0.2.2:3000',
      wsUrl: 'ws://10.0.2.2:3000/ws',
    });
  });
});

describe('ApiClient session end (DIG-43)', () => {
  it('tells the session when the Admin signed the doctor out remotely', async () => {
    const ended: string[] = [];
    const f = fakeFetch(401, { code: 'session_revoked', message: 'Signed out' });
    const api = new ApiClient(
      'https://api.test',
      async () => 'tok',
      f.impl,
      15_000,
      (c) => {
        ended.push(c);
      },
    );
    await expect(api.queue()).rejects.toMatchObject({ code: 'session_revoked' });
    expect(ended).toEqual(['session_revoked']);
  });

  it('does not end the session for other errors', async () => {
    const ended: string[] = [];
    const api = new ApiClient(
      'https://api.test',
      async () => 'tok',
      fakeFetch(403, { code: 'wrong_role' }).impl,
      15_000,
      (c) => {
        ended.push(c);
      },
    );
    await expect(api.queue()).rejects.toMatchObject({ code: 'wrong_role' });
    expect(ended).toEqual([]);
  });
});

describe('ApiClient queue actions (DIG-47)', () => {
  it('resets the queue', async () => {
    const f = fakeFetch(200, { reset: 12 });
    const api = new ApiClient('https://api.test', async () => 'tok', f.impl);
    await expect(api.resetQueue()).resolves.toEqual({ reset: 12 });
    expect(f.calls[0]?.init.method).toBe('POST');
    expect(f.calls[0]?.url).toBe('https://api.test/queue/reset');
  });

  it('passes the other doctor’s name from a 409 through as details', async () => {
    const f = fakeFetch(409, {
      code: 'in_consult_with_other_doctor',
      message: 'Another doctor has this patient open',
      inConsultWithName: 'Dr. Saiyam Shah',
    });
    const api = new ApiClient('https://api.test', async () => 'tok', f.impl);
    const err = (await api.openConsult('p1').catch((x: unknown) => x)) as ApiError;
    expect(err.code).toBe('in_consult_with_other_doctor');
    expect(err.details).toEqual({ inConsultWithName: 'Dr. Saiyam Shah' });
  });
});

describe('ApiClient conditions (DIG-48)', () => {
  it('adds a condition with a JSON body', async () => {
    const f = fakeFetch(201, { id: 'c1', name: 'Asthma' });
    const api = new ApiClient('https://api.test', async () => 'tok', f.impl);
    await api.addCondition('p1', { name: 'Asthma', status: 'active' });
    expect(f.calls[0]?.url).toBe('https://api.test/patients/p1/conditions');
    expect(f.calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(f.calls[0]?.init.body as string)).toEqual({ name: 'Asthma', status: 'active' });
    expect((f.calls[0]?.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('changes a condition status with PATCH', async () => {
    const f = fakeFetch(200, { id: 'c1', status: 'resolved' });
    const api = new ApiClient('https://api.test', async () => 'tok', f.impl);
    await api.updateCondition('p1', 'c1', { status: 'resolved' });
    expect(f.calls[0]?.url).toBe('https://api.test/patients/p1/conditions/c1');
    expect(f.calls[0]?.init.method).toBe('PATCH');
  });
});

describe('ApiClient sign (DIG-95)', () => {
  it('signs with POST and passes the 422 problems through', async () => {
    const f = fakeFetch(422, {
      code: 'sign_blocked',
      message: 'Visit cannot be signed yet',
      problems: [{ code: 'no_diagnosis' }],
    });
    const api = new ApiClient('https://api.test', async () => 'tok', f.impl);
    const err = (await api.signVisit('v1').catch((x: unknown) => x)) as ApiError;
    expect(f.calls[0]?.url).toBe('https://api.test/visits/v1/sign');
    expect(f.calls[0]?.init.method).toBe('POST');
    expect(err.code).toBe('sign_blocked');
    expect(err.details.problems).toEqual([{ code: 'no_diagnosis' }]);
  });
});
