import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Lock, LogIn } from 'lucide-react';
import { useCloud } from '../store/cloud';
import { HomeButton } from './HomeButton';

/** True when the player chose to play without an account. */
export function useIsGuest() {
  const { enabled, guest, user } = useCloud();
  return enabled && guest && !user;
}

/** Replaces account-only screens with an invitation to sign in when playing as a guest. */
export function GuestGate({ feature, children, compact = false }: { feature: string; children: ReactNode; compact?: boolean }) {
  const isGuest = useIsGuest();
  const setGuest = useCloud((s) => s.setGuest);
  if (!isGuest) return <>{children}</>;
  const card = (
    <motion.section className="guest-gate panel" initial={{ opacity: 0, rotateX: -15, y: 20 }} animate={{ opacity: 1, rotateX: 0, y: 0 }}>
      <span className="gate-icon">
        <Lock />
      </span>
      <h1>{feature} : réservé aux comptes</h1>
      <p className="dim">
        Crée un compte gratuit pour débloquer les cours, les puzzles, le jeu en ligne et ton profil avec Elo et historique, sauvegardés sur
        tous tes appareils.
      </p>
      <button className="btn primary lg" onClick={() => setGuest(false)}>
        <LogIn /> Se connecter ou créer un compte
      </button>
    </motion.section>
  );
  if (compact) return card;
  return (
    <div className="container">
      <nav className="page-nav">
        <HomeButton />
      </nav>
      {card}
    </div>
  );
}
