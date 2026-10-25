import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Box, ClipboardCopy, Cpu, Download, FileUp, Play, RefreshCw, Square, Undo2, X } from 'lucide-react';
import { Chess } from 'chess.js';
import type { Color } from '../lib/types';
import { useProfile, type SavedGame } from '../store/profile';
import { useSettings } from '../store/settings';
import { applyMove, buildLine, positionAt, REASON_LABEL, toPgn, type PlayedMove } from '../game/line';
import { reviewGame, type ReviewResult } from '../game/review';
import { useLiveEval } from '../game/useLiveEval';
import { useBoardKeys } from '../game/useBoardKeys';
import { START_FEN, uciToSan, validateFen, type PieceSymbol, type Square as Sq } from '../lib/chess';
import { formatScore, MOVE_CLASS_META, type MoveClass } from '../lib/engine/eval';
import { detectOpening } from '../data/openings';
import { navigate } from '../lib/router';
import { BoardView } from '../components/game/BoardView';
import { NavButtons } from '../components/game/NavButtons';
import { EvalBar } from '../components/EvalBar';
import { EvalGraph } from '../components/EvalGraph';
import { MoveList } from '../components/MoveList';
import { Modal } from '../components/ui/Modal';
import { toast } from '../components/Toasts';
import type { Arrow } from '../components/board/Board';
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
  return {
    startFen,
    moves: buildLine(startFen, g.moves),
    white: g.white,
    black: g.black,
    result: g.result,
    reason: g.reason,
    date: g.date,
    gameId: g.id,
    you: g.you,
  };
}

const SUMMARY_CLASSES: MoveClass[] = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];

export function Analysis({ gameId }: { gameId?: string }) {
  const games = useProfile((s) => s.games);
  const updateGame = useProfile((s) => s.updateGame);
  const { view3d, set: setSettings } = useSettings();
  const saved = gameId ? games.find((g) => g.id === gameId) : undefined;

  const [source, setSource] = useState<Source>(() =>
    saved ? fromSaved(saved) : { startFen: START_FEN, moves: [], white: 'Blancs', black: 'Noirs' },
  );
  const [ply, setPly] = useState(saved ? 0 : 0);
  const [variation, setVariation] = useState<{ from: number; moves: PlayedMove[]; ply: number } | null>(null);
  const [orientation, setOrientation] = useState<Color>(saved?.you === 'black' ? 'black' : 'white');
  const [engineOn, setEngineOn] = useState(true);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const reviewCtrl = useRef<AbortController | null>(null);

  // Position currently displayed (mainline or variation).
  const mainPos = useMemo(() => positionAt(source.startFen, source.moves, ply), [source, ply]);
  const pos = useMemo(() => {
    if (!variation) return mainPos;
    return positionAt(mainPos.fen, variation.moves, variation.ply);
  }, [variation, mainPos]);

  const live = useLiveEval(pos.fen, engineOn && !progress, { depth: 20, multipv: 3 });
  const opening = useMemo(() => detectOpening(source.moves.slice(0, ply).map((m) => m.fen)), [source.moves, ply]);

  const startReview = useCallback(
    async (src: Source) => {
      reviewCtrl.current?.abort();
      if (!src.moves.length) return;
      const ctrl = new AbortController();
      reviewCtrl.current = ctrl;
      setReview(null);
      setProgress({ done: 0, total: src.moves.length + 1 });
      try {
        const res = await reviewGame(src.startFen, src.moves, (done, total) => setProgress({ done, total }), ctrl.signal);
        if (res && !ctrl.signal.aborted) {
          setReview(res);
          if (src.gameId) updateGame(src.gameId, { accuracy: { white: Math.round(res.accuracy.white), black: Math.round(res.accuracy.black) } });
        }
      } catch {
        toast('Le moteur n’a pas pu analyser la partie', 'bad');
      } finally {
        if (!ctrl.signal.aborted) setProgress(null);
      }
    },
    [updateGame],
  );

  // Saved games are reviewed automatically on open.
  useEffect(() => {
    if (saved) void startReview(fromSaved(saved));
    return () => reviewCtrl.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const setMainPly = useCallback(
    (p: number) => {
      setVariation(null);
      setPly(Math.max(0, Math.min(source.moves.length, p)));
    },
    [source.moves.length],
  );

  const navPly = variation ? variation.ply : ply;
  const navMax = variation ? variation.moves.length : source.moves.length;
  const setNavPly = useCallback(
    (p: number) => {
      if (variation) setVariation({ ...variation, ply: Math.max(0, Math.min(variation.moves.length, p)) });
      else setMainPly(p);
    },
    [variation, setMainPly],
  );
  const flip = useCallback(() => setOrientation((o) => (o === 'white' ? 'black' : 'white')), []);
  useBoardKeys({ ply: navPly, max: navMax, setPly: setNavPly, flip });

  const onMove = (from: Sq, to: Sq, promotion?: PieceSymbol) => {
    const uci = from + to + (promotion ?? '');
    if (!variation) {
      const next = source.moves[ply];
      if (next && next.uci === uci) {
        setPly(ply + 1);
        return;
      }
      // Fresh analysis board: extend the main line directly.
      if (!saved && !review && ply === source.moves.length) {
        const moves = applyMove(source.startFen, source.moves, uci);
        if (moves) {
          setSource({ ...source, moves });
          setPly(ply + 1);
        }
        return;
      }
      const moves = applyMove(mainPos.fen, [], uci);
      if (moves) setVariation({ from: ply, moves, ply: 1 });
      return;
    }
    const base = variation.moves.slice(0, variation.ply);
    const moves = applyMove(mainPos.fen, base, uci);
    if (moves) setVariation({ ...variation, moves, ply: moves.length });
  };

  const pgn = () =>
    toPgn({
      startFen: source.startFen,
      moves: source.moves.map((m) => m.uci),
      white: source.white,
      black: source.black,
      result: source.result,
      date: source.date,
    });

  const copyPgn = async () => {
    try {
      await navigator.clipboard.writeText(pgn());
      toast('PGN copié', 'good');
    } catch {
      toast('Copie impossible');
    }
  };

  const downloadPgn = () => {
    const blob = new Blob([pgn()], { type: 'application/x-chess-pgn' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chess-arena-${new Date(source.date ?? Date.now()).toISOString().slice(0, 10)}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // Arrow for the engine's preferred move in the displayed position.
  const arrows: Arrow[] = [];
  if (engineOn && live.lines[0]?.pv[0]) {
    const u = live.lines[0].pv[0];
    arrows.push({ from: u.slice(0, 2) as Sq, to: u.slice(2, 4) as Sq, tone: 'engine' });
  }
  const currentClass = !variation && review && ply > 0 ? review.classes[ply - 1] : undefined;
  const missedFromPrev = !!currentClass && ['mistake', 'blunder', 'inaccuracy'].includes(currentClass);

  const keyMoments = review
    ? review.classes
        .map((c, i) => ({ c, i }))
        .filter((m) => m.c === 'blunder' || m.c === 'mistake')
        .slice(0, 12)
    : [];

  return (
    <div className="analysis-layout">
      <div className="board-column">
        <div className="analysis-players">
          <span>
            <b>{orientation === 'white' ? source.black : source.white}</b>
          </span>
          {source.result && (
            <span className="chip mono">
              {source.result} {source.reason ? `· ${REASON_LABEL[source.reason]}` : ''}
            </span>
          )}
        </div>
        <div className="board-row">
          <EvalBar line={engineOn ? live.best : review?.evals[ply] ?? null} orientation={orientation} />
          <BoardView
            fen={pos.fen}
            orientation={orientation}
            movable="both"
            dests={pos.dests}
            lastMove={pos.lastMove}
            check={pos.check}
            arrows={arrows}
            onMove={onMove}
          />
        </div>
        <div className="analysis-players">
          <span>
            <b>{orientation === 'white' ? source.white : source.black}</b>
          </span>
          <span className="controls-row">
            <button className="btn ghost sm" onClick={flip}>
              <RefreshCw /> Retourner
            </button>
            <button className="btn ghost sm" onClick={() => setSettings({ view3d: !view3d })}>
              {view3d ? <Square /> : <Box />} {view3d ? '2D' : '3D'}
            </button>
          </span>
        </div>
        {review && <EvalGraph evals={review.evals} classes={review.classes} ply={ply} onSelect={setMainPly} />}
      </div>

      <aside className="side-panel analysis-side">
        <div className="panel engine-panel">
          <div className="side-section-title">
            <h3>
              <Cpu /> Stockfish 19
            </h3>
            <button className="toggle" role="switch" aria-checked={engineOn} aria-label="Moteur" onClick={() => setEngineOn(!engineOn)} />
          </div>
          {engineOn ? (
            <>
              <p className="faint small mono">
                profondeur {live.depth || '…'} {live.error && `· ${live.error}`}
              </p>
              <ol className="engine-lines">
                {live.lines.map((l) => (
                  <li key={l.multipv}>
                    <span className={`score mono ${(l.mate ?? l.cp ?? 0) >= 0 ? 'w' : 'b'}`}>{formatScore(l)}</span>
                    <span className="pv">{uciToSan(pos.fen, l.pv.slice(0, 8)).join(' ')}</span>
                  </li>
                ))}
                {!live.lines.length && <li className="faint">Calcul…</li>}
              </ol>
            </>
          ) : (
            <p className="faint small">Moteur en pause.</p>
          )}
        </div>

        {progress && (
          <div className="panel review-progress">
            <p>
              Revue de la partie… <span className="mono">{Math.round((progress.done / progress.total) * 100)}%</span>
            </p>
            <div className="progress-track">
              <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {review && (
          <motion.div className="panel review-summary" initial={{ opacity: 0, rotateX: -20 }} animate={{ opacity: 1, rotateX: 0 }}>
            <div className="accuracy">
              {(['white', 'black'] as const).map((c) => (
                <div key={c}>
                  <span className="eyebrow">{source[c]}</span>
                  <b className="mono">{review.accuracy[c].toFixed(1)}</b>
                  <small>précision</small>
                </div>
              ))}
            </div>
            <table className="class-table">
              <tbody>
                {SUMMARY_CLASSES.map((c) => (
                  <tr key={c} className={`mc-${MOVE_CLASS_META[c].tone}`}>
                    <td className="mono">{review.counts.white[c] ?? 0}</td>
                    <th>
                      <em>{MOVE_CLASS_META[c].symbol}</em> {MOVE_CLASS_META[c].label}
                    </th>
                    <td className="mono">{review.counts.black[c] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {keyMoments.length > 0 && (
              <div className="moments">
                <span className="eyebrow">Moments clés</span>
                <div className="moment-list">
                  {keyMoments.map((m) => (
                    <button key={m.i} className={`moment mc-${m.c}`} onClick={() => setMainPly(m.i + 1)}>
                      <span className="mono">
                        {Math.floor(m.i / 2) + 1}
                        {m.i % 2 ? '…' : '.'}
                      </span>{' '}
                      {source.moves[m.i].san} <em>{MOVE_CLASS_META[m.c].symbol}</em>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        <div className="panel moves-panel">
          <div className="opening-tag">
            {opening ? (
              <>
                <span className="mono faint">{opening.eco}</span> <b>{opening.name}</b>
              </>
            ) : (
              <span className="faint">Analyse libre</span>
            )}
          </div>
          {currentClass && (
            <p className={`class-callout mc-${MOVE_CLASS_META[currentClass].tone}`}>
              <em>{MOVE_CLASS_META[currentClass].symbol}</em> {source.moves[ply - 1].san} : {MOVE_CLASS_META[currentClass].label.toLowerCase()}
              {missedFromPrev && review?.best[ply - 1] && (
                <span className="dim"> · meilleur : {uciToSan(source.moves[ply - 2]?.fen ?? source.startFen, [review.best[ply - 1]!])[0]}</span>
              )}
            </p>
          )}
          <MoveList moves={source.moves} ply={variation ? variation.from : ply} onSelect={setMainPly} classes={review?.classes} />
          {variation && (
            <div className="variation">
              <span className="eyebrow">Variante</span>
              <div className="variation-moves">
                {variation.moves.map((m, i) => (
                  <button key={i} className={`move-cell ${variation.ply === i + 1 ? 'current' : ''}`} onClick={() => setVariation({ ...variation, ply: i + 1 })}>
                    {m.san}
                  </button>
                ))}
              </div>
              <button className="btn ghost sm" onClick={() => setVariation(null)}>
                <Undo2 /> Retour à la partie
              </button>
            </div>
          )}
          <NavButtons ply={navPly} max={navMax} setPly={setNavPly} />
        </div>

        <div className="panel controls-row">
          {!review && !progress && source.moves.length > 0 && (
            <button className="btn primary grow" onClick={() => startReview(source)}>
              <Play /> Revue complète
            </button>
          )}
          {progress && (
            <button className="btn grow" onClick={() => reviewCtrl.current?.abort()}>
              <X /> Stop
            </button>
          )}
          <button className="btn grow" onClick={() => setImportOpen(true)}>
            <FileUp /> Importer
          </button>
          <button className="btn icon" onClick={copyPgn} disabled={!source.moves.length} aria-label="Copier le PGN" title="Copier le PGN">
            <ClipboardCopy />
          </button>
          <button className="btn icon" onClick={downloadPgn} disabled={!source.moves.length} aria-label="Télécharger le PGN" title="Télécharger le PGN">
            <Download />
          </button>
        </div>
      </aside>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onLoad={(src) => {
          reviewCtrl.current?.abort();
          setProgress(null);
          setReview(null);
          setVariation(null);
          setSource(src);
          setPly(src.moves.length ? 0 : 0);
          setImportOpen(false);
          if (gameId) navigate('analysis');
        }}
      />
    </div>
  );
}

function ImportModal({ open, onClose, onLoad }: { open: boolean; onClose: () => void; onLoad: (s: Source) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const raw = text.trim();
    if (!raw) return;
    // A FEN is a single line with 8 ranks.
    if (!raw.includes('[') && raw.split('/').length === 8 && !raw.includes('.')) {
      const err = validateFen(raw);
      if (err) return setError(err);
      onLoad({ startFen: new Chess(raw).fen(), moves: [], white: 'Blancs', black: 'Noirs' });
      return;
    }
    try {
      const chess = new Chess();
      chess.loadPgn(raw);
      const headers = chess.getHeaders();
      const startFen = headers.FEN ?? START_FEN;
      const ucis = chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
      const result = headers.Result as SavedGame['result'] | undefined;
      onLoad({
        startFen,
        moves: buildLine(startFen, ucis),
        white: headers.White ?? 'Blancs',
        black: headers.Black ?? 'Noirs',
        result: result && result !== ('*' as string) ? result : undefined,
      });
    } catch {
      setError('PGN illisible. Colle une partie complète (en-têtes facultatifs) ou une FEN.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Importer une partie" width={560}>
      <textarea
        id="import-text"
        className="input"
        rows={9}
        placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 …\n\nou une position FEN'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      {error && <p className="field-error">{error}</p>}
      <div className="controls-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn primary" onClick={load} disabled={!text.trim()}>
          Charger
        </button>
      </div>
    </Modal>
  );
}
