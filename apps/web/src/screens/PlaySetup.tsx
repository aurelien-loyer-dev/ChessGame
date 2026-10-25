import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Crown, Link2, Loader2, Play, Radar, Users, Wifi, WifiOff, X } from 'lucide-react';
import { TIME_CONTROLS, type Color } from '@chess/shared';
import { BOTS, getBot } from '../lib/engine/bots';
import { navigate } from '../lib/router';
import { useProfile } from '../store/profile';
import { useSession, type Assists } from '../store/session';
import { useOnline, serverHttpUrl } from '../online/store';
import { BotAvatar, UserAvatar, hueFromName } from '../components/BotAvatar';
import { PIECE_IMG } from '../components/board/pieces';
import { validateFen } from '../lib/chess';
import { toast } from '../components/Toasts';
import './play.css';

const TABS = [
  { id: 'bot', label: 'Contre l’IA' },
  { id: 'online', label: 'En ligne' },
  { id: 'local', label: 'Local' },
];

export function PlaySetup({ tab = 'bot' }: { tab?: string }) {
  const current = TABS.some((t) => t.id === tab) ? tab : 'bot';
  return (
    <div className="container">
      <header className="page-head">
        <div>
          <p className="eyebrow">Nouvelle partie</p>
          <h1>Jouer</h1>
        </div>
        <div className="segmented" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-pressed={current === t.id} onClick={() => navigate(`play/${t.id}`)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {current === 'bot' && <BotSetup />}
          {current === 'online' && <OnlineSetup />}
          {current === 'local' && <LocalSetup />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TimeControlPicker({ value, onChange, allowInfinite = true }: { value: string; onChange: (id: string) => void; allowInfinite?: boolean }) {
  return (
    <div className="tc-grid">
      {TIME_CONTROLS.filter((t) => allowInfinite || t.tc.initial > 0).map((t) => (
        <button key={t.id} className={`tc ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)} aria-pressed={value === t.id}>
          <span className="mono">{t.label}</span>
          <small>{t.family}</small>
        </button>
      ))}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: Color | 'random'; onChange: (c: Color | 'random') => void }) {
  return (
    <div className="color-pick">
      {(['white', 'random', 'black'] as const).map((c) => (
        <button key={c} className={value === c ? 'active' : ''} onClick={() => onChange(c)} aria-pressed={value === c}>
          {c === 'random' ? (
            <span className="half-king">
              <img src={PIECE_IMG.wK} alt="" />
              <img src={PIECE_IMG.bK} alt="" />
            </span>
          ) : (
            <img src={c === 'white' ? PIECE_IMG.wK : PIECE_IMG.bK} alt="" />
          )}
          <span>{c === 'white' ? 'Blancs' : c === 'black' ? 'Noirs' : 'Aléatoire'}</span>
        </button>
      ))}
    </div>
  );
}

function FenField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(!!value);
  const error = value ? validateFen(value.trim()) : null;
  return (
    <div className="fen-field">
      <button className="btn ghost sm" onClick={() => setOpen(!open)}>
        {open ? 'Partir de la position initiale' : 'Partir d’une position (FEN)…'}
      </button>
      {open && (
        <>
          <input
            id="start-fen"
            className="input mono"
            placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
          {error && <p className="field-error">{error}</p>}
        </>
      )}
    </div>
  );
}

const ASSIST_LABELS: Record<keyof Assists, { label: string; desc: string }> = {
  hints: { label: 'Indices', desc: 'Affiche le meilleur coup à la demande' },
  takebacks: { label: 'Reprendre un coup', desc: 'Annule ton dernier coup et la réponse' },
  evalBar: { label: 'Barre d’évaluation', desc: 'Évaluation Stockfish en direct' },
};

function BotSetup() {
  const { prefs, setPrefs, startOffline } = useSession();
  const profile = useProfile();
  const [botId, setBotId] = useState(profile.lastBotId || prefs.botId);
  const [fen, setFen] = useState('');
  const bot = getBot(botId);
  const assisted = prefs.assists.hints || prefs.assists.takebacks || prefs.assists.evalBar;

  const start = () => {
    const tc = TIME_CONTROLS.find((t) => t.id === prefs.tcId)!.tc;
    if (fen.trim() && validateFen(fen.trim())) return toast('Position FEN invalide', 'bad');
    profile.setLastBot(bot.id);
    setPrefs({ botId: bot.id });
    startOffline({ mode: 'bot', botId: bot.id, colorChoice: prefs.colorChoice, tc, assists: prefs.assists, startFen: fen.trim() || undefined });
    navigate('game');
  };

  return (
    <div className="setup-layout">
      <div className="bot-grid">
        {BOTS.map((b, i) => {
          const beaten = profile.botsBeaten.includes(b.id);
          return (
            <motion.button
              key={b.id}
              className={`bot-card ${b.id === botId ? 'selected' : ''}`}
              style={{ ['--hue' as string]: b.hue }}
              onClick={() => setBotId(b.id)}
              initial={{ opacity: 0, rotateY: -20, y: 10 }}
              animate={{ opacity: 1, rotateY: 0, y: 0 }}
              transition={{ delay: i * 0.035, type: 'spring', stiffness: 200, damping: 22 }}
              whileHover={{ y: -3 }}
              aria-pressed={b.id === botId}
            >
              <BotAvatar bot={b} size={46} />
              <span className="bot-card-text">
                <span className="bot-card-name">
                  {b.name} {beaten && <Crown className="beaten" aria-label="Battu" />}
                </span>
                <span className="bot-card-title">{b.title}</span>
              </span>
              <span className="bot-card-elo mono">{b.elo}</span>
              <span className="bot-card-bio">{b.bio}</span>
            </motion.button>
          );
        })}
        <div className="calibration panel">
          <span className="eyebrow">Calibrage</span>
          <dl>
            <div>
              <dt className="mono">400 – 1100</dt>
              <dd>Stockfish calcule les meilleurs coups puis en choisit un avec une part de hasard pondérée : erreurs humaines, jamais absurdes.</dd>
            </div>
            <div>
              <dt className="mono">1400 – 2800</dt>
              <dd>Limiteur de force officiel de Stockfish (UCI_Elo), calibré sur des parties contre des moteurs de niveau connu.</dd>
            </div>
            <div>
              <dt className="mono">3200</dt>
              <dd>Stockfish 19 sans bride, 2 secondes par coup, directement dans ton navigateur.</dd>
            </div>
          </dl>
        </div>
      </div>

      <aside className="setup-panel panel">
        <div className="bot-focus" style={{ ['--hue' as string]: bot.hue }}>
          <BotAvatar bot={bot} size={72} />
          <div>
            <h2>{bot.name}</h2>
            <p className="mono brass">≈ {bot.elo} Elo</p>
          </div>
        </div>
        <p className="dim bot-bio">{bot.bio}</p>

        <div className="setup-block">
          <span className="eyebrow">Ta couleur</span>
          <ColorPicker value={prefs.colorChoice} onChange={(c) => setPrefs({ colorChoice: c })} />
        </div>
        <div className="setup-block">
          <span className="eyebrow">Cadence</span>
          <TimeControlPicker value={prefs.tcId} onChange={(id) => setPrefs({ tcId: id })} />
        </div>
        <div className="setup-block">
          <span className="eyebrow">Aides</span>
          {(Object.keys(ASSIST_LABELS) as (keyof Assists)[]).map((k) => (
            <label key={k} className="toggle-row">
              <span>
                <b>{ASSIST_LABELS[k].label}</b>
                <small>{ASSIST_LABELS[k].desc}</small>
              </span>
              <button
                className="toggle"
                role="switch"
                aria-checked={prefs.assists[k]}
                onClick={() => setPrefs({ assists: { ...prefs.assists, [k]: !prefs.assists[k] } })}
              />
            </label>
          ))}
          {assisted && <p className="faint small">Les parties restent classées dans ton Elo local, aides comprises.</p>}
        </div>
        <FenField value={fen} onChange={setFen} />
        <button className="btn primary lg block" onClick={start}>
          <Play /> Lancer la partie
        </button>
      </aside>
    </div>
  );
}

function LocalSetup() {
  const { prefs, setPrefs, startOffline } = useSession();
  const [fen, setFen] = useState('');
  const start = () => {
    if (fen.trim() && validateFen(fen.trim())) return toast('Position FEN invalide', 'bad');
    const tc = TIME_CONTROLS.find((t) => t.id === prefs.tcId)!.tc;
    startOffline({ mode: 'local', botId: '', colorChoice: 'white', tc, assists: { hints: false, takebacks: true, evalBar: false }, startFen: fen.trim() || undefined });
    navigate('game');
  };
  return (
    <div className="setup-narrow panel">
      <div className="local-illu" aria-hidden>
        <img src={PIECE_IMG.wK} alt="" />
        <span className="mono">VS</span>
        <img src={PIECE_IMG.bK} alt="" />
      </div>
      <p className="dim">Deux joueurs sur le même appareil. Le plateau reste orienté côté Blancs ; tu peux le retourner à tout moment.</p>
      <div className="setup-block">
        <span className="eyebrow">Cadence</span>
        <TimeControlPicker value={prefs.tcId} onChange={(id) => setPrefs({ tcId: id })} />
      </div>
      <FenField value={fen} onChange={setFen} />
      <button className="btn primary lg block" onClick={start}>
        <Users /> Commencer
      </button>
    </div>
  );
}

function OnlineSetup() {
  const online = useOnline();
  const { prefs, setPrefs } = useSession();
  const name = useProfile((s) => s.name);
  const [code, setCode] = useState('');
  const [leaders, setLeaders] = useState<{ id: string; name: string; rating: number; games: number }[] | null>(null);
  const [copied, setCopied] = useState(false);
  const tc = TIME_CONTROLS.find((t) => t.id === prefs.onlineTcId)?.tc ?? { initial: 300, increment: 0 };

  useEffect(() => {
    if (online.status === 'idle' || online.status === 'offline') online.connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (online.game && !online.game.result) navigate('online');
  }, [online.game]);

  // Join a room from a shared link: #/play/online?room=CODE is not supported by the hash router, so use a query param.
  useEffect(() => {
    const room = new URLSearchParams(location.search).get('room');
    if (room && online.status === 'online') {
      online.joinRoom(room);
      history.replaceState(null, '', location.pathname + location.hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.status]);

  useEffect(() => {
    let alive = true;
    fetch(serverHttpUrl('/api/leaderboard'))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setLeaders(d.players ?? []))
      .catch(() => alive && setLeaders(null));
    return () => {
      alive = false;
    };
  }, [online.profile?.rating]);

  const roomLink = online.room ? `${location.origin}${location.pathname}?room=${online.room.code}#/play/online` : '';

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('Copie impossible, sélectionne le texte à la main');
    }
  };

  const connected = online.status === 'online';
  const elapsed = useElapsed(online.queue?.since ?? null);

  return (
    <div className="setup-layout online">
      <div className="online-main">
        <div className={`conn-banner panel ${connected ? 'ok' : ''}`}>
          {connected ? <Wifi /> : online.status === 'connecting' ? <Loader2 className="spin" /> : <WifiOff />}
          <div>
            <b>{connected ? 'Connecté au serveur' : online.status === 'connecting' ? 'Connexion…' : 'Serveur injoignable'}</b>
            <small className="dim">
              {connected
                ? `${online.lobby.online} en ligne · ${online.lobby.playing} en partie${online.latency !== null ? ` · ${online.latency} ms` : ''}`
                : 'Lance le serveur (npm run dev) ou configure VITE_SERVER_URL.'}
            </small>
          </div>
          {!connected && online.status !== 'connecting' && (
            <button className="btn sm" onClick={online.connect}>
              Réessayer
            </button>
          )}
        </div>

        {connected && online.profile && (
          <div className="me-card panel">
            <UserAvatar name={online.profile.name} hue={hueFromName(online.profile.name)} size={52} />
            <div>
              <h3>{online.profile.name || name}</h3>
              <p className="dim small">
                <span className="mono brass">{online.profile.rating}</span> · {online.profile.wins}V {online.profile.draws}N {online.profile.losses}D
              </p>
            </div>
          </div>
        )}

        <div className="panel online-actions">
          <span className="eyebrow">Cadence</span>
          <TimeControlPicker value={prefs.onlineTcId} onChange={(id) => setPrefs({ onlineTcId: id })} />

          <AnimatePresence mode="wait">
            {online.queue ? (
              <motion.div key="queue" className="queue-state" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="radar" aria-hidden>
                  <Radar />
                </div>
                <div>
                  <b>Recherche d’un adversaire…</b>
                  <p className="dim small mono">{elapsed}</p>
                </div>
                <button className="btn" onClick={online.cancelQueue}>
                  <X /> Annuler
                </button>
              </motion.div>
            ) : online.room ? (
              <motion.div key="room" className="room-state" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <p className="dim small">Partage ce code ou ce lien avec ton adversaire</p>
                <div className="room-code mono">{online.room.code}</div>
                <div className="controls-row">
                  <button className="btn" onClick={() => copy(online.room!.code)}>
                    {copied ? <Check /> : <Copy />} Code
                  </button>
                  <button className="btn" onClick={() => copy(roomLink)}>
                    <Link2 /> Lien
                  </button>
                  <button className="btn ghost" onClick={online.cancelRoom}>
                    Fermer le salon
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" className="online-buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button className="btn primary lg" disabled={!connected} onClick={() => online.findGame(tc)}>
                  <Radar /> Trouver un adversaire
                </button>
                <button className="btn lg" disabled={!connected} onClick={() => online.createRoom(tc)}>
                  <Users /> Créer un salon privé
                </button>
                <form
                  className="join-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim().length >= 4) online.joinRoom(code);
                  }}
                >
                  <input
                    id="room-code"
                    className="input mono"
                    placeholder="CODE"
                    maxLength={5}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    aria-label="Code du salon"
                  />
                  <button className="btn" type="submit" disabled={!connected || code.trim().length < 4}>
                    Rejoindre
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <aside className="panel leaderboard">
        <div className="side-section-title">
          <h3>Classement</h3>
          <Crown className="brass" />
        </div>
        {leaders === null ? (
          <p className="faint small">Classement indisponible hors ligne.</p>
        ) : leaders.length === 0 ? (
          <p className="faint small">Aucune partie classée pour l’instant. Sois le premier.</p>
        ) : (
          <ol>
            {leaders.slice(0, 15).map((p, i) => (
              <li key={p.id} className={p.id === online.profile?.id ? 'me' : ''}>
                <span className="rank mono">{i + 1}</span>
                <span className="lb-name">{p.name}</span>
                <span className="mono brass">{p.rating}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

function useElapsed(since: number | null) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return '0:00';
  const s = Math.floor((Date.now() - since) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
