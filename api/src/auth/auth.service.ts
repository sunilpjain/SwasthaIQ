import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DB, type Db } from '../db/database';
import type { AuthUser } from './auth.decorators';
import { TokenError, TokenVerifier } from './token-verifier';

interface UserStatus {
  user: AuthUser;
  enabled: boolean;
  revokedAtMs: number | null;
  loadedAt: number;
}

/** How long a user's enabled/revoked status may be cached. Must stay under 60 s (DIG-37). */
export const STATUS_TTL_MS = 30_000;
export const STATUS_TTL = Symbol('STATUS_TTL');

@Injectable()
export class AuthService {
  private readonly cache = new Map<string, UserStatus>();

  constructor(
    private readonly verifier: TokenVerifier,
    @Inject(DB) private readonly db: Db,
    @Inject(STATUS_TTL) private readonly ttlMs: number,
  ) {}

  /** Validates a bearer token and returns the signed-in user. Used by HTTP and WebSocket. */
  async authenticate(token: string | undefined): Promise<AuthUser> {
    let claims;
    try {
      claims = await this.verifier.verify(token ?? '');
    } catch (err) {
      const reason = err instanceof TokenError ? err.reason : 'invalid';
      throw new UnauthorizedException({ code: `token_${reason}`, message: 'Please sign in again' });
    }

    const status = await this.loadStatus(claims.username);
    if (!status) throw new UnauthorizedException({ code: 'unknown_user', message: 'Please sign in again' });
    if (!status.enabled)
      throw new UnauthorizedException({ code: 'user_disabled', message: 'Account disabled' });
    if (status.revokedAtMs !== null && claims.iat * 1000 < status.revokedAtMs) {
      throw new UnauthorizedException({ code: 'session_revoked', message: 'Signed out by admin' });
    }
    // The Cognito group must agree with the role held in the database.
    if (!claims.groups.includes(status.user.role)) {
      throw new ForbiddenException({ code: 'role_mismatch', message: 'Role not permitted' });
    }
    return { ...status.user, sub: claims.sub };
  }

  /** Drops cached status so a sign-out or disable takes effect immediately on this server. */
  invalidate(username: string): void {
    this.cache.delete(username.toLowerCase());
  }

  private async loadStatus(username: string): Promise<UserStatus | null> {
    const now = Date.now();
    const hit = this.cache.get(username);
    if (hit && now - hit.loadedAt < this.ttlMs) return hit;

    const row = await this.db
      .selectFrom('users')
      .leftJoin('session_revocations', 'session_revocations.user_id', 'users.id')
      .select([
        'users.id',
        'users.username',
        'users.display_name',
        'users.role',
        'users.enabled',
        'session_revocations.revoked_at',
      ])
      .where('users.username', '=', username)
      .executeTakeFirst();
    if (!row) {
      this.cache.delete(username);
      return null;
    }
    const status: UserStatus = {
      user: { id: row.id, username: row.username, displayName: row.display_name, role: row.role, sub: '' },
      enabled: row.enabled,
      revokedAtMs: row.revoked_at ? new Date(row.revoked_at).getTime() : null,
      loadedAt: now,
    };
    this.cache.set(username, status);
    return status;
  }
}
