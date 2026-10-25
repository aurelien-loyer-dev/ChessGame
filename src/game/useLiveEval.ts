import { useEffect, useState } from 'react';
import { getAnalysisEngine, type EngineLine } from '../lib/engine/stockfish';

/** Streams Stockfish lines for a position while `enabled`; restarts when the FEN changes. */
export function useLiveEval(fen: string, enabled: boolean, opts: { depth?: number; multipv?: number } = {}) {
  const [lines, setLines] = useState<EngineLine[]>([]);
  const [depth, setDepth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const targetDepth = opts.depth ?? 18;
  const multipv = opts.multipv ?? 1;

  useEffect(() => {
    if (!enabled) {
      setLines([]);
      setDepth(0);
      return;
    }
    const ctrl = new AbortController();
    setLines([]);
    setDepth(0);
    getAnalysisEngine()
      .search(fen, {
        depth: targetDepth,
        multipv,
        signal: ctrl.signal,
        onInfo: (l) => {
          if (ctrl.signal.aborted) return;
          setLines(l);
          setDepth(l[0]?.depth ?? 0);
        },
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Moteur indisponible');
      });
    return () => ctrl.abort();
  }, [fen, enabled, targetDepth, multipv]);

  return { lines, best: lines[0] ?? null, depth, error };
}
