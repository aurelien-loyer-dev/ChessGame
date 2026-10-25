import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  LayoutGrid,
  RefreshCw,
  SkipForward,
  Undo2,
} from 'lucide-react';
import { Chess } from 'chess.js';
import type { Color } from '../lib/types';
import { useProfile, type SavedGame } from '../store/profile';
import { applyMove, buildLine, positionAt, REASON_LABEL, toPgn, type PlayedMove } from '../game/line';
import { reviewGame, type ReviewResult } from '../game/review';
import { useLiveEval } from '../game/useLiveEval';
import { useBoardKeys } from '../game/useBoardKeys';
import { frSan, START_FEN, uciToSan, validateFen, type PieceSymbol, type Square as Sq } from '../lib/chess';
import { formatScore, lineToCp, MOVE_CLASS_META, type MoveClass } from '../lib/engine/eval';
import { detectOpening } from '../data/openings';
import { navigate } from '../lib/router';
import { Board, type Arrow } from '../components/board/Board';
import { EvalBar } from '../components/EvalBar';
import { EvalGraph } from '../components/EvalGraph';
import { MoveList } from '../components/MoveList';
import { HomeButton } from '../components/HomeButton';
import { toast } from '../components/Toasts';
import './analysis.css';

interface Source {
  startFen: string;
  moves: PlayedMove[];
  white: string;
  black: string;
  result?: SavedGame['result'];
  reason?: SavedGame['reason'];
  date?: number;
  gameId?: string;
  you?: Color | null;
}

function fromSaved(g: SavedGame): Source {
  const startFen = g.startFen ?? START_FEN;
  return { startFen, moves: buildLine(startFen, g.moves), white: g.white, black: g.black, result: g.result, reason: g.reason, date: g.date, gameId: g.id, you: g.you };
}

const BAD: MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];

/**
 * Two screens in one: pick a game (or paste one), then read Stockfish's
 * verdict move by move in plain French. Engine details stay folded away.
 */
export function Analysis({ gameId }: { gameId?: string }) {
  const games = useProfile((s) => s.games);
  const saved = gameId ? games.find((g) => g.id === gameId) : undefined;
  const [source, setSource] = useState<Source | null>(() => (saved ? fromSaved(saved) : null));

  useEffect(() => {
    if (saved) setSource(fromSaved(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  return (
    <div className="container analysis-page">
      <nav className="page-nav">
        <HomeButton />
        {source && (
          <button
            className="btn ghost sm"
            onClick={() => {
              setSource(null);
              if (gameId) navigate('analysis');
            }}
          >
            <LayoutGrid /> Choisir une autre partie
          </button>
        )}
      </nav>
      {source ? <Workspace key={`${source.gameId ?? 'free'}-${source.moves.length}-${source.startFen}`} source={source} autoReview={!!source.moves.length} /> : <Picker onPick={setSource} />}
    </div>
  );
}

// ── Step 1: choose what to analyse ───────────────────────────────────────

function Picker({ onPick }: { onPick: (s: Source) => void }) {
  const games = useProfile((s) => s.games);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const parsed = parseInput(text);
    if (typeof parsed === 'string') setError(parsed);
    else onPick(parsed);
  };

  const outcome = (g: SavedGame) => {
    if (!g.you) return g.result;
    if (g.result === '1/2-1/2') return 'Nulle';
    return (g.result === '1-0') === (g.you === 'white') ? 'Victoire' : 'Défaite';
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Analyse</p>
          <h1>Comprendre une partie</h1>
          <p>Choisis une partie : Stockfish la rejoue, note chaque coup et t’explique où ça a basculé.</p>
        </div>
      </header>
      <div className="picker-grid">
        <section className="panel picker-games">
          <h2>Mes dernières parties</h2>
          {games.length === 0 ? (
            <p className="dim">Joue une partie contre l’IA, en local ou en ligne : elle apparaîtra ici.</p>
          ) : (
            <ul>
              {games.slice(0, 8).map((g) => (
                <li key={g.id}>
                  <button onClick={() => navigate(`analysis/${g.id}`)}>
                    <span className={`outcome ${outcome(g) === 'Victoire' ? 'win' : outcome(g) === 'Défaite' ? 'loss' : 'draw'}`}>{outcome(g)}</span>
                    <span className="pg-players">
                      {g.white} <span className="faint">vs</span> {g.black}
                    </span>
                    <span className="faint small">
                      {Math.ceil(g.moves.length / 2)} coups · {new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <ChevronRight />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel picker-paste">
          <h2>Coller une partie</h2>
          <p className="dim small">Une partie au format PGN (copiée depuis Lichess, Chess.com…) ou une position FEN.</p>
          <textarea
            id="analysis-import"
            className="input"
            rows={6}
            placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 …'}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="field-error">{error}</p>}
          <button className="btn primary" onClick={load} disabled={!text.trim()}>
            <FileUp /> Analyser
          </button>
          <div className="or-sep">
            <span>ou</span>
          </div>
          <button className="btn" onClick={() => onPick({ startFen: START_FEN, moves: [], white: 'Blancs', black: 'Noirs' })}>
            <LayoutGrid /> Plateau libre avec Stockfish
          </button>
        </section>
      </div>
    </>
  );
}

function parseInput(raw: string): Source | string {
  const text = raw.trim();
  if (!text) return 'Colle une partie ou une position.';
  if (!text.includes('[') && text.split('/').length === 8 && !text.includes('.')) {
    const err = validateFen(text);
    if (err) return `Position invalide : ${err}`;
    return { startFen: new Chess(text).fen(), moves: [], white: 'Blancs', black: 'Noirs' };
  }
  try {
    const chess = new Chess();
    chess.loadPgn(text);
    const headers = chess.getHeaders();
    const startFen = headers.FEN ?? START_FEN;
    const ucis = chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    if (!ucis.length) return 'Aucun coup trouvé dans ce texte.';
    const result = headers.Result as SavedGame['result'] | undefined;
    return {
      startFen,
      moves: buildLine(startFen, ucis),
      white: headers.White ?? 'Blancs',
      black: headers.Black ?? 'Noirs',
      result: result && result !== ('*' as string) ? result : undefined,
    };
  } catch {
    return 'Partie illisible. Vérifie que le texte est bien au format PGN.';
  }
}

// ── Step 2: the review ───────────────────────────────────────────────────

/** Plain-language verdict for the move that led to `ply`. */
function explain(review: ReviewResult, moves: PlayedMove[], startFen: string, ply: number) {
  const i = ply - 1;
  const move = moves[i];
  const cls = review.classes[i];
  const meta = MOVE_CLASS_META[cls];
  const num = `${Math.floor(i / 2) + 1}${move.color === 'white' ? '.' : '…'}`;
  const before = review.evals[i];
  const after = review.evals[i + 1];
  const sign = move.color === 'white' ? 1 : -1;
  const best = review.best[i];
  const bestSan = best ? frSan(uciToSan(i === 0 ? startFen : moves[i - 1].fen, [best])[0] ?? '') : null;

  let detail = '';
  if (BAD.includes(cls)) {
    const mateAgainst = after.mate !== undefined && Math.sign(after.mate) === -sign;
    const missedMate = before.mate !== undefined && Math.sign(before.mate) === sign && !(after.mate !== undefined && Math.sign(after.mate) === sign);
    if (mateAgainst) detail = `Ce coup laisse un mat en ${Math.abs(after.mate!)}.`;
    else if (missedMate) detail = `Il y avait un mat en ${Math.abs(before.mate!)}.`;
    else {
      const loss = Math.max(0, ((lineToCp(before) - lineToCp(after)) * sign) / 100);
      detail = loss >= 0.3 ? `Il coûte environ ${loss.toFixed(1).replace('.', ',')} point${loss >= 2 ? 's' : ''} d’avantage.` : 'Il laisse filer une partie de l’avantage.';
    }
  } else if (cls === 'book') detail = 'Coup connu de la théorie des ouvertures.';
  else if (cls === 'best') detail = 'C’est le coup que Stockfish aurait joué.';
  else detail = 'Rien à redire.';

  return { num, move, cls, meta, detail, bestSan, best, bad: BAD.includes(cls) };
}

function Workspace({ source, autoReview }: { source: Source; autoReview: boolean }) {
  const updateGame = useProfile((s) => s.updateGame);
  const [moves, setMoves] = useState(source.moves);
  const [ply, setPly] = useState(0);
  const [variation, setVariation] = useState<{ from: number; moves: PlayedMove[] } | null>(null);
  const [orientation, setOrientation] = useState<Color>(source.you === 'black' ? 'black' : 'white');
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [showBest, setShowBest] = useState(false);
  const free = !autoReview;
  const [engineOpen, setEngineOpen] = useState(free);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!autoReview) return;
    const c = new AbortController();
    ctrl.current = c;
    setProgress(0);
    reviewGame(source.startFen, source.moves, (done, total) => setProgress(done / total), c.signal)
      .then((res) => {
        if (!res || c.signal.aborted) return;
        setReview(res);
        if (source.gameId) updateGame(source.gameId, { accuracy: { white: Math.round(res.accuracy.white), black: Math.round(res.accuracy.black) } });
      })
      .catch(() => toast('Le moteur n’a pas pu analyser la partie', 'bad'))
      .finally(() => !c.signal.aborted && setProgress(null));
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mainPos = useMemo(() => positionAt(source.startFen, moves, ply), [source.startFen, moves, ply]);
  const varPos = useMemo(() => (variation ? positionAt(mainPos.fen, variation.moves, variation.moves.length) : null), [variation, mainPos.fen]);
  const verdict = review && ply > 0 && !variation ? explain(review, moves, source.startFen, ply) : null;
  const bestView = showBest && verdict?.bad && verdict.best;
  const prevPos = useMemo(() => positionAt(source.startFen, moves, Math.max(0, ply - 1)), [source.startFen, moves, ply]);
  const pos = varPos ?? (bestView ? prevPos : mainPos);

  const live = useLiveEval(pos.fen, engineOpen && progress === null, { depth: 18, multipv: 3 });
  const opening = useMemo(() => detectOpening(moves.slice(0, ply).map((m) => m.fen)), [moves, ply]);

  const goTo = useCallback(
    (p: number) => {
      setVariation(null);
      setShowBest(false);
      setPly(Math.max(0, Math.min(moves.length, p)));
    },
    [moves.length],
  );
  const flip = useCallback(() => setOrientation((o) => (o === 'white' ? 'black' : 'white')), []);
  useBoardKeys({ ply, max: moves.length, setPly: goTo, flip });

  const keyMoments = review ? review.classes.map((c, i) => ({ c, ply: i + 1 })).filter((m) => m.c === 'mistake' || m.c === 'blunder') : [];
  const nextMoment = keyMoments.find((m) => m.ply > ply) ?? keyMoments[0];

  const onMove = (from: Sq, to: Sq, promotion?: PieceSymbol) => {
    const uci = from + to + (promotion ?? '');
    setShowBest(false);
    if (!variation) {
      if (moves[ply]?.uci === uci) return setPly(ply + 1);
      // On a free board there is nothing to compare against: just extend the line.
      if (free && ply === moves.length) {
        const next = applyMove(source.startFen, moves, uci);
        if (next) {
          setMoves(next);
          setPly(next.length);
        }
        return;
      }
      const next = applyMove(mainPos.fen, [], uci);
      if (next) setVariation({ from: ply, moves: next });
      return;
    }
    const next = applyMove(mainPos.fen, variation.moves, uci);
    if (next) setVariation({ ...variation, moves: next });
  };

  const pgn = () => toPgn({ startFen: source.startFen, moves: moves.map((m) => m.uci), white: source.white, black: source.black, result: source.result, date: source.date });

  const arrows: Arrow[] = [];
  if (bestView && verdict) {
    arrows.push({ from: verdict.move.from, to: verdict.move.to, tone: 'bad' });
    arrows.push({ from: verdict.best!.slice(0, 2) as Sq, to: verdict.best!.slice(2, 4) as Sq, tone: 'good' });
  } else if (engineOpen && live.lines[0]?.pv[0]) {
    const u = live.lines[0].pv[0];
    arrows.push({ from: u.slice(0, 2) as Sq, to: u.slice(2, 4) as Sq, tone: 'engine' });
  }

  const evalLine = engineOpen && live.best ? live.best : review ? review.evals[ply] : null;
  const counts = (c: Color) => {
    const n = review?.counts[c] ?? {};
    return [
      { label: 'gaffe', n: n.blunder ?? 0, tone: 'blunder' },
      { label: 'erreur', n: n.mistake ?? 0, tone: 'mistake' },
      { label: 'imprécision', n: n.inaccuracy ?? 0, tone: 'inaccuracy' },
    ];
  };

  return (
    <div className="analysis-layout">
      <div className="board-column">
        <div className="board-row">
          <EvalBar line={evalLine} orientation={orientation} />
          <Board fen={pos.fen} orientation={orientation} movable="both" dests={pos.dests} lastMove={pos.lastMove} check={pos.check} arrows={arrows} onMove={onMove} />
        </div>
        <div className="big-nav">
          <button className="btn" onClick={() => goTo(0)} disabled={ply === 0} aria-label="Début">
            <ChevronFirst />
          </button>
          <button className="btn primary" onClick={() => goTo(ply - 1)} disabled={ply === 0}>
            <ChevronLeft /> Précédent
          </button>
          <button className="btn primary" onClick={() => goTo(ply + 1)} disabled={ply >= moves.length}>
            Suivant <ChevronRight />
          </button>
          <button className="btn" onClick={() => goTo(moves.length)} disabled={ply >= moves.length} aria-label="Fin">
            <ChevronLast />
          </button>
          <button className="btn ghost" onClick={flip} aria-label="Retourner le plateau" title="Retourner (F)">
            <RefreshCw />
          </button>
        </div>
        {review && <EvalGraph evals={review.evals} classes={review.classes} ply={ply} onSelect={goTo} />}
      </div>

      <aside className="analysis-side">
        <header className="panel game-title">
          <h2>
            {source.white} <span className="faint">vs</span> {source.black}
          </h2>
          <p className="dim small">
            {source.result ? `${source.result}${source.reason ? ` · ${REASON_LABEL[source.reason]}` : ''}` : free ? 'Plateau libre : joue des coups, Stockfish les évalue.' : 'Partie importée'}
            {opening ? ` · ${opening.name}` : ''}
          </p>
        </header>

        {progress !== null && (
          <div className="panel review-progress">
            <p>
              Stockfish rejoue la partie… <span className="mono">{Math.round(progress * 100)}%</span>
            </p>
            <div className="progress-track">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        {review && (
          <section className="panel review-summary">
            <div className="accuracy">
              {(['white', 'black'] as const).map((c) => (
                <div key={c}>
                  <span className="acc-name">{source[c]}</span>
                  <b className="mono">{Math.round(review.accuracy[c])}%</b>
                  <small>de précision</small>
                  <ul className="acc-counts">
                    {counts(c).map((x) => (
                      <li key={x.label} className={`mc-${x.tone}`}>
                        <em>{x.n}</em> {x.label}
                        {x.n > 1 ? 's' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Coach: what happened on the current move */}
        {(review || variation) && (
          <AnimatePresence mode="wait">
            <motion.section
              key={variation ? 'var' : ply}
              className={`panel coach ${verdict ? `mc-${verdict.meta.tone}` : ''}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {variation ? (
                <>
                  <h3>Tu explores une variante</h3>
                  <p className="dim">{variation.moves.map((m) => frSan(m.san)).join(' ')}</p>
                  <button className="btn" onClick={() => setVariation(null)}>
                    <Undo2 /> Revenir à la partie
                  </button>
                </>
              ) : verdict ? (
                <>
                  <h3>
                    <span className="coach-badge">{verdict.meta.symbol}</span> {verdict.num} {frSan(verdict.move.san)} · {verdict.meta.label}
                  </h3>
                  <p>{verdict.detail}</p>
                  {verdict.bad && verdict.bestSan && (
                    <p>
                      Meilleur coup : <b>{verdict.bestSan}</b>
                    </p>
                  )}
                  <div className="controls-row">
                    {verdict.bad && verdict.best && (
                      <button className="btn" onClick={() => setShowBest(!showBest)}>
                        {showBest ? <EyeOff /> : <Eye />} {showBest ? 'Revenir au coup joué' : 'Voir sur le plateau'}
                      </button>
                    )}
                    {nextMoment && (
                      <button className="btn ghost" onClick={() => goTo(nextMoment.ply)}>
                        <SkipForward /> Moment clé suivant
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h3>Prêt</h3>
                  <p className="dim">
                    Avance coup par coup avec <b>Suivant</b> (ou la flèche →). Chaque coup reçoit une note et une explication.
                  </p>
                  {nextMoment && (
                    <button className="btn" onClick={() => goTo(nextMoment.ply)}>
                      <SkipForward /> Aller au premier moment clé
                    </button>
                  )}
                </>
              )}
            </motion.section>
          </AnimatePresence>
        )}

        <section className="panel moves-panel">
          <h3 className="side-label">Coups</h3>
          <MoveList moves={moves} ply={variation ? variation.from : ply} onSelect={goTo} classes={review?.classes} />
        </section>

        <section className="panel engine-panel">
          <button className="engine-toggle" onClick={() => setEngineOpen(!engineOpen)} aria-expanded={engineOpen}>
            <span>Stockfish en direct {engineOpen && live.depth ? <span className="faint mono small">· profondeur {live.depth}</span> : null}</span>
            <ChevronDown className={engineOpen ? 'open' : ''} />
          </button>
          {engineOpen && (
            <ol className="engine-lines">
              {live.lines.map((l) => (
                <li key={l.multipv}>
                  <span className={`score mono ${(l.mate ?? l.cp ?? 0) >= 0 ? 'w' : 'b'}`}>{formatScore(l)}</span>
                  <span className="pv">{uciToSan(pos.fen, l.pv.slice(0, 8)).map(frSan).join(' ')}</span>
                </li>
              ))}
              {!live.lines.length && <li className="faint">{progress !== null ? 'Disponible après la revue…' : 'Calcul…'}</li>}
            </ol>
          )}
        </section>

        {moves.length > 0 && (
          <div className="controls-row">
            <button
              className="btn grow"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(pgn());
                  toast('PGN copié', 'good');
                } catch {
                  toast('Copie impossible');
                }
              }}
            >
              <ClipboardCopy /> Copier le PGN
            </button>
            <button
              className="btn grow"
              onClick={() => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([pgn()], { type: 'application/x-chess-pgn' }));
                a.download = `chess-arena-${new Date(source.date ?? Date.now()).toISOString().slice(0, 10)}.pgn`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              }}
            >
              <Download /> Télécharger
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
