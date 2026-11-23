import { CognitoClient, CognitoError, jwtExpiry } from './cognito';

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (exp: number) => `${b64url({ alg: 'RS256' })}.${b64url({ exp, token_use: 'access' })}.sig`;

function fakeFetch(status: number, body: unknown, fail = false) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (fail) throw new TypeError('Network request failed');
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const settings = { region: 'ap-south-1', clientId: 'client-1' };

describe('CognitoClient', () => {
  it('signs in with USER_PASSWORD_AUTH and reads the expiry', async () => {
    const f = fakeFetch(200, { AuthenticationResult: { AccessToken: jwt(1234), RefreshToken: 'r1' } });
    const t = await new CognitoClient(settings, f.impl).signIn('saiyam', 'pw');
    expect(t).toEqual({ accessToken: jwt(1234), accessExpiresAt: 1234, refreshToken: 'r1' });
    const call = f.calls[0]!;
    expect(call.url).toBe('https://cognito-idp.ap-south-1.amazonaws.com/');
    expect((call.init.headers as Record<string, string>)['X-Amz-Target']).toBe(
      'AWSCognitoIdentityProviderService.InitiateAuth',
    );
    expect(JSON.parse(call.init.body as string)).toEqual({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: 'client-1',
      AuthParameters: { USERNAME: 'saiyam', PASSWORD: 'pw' },
    });
  });

  it('renews with GetTokensFromRefreshToken and returns the rotated refresh token', async () => {
    const f = fakeFetch(200, { AuthenticationResult: { AccessToken: jwt(99), RefreshToken: 'r2' } });
    const t = await new CognitoClient(settings, f.impl).renew('r1');
    expect(t.refreshToken).toBe('r2');
    expect((f.calls[0]!.init.headers as Record<string, string>)['X-Amz-Target']).toBe(
      'AWSCognitoIdentityProviderService.GetTokensFromRefreshToken',
    );
    expect(JSON.parse(f.calls[0]!.init.body as string)).toEqual({ ClientId: 'client-1', RefreshToken: 'r1' });
  });

  it('revokes with RevokeToken', async () => {
    const f = fakeFetch(200, {});
    await new CognitoClient(settings, f.impl).revoke('r1');
    expect(JSON.parse(f.calls[0]!.init.body as string)).toEqual({ ClientId: 'client-1', Token: 'r1' });
  });

  it.each<[string, () => Promise<unknown>, string]>([
    [
      'wrong password',
      () =>
        new CognitoClient(settings, fakeFetch(400, { __type: 'NotAuthorizedException' }).impl).signIn(
          'a',
          'b',
        ),
      'wrong_credentials',
    ],
    [
      'revoked refresh token',
      () => new CognitoClient(settings, fakeFetch(400, { __type: 'NotAuthorizedException' }).impl).renew('r'),
      'session_ended',
    ],
    [
      'password reset',
      () =>
        new CognitoClient(
          settings,
          fakeFetch(400, { __type: 'com.amazonaws#PasswordResetRequiredException' }).impl,
        ).signIn('a', 'b'),
      'password_change_required',
    ],
    [
      'throttling',
      () =>
        new CognitoClient(settings, fakeFetch(400, { __type: 'TooManyRequestsException' }).impl).signIn(
          'a',
          'b',
        ),
      'too_many_attempts',
    ],
    ['other error', () => new CognitoClient(settings, fakeFetch(500, {}).impl).signIn('a', 'b'), 'unknown'],
    ['offline', () => new CognitoClient(settings, fakeFetch(0, {}, true).impl).signIn('a', 'b'), 'network'],
    [
      'challenge',
      () =>
        new CognitoClient(settings, fakeFetch(200, { ChallengeName: 'NEW_PASSWORD_REQUIRED' }).impl).signIn(
          'a',
          'b',
        ),
      'password_change_required',
    ],
    [
      'no client id',
      () =>
        new CognitoClient({ region: 'ap-south-1', clientId: '' }, fakeFetch(200, {}).impl).signIn('a', 'b'),
      'not_configured',
    ],
  ])('maps %s', async (_name, run, code) => {
    const err = await run().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CognitoError);
    expect((err as CognitoError).code).toBe(code);
  });

  it('never puts the password or tokens in error messages', async () => {
    const err = (await new CognitoClient(settings, fakeFetch(400, { __type: 'NotAuthorizedException' }).impl)
      .signIn('saiyam', 'secret-pw')
      .catch((e: unknown) => e)) as Error;
    expect(err.message).not.toContain('secret-pw');
  });

  it('reads exp from a JWT', () => {
    expect(jwtExpiry(jwt(1_800_000_000))).toBe(1_800_000_000);
    expect(() => jwtExpiry('nope')).toThrow(CognitoError);
  });
});
