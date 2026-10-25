/**
 * Wire protocol shared by the web client and the realtime server.
 * Every message is a JSON object discriminated by its `t` field.
 */

export type Color = 'white' | 'black';

export interface TimeControl {
  /** Initial time per side in seconds (0 = unlimited). */
  initial: number;
  /** Increment per move in seconds. */
  increment: number;
}

export const TIME_CONTROLS: { id: string; label: string; family: string; tc: TimeControl }[] = [
  { id: '1+0', label: '1 + 0', family: 'Bullet', tc: { initial: 60, increment: 0 } },
  { id: '2+1', label: '2 + 1', family: 'Bullet', tc: { initial: 120, increment: 1 } },
  { id: '3+2', label: '3 + 2', family: 'Blitz', tc: { initial: 180, increment: 2 } },
  { id: '5+0', label: '5 + 0', family: 'Blitz', tc: { initial: 300, increment: 0 } },
  { id: '10+0', label: '10 + 0', family: 'Rapide', tc: { initial: 600, increment: 0 } },
  { id: '15+10', label: '15 + 10', family: 'Rapide', tc: { initial: 900, increment: 10 } },
  { id: '30+0', label: '30 + 0', family: 'Classique', tc: { initial: 1800, increment: 0 } },
  { id: 'inf', label: '∞', family: 'Libre', tc: { initial: 0, increment: 0 } },
];

export function tcKey(tc: TimeControl): string {
  return tc.initial === 0 ? 'inf' : `${tc.initial / 60}+${tc.increment}`;
}

export interface PublicPlayer {
  id: string;
  name: string;
  rating: number;
}

export interface PlayerProfile extends PublicPlayer {
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export type GameResult = '1-0' | '0-1' | '1/2-1/2';

export type EndReason =
  | 'checkmate'
  | 'stalemate'
  | 'resign'
  | 'timeout'
  | 'agreement'
  | 'abandon'
  | 'repetition'
  | 'insufficient'
  | 'fifty-moves';

export interface GameSnapshot {
  id: string;
  white: PublicPlayer;
  black: PublicPlayer;
  tc: TimeControl;
  /** Moves played so far, in UCI. */
  moves: string[];
  /** Remaining clock in ms, measured at `serverTime`. */
  clocks: { white: number; black: number };
  serverTime: number;
  /** Whose clock is running, or null before the first move / after the end. */
  running: Color | null;
  result: GameResult | null;
  reason: EndReason | null;
  drawOfferBy: Color | null;
}

export const EMOTES = ['👋', '🔥', '😮', '😅', '🤝', 'GG'] as const;
export type Emote = (typeof EMOTES)[number];

export type ClientMessage =
  | { t: 'hello'; name: string; token?: string }
  | { t: 'rename'; name: string }
  | { t: 'queue'; tc: TimeControl }
  | { t: 'queue-cancel' }
  | { t: 'room-create'; tc: TimeControl }
  | { t: 'room-join'; code: string }
  | { t: 'room-cancel' }
  | { t: 'move'; gameId: string; uci: string; ply: number }
  | { t: 'resign'; gameId: string }
  | { t: 'draw-offer'; gameId: string }
  | { t: 'draw-answer'; gameId: string; accept: boolean }
  | { t: 'rematch'; gameId: string }
  | { t: 'emote'; gameId: string; emote: Emote }
  | { t: 'ping'; at: number };

export type ServerMessage =
  | { t: 'welcome'; token: string; profile: PlayerProfile }
  | { t: 'profile'; profile: PlayerProfile }
  | { t: 'lobby'; online: number; playing: number; queued: number }
  | { t: 'queued'; tc: TimeControl; since: number }
  | { t: 'queue-left' }
  | { t: 'room'; code: string; tc: TimeControl }
  | { t: 'room-closed' }
  | { t: 'game'; game: GameSnapshot; you: Color }
  | {
      t: 'moved';
      gameId: string;
      uci: string;
      ply: number;
      clocks: { white: number; black: number };
      serverTime: number;
    }
  | {
      t: 'ended';
      gameId: string;
      result: GameResult;
      reason: EndReason;
      clocks: { white: number; black: number };
      ratings?: { white: { before: number; after: number }; black: { before: number; after: number } };
    }
  | { t: 'draw-offer'; gameId: string; by: Color }
  | { t: 'draw-declined'; gameId: string }
  | { t: 'rematch-offer'; gameId: string; by: Color }
  | { t: 'opponent'; gameId: string; connected: boolean }
  | { t: 'emote'; gameId: string; by: Color; emote: Emote }
  | { t: 'pong'; at: number; serverTime: number }
  | { t: 'error'; message: string };

export const NAME_MAX = 18;

export function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}_\- ]/gu, '').trim().slice(0, NAME_MAX);
}
