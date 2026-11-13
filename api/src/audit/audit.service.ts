import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db } from '../db/database';
import { logger } from '../logging/logger';

export interface AuditEntry {
  userId: string | null;
  username: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  httpMethod?: string | null;
  path?: string | null;
  statusCode?: number | null;
}

/** Writes who did what and when. Never stores request bodies (they may carry clinical content). */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async record(e: AuditEntry): Promise<void> {
    try {
      await this.db
        .insertInto('audit_log')
        .values({
          user_id: e.userId,
          username: e.username,
          action: e.action,
          entity_type: e.entityType ?? null,
          entity_id: e.entityId ?? null,
          http_method: e.httpMethod ?? null,
          path: e.path ?? null,
          status_code: e.statusCode ?? null,
        })
        .execute();
    } catch (err) {
      // Audit failure must be visible but must not leak request data.
      logger.error({ err: (err as Error).message, action: e.action }, 'audit write failed');
    }
  }

  async list(limit = 100): Promise<unknown[]> {
    return this.db
      .selectFrom('audit_log')
      .select([
        'id',
        'username',
        'action',
        'entity_type',
        'entity_id',
        'http_method',
        'path',
        'status_code',
        'at',
      ])
      .orderBy('id', 'desc')
      .limit(Math.min(Math.max(limit, 1), 500))
      .execute();
  }
}
