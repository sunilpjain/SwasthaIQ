import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DB, type Db } from '../db/database';
import { logger } from '../logging/logger';
import { resetQueue } from '../seed/seed';
import { msUntilNextIst } from './queue-schedule';

export const RESET_HOUR_IST = 2;
export const SCHEDULED_RESET_ACTION = 'queue.reset.scheduled';

/**
 * Resets the queue every day at 2 am IST (DIG-39), in-process: the API runs as a single
 * container on one server, so there is exactly one timer. A missed run (server down at 2 am)
 * is not caught up; the doctor or admin "Reset queue" button covers that.
 */
@Injectable()
export class QueueResetScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  onApplicationBootstrap(): void {
    this.schedule();
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Runs one scheduled reset and records it in the audit log as the system. */
  async run(now = new Date()): Promise<number> {
    const reset = await resetQueue(this.db, now);
    await this.audit.record({ userId: null, username: 'system', action: SCHEDULED_RESET_ACTION });
    logger.info({ reset }, 'scheduled queue reset');
    return reset;
  }

  private schedule(): void {
    if (this.stopped) return;
    const delay = msUntilNextIst(RESET_HOUR_IST, new Date());
    this.timer = setTimeout(() => {
      this.run()
        .catch((err: unknown) =>
          logger.error({ err: (err as Error).message }, 'scheduled queue reset failed'),
        )
        .finally(() => this.schedule());
    }, delay);
    this.timer.unref(); // never keeps the process (or a test run) alive
  }
}
