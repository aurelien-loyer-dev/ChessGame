import { Chess } from 'chess.js';
import type { EndReason, GameResult } from '../lib/types';
import { checkSquare, legalDests, parseUci, START_FEN, toColor, type Dests, type Square } from '../lib/chess';

export interface PlayedMove {
  san: string;
  uci: string;
  from: Square;
  to: Square;
  /** Position after the move. */
  fen: string;
  color: 'white' | 'black';
}

export interface Position {
  fen: string;
  lastMove: [Square, Square] | null;
  check: Square | null;
  dests: Dests;
}

/** Applies a UCI move to a move list, returning the new list or null if illegal. */
export function applyMove(startFen: string, moves: PlayedMove[], uci: string): PlayedMove[] | null {
  const chess = new Chess(moves.length ? moves[moves.length - 1].fen : startFen);
  try {
    const m = chess.move(parseUci(uci));
    return [
      ...moves,
      { san: m.san, uci: m.from + m.to + (m.promotion ?? ''), from: m.from, to: m.to, fen: chess.fen(), color: toColor(m.color) },
    ];
  } catch {
    return null;
  }
}

/** Builds the move list for a sequence of UCI moves (stops at the first illegal one). */
export function buildLine(startFen: string, ucis: string[]): PlayedMove[] {
  let moves: PlayedMove[] = [];
  for (const u of ucis) {
    const next = applyMove(startFen, moves, u);
    if (!next) break;
    moves = next;
  }
  return moves;
}

export function positionAt(startFen: string, moves: PlayedMove[], ply: number): Position {
  const fen = ply === 0 ? startFen : moves[ply - 1].fen;
  const chess = new Chess(fen);
  const last = ply > 0 ? moves[ply - 1] : null;
  return {
    fen,
    lastMove: last ? [last.from, last.to] : null,
    check: checkSquare(chess),
    dests: legalDests(chess),
  };
}

/** Detects the natural end of a game from the final position. */
export function detectEnd(startFen: string, moves: PlayedMove[]): { result: GameResult; reason: EndReason } | null {
  // Threefold detection needs the history, so replay the whole game.
  const chess = new Chess(startFen);
  for (const m of moves) chess.move(parseUci(m.uci));
  if (chess.isCheckmate()) return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'repetition' };
  if (chess.isDrawByFiftyMoves()) return { result: '1/2-1/2', reason: 'fifty-moves' };
  return null;
}

export function toPgn(opts: {
  startFen?: string;
  moves: string[];
  white: string;
  black: string;
  result?: GameResult | null;
  date?: number;
  event?: string;
}): string {
  const startFen = opts.startFen ?? START_FEN;
  const chess = new Chess(startFen);
  for (const u of opts.moves) {
    try {
      chess.move(parseUci(u));
    } catch {
      break;
    }
  }
  const d = new Date(opts.date ?? Date.now());
  chess.setHeader('Event', opts.event ?? 'EpiChess');
  chess.setHeader('Site', 'EpiChess');
  chess.setHeader('Date', `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
  chess.setHeader('White', opts.white);
  chess.setHeader('Black', opts.black);
  chess.setHeader('Result', opts.result ?? '*');
  if (startFen !== START_FEN) {
    chess.setHeader('SetUp', '1');
    chess.setHeader('FEN', startFen);
  }
  return chess.pgn();
}

export const REASON_LABEL: Record<EndReason, string> = {
  checkmate: 'Échec et mat',
  stalemate: 'Pat',
  resign: 'Abandon',
  timeout: 'Temps écoulé',
  agreement: 'Nulle par accord',
  abandon: 'Adversaire déconnecté',
  repetition: 'Triple répétition',
  insufficient: 'Matériel insuffisant',
  'fifty-moves': 'Règle des 50 coups',
};
