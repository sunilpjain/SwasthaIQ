import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { startApp, type TestApp } from './helpers';
import { WS_CLOSE_FORBIDDEN, WS_CLOSE_UNAUTHORISED } from '../src/realtime/realtime.gateway';

interface Outcome {
  messages: unknown[];
  closeCode: number | null;
}

function connect(url: string, headers: Record<string, string> = {}, send?: unknown): Promise<Outcome> {
  return new Promise((resolve) => {
    const out: Outcome = { messages: [], closeCode: null };
    const ws = new WebSocket(url, { headers });
    ws.on('message', (m) => {
      out.messages.push(JSON.parse(m.toString()));
      if (send && out.messages.length === 1) ws.send(JSON.stringify(send));
      else ws.close();
    });
    ws.on('close', (code) => {
      out.closeCode = code;
      resolve(out);
    });
  });
}

describe('WebSocket auth (DIG-37)', () => {
  let t: TestApp;
  let base: string;

  beforeAll(async () => {
    t = await startApp();
    await t.app.listen(0, '127.0.0.1');
    const { port } = t.app.getHttpServer().address() as AddressInfo;
    base = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    await t.app.close();
    await t.db.destroy();
  });

  it('accepts a doctor token in the Authorization header and answers ping', async () => {
    const tok = await t.tokenFor('saiyam');
    const out = await connect(base, { Authorization: `Bearer ${tok}` }, { event: 'ping', data: {} });
    expect(out.messages[0]).toEqual({ event: 'ready', data: { username: 'saiyam' } });
    expect(out.messages[1]).toMatchObject({ event: 'pong', data: { username: 'saiyam' } });
  });

  it('accepts a token in the access_token query parameter', async () => {
    const tok = await t.tokenFor('samradnyee');
    const out = await connect(`${base}?access_token=${tok}`);
    expect(out.messages[0]).toEqual({ event: 'ready', data: { username: 'samradnyee' } });
  });

  it('closes unauthenticated sockets with 4401', async () => {
    expect((await connect(base)).closeCode).toBe(WS_CLOSE_UNAUTHORISED);
    expect((await connect(base, { Authorization: 'Bearer junk' })).closeCode).toBe(WS_CLOSE_UNAUTHORISED);
  });

  it('closes admin sockets with 4403 (dictation is doctors only)', async () => {
    const tok = await t.tokenFor('admin');
    expect((await connect(base, { Authorization: `Bearer ${tok}` })).closeCode).toBe(WS_CLOSE_FORBIDDEN);
  });
});
