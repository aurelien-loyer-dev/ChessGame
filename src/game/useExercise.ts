import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color } from '../lib/types';
import type { Arrow, Mark } from '../components/board/Board';
import { parseUci, sideToMove, type PieceSymbol, type Square } from '../lib/chess';
import { play, playMoveSound } from '../lib/sound';

export type Feedback = { tone: 'good' | 'bad' | 'info'; text: string } | null;

export interface ExerciseSpec {
  fen: string;
  /** UCI line alternating the learner's moves and the scripted replies. */
  script: string[];
  /** The scripted side moves first (puzzles start with the opponent's move). */
  opponentFirst?: boolean;
  anyMate?: boolean;
  alternatives?: string[];
  successText?: string;
  onSolved?: (cleanly: boolean) => void;
  onMiss?: () => void;
}

/**
 * Drives a scripted board: validates the learner's moves against a solution,
 * plays the replies, and exposes hints and visual feedback.
 */
export function useExercise(spec: ExerciseSpec | null) {
  const [fen, setFen] = useState(spec?.fen ?? '');
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [solved, setSolved] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [misses, setMisses] = useState(0);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const apply = (from: string, uci: string) => {
    const c = new Chess(from);
    const m = c.move(parseUci(uci));
    playMoveSound(m.san);
    return { fen: c.fen(), from: m.from as Square, to: m.to as Square, mate: c.isCheckmate() };
  };

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!spec) return;
    setFen(spec.fen);
    setLastMove(null);
    setCursor(0);
    setFeedback(null);
    setSolved(false);
    setMarks([]);
    setArrows([]);
    setMisses(0);
    if (spec.opponentFirst && spec.script.length) {
      setBusy(true);
      later(() => {
        const r = apply(spec.fen, spec.script[0]);
        setFen(r.fen);
        setLastMove([r.from, r.to]);
        setCursor(1);
        setBusy(false);
      }, 700);
    }
  };

  // Restart whenever the exercise itself changes.
  const specKey = spec ? `${spec.fen}|${spec.script.join(',')}` : '';
  useEffect(() => {
    start();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  const learner: Color | null = useMemo(() => {
    if (!spec) return null;
    const first = sideToMove(spec.fen);
    return spec.opponentFirst ? (first === 'white' ? 'black' : 'white') : first;
  }, [spec]);

  const finish = () => {
    setSolved(true);
    play('success');
    setFeedback({ tone: 'good', text: spec?.successText ?? 'Bien joué !' });
    spec?.onSolved?.(misses === 0);
  };

  const onMove = (from: Square, to: Square, promo?: PieceSymbol) => {
    if (!spec || solved || busy) return;
    const expected = spec.script[cursor];
    let uci = from + to + (promo ?? '');
    if (!promo && expected?.length === 5 && expected.slice(0, 4) === uci) uci = expected;
    const result = apply(fen, uci);
    const alternatives = cursor === (spec.opponentFirst ? 1 : 0) ? spec.alternatives ?? [] : [];
    // Any mate is always accepted: a mate in fewer moves is never wrong.
    const correct = uci === expected || alternatives.includes(uci) || result.mate;

    if (!correct) {
      play('error');
      setMisses((n) => n + 1);
      spec.onMiss?.();
      setMarks([{ square: to, tone: 'bad' }]);
      setFeedback({ tone: 'bad', text: misses >= 1 ? 'Toujours pas. L’indice peut t’aider.' : 'Ce n’est pas le bon coup. Réessaie.' });
      const prevFen = fen;
      const prevLast = lastMove;
      setFen(result.fen);
      setLastMove([from, to]);
      setBusy(true);
      later(() => {
        setFen(prevFen);
        setLastMove(prevLast);
        setMarks([]);
        setBusy(false);
      }, 650);
      return;
    }

    setFen(result.fen);
    setLastMove([from, to]);
    setMarks([{ square: to, tone: 'good' }]);
    setArrows([]);
    const next = cursor + 1;
    if (next >= spec.script.length || result.mate || alternatives.includes(uci)) {
      finish();
      return;
    }
    setFeedback({ tone: 'good', text: 'Exact. Continue…' });
    setBusy(true);
    later(() => {
      const reply = apply(result.fen, spec.script[next]);
      setFen(reply.fen);
      setLastMove([reply.from, reply.to]);
      setMarks([]);
      setCursor(next + 1);
      setBusy(false);
      if (next + 1 >= spec.script.length) finish();
      else setFeedback({ tone: 'info', text: 'À toi de jouer.' });
    }, 550);
  };

  const hint = () => {
    if (!spec || solved) return;
    const expected = spec.script[cursor];
    if (!expected) return;
    // First hint: the piece. Second hint: the full move.
    if (misses >= 2 || marks.some((m) => m.tone === 'hint')) {
      setArrows([{ from: expected.slice(0, 2) as Square, to: expected.slice(2, 4) as Square, tone: 'hint' }]);
    } else setMarks([{ square: expected.slice(0, 2) as Square, tone: 'hint' }]);
    setMisses((n) => n + 1);
    spec.onMiss?.();
  };

  /** Plays out the rest of the solution automatically. */
  const reveal = () => {
    if (!spec || solved) return;
    let f = fen;
    let i = cursor;
    let delay = 0;
    setBusy(true);
    while (i < spec.script.length) {
      const uci = spec.script[i];
      const at = f;
      later(() => {
        const r = apply(at, uci);
        setFen(r.fen);
        setLastMove([r.from, r.to]);
      }, delay);
      const c = new Chess(at);
      c.move(parseUci(uci));
      f = c.fen();
      delay += 600;
      i++;
    }
    later(() => {
      setBusy(false);
      setSolved(true);
      setFeedback({ tone: 'info', text: 'Voici la solution.' });
    }, delay);
    spec.onMiss?.();
  };

  return { fen, lastMove, feedback, setFeedback, solved, marks, arrows, cursor, learner, busy, misses, onMove, hint, reveal, restart: start };
}
