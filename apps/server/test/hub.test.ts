import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientMessage, ServerMessage } from '@chess/shared';
import { Hub } from '../src/hub';
import { PlayerStore } from '../src/store';

let server: Server;
let url: string;

beforeAll(async () => {
  const hub = new Hub(new PlayerStore(null));
  server = createServer();
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => hub.attach(ws));
  await new Promise<void>((r) => server.listen(0, r));
  url = `ws://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

class Client {
  ws: WebSocket;
  inbox: ServerMessage[] = [];
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor() {
    this.ws = new WebSocket(url);
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as ServerMessage;
      this.inbox.push(msg);
      this.waiters.forEach((w) => w(msg));
    });
  }
  open() {
    return new Promise<void>((r) => this.ws.once('open', () => r()));
  }
  send(msg: ClientMessage) {
    this.ws.send(JSON.stringify(msg));
  }
  next<T extends ServerMessage['t']>(t: T): Promise<Extract<ServerMessage, { t: T }>> {
    const found = this.inbox.find((m) => m.t === t);
    if (found) {
      this.inbox.splice(this.inbox.indexOf(found), 1);
      return Promise.resolve(found as Extract<ServerMessage, { t: T }>);
    }
    return new Promise((resolve) => {
      const w = (m: ServerMessage) => {
        if (m.t !== t) return;
        this.waiters = this.waiters.filter((x) => x !== w);
        this.inbox.splice(this.inbox.indexOf(m), 1);
        resolve(m as Extract<ServerMessage, { t: T }>);
      };
      this.waiters.push(w);
    });
  }
}

async function connect(name: string, token?: string) {
  const c = new Client();
  await c.open();
  c.send({ t: 'hello', name, token });
  const welcome = await c.next('welcome');
  return { c, welcome };
}

describe('Hub', () => {
  it('pairs two queued players and relays moves', async () => {
    const { c: a } = await connect('Alice');
    const { c: b } = await connect('Bob');
    a.send({ t: 'queue', tc: { initial: 180, increment: 2 } });
    await a.next('queued');
    b.send({ t: 'queue', tc: { initial: 180, increment: 2 } });
    const [ga, gb] = await Promise.all([a.next('game'), b.next('game')]);
    expect(ga.game.id).toBe(gb.game.id);
    expect(ga.you).not.toBe(gb.you);

    const white = ga.you === 'white' ? a : b;
    const black = ga.you === 'white' ? b : a;
    white.send({ t: 'move', gameId: ga.game.id, uci: 'e2e4', ply: 0 });
    const echo = await black.next('moved');
    expect(echo.uci).toBe('e2e4');

    black.send({ t: 'resign', gameId: ga.game.id });
    const end = await white.next('ended');
    expect(end.result).toBe('1-0');
    expect(end.reason).toBe('resign');
    a.ws.close();
    b.ws.close();
  });

  it('resumes a game after reconnecting with the same token', async () => {
    const { c: host, welcome } = await connect('Host');
    host.send({ t: 'room-create', tc: { initial: 300, increment: 0 } });
    const room = await host.next('room');
    const { c: guest } = await connect('Guest');
    guest.send({ t: 'room-join', code: room.code });
    const g = await host.next('game');

    host.ws.close();
    const opp = await guest.next('opponent');
    expect(opp.connected).toBe(false);

    const { c: back } = await connect('Host', welcome.token);
    const resumed = await back.next('game');
    expect(resumed.game.id).toBe(g.game.id);
    expect((await guest.next('opponent')).connected).toBe(true);
    back.ws.close();
    guest.ws.close();
  });

  it('rejects unknown room codes', async () => {
    const { c } = await connect('Lost');
    c.send({ t: 'room-join', code: 'ZZZZZ' });
    const err = await c.next('error');
    expect(err.message).toMatch(/introuvable/);
    c.ws.close();
  });
});
