import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import { DB, type Db } from '../db/database';
import { AuthService } from '../auth/auth.service';
import { CognitoAdmin } from '../auth/cognito-admin';
import { resetQueue, clearTestVisits } from '../seed/seed';
import type { AuthUser } from '../auth/auth.decorators';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cognito: CognitoAdmin,
    private readonly auth: AuthService,
  ) {}

  async listUsers(): Promise<unknown[]> {
    return this.db
      .selectFrom('users')
      .leftJoin('session_revocations', 'session_revocations.user_id', 'users.id')
      .select([
        'users.username',
        'users.display_name',
        'users.role',
        'users.enabled',
        'session_revocations.revoked_at',
      ])
      .orderBy('users.username')
      .execute();
  }

  /** Puts all 12 patients back to Waiting. Never deletes saved consults. */
  async resetQueue(): Promise<{ reset: number }> {
    return { reset: await resetQueue(this.db) };
  }

  /** Deletes visits created during testing; keeps the pre-loaded (seed) history. */
  async clearTestVisits(): Promise<{ deleted: number }> {
    return { deleted: await clearTestVisits(this.db) };
  }

  /**
   * Remote sign-out: revokes the user's Cognito refresh tokens and makes the API
   * reject any access token issued before now. Takes effect immediately on this server.
   */
  async signOut(admin: AuthUser, username: string): Promise<{ username: string; revokedAt: string }> {
    const user = await this.findUser(username);
    await this.cognito.globalSignOut(user.username);
    const revokedAt = new Date();
    await this.db
      .insertInto('session_revocations')
      .values({ user_id: user.id, revoked_at: revokedAt, revoked_by: admin.id })
      .onConflict((oc) => oc.column('user_id').doUpdateSet({ revoked_at: revokedAt, revoked_by: admin.id }))
      .execute();
    this.auth.invalidate(user.username);
    return { username: user.username, revokedAt: revokedAt.toISOString() };
  }

  /** Turns a login off or on, in Cognito and in the API's own user table. */
  async setEnabled(username: string, enabled: boolean): Promise<{ username: string; enabled: boolean }> {
    const user = await this.findUser(username);
    await this.cognito.setEnabled(user.username, enabled);
    await this.db.updateTable('users').set({ enabled }).where('id', '=', user.id).execute();
    if (!enabled) await this.cognito.globalSignOut(user.username);
    this.auth.invalidate(user.username);
    return { username: user.username, enabled };
  }

  async stats(): Promise<{ patients: number; visits: number; testVisits: number; auditEntries: number }> {
    const r = await sql<{ patients: string; visits: string; test_visits: string; audit: string }>`
      SELECT
        (SELECT count(*) FROM patients) AS patients,
        (SELECT count(*) FROM visits) AS visits,
        (SELECT count(*) FROM visits WHERE NOT is_seed) AS test_visits,
        (SELECT count(*) FROM audit_log) AS audit`.execute(this.db);
    const row = r.rows[0]!;
    return {
      patients: Number(row.patients),
      visits: Number(row.visits),
      testVisits: Number(row.test_visits),
      auditEntries: Number(row.audit),
    };
  }

  private async findUser(username: string): Promise<{ id: string; username: string }> {
    const user = await this.db
      .selectFrom('users')
      .select(['id', 'username'])
      .where('username', '=', username.toLowerCase())
      .executeTakeFirst();
    if (!user) throw new NotFoundException({ code: 'not_found', message: 'User not found' });
    return user;
  }
}
