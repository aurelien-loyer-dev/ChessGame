import { useOnline } from '../online/store';
import { useCloud } from '../store/cloud';

/**
 * Account actions for a profile that only lives in this browser:
 * there is no server session, so signing out means removing the profile
 * from this device (after an optional export), and "deleting the account"
 * means erasing every key the app stores.
 */

const PREFIX = 'arena.';
/** Keys that make up the account itself; settings and consent survive a sign-out. */
const ACCOUNT_KEYS = ['arena.profile', 'arena.session'];

interface ExportFile {
  app: 'chess-arena';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

function appKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
  } catch {
    // Storage unavailable: nothing to list.
  }
  return keys;
}

/** Everything the app stores about the player, as a downloadable JSON file (GDPR portability). */
export function downloadAccount(filename = 'chess-arena-mes-donnees.json') {
  const data: Record<string, string> = {};
  for (const k of appKeys()) data[k] = localStorage.getItem(k) ?? '';
  const file: ExportFile = { app: 'chess-arena', version: 1, exportedAt: new Date().toISOString(), data };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Restores an export (also accepts the older profile-only format). Returns an error message or null. */
export async function importAccount(file: File): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return 'Ce fichier n’est pas un export Chess Arena.';
  }
  const p = parsed as Partial<ExportFile> & { state?: { rating?: unknown } };
  let entries: [string, string][];
  if (p.app === 'chess-arena' && p.data && typeof p.data === 'object') {
    entries = Object.entries(p.data).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === 'string');
  } else if (p.state && typeof p.state.rating === 'number') {
    entries = [['arena.profile', JSON.stringify(parsed)]];
  } else {
    return 'Ce fichier n’est pas un export Chess Arena.';
  }
  if (!entries.some(([k]) => k === 'arena.profile')) return 'Ce fichier ne contient pas de profil.';
  try {
    for (const [k, v] of entries) localStorage.setItem(k, v);
  } catch {
    return 'Impossible d’enregistrer dans ce navigateur (stockage plein ou bloqué).';
  }
  location.reload();
  return null;
}

function leaveOnline() {
  try {
    useOnline.getState().leaveGame();
  } catch {
    // Not connected.
  }
}

/** Removes the profile from this device (saving it online first when signed in) and returns to the sign-up screen. */
export async function signOut() {
  leaveOnline();
  await useCloud.getState().signOut().catch(() => undefined);
  try {
    for (const k of ACCOUNT_KEYS) localStorage.removeItem(k);
  } catch {
    // Nothing stored.
  }
  location.hash = '#/';
  location.reload();
}

/** Erases every piece of data the app keeps in this browser (GDPR erasure). The online account is deleted separately. */
export async function eraseEverything() {
  leaveOnline();
  await useCloud.getState().signOut().catch(() => undefined);
  try {
    for (const k of appKeys()) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch {
    // Nothing stored.
  }
  location.hash = '#/';
  location.reload();
}
