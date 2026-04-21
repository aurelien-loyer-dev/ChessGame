/**
 * =========================================================================
 * ONLINE GAME MODULE — WebSocket multiplayer with reconnection support
 * =========================================================================
 *
 * Features:
 *   - Automatic reconnection with exponential back-off
 *   - Message queue: moves are buffered while disconnected
 *   - Client-side ping to detect dead connections early
 *   - Full game-state resync after reconnection
 *   - Connection status banner for the player
 * =========================================================================
 */

import { $, showToast, hide, show } from './core.js';

export class OnlineGame {
  constructor(uiManager, engine) {
    this.ui = uiManager;
    this.engine = engine;

    // WebSocket
    this.ws = null;
    this.roomId = null;
    this.myColor = null;

    // Reconnection
    this._reconnecting = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._maxReconnectAttempts = 30;       // try for ~2 min
    this._pingInterval = null;
    this._lastPong = 0;
    this._pendingQueue = [];               // messages queued while offline
    this._gameInProgress = false;          // true once game_start received
    this._intentionalClose = false;        // true when we close on purpose

    // Matchmaking
    this.isMatchmaking = false;
    this.mmElapsedInterval = null;
    this.mmStartTime = null;

    // Timer
    this.timerEnabled = true;
    this.whiteTime = 300;
    this.blackTime = 300;
    this.timerInterval = null;
    this.lastTimerTick = null;

    // DOM
    this.lobbyContent = $('lobby-content');
    this.waitingPanel = $('waiting-panel');
    this.matchmakingPanel = $('matchmaking-panel');
    this.displayRoomCode = $('display-room-code');
    this.lobbyStatus = $('lobby-status');
    this.btnResign = $('btn-resign');
    this.btnBackMenu = $('btn-back-menu');
    this.connBanner = $('connection-banner');
    this.connBannerText = $('connection-banner-text');

    // Callbacks
    this.onGameEnd = null;

    // Username
    this.username = null;
    this.opponentName = null;
  }

  // =======================================================================
  // Connection banner
  // =======================================================================

  _showBanner(text, type) {
    if (!this.connBanner) return;
    this.connBannerText.textContent = text;
    this.connBanner.className = 'connection-banner ' + (type || '');
    show(this.connBanner);
  }

  _hideBanner() {
    if (this.connBanner) hide(this.connBanner);
  }

  // =======================================================================
  // WebSocket lifecycle
  // =======================================================================

  /**
   * Open a new WebSocket connection
   */
  connect(onOpenExtra) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (onOpenExtra) onOpenExtra();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      // Wait for the existing connection to open
      const origOnOpen = this.ws.onopen;
      this.ws.onopen = (ev) => {
        if (origOnOpen) origOnOpen.call(this.ws, ev);
        if (onOpenExtra) onOpenExtra();
      };
      return;
    }

    this._intentionalClose = false;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${protocol}://${location.host}/ws`);

    this.ws.onopen = () => {
      console.log('[Online] WebSocket connected');
      this._lastPong = Date.now();
      this._startPing();

      // Send username
      if (this.username) {
        this.ws.send(JSON.stringify({ type: 'set_username', username: this.username }));
      }

      // If reconnecting mid-game, re-join the room
      if (this._reconnecting && this._gameInProgress && this.roomId && this.myColor) {
        this._reconnecting = false;
        this._reconnectAttempts = 0;
        this._showBanner('Reconnecté — synchronisation…', 'ok');
        this.send({ type: 'reconnect', room_id: this.roomId, color: this.myColor });
        // Request game state from opponent
        setTimeout(() => this.send({ type: 'sync_request' }), 300);
      } else if (this._reconnecting) {
        this._reconnecting = false;
        this._reconnectAttempts = 0;
        this._hideBanner();
      }

      // Flush pending queue
      this._flushQueue();

      if (onOpenExtra) onOpenExtra();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.warn('[Online] Invalid message:', e);
      }
    };

    this.ws.onclose = (ev) => {
      console.log('[Online] WebSocket closed, code:', ev.code);
      this._stopPing();
      this.ws = null;

      if (this._intentionalClose) return;

      // If game in progress, try to reconnect
      if (this._gameInProgress && !this.engine.gameOver) {
        this._attemptReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[Online] WebSocket error', err);
    };
  }

  /**
   * Client-side ping to detect dead connections
   */
  _startPing() {
    this._stopPing();
    this._lastPong = Date.now();

    this._pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // If no response in 12s, connection is probably dead
      if (Date.now() - this._lastPong > 12000) {
        console.warn('[Online] Ping timeout — closing connection');
        this.ws.close();
        return;
      }

      // Send a lightweight ping message
      try {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      } catch (e) {
        // ignore
      }
    }, 5000);
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  // =======================================================================
  // Reconnection
  // =======================================================================

  _attemptReconnect() {
    if (this._reconnecting) return;
    this._reconnecting = true;
    this._reconnectAttempts = 0;
    this._doReconnect();
  }

  _doReconnect() {
    if (this._intentionalClose || this.engine.gameOver) {
      this._reconnecting = false;
      this._hideBanner();
      return;
    }

    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.log('[Online] Max reconnect attempts reached');
      this._reconnecting = false;
      this._showBanner('Connexion perdue', 'error');
      // After a long timeout, declare disconnect
      this.engine.gameOver = true;
      this.engine.result = 'disconnect';
      this.engine.winner = null;
      this.stopTimer();
      this.showGameOver();
      return;
    }

    this._reconnectAttempts++;
    // Exponential back-off: 500ms, 1s, 2s, 4s… capped at 5s
    const delay = Math.min(500 * Math.pow(1.5, this._reconnectAttempts - 1), 5000);
    this._showBanner(`Reconnexion… (${this._reconnectAttempts})`, 'warning');
    console.log(`[Online] Reconnect attempt ${this._reconnectAttempts} in ${Math.round(delay)}ms`);

    this._reconnectTimer = setTimeout(() => {
      this.connect();
      // If connect didn't trigger onopen quickly, schedule next attempt
      setTimeout(() => {
        if (this._reconnecting && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this._doReconnect();
        }
      }, 3000);
    }, delay);
  }

  // =======================================================================
  // Message queue (buffer moves while disconnected)
  // =======================================================================

  /**
   * Send a message, or queue it if disconnected
   */
  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else if (this._gameInProgress && message.type === 'move') {
      // Queue important messages (moves) to replay after reconnect
      this._pendingQueue.push(message);
      console.log('[Online] Move queued for reconnect, queue size:', this._pendingQueue.length);
    }
  }

  _flushQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this._pendingQueue.length > 0) {
      const msg = this._pendingQueue.shift();
      console.log('[Online] Flushing queued message:', msg.type);
      this.ws.send(JSON.stringify(msg));
    }
  }

  // =======================================================================
  // Message handler
  // =======================================================================

  handleMessage(msg) {
    // Any message from server = connection alive
    this._lastPong = Date.now();

    switch (msg.type) {
      case 'room_created':
        this.roomId = msg.room_id;
        this.displayRoomCode.textContent = msg.room_id;
        hide(this.lobbyContent);
        show(this.waitingPanel);
        hide(this.lobbyStatus);
        break;

      case 'game_start':
        this.myColor = msg.color;
        this.roomId = msg.room_id;
        this.opponentName = msg.opponent_name || null;
        this.ui.boardFlipped = this.myColor === 'black';
        this._gameInProgress = true;

        // Stop matchmaking if active
        if (this.isMatchmaking) {
          this.isMatchmaking = false;
          this.stopMatchmakingTimer();
        }

        if (msg.time > 0) {
          this.timerEnabled = true;
          this.whiteTime = msg.time;
          this.blackTime = msg.time;
        } else {
          this.timerEnabled = false;
        }

        this.startGame();
        break;

      case 'move':
        this.engine.applyNetworkMove(msg.from, msg.to, msg.promotion || null);

        if (msg.white_time !== undefined) {
          this.whiteTime = msg.white_time;
          this.blackTime = msg.black_time;
        }

        this.syncUI();

        if (this.engine.gameOver) {
          this.stopTimer();
          this.showGameOver();
        }
        break;

      case 'reconnected':
        // Successfully reconnected to our room
        console.log('[Online] Reconnected to room', msg.room_id);
        this._showBanner('Reconnecté ✓', 'ok');
        setTimeout(() => this._hideBanner(), 2000);
        break;

      case 'reconnect_failed':
        console.warn('[Online] Reconnect failed:', msg.reason);
        this._showBanner('Reconnexion échouée', 'error');
        this._gameInProgress = false;
        this._reconnecting = false;
        break;

      case 'opponent_reconnected':
        console.log('[Online] Opponent reconnected');
        this._showBanner('Adversaire reconnecté ✓', 'ok');
        setTimeout(() => this._hideBanner(), 2000);
        break;

      case 'sync_request':
        // Opponent is asking us for the full move history
        this._sendSyncState();
        break;

      case 'sync_state':
        // We received full game state from opponent after reconnection
        this._applySyncState(msg);
        break;

      case 'opponent_resigned':
        this.engine.gameOver = true;
        this.engine.result = 'resign';
        this.engine.winner = this.myColor;
        this.stopTimer();
        this.showGameOver();
        break;

      case 'opponent_disconnected':
        // Don't end game immediately — wait for reconnection
        if (this._gameInProgress && !this.engine.gameOver) {
          this._showBanner('Adversaire déconnecté — en attente…', 'warning');
          // They have 120s to reconnect (server-side timeout)
        }
        // If game is already over, ignore — no fake "disconnect victory"
        break;

      case 'opponent_disconnected_final':
        // Server confirmed opponent is gone for good
        if (!this.engine.gameOver) {
          this._hideBanner();
          this.engine.gameOver = true;
          this.engine.result = 'disconnect';
          this.engine.winner = this.myColor;
          this.stopTimer();
          this.showGameOver();
        }
        // If game already over, ignore
        break;

      case 'timeout':
        this.engine.gameOver = true;
        this.engine.result = 'timeout';
        this.engine.winner = msg.winner;
        this.stopTimer();
        this.showGameOver();
        break;

      case 'error':
        showToast(this.lobbyStatus, msg.message, 'error');
        break;

      case 'matchmaking_waiting':
        console.log('[Online] In matchmaking queue, size:', msg.queue_size);
        break;

      case 'matchmaking_cancelled':
        console.log('[Online] Matchmaking cancelled');
        this.isMatchmaking = false;
        this.stopMatchmakingTimer();
        break;

      case 'challenge_sent':
        console.log('[Online] Challenge sent to', msg.target);
        if (this.onChallengeSent) this.onChallengeSent(msg.target);
        break;

      case 'challenge_received':
        console.log('[Online] Challenge received from', msg.from);
        if (this.onChallengeReceived) this.onChallengeReceived(msg.from, msg.time);
        break;

      case 'challenge_declined':
        console.log('[Online] Challenge declined by', msg.by);
        if (this.onChallengeDeclined) this.onChallengeDeclined(msg.by);
        break;

      case 'challenge_error':
        showToast(this.lobbyStatus, msg.message, 'error');
        break;
    }
  }

  // =======================================================================
  // Game state sync (after reconnection)
  // =======================================================================

  /**
   * Send our full move history + times to the opponent
   */
  _sendSyncState() {
    const moves = this.engine.moveHistory.map(m => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion || null
    }));
    this.send({
      type: 'sync_state',
      moves: moves,
      white_time: this.whiteTime,
      black_time: this.blackTime
    });
  }

  /**
   * Apply received game state (replay all moves from scratch)
   */
  _applySyncState(msg) {
    const moves = msg.moves || [];
    const myMoveCount = this.engine.moveHistory.length;

    if (moves.length <= myMoveCount) {
      // We're already up to date or ahead — nothing to do
      console.log('[Online] Sync: already up to date (' + myMoveCount + ' moves)');
      this._hideBanner();
      return;
    }

    // Apply only the missing moves
    console.log('[Online] Sync: applying ' + (moves.length - myMoveCount) + ' missing moves');
    for (let i = myMoveCount; i < moves.length; i++) {
      const m = moves[i];
      this.engine.applyNetworkMove(m.from, m.to, m.promotion);
    }

    // Sync timers
    if (msg.white_time !== undefined) {
      this.whiteTime = msg.white_time;
      this.blackTime = msg.black_time;
    }

    this.syncUI();
    this._showBanner('Synchronisé ✓', 'ok');
    setTimeout(() => this._hideBanner(), 2000);

    if (this.engine.gameOver) {
      this.stopTimer();
      this.showGameOver();
    }
  }

  // =======================================================================
  // Room & matchmaking actions
  // =======================================================================

  /**
   * Send a challenge to a specific player
   */
  sendChallenge(targetUsername, timeLimit) {
    this.connect(() => {
      this.send({ type: 'challenge_invite', target: targetUsername, time: timeLimit });
    });
  }

  /**
   * Accept an incoming challenge
   */
  acceptChallenge() {
    this.send({ type: 'challenge_accept' });
  }

  /**
   * Decline an incoming challenge
   */
  declineChallenge() {
    this.send({ type: 'challenge_decline' });
  }

  /**
   * Create a new room
   */
  createRoom(timeLimit) {
    this.connect(() => {
      this.send({ type: 'create_room', time: timeLimit });
    });
  }

  /**
   * Join existing room
   */
  joinRoom(roomCode) {
    this.connect(() => {
      this.send({ type: 'join_room', room_id: roomCode });
    });
  }

  /**
   * Start matchmaking
   */
  startMatchmaking(timeLimit) {
    this.isMatchmaking = true;
    this.connect(() => {
      this.send({ type: 'matchmaking_join', time: timeLimit });
      this.startMatchmakingTimer();
    });
  }

  /**
   * Cancel matchmaking
   */
  cancelMatchmaking() {
    this.isMatchmaking = false;
    this.stopMatchmakingTimer();
    this.send({ type: 'matchmaking_cancel' });
    this._intentionalClose = true;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Start matchmaking elapsed timer
   */
  startMatchmakingTimer() {
    this.mmStartTime = Date.now();
    const elapsedEl = $('mm-elapsed');

    this.mmElapsedInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.mmStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      elapsedEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  }

  /**
   * Stop matchmaking elapsed timer
   */
  stopMatchmakingTimer() {
    if (this.mmElapsedInterval) {
      clearInterval(this.mmElapsedInterval);
      this.mmElapsedInterval = null;
    }
  }

  // =======================================================================
  // Game flow
  // =======================================================================

  /**
   * Start the game
   */
  startGame() {
    this.engine.reset();
    this.ui.reset();
    this.ui.myColor = this.myColor;

    hide($('lobby'));
    show($('game'));
    $('game').classList.add('active');
    hide(this.ui.gameOverModal);
    hide(this.btnBackMenu);
    show(this.btnResign);
    this._hideBanner();

    this.ui.updatePlayerInfo(this.myColor, 'online', null, this.opponentName, this.username);
    this.ui.buildBoard(this.engine, (r, c) => this.onSquareClick(r, c));
    this.syncUI();

    if (this.timerEnabled) {
      this.startTimer();
    }
  }

  /**
   * Handle square click
   */
  onSquareClick(row, col) {
    if (this.engine.gameOver || this.engine.turn !== this.myColor) {
      return;
    }

    const piece = this.engine.getPiece(row, col);

    // Handle selection
    if (this.ui.selectedSquare) {
      // Click same square - deselect
      if (row === this.ui.selectedSquare.row && col === this.ui.selectedSquare.col) {
        this.ui.deselectSquare();
        this.ui.renderBoard(this.engine);
        return;
      }

      // Click own piece - change selection
      if (piece?.color === this.myColor) {
        this.ui.selectSquare(row, col, this.engine);
        this.ui.renderBoard(this.engine);
        return;
      }

      // Try to make move
      const move = this.ui.legalMoves.find(m =>
        m.to.row === row && m.to.col === col
      );

      if (move) {
        // Handle promotion
        if (move.promotion) {
          this.ui.showPromotionDialog((promotionType) => {
            this.makeMove(
              { ...this.ui.selectedSquare },
              { row, col },
              promotionType
            );
          });
          return;
        }

        // Normal move
        this.makeMove({ ...this.ui.selectedSquare }, { row, col });
      } else {
        // Invalid move - deselect
        this.ui.deselectSquare();
        this.ui.renderBoard(this.engine);
      }
    } else if (piece?.color === this.myColor) {
      // Select piece
      this.ui.selectSquare(row, col, this.engine);
      this.ui.renderBoard(this.engine);
    }
  }

  /**
   * Make a move
   */
  makeMove(from, to, promotion = null) {
    if (this.engine.makeMove(from, to, promotion)) {
      // Send move to server (queued if disconnected)
      this.send({
        type: 'move',
        from,
        to,
        promotion,
        white_time: this.whiteTime,
        black_time: this.blackTime
      });

      this.ui.deselectSquare();
      this.syncUI();

      if (this.engine.gameOver) {
        this.stopTimer();
        this.showGameOver();
      }
    }
  }

  /**
   * Sync UI with game state
   */
  syncUI() {
    this.ui.updateCapturedPieces(this.engine);
    this.ui.renderBoard(this.engine);
    this.ui.updateStatus(this.engine, 'online');
    this.ui.updateMoveHistory(this.engine);
    this.ui.updateTimerDisplay(this.whiteTime, this.blackTime, this.timerEnabled);
  }

  /**
   * Resign from game
   */
  resign() {
    if (!confirm('Abandonner ?')) return;

    this.send({ type: 'resign' });

    this.engine.gameOver = true;
    this.engine.result = 'resign';
    this.engine.winner = this.myColor === 'white' ? 'black' : 'white';
    this._gameInProgress = false;
    this.stopTimer();

    this.ui.gameOverIcon.textContent = '🏳';
    this.ui.gameOverTitle.textContent = 'Abandon';
    this.ui.gameOverMessage.textContent = 'Vous avez abandonné.';

    show(this.ui.gameOverModal);
    hide(this.btnResign);
    show(this.btnBackMenu);

    if (this.onGameEnd) this.onGameEnd('loss');
  }

  /**
   * Show game over
   */
  showGameOver() {
    this._gameInProgress = false;
    this.ui.showGameOver(this.engine, 'online');
    hide(this.btnResign);
    show(this.btnBackMenu);

    // Compute result relative to this player
    let result = null;
    if (this.engine.result === 'stalemate' || this.engine.result === 'draw') {
      result = 'draw';
    } else if (this.engine.winner === this.myColor) {
      result = 'win';
    } else if (this.engine.winner !== null) {
      result = 'loss';
    }

    // Notify server about game end (for server-side stat recording)
    if (this.engine.result && this.engine.result !== 'disconnect') {
      this.send({
        type: 'game_end',
        result: this.engine.result,
        winner: this.engine.winner || null
      });
    }

    if (this.onGameEnd) {
      this.onGameEnd(result);
    }
  }

  // =======================================================================
  // Timer
  // =======================================================================

  startTimer() {
    this.stopTimer();
    this.lastTimerTick = Date.now();
    this.timerInterval = setInterval(() => this.tickTimer(), 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  tickTimer() {
    if (!this.timerEnabled || this.engine.gameOver) {
      this.stopTimer();
      return;
    }

    const deltaTime = (Date.now() - this.lastTimerTick) / 1000;
    this.lastTimerTick = Date.now();

    if (this.engine.turn === 'white') {
      this.whiteTime -= deltaTime;

      if (this.whiteTime <= 0) {
        this.whiteTime = 0;
        this.engine.gameOver = true;
        this.engine.result = 'timeout';
        this.engine.winner = 'black';

        this.stopTimer();
        this.send({ type: 'timeout', loser: 'white' });
        this.ui.updateTimerDisplay(this.whiteTime, this.blackTime, this.timerEnabled);
        this.showGameOver();
        return;
      }
    } else {
      this.blackTime -= deltaTime;

      if (this.blackTime <= 0) {
        this.blackTime = 0;
        this.engine.gameOver = true;
        this.engine.result = 'timeout';
        this.engine.winner = 'white';

        this.stopTimer();
        this.send({ type: 'timeout', loser: 'black' });
        this.ui.updateTimerDisplay(this.whiteTime, this.blackTime, this.timerEnabled);
        this.showGameOver();
        return;
      }
    }

    this.ui.updateTimerDisplay(this.whiteTime, this.blackTime, this.timerEnabled);
  }

  // =======================================================================
  // Cleanup
  // =======================================================================

  cleanup() {
    this.stopTimer();
    this.stopMatchmakingTimer();
    this.isMatchmaking = false;
    this._gameInProgress = false;
    this._reconnecting = false;
    this._pendingQueue = [];
    this._intentionalClose = true;
    this._stopPing();
    this._hideBanner();

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.roomId = null;
    this.myColor = null;
  }
}
