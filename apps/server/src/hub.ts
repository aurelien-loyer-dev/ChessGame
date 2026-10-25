import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  EMOTES,
  sanitizeName,
  tcKey,
  type ClientMessage,
  type Color,
  type ServerMessage,
  type TimeControl,
} from '@chess/shared';
import { eloUpdate } from './elo.js';
import { OnlineGame, type GameEnd } from './game.js';
import type { PlayerStore } from './store.js';

const ABANDON_GRACE_MS = 60_000;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Session {
  playerId: string;
  ws: WebSocket;
  lastEmote: number;
}

interface QueueEntry {
  playerId: string;
  tc: TimeControl;
  since: number;
}

interface Room {
  code: string;
  host: string;
  tc: TimeControl;
}

export class Hub {
  private sessions = new Map<string, Session>();
  private queue = new Map<string, QueueEntry>();
  private rooms = new Map<string, Room>();
  private games = new Map<string, OnlineGame>();
  /** playerId -> id of the game they are currently in (or just finished). */
  private playerGame = new Map<string, string>();
  private flagTimers = new Map<string, NodeJS.Timeout>();
  private abandonTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly store: PlayerStore) {}

  // ── Connection lifecycle ────────────────────────────────────────────────

  attach(ws: WebSocket) {
    let session: Session | null = null;

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;

      if (msg.t === 'hello') {
        session = this.hello(ws, msg.name, msg.token);
        return;
      }
      if (msg.t === 'ping') {
        this.send(ws, { t: 'pong', at: msg.at, serverTime: Date.now() });
        return;
      }
      if (!session) {
        this.send(ws, { t: 'error', message: 'Session non initialisée' });
        return;
      }
      this.handle(session, msg);
    });

    ws.on('close', () => {
      if (session && this.sessions.get(session.playerId) === session) this.disconnect(session);
    });
  }

  private hello(ws: WebSocket, rawName: string, token?: string): Session {
    const name = sanitizeName(String(rawName ?? '')) || `Invité${Math.floor(1000 + Math.random() * 9000)}`;
    const { token: issued, player } = this.store.resolve(token, name);

    const previous = this.sessions.get(player.id);
    if (previous && previous.ws !== ws) previous.ws.close(4000, 'Session ouverte ailleurs');

    const session: Session = { playerId: player.id, ws, lastEmote: 0 };
    this.sessions.set(player.id, session);
    this.send(ws, { t: 'welcome', token: issued, profile: this.profile(player.id) });

    // Resume a game in progress after a reconnect.
    const game = this.currentGame(player.id);
    if (game && !game.over) {
      const color = game.colorOf(player.id)!;
      clearTimeout(this.abandonTimers.get(`${game.id}:${color}`));
      this.abandonTimers.delete(`${game.id}:${color}`);
      this.send(ws, { t: 'game', game: game.snapshot(Date.now()), you: color });
      this.toOpponent(game, color, { t: 'opponent', gameId: game.id, connected: true });
    }
    this.broadcastLobby();
    return session;
  }

  private disconnect(session: Session) {
    const id = session.playerId;
    this.sessions.delete(id);
    this.queue.delete(id);
    for (const [code, room] of this.rooms) if (room.host === id) this.rooms.delete(code);

    const game = this.currentGame(id);
    if (game && !game.over) {
      const color = game.colorOf(id)!;
      this.toOpponent(game, color, { t: 'opponent', gameId: game.id, connected: false });
      const key = `${game.id}:${color}`;
      this.abandonTimers.set(
        key,
        setTimeout(() => {
          this.abandonTimers.delete(key);
          if (!game.over && !this.sessions.has(id)) this.end(game, game.abandon(color));
        }, ABANDON_GRACE_MS),
      );
    }
    this.broadcastLobby();
  }

  // ── Message routing ─────────────────────────────────────────────────────

  private handle(session: Session, msg: ClientMessage) {
    const id = session.playerId;
    switch (msg.t) {
      case 'rename': {
        const name = sanitizeName(String(msg.name ?? ''));
        const player = this.store.get(id);
        if (name && player) {
          player.name = name;
          this.store.touch();
          this.send(session.ws, { t: 'profile', profile: this.profile(id) });
        }
        return;
      }
      case 'queue':
        return this.enqueue(session, msg.tc);
      case 'queue-cancel':
        this.queue.delete(id);
        this.send(session.ws, { t: 'queue-left' });
        return this.broadcastLobby();
      case 'room-create':
        return this.createRoom(session, msg.tc);
      case 'room-join':
        return this.joinRoom(session, String(msg.code ?? '').toUpperCase());
      case 'room-cancel':
        for (const [code, room] of this.rooms) if (room.host === id) this.rooms.delete(code);
        this.send(session.ws, { t: 'room-closed' });
        return;
      case 'move':
        return this.move(session, msg.gameId, String(msg.uci ?? ''), msg.ply);
      case 'resign': {
        const game = this.ownGame(id, msg.gameId);
        if (game && !game.over) this.end(game, game.resign(game.colorOf(id)!));
        return;
      }
      case 'draw-offer': {
        const game = this.ownGame(id, msg.gameId);
        if (!game || game.over) return;
        const color = game.colorOf(id)!;
        if (game.drawOfferBy && game.drawOfferBy !== color) return this.end(game, game.agreeDraw());
        game.drawOfferBy = color;
        this.toOpponent(game, color, { t: 'draw-offer', gameId: game.id, by: color });
        return;
      }
      case 'draw-answer': {
        const game = this.ownGame(id, msg.gameId);
        if (!game || game.over || !game.drawOfferBy) return;
        const color = game.colorOf(id)!;
        if (game.drawOfferBy === color) return;
        if (msg.accept) return this.end(game, game.agreeDraw());
        game.drawOfferBy = null;
        this.toOpponent(game, color, { t: 'draw-declined', gameId: game.id });
        return;
      }
      case 'rematch':
        return this.rematch(session, msg.gameId);
      case 'emote': {
        const game = this.ownGame(id, msg.gameId);
        if (!game || !EMOTES.includes(msg.emote)) return;
        const now = Date.now();
        if (now - session.lastEmote < 1500) return;
        session.lastEmote = now;
        const color = game.colorOf(id)!;
        this.toOpponent(game, color, { t: 'emote', gameId: game.id, by: color, emote: msg.emote });
        return;
      }
    }
  }

  // ── Matchmaking & rooms ─────────────────────────────────────────────────

  private validTc(tc: TimeControl): TimeControl | null {
    const initial = Number(tc?.initial);
    const increment = Number(tc?.increment);
    if (!Number.isFinite(initial) || !Number.isFinite(increment)) return null;
    if (initial < 0 || initial > 3 * 3600 || increment < 0 || increment > 180) return null;
    return { initial: Math.round(initial), increment: Math.round(increment) };
  }

  private busy(id: string) {
    const game = this.currentGame(id);
    return !!game && !game.over;
  }

  private enqueue(session: Session, rawTc: TimeControl) {
    const tc = this.validTc(rawTc);
    const id = session.playerId;
    if (!tc) return this.send(session.ws, { t: 'error', message: 'Cadence invalide' });
    if (this.busy(id)) return this.send(session.ws, { t: 'error', message: 'Vous avez déjà une partie en cours' });

    const key = tcKey(tc);
    const me = this.store.get(id)!;
    // Pair with the waiting player of the same time control closest in rating.
    let best: QueueEntry | null = null;
    for (const entry of this.queue.values()) {
      if (entry.playerId === id || tcKey(entry.tc) !== key) continue;
      const other = this.store.get(entry.playerId);
      if (!other) continue;
      if (!best || Math.abs(other.rating - me.rating) < Math.abs(this.store.get(best.playerId)!.rating - me.rating)) {
        best = entry;
      }
    }

    if (best) {
      this.queue.delete(best.playerId);
      this.queue.delete(id);
      this.startGame(best.playerId, id, tc);
    } else {
      const entry = { playerId: id, tc, since: Date.now() };
      this.queue.set(id, entry);
      this.send(session.ws, { t: 'queued', tc, since: entry.since });
    }
    this.broadcastLobby();
  }

  private createRoom(session: Session, rawTc: TimeControl) {
    const tc = this.validTc(rawTc);
    if (!tc) return this.send(session.ws, { t: 'error', message: 'Cadence invalide' });
    if (this.busy(session.playerId)) return this.send(session.ws, { t: 'error', message: 'Partie déjà en cours' });
    for (const [code, room] of this.rooms) if (room.host === session.playerId) this.rooms.delete(code);

    let code = '';
    do {
      code = Array.from({ length: 5 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    this.rooms.set(code, { code, host: session.playerId, tc });
    this.send(session.ws, { t: 'room', code, tc });
  }

  private joinRoom(session: Session, code: string) {
    const room = this.rooms.get(code);
    if (!room) return this.send(session.ws, { t: 'error', message: 'Salon introuvable' });
    if (room.host === session.playerId) return this.send(session.ws, { t: 'error', message: 'Vous êtes l’hôte de ce salon' });
    if (this.busy(session.playerId)) return this.send(session.ws, { t: 'error', message: 'Partie déjà en cours' });
    this.rooms.delete(code);
    this.queue.delete(session.playerId);
    this.startGame(room.host, session.playerId, room.tc);
  }

  private startGame(a: string, b: string, tc: TimeControl, whiteId?: string) {
    const [whiteP, blackP] = whiteId ? (whiteId === a ? [a, b] : [b, a]) : Math.random() < 0.5 ? [a, b] : [b, a];
    const pub = (id: string) => {
      const p = this.store.get(id)!;
      return { id: p.id, name: p.name, rating: p.rating };
    };
    const game = new OnlineGame(randomUUID(), pub(whiteP), pub(blackP), tc);
    this.games.set(game.id, game);
    this.playerGame.set(whiteP, game.id);
    this.playerGame.set(blackP, game.id);
    const snap = game.snapshot(Date.now());
    this.toPlayer(whiteP, { t: 'game', game: snap, you: 'white' });
    this.toPlayer(blackP, { t: 'game', game: snap, you: 'black' });
    this.broadcastLobby();
  }

  // ── In-game ─────────────────────────────────────────────────────────────

  private move(session: Session, gameId: string, uci: string, ply: number) {
    const game = this.ownGame(session.playerId, gameId);
    if (!game) return;
    // Ignore duplicates (e.g. a resend after reconnect).
    if (typeof ply === 'number' && ply !== game.moves.length) {
      this.send(session.ws, { t: 'game', game: game.snapshot(Date.now()), you: game.colorOf(session.playerId)! });
      return;
    }
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return this.send(session.ws, { t: 'error', message: 'Coup invalide' });

    const color = game.colorOf(session.playerId)!;
    const now = Date.now();
    const res = game.play(color, uci, now);
    if (!res.ok) {
      this.send(session.ws, { t: 'error', message: res.error });
      this.send(session.ws, { t: 'game', game: game.snapshot(now), you: color });
      return;
    }
    if (game.moves[game.moves.length - 1] === uci && game.moves.length === ply + 1) {
      const msg: ServerMessage = {
        t: 'moved',
        gameId: game.id,
        uci,
        ply,
        clocks: game.clocksAt(now),
        serverTime: now,
      };
      this.toPlayer(game.white.id, msg);
      this.toPlayer(game.black.id, msg);
    }
    if (res.end) this.end(game, res.end);
    else this.armFlag(game);
  }

  private armFlag(game: OnlineGame) {
    clearTimeout(this.flagTimers.get(game.id));
    const ms = game.msUntilFlag(Date.now());
    if (ms === null) return;
    this.flagTimers.set(
      game.id,
      setTimeout(() => {
        if (game.over) return;
        const left = game.msUntilFlag(Date.now());
        if (left !== null && left <= 0) this.end(game, game.finishOnTime(game.running!));
        else this.armFlag(game);
      }, ms + 25),
    );
  }

  private end(game: OnlineGame, end: GameEnd) {
    clearTimeout(this.flagTimers.get(game.id));
    this.flagTimers.delete(game.id);
    for (const c of ['white', 'black'] as Color[]) {
      clearTimeout(this.abandonTimers.get(`${game.id}:${c}`));
      this.abandonTimers.delete(`${game.id}:${c}`);
    }

    let ratings: Extract<ServerMessage, { t: 'ended' }>['ratings'];
    const w = this.store.get(game.white.id);
    const b = this.store.get(game.black.id);
    // Games aborted before both sides moved are not rated.
    if (w && b && game.moves.length >= 2) {
      const score = end.result === '1-0' ? 1 : end.result === '0-1' ? 0 : 0.5;
      const wAfter = eloUpdate(w.rating, b.rating, score, w.games);
      const bAfter = eloUpdate(b.rating, w.rating, 1 - score, b.games);
      ratings = { white: { before: w.rating, after: wAfter }, black: { before: b.rating, after: bAfter } };
      w.rating = wAfter;
      b.rating = bAfter;
      w.games++;
      b.games++;
      if (score === 1) (w.wins++, b.losses++);
      else if (score === 0) (b.wins++, w.losses++);
      else (w.draws++, b.draws++);
      this.store.touch();
    }

    const msg: ServerMessage = {
      t: 'ended',
      gameId: game.id,
      result: end.result,
      reason: end.reason,
      clocks: game.clocks,
      ratings,
    };
    for (const id of [game.white.id, game.black.id]) {
      this.toPlayer(id, msg);
      this.toPlayer(id, { t: 'profile', profile: this.profile(id) });
    }
    // Keep finished games around briefly so rematches can find them.
    setTimeout(() => {
      if (this.playerGame.get(game.white.id) !== game.id && this.playerGame.get(game.black.id) !== game.id) {
        this.games.delete(game.id);
      }
    }, 10 * 60_000).unref?.();
    this.broadcastLobby();
  }

  private rematch(session: Session, gameId: string) {
    const game = this.ownGame(session.playerId, gameId);
    if (!game || !game.over) return;
    const color = game.colorOf(session.playerId)!;
    if (game.rematchBy && game.rematchBy !== color) {
      game.rematchBy = null;
      // Colors swap on rematch.
      this.startGame(game.white.id, game.black.id, game.tc, game.black.id);
      return;
    }
    game.rematchBy = color;
    this.toOpponent(game, color, { t: 'rematch-offer', gameId: game.id, by: color });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private currentGame(playerId: string) {
    const id = this.playerGame.get(playerId);
    return id ? this.games.get(id) : undefined;
  }

  private ownGame(playerId: string, gameId: string) {
    const game = this.games.get(gameId);
    return game && game.colorOf(playerId) ? game : undefined;
  }

  private profile(id: string) {
    const { name, rating, games, wins, losses, draws } = this.store.get(id)!;
    return { id, name, rating, games, wins, losses, draws };
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private toPlayer(id: string, msg: ServerMessage) {
    const s = this.sessions.get(id);
    if (s) this.send(s.ws, msg);
  }

  private toOpponent(game: OnlineGame, color: Color, msg: ServerMessage) {
    this.toPlayer(color === 'white' ? game.black.id : game.white.id, msg);
  }

  private lobbyTimer: NodeJS.Timeout | null = null;

  /** Debounced presence counters for everyone connected. */
  private broadcastLobby() {
    if (this.lobbyTimer) return;
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      let playing = 0;
      for (const id of this.sessions.keys()) if (this.busy(id)) playing++;
      const msg: ServerMessage = { t: 'lobby', online: this.sessions.size, playing, queued: this.queue.size };
      for (const s of this.sessions.values()) this.send(s.ws, msg);
    }, 200);
  }

  stats() {
    return { online: this.sessions.size, games: [...this.games.values()].filter((g) => !g.over).length };
  }
}
