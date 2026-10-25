import { create } from 'zustand';
import type {
  ClientMessage,
  Color,
  Emote,
  EndReason,
  GameResult,
  PlayerProfile,
  PublicPlayer,
  ServerMessage,
  TimeControl,
} from '@chess/shared';
import { tcKey } from '@chess/shared';
import { play, playMoveSound } from '../lib/sound';
import { useProfile } from '../store/profile';
import { START_FEN } from '../lib/chess';
import { applyMove, buildLine, type PlayedMove } from '../game/line';

const TOKEN_KEY = 'arena.online.token';

function serverWsUrl(): string {
  const base = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (base) return base.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export function serverHttpUrl(path: string): string {
  const base = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim().replace(/\/$/, '');
  return (base ?? '') + path;
}

export interface OnlineGameState {
  id: string;
  white: PublicPlayer;
  black: PublicPlayer;
  you: Color;
  tc: TimeControl;
  moves: PlayedMove[];
  clocks: { white: number; black: number };
  /** Local performance.now() when `clocks` was measured. */
  clocksAt: number;
  running: Color | null;
  result: GameResult | null;
  reason: EndReason | null;
  ratings?: { white: { before: number; after: number }; black: { before: number; after: number } };
  drawOfferBy: Color | null;
  rematchBy: Color | null;
  opponentConnected: boolean;
}

interface OnlineState {
  status: 'idle' | 'connecting' | 'online' | 'offline';
  profile: PlayerProfile | null;
  lobby: { online: number; playing: number; queued: number };
  queue: { tc: TimeControl; since: number } | null;
  room: { code: string; tc: TimeControl } | null;
  game: OnlineGameState | null;
  emote: { by: Color; emote: Emote; at: number } | null;
  notice: { text: string; at: number } | null;
  latency: number | null;

  connect: () => void;
  disconnect: () => void;
  rename: (name: string) => void;
  findGame: (tc: TimeControl) => void;
  cancelQueue: () => void;
  createRoom: (tc: TimeControl) => void;
  joinRoom: (code: string) => void;
  cancelRoom: () => void;
  move: (uci: string) => void;
  resign: () => void;
  offerDraw: () => void;
  answerDraw: (accept: boolean) => void;
  rematch: () => void;
  sendEmote: (emote: Emote) => void;
  leaveGame: () => void;
}

let socket: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let wanted = false;
const recorded = new Set<string>();

function send(msg: ClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

export const useOnline = create<OnlineState>()((set, get) => {
  const notice = (text: string) => set({ notice: { text, at: Date.now() } });

  const handle = (msg: ServerMessage) => {
    const state = get();
    switch (msg.t) {
      case 'welcome':
        try {
          localStorage.setItem(TOKEN_KEY, msg.token);
        } catch {
          /* storage unavailable: the session just won't survive a reload */
        }
        set({ status: 'online', profile: msg.profile });
        retry = 0;
        return;
      case 'profile':
        set({ profile: msg.profile });
        return;
      case 'lobby':
        set({ lobby: { online: msg.online, playing: msg.playing, queued: msg.queued } });
        return;
      case 'queued':
        set({ queue: { tc: msg.tc, since: Date.now() } });
        return;
      case 'queue-left':
        set({ queue: null });
        return;
      case 'room':
        set({ room: { code: msg.code, tc: msg.tc } });
        return;
      case 'room-closed':
        set({ room: null });
        return;
      case 'game': {
        const g = msg.game;
        const isNew = state.game?.id !== g.id;
        set({
          queue: null,
          room: null,
          game: {
            id: g.id,
            white: g.white,
            black: g.black,
            you: msg.you,
            tc: g.tc,
            moves: buildLine(START_FEN, g.moves),
            clocks: g.clocks,
            clocksAt: performance.now(),
            running: g.running,
            result: g.result,
            reason: g.reason,
            drawOfferBy: g.drawOfferBy,
            rematchBy: null,
            opponentConnected: true,
          },
        });
        if (isNew) play('start');
        return;
      }
      case 'moved': {
        const game = state.game;
        if (!game || game.id !== msg.gameId) return;
        let moves = game.moves;
        if (msg.ply === moves.length) {
          const next = applyMove(START_FEN, moves, msg.uci);
          if (!next) return;
          moves = next;
          playMoveSound(next[next.length - 1].san);
        } else if (moves[msg.ply]?.uci !== msg.uci) {
          // Out of sync: rebuild from what we know is authoritative.
          moves = buildLine(START_FEN, [...moves.slice(0, msg.ply).map((m) => m.uci), msg.uci]);
        }
        const turn: Color = moves.length % 2 === 0 ? 'white' : 'black';
        set({
          game: {
            ...game,
            moves,
            clocks: msg.clocks,
            clocksAt: performance.now(),
            running: moves.length >= 2 && game.tc.initial > 0 ? turn : null,
            drawOfferBy: null,
          },
        });
        return;
      }
      case 'ended': {
        const game = state.game;
        if (!game || game.id !== msg.gameId) return;
        const ended = { ...game, result: msg.result, reason: msg.reason, ratings: msg.ratings, clocks: msg.clocks, running: null, drawOfferBy: null };
        set({ game: ended });
        play('end');
        if (!recorded.has(game.id)) {
          recorded.add(game.id);
          useProfile.getState().recordGame({
            id: game.id,
            date: Date.now(),
            mode: 'online',
            white: game.white.name,
            black: game.black.name,
            whiteElo: game.white.rating,
            blackElo: game.black.rating,
            you: game.you,
            result: msg.result,
            reason: msg.reason,
            moves: game.moves.map((m) => m.uci),
            tc: tcKey(game.tc),
          });
        }
        return;
      }
      case 'draw-offer':
        if (state.game?.id === msg.gameId) {
          set({ game: { ...state.game, drawOfferBy: msg.by } });
          play('notify');
        }
        return;
      case 'draw-declined':
        if (state.game?.id === msg.gameId) {
          set({ game: { ...state.game, drawOfferBy: null } });
          notice('Nulle refusée');
        }
        return;
      case 'rematch-offer':
        if (state.game?.id === msg.gameId) {
          set({ game: { ...state.game, rematchBy: msg.by } });
          play('notify');
        }
        return;
      case 'opponent':
        if (state.game?.id === msg.gameId) set({ game: { ...state.game, opponentConnected: msg.connected } });
        return;
      case 'emote':
        if (state.game?.id === msg.gameId) set({ emote: { by: msg.by, emote: msg.emote, at: Date.now() } });
        return;
      case 'pong':
        set({ latency: Math.round(performance.now() - msg.at) });
        return;
      case 'error':
        notice(msg.message);
        play('error');
        return;
    }
  };

  const open = () => {
    if (socket && socket.readyState <= WebSocket.OPEN) return;
    set({ status: 'connecting' });
    let ws: WebSocket;
    try {
      ws = new WebSocket(serverWsUrl());
    } catch {
      set({ status: 'offline' });
      return;
    }
    socket = ws;
    ws.onopen = () => {
      let token: string | undefined;
      try {
        token = localStorage.getItem(TOKEN_KEY) ?? undefined;
      } catch {
        token = undefined;
      }
      send({ t: 'hello', name: useProfile.getState().name, token });
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => send({ t: 'ping', at: performance.now() }), 10_000);
      send({ t: 'ping', at: performance.now() });
    };
    ws.onmessage = (e) => {
      try {
        handle(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (e) => {
      if (socket === ws) socket = null;
      if (pingTimer) clearInterval(pingTimer);
      set({ status: 'offline', queue: null, room: null });
      if (e.code === 4000) {
        notice('Session ouverte dans un autre onglet');
        wanted = false;
        return;
      }
      if (wanted) {
        const delay = Math.min(10_000, 500 * 2 ** retry++);
        retryTimer = setTimeout(open, delay);
      }
    };
  };

  return {
    status: 'idle',
    profile: null,
    lobby: { online: 0, playing: 0, queued: 0 },
    queue: null,
    room: null,
    game: null,
    emote: null,
    notice: null,
    latency: null,

    connect: () => {
      wanted = true;
      if (retryTimer) clearTimeout(retryTimer);
      open();
    },
    disconnect: () => {
      wanted = false;
      socket?.close();
      socket = null;
      set({ status: 'idle' });
    },
    rename: (name) => send({ t: 'rename', name }),
    findGame: (tc) => send({ t: 'queue', tc }),
    cancelQueue: () => {
      send({ t: 'queue-cancel' });
      set({ queue: null });
    },
    createRoom: (tc) => send({ t: 'room-create', tc }),
    joinRoom: (code) => send({ t: 'room-join', code: code.trim().toUpperCase() }),
    cancelRoom: () => {
      send({ t: 'room-cancel' });
      set({ room: null });
    },
    move: (uci) => {
      const game = get().game;
      if (!game || game.result) return;
      const turn: Color = game.moves.length % 2 === 0 ? 'white' : 'black';
      if (turn !== game.you) return;
      const next = applyMove(START_FEN, game.moves, uci);
      if (!next) return;
      const ply = game.moves.length;
      // Optimistic update; the server echo confirms it and syncs the clocks.
      set({ game: { ...game, moves: next, drawOfferBy: null } });
      playMoveSound(next[next.length - 1].san);
      send({ t: 'move', gameId: game.id, uci: next[next.length - 1].uci, ply });
    },
    resign: () => {
      const g = get().game;
      if (g) send({ t: 'resign', gameId: g.id });
    },
    offerDraw: () => {
      const g = get().game;
      if (!g) return;
      send({ t: 'draw-offer', gameId: g.id });
      notice('Proposition de nulle envoyée');
    },
    answerDraw: (accept) => {
      const g = get().game;
      if (!g) return;
      send({ t: 'draw-answer', gameId: g.id, accept });
      set({ game: { ...g, drawOfferBy: null } });
    },
    rematch: () => {
      const g = get().game;
      if (!g) return;
      send({ t: 'rematch', gameId: g.id });
      set({ game: { ...g, rematchBy: g.you } });
    },
    sendEmote: (emote) => {
      const g = get().game;
      if (!g) return;
      send({ t: 'emote', gameId: g.id, emote });
      set({ emote: { by: g.you, emote, at: Date.now() } });
    },
    leaveGame: () => set({ game: null }),
  };
});

/** Live clocks for an online game, extrapolated from the last server sync. */
export function liveClocks(game: OnlineGameState): { white: number; black: number } {
  const clocks = { ...game.clocks };
  if (game.running && !game.result) {
    clocks[game.running] = Math.max(0, clocks[game.running] - (performance.now() - game.clocksAt));
  }
  return clocks;
}
