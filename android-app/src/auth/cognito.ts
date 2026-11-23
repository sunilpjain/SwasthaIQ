import type { CognitoSettings } from '../config/env';

/**
 * Minimal client for the three Cognito calls the app needs, over Cognito's public JSON API
 * (the Android app client has no secret, so these calls are unsigned). Keeps the AWS SDK out of
 * the app bundle. Never logs passwords or tokens.
 */

export interface CognitoTokens {
  accessToken: string;
  /** Seconds since epoch (from the token's `exp`). */
  accessExpiresAt: number;
  /** Present on login; on renewal only when Cognito rotated it (always, with rotation on). */
  refreshToken?: string;
}

export type CognitoErrorCode =
  | 'wrong_credentials' // NotAuthorizedException on login
  | 'session_ended' // refresh token expired, revoked or replaced
  | 'password_change_required' // NEW_PASSWORD_REQUIRED or PasswordResetRequiredException
  | 'too_many_attempts'
  | 'not_configured'
  | 'network'
  | 'unknown';

export class CognitoError extends Error {
  constructor(
    public readonly code: CognitoErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

/** Reads `exp` from a JWT without checking it (the API checks every token). */
export function jwtExpiry(jwt: string): number {
  const part = jwt.split('.')[1];
  if (!part) throw new CognitoError('unknown', 'Malformed token');
  const json = atob(
    part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '='),
  );
  const exp = (JSON.parse(json) as { exp?: unknown }).exp;
  if (typeof exp !== 'number') throw new CognitoError('unknown', 'Token has no expiry');
  return exp;
}

interface AuthResult {
  AccessToken?: string;
  RefreshToken?: string;
}

export class CognitoClient {
  constructor(
    private readonly settings: CognitoSettings,
    private readonly fetchImpl: Fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  /** First login with user ID and password (USER_PASSWORD_AUTH, over TLS). */
  async signIn(username: string, password: string): Promise<CognitoTokens> {
    const res = await this.call<{ AuthenticationResult?: AuthResult; ChallengeName?: string }>(
      'InitiateAuth',
      {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.settings.clientId,
        AuthParameters: { USERNAME: username, PASSWORD: password },
      },
      'wrong_credentials',
    );
    if (!res.AuthenticationResult) {
      throw new CognitoError(
        res.ChallengeName === 'NEW_PASSWORD_REQUIRED' ? 'password_change_required' : 'unknown',
        'Your password must be set by the clinic admin before you can sign in',
      );
    }
    return this.tokens(res.AuthenticationResult, true);
  }

  /** Silent renewal. With rotation on, Cognito returns a new 7-day refresh token every time. */
  async renew(refreshToken: string): Promise<CognitoTokens> {
    const res = await this.call<{ AuthenticationResult?: AuthResult }>(
      'GetTokensFromRefreshToken',
      { ClientId: this.settings.clientId, RefreshToken: refreshToken },
      'session_ended',
    );
    if (!res.AuthenticationResult) throw new CognitoError('session_ended', 'Please sign in again');
    return this.tokens(res.AuthenticationResult, false);
  }

  /** Log out: revokes the refresh token (and the access tokens issued from it). */
  async revoke(refreshToken: string): Promise<void> {
    await this.call(
      'RevokeToken',
      { ClientId: this.settings.clientId, Token: refreshToken },
      'session_ended',
    );
  }

  private tokens(r: AuthResult, needRefresh: boolean): CognitoTokens {
    if (!r.AccessToken || (needRefresh && !r.RefreshToken)) {
      throw new CognitoError('unknown', 'Sign-in returned no tokens');
    }
    return {
      accessToken: r.AccessToken,
      accessExpiresAt: jwtExpiry(r.AccessToken),
      ...(r.RefreshToken ? { refreshToken: r.RefreshToken } : {}),
    };
  }

  private async call<T>(target: string, body: object, notAuthorized: CognitoErrorCode): Promise<T> {
    if (!this.settings.clientId) {
      throw new CognitoError('not_configured', 'Sign-in is not set up for this build yet');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`https://cognito-idp.${this.settings.region}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new CognitoError('network', 'No connection. Check the internet and try again');
    } finally {
      clearTimeout(timer);
    }
    const json = (await res.json().catch(() => ({}))) as T & { __type?: string };
    if (res.ok) return json;
    // __type looks like "NotAuthorizedException" or "com.amazonaws...#NotAuthorizedException".
    const type = (json.__type ?? '').split('#').pop() ?? '';
    switch (type) {
      case 'NotAuthorizedException':
      case 'UserNotFoundException':
        throw new CognitoError(
          notAuthorized,
          notAuthorized === 'wrong_credentials' ? 'Wrong user ID or password' : 'Please sign in again',
        );
      case 'PasswordResetRequiredException':
        throw new CognitoError('password_change_required', 'Ask the clinic admin to reset your password');
      case 'TooManyRequestsException':
      case 'LimitExceededException':
        throw new CognitoError('too_many_attempts', 'Too many attempts. Wait a minute and try again');
      default:
        throw new CognitoError('unknown', 'Sign-in failed. Try again');
    }
  }
}
