import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { Activity, GraduationCap, House, Lock, LogIn, Puzzle, Settings, Swords, UserRound } from 'lucide-react';
import { AuthScreen } from './screens/AuthScreen';
import { NewPasswordModal } from './components/NewPasswordModal';
import { GuestGate, useIsGuest } from './components/GuestGate';
import { navigate, useRoute } from './lib/router';
import { SettingsModal } from './screens/SettingsModal';
import { Home } from './screens/Home';
import { PlaySetup } from './screens/PlaySetup';
import { GameScreen } from './screens/GameScreen';
import { OnlineGameScreen } from './screens/OnlineGameScreen';
import { Learn } from './screens/Learn';
import { LessonScreen } from './screens/LessonScreen';
import { Puzzles } from './screens/Puzzles';
import { Profile } from './screens/Profile';
import { Register } from './screens/Register';
import { Legal } from './screens/Legal';
import { ConsentBanner } from './components/ConsentBanner';
import { useConsent } from './store/consent';
import { useProfile } from './store/profile';
import { Toasts } from './components/Toasts';
import { CloudConflict } from './components/CloudConflict';
import { useCloud } from './store/cloud';

const Analysis = lazy(() => import('./screens/Analysis').then((m) => ({ default: m.Analysis })));

const NAV = [
  { id: '', label: 'Accueil', icon: House, guest: true },
  { id: 'play', label: 'Jouer', icon: Swords, guest: true },
  { id: 'learn', label: 'Cours', icon: GraduationCap, guest: false },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle, guest: false },
  { id: 'analysis', label: 'Analyse', icon: Activity, guest: true },
  { id: 'profile', label: 'Profil', icon: UserRound, guest: false },
];

function Screen({ route }: { route: string[] }) {
  const [root, a, b] = route;
  switch (root) {
    case undefined:
      return <Home />;
    case 'play':
      return <PlaySetup tab={a} code={b} />;
    case 'game':
      return <GameScreen />;
    case 'online':
      return (
        <GuestGate feature="Le jeu en ligne">
          <OnlineGameScreen />
        </GuestGate>
      );
    case 'learn':
      return <GuestGate feature="Les cours">{a && b ? <LessonScreen courseId={a} lessonId={b} /> : <Learn />}</GuestGate>;
    case 'puzzles':
      return (
        <GuestGate feature="Les puzzles">
          <Puzzles mode={a} />
        </GuestGate>
      );
    case 'analysis':
      return (
        <Suspense fallback={<div className="screen-loading">Chargement de l’analyse…</div>}>
          <Analysis gameId={a} />
        </Suspense>
      );
    case 'profile':
      return (
        <GuestGate feature="Le profil">
          <Profile action={a} />
        </GuestGate>
      );
    case 'legal':
      return <Legal doc={a} />;
    default:
      return <Home />;
  }
}

export function App() {
  const route = useRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const registered = useProfile((s) => s.registeredAt !== null);
  const cloud = useCloud();
  const isGuest = useIsGuest();
  const analytics = useConsent((s) => s.analytics);
  const section = route[0] ?? '';
  const activeNav = section === 'game' || section === 'online' ? 'play' : section;
  const immersive = section === 'game' || section === 'online';

  useEffect(() => {
    useCloud.getState().init();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`shell ${immersive ? 'immersive' : ''}`}>
      <div className="backdrop" aria-hidden />
      <nav className="rail" aria-label="Navigation principale">
        <button className="rail-logo" onClick={() => navigate('')} aria-label="Accueil EpiChess">
          <svg viewBox="0 0 32 32" aria-hidden>
            <path d="M16 3l3 4h-6zM11 9h10l-2 11h-6zM8 22h16l1.5 4h-19zM6 27h20v2H6z" />
          </svg>
        </button>
        <div className="rail-items">
          {NAV.map(({ id, label, icon: Icon, guest: guestOk }) => (
            <button
              key={id || 'home'}
              className={`rail-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => navigate(id)}
              aria-current={activeNav === id ? 'page' : undefined}
            >
              {activeNav === id && <motion.span layoutId="rail-pill" className="rail-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              {isGuest && !guestOk && <Lock className="lock" aria-label="Compte requis" />}
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {isGuest && (
          <button className="rail-account" onClick={() => cloud.setGuest(false)}>
            <LogIn />
            Connexion
          </button>
        )}
        <button className="rail-item rail-settings" onClick={() => setSettingsOpen(true)}>
          <Settings />
          <span>Réglages</span>
        </button>
        <div className="rail-legal rail-settings">
          <a href="#/legal/mentions">Mentions</a>
          <a href="#/legal/confidentialite">Confidentialité</a>
          <a href="#/legal/cookies">Cookies</a>
        </div>
      </nav>

      <main className="stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={route.slice(0, section === 'learn' || section === 'analysis' ? 3 : 1).join('/') || 'home'}
            className="page"
            initial={{ opacity: 0, rotateY: -8, z: -120, x: 30 }}
            animate={{ opacity: 1, rotateY: 0, z: 0, x: 0 }}
            exit={{ opacity: 0, rotateY: 6, z: -160, x: -30 }}
            transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Screen route={route} />
          </motion.div>
        </AnimatePresence>
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {section !== 'legal' && <AccountGate registered={registered} />}
      <NewPasswordModal />
      <ConsentBanner />
      <CloudConflict />
      <Toasts />
      {__VERCEL__ && analytics === true && <Analytics />}
    </div>
  );
}

/**
 * Decides what stands between the visitor and the app:
 * - accounts configured: sign-in screen (or guest mode), then profile setup for new accounts
 * - accounts not configured: the local profile setup, as before
 */
function AccountGate({ registered }: { registered: boolean }) {
  const { enabled, ready, user, guest, status } = useCloud();
  if (!enabled) return registered ? null : <Register />;
  if (!ready || (user && status === 'syncing' && !registered)) {
    return (
      <div className="app-splash" aria-busy="true">
        <span className="spin-ring" aria-label="Chargement" />
      </div>
    );
  }
  if (!user) return guest ? null : <AuthScreen />;
  return registered ? null : <Register />;
}
