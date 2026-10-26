import { HomeButton } from '../components/HomeButton';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Crown, Download, LogOut, Pencil, Trash2, Upload } from 'lucide-react';
import { downloadAccount, eraseEverything, importAccount, signOut } from '../lib/account';
import { useProfile } from '../store/profile';
import { BOTS } from '../lib/engine/bots';
import { navigate } from '../lib/router';
import { BotAvatar, ProfileAvatar } from '../components/BotAvatar';
import { LEVELS } from '../store/profile';
import { RatingChart } from '../components/RatingChart';
import { Modal } from '../components/ui/Modal';
import { REASON_LABEL } from '../game/line';
import { COURSES } from '../data/lessons';
import { toast } from '../components/Toasts';
import { NAME_MAX, sanitizeName } from '../lib/types';
import './profile.css';

export function Profile({ action }: { action?: string }) {
  const p = useProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [resetOpen, setResetOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(action === 'logout');
  const [filter, setFilter] = useState<'all' | 'bot' | 'online' | 'local'>('all');

  const stats = useMemo(() => {
    const s = { w: 0, d: 0, l: 0 };
    for (const g of p.games) {
      if (!g.you) continue;
      if (g.result === '1/2-1/2') s.d++;
      else if ((g.result === '1-0') === (g.you === 'white')) s.w++;
      else s.l++;
    }
    return s;
  }, [p.games]);
  const totalLessons = COURSES.reduce((n, c) => n + c.lessons.length, 0);
  const games = p.games.filter((g) => filter === 'all' || g.mode === filter);
  const peak = p.ratingHistory.reduce((m, r) => Math.max(m, r.rating), p.rating);

  const saveName = () => {
    const clean = sanitizeName(name);
    if (!clean) return;
    p.setName(clean);
    setEditing(false);
  };

  const onImport = async (file: File) => {
    const err = await importAccount(file);
    if (err) toast(err, 'bad');
  };

  const outcomeOf = (g: (typeof p.games)[number]) => {
    if (!g.you) return { label: g.result, tone: '' };
    if (g.result === '1/2-1/2') return { label: 'Nulle', tone: 'draw' };
    return (g.result === '1-0') === (g.you === 'white') ? { label: 'Victoire', tone: 'win' } : { label: 'Défaite', tone: 'loss' };
  };

  return (
    <div className="container profile">
      <nav className="page-nav">
        <HomeButton />
      </nav>
      <section className="profile-head panel">
        <ProfileAvatar glyph={p.avatar.glyph} hue={p.avatar.hue} size={76} />
        <div className="profile-id">
          {editing ? (
            <form
              className="name-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
            >
              <input id="profile-name" className="input" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} autoFocus />
              <button className="btn primary" type="submit">
                OK
              </button>
            </form>
          ) : (
            <h1>
              {p.name || 'Joueur'}
              <button className="btn ghost icon sm" onClick={() => setEditing(true)} aria-label="Modifier le pseudo">
                <Pencil />
              </button>
            </h1>
          )}
          <p className="dim">
            {p.level ? `${LEVELS[p.level].label} · ` : ''}
            {stats.w} victoires · {stats.d} nulles · {stats.l} défaites · série de {p.dailyStreak.count} jour{p.dailyStreak.count > 1 ? 's' : ''}
            {p.registeredAt ? ` · membre depuis le ${new Date(p.registeredAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
          </p>
        </div>
        <dl className="profile-kpis">
          <div>
            <dt>Elo IA</dt>
            <dd className="mono brass">{p.rating}</dd>
            <small className="faint">pic {peak}</small>
          </div>
          <div>
            <dt>Puzzles</dt>
            <dd className="mono">{p.puzzleRating}</dd>
            <small className="faint">{p.puzzlesSolved.length} résolus</small>
          </div>
          <div>
            <dt>En ligne</dt>
            <dd className="mono">{p.games.filter((g) => g.mode === 'online').length}</dd>
            <small className="faint">parties</small>
          </div>
          <div>
            <dt>Cours</dt>
            <dd className="mono">
              {p.lessonsDone.length}/{totalLessons}
            </dd>
            <small className="faint">leçons</small>
          </div>
        </dl>
      </section>

      <div className="profile-grid">
        <section className="panel chart-panel">
          <div className="side-section-title">
            <h3>Elo contre l’IA</h3>
          </div>
          <RatingChart points={p.ratingHistory} label="ia" />
        </section>
        <section className="panel chart-panel">
          <div className="side-section-title">
            <h3>Classement puzzles</h3>
          </div>
          <RatingChart points={p.puzzleHistory} label="puzzles" />
        </section>
      </div>

      <section className="panel ladder">
        <div className="side-section-title">
          <h3>Échelle des IA</h3>
          <span className="mono faint">
            {p.botsBeaten.length}/{BOTS.length}
          </span>
        </div>
        <div className="ladder-row">
          {BOTS.map((b, i) => {
            const beaten = p.botsBeaten.includes(b.id);
            return (
              <motion.div
                key={b.id}
                className={`ladder-step ${beaten ? 'beaten' : ''}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                title={`${b.name} · ${b.elo}`}
              >
                <BotAvatar bot={b} size={40} />
                <span className="mono">{b.elo}</span>
                {beaten && <Crown className="crown" />}
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="panel history">
        <div className="side-section-title">
          <h3>Historique</h3>
          <div className="segmented">
            {(['all', 'bot', 'online', 'local'] as const).map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {{ all: 'Tout', bot: 'IA', online: 'En ligne', local: 'Local' }[f]}
              </button>
            ))}
          </div>
        </div>
        {games.length === 0 ? (
          <p className="faint small">Aucune partie dans cette catégorie.</p>
        ) : (
          <div className="history-table" role="table">
            {games.slice(0, 60).map((g) => {
              const o = outcomeOf(g);
              return (
                <button key={g.id} className="history-row" role="row" onClick={() => navigate(`analysis/${g.id}`)}>
                  <span className={`outcome ${o.tone}`}>{o.label}</span>
                  <span className="players">
                    {g.white} <span className="faint">vs</span> {g.black}
                  </span>
                  <span className="faint small">{REASON_LABEL[g.reason]}</span>
                  <span className="mono faint small">{Math.ceil(g.moves.length / 2)} coups</span>
                  <span className="mono small">{g.accuracy && g.you ? `${g.accuracy[g.you]}%` : ''}</span>
                  <span className="faint small">{new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  <Activity className="go" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel account-panel">
        <div className="account-head">
          <h3>Compte et données personnelles</h3>
          <p className="dim small">
            Ton profil n’existe que dans ce navigateur : aucun serveur ne le conserve. Tu peux le télécharger, le transférer sur un autre appareil,
            te déconnecter ou tout effacer à tout moment. <a href="#/legal/confidentialite">Politique de confidentialité</a>
          </p>
        </div>
        <div className="account-actions">
          <button className="account-action" onClick={() => downloadAccount()}>
            <Download />
            <span>
              <b>Télécharger mes données</b>
              <small>Fichier JSON avec ton profil, tes parties et tes réglages</small>
            </span>
          </button>
          <label className="account-action">
            <Upload />
            <span>
              <b>Importer un profil</b>
              <small>Remplace le profil actuel par un export</small>
            </span>
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
          </label>
          <button className="account-action" onClick={() => setLogoutOpen(true)}>
            <LogOut />
            <span>
              <b>Se déconnecter</b>
              <small>Retire ton profil de cet appareil</small>
            </span>
          </button>
          <button className="account-action danger" onClick={() => setResetOpen(true)}>
            <Trash2 />
            <span>
              <b>Supprimer toutes mes données</b>
              <small>Profil, parties, réglages et choix cookies</small>
            </span>
          </button>
        </div>
      </section>

      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Se déconnecter ?" width={440}>
        <p className="dim">
          Ton profil sera retiré de ce navigateur. Pour le retrouver plus tard, ici ou sur un autre appareil, télécharge d’abord tes données puis
          utilise « J’ai déjà un profil » à l’inscription.
        </p>
        <div className="logout-actions">
          <button
            className="btn primary block"
            onClick={() => {
              downloadAccount();
              setTimeout(signOut, 400);
            }}
          >
            <Download /> Télécharger puis se déconnecter
          </button>
          <button className="btn block" onClick={signOut}>
            <LogOut /> Se déconnecter sans télécharger
          </button>
          <button className="btn ghost block" onClick={() => setLogoutOpen(false)}>
            Annuler
          </button>
        </div>
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Supprimer toutes tes données ?" width={420}>
        <p className="dim">
          Profil, classements, historique, puzzles, progression des cours, réglages et choix cookies seront définitivement effacés de ce navigateur.
          Cette action est irréversible.
        </p>
        <div className="controls-row" style={{ marginTop: 18 }}>
          <button className="btn grow" onClick={() => setResetOpen(false)}>
            Annuler
          </button>
          <button
            className="btn danger grow"
            onClick={eraseEverything}
          >
            <Trash2 /> Tout supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}
