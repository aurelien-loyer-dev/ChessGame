import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Color } from '@chess/shared';

export type { Square, PieceSymbol, Move };
export type Dests = Map<Square, Square[]>;

export const FILES = 'abcdefgh';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function toColor(c: 'w' | 'b'): Color {
  return c === 'w' ? 'white' : 'black';
}

export function opposite(c: Color): Color {
  return c === 'white' ? 'black' : 'white';
}

export function legalDests(chess: Chess): Dests {
  const dests: Dests = new Map();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from);
    if (list) {
      if (!list.includes(m.to)) list.push(m.to);
    } else dests.set(m.from, [m.to]);
  }
  return dests;
}

export function uciOf(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? '');
}

export function parseUci(uci: string): { from: Square; to: Square; promotion?: PieceSymbol } {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: (uci[4] as PieceSymbol) || undefined,
  };
}

/** Square of the king of the side to move if it is in check. */
export function checkSquare(chess: Chess): Square | null {
  if (!chess.inCheck()) return null;
  const turn = chess.turn();
  for (const row of chess.board()) {
    for (const sq of row) if (sq && sq.type === 'k' && sq.color === turn) return sq.square;
  }
  return null;
}

/** Pieces captured by each side, derived from material on the board. */
export function capturedPieces(fen: string) {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const count = { w: { ...start }, b: { ...start } } as Record<'w' | 'b', Record<string, number>>;
  const placement = fen.split(' ')[0];
  for (const ch of placement) {
    const lower = ch.toLowerCase();
    if (!(lower in start)) continue;
    const side = ch === lower ? 'b' : 'w';
    count[side][lower]--;
  }
  const order: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
  // Pieces missing from Black were captured by White, and vice versa.
  const byWhite: PieceSymbol[] = [];
  const byBlack: PieceSymbol[] = [];
  for (const t of order) {
    for (let i = 0; i < Math.max(0, count.b[t]); i++) byWhite.push(t);
    for (let i = 0; i < Math.max(0, count.w[t]); i++) byBlack.push(t);
  }
  const value = (list: PieceSymbol[]) => list.reduce((s, t) => s + PIECE_VALUE[t], 0);
  return { byWhite, byBlack, diff: value(byWhite) - value(byBlack) };
}

export function squareToCoords(sq: Square): { file: number; rank: number } {
  return { file: sq.charCodeAt(0) - 97, rank: Number(sq[1]) - 1 };
}

export function coordsToSquare(file: number, rank: number): Square {
  return `${FILES[file]}${rank + 1}` as Square;
}

export function isPromotion(chess: Chess, from: Square, to: Square): boolean {
  const piece = chess.get(from);
  if (!piece || piece.type !== 'p') return false;
  return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
}

/** Replays UCI moves from a FEN, returning the SAN list (stops at the first illegal move). */
export function uciToSan(fen: string, ucis: string[]): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const u of ucis) {
    try {
      out.push(chess.move(parseUci(u)).san);
    } catch {
      break;
    }
  }
  return out;
}

export function sideToMove(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

/** Returns an error message for unusable positions (also rejects the side not to move being in check). */
export function validateFen(fen: string): string | null {
  try {
    const chess = new Chess(fen);
    const parts = chess.fen().split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-';
    if (new Chess(parts.join(' ')).inCheck()) return 'Le camp qui n’a pas le trait est en échec';
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'FEN invalide';
  }
}
