/** Game-wide types and time controls. */

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

export const NAME_MAX = 18;

export function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}_\- ]/gu, '').trim().slice(0, NAME_MAX);
}

export const EMOTES = ['👋', '🔥', '😮', '😅', '🤝', 'GG'] as const;
export type Emote = (typeof EMOTES)[number];
