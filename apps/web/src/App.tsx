import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { Activity, GraduationCap, House, Puzzle, Settings, Swords, UserRound } from 'lucide-react';
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
import { Onboarding } from './screens/Onboarding';
import { useProfile } from './store/profile';
import { Toasts } from './components/Toasts';

const Analysis = lazy(() => import('./screens/Analysis').then((m) => ({ default: m.Analysis })));

const NAV = [
  { id: '', label: 'Accueil', icon: House },
  { id: 'play', label: 'Jouer', icon: Swords },
  { id: 'learn', label: 'Cours', icon: GraduationCap },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'analysis', label: 'Analyse', icon: Activity },
  { id: 'profile', label: 'Profil', icon: UserRound },
];

function Screen({ route }: { route: string[] }) {
  const [root, a, b] = route;
  switch (root) {
    case undefined:
      return <Home />;
    case 'play':
      return <PlaySetup tab={a} />;
    case 'game':
      return <GameScreen />;
    case 'online':
      return <OnlineGameScreen />;
    case 'learn':
      return a && b ? <LessonScreen courseId={a} lessonId={b} /> : <Learn />;
    case 'puzzles':
      return <Puzzles mode={a} />;
    case 'analysis':
      return (
        <Suspense fallback={<div className="screen-loading">Chargement de l’analyse…</div>}>
          <Analysis gameId={a} />
        </Suspense>
      );
    case 'profile':
      return <Profile />;
    default:
      return <Home />;
  }
}

export function App() {
  const route = useRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const name = useProfile((s) => s.name);
  const section = route[0] ?? '';
  const activeNav = section === 'game' || section === 'online' ? 'play' : section;
  const immersive = section === 'game' || section === 'online';

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
        <button className="rail-logo" onClick={() => navigate('')} aria-label="Accueil Chess Arena">
          <svg viewBox="0 0 32 32" aria-hidden>
            <path d="M16 3l3 4h-6zM11 9h10l-2 11h-6zM8 22h16l1.5 4h-19zM6 27h20v2H6z" />
          </svg>
        </button>
        <div className="rail-items">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id || 'home'}
              className={`rail-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => navigate(id)}
              aria-current={activeNav === id ? 'page' : undefined}
            >
              {activeNav === id && <motion.span layoutId="rail-pill" className="rail-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button className="rail-item rail-settings" onClick={() => setSettingsOpen(true)}>
          <Settings />
          <span>Réglages</span>
        </button>
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
      {!name && <Onboarding />}
      <Toasts />
      {__VERCEL__ && <Analytics />}
    </div>
  );
}
