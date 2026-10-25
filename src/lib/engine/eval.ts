import type { EngineLine } from './stockfish';

/** Converts an engine score to centipawns (White POV), mapping mates to large values. */
export function lineToCp(line: Pick<EngineLine, 'cp' | 'mate'>): number {
  if (line.mate !== undefined) {
    if (line.mate === 0) return 0;
    return Math.sign(line.mate) * (10_000 - Math.abs(line.mate) * 10);
  }
  return line.cp ?? 0;
}

/** Lichess win-probability model: White's winning chances in [0, 100]. */
export function winChance(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

export function formatScore(line: Pick<EngineLine, 'cp' | 'mate'> | null | undefined): string {
  if (!line) return '0.0';
  if (line.mate !== undefined) return line.mate === 0 ? '#' : `${line.mate > 0 ? '' : '-'}M${Math.abs(line.mate)}`;
  const v = (line.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

export type MoveClass = 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'book';

export const MOVE_CLASS_META: Record<MoveClass, { label: string; symbol: string; tone: string }> = {
  book: { label: 'Théorie', symbol: 'th', tone: 'book' },
  best: { label: 'Meilleur coup', symbol: '★', tone: 'best' },
  excellent: { label: 'Excellent', symbol: '!', tone: 'excellent' },
  good: { label: 'Bon', symbol: '✓', tone: 'good' },
  inaccuracy: { label: 'Imprécision', symbol: '?!', tone: 'inaccuracy' },
  mistake: { label: 'Erreur', symbol: '?', tone: 'mistake' },
  blunder: { label: 'Gaffe', symbol: '??', tone: 'blunder' },
};

/**
 * Classifies a move from the mover's loss of winning chances
 * (thresholds close to the ones used by Lichess).
 */
export function classifyMove(winBefore: number, winAfter: number, mover: 'white' | 'black', isBest: boolean): MoveClass {
  const loss = mover === 'white' ? winBefore - winAfter : winAfter - winBefore;
  if (isBest || loss <= 1) return 'best';
  if (loss < 4) return 'excellent';
  if (loss < 10) return 'good';
  if (loss < 20) return 'inaccuracy';
  if (loss < 30) return 'mistake';
  return 'blunder';
}

/** Lichess per-move accuracy from the win% lost by the mover. */
export function moveAccuracy(winLoss: number): number {
  const acc = 103.1668 * Math.exp(-0.04354 * Math.max(0, winLoss)) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}
