import { useRef, useState, useCallback } from 'react';
import { ChessEngine } from '../lib/chess.js';
import { ChessAI, stockfishBridge } from '../lib/ai.js';
import { computeCaptured, computeCheckState, computeGameOverData } from '../utils.js';

const INITIAL_STATE = {
  active: false,
  variant: 'ai',
  board: null,
  turn: 'white',
  selectedSquare: null,
  legalMoves: [],
  lastMove: null,
  kingInCheck: null,
  checkAttackers: [],
  myColor: 'white',
  boardFlipped: false,
  aiColor: 'black',
  aiDifficulty: 2,
  whiteTime: 300,
  blackTime: 300,
  timerEnabled: false,
  aiThinking: false,
  moveHistory: [],
  capturedByWhite: [],
  capturedByBlack: [],
  gameOver: false,
  result: null,
  winner: null,
  gameOverData: null,
  promotionPending: null,
};

export function useOfflineGame() {
  const engineRef = useRef(null);
  const aiRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(null);

  // stateRef mirrors React state for synchronous access in callbacks/intervals
  const stateRef = useRef(INITIAL_STATE);
  const [, _forceRender] = useState(0);

  const setState = useCallback((updates) => {
    const current = stateRef.current;
    const next = typeof updates === 'function' ? updates(current) : { ...current, ...updates };
    stateRef.current = next;
    _forceRender(n => n + 1);
  }, []);

  const getEngineSnapshot = useCallback((engine) => {
    const { kingInCheck, checkAttackers } = computeCheckState(engine);
    const { capturedByWhite, capturedByBlack } = computeCaptured(engine.moveHistory);
    return {
      board: engine.board,
      turn: engine.turn,
      lastMove: engine.lastMove,
      moveHistory: engine.moveHistory,
      kingInCheck,
      checkAttackers,
      capturedByWhite,
      capturedByBlack,
      gameOver: engine.gameOver,
      result: engine.result,
      winner: engine.winner,
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((engine) => {
    stopTimer();
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const s = stateRef.current;
      if (!s.timerEnabled || s.gameOver || !engine || engine.gameOver) {
        stopTimer();
        return;
      }

      const delta = (Date.now() - lastTickRef.current) / 1000;
      lastTickRef.current = Date.now();

      let { whiteTime, blackTime } = s;

      if (engine.turn === 'white') {
        whiteTime = Math.max(0, whiteTime - delta);
        if (whiteTime <= 0) {
          engine.gameOver = true; engine.result = 'timeout'; engine.winner = 'black';
          stopTimer();
          setState({ ...s, whiteTime: 0, ...getEngineSnapshot(engine), gameOverData: computeGameOverData(engine, s.variant, s.myColor) });
          return;
        }
      } else {
        blackTime = Math.max(0, blackTime - delta);
        if (blackTime <= 0) {
          engine.gameOver = true; engine.result = 'timeout'; engine.winner = 'white';
          stopTimer();
          setState({ ...s, blackTime: 0, ...getEngineSnapshot(engine), gameOverData: computeGameOverData(engine, s.variant, s.myColor) });
          return;
        }
      }

      setState({ ...s, whiteTime, blackTime });
    }, 100);
  }, [stopTimer, getEngineSnapshot, setState]);

  const doAIMove = useCallback(async (engine, ai, aiColor, variant, myColor) => {
    if (!engine || !ai || engine.gameOver || engine.turn !== aiColor) return;

    setState({ aiThinking: true });

    try {
      const bestMove = await ai.findBestMove(engine, aiColor);

      // Artificial delay for easy levels
      const baseDelay = ai.difficulty === 1 ? 200 : ai.difficulty === 2 ? 300 : 0;
      if (baseDelay > 0) {
        const variation = baseDelay * 0.2;
        await new Promise(r => setTimeout(r, baseDelay + Math.random() * variation * 2 - variation));
      }

      if (engine.gameOver || engine.turn !== aiColor) {
        setState({ aiThinking: false });
        return;
      }

      if (bestMove) {
        engine.makeMove(bestMove.from, bestMove.to, bestMove.promotion);
        const s = stateRef.current;
        const snapshot = getEngineSnapshot(engine);
        setState({
          ...s,
          ...snapshot,
          aiThinking: false,
          selectedSquare: null,
          legalMoves: [],
          gameOverData: engine.gameOver ? computeGameOverData(engine, variant, myColor) : null,
        });
        if (engine.gameOver) stopTimer();
      } else {
        setState({ aiThinking: false });
      }
    } catch (e) {
      console.error('[useOfflineGame] AI error:', e);
      setState({ aiThinking: false });
    }
  }, [getEngineSnapshot, setState, stopTimer]);

  const startAIGame = useCallback((playerColor, aiDifficulty, timeLimit) => {
    stopTimer();
    const engine = new ChessEngine();
    engineRef.current = engine;
    const ai = new ChessAI(aiDifficulty);
    aiRef.current = ai;

    const aiColor = playerColor === 'white' ? 'black' : 'white';
    const timerEnabled = timeLimit > 0;
    const snapshot = getEngineSnapshot(engine);

    const newState = {
      ...INITIAL_STATE,
      active: true,
      variant: 'ai',
      ...snapshot,
      myColor: playerColor,
      boardFlipped: playerColor === 'black',
      aiColor,
      aiDifficulty,
      whiteTime: timerEnabled ? timeLimit : 300,
      blackTime: timerEnabled ? timeLimit : 300,
      timerEnabled,
    };
    setState(newState);

    if (timerEnabled) startTimer(engine);

    if (aiColor === 'white') {
      setTimeout(() => doAIMove(engine, ai, aiColor, 'ai', playerColor), 100);
    }
  }, [getEngineSnapshot, setState, startTimer, stopTimer, doAIMove]);

  const startSelfGame = useCallback((timeLimit) => {
    stopTimer();
    const engine = new ChessEngine();
    engineRef.current = engine;
    aiRef.current = null;

    const timerEnabled = timeLimit > 0;
    const snapshot = getEngineSnapshot(engine);

    setState({
      ...INITIAL_STATE,
      active: true,
      variant: 'self',
      ...snapshot,
      myColor: 'white',
      boardFlipped: false,
      whiteTime: timerEnabled ? timeLimit : 300,
      blackTime: timerEnabled ? timeLimit : 300,
      timerEnabled,
    });

    if (timerEnabled) startTimer(engine);
  }, [getEngineSnapshot, setState, startTimer, stopTimer]);

  const handleSquareClick = useCallback((row, col) => {
    const engine = engineRef.current;
    if (!engine) return;

    const s = stateRef.current;
    if (s.gameOver || s.aiThinking) return;
    if (s.variant === 'ai' && engine.turn !== s.myColor) return;

    const currentMover = s.variant === 'self' ? engine.turn : s.myColor;
    const piece = engine.getPiece(row, col);

    if (s.selectedSquare) {
      const { selectedSquare, legalMoves } = s;

      if (row === selectedSquare.row && col === selectedSquare.col) {
        setState({ selectedSquare: null, legalMoves: [] });
        return;
      }

      if (piece?.color === currentMover) {
        setState({ selectedSquare: { row, col }, legalMoves: engine.getLegalMoves(row, col) });
        return;
      }

      const move = legalMoves.find(m => m.to.row === row && m.to.col === col);

      if (move) {
        if (move.promotion) {
          setState({ promotionPending: { from: { ...selectedSquare }, to: { row, col } } });
          return;
        }

        engine.makeMove(selectedSquare, { row, col });
        const snapshot = getEngineSnapshot(engine);
        const gameOverData = engine.gameOver ? computeGameOverData(engine, s.variant, s.myColor) : null;

        setState({ ...s, ...snapshot, selectedSquare: null, legalMoves: [], gameOverData });

        if (!engine.gameOver && s.variant === 'ai') {
          const ai = aiRef.current;
          setTimeout(() => doAIMove(engine, ai, s.aiColor, s.variant, s.myColor), 0);
        }
        if (engine.gameOver) stopTimer();
        return;
      }

      setState({ selectedSquare: null, legalMoves: [] });
      return;
    }

    if (piece?.color === currentMover) {
      setState({ selectedSquare: { row, col }, legalMoves: engine.getLegalMoves(row, col) });
    }
  }, [getEngineSnapshot, setState, doAIMove, stopTimer]);

  const selectPromotion = useCallback((promotionType) => {
    const engine = engineRef.current;
    const s = stateRef.current;
    if (!engine || !s.promotionPending) return;

    const { from, to } = s.promotionPending;
    engine.makeMove(from, to, promotionType);
    const snapshot = getEngineSnapshot(engine);
    const gameOverData = engine.gameOver ? computeGameOverData(engine, s.variant, s.myColor) : null;

    setState({ ...s, ...snapshot, selectedSquare: null, legalMoves: [], promotionPending: null, gameOverData });

    if (!engine.gameOver && s.variant === 'ai') {
      const ai = aiRef.current;
      setTimeout(() => doAIMove(engine, ai, s.aiColor, s.variant, s.myColor), 0);
    }
    if (engine.gameOver) stopTimer();
  }, [getEngineSnapshot, setState, doAIMove, stopTimer]);

  const resign = useCallback(() => {
    if (!confirm('Abandonner ?')) return;
    const engine = engineRef.current;
    const s = stateRef.current;
    if (!engine) return;

    stopTimer();
    engine.gameOver = true;
    engine.result = 'resign';

    let resignMessage;
    if (s.variant === 'self') {
      engine.winner = engine.turn === 'white' ? 'black' : 'white';
      resignMessage = engine.turn === 'white' ? 'Les blancs abandonnent.' : 'Les noirs abandonnent.';
    } else {
      engine.winner = s.myColor === 'white' ? 'black' : 'white';
      resignMessage = 'Vous avez abandonné.';
    }

    setState({
      ...s,
      gameOver: true,
      result: 'resign',
      winner: engine.winner,
      gameOverData: { icon: '🏳', title: 'Abandon', message: resignMessage },
    });
  }, [setState, stopTimer]);

  const cleanup = useCallback(() => {
    stopTimer();
    try { if (stockfishBridge) stockfishBridge.stop(); } catch (e) { /* ignore */ }
    aiRef.current = null;
    engineRef.current = null;
    stateRef.current = INITIAL_STATE;
    _forceRender(n => n + 1);
  }, [stopTimer]);

  return {
    state: stateRef.current,
    startAIGame,
    startSelfGame,
    handleSquareClick,
    selectPromotion,
    resign,
    cleanup,
  };
}
