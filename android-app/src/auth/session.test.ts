import { ApiError } from '../api/client';
import { CognitoError, type CognitoTokens } from './cognito';
import {
  IDLE_LOCK_MS,
  SessionManager,
  STORE_KEYS,
  type Biometrics,
  type SecureKeyValueStore,
  type SessionState,
} from './session';

const T0 = 1_795_000_000_000; // ms
const s = (ms: number) => Math.floor(ms / 1000);

class MemoryStore implements SecureKeyValueStore {
  data = new Map<string, string>();
  async get(k: string) {
    return this.data.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.data.set(k, v);
  }
  async remove(k: string) {
    this.data.delete(k);
  }
}

function setup(o: { biometrics?: Partial<Biometrics>; stored?: boolean } = {}) {
  let now = T0;
  let n = 0;
  const store = new MemoryStore();
  if (o.stored) {
    store.data.set(STORE_KEYS.refreshToken, 'refresh-0');
    store.data.set(STORE_KEYS.username, 'saiyam');
  }
  const issue = (refresh = true): CognitoTokens => {
    n++;
    return {
      accessToken: `access-${n}`,
      accessExpiresAt: s(now) + 3600,
      ...(refresh ? { refreshToken: `refresh-${n}` } : {}),
    };
  };
  const cognito = {
    signIn: jest.fn(async (_u: string, _p: string) => issue()),
    renew: jest.fn(async (_r: string) => issue()),
    revoke: jest.fn(async (_r: string) => undefined),
  };
  const biometrics: Biometrics = {
    available: async () => true,
    authenticate: async () => true,
    ...o.biometrics,
  };
  const wipe = jest.fn(async () => undefined);
  const session = new SessionManager({ cognito, store, biometrics, now: () => now, wipe });
  const states: SessionState[] = [];
  session.subscribe((st) => states.push(st));
  return {
    session,
    store,
    cognito,
    wipe,
    states,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('SessionManager', () => {
  describe('start and first login', () => {
    it('opens on the login screen when nothing is stored', async () => {
      const t = setup();
      await t.session.start();
      expect(t.session.state).toEqual({ status: 'signedOut' });
    });

    it('opens locked when a session is stored, so biometrics unlock it', async () => {
      const t = setup({ stored: true });
      await t.session.start();
      expect(t.session.state).toEqual({ status: 'locked', username: 'saiyam' });
    });

    it('signs in with a case-insensitive user ID and keeps only refresh token and user ID', async () => {
      const t = setup();
      await t.session.signIn('  Saiyam ', 'pw');
      expect(t.cognito.signIn).toHaveBeenCalledWith('saiyam', 'pw');
      expect(t.session.state).toEqual({ status: 'active', username: 'saiyam' });
      expect([...t.store.data.keys()].sort()).toEqual([STORE_KEYS.refreshToken, STORE_KEYS.username].sort());
      expect(t.store.data.get(STORE_KEYS.refreshToken)).toBe('refresh-1');
      expect(await t.session.getAccessToken()).toBe('access-1');
    });

    it('runs the check before storing anything, and revokes the new token when it fails', async () => {
      const t = setup();
      await t.session.start();
      const verify = jest.fn(async (token: string) => {
        expect(token).toBe('access-1');
        throw new Error('not a doctor');
      });
      await expect(t.session.signIn('admin', 'pw', verify)).rejects.toThrow('not a doctor');
      expect(t.cognito.revoke).toHaveBeenCalledWith('refresh-1');
      expect(t.store.data.size).toBe(0);
      expect(t.states.map((x) => x.status)).toEqual(['signedOut']);
    });

    it('passes a wrong password through and stays signed out', async () => {
      const t = setup();
      await t.session.start();
      t.cognito.signIn.mockRejectedValueOnce(
        new CognitoError('wrong_credentials', 'Wrong user ID or password'),
      );
      await expect(t.session.signIn('saiyam', 'bad')).rejects.toMatchObject({ code: 'wrong_credentials' });
      expect(t.session.state.status).toBe('signedOut');
      expect(t.store.data.size).toBe(0);
    });
  });

  // Moved from DIG-80.
  describe('token renewal', () => {
    it('renews before the access token expires, via GetTokensFromRefreshToken', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.advance(50 * 60 * 1000); // 10 minutes left: no renewal yet
      expect(await t.session.getAccessToken()).toBe('access-1');
      expect(t.cognito.renew).not.toHaveBeenCalled();
      t.advance(6 * 60 * 1000); // 4 minutes left: inside the 5-minute margin
      expect(await t.session.getAccessToken()).toBe('access-2');
      expect(t.cognito.renew).toHaveBeenCalledWith('refresh-1');
    });

    it('stores the rotated refresh token and uses it for the next renewal', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.advance(58 * 60 * 1000);
      await t.session.getAccessToken();
      expect(t.store.data.get(STORE_KEYS.refreshToken)).toBe('refresh-2');
      t.advance(58 * 60 * 1000);
      await t.session.getAccessToken();
      expect(t.cognito.renew).toHaveBeenLastCalledWith('refresh-2');
    });

    it('keeps the stored refresh token when Cognito does not rotate it', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.cognito.renew.mockResolvedValueOnce({ accessToken: 'access-x', accessExpiresAt: s(T0) + 9999 });
      t.advance(58 * 60 * 1000);
      expect(await t.session.getAccessToken()).toBe('access-x');
      expect(t.store.data.get(STORE_KEYS.refreshToken)).toBe('refresh-1');
    });

    it('runs only one renewal at a time', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.advance(58 * 60 * 1000);
      let release!: () => void;
      t.cognito.renew.mockImplementationOnce(
        () =>
          new Promise<CognitoTokens>((resolve) => {
            release = () =>
              resolve({ accessToken: 'access-r', accessExpiresAt: s(T0) + 7200, refreshToken: 'refresh-r' });
          }),
      );
      const calls = [t.session.getAccessToken(), t.session.getAccessToken(), t.session.getAccessToken()];
      await Promise.resolve();
      release();
      expect(await Promise.all(calls)).toEqual(['access-r', 'access-r', 'access-r']);
      expect(t.cognito.renew).toHaveBeenCalledTimes(1);
    });

    it('sends the doctor to the password login when the refresh token is revoked or expired', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.advance(58 * 60 * 1000);
      t.cognito.renew.mockRejectedValueOnce(new CognitoError('session_ended', 'Please sign in again'));
      expect(await t.session.getAccessToken()).toBeNull();
      expect(t.session.state).toEqual({
        status: 'signedOut',
        reason: 'session_ended',
        lastUsername: 'saiyam',
      });
      expect(t.store.data.size).toBe(0);
      expect(t.wipe).toHaveBeenCalled();
    });

    it('keeps the session offline and reuses a still-valid token', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.advance(58 * 60 * 1000); // 2 minutes left
      t.cognito.renew.mockRejectedValueOnce(new CognitoError('network', 'offline'));
      expect(await t.session.getAccessToken()).toBe('access-1');
      expect(t.session.state.status).toBe('active');
      t.advance(5 * 60 * 1000); // now expired and still offline
      t.cognito.renew.mockRejectedValueOnce(new CognitoError('network', 'offline'));
      await expect(t.session.getAccessToken()).rejects.toBeInstanceOf(ApiError);
      expect(t.session.state.status).toBe('active');
    });

    it('gives no token while locked or signed out', async () => {
      const t = setup({ stored: true });
      await t.session.start();
      expect(await t.session.getAccessToken()).toBeNull();
    });
  });

  describe('idle lock and biometric unlock', () => {
    it('locks after 15 minutes without a touch and drops the access token', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.advance(IDLE_LOCK_MS - 1000);
      t.session.checkIdle();
      expect(t.session.state.status).toBe('active');
      t.session.touch();
      t.advance(IDLE_LOCK_MS - 1000);
      t.session.checkIdle();
      expect(t.session.state.status).toBe('active');
      t.advance(1000);
      t.session.checkIdle();
      expect(t.session.state).toEqual({ status: 'locked', username: 'saiyam' });
      expect(await t.session.getAccessToken()).toBeNull();
    });

    it('unlocks with biometrics and renews straight away (no password)', async () => {
      const t = setup({ stored: true });
      await t.session.start();
      expect(await t.session.unlock()).toBe('unlocked');
      expect(t.cognito.renew).toHaveBeenCalledWith('refresh-0');
      expect(t.cognito.signIn).not.toHaveBeenCalled();
      expect(await t.session.getAccessToken()).toBe('access-1');
    });

    it('stays locked when biometrics are cancelled', async () => {
      const t = setup({ stored: true, biometrics: { authenticate: async () => false } });
      await t.session.start();
      expect(await t.session.unlock()).toBe('cancelled');
      expect(t.session.state.status).toBe('locked');
    });

    it('asks for the password when the phone has no biometrics or screen lock', async () => {
      const t = setup({ stored: true, biometrics: { available: async () => false } });
      await t.session.start();
      expect(await t.session.unlock()).toBe('needs_password');
    });

    it('sends to the password login when the session ended while locked (7 days, remote sign-out)', async () => {
      const t = setup({ stored: true });
      await t.session.start();
      t.cognito.renew.mockRejectedValueOnce(new CognitoError('session_ended', 'x'));
      expect(await t.session.unlock()).toBe('session_ended');
      expect(t.session.state).toEqual({
        status: 'signedOut',
        reason: 'session_ended',
        lastUsername: 'saiyam',
      });
    });

    it('unlocks offline and renews later', async () => {
      const t = setup({ stored: true });
      await t.session.start();
      t.cognito.renew.mockRejectedValueOnce(new CognitoError('network', 'offline'));
      expect(await t.session.unlock()).toBe('unlocked');
      expect(await t.session.getAccessToken()).toBe('access-1'); // renewed on first use
    });
  });

  describe('sign-out', () => {
    it('Log out revokes the refresh token and wipes local data', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      await t.session.signOut();
      expect(t.cognito.revoke).toHaveBeenCalledWith('refresh-1');
      expect(t.store.data.size).toBe(0);
      expect(t.wipe).toHaveBeenCalledTimes(1);
      expect(t.session.state).toEqual({ status: 'signedOut', reason: 'logged_out', lastUsername: 'saiyam' });
    });

    it('logs out locally even when the revoke call fails', async () => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      t.cognito.revoke.mockRejectedValueOnce(new CognitoError('network', 'offline'));
      await t.session.signOut();
      expect(t.session.state.status).toBe('signedOut');
      expect(t.store.data.size).toBe(0);
    });

    it.each([
      ['session_revoked', 'signed_out_remotely'],
      ['user_disabled', 'account_disabled'],
      ['unknown_user', 'session_ended'],
    ])('API code %s ends the session as %s', async (code, reason) => {
      const t = setup();
      await t.session.signIn('saiyam', 'pw');
      await t.session.handleUnauthorized(code);
      expect(t.session.state).toMatchObject({ status: 'signedOut', reason });
      expect(t.cognito.revoke).not.toHaveBeenCalled();
      expect(t.store.data.size).toBe(0);
    });
  });
});
