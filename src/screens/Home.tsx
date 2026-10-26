import { lazy, Suspense, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Flame, GraduationCap, Puzzle as PuzzleIcon, Swords, Trophy, Wifi } from 'lucide-react';
import { Chess } from 'chess.js';
import { navigate } from '../lib/router';
import { useProfile } from '../store/profile';
import { useSession } from '../store/session';
import { BOTS, getBot } from '../lib/engine/bots';
import { BotAvatar } from '../components/BotAvatar';
import { Board } from '../components/board/Board';
import { dailyPuzzle } from '../data/puzzles';
import { COURSES, lessonKey } from '../data/lessons';
import { REASON_LABEL } from '../game/line';
import { TIME_CONTROLS } from '../lib/types';
import { parseUci } from '../lib/chess';
import { PUBLISHER } from '../data/legal';
import { useIsGuest } from '../components/GuestGate';
import { useCloud } from '../store/cloud';
import './home.css';

const Hero3D = lazy(() => import('../three/Hero3D'));

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const rise = {
  hidden: { opacity: 0, y: 24, rotateX: -12 },
  show: { opacity: 1, y: 0, rotateX: 0, transition: { type: 'spring' as const, stiffness: 180, damping: 22 } },
};

export function Home() {
  const profile = useProfile();
  const isGuest = useIsGuest();
  const setGuest = useCloud((s) => s.setGuest);
  const { prefs, startOffline } = useSession();
  const bot = getBot(profile.lastBotId);
  const daily = useMemo(() => dailyPuzzle(), []);
  const dailyFen = useMemo(() => {
    const c = new Chess(daily.fen);
    c.move(parseUci(daily.moves[0]));
    return c.fen();
  }, [daily]);
  const dailyDone = profile.puzzlesSolved.includes(daily.id);

  const nextLesson = useMemo(() => {
    for (const c of COURSES) for (const l of c.lessons) if (!profile.lessonsDone.includes(lessonKey(c.id, l.id))) return { course: c, lesson: l };
    return null;
  }, [profile.lessonsDone]);
  const totalLessons = COURSES.reduce((n, c) => n + c.lessons.length, 0);

  const lastGame = profile.games[0];
  const record = profile.games.reduce(
    (acc, g) => {
      if (!g.you) return acc;
      if (g.result === '1/2-1/2') acc.d++;
      else if ((g.result === '1-0') === (g.you === 'white')) acc.w++;
      else acc.l++;
      return acc;
    },
    { w: 0, d: 0, l: 0 },
  );

  const quickPlay = () => {
    const tc = TIME_CONTROLS.find((t) => t.id === prefs.tcId)?.tc ?? { initial: 600, increment: 0 };
    startOffline({ mode: 'bot', botId: bot.id, colorChoice: prefs.colorChoice, tc, assists: prefs.assists });
    navigate('game');
  };

  return (
    <div className="container home">
      <section className="hero">
        <motion.div className="hero-copy" variants={stagger} initial="hidden" animate="show">
          <motion.p variants={rise} className="eyebrow">
            Stockfish 19 · {BOTS.length} adversaires de {BOTS[0].elo} à {BOTS[BOTS.length - 1].elo} Elo
          </motion.p>
          <motion.h1 variants={rise} className="hero-title">
            Epi<span>Chess</span>
          </motion.h1>
          <motion.p variants={rise} className="hero-lede">
            Affronte des IA calibrées, joue en ligne, suis des cours interactifs et décortique chaque partie avec un moteur de grand maître, directement dans le navigateur.
          </motion.p>
          <motion.div variants={rise} className="hero-actions">
            <button className="btn primary lg" onClick={quickPlay}>
              <Swords /> Jouer contre {bot.name}
            </button>
            <button className="btn lg" onClick={() => navigate('play/online')}>
              <Wifi /> En ligne
            </button>
          </motion.div>
          {isGuest && (
            <motion.div variants={rise} className="guest-banner">
              <span>
                <b>Mode invité.</b> Tes parties ne sont pas sauvegardées et les cours, puzzles et jeu en ligne sont verrouillés.
              </span>
              <button className="btn sm primary" onClick={() => setGuest(false)}>
                Créer un compte
              </button>
            </motion.div>
          )}
          <motion.dl variants={rise} className="hero-stats" hidden={isGuest}>
            <div>
              <dt>Elo</dt>
              <dd className="mono brass">{profile.rating}</dd>
            </div>
            <div>
              <dt>Puzzles</dt>
              <dd className="mono">{profile.puzzleRating}</dd>
            </div>
            <div>
              <dt>Bilan</dt>
              <dd className="mono">
                {record.w}<small>V</small> {record.d}<small>N</small> {record.l}<small>D</small>
              </dd>
            </div>
            <div>
              <dt>Série</dt>
              <dd className="mono">
                <Flame className="flame" /> {profile.dailyStreak.count} j
              </dd>
            </div>
          </motion.dl>
        </motion.div>
        <div className="hero-visual" aria-hidden>
          <Suspense fallback={<div className="hero-fallback" />}>
            <Hero3D />
          </Suspense>
          <div className="hero-ring" />
        </div>
      </section>

      <motion.section className="home-grid" variants={stagger} initial="hidden" animate="show">
        <motion.article variants={rise} className="home-card panel bots-card">
          <header>
            <span className="eyebrow">Adversaires</span>
            <button className="btn ghost sm" onClick={() => navigate('play/bot')}>
              Tous <ArrowRight />
            </button>
          </header>
          <div className="bot-orbit">
            {BOTS.map((b) => (
              <button
                key={b.id}
                className={`bot-dot ${b.id === bot.id ? 'current' : ''}`}
                title={`${b.name} · ${b.elo}`}
                onClick={() => {
                  profile.setLastBot(b.id);
                  navigate('play/bot');
                }}
              >
                <BotAvatar bot={b} size={38} />
                <span className="mono">{b.elo}</span>
              </button>
            ))}
          </div>
          <p className="dim">
            {profile.botsBeaten.length
              ? `${profile.botsBeaten.length} / ${BOTS.length} battus. Prochain défi : ${BOTS.find((b) => !profile.botsBeaten.includes(b.id))?.name ?? 'aucun, bravo'}.`
              : 'Commence par Pixel et grimpe l’échelle jusqu’à Singularity.'}
          </p>
        </motion.article>

        <motion.article variants={rise} className="home-card panel puzzle-card" onClick={() => navigate('puzzles/daily')} role="button" tabIndex={0}>
          <header>
            <span className="eyebrow">Puzzle du jour</span>
            {dailyDone ? <span className="chip good">Résolu</span> : <span className="chip brass mono">{daily.rating}</span>}
          </header>
          <div className="mini-board">
            <Board fen={dailyFen} orientation={dailyFen.split(' ')[1] === 'w' ? 'white' : 'black'} />
          </div>
          <p className="card-cta">
            <PuzzleIcon /> {dailyFen.split(' ')[1] === 'w' ? 'Les Blancs' : 'Les Noirs'} jouent et gagnent
          </p>
        </motion.article>

        <motion.article variants={rise} className="home-card panel learn-card">
          <header>
            <span className="eyebrow">Cours</span>
            <span className="chip mono">
              {profile.lessonsDone.length}/{totalLessons}
            </span>
          </header>
          <div className="progress-track" aria-hidden>
            <i style={{ width: `${(profile.lessonsDone.length / totalLessons) * 100}%` }} />
          </div>
          {nextLesson ? (
            <>
              <h3>{nextLesson.lesson.title}</h3>
              <p className="dim">
                {nextLesson.course.title} · {nextLesson.lesson.summary}
              </p>
              <button className="btn" onClick={() => navigate(`learn/${nextLesson.course.id}/${nextLesson.lesson.id}`)}>
                <GraduationCap /> Continuer
              </button>
            </>
          ) : (
            <>
              <h3>Programme terminé</h3>
              <p className="dim">Tous les cours sont validés. Passe aux puzzles classés.</p>
            </>
          )}
        </motion.article>

        <motion.article variants={rise} className="home-card panel last-card">
          <header>
            <span className="eyebrow">Dernière partie</span>
          </header>
          {lastGame ? (
            <>
              <h3>
                {lastGame.white} <span className="dim">vs</span> {lastGame.black}
              </h3>
              <p className="dim">
                <span className="mono">{lastGame.result}</span> · {REASON_LABEL[lastGame.reason]} · {Math.ceil(lastGame.moves.length / 2)} coups
              </p>
              <button className="btn" onClick={() => navigate(`analysis/${lastGame.id}`)}>
                <Trophy /> Analyser
              </button>
            </>
          ) : (
            <>
              <h3>Aucune partie encore</h3>
              <p className="dim">Tes parties s’enregistrent ici, prêtes à être analysées coup par coup.</p>
            </>
          )}
        </motion.article>
      </motion.section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} {PUBLISHER.name} · EpiChess</span>
        <nav aria-label="Informations légales">
          <a href="#/legal/mentions">Mentions légales</a>
          <a href="#/legal/confidentialite">Confidentialité</a>
          <a href="#/legal/cookies">Cookies</a>
        </nav>
      </footer>
    </div>
  );
}
