import { create } from 'zustand';
import type { DataConnection, Peer as PeerType } from 'peerjs';
import { tcKey, type Color, type Emote, type EndReason, type GameResult, type TimeControl } from '../lib/types';
import { play, playMoveSound } from '../lib/sound';
import { useProfile } from '../store/profile';
import { START_FEN } from '../lib/chess';
import { applyMove, buildLine, detectEnd, type PlayedMove } from '../game/line';

/**
 * Peer-to-peer online play: no game server to host. PeerJS's free public
 * broker only introduces the two browsers; moves then travel over a direct
 * WebRTC data channel. The host owns the canonical game and resyncs the
 * guest after reconnects.
 */

const ID_PREFIX = 'chess-arena-v2-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ABANDON_MS = 60_000;
/** Extra time before claiming a win on the opponent's clock, to absorb latency. */
const FLAG_GRACE_MS = 2_500;

type Wire =
  | { t: 'hello'; name: string }
  | {
      t: 'start';
      id: string;
      white: string;
      black: string;
      hostColor: Color;
      tc: TimeControl;
      moves: string[];
      clocks: { white: number; black: number };
      result: GameResult | null;
      reason: EndReason | null;
    }
  | { t: 'move'; uci: string; ply: number; remaining: number }
  | { t: 'end'; result: GameResult; reason: EndReason }
  | { t: 'draw-offer' }
  | { t: 'draw-answer'; accept: boolean }
  | { t: 'rematch' }
  | { t: 'emote'; emote: Emote }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number };

export interface OnlineGameState {
  id: string;
  white: { name: string };
  black: { name: string };
  you: Color;
  tc: TimeControl;
  moves: PlayedMove[];
  clocks: { white: number; black: number };
  /** Local performance.now() when `clocks` was last updated. */
  clocksAt: number;
  running: Color | null;
  result: GameResult | null;
  reason: EndReason | null;
  drawOfferBy: Color | null;
  rematchBy: Color | null;
  opponentConnected: boolean;
}

interface OnlineState {
  status: 'idle' | 'opening' | 'waiting' | 'connecting' | 'connected' | 'error';
  role: 'host' | 'guest' | null;
  code: string | null;
  tc: TimeControl | null;
  error: string | null;
  game: OnlineGameState | null;
  emote: { by: Color; emote: Emote; at: number } | null;
  notice: { text: string; at: number } | null;
  latency: number | null;

  host: (tc: TimeControl) => Promise<void>;
  join: (code: string) => Promise<void>;
  cancel: () => void;
  move: (uci: string) => void;
  resign: () => void;
  offerDraw: () => void;
  answerDraw: (accept: boolean) => void;
  rematch: () => void;
  sendEmote: (emote: Emote) => void;
  leaveGame: () => void;
}

let peer: PeerType | null = null;
let conn: DataConnection | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
let abandonTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const recorded = new Set<string>();

function randomCode() {
  return Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}

function myName() {
  return useProfile.getState().name || 'Invité';
}

function send(msg: Wire) {
  if (conn?.open) conn.send(msg);
}

function turnOf(moves: PlayedMove[]): Color {
  return moves.length % 2 === 0 ? 'white' : 'black';
}

function opposite(c: Color): Color {
  return c === 'white' ? 'black' : 'white';
}

/** Optional self-hosted PeerJS broker; the free public one is used by default. */
function brokerOptions() {
  const host = import.meta.env.VITE_PEER_HOST;
  if (!host) return { debug: 0 };
  return {
    debug: 0,
    host,
    port: Number(import.meta.env.VITE_PEER_PORT ?? 443),
    path: import.meta.env.VITE_PEER_PATH ?? '/',
    secure: import.meta.env.VITE_PEER_SECURE !== 'false',
  };
}

async function createPeer(id?: string): Promise<PeerType> {
  const { default: Peer } = await import('peerjs');
  return new Promise((resolve, reject) => {
    const p = id ? new Peer(id, brokerOptions()) : new Peer(brokerOptions());
    const onError = (err: { type?: string }) => {
      p.off('open', onOpen);
      p.destroy();
      reject(err);
    };
    const onOpen = () => {
      p.off('error', onError);
      resolve(p);
    };
    p.once('open', onOpen);
    p.once('error', onError);
  });
}

export const useOnline = create<OnlineState>()((set, get) => {
  const notice = (text: string) => set({ notice: { text, at: Date.now() } });

  /** Live clocks, extrapolated from the last update. */
  const nowClocks = (g: OnlineGameState) => liveClocks(g);

  const finish = (result: GameResult, reason: EndReason, broadcast: boolean) => {
    const g = get().game;
    if (!g || g.result) return;
    const clocks = nowClocks(g);
    set({ game: { ...g, result, reason, running: null, clocks, clocksAt: performance.now(), drawOfferBy: null } });
    if (broadcast) send({ t: 'end', result, reason });
    play('end');
    stopClock();
    if (!recorded.has(g.id)) {
      recorded.add(g.id);
      useProfile.getState().recordGame({
        id: g.id,
        date: Date.now(),
        mode: 'online',
        white: g.white.name,
        black: g.black.name,
        you: g.you,
        result,
        reason,
        moves: g.moves.map((m) => m.uci),
        tc: tcKey(g.tc),
      });
    }
  };

  const startClock = () => {
    stopClock();
    clockTimer = setInterval(() => {
      const g = get().game;
      if (!g || g.result || !g.running) return;
      const left = nowClocks(g)[g.running];
      if (g.running === g.you && left <= 0) finish(g.you === 'white' ? '0-1' : '1-0', 'timeout', true);
      // The opponent normally reports its own flag; claim it if it doesn't.
      else if (g.running !== g.you && left <= -FLAG_GRACE_MS) finish(g.you === 'white' ? '1-0' : '0-1', 'timeout', true);
    }, 200);
  };

  const stopClock = () => {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
  };

  /** Applies a move to the local game (ours or the opponent's). */
  const applyLocal = (uci: string, mover: Color, remaining?: number) => {
    const g = get().game;
    if (!g || g.result) return false;
    const next = applyMove(START_FEN, g.moves, uci);
    if (!next) return false;
    const now = performance.now();
    const clocks = nowClocks(g);
    const timed = g.tc.initial > 0;
    if (timed) {
      if (remaining !== undefined) clocks[mover] = remaining;
      else if (g.running === mover && next.length > 2) clocks[mover] += g.tc.increment * 1000;
    }
    const running = timed && next.length >= 2 ? turnOf(next) : null;
    set({ game: { ...g, moves: next, clocks, clocksAt: now, running, drawOfferBy: null } });
    playMoveSound(next[next.length - 1].san);
    const end = detectEnd(START_FEN, next);
    if (end) finish(end.result, end.reason, false);
    return true;
  };

  /** Host only: (re)sends the full game so the guest is in sync. */
  const sendStart = () => {
    const g = get().game;
    if (!g) return;
    send({
      t: 'start',
      id: g.id,
      white: g.white.name,
      black: g.black.name,
      hostColor: g.you,
      tc: g.tc,
      moves: g.moves.map((m) => m.uci),
      clocks: nowClocks(g),
      result: g.result,
      reason: g.reason,
    });
  };

  const newHostGame = (guestName: string, hostColor: Color) => {
    const tc = get().tc ?? { initial: 300, increment: 0 };
    const ms = tc.initial * 1000;
    const name = myName();
    set({
      game: {
        id: crypto.randomUUID(),
        white: { name: hostColor === 'white' ? name : guestName },
        black: { name: hostColor === 'black' ? name : guestName },
        you: hostColor,
        tc,
        moves: [],
        clocks: { white: ms, black: ms },
        clocksAt: performance.now(),
        running: null,
        result: null,
        reason: null,
        drawOfferBy: null,
        rematchBy: null,
        opponentConnected: true,
      },
    });
    startClock();
    sendStart();
    play('start');
  };

  const handle = (msg: Wire) => {
    const state = get();
    const g = state.game;
    switch (msg.t) {
      case 'hello':
        if (state.role === 'host') {
          if (g && !g.result) {
            // Guest came back: resync instead of starting over.
            set({ game: { ...g, opponentConnected: true } });
            sendStart();
          } else newHostGame(msg.name || 'Invité', Math.random() < 0.5 ? 'white' : 'black');
        }
        return;
      case 'start': {
        const you = opposite(msg.hostColor);
        const isNew = g?.id !== msg.id;
        set({
          status: 'connected',
          game: {
            id: msg.id,
            white: { name: msg.white },
            black: { name: msg.black },
            you,
            tc: msg.tc,
            moves: buildLine(START_FEN, msg.moves),
            clocks: msg.clocks,
            clocksAt: performance.now(),
            running: !msg.result && msg.tc.initial > 0 && msg.moves.length >= 2 ? turnOf(buildLine(START_FEN, msg.moves)) : null,
            result: msg.result,
            reason: msg.reason,
            drawOfferBy: null,
            rematchBy: null,
            opponentConnected: true,
          },
        });
        startClock();
        if (isNew) play('start');
        return;
      }
      case 'move': {
        if (!g || g.result) return;
        if (msg.ply < g.moves.length) return; // already applied
        if (msg.ply !== g.moves.length || turnOf(g.moves) === g.you || !applyLocal(msg.uci, opposite(g.you), msg.remaining)) {
          // Desync: the host resends the truth, the guest asks for it.
          if (state.role === 'host') sendStart();
          else send({ t: 'hello', name: myName() });
        }
        return;
      }
      case 'end':
        finish(msg.result, msg.reason, false);
        return;
      case 'draw-offer':
        if (g && !g.result) {
          set({ game: { ...g, drawOfferBy: opposite(g.you) } });
          play('notify');
        }
        return;
      case 'draw-answer':
        if (!g || g.result) return;
        if (msg.accept) finish('1/2-1/2', 'agreement', false);
        else {
          set({ game: { ...g, drawOfferBy: null } });
          notice('Nulle refusée');
        }
        return;
      case 'rematch':
        if (!g) return;
        if (g.rematchBy === g.you && state.role === 'host') {
          newHostGame(g.you === 'white' ? g.black.name : g.white.name, opposite(g.you));
        } else {
          set({ game: { ...g, rematchBy: opposite(g.you) } });
          play('notify');
        }
        return;
      case 'emote':
        if (g) set({ emote: { by: opposite(g.you), emote: msg.emote, at: Date.now() } });
        return;
      case 'ping':
        send({ t: 'pong', at: msg.at });
        return;
      case 'pong':
        set({ latency: Math.round(performance.now() - msg.at) });
        return;
    }
  };

  const onConnectionLost = () => {
    const g = get().game;
    if (pingTimer) clearInterval(pingTimer);
    if (!g || g.result) {
      if (!g) set({ status: get().role === 'host' ? 'waiting' : 'error', error: get().role === 'guest' ? 'Connexion perdue' : null });
      return;
    }
    set({ game: { ...g, opponentConnected: false } });
    if (abandonTimer) clearTimeout(abandonTimer);
    abandonTimer = setTimeout(() => {
      const cur = get().game;
      if (cur && !cur.result && !cur.opponentConnected) finish(cur.you === 'white' ? '1-0' : '0-1', 'abandon', false);
    }, ABANDON_MS);
    if (get().role === 'guest') scheduleReconnect();
  };

  const attach = (c: DataConnection) => {
    conn?.close();
    conn = c;
    c.on('data', (data) => {
      if (data && typeof data === 'object' && 't' in data) handle(data as Wire);
    });
    c.on('close', () => {
      if (conn === c) {
        conn = null;
        onConnectionLost();
      }
    });
    c.on('error', () => undefined);
    const ready = () => {
      if (abandonTimer) clearTimeout(abandonTimer);
      set({ status: 'connected', error: null });
      const g = get().game;
      if (g) set({ game: { ...g, opponentConnected: true } });
      if (get().role === 'guest') send({ t: 'hello', name: myName() });
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => send({ t: 'ping', at: performance.now() }), 5000);
      send({ t: 'ping', at: performance.now() });
    };
    if (c.open) ready();
    else c.once('open', ready);
  };

  const connectToHost = () => {
    const code = get().code;
    if (!peer || !code) return;
    attach(peer.connect(ID_PREFIX + code, { reliable: true }));
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      const g = get().game;
      if (!g || g.result || g.opponentConnected || get().role !== 'guest') return;
      connectToHost();
      scheduleReconnect();
    }, 3000);
  };

  const teardown = () => {
    if (pingTimer) clearInterval(pingTimer);
    if (abandonTimer) clearTimeout(abandonTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    stopClock();
    conn?.close();
    conn = null;
    peer?.destroy();
    peer = null;
  };

  return {
    status: 'idle',
    role: null,
    code: null,
    tc: null,
    error: null,
    game: null,
    emote: null,
    notice: null,
    latency: null,

    host: async (tc) => {
      teardown();
      set({ status: 'opening', role: 'host', tc, error: null, game: null });
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = randomCode();
        try {
          peer = await createPeer(ID_PREFIX + code);
        } catch (err) {
          if ((err as { type?: string }).type === 'unavailable-id') continue;
          set({ status: 'error', error: 'Service de mise en relation injoignable. Vérifie ta connexion.' });
          return;
        }
        set({ status: 'waiting', code });
        peer.on('connection', (c) => attach(c));
        peer.on('disconnected', () => peer?.reconnect());
        return;
      }
      set({ status: 'error', error: 'Impossible de réserver un code, réessaie.' });
    },

    join: async (raw) => {
      const code = raw.trim().toUpperCase();
      if (code.length < 4) return;
      teardown();
      set({ status: 'connecting', role: 'guest', code, error: null, game: null });
      try {
        peer = await createPeer();
      } catch {
        set({ status: 'error', error: 'Service de mise en relation injoignable. Vérifie ta connexion.' });
        return;
      }
      peer.on('error', (err) => {
        if ((err as { type?: string }).type === 'peer-unavailable' && !get().game) {
          set({ status: 'error', error: `Aucune partie ouverte avec le code ${code}.` });
        }
      });
      peer.on('disconnected', () => peer?.reconnect());
      connectToHost();
    },

    cancel: () => {
      teardown();
      set({ status: 'idle', role: null, code: null, error: null, game: null });
    },

    move: (uci) => {
      const g = get().game;
      if (!g || g.result || turnOf(g.moves) !== g.you) return;
      const ply = g.moves.length;
      if (!applyLocal(uci, g.you)) return;
      const after = get().game!;
      send({ t: 'move', uci: after.moves[ply].uci, ply, remaining: after.clocks[g.you] });
    },

    resign: () => {
      const g = get().game;
      if (g) finish(g.you === 'white' ? '0-1' : '1-0', 'resign', true);
    },

    offerDraw: () => {
      const g = get().game;
      if (!g || g.result) return;
      if (g.drawOfferBy && g.drawOfferBy !== g.you) {
        get().answerDraw(true);
        return;
      }
      set({ game: { ...g, drawOfferBy: g.you } });
      send({ t: 'draw-offer' });
      notice('Proposition de nulle envoyée');
    },

    answerDraw: (accept) => {
      const g = get().game;
      if (!g || g.result) return;
      send({ t: 'draw-answer', accept });
      if (accept) finish('1/2-1/2', 'agreement', false);
      else set({ game: { ...g, drawOfferBy: null } });
    },

    rematch: () => {
      const g = get().game;
      if (!g || !g.result) return;
      if (g.rematchBy && g.rematchBy !== g.you && get().role === 'host') {
        // Both want it: the host starts the new game with colors swapped.
        send({ t: 'rematch' });
        newHostGame(g.you === 'white' ? g.black.name : g.white.name, opposite(g.you));
        return;
      }
      set({ game: { ...g, rematchBy: g.you } });
      send({ t: 'rematch' });
    },

    sendEmote: (emote) => {
      const g = get().game;
      if (!g) return;
      send({ t: 'emote', emote });
      set({ emote: { by: g.you, emote, at: Date.now() } });
    },

    leaveGame: () => {
      teardown();
      set({ status: 'idle', role: null, code: null, game: null, error: null });
    },
  };
});

/** Live clocks for an online game, extrapolated from the last update. */
export function liveClocks(game: OnlineGameState): { white: number; black: number } {
  const clocks = { ...game.clocks };
  if (game.running && !game.result) clocks[game.running] = clocks[game.running] - (performance.now() - game.clocksAt);
  return clocks;
}

export function inviteLink(code: string) {
  return `${location.origin}${location.pathname}#/play/online/${code}`;
}
