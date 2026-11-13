import { Controller, Get, HttpCode, Inject, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@swasthyaiq/shared';
import { Public } from '../auth/auth.decorators';
import { DB, pingDb, type Db } from '../db/database';
import { APP_VERSION } from '../tokens';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_VERSION) private readonly version: string,
  ) {}

  /** Used by Caddy, the EC2 health alarm and the deploy smoke test. 503 when the DB is down. */
  @Public()
  @Get()
  @HttpCode(200)
  async health(@Res({ passthrough: true }) res: { status: (n: number) => void }): Promise<HealthResponse> {
    const up = await pingDb(this.db);
    if (!up) res.status(503);
    return {
      status: up ? 'ok' : 'degraded',
      version: this.version,
      db: up ? 'up' : 'down',
      time: new Date().toISOString(),
    };
  }
}
