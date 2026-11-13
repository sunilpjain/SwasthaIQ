import type { IncomingMessage } from 'node:http';
import { Logger } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, type OnGatewayConnection } from '@nestjs/websockets';
import type { WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service';
import { bearerToken } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.decorators';

export const WS_CLOSE_UNAUTHORISED = 4401;
export const WS_CLOSE_FORBIDDEN = 4403;

type AuthedSocket = WebSocket & { user?: AuthUser };

/** Token from "Authorization: Bearer …" (React Native supports headers) or ?access_token=… */
export function wsToken(req: IncomingMessage): string | undefined {
  const fromHeader = bearerToken(req.headers.authorization);
  if (fromHeader) return fromHeader;
  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.searchParams.get('access_token') ?? undefined;
}

/**
 * WebSocket endpoint at /ws. Sprint 3 adds the live dictation relay here; Sprint 1 proves
 * that sockets are authenticated exactly like HTTP (same token checks, doctor role only).
 */
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly log = new Logger(RealtimeGateway.name);

  constructor(private readonly auth: AuthService) {}

  async handleConnection(client: AuthedSocket, req: IncomingMessage): Promise<void> {
    try {
      const user = await this.auth.authenticate(wsToken(req));
      if (user.role !== 'doctor') {
        client.close(WS_CLOSE_FORBIDDEN, 'doctor role required');
        return;
      }
      client.user = user;
      client.send(JSON.stringify({ event: 'ready', data: { username: user.username } }));
    } catch {
      this.log.warn('rejected unauthenticated websocket');
      client.close(WS_CLOSE_UNAUTHORISED, 'unauthorised');
    }
  }

  @SubscribeMessage('ping')
  ping(client: AuthedSocket): { event: string; data: { username: string | null; at: string } } {
    return { event: 'pong', data: { username: client.user?.username ?? null, at: new Date().toISOString() } };
  }
}
