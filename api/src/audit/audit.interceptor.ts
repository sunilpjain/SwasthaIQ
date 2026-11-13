import {
  HttpException,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs';
import type { AuthUser } from '../auth/auth.decorators';
import { AuditService } from './audit.service';

export const AUDIT_ACTION = 'swasthyaiq:auditAction';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface Req {
  method: string;
  user?: AuthUser;
  route?: { path?: string };
  params?: Record<string, string>;
}

/**
 * Records every write (POST/PUT/PATCH/DELETE) in the audit log with user, time,
 * route pattern, entity id and outcome — successful or not.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Req>();
    if (!WRITE_METHODS.has(req.method)) return next.handle();

    const action =
      this.reflector.get<string | undefined>(AUDIT_ACTION, ctx.getHandler()) ??
      `${req.method} ${req.route?.path ?? ''}`;
    const params = req.params ?? {};
    const entityId = params.id ?? params.patientId ?? params.username ?? null;
    const base = {
      userId: req.user?.id ?? null,
      username: req.user?.username ?? null,
      action,
      entityId,
      httpMethod: req.method,
      path: req.route?.path ?? null,
    };

    return next.handle().pipe(
      mergeMap((result) =>
        from(
          this.audit.record({
            ...base,
            statusCode: ctx.switchToHttp().getResponse<{ statusCode: number }>().statusCode,
          }),
        ).pipe(mergeMap(() => [result])),
      ),
      catchError((err: unknown) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        return from(this.audit.record({ ...base, statusCode: status })).pipe(
          mergeMap(() => throwError(() => err)),
        );
      }),
    );
  }
}
