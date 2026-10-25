import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Eye, Flame, Lightbulb, Timer, Trophy, X, Zap } from 'lucide-react';
import { Chess } from 'chess.js';
import { navigate } from '../lib/router';
import { useProfile } from '../store/profile';
import { dailyPuzzle, nextPuzzle, rushSequence, THEME_LABEL, type Puzzle } from '../data/puzzles';
import { useExercise } from '../game/useExercise';
import { Board } from '../components/board/Board';
import { checkSquare, legalDests, sideToMove } from '../lib/chess';
import { play } from '../lib/sound';
import { formatClock } from '../components/Clock';
import './puzzles.css';

const MODES = [
  { id: '', label: 'Classé' },
  { id: 'daily', label: 'Du jour' },
  { id: 'rush', label: 'Rush' },
];

export function Puzzles({ mode = '' }: { mode?: string }) {
  const current = MODES.some((m) => m.id === mode) ? mode : '';
  return (
    <div className="puzzles-page">
      {current === 'rush' ? <Rush /> : <Rated key={current} daily={current === 'daily'} />}
    </div>
  );
}

function ModeTabs({ current }: { current: string }) {
  return (
    <div className="segmented" role="tablist">
      {MODES.map((m) => (
        <button key={m.id || 'rated'} aria-pressed={current === m.id} onClick={() => navigate(`puzzles${m.id ? `/${m.id}` : ''}`)}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

function PuzzleBoard({ ex, puzzle }: { ex: ReturnType<typeof useExercise>; puzzle: Puzzle }) {
  const chess = useMemo(() => new Chess(ex.fen || puzzle.fen), [ex.fen, puzzle.fen]);
  const interactive = !ex.solved && !ex.busy && ex.cursor % 2 === 1;
  return (
    <Board
      fen={ex.fen || puzzle.fen}
      orientation={ex.learner ?? 'white'}
      movable={interactive ? sideToMove(chess.fen()) : null}
      dests={interactive ? legalDests(chess) : undefined}
      lastMove={ex.lastMove}
      check={checkSquare(chess)}
      marks={ex.marks}
      arrows={ex.arrows}
      onMove={ex.onMove}
    />
  );
}

function Rated({ daily }: { daily: boolean }) {
  const profile = useProfile();
  const [puzzle, setPuzzle] = useState<Puzzle>(() => (daily ? dailyPuzzle() : nextPuzzle(profile.puzzleRating, profile.puzzlesSolved)));
  const [result, setResult] = useState<{ solved: boolean; delta: number } | null>(null);
  const failed = useRef(false);
  const alreadySolved = useMemo(() => profile.puzzlesSolved.includes(puzzle.id), [puzzle.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const spec = useMemo(
    () => ({
      fen: puzzle.fen,
      script: puzzle.moves,
      opponentFirst: true,
      successText: 'Bien joué !',
      onSolved: (clean: boolean) => {
        if (alreadySolved) {
          setResult({ solved: clean && !failed.current, delta: 0 });
          return;
        }
        if (!failed.current) {
          const r = profile.recordPuzzle(puzzle.id, puzzle.rating, true);
          setResult({ solved: true, delta: r.after - r.before });
        } else setResult((prev) => prev ?? { solved: false, delta: 0 });
      },
      onMiss: () => {
        if (failed.current || alreadySolved) return;
        failed.current = true;
        const r = profile.recordPuzzle(puzzle.id, puzzle.rating, false);
        setResult({ solved: false, delta: r.after - r.before });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzle],
  );
  const ex = useExercise(spec);

  const next = () => {
    failed.current = false;
    setResult(null);
    setPuzzle(nextPuzzle(useProfile.getState().puzzleRating, useProfile.getState().puzzlesSolved, puzzle.id));
    if (daily) navigate('puzzles');
  };

  const showThemes = ex.solved || !!result;
  const toMove = ex.learner === 'white' ? 'Les Blancs' : 'Les Noirs';

  return (
    <div className="puzzle-layout">
      <div className="puzzle-board">
        <PuzzleBoard ex={ex} puzzle={puzzle} />
      </div>
      <aside className="puzzle-side panel">
        <div className="puzzle-top">
          <ModeTabs current={daily ? 'daily' : ''} />
        </div>
        <div className="puzzle-rating">
          <div>
            <span className="eyebrow">Ton classement</span>
            <b className="mono">
              {profile.puzzleRating}
              <AnimatePresence>
                {result && result.delta !== 0 && (
                  <motion.span
                    key={result.delta}
                    className={result.delta > 0 ? 'up' : 'down'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {result.delta > 0 ? `+${result.delta}` : result.delta}
                  </motion.span>
                )}
              </AnimatePresence>
            </b>
          </div>
          <div className="streak" title="Série en cours">
            <Flame /> <span className="mono">{profile.puzzleStreak}</span>
          </div>
        </div>

        <div className="puzzle-card-info">
          <span className="eyebrow">{daily ? 'Puzzle du jour' : 'Puzzle'} · {puzzle.rating}</span>
          <h2>{ex.solved ? (result?.solved === false ? 'Résolu avec aide' : 'Réussi') : `${toMove} jouent`}</h2>
          <p className="dim">
            {ex.solved
              ? 'Rejoue la position dans l’analyse si tu veux comprendre chaque variante.'
              : puzzle.themes.some((t) => t.startsWith('mate'))
                ? 'Trouve la suite qui mène au mat.'
                : 'Trouve le meilleur coup. L’adversaire vient de commettre une erreur.'}
          </p>
          <div className="theme-row">
            {showThemes ? (
              puzzle.themes.map((t) => (
                <span key={t} className="chip accent">
                  {THEME_LABEL[t] ?? t}
                </span>
              ))
            ) : (
              <span className="chip">Thème masqué</span>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {ex.feedback && (
            <motion.p key={ex.feedback.text} className={`feedback ${ex.feedback.tone}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {ex.feedback.text}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="controls-row puzzle-actions">
          {!ex.solved ? (
            <>
              <button className="btn grow" onClick={ex.hint} disabled={ex.busy}>
                <Lightbulb /> Indice
              </button>
              <button className="btn grow" onClick={ex.reveal} disabled={ex.busy}>
                <Eye /> Solution
              </button>
            </>
          ) : (
            <button className="btn primary grow" onClick={next}>
              Puzzle suivant <ArrowRight />
            </button>
          )}
        </div>

        <div className="puzzle-stats">
          <div>
            <span className="eyebrow">Résolus</span>
            <b className="mono">{profile.puzzlesSolved.length}</b>
          </div>
          <div>
            <span className="eyebrow">Série max</span>
            <b className="mono">{profile.bestPuzzleStreak}</b>
          </div>
          <div>
            <span className="eyebrow">Record rush</span>
            <b className="mono">{profile.rushBest}</b>
          </div>
        </div>
      </aside>
    </div>
  );
}

const RUSH_MS = 3 * 60_000;
const MAX_STRIKES = 3;

function Rush() {
  const { rushBest, setRushBest } = useProfile();
  const [phase, setPhase] = useState<'intro' | 'play' | 'over'>('intro');
  const [sequence, setSequence] = useState<Puzzle[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [history, setHistory] = useState<boolean[]>([]);
  const [endsAt, setEndsAt] = useState(0);
  const [, tick] = useState(0);
  const puzzle = sequence[index];

  const begin = () => {
    setSequence(rushSequence());
    setIndex(0);
    setScore(0);
    setStrikes(0);
    setHistory([]);
    setEndsAt(Date.now() + RUSH_MS);
    setPhase('play');
    play('start');
  };

  const end = (finalScore: number) => {
    setPhase('over');
    setRushBest(finalScore);
    play('end');
  };

  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      if (Date.now() >= endsAt) end(score);
      tick((n) => n + 1);
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, endsAt, score]);

  const advance = (ok: boolean) => {
    const nextScore = ok ? score + 1 : score;
    const nextStrikes = ok ? strikes : strikes + 1;
    setHistory((h) => [...h, ok]);
    setScore(nextScore);
    setStrikes(nextStrikes);
    if (nextStrikes >= MAX_STRIKES || index + 1 >= sequence.length) end(nextScore);
    else setIndex((i) => i + 1);
  };

  const spec = useMemo(() => {
    if (!puzzle || phase !== 'play') return null;
    // Each puzzle resolves exactly once, whichever comes first.
    let handled = false;
    const resolve = (ok: boolean, delay: number) => {
      if (handled) return;
      handled = true;
      setTimeout(() => advance(ok), delay);
    };
    return {
      fen: puzzle.fen,
      script: puzzle.moves,
      opponentFirst: true,
      onSolved: () => resolve(true, 350),
      onMiss: () => resolve(false, 700),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, phase]);
  const ex = useExercise(spec);
  const left = Math.max(0, endsAt - Date.now());

  return (
    <div className="puzzle-layout">
      <div className="puzzle-board">
        {puzzle && phase === 'play' ? (
          <PuzzleBoard ex={ex} puzzle={puzzle} />
        ) : (
          <div className="rush-cover panel">
            <Zap className="rush-icon" />
            <h2>Puzzle Rush</h2>
            <p className="dim">3 minutes, difficulté croissante. Trois erreurs et c’est fini.</p>
          </div>
        )}
      </div>
      <aside className="puzzle-side panel">
        <div className="puzzle-top">
          <ModeTabs current="rush" />
        </div>
        {phase === 'intro' && (
          <div className="rush-intro">
            <p className="dim">Enchaîne un maximum de puzzles avant la fin du chrono. Chaque erreur coûte une vie.</p>
            <p>
              Record : <b className="mono brass">{rushBest}</b>
            </p>
            <button className="btn primary lg block" onClick={begin}>
              <Zap /> Lancer le rush
            </button>
          </div>
        )}
        {phase === 'play' && (
          <>
            <div className="rush-hud">
              <div className={`rush-timer mono ${left < 20_000 ? 'low' : ''}`}>
                <Timer /> {formatClock(left)}
              </div>
              <div className="rush-score mono">{score}</div>
              <div className="rush-lives" aria-label={`${MAX_STRIKES - strikes} vies`}>
                {Array.from({ length: MAX_STRIKES }, (_, i) => (
                  <X key={i} className={i < strikes ? 'lost' : ''} />
                ))}
              </div>
            </div>
            <p className="dim">{ex.learner === 'white' ? 'Les Blancs' : 'Les Noirs'} jouent · {puzzle?.rating}</p>
            <div className="rush-history">
              {history.map((ok, i) => (
                <i key={i} className={ok ? 'ok' : 'ko'} />
              ))}
            </div>
            <button className="btn ghost" onClick={() => end(score)}>
              Arrêter
            </button>
          </>
        )}
        {phase === 'over' && (
          <motion.div className="rush-over" initial={{ opacity: 0, rotateX: -30 }} animate={{ opacity: 1, rotateX: 0 }}>
            <Trophy className="brass rush-icon" />
            <h2>
              <span className="mono">{score}</span> puzzles
            </h2>
            <p className="dim">{score >= rushBest && score > 0 ? 'Nouveau record !' : `Record : ${rushBest}`}</p>
            <div className="rush-history">
              {history.map((ok, i) => (
                <i key={i} className={ok ? 'ok' : 'ko'} />
              ))}
            </div>
            <button className="btn primary block" onClick={begin}>
              <Zap /> Rejouer
            </button>
          </motion.div>
        )}
      </aside>
    </div>
  );
}
