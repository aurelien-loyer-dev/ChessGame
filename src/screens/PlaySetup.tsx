import { HomeButton } from '../components/HomeButton';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Crown, Link2, Loader2, Play, Radar, Users, Wifi, WifiOff, X } from 'lucide-react';
import { TIME_CONTROLS, type Color } from '../lib/types';
import { BOTS, getBot } from '../lib/engine/bots';
import { navigate } from '../lib/router';
import { useProfile } from '../store/profile';
import { useSession, type Assists } from '../store/session';
import { inviteLink, useOnline } from '../online/store';
import { BotAvatar } from '../components/BotAvatar';
import { PIECE_IMG } from '../components/board/pieces';
import { validateFen } from '../lib/chess';
import { toast } from '../components/Toasts';
import './play.css';

const TABS = [
  { id: 'bot', label: 'Contre l’IA' },
  { id: 'online', label: 'En ligne' },
  { id: 'local', label: 'Local' },
];

export function PlaySetup({ tab = 'bot', code }: { tab?: string; code?: string }) {
  const current = TABS.some((t) => t.id === tab) ? tab : 'bot';
  return (
    <div className="container">
      <nav className="page-nav">
        <HomeButton />
      </nav>
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
          {current === 'online' && <OnlineSetup code={code} />}
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

function OnlineSetup({ code: linkCode }: { code?: string }) {
  const online = useOnline();
  const { prefs, setPrefs } = useSession();
  const [code, setCode] = useState(linkCode ?? '');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const tc = TIME_CONTROLS.find((t) => t.id === prefs.onlineTcId)?.tc ?? { initial: 300, increment: 0 };

  // Opening an invite link joins straight away.
  useEffect(() => {
    if (linkCode && online.status === 'idle') void online.join(linkCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode]);

  useEffect(() => {
    if (online.game) navigate('online');
  }, [online.game]);

  const copy = async (text: string, what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast('Copie impossible, sélectionne le texte à la main');
    }
  };

  const busy = online.status === 'opening' || online.status === 'connecting';

  return (
    <div className="setup-layout online">
      <div className="online-main">
        <div className="panel online-actions">
          <AnimatePresence mode="wait">
            {online.status === 'waiting' && online.code ? (
              <motion.div key="room" className="room-state" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="queue-state">
                  <div className="radar" aria-hidden>
                    <Radar />
                  </div>
                  <div>
                    <b>En attente de ton adversaire…</b>
                    <p className="dim small">Envoie-lui le code ou le lien. La partie démarre dès qu’il rejoint.</p>
                  </div>
                </div>
                <div className="room-code mono">{online.code}</div>
                <div className="controls-row">
                  <button className="btn primary" onClick={() => copy(inviteLink(online.code!), 'link')}>
                    {copied === 'link' ? <Check /> : <Link2 />} Copier le lien
                  </button>
                  <button className="btn" onClick={() => copy(online.code!, 'code')}>
                    {copied === 'code' ? <Check /> : <Copy />} Code
                  </button>
                  <button className="btn ghost" onClick={online.cancel}>
                    <X /> Annuler
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" className="online-buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="eyebrow">Cadence</span>
                <TimeControlPicker value={prefs.onlineTcId} onChange={(id) => setPrefs({ onlineTcId: id })} />
                <button className="btn primary lg" disabled={busy} onClick={() => online.host(tc)}>
                  {online.status === 'opening' ? <Loader2 className="spin" /> : <Users />} Créer une partie
                </button>
                <div className="or-sep">
                  <span>ou rejoindre avec un code</span>
                </div>
                <form
                  className="join-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void online.join(code);
                  }}
                >
                  <input
                    id="room-code"
                    className="input mono"
                    placeholder="CODE"
                    maxLength={5}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    aria-label="Code de la partie"
                  />
                  <button className="btn" type="submit" disabled={busy || code.trim().length < 4}>
                    {online.status === 'connecting' ? <Loader2 className="spin" /> : <Wifi />} Rejoindre
                  </button>
                </form>
                {online.error && (
                  <p className="field-error">
                    <WifiOff /> {online.error}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <aside className="panel how-online">
        <span className="eyebrow">Comment ça marche</span>
        <ol>
          <li>Crée une partie et choisis la cadence. Un code à 5 caractères est généré.</li>
          <li>Envoie le lien à ton adversaire, ou donne-lui le code.</li>
          <li>Les coups passent directement d’un navigateur à l’autre (WebRTC), sans compte ni serveur de jeu.</li>
        </ol>
        <p className="faint small">Si la connexion coupe, la partie reprend toute seule. Sans retour sous une minute, le joueur resté connecté gagne.</p>
      </aside>
    </div>
  );
}
