import { useRef, useState, useCallback } from 'react';
import { ChessEngine } from '../lib/chess.js';
import { computeCaptured, computeCheckState, computeGameOverData } from '../utils.js';

const INITIAL_STATE = {
  // Lobby
  lobbyView: 'main',   // 'main' | 'waiting' | 'matchmaking'
  roomCode: null,
  mmElapsed: 0,
  onlinePlayers: [],
  challengeToast: null, // { from, time }
  lobbyToast: null,     // { text, type }

  // Game
  active: false,
  variant: 'online',
  board: null,
  turn: 'white',
  selectedSquare: null,
  legalMoves: [],
  lastMove: null,
  kingInCheck: null,
  checkAttackers: [],
  myColor: 'white',
  boardFlipped: false,
  opponentName: null,
  selfName: null,
  whiteTime: 300,
  blackTime: 300,
  timerEnabled: false,
  moveHistory: [],
  capturedByWhite: [],
  capturedByBlack: [],
  gameOver: false,
  result: null,
  winner: null,
  gameOverData: null,
  promotionPending: null,
  connectionBanner: null, // { text, type }
};

export function useOnlineGame(username) {
  const wsRef = useRef(null);
  const engineRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(null);
  const mmTimerRef = useRef(null);
  const mmStartRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const gameInProgressRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const reconnectingRef = useRef(false);
  const pendingQueueRef = useRef([]);
  const lastPongRef = useRef(0);
  const pingIntervalRef = useRef(null);

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
      board: engine.board, turn: engine.turn, lastMove: engine.lastMove,
      moveHistory: engine.moveHistory, kingInCheck, checkAttackers,
      capturedByWhite, capturedByBlack,
      gameOver: engine.gameOver, result: engine.result, winner: engine.winner,
    };
  }, []);

  // =========================================================================
  // Timer
  // =========================================================================

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((engine) => {
    stopTimer();
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const s = stateRef.current;
      if (!s.timerEnabled || s.gameOver || !engine || engine.gameOver) { stopTimer(); return; }

      const delta = (Date.now() - lastTickRef.current) / 1000;
      lastTickRef.current = Date.now();
      let { whiteTime, blackTime } = s;

      if (engine.turn === 'white') {
        whiteTime = Math.max(0, whiteTime - delta);
        if (whiteTime <= 0) {
          engine.gameOver = true; engine.result = 'timeout'; engine.winner = 'black';
          stopTimer();
          send({ type: 'timeout', loser: 'white' });
          setState({ ...s, whiteTime: 0, ...getEngineSnapshot(engine), gameOverData: computeGameOverData(engine, 'online', s.myColor) });
          return;
        }
      } else {
        blackTime = Math.max(0, blackTime - delta);
        if (blackTime <= 0) {
          engine.gameOver = true; engine.result = 'timeout'; engine.winner = 'white';
          stopTimer();
          send({ type: 'timeout', loser: 'black' });
          setState({ ...s, blackTime: 0, ...getEngineSnapshot(engine), gameOverData: computeGameOverData(engine, 'online', s.myColor) });
          return;
        }
      }
      setState({ ...s, whiteTime, blackTime });
    }, 100);
  }, [stopTimer, getEngineSnapshot, setState]);

  // =========================================================================
  // WebSocket
  // =========================================================================

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else if (gameInProgressRef.current && msg.type === 'move') {
      pendingQueueRef.current.push(msg);
    }
  }, []);

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (pendingQueueRef.current.length > 0) {
      ws.send(JSON.stringify(pendingQueueRef.current.shift()));
    }
  }, []);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
  }, []);

  const startPing = useCallback(() => {
    stopPing();
    lastPongRef.current = Date.now();
    pingIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - lastPongRef.current > 12000) { ws.close(); return; }
      try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) { /* ignore */ }
    }, 5000);
  }, [stopPing]);

  const handleMessage = useCallback((msg) => {
    lastPongRef.current = Date.now();
    const engine = engineRef.current;
    const s = stateRef.current;

    switch (msg.type) {
      case 'room_created':
        setState({ lobbyView: 'waiting', roomCode: msg.room_id, lobbyToast: null });
        break;

      case 'game_start': {
        const myColor = msg.color;
        const timerEnabled = msg.time > 0;
        engineRef.current = new ChessEngine();
        const eng = engineRef.current;
        gameInProgressRef.current = true;

        if (stateRef.current.mmElapsed !== undefined && mmTimerRef.current) {
          clearInterval(mmTimerRef.current); mmTimerRef.current = null;
        }

        const snapshot = getEngineSnapshot(eng);
        setState({
          ...stateRef.current,
          active: true,
          variant: 'online',
          ...snapshot,
          myColor,
          boardFlipped: myColor === 'black',
          opponentName: msg.opponent_name || 'Adversaire',
          selfName: username || 'Vous',
          whiteTime: timerEnabled ? msg.time : 300,
          blackTime: timerEnabled ? msg.time : 300,
          timerEnabled,
          selectedSquare: null,
          legalMoves: [],
          gameOver: false,
          result: null,
          winner: null,
          gameOverData: null,
          promotionPending: null,
          connectionBanner: null,
          lobbyView: 'main',
          roomCode: msg.room_id,
        });

        if (timerEnabled) startTimer(eng);
        break;
      }

      case 'move':
        if (!engine) break;
        engine.applyNetworkMove(msg.from, msg.to, msg.promotion || null);
        if (msg.white_time !== undefined) {
          const snapshot = getEngineSnapshot(engine);
          setState({ ...stateRef.current, ...snapshot, whiteTime: msg.white_time, blackTime: msg.black_time });
        } else {
          setState({ ...stateRef.current, ...getEngineSnapshot(engine) });
        }
        if (engine.gameOver) {
          stopTimer();
          setState({ ...stateRef.current, gameOverData: computeGameOverData(engine, 'online', stateRef.current.myColor) });
        }
        break;

      case 'reconnected':
        setState({ connectionBanner: { text: 'Reconnecté ✓', type: 'ok' } });
        setTimeout(() => setState({ connectionBanner: null }), 2000);
        break;

      case 'reconnect_failed':
        setState({ connectionBanner: { text: 'Reconnexion échouée', type: 'error' } });
        gameInProgressRef.current = false;
        reconnectingRef.current = false;
        break;

      case 'opponent_reconnected':
        setState({ connectionBanner: { text: 'Adversaire reconnecté ✓', type: 'ok' } });
        setTimeout(() => setState({ connectionBanner: null }), 2000);
        break;

      case 'sync_request':
        if (engine) {
          const moves = engine.moveHistory.map(m => ({ from: m.from, to: m.to, promotion: m.promotion || null }));
          send({ type: 'sync_state', moves, white_time: stateRef.current.whiteTime, black_time: stateRef.current.blackTime });
        }
        break;

      case 'sync_state': {
        if (!engine) break;
        const moves = msg.moves || [];
        const myCount = engine.moveHistory.length;
        if (moves.length > myCount) {
          for (let i = myCount; i < moves.length; i++) {
            engine.applyNetworkMove(moves[i].from, moves[i].to, moves[i].promotion);
          }
        }
        const syncState = { ...stateRef.current, ...getEngineSnapshot(engine), connectionBanner: { text: 'Synchronisé ✓', type: 'ok' } };
        if (msg.white_time !== undefined) { syncState.whiteTime = msg.white_time; syncState.blackTime = msg.black_time; }
        setState(syncState);
        setTimeout(() => setState({ connectionBanner: null }), 2000);
        if (engine.gameOver) {
          stopTimer();
          setState({ ...stateRef.current, gameOverData: computeGameOverData(engine, 'online', stateRef.current.myColor) });
        }
        break;
      }

      case 'opponent_resigned':
        if (!engine) break;
        engine.gameOver = true; engine.result = 'resign'; engine.winner = stateRef.current.myColor;
        stopTimer();
        setState({ ...stateRef.current, ...getEngineSnapshot(engine), gameOverData: { icon: '🏆', title: 'Victoire !', message: "L'adversaire a abandonné." } });
        break;

      case 'opponent_disconnected':
        if (gameInProgressRef.current && engine && !engine.gameOver) {
          setState({ connectionBanner: { text: 'Adversaire déconnecté — en attente…', type: 'warning' } });
        }
        break;

      case 'opponent_disconnected_final':
        if (engine && !engine.gameOver) {
          engine.gameOver = true; engine.result = 'disconnect'; engine.winner = stateRef.current.myColor;
          stopTimer();
          setState({ ...stateRef.current, connectionBanner: null, ...getEngineSnapshot(engine), gameOverData: computeGameOverData(engine, 'online', stateRef.current.myColor) });
        }
        break;

      case 'timeout':
        if (!engine) break;
        engine.gameOver = true; engine.result = 'timeout'; engine.winner = msg.winner;
        stopTimer();
        setState({ ...stateRef.current, ...getEngineSnapshot(engine), gameOverData: computeGameOverData(engine, 'online', stateRef.current.myColor) });
        break;

      case 'error':
        setState({ lobbyToast: { text: msg.message, type: 'error' } });
        break;

      case 'matchmaking_waiting':
        break;

      case 'matchmaking_cancelled':
        if (mmTimerRef.current) { clearInterval(mmTimerRef.current); mmTimerRef.current = null; }
        break;

      case 'challenge_sent':
        if (msg.target) setState({ lobbyToast: { text: `Défi envoyé à ${msg.target} — en attente…`, type: 'info' } });
        break;

      case 'challenge_received':
        setState({ challengeToast: { from: msg.from, time: msg.time } });
        break;

      case 'challenge_declined':
        setState({ lobbyToast: { text: `${msg.by} a refusé le défi.`, type: 'error' }, challengeToast: null });
        break;

      case 'challenge_error':
        setState({ lobbyToast: { text: msg.message, type: 'error' } });
        break;
    }
  }, [getEngineSnapshot, setState, stopTimer, startTimer, send, username]);

  const doReconnect = useCallback(() => {
    if (intentionalCloseRef.current) { reconnectingRef.current = false; return; }
    const engine = engineRef.current;
    if (engine?.gameOver) { reconnectingRef.current = false; setState({ connectionBanner: null }); return; }

    if (reconnectAttemptsRef.current >= 30) {
      reconnectingRef.current = false;
      setState({ connectionBanner: { text: 'Connexion perdue', type: 'error' } });
      if (engine) { engine.gameOver = true; engine.result = 'disconnect'; engine.winner = null; }
      stopTimer();
      setState({ ...stateRef.current, gameOverData: { icon: '🔌', title: 'Connexion perdue', message: 'Impossible de se reconnecter.' } });
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(500 * Math.pow(1.5, reconnectAttemptsRef.current - 1), 5000);
    setState({ connectionBanner: { text: `Reconnexion… (${reconnectAttemptsRef.current})`, type: 'warning' } });

    reconnectTimerRef.current = setTimeout(() => {
      connect();
      setTimeout(() => {
        if (reconnectingRef.current && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
          doReconnect();
        }
      }, 3000);
    }, delay);
  }, [setState, stopTimer]);

  const connect = useCallback((onOpenExtra) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) { if (onOpenExtra) onOpenExtra(); return; }
    if (ws?.readyState === WebSocket.CONNECTING) {
      const orig = ws.onopen;
      ws.onopen = (ev) => { if (orig) orig.call(ws, ev); if (onOpenExtra) onOpenExtra(); };
      return;
    }

    intentionalCloseRef.current = false;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const newWs = new WebSocket(`${protocol}://${location.host}/ws`);
    wsRef.current = newWs;

    newWs.onopen = () => {
      lastPongRef.current = Date.now();
      startPing();

      if (username) newWs.send(JSON.stringify({ type: 'set_username', username }));

      const s = stateRef.current;
      if (reconnectingRef.current && gameInProgressRef.current && s.roomCode && s.myColor) {
        reconnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        setState({ connectionBanner: { text: 'Reconnecté — synchronisation…', type: 'ok' } });
        newWs.send(JSON.stringify({ type: 'reconnect', room_id: s.roomCode, color: s.myColor }));
        setTimeout(() => newWs.send(JSON.stringify({ type: 'sync_request' })), 300);
      } else if (reconnectingRef.current) {
        reconnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        setState({ connectionBanner: null });
      }

      flushQueue();
      if (onOpenExtra) onOpenExtra();
    };

    newWs.onmessage = (ev) => {
      try { handleMessage(JSON.parse(ev.data)); } catch (e) { console.warn('[Online] Invalid message:', e); }
    };

    newWs.onclose = (ev) => {
      stopPing();
      wsRef.current = null;
      if (intentionalCloseRef.current) return;
      const engine = engineRef.current;
      if (gameInProgressRef.current && !engine?.gameOver && !reconnectingRef.current) {
        reconnectingRef.current = true;
        reconnectAttemptsRef.current = 0;
        doReconnect();
      }
    };

    newWs.onerror = (err) => { console.warn('[Online] WS error', err); };
  }, [username, startPing, stopPing, flushQueue, handleMessage, setState, doReconnect]);

  // =========================================================================
  // Matchmaking timer
  // =========================================================================

  const startMatchmakingTimer = useCallback(() => {
    if (mmTimerRef.current) { clearInterval(mmTimerRef.current); mmTimerRef.current = null; }
    mmStartRef.current = Date.now();
    mmTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - mmStartRef.current) / 1000);
      setState({ mmElapsed: elapsed });
    }, 1000);
  }, [setState]);

  // =========================================================================
  // Public actions
  // =========================================================================

  const createRoom = useCallback((timeLimit) => {
    connect(() => send({ type: 'create_room', time: timeLimit }));
  }, [connect, send]);

  const joinRoom = useCallback((code) => {
    connect(() => send({ type: 'join_room', room_id: code }));
  }, [connect, send]);

  const startMatchmaking = useCallback((timeLimit) => {
    setState({ lobbyView: 'matchmaking', lobbyToast: null, mmElapsed: 0 });
    connect(() => {
      send({ type: 'matchmaking_join', time: timeLimit });
      startMatchmakingTimer();
    });
  }, [connect, send, setState, startMatchmakingTimer]);

  const cancelMatchmaking = useCallback(() => {
    if (mmTimerRef.current) { clearInterval(mmTimerRef.current); mmTimerRef.current = null; }
    send({ type: 'matchmaking_cancel' });
    intentionalCloseRef.current = true;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setState({ lobbyView: 'main' });
  }, [send, setState]);

  const handleSquareClick = useCallback((row, col) => {
    const engine = engineRef.current;
    if (!engine) return;
    const s = stateRef.current;
    if (s.gameOver || engine.turn !== s.myColor) return;

    const piece = engine.getPiece(row, col);

    if (s.selectedSquare) {
      const { selectedSquare, legalMoves } = s;

      if (row === selectedSquare.row && col === selectedSquare.col) {
        setState({ selectedSquare: null, legalMoves: [] }); return;
      }

      if (piece?.color === s.myColor) {
        setState({ selectedSquare: { row, col }, legalMoves: engine.getLegalMoves(row, col) }); return;
      }

      const move = legalMoves.find(m => m.to.row === row && m.to.col === col);

      if (move) {
        if (move.promotion) { setState({ promotionPending: { from: { ...selectedSquare }, to: { row, col } } }); return; }

        engine.makeMove(selectedSquare, { row, col });
        send({ type: 'move', from: selectedSquare, to: { row, col }, promotion: null, white_time: s.whiteTime, black_time: s.blackTime });

        const snapshot = getEngineSnapshot(engine);
        setState({ ...s, ...snapshot, selectedSquare: null, legalMoves: [], gameOverData: engine.gameOver ? computeGameOverData(engine, 'online', s.myColor) : null });
        if (engine.gameOver) stopTimer();
        return;
      }

      setState({ selectedSquare: null, legalMoves: [] }); return;
    }

    if (piece?.color === s.myColor) {
      setState({ selectedSquare: { row, col }, legalMoves: engine.getLegalMoves(row, col) });
    }
  }, [getEngineSnapshot, setState, send, stopTimer]);

  const selectPromotion = useCallback((promotionType) => {
    const engine = engineRef.current;
    const s = stateRef.current;
    if (!engine || !s.promotionPending) return;

    const { from, to } = s.promotionPending;
    engine.makeMove(from, to, promotionType);
    send({ type: 'move', from, to, promotion: promotionType, white_time: s.whiteTime, black_time: s.blackTime });

    const snapshot = getEngineSnapshot(engine);
    setState({ ...s, ...snapshot, selectedSquare: null, legalMoves: [], promotionPending: null, gameOverData: engine.gameOver ? computeGameOverData(engine, 'online', s.myColor) : null });
    if (engine.gameOver) stopTimer();
  }, [getEngineSnapshot, setState, send, stopTimer]);

  const resign = useCallback(() => {
    if (!confirm('Abandonner ?')) return;
    const engine = engineRef.current;
    const s = stateRef.current;
    if (!engine) return;

    send({ type: 'resign' });
    engine.gameOver = true; engine.result = 'resign'; engine.winner = s.myColor === 'white' ? 'black' : 'white';
    gameInProgressRef.current = false;
    stopTimer();

    setState({ ...s, ...getEngineSnapshot(engine), gameOverData: { icon: '🏳', title: 'Abandon', message: 'Vous avez abandonné.' } });
  }, [send, getEngineSnapshot, setState, stopTimer]);

  const sendChallenge = useCallback((targetUsername, timeLimit) => {
    connect(() => send({ type: 'challenge_invite', target: targetUsername, time: timeLimit }));
  }, [connect, send]);

  const acceptChallenge = useCallback(() => {
    setState({ challengeToast: null });
    send({ type: 'challenge_accept' });
  }, [send, setState]);

  const declineChallenge = useCallback(() => {
    setState({ challengeToast: null });
    send({ type: 'challenge_decline' });
  }, [send, setState]);

  const cancelWaiting = useCallback(() => {
    intentionalCloseRef.current = true;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setState({ lobbyView: 'main', roomCode: null });
  }, [setState]);

  const clearLobbyToast = useCallback(() => setState({ lobbyToast: null }), [setState]);
  const clearChallengeToast = useCallback(() => setState({ challengeToast: null }), [setState]);

  const fetchOnlinePlayers = useCallback(async (authToken) => {
    try {
      const resp = await fetch('/api/online-players', {
        headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {}
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setState({ onlinePlayers: data.players || [] });
    } catch (e) { /* silently ignore */ }
  }, [setState]);

  const cleanup = useCallback(() => {
    stopTimer();
    if (mmTimerRef.current) { clearInterval(mmTimerRef.current); mmTimerRef.current = null; }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    stopPing();
    intentionalCloseRef.current = true;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    gameInProgressRef.current = false;
    reconnectingRef.current = false;
    pendingQueueRef.current = [];
    engineRef.current = null;
    stateRef.current = INITIAL_STATE;
    _forceRender(n => n + 1);
  }, [stopTimer, stopPing]);

  return {
    state: stateRef.current,
    connect,
    createRoom,
    joinRoom,
    startMatchmaking,
    cancelMatchmaking,
    cancelWaiting,
    handleSquareClick,
    selectPromotion,
    resign,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    clearLobbyToast,
    clearChallengeToast,
    fetchOnlinePlayers,
    cleanup,
  };
}
