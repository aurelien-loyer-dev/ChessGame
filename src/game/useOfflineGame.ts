import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Color, EndReason, GameResult, TimeControl } from '../lib/types';
import { tcKey } from '../lib/types';
import { botMove, hintMove, type Bot } from '../lib/engine/bots';
import { getAnalysisEngine } from '../lib/engine/stockfish';
import { lineToCp } from '../lib/engine/eval';
import { START_FEN, type PieceSymbol, type Square } from '../lib/chess';
import { play, playMoveSound } from '../lib/sound';
import { useProfile } from '../store/profile';
import { useCloud } from '../store/cloud';
import { applyMove, detectEnd, positionAt, type PlayedMove } from './line';

export interface OfflineConfig {
  mode: 'bot' | 'local';
  bot?: Bot;
  /** Side of the human player in bot games. */
  color: Color;
  tc: TimeControl;
  startFen?: string;
}

export interface GameOutcome {
  result: GameResult;
  reason: EndReason;
  ratingChange?: { before: number; after: number } | null;
  gameId: string;
}

function now() {
  return performance.now();
}

export function useOfflineGame(config: OfflineConfig) {
  const startFen = config.startFen ?? START_FEN;
  const timed = config.tc.initial > 0;
  const recordGame = useProfile((s) => s.recordGame);
  const profileName = useProfile((s) => s.name);

  const [moves, setMoves] = useState<PlayedMove[]>([]);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<[Square, Square] | null>(null);
  const [drawDeclined, setDrawDeclined] = useState(0);

  // Clocks: remaining ms stored at the start of the current turn.
  const [clocks, setClocks] = useState({ white: config.tc.initial * 1000, black: config.tc.initial * 1000 });
  const turnStart = useRef(now());
  const [, forceTick] = useState(0);
  const gameId = useRef(crypto.randomUUID());

  const livePly = moves.length;
  const ply = viewPly ?? livePly;
  const pos = useMemo(() => positionAt(startFen, moves, ply), [startFen, moves, ply]);
  const livePos = useMemo(() => positionAt(startFen, moves, livePly), [startFen, moves, livePly]);
  const turn: Color = livePos.fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const botColor: Color | null = config.mode === 'bot' ? (config.color === 'white' ? 'black' : 'white') : null;
  // Clocks run once both sides have made a move.
  const running: Color | null = timed && !outcome && moves.length >= 2 ? turn : null;

  const displayClocks = { ...clocks };
  if (running) displayClocks[running] = Math.max(0, clocks[running] - (now() - turnStart.current));

  const names = {
    white: config.mode === 'bot' ? (config.color === 'white' ? profileName || 'Vous' : config.bot!.name) : 'Blancs',
    black: config.mode === 'bot' ? (config.color === 'black' ? profileName || 'Vous' : config.bot!.name) : 'Noirs',
  };

  const finish = useCallback(
    (result: GameResult, reason: EndReason, finalMoves: PlayedMove[]) => {
      setOutcome((prev) => {
        if (prev) return prev;
        const you = config.mode === 'bot' ? config.color : null;
        const { enabled, guest, user } = useCloud.getState();
        const isGuest = enabled && guest && !user;
        // Guests play freely but nothing is recorded: no rating, no history.
        const ratingChange = isGuest
          ? null
          : recordGame({
          id: gameId.current,
          date: Date.now(),
          mode: config.mode,
          white: names.white,
          black: names.black,
          whiteElo: config.mode === 'bot' && config.color === 'black' ? config.bot!.elo : undefined,
          blackElo: config.mode === 'bot' && config.color === 'white' ? config.bot!.elo : undefined,
          you,
          result,
          reason,
          moves: finalMoves.map((m) => m.uci),
          startFen: startFen === START_FEN ? undefined : startFen,
          tc: tcKey(config.tc),
          botId: config.bot?.id,
        });
        play('end');
        return { result, reason, ratingChange, gameId: gameId.current };
      });
    },
    // names are derived from config/profile which are stable for a game
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, recordGame, startFen],
  );

  const commit = useCallback(
    (uci: string) => {
      if (outcome) return false;
      const next = applyMove(startFen, moves, uci);
      if (!next) {
        play('error');
        return false;
      }
      const mover = turn;
      const t = now();
      if (running) {
        setClocks((c) => ({
          ...c,
          [mover]: Math.max(0, c[mover] - (t - turnStart.current)) + config.tc.increment * 1000,
        }));
      }
      turnStart.current = t;
      setMoves(next);
      setViewPly(null);
      setHint(null);
      playMoveSound(next[next.length - 1].san);
      const end = detectEnd(startFen, next);
      if (end) finish(end.result, end.reason, next);
      return true;
    },
    [outcome, startFen, moves, turn, running, config.tc.increment, finish],
  );

  // Human move from the board.
  const move = useCallback(
    (from: Square, to: Square, promotion?: PieceSymbol) => {
      if (viewPly !== null && viewPly !== livePly) return;
      if (botColor && turn === botColor) return;
      commit(from + to + (promotion ?? ''));
    },
    [viewPly, livePly, botColor, turn, commit],
  );

  // Bot replies.
  useEffect(() => {
    if (!botColor || outcome || turn !== botColor || !config.bot) return;
    const ctrl = new AbortController();
    setThinking(true);
    botMove(config.bot, livePos.fen, ctrl.signal)
      .then((uci) => {
        if (!ctrl.signal.aborted && uci) commit(uci);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) play('error');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setThinking(false);
      });
    return () => {
      ctrl.abort();
      setThinking(false);
    };
    // commit changes on every move; the position is what matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePos.fen, botColor, outcome, turn]);

  // Clock ticking and flag detection.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = clocks[running] - (now() - turnStart.current);
      if (left <= 0) {
        setClocks((c) => ({ ...c, [running]: 0 }));
        finish(running === 'white' ? '0-1' : '1-0', 'timeout', moves);
      } else forceTick((n) => n + 1);
    }, 100);
    return () => clearInterval(id);
  }, [running, clocks, finish, moves]);

  useEffect(() => {
    play('start');
  }, []);

  const resign = useCallback(() => {
    if (outcome) return;
    const loser = config.mode === 'bot' ? config.color : turn;
    finish(loser === 'white' ? '0-1' : '1-0', 'resign', moves);
  }, [outcome, config, turn, finish, moves]);

  /** Bots accept a draw when the position is level and the game has gone on a while. */
  const offerDraw = useCallback(async () => {
    if (outcome) return;
    if (config.mode === 'local') {
      finish('1/2-1/2', 'agreement', moves);
      return;
    }
    const res = await getAnalysisEngine().search(livePos.fen, { depth: 12 });
    const cp = res.lines[0] ? lineToCp(res.lines[0]) : 0;
    const botView = botColor === 'white' ? cp : -cp;
    if (moves.length >= 30 && botView < 40) finish('1/2-1/2', 'agreement', moves);
    else {
      setDrawDeclined((n) => n + 1);
      play('error');
    }
  }, [outcome, config.mode, livePos.fen, botColor, moves, finish]);

  /** Takes back the last full move (the user's move and the bot's reply). */
  const takeback = useCallback(() => {
    if (outcome || thinking) return;
    let n = moves.length;
    if (config.mode === 'bot') {
      if (turn === config.color) n -= 2;
      else n -= 1;
    } else n -= 1;
    if (n < 0) return;
    setMoves(moves.slice(0, n));
    setViewPly(null);
    setHint(null);
    turnStart.current = now();
    play('move');
  }, [outcome, thinking, moves, config, turn]);

  const askHint = useCallback(async () => {
    if (outcome) return;
    const uci = await hintMove(livePos.fen);
    if (uci) setHint([uci.slice(0, 2) as Square, uci.slice(2, 4) as Square]);
  }, [outcome, livePos.fen]);

  const userColor: Color | 'both' = config.mode === 'local' ? 'both' : config.color;
  const atLive = ply === livePly;
  const canMove = !outcome && atLive && (config.mode === 'local' || turn === config.color);

  return {
    startFen,
    moves,
    ply,
    livePly,
    setViewPly: (p: number | null) => setViewPly(p === null || p >= livePly ? null : Math.max(0, p)),
    pos,
    turn,
    names,
    clocks: displayClocks,
    timed,
    running,
    outcome,
    thinking,
    hint,
    drawDeclined,
    userColor,
    canMove,
    move,
    resign,
    offerDraw,
    takeback,
    askHint,
  };
}

export type OfflineGame = ReturnType<typeof useOfflineGame>;
