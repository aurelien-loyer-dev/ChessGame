import type { PlayedMove } from './line';
import { getAnalysisEngine, type EngineLine } from '../lib/engine/stockfish';
import { classifyMove, lineToCp, moveAccuracy, winChance, type MoveClass } from '../lib/engine/eval';
import { isBookPosition } from '../data/openings';
import { Chess } from 'chess.js';

export interface ReviewResult {
  /** Engine evaluation of each position (index 0 = start position). */
  evals: Pick<EngineLine, 'cp' | 'mate'>[];
  /** Best move (UCI) in each position. */
  best: (string | null)[];
  classes: MoveClass[];
  accuracy: { white: number; black: number };
  counts: Record<'white' | 'black', Partial<Record<MoveClass, number>>>;
}

/** Evaluates every position of a game and classifies each move. */
export async function reviewGame(
  startFen: string,
  moves: PlayedMove[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
  depth = 13,
): Promise<ReviewResult | null> {
  const fens = [startFen, ...moves.map((m) => m.fen)];
  const engine = getAnalysisEngine();
  const evals: Pick<EngineLine, 'cp' | 'mate'>[] = [];
  const best: (string | null)[] = [];

  for (let i = 0; i < fens.length; i++) {
    if (signal.aborted) return null;
    const chess = new Chess(fens[i]);
    if (chess.isCheckmate()) {
      evals.push({ mate: 0, cp: chess.turn() === 'w' ? -10000 : 10000 });
      best.push(null);
    } else if (chess.isDraw() || chess.isStalemate()) {
      evals.push({ cp: 0 });
      best.push(null);
    } else {
      const res = await engine.search(fens[i], { depth, signal });
      const line = res.lines[0];
      evals.push(line ? { cp: line.cp, mate: line.mate } : { cp: 0 });
      best.push(res.bestmove);
    }
    onProgress(i + 1, fens.length);
  }

  const classes: MoveClass[] = [];
  const counts: ReviewResult['counts'] = { white: {}, black: {} };
  const acc: Record<'white' | 'black', number[]> = { white: [], black: [] };

  moves.forEach((m, i) => {
    const before = winChance(lineToCp(evals[i]));
    const after = winChance(lineToCp(evals[i + 1]));
    const loss = m.color === 'white' ? before - after : after - before;
    let cls: MoveClass;
    if (i < 20 && isBookPosition(m.fen)) cls = 'book';
    else cls = classifyMove(before, after, m.color, best[i] === m.uci);
    classes.push(cls);
    counts[m.color][cls] = (counts[m.color][cls] ?? 0) + 1;
    acc[m.color].push(moveAccuracy(loss));
  });

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 100);
  return { evals, best, classes, accuracy: { white: mean(acc.white), black: mean(acc.black) }, counts };
}
