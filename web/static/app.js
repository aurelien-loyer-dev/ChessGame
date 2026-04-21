/**
 * =========================================================================
 * CHESS ARENA — Main Application Controller
 * =========================================================================
 * Professional modular architecture
 * - Separated online (multiplayer) and offline (AI) game modes
 * - Clean dependency injection
 * - Single responsibility principle
 * =========================================================================
 */

import { $, showToast, hide, show } from './modules/core.js';
import { UIManager } from './modules/ui.js';
import { OnlineGame } from './modules/online.js';
import { OfflineGame } from './modules/offline.js';

/**
 * Application Controller
 */
class ChessApp {
  constructor() {
    // Core engine
    this.engine = new ChessEngine();
    
    // UI Manager
    this.ui = new UIManager();
    
    // Game modes
    this.onlineGame = new OnlineGame(this.ui, this.engine);
    this.offlineGame = new OfflineGame(this.ui, this.engine);
    
    // State
    this.currentMode = 'online';
    this.selectedTime = 300;
    this.selectedDifficulty = 2;
    this.selectedColor = 'white';
    this.username = null;
    this.authToken = localStorage.getItem('chess_token') || null;
    this.userStats = { wins: 0, losses: 0, draws: 0 };

    // Online players polling
    this._playersInterval = null;
    this._pendingChallengeFrom = null; // username who challenged us
    
    // DOM References
    this.modeSelectScreen = $('mode-select-screen');
    this.authScreen = $('auth-screen');
    this.lobbyScreen = $('lobby');
    this.gameScreen = $('game');
    this.lobbyContent = $('lobby-content');
    this.waitingPanel = $('waiting-panel');
    this.matchmakingPanel = $('matchmaking-panel');
    this.lobbyStatus = $('lobby-status');
    this.inputRoom = $('input-room');
    
    // Initialize
    this.setupModeSelectScreen();
    this.setupAuthScreen();
    this.setupEventListeners();
    this.setupGameCallbacks();
  }

  /**
   * Setup entry screen
   */
  setupModeSelectScreen() {
    const btnAuth = $('btn-enter-auth');
    const btnGuest = $('btn-enter-guest');

    btnAuth.addEventListener('click', () => this.enterAuthFlow());

    btnGuest.addEventListener('click', () => {
      this.username = null;
      this.onlineGame.username = this.generateGuestName();
      this.resetLobbyToNormal();
      this.updateStatsBar();

      hide(this.modeSelectScreen);
      this.modeSelectScreen.classList.remove('active');
      show(this.lobbyScreen);
      this.lobbyScreen.classList.add('active');
    });

    // Spawn floating chess piece particles
    this.spawnParticles();
  }

  /**
   * Spawn floating particles for mode selection background
   */
  spawnParticles() {
    const container = $('ms-particles');
    if (!container) return;
    const pieces = ['♔','♕','♖','♗','♘','♙','♚','♛','♜','♝','♞','♟'];
    for (let i = 0; i < 20; i++) {
      const el = document.createElement('span');
      el.className = 'ms-particle';
      el.textContent = pieces[Math.floor(Math.random() * pieces.length)];
      el.style.left = Math.random() * 100 + '%';
      el.style.fontSize = (16 + Math.random() * 24) + 'px';
      el.style.animationDuration = (12 + Math.random() * 18) + 's';
      el.style.animationDelay = -(Math.random() * 20) + 's';
      container.appendChild(el);
    }
  }

  /**
   * Enter authenticated flow
   */
  enterAuthFlow() {
    hide(this.modeSelectScreen);
    this.modeSelectScreen.classList.remove('active');

    if (this.authToken) {
      this.verifyToken(this.authToken).then(user => {
        if (user) {
          this.onAuthSuccess(user.username, this.authToken, user);
        } else {
          this.authToken = null;
          localStorage.removeItem('chess_token');
          this._showAuthScreen();
        }
      });
      return;
    }

    this._showAuthScreen();
  }

  /**
   * Setup auth screen event listeners
   */
  setupAuthScreen() {
    $('tab-login').addEventListener('click', () => this.switchAuthTab('login'));
    $('tab-register').addEventListener('click', () => this.switchAuthTab('register'));
    $('login-form').addEventListener('submit', e => { e.preventDefault(); this.doLogin(); });
    $('register-form').addEventListener('submit', e => { e.preventDefault(); this.doRegister(); });
    $('btn-auth-back').addEventListener('click', () => this.authBack());
  }

  // =========================================================================
  // Auth helpers
  // =========================================================================

  generateGuestName() {
    const adjs  = ['Grand', 'Royal', 'Speedy', 'Silent', 'Golden', 'Silver', 'Iron', 'Mystic'];
    const nouns = ['King', 'Rook', 'Knight', 'Pawn', 'Master', 'Legend', 'Ghost', 'Wolf'];
    return adjs[Math.floor(Math.random() * adjs.length)] + nouns[Math.floor(Math.random() * nouns.length)];
  }

  _showAuthScreen() {
    show(this.authScreen);
    this.authScreen.classList.add('active');
    // Reset forms
    $('login-form').reset();
    $('register-form').reset();
    $('login-error').classList.add('hidden');
    $('register-error').classList.add('hidden');
    this.switchAuthTab('login');
    setTimeout(() => $('login-username').focus(), 100);
  }

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    $('tab-' + tab).classList.add('active');
    if (tab === 'login') {
      $('login-form').classList.remove('hidden');
      $('register-form').classList.add('hidden');
      setTimeout(() => $('login-username').focus(), 50);
    } else {
      $('login-form').classList.add('hidden');
      $('register-form').classList.remove('hidden');
      setTimeout(() => $('register-username').focus(), 50);
    }
  }

  async doLogin() {
    const username = $('login-username').value.trim();
    const password = $('login-password').value.trim();
    const errorEl  = $('login-error');
    errorEl.classList.add('hidden');

    if (!username || !password) {
      errorEl.textContent = 'Remplissez tous les champs';
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      if (!resp.ok) {
        errorEl.textContent = data.error || 'Erreur de connexion';
        errorEl.classList.remove('hidden');
        return;
      }
      this.onAuthSuccess(data.username, data.token, data);
    } catch {
      errorEl.textContent = 'Impossible de joindre le serveur';
      errorEl.classList.remove('hidden');
    }
  }

  async doRegister() {
    const username = $('register-username').value.trim();
    const password = $('register-password').value.trim();
    const errorEl  = $('register-error');
    errorEl.classList.add('hidden');

    if (!username || !password) {
      errorEl.textContent = 'Remplissez tous les champs';
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      if (!resp.ok) {
        errorEl.textContent = data.error || 'Erreur lors de la création';
        errorEl.classList.remove('hidden');
        return;
      }
      this.onAuthSuccess(data.username, data.token, data);
    } catch {
      errorEl.textContent = 'Impossible de joindre le serveur';
      errorEl.classList.remove('hidden');
    }
  }

  async verifyToken(token) {
    try {
      const resp = await fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  /**
   * Called after successful login or register
   * @param {boolean} [transition=true] whether to transition to the lobby
   */
  onAuthSuccess(username, token, stats, transition = true) {
    this.username  = username;
    this.authToken = token;
    this.userStats = { wins: stats.wins || 0, losses: stats.losses || 0, draws: stats.draws || 0 };

    localStorage.setItem('chess_token',    token);
    localStorage.setItem('chess_username', username);

    this.onlineGame.username = username;

    // Hide auth screen
    hide(this.authScreen);
    this.authScreen.classList.remove('active');

    if (transition) {
      this.resetLobbyToNormal();
      this.updateStatsBar();
      show(this.lobbyScreen);
      this.lobbyScreen.classList.add('active');
      this.startPlayersPolling();
    }
  }

  authBack() {
    hide(this.authScreen);
    this.authScreen.classList.remove('active');
    show(this.modeSelectScreen);
    this.modeSelectScreen.classList.add('active');
  }

  // =========================================================================
  // Stats & ranking helpers
  // =========================================================================

  updateStatsBar() {
    const bar = $('player-stats-bar');
    if (!bar) return;

    if (!this.username) {
      bar.classList.add('hidden');
      return;
    }

    $('stats-username').textContent = this.username;
    $('stats-wins').textContent     = this.userStats?.wins   || 0;
    $('stats-draws').textContent    = this.userStats?.draws  || 0;
    $('stats-losses').textContent   = this.userStats?.losses || 0;
    bar.classList.remove('hidden');
  }

  async refreshStats() {
    if (!this.authToken) return;
    try {
      const resp = await fetch('/api/game-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.authToken
        },
        body: JSON.stringify({})
      });
      if (resp.ok) {
        const data = await resp.json();
        this.userStats = { wins: data.wins, losses: data.losses, draws: data.draws };
        this.updateStatsBar();
      }
    } catch (e) {
      console.warn('[App] Failed to refresh stats:', e);
    }
  }

  async showRanking() {
    const overlay = $('ranking-overlay');
    const list    = $('ranking-list');
    overlay.classList.remove('hidden');
    list.innerHTML = '<p class="ranking-loading">Chargement…</p>';

    try {
      const resp = await fetch('/api/ranking');
      const data = await resp.json();

      if (!data.ranking || data.ranking.length === 0) {
        list.innerHTML = '<p class="ranking-loading">Aucun joueur classé pour l\'instant</p>';
        return;
      }

      list.innerHTML = data.ranking.map(p => {
        const rankEmoji = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank;
        const isMe = p.username === this.username;
        return `
          <div class="ranking-row${isMe ? ' ranking-me' : ''}">
            <span class="rank-pos">${rankEmoji}</span>
            <span class="rank-name">${p.username}</span>
            <span class="rank-stats">
              <span class="stat-win">${p.wins}V</span>
              <span class="stat-sep">·</span>
              <span class="stat-draw">${p.draws}N</span>
              <span class="stat-sep">·</span>
              <span class="stat-loss">${p.losses}D</span>
            </span>
            <span class="rank-games">${p.games} partie${p.games !== 1 ? 's' : ''}</span>
          </div>`;
      }).join('');
    } catch {
      list.innerHTML = '<p class="ranking-loading">Erreur de chargement</p>';
    }
  }

  logout() {
    this.stopPlayersPolling();
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_username');
    this.authToken = null;
    this.username  = null;
    this.userStats = { wins: 0, losses: 0, draws: 0 };

    this.onlineGame.cleanup();

    $('player-stats-bar')?.classList.add('hidden');

    hide(this.lobbyScreen);
    this.lobbyScreen.classList.remove('active');
    show(this.modeSelectScreen);
    this.modeSelectScreen.classList.add('active');
  }

  /**
   * Return from lobby to entry screen
   */
  backToEntryFromLobby() {
    this.stopPlayersPolling();
    this.onlineGame.cleanup();
    hide(this.waitingPanel);
    hide(this.matchmakingPanel);
    show(this.lobbyContent);
    hide(this.lobbyStatus);
    $('ranking-overlay')?.classList.add('hidden');
    this.inputRoom.value = '';

    hide(this.lobbyScreen);
    this.lobbyScreen.classList.remove('active');
    show(this.modeSelectScreen);
    this.modeSelectScreen.classList.add('active');
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Time control selection
    document.querySelectorAll('.time-btn[data-time]').forEach(btn => {
      btn.addEventListener('click', () => this.selectTime(parseInt(btn.dataset.time)));
    });
    
    // Mode switch
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
    });

    // Difficulty chips
    document.querySelectorAll('.diff-btn.diff').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn.diff').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = parseInt(btn.dataset.diff);
      });
    });

    // Color chips
    document.querySelectorAll('.color-btn.color-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn.color-pick').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedColor = btn.dataset.color;
      });
    });

    // AI & self-play
    $('btn-play-ai')?.addEventListener('click', () => this.startAIGame());
    $('btn-play-self')?.addEventListener('click', () => this.startSelfGame());

    // Online actions
    $('btn-create')?.addEventListener('click', () => this.createOnlineGame());
    $('btn-join')?.addEventListener('click', () => this.joinOnlineGame());
    $('input-room')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.joinOnlineGame();
    });
    
    // Matchmaking
    $('btn-matchmaking')?.addEventListener('click', () => this.startMatchmaking());
    $('btn-cancel-mm')?.addEventListener('click', () => this.cancelMatchmaking());
    
    // Waiting room actions
    $('btn-copy-code')?.addEventListener('click', () => this.copyRoomCode());
    $('btn-cancel')?.addEventListener('click', () => this.cancelWaiting());
    
    // Game actions
    $('btn-resign')?.addEventListener('click', () => this.resign());
    $('btn-back-menu')?.addEventListener('click', () => this.backToLobby());
    $('btn-new-game')?.addEventListener('click', () => this.backToLobby());

    // Stats bar actions
    $('btn-ranking')?.addEventListener('click', () => this.showRanking());
    $('btn-close-ranking')?.addEventListener('click', () => $('ranking-overlay')?.classList.add('hidden'));
    $('btn-logout')?.addEventListener('click', () => this.logout());

    // Navigation
    $('btn-lobby-back')?.addEventListener('click', () => this.backToEntryFromLobby());

    // Challenge toast actions
    $('btn-challenge-accept')?.addEventListener('click', () => this.acceptChallenge());
    $('btn-challenge-decline')?.addEventListener('click', () => this.declineChallenge());
  }

  /**
   * Setup game callbacks
   */
  setupGameCallbacks() {
    this.onlineGame.onGameEnd = (result) => {
      console.log('[App] Online game ended:', result);
      if (this.authToken) {
        setTimeout(() => this.refreshStats(), 500);
      }
    };
    
    this.offlineGame.onGameEnd = () => {
      console.log('[App] Offline game ended');
    };

    // Challenge callbacks
    this.onlineGame.onChallengeSent = (target) => {
      showToast(this.lobbyStatus, `Défi envoyé à ${target} — en attente…`, 'info');
    };

    this.onlineGame.onChallengeReceived = (from, time) => {
      this._pendingChallengeFrom = from;
      const timeLabel = time === 0 ? '∞' : (Math.floor(time / 60) + ' min');
      $('challenge-from-name').textContent = from;
      $('challenge-time-label').textContent = timeLabel;
      $('challenge-toast').classList.remove('hidden');
    };

    this.onlineGame.onChallengeDeclined = (by) => {
      showToast(this.lobbyStatus, `${by} a refusé le défi.`, 'error');
      // Reset lobby if we were waiting
      this.onlineGame.cleanup();
      hide(this.waitingPanel);
      show(this.lobbyContent);
      hide(this.lobbyStatus);
      setTimeout(() => show(this.lobbyStatus), 0);
    };
  }

  /**
   * Keep only multiplayer UI in lobby
   */
  resetLobbyToNormal() {
    this.switchMode('online');
  }

  /**
   * Select time control
   */
  selectTime(time) {
    this.selectedTime = time;
    
    document.querySelectorAll('.time-btn[data-time]').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.time) === time);
    });
  }

  /**
   * Switch lobby mode (online / ai / self)
   */
  switchMode(mode) {
    this.currentMode = mode;

    // Update mode buttons
    document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show/hide panels
    const onlinePanel = $('online-actions');
    const aiPanel     = $('ai-actions');
    const selfPanel   = $('self-actions');

    hide(onlinePanel);
    hide(aiPanel);
    hide(selfPanel);

    if (mode === 'online')  show(onlinePanel);
    else if (mode === 'ai') show(aiPanel);
    else if (mode === 'self') show(selfPanel);
  }

  /**
   * Start a game against the AI
   */
  startAIGame() {
    let color = this.selectedColor;
    if (color === 'random') {
      color = Math.random() < 0.5 ? 'white' : 'black';
    }
    this.currentMode = 'offline';
    this.offlineGame.startGame(color, this.selectedDifficulty, this.selectedTime);

    hide(this.lobbyScreen);
    this.lobbyScreen.classList.remove('active');
    show(this.gameScreen);
    this.gameScreen.classList.add('active');
  }

  /**
   * Start a local 2-player game
   */
  startSelfGame() {
    this.currentMode = 'offline';
    this.offlineGame.startSelfGame(this.selectedTime);

    hide(this.lobbyScreen);
    this.lobbyScreen.classList.remove('active');
    show(this.gameScreen);
    this.gameScreen.classList.add('active');
  }

  // =========================================================================
  // Online players panel
  // =========================================================================

  /**
   * Start polling for online players (when lobby is shown)
   */
  startPlayersPolling() {
    this.stopPlayersPolling();
    this.fetchOnlinePlayers();
    this._playersInterval = setInterval(() => this.fetchOnlinePlayers(), 5000);
  }

  stopPlayersPolling() {
    if (this._playersInterval) {
      clearInterval(this._playersInterval);
      this._playersInterval = null;
    }
  }

  async fetchOnlinePlayers() {
    // Only show online players panel for authenticated users
    const panel = $('online-players-panel');
    if (!panel) return;
    if (!this.username) {
      panel.classList.add('hidden');
      return;
    }

    try {
      const resp = await fetch('/api/online-players', {
        headers: this.authToken ? { 'Authorization': 'Bearer ' + this.authToken } : {}
      });
      if (!resp.ok) return;
      const data = await resp.json();
      this.renderOnlinePlayers(data.players || []);
    } catch (e) {
      // silently ignore network errors
    }
  }

  renderOnlinePlayers(players) {
    const panel = $('online-players-panel');
    const list  = $('online-players-list');
    const count = $('online-count');
    if (!panel || !list) return;

    count.textContent = players.length;

    if (players.length === 0) {
      list.innerHTML = '<p class="online-empty">Aucun autre joueur en ligne</p>';
      panel.classList.remove('hidden');
      return;
    }

    list.innerHTML = players.map(p => {
      const isAvailable = p.status === 'available';
      return `
        <div class="online-player-row">
          <span class="online-dot ${isAvailable ? 'available' : 'in-game'}"></span>
          <span class="online-name">${p.username}</span>
          <span class="online-status-label">${isAvailable ? 'disponible' : 'en partie'}</span>
          ${isAvailable
            ? `<button class="btn-invite" data-target="${p.username}" title="Inviter à jouer">⚔ Défier</button>`
            : '<span class="btn-invite-disabled">En partie</span>'}
        </div>`;
    }).join('');

    // Wire invite buttons
    list.querySelectorAll('.btn-invite[data-target]').forEach(btn => {
      btn.addEventListener('click', () => this.sendChallenge(btn.dataset.target));
    });

    panel.classList.remove('hidden');
  }

  sendChallenge(targetUsername) {
    if (!this.username) {
      showToast(this.lobbyStatus, 'Connectez-vous pour inviter un joueur.', 'error');
      return;
    }
    this.onlineGame.username = this.username;
    this.onlineGame.sendChallenge(targetUsername, this.selectedTime);
  }

  acceptChallenge() {
    $('challenge-toast').classList.add('hidden');
    this.onlineGame.acceptChallenge();
  }

  declineChallenge() {
    $('challenge-toast').classList.add('hidden');
    this._pendingChallengeFrom = null;
    this.onlineGame.declineChallenge();
  }

  /**
   * Create online game
   */
  createOnlineGame() {
    console.log('[App] Creating online game...');
    this.onlineGame.createRoom(this.selectedTime);
  }

  /**
   * Join online game
   */
  joinOnlineGame() {
    const code = this.inputRoom.value.trim().toUpperCase();
    
    if (!code || code.length < 3) {
      showToast(this.lobbyStatus, 'Code invalide', 'error');
      return;
    }
    
    console.log('[App] Joining room:', code);
    this.onlineGame.joinRoom(code);
  }

  /**
   * Start matchmaking
   */
  startMatchmaking() {
    console.log('[App] Starting matchmaking...');
    
    // Update UI: show matchmaking panel
    hide(this.lobbyContent);
    hide(this.waitingPanel);
    show(this.matchmakingPanel);
    hide(this.lobbyStatus);
    
    // Update time display
    const timeDisplay = $('mm-time-display');
    if (this.selectedTime === 0) {
      timeDisplay.textContent = '∞ Sans limite';
    } else {
      const mins = Math.floor(this.selectedTime / 60);
      timeDisplay.textContent = mins + ' min';
    }
    
    // Reset elapsed
    $('mm-elapsed').textContent = '0:00';
    
    this.onlineGame.startMatchmaking(this.selectedTime);
  }

  /**
   * Cancel matchmaking
   */
  cancelMatchmaking() {
    console.log('[App] Cancelling matchmaking...');
    this.onlineGame.cancelMatchmaking();
    
    hide(this.matchmakingPanel);
    show(this.lobbyContent);
    hide(this.lobbyStatus);
  }

  /**
   * Copy room code to clipboard
   */
  copyRoomCode() {
    const roomCode = this.onlineGame.roomId;
    
    if (!roomCode) return;
    
    navigator.clipboard.writeText(roomCode).then(() => {
      const btn = $('btn-copy-code');
      btn.textContent = '✓ Copié';
      setTimeout(() => {
        btn.textContent = '📋 Copier le code';
      }, 2000);
    }).catch(err => {
      console.error('[App] Failed to copy:', err);
    });
  }

  /**
   * Cancel waiting for opponent
   */
  cancelWaiting() {
    this.onlineGame.cleanup();
    hide(this.waitingPanel);
    hide(this.matchmakingPanel);
    show(this.lobbyContent);
    hide(this.lobbyStatus);
  }

  /**
   * Resign from current game
   */
  resign() {
    if (this.currentMode === 'online') {
      this.onlineGame.resign();
    } else {
      this.offlineGame.resign();
    }
  }

  /**
   * Return to lobby
   */
  backToLobby() {
    console.log('[App] Returning to lobby...');
    
    // Cleanup current game
    if (this.currentMode === 'online') {
      this.onlineGame.cleanup();
    } else {
      this.offlineGame.cleanup();
    }
    
    // Reset UI
    hide(this.gameScreen);
    this.gameScreen.classList.remove('active');
    
    show(this.lobbyScreen);
    this.lobbyScreen.classList.add('active');
    
    hide(this.waitingPanel);
    hide(this.matchmakingPanel);
    show(this.lobbyContent);
    hide(this.lobbyStatus);
    
    this.inputRoom.value = '';
    this.resetLobbyToNormal();

    // Close ranking overlay if open
    $('ranking-overlay')?.classList.add('hidden');

    // Refresh stats bar for multiplayer
    this.updateStatsBar();

    // Resume polling for online players
    this.startPlayersPolling();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] Initializing Chess Arena...');
  window.chessApp = new ChessApp();
  console.log('[App] Ready!');
});
