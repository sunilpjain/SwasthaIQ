import { normaliseUsername } from '@swasthyaiq/shared';
import { ApiError } from '../api/client';
import { CognitoError, type CognitoClient } from './cognito';

/**
 * The doctor's sign-in session (DIG-43).
 *
 * - First login with user ID and password; afterwards the app is unlocked with device biometrics.
 * - Only the refresh token and the user ID are kept, in secure storage (Android Keystore).
 *   The access token lives in memory and is dropped when the app locks.
 * - Cognito rotates the refresh token on every renewal, giving a fresh 7 days each time, so the
 *   session slides while the app is used. The password is needed again only after 7 days without
 *   use, after Log out, or after the Admin signs the doctor out remotely.
 * - The app locks after 15 minutes without a touch and reopens with biometrics.
 *
 * Plain TypeScript with injected storage, biometrics and clock, so it is unit-tested without a device.
 */

export const IDLE_LOCK_MS = 15 * 60 * 1000;
/** Renew this long before the access token expires. */
export const RENEW_MARGIN_S = 5 * 60;

export const STORE_KEYS = {
  refreshToken: 'swasthyaiq.refreshToken',
  username: 'swasthyaiq.username',
} as const;

export interface SecureKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface Biometrics {
  /** True when the device has fingerprint/face unlock (or a screen lock) set up. */
  available(): Promise<boolean>;
  authenticate(prompt: string): Promise<boolean>;
}

export type SignOutReason = 'logged_out' | 'session_ended' | 'signed_out_remotely' | 'account_disabled';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason?: SignOutReason; lastUsername?: string }
  | { status: 'locked'; username: string }
  | { status: 'active'; username: string };

export type UnlockResult = 'unlocked' | 'cancelled' | 'needs_password' | 'session_ended';

type Cognito = Pick<CognitoClient, 'signIn' | 'renew' | 'revoke'>;

export interface SessionDeps {
  cognito: Cognito;
  store: SecureKeyValueStore;
  biometrics: Biometrics;
  now?: () => number;
  /** Called on every sign-out to wipe local data (offline drafts, caches; DIG-44 adds these). */
  wipe?: () => Promise<void>;
}

export class SessionManager {
  private current: SessionState = { status: 'loading' };
  private listeners = new Set<(s: SessionState) => void>();
  private access: { token: string; expiresAt: number } | null = null;
  private renewing: Promise<void> | null = null;
  private lastActivity: number;
  private readonly now: () => number;

  constructor(private readonly deps: SessionDeps) {
    this.now = deps.now ?? Date.now;
    this.lastActivity = this.now();
  }

  get state(): SessionState {
    return this.current;
  }

  subscribe(listener: (s: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** On app start: a stored session opens locked (biometrics next); otherwise the login screen. */
  async start(): Promise<void> {
    const [refresh, username] = await Promise.all([
      this.deps.store.get(STORE_KEYS.refreshToken),
      this.deps.store.get(STORE_KEYS.username),
    ]);
    this.set(refresh && username ? { status: 'locked', username } : { status: 'signedOut' });
  }

  /**
   * Password login. User IDs are case-insensitive. `verify` runs with the new access token before
   * anything is stored (the app checks the user is a doctor); if it throws, the new refresh token
   * is revoked and the error passed on. Cognito failures throw CognitoError.
   */
  async signIn(
    userId: string,
    password: string,
    verify?: (accessToken: string) => Promise<void>,
  ): Promise<void> {
    const username = normaliseUsername(userId);
    const t = await this.deps.cognito.signIn(username, password);
    if (!t.refreshToken) throw new CognitoError('unknown', 'Sign-in returned no refresh token');
    if (verify) {
      try {
        await verify(t.accessToken);
      } catch (e) {
        await this.deps.cognito.revoke(t.refreshToken).catch(() => undefined);
        throw e;
      }
    }
    await this.deps.store.set(STORE_KEYS.refreshToken, t.refreshToken);
    await this.deps.store.set(STORE_KEYS.username, username);
    this.access = { token: t.accessToken, expiresAt: t.accessExpiresAt };
    this.lastActivity = this.now();
    this.set({ status: 'active', username });
  }

  /**
   * Biometric unlock. Renews the tokens straight away, which both checks the session is still
   * valid (not signed out remotely, not past 7 days) and slides it. Offline, the app unlocks
   * anyway and renews when the connection is back.
   */
  async unlock(): Promise<UnlockResult> {
    if (this.current.status !== 'locked')
      return this.current.status === 'active' ? 'unlocked' : 'needs_password';
    const username = this.current.username;
    if (!(await this.deps.biometrics.available())) return 'needs_password';
    if (!(await this.deps.biometrics.authenticate('Unlock SwasthyaIQ'))) return 'cancelled';
    try {
      await this.renewOnce();
    } catch (e) {
      if (this.isSignedOut()) return 'session_ended';
      if (!(e instanceof ApiError && e.code === 'network')) throw e;
    }
    // A refused renewal ends the session without throwing.
    if (this.isSignedOut()) return 'session_ended';
    this.lastActivity = this.now();
    this.set({ status: 'active', username });
    return 'unlocked';
  }

  /**
   * Token for an API call. Renews first when it expires within 5 minutes; only one renewal runs
   * at a time, and concurrent callers wait for it. Returns null when not signed in.
   */
  async getAccessToken(): Promise<string | null> {
    if (this.current.status !== 'active') return null;
    const nowS = this.now() / 1000;
    if (this.access && this.access.expiresAt - nowS > RENEW_MARGIN_S) return this.access.token;
    try {
      await this.renewOnce();
    } catch (e) {
      // Offline: keep using the current token while it is still valid.
      if (e instanceof ApiError && e.code === 'network' && this.access && this.access.expiresAt > nowS) {
        return this.access.token;
      }
      if (this.isSignedOut()) return null;
      throw e;
    }
    return this.access?.token ?? null;
  }

  /** Any touch on the screen. */
  touch(): void {
    this.lastActivity = this.now();
  }

  /** Called on a timer and when the app comes back to the foreground. */
  checkIdle(): void {
    if (this.current.status === 'active' && this.now() - this.lastActivity >= IDLE_LOCK_MS) this.lock();
  }

  lock(): void {
    if (this.current.status !== 'active') return;
    this.access = null;
    this.set({ status: 'locked', username: this.current.username });
  }

  /** Log out from the profile menu: revokes the refresh token (best effort) and wipes local data. */
  async signOut(): Promise<void> {
    const refresh = await this.deps.store.get(STORE_KEYS.refreshToken);
    if (refresh) {
      await this.deps.cognito.revoke(refresh).catch(() => undefined);
    }
    await this.end('logged_out');
  }

  /**
   * The API refused the token. Remote sign-out and disabled accounts end the session; the
   * doctor must sign in with the password again.
   */
  async handleUnauthorized(code: string): Promise<void> {
    const reason: SignOutReason =
      code === 'session_revoked'
        ? 'signed_out_remotely'
        : code === 'user_disabled'
          ? 'account_disabled'
          : 'session_ended';
    await this.end(reason);
  }

  /** Re-reads the state after an await (a renewal may have ended the session meanwhile). */
  private isSignedOut(): boolean {
    return this.current.status === 'signedOut';
  }

  private renewOnce(): Promise<void> {
    if (!this.renewing) {
      this.renewing = this.renew().finally(() => {
        this.renewing = null;
      });
    }
    return this.renewing;
  }

  private async renew(): Promise<void> {
    const refresh = await this.deps.store.get(STORE_KEYS.refreshToken);
    if (!refresh) {
      await this.end('session_ended');
      return;
    }
    try {
      const t = await this.deps.cognito.renew(refresh);
      // Rotation: the old refresh token stops working shortly, so store the new one first.
      if (t.refreshToken) await this.deps.store.set(STORE_KEYS.refreshToken, t.refreshToken);
      this.access = { token: t.accessToken, expiresAt: t.accessExpiresAt };
    } catch (e) {
      if (e instanceof CognitoError && e.code === 'network') {
        throw new ApiError(0, 'network', 'Offline — will retry');
      }
      if (e instanceof CognitoError && e.code === 'session_ended') {
        await this.end('session_ended');
        return;
      }
      throw e;
    }
  }

  private async end(reason: SignOutReason): Promise<void> {
    const lastUsername =
      this.current.status === 'active' || this.current.status === 'locked'
        ? this.current.username
        : ((await this.deps.store.get(STORE_KEYS.username)) ?? undefined);
    this.access = null;
    await Promise.all([
      this.deps.store.remove(STORE_KEYS.refreshToken),
      this.deps.store.remove(STORE_KEYS.username),
    ]);
    await this.deps.wipe?.();
    this.set({ status: 'signedOut', reason, ...(lastUsername ? { lastUsername } : {}) });
  }

  private set(s: SessionState): void {
    this.current = s;
    for (const l of this.listeners) l(s);
  }
}
