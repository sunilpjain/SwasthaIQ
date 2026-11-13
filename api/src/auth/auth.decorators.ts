import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@swasthyaiq/shared';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  sub: string;
}

export const IS_PUBLIC = 'swasthyaiq:isPublic';
export const ROLES = 'swasthyaiq:roles';

/** Marks an endpoint as reachable without a token (health check only). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Restricts an endpoint to the given roles. Endpoints without @Roles accept any signed-in user. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return req.user;
});
