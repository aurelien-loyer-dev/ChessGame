import { ArrowLeft, House } from 'lucide-react';
import { navigate } from '../lib/router';

/** Always-visible way back: to a parent screen when given, otherwise to the home page. */
export function HomeButton({ to = '', label = 'Accueil' }: { to?: string; label?: string }) {
  return (
    <button className="btn ghost sm home-btn" onClick={() => navigate(to)}>
      {to ? <ArrowLeft /> : <House />} {label}
    </button>
  );
}
