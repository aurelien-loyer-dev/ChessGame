import { useEffect, useMemo, useState } from 'react';
import { useOfflineGame } from './hooks/useOfflineGame.js';
import { useOnlineGame } from './hooks/useOnlineGame.js';
import { PIECE_SYMBOLS } from './lib/chess.js';
import { PIECE_ORDER, PIECE_VALUES_DISPLAY, formatTime, generateGuestName } from './utils.js';

const TIME_OPTIONS = [0, 60, 180, 300, 600, 900, 1800];

function getStatusText(state, variant) {
  if (state.gameOver) {
    return 'Partie terminée';
  }
  if (variant === 'self') {
    return state.turn === 'white' ? 'Tour des blancs' : 'Tour des noirs';
  }
  if (state.turn === state.myColor) {
    return 'A vous de jouer';
  }
  if (variant === 'ai' && state.aiThinking) {
    return 'Stockfish reflechit...';
  }
  return variant === 'ai' ? "Tour de l'IA" : 'Tour adverse';
}

function colorLabel(color) {
  return color === 'white' ? 'Blancs' : 'Noirs';
}

function calcAdvantage(myCaptured, opponentCaptured) {
  const myMaterial = myCaptured.reduce((sum, type) => sum + (PIECE_VALUES_DISPLAY[type] || 0), 0);
  const oppMaterial = opponentCaptured.reduce((sum, type) => sum + (PIECE_VALUES_DISPLAY[type] || 0), 0);
  return myMaterial - oppMaterial;
}

function renderCapturedList(captured, pieceColor) {
  return [...captured]
    .sort((a, b) => PIECE_ORDER.indexOf(a) - PIECE_ORDER.indexOf(b))
    .map((type, idx) => <span key={type + idx}>{PIECE_SYMBOLS[type][pieceColor]}</span>);
}

export function App() {
  const [screen, setScreen] = useState('mode');
  const [currentMode, setCurrentMode] = useState('online');
  const [selectedTime, setSelectedTime] = useState(300);
  const [selectedDifficulty, setSelectedDifficulty] = useState(2);
  const [selectedColor, setSelectedColor] = useState('white');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [rankingOpen, setRankingOpen] = useState(false);
  const [rankingRows, setRankingRows] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  const [authTab, setAuthTab] = useState('login');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');

  const [username, setUsername] = useState(localStorage.getItem('chess_username') || null);
  const [guestName, setGuestName] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('chess_token') || null);
  const [userStats, setUserStats] = useState({ wins: 0, losses: 0, draws: 0 });

  const onlineIdentity = username || guestName || null;
  const onlineGame = useOnlineGame(onlineIdentity);
  const offlineGame = useOfflineGame();

  const gameSource = onlineGame.state.active ? 'online' : offlineGame.state.active ? 'offline' : null;
  const gameState = gameSource === 'online' ? onlineGame.state : offlineGame.state;

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authToken }),
        });
        if (!resp.ok) {
          if (!cancelled) {
            setAuthToken(null);
            localStorage.removeItem('chess_token');
          }
          return;
        }
        const data = await resp.json();
        if (!cancelled) {
          setUsername(data.username || null);
          setUserStats({ wins: data.wins || 0, losses: data.losses || 0, draws: data.draws || 0 });
        }
      } catch {
        if (!cancelled) {
          setAuthToken(null);
          localStorage.removeItem('chess_token');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!username || screen !== 'lobby') return undefined;
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      await onlineGame.fetchOnlinePlayers(authToken);
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [username, authToken, screen, onlineGame]);

  useEffect(() => {
    if (onlineGame.state.active || offlineGame.state.active) {
      setScreen('game');
    }
  }, [onlineGame.state.active, offlineGame.state.active]);

  const onlinePlayerRows = useMemo(() => onlineGame.state.onlinePlayers || [], [onlineGame.state.onlinePlayers]);

  const doAuthSuccess = (data) => {
    setUsername(data.username);
    setAuthToken(data.token);
    setGuestName(null);
    setUserStats({ wins: data.wins || 0, losses: data.losses || 0, draws: data.draws || 0 });
    localStorage.setItem('chess_username', data.username);
    localStorage.setItem('chess_token', data.token);
    setScreen('lobby');
  };

  const enterAsGuest = () => {
    setGuestName(generateGuestName());
    setScreen('lobby');
  };

  const doLogin = async (event) => {
    event.preventDefault();
    setLoginError('');

    const user = loginUsername.trim();
    const pwd = loginPassword.trim();
    if (!user || !pwd) {
      setLoginError('Remplissez tous les champs');
      return;
    }

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pwd }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setLoginError(data.error || 'Erreur de connexion');
        return;
      }
      doAuthSuccess(data);
    } catch {
      setLoginError('Impossible de joindre le serveur');
    }
  };

  const doRegister = async (event) => {
    event.preventDefault();
    setRegisterError('');

    const user = registerUsername.trim();
    const pwd = registerPassword.trim();
    if (!user || !pwd) {
      setRegisterError('Remplissez tous les champs');
      return;
    }

    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pwd }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setRegisterError(data.error || "Erreur lors de la creation");
        return;
      }
      doAuthSuccess(data);
    } catch {
      setRegisterError('Impossible de joindre le serveur');
    }
  };

  const startAIGame = () => {
    const picked = selectedColor === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : selectedColor;
    offlineGame.startAIGame(picked, selectedDifficulty, selectedTime);
  };

  const startSelfGame = () => {
    offlineGame.startSelfGame(selectedTime);
  };

  const backToLobby = () => {
    onlineGame.cleanup();
    offlineGame.cleanup();
    setScreen('lobby');
    setCurrentMode('online');
    setRoomCodeInput('');
  };

  const leaveLobbyToEntry = () => {
    onlineGame.cleanup();
    setScreen('mode');
    setCurrentMode('online');
    setRoomCodeInput('');
  };

  const logout = () => {
    onlineGame.cleanup();
    offlineGame.cleanup();
    setUsername(null);
    setAuthToken(null);
    setGuestName(null);
    setUserStats({ wins: 0, losses: 0, draws: 0 });
    localStorage.removeItem('chess_token');
    localStorage.removeItem('chess_username');
    setScreen('mode');
  };

  const showRanking = async () => {
    setRankingOpen(true);
    setRankingLoading(true);
    try {
      const resp = await fetch('/api/ranking');
      const data = await resp.json();
      setRankingRows(data.ranking || []);
    } catch {
      setRankingRows([]);
    } finally {
      setRankingLoading(false);
    }
  };

  const copyRoomCode = async () => {
    if (!onlineGame.state.roomCode) return;
    try {
      await navigator.clipboard.writeText(onlineGame.state.roomCode);
      onlineGame.clearLobbyToast();
    } catch {
      // ignore
    }
  };

  const joinOnlineGame = () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code || code.length < 3) {
      return;
    }
    onlineGame.joinRoom(code);
  };

  const activeVariant = gameState.variant;
  const statusText = gameState ? getStatusText(gameState, activeVariant) : '';

  const myCaptured = gameState
    ? gameState.myColor === 'white'
      ? gameState.capturedByWhite
      : gameState.capturedByBlack
    : [];
  const oppCaptured = gameState
    ? gameState.myColor === 'white'
      ? gameState.capturedByBlack
      : gameState.capturedByWhite
    : [];
  const oppColor = gameState?.myColor === 'white' ? 'black' : 'white';
  const advantage = calcAdvantage(myCaptured, oppCaptured);

  const boardSquares = useMemo(() => {
    if (!gameState?.board) return [];
    const entries = [];
    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const row = gameState.boardFlipped ? 7 - displayRow : displayRow;
        const col = gameState.boardFlipped ? 7 - displayCol : displayCol;
        const piece = gameState.board[row][col];
        const legal = gameState.legalMoves?.some((m) => m.to.row === row && m.to.col === col);
        const selected = gameState.selectedSquare?.row === row && gameState.selectedSquare?.col === col;
        const lastMove = !!gameState.lastMove && (
          (gameState.lastMove.from.row === row && gameState.lastMove.from.col === col) ||
          (gameState.lastMove.to.row === row && gameState.lastMove.to.col === col)
        );
        const inCheck = gameState.kingInCheck?.row === row && gameState.kingInCheck?.col === col;
        const attacker = gameState.checkAttackers?.some((a) => a.row === row && a.col === col);

        entries.push({ row, col, piece, legal, selected, lastMove, inCheck, attacker });
      }
    }
    return entries;
  }, [gameState]);

  const handleBoardClick = (row, col) => {
    if (gameSource === 'online') {
      onlineGame.handleSquareClick(row, col);
    } else {
      offlineGame.handleSquareClick(row, col);
    }
  };

  const selectPromotion = (pieceType) => {
    if (gameSource === 'online') {
      onlineGame.selectPromotion(pieceType);
    } else {
      offlineGame.selectPromotion(pieceType);
    }
  };

  const resign = () => {
    if (gameSource === 'online') {
      onlineGame.resign();
    } else {
      offlineGame.resign();
    }
  };

  return (
    <div className="app-root">
      {screen === 'mode' && (
        <div className="screen active center-screen">
          <div className="panel large">
            <h1>Chess Arena</h1>
            <p className="subtitle">Joue maintenant avec ou sans compte.</p>
            <div className="btn-grid">
              <button className="btn-main" onClick={() => setScreen('auth')}>Connexion / Inscription</button>
              <button className="btn-secondary" onClick={enterAsGuest}>Jouer en invite</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'auth' && (
        <div className="screen active center-screen">
          <div className="panel auth-panel">
            <h2>Authentification</h2>
            <div className="tabs">
              <button className={authTab === 'login' ? 'active' : ''} onClick={() => setAuthTab('login')}>Connexion</button>
              <button className={authTab === 'register' ? 'active' : ''} onClick={() => setAuthTab('register')}>Inscription</button>
            </div>

            {authTab === 'login' ? (
              <form onSubmit={doLogin} className="form-col">
                <input value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="Pseudo" maxLength={20} />
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Mot de passe" />
                {loginError && <p className="error-text">{loginError}</p>}
                <button className="btn-main" type="submit">Se connecter</button>
              </form>
            ) : (
              <form onSubmit={doRegister} className="form-col">
                <input value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} placeholder="Pseudo" maxLength={20} />
                <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="Mot de passe" />
                {registerError && <p className="error-text">{registerError}</p>}
                <button className="btn-main" type="submit">Creer le compte</button>
              </form>
            )}

            <button className="btn-link" onClick={() => setScreen('mode')}>Retour accueil</button>
          </div>
        </div>
      )}

      {screen === 'lobby' && (
        <div className="screen active center-screen">
          <div className="panel lobby-panel">
            <div className="lobby-head">
              <button className="btn-link" onClick={leaveLobbyToEntry}>Retour</button>
              <h2>Lobby</h2>
              {username ? <button className="btn-link" onClick={logout}>Deconnexion</button> : <span />}
            </div>

            {username && (
              <div className="stats-bar">
                <span>{username}</span>
                <span>{userStats.wins}V · {userStats.draws}N · {userStats.losses}D</span>
                <button className="btn-link" onClick={showRanking}>Classement</button>
              </div>
            )}

            <div className="mode-switch">
              <button className={currentMode === 'online' ? 'active' : ''} onClick={() => setCurrentMode('online')}>En ligne</button>
              <button className={currentMode === 'ai' ? 'active' : ''} onClick={() => setCurrentMode('ai')}>IA</button>
              <button className={currentMode === 'self' ? 'active' : ''} onClick={() => setCurrentMode('self')}>Local</button>
            </div>

            <div className="time-grid">
              {TIME_OPTIONS.map((time) => (
                <button key={time} className={selectedTime === time ? 'active' : ''} onClick={() => setSelectedTime(time)}>
                  {time === 0 ? '∞' : `${Math.floor(time / 60)} min`}
                </button>
              ))}
            </div>

            {currentMode === 'online' && (
              <>
                {onlineGame.state.lobbyView === 'main' && (
                  <div className="action-stack">
                    <button className="btn-main" onClick={() => onlineGame.startMatchmaking(selectedTime)}>Trouver un adversaire</button>
                    <div className="row-wrap">
                      <button className="btn-secondary" onClick={() => onlineGame.createRoom(selectedTime)}>Creer un salon</button>
                      <input
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                        placeholder="CODE"
                        maxLength={5}
                      />
                      <button className="btn-secondary" onClick={joinOnlineGame}>Rejoindre</button>
                    </div>

                    {onlineGame.state.lobbyToast && (
                      <div className={`toast ${onlineGame.state.lobbyToast.type || 'info'}`}>
                        <span>{onlineGame.state.lobbyToast.text}</span>
                        <button className="btn-link" onClick={onlineGame.clearLobbyToast}>x</button>
                      </div>
                    )}

                    {username && (
                      <div className="online-list">
                        <div className="online-head">Joueurs en ligne: {onlinePlayerRows.length}</div>
                        {onlinePlayerRows.length === 0 && <p className="small-muted">Aucun autre joueur en ligne</p>}
                        {onlinePlayerRows.map((p) => (
                          <div className="online-row" key={p.username}>
                            <span>{p.username}</span>
                            <span className={p.status === 'available' ? 'state-available' : 'state-busy'}>
                              {p.status === 'available' ? 'disponible' : 'en partie'}
                            </span>
                            {p.status === 'available' ? (
                              <button className="btn-link" onClick={() => onlineGame.sendChallenge(p.username, selectedTime)}>Defier</button>
                            ) : (
                              <span className="small-muted">indisponible</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {onlineGame.state.challengeToast && (
                      <div className="toast info">
                        <span>
                          {onlineGame.state.challengeToast.from} vous defie ({onlineGame.state.challengeToast.time === 0
                            ? '∞'
                            : `${Math.floor(onlineGame.state.challengeToast.time / 60)} min`})
                        </span>
                        <div className="inline-actions">
                          <button className="btn-link" onClick={onlineGame.acceptChallenge}>Accepter</button>
                          <button className="btn-link" onClick={onlineGame.declineChallenge}>Refuser</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {onlineGame.state.lobbyView === 'waiting' && (
                  <div className="action-stack">
                    <p>Code du salon: <strong>{onlineGame.state.roomCode || '-----'}</strong></p>
                    <button className="btn-secondary" onClick={copyRoomCode}>Copier le code</button>
                    <button className="btn-link" onClick={onlineGame.cancelWaiting}>Annuler</button>
                  </div>
                )}

                {onlineGame.state.lobbyView === 'matchmaking' && (
                  <div className="action-stack">
                    <p>Recherche d'un adversaire...</p>
                    <p className="small-muted">Temps ecoule: {formatTime(onlineGame.state.mmElapsed || 0)}</p>
                    <button className="btn-link" onClick={onlineGame.cancelMatchmaking}>Annuler</button>
                  </div>
                )}
              </>
            )}

            {currentMode === 'ai' && (
              <div className="action-stack">
                <div className="row-wrap">
                  <span>Niveau:</span>
                  {[1, 2, 3, 4].map((lvl) => (
                    <button key={lvl} className={selectedDifficulty === lvl ? 'active' : ''} onClick={() => setSelectedDifficulty(lvl)}>
                      {lvl === 1 ? 'Facile' : lvl === 2 ? 'Moyen' : lvl === 3 ? 'Difficile' : 'Expert'}
                    </button>
                  ))}
                </div>
                <div className="row-wrap">
                  <span>Couleur:</span>
                  {['white', 'random', 'black'].map((clr) => (
                    <button key={clr} className={selectedColor === clr ? 'active' : ''} onClick={() => setSelectedColor(clr)}>
                      {clr === 'white' ? 'Blancs' : clr === 'black' ? 'Noirs' : 'Aleatoire'}
                    </button>
                  ))}
                </div>
                <button className="btn-main" onClick={startAIGame}>Jouer contre l'IA</button>
              </div>
            )}

            {currentMode === 'self' && (
              <div className="action-stack">
                <button className="btn-main" onClick={startSelfGame}>Jouer en local (2 joueurs)</button>
              </div>
            )}
          </div>

          {rankingOpen && (
            <div className="overlay" onClick={() => setRankingOpen(false)}>
              <div className="dialog" onClick={(e) => e.stopPropagation()}>
                <h3>Classement</h3>
                {rankingLoading && <p>Chargement...</p>}
                {!rankingLoading && rankingRows.length === 0 && <p>Aucun joueur classe pour l'instant</p>}
                {!rankingLoading && rankingRows.length > 0 && (
                  <div className="ranking-list">
                    {rankingRows.map((r) => (
                      <div className="ranking-row" key={r.username}>
                        <span>{r.rank}</span>
                        <span>{r.username}</span>
                        <span>{r.wins}V · {r.draws}N · {r.losses}D</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-link" onClick={() => setRankingOpen(false)}>Fermer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {screen === 'game' && gameState && (
        <div className="screen active game-screen">
          <div className="game-main">
            <div className={`player-row ${activeVariant === 'self' ? (gameState.turn === 'black' ? 'active-turn' : '') : (gameState.turn !== gameState.myColor ? 'active-turn' : '')}`}>
              <span className="piece-dot">{gameState.myColor === 'white' ? '♚' : '♔'}</span>
              <span className="player-name">
                {activeVariant === 'self' ? 'Noirs' : (gameState.opponentName || (activeVariant === 'ai' ? 'IA' : 'Adversaire'))}
              </span>
              <div className="captured-row">{renderCapturedList(oppCaptured, gameState.myColor)}</div>
              <span className="advantage">{advantage < 0 ? `+${Math.abs(advantage)}` : ''}</span>
              {gameState.timerEnabled && <span className={((gameState.myColor === 'white' ? gameState.blackTime : gameState.whiteTime) < 30) ? 'timer low-time' : 'timer'}>{formatTime(gameState.myColor === 'white' ? gameState.blackTime : gameState.whiteTime)}</span>}
            </div>

            <div className="board-wrap">
              <div className="board-grid">
                {boardSquares.map((sq) => {
                  const isLight = (sq.row + sq.col) % 2 === 0;
                  const cls = [
                    'square',
                    isLight ? 'light' : 'dark',
                    sq.selected ? 'selected' : '',
                    sq.legal ? (sq.piece ? 'legal-capture' : 'legal-move') : '',
                    sq.lastMove ? 'last-move' : '',
                    sq.inCheck ? 'check-square' : '',
                    sq.attacker ? 'check-attacker' : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <button key={`${sq.row}-${sq.col}`} className={cls} onClick={() => handleBoardClick(sq.row, sq.col)}>
                      {sq.piece && <span className={`piece ${sq.piece.color}-piece`}>{PIECE_SYMBOLS[sq.piece.type][sq.piece.color]}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`player-row ${activeVariant === 'self' ? (gameState.turn === 'white' ? 'active-turn' : '') : (gameState.turn === gameState.myColor ? 'active-turn' : '')}`}>
              <span className="piece-dot">{gameState.myColor === 'white' ? '♔' : '♚'}</span>
              <span className="player-name">
                {activeVariant === 'self' ? 'Blancs' : `${onlineIdentity || 'Vous'} (${colorLabel(gameState.myColor)})`}
              </span>
              <div className="captured-row">{renderCapturedList(myCaptured, oppColor)}</div>
              <span className="advantage">{advantage > 0 ? `+${advantage}` : ''}</span>
              {gameState.timerEnabled && <span className={((gameState.myColor === 'white' ? gameState.whiteTime : gameState.blackTime) < 30) ? 'timer low-time' : 'timer'}>{formatTime(gameState.myColor === 'white' ? gameState.whiteTime : gameState.blackTime)}</span>}
            </div>

            {gameSource === 'online' && gameState.connectionBanner && (
              <div className={`connection-banner ${gameState.connectionBanner.type || ''}`}>{gameState.connectionBanner.text}</div>
            )}

            <div className="status-row">
              <button className="btn-secondary" onClick={backToLobby}>Menu</button>
              <span className="status-text">{statusText}</span>
              {!gameState.gameOver && <button className="btn-danger" onClick={resign}>Abandon</button>}
            </div>
          </div>

          <div className="history-panel">
            <h3>Historique</h3>
            <div className="history-list">
              {Array.from({ length: Math.ceil(gameState.moveHistory.length / 2) }).map((_, idx) => {
                const w = gameState.moveHistory[idx * 2];
                const b = gameState.moveHistory[idx * 2 + 1];
                return (
                  <div className="move-entry" key={idx}>
                    <span>{idx + 1}.</span>
                    <span>{w?.notation || ''}</span>
                    <span>{b?.notation || ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {gameState.promotionPending && (
            <div className="overlay">
              <div className="dialog">
                <h3>Promotion</h3>
                <div className="promotion-row">
                  {['Q', 'R', 'B', 'N'].map((p) => (
                    <button key={p} className="promo-btn" onClick={() => selectPromotion(p)}>
                      {PIECE_SYMBOLS[p][gameState.turn]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {gameState.gameOver && gameState.gameOverData && (
            <div className="overlay">
              <div className="dialog">
                <div className="go-icon">{gameState.gameOverData.icon}</div>
                <h3>{gameState.gameOverData.title}</h3>
                <p>{gameState.gameOverData.message}</p>
                <button className="btn-main" onClick={backToLobby}>Nouvelle partie</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
