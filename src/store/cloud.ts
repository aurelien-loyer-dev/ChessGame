import { create } from 'zustand';
import type { Provider } from '@supabase/supabase-js';
import {
  CLOUD_ENABLED,
  SAVED_KEYS,
  cloudSignOut,
  decideSync,
  deleteCloudAccount,
  loadSave,
  signInWith,
  watchAuth,
  writeSave,
  type CloudSave,
  type CloudUser,
} from '../lib/cloud';
import { useProfile } from './profile';
import { useSettings } from './settings';

/** Sync bookkeeping kept on this device, per signed-in user. */
interface SyncMeta {
  userId: string | null;
  lastSyncedAt: number | null;
  dirtyAt: number | null;
}

const META_KEY = 'arena.cloud';

function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as SyncMeta;
  } catch {
    // Unreadable meta behaves like a first sync.
  }
  return { userId: null, lastSyncedAt: null, dirtyAt: null };
}

function writeMeta(patch: Partial<SyncMeta>) {
  const next = { ...readMeta(), ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: sync still works for this session.
  }
  return next;
}

function collect(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const k of SAVED_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v) data[k] = v;
    } catch {
      // Skip unreadable keys.
    }
  }
  return data;
}

function applyAndReload(save: CloudSave, userId: string) {
  try {
    for (const [k, v] of Object.entries(save.data)) if ((SAVED_KEYS as readonly string[]).includes(k)) localStorage.setItem(k, v);
  } catch {
    return;
  }
  writeMeta({ userId, lastSyncedAt: save.updatedAt, dirtyAt: null });
  location.reload();
}

interface CloudState {
  enabled: boolean;
  ready: boolean;
  user: CloudUser | null;
  status: 'idle' | 'syncing' | 'synced' | 'error';
  error: string | null;
  lastSyncedAt: number | null;
  /** Cloud save that conflicts with local changes, waiting for the player's choice. */
  conflict: CloudSave | null;
  /** The player opened a password-reset link and must choose a new password. */
  recovering: boolean;
  /** Playing without an account: progress is not saved and some features are locked. */
  guest: boolean;

  init: () => void;
  signIn: (provider: Provider) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  resolveConflict: (keep: 'cloud' | 'local') => Promise<void>;
  deleteAccount: () => Promise<void>;
  setGuest: (guest: boolean) => void;
  finishRecovery: () => void;
}

const GUEST_KEY = 'arena.guest';

function readGuest(): boolean {
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

let started = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
/** User id already reconciled in this page load (auth events can fire twice). */
let reconciledFor: string | null = null;

export const useCloud = create<CloudState>()((set, get) => {
  const push = async () => {
    const user = get().user;
    if (!user || get().conflict) return;
    if (!useProfile.getState().registeredAt) return;
    set({ status: 'syncing', error: null });
    try {
      const at = await writeSave(user.id, collect());
      writeMeta({ userId: user.id, lastSyncedAt: at, dirtyAt: null });
      set({ status: 'synced', lastSyncedAt: at });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'Synchronisation impossible' });
    }
  };

  const reconcileOnce = (user: CloudUser) => {
    if (reconciledFor === user.id) return;
    reconciledFor = user.id;
    void reconcile(user);
  };

  const reconcile = async (user: CloudUser) => {
    set({ status: 'syncing', error: null });
    try {
      const cloud = await loadSave(user.id);
      const meta = readMeta();
      const sameUser = meta.userId === user.id;
      const decision = decideSync({
        localRegistered: !!useProfile.getState().registeredAt,
        cloud,
        lastSyncedAt: sameUser ? meta.lastSyncedAt : null,
        dirtyAt: sameUser ? meta.dirtyAt : Date.now(),
      });
      if (decision === 'pull' && cloud) return applyAndReload(cloud, user.id);
      if (decision === 'conflict' && cloud) return set({ conflict: cloud, status: 'idle' });
      if (decision === 'push') return push();
      writeMeta({ userId: user.id });
      set({ status: 'synced', lastSyncedAt: sameUser ? meta.lastSyncedAt : null });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'Synchronisation impossible' });
    }
  };

  const markDirty = () => {
    writeMeta({ dirtyAt: Date.now() });
    if (!get().user || get().conflict) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), 3000);
  };

  return {
    enabled: CLOUD_ENABLED,
    ready: !CLOUD_ENABLED,
    user: null,
    status: 'idle',
    error: null,
    lastSyncedAt: readMeta().lastSyncedAt,
    conflict: null,
    recovering: false,
    guest: readGuest(),

    setGuest: (guest) => {
      try {
        if (guest) sessionStorage.setItem(GUEST_KEY, '1');
        else sessionStorage.removeItem(GUEST_KEY);
      } catch {
        // Guest mode then lasts until the page closes.
      }
      set({ guest });
    },

    finishRecovery: () => set({ recovering: false }),

    init: () => {
      if (!CLOUD_ENABLED || started) return;
      started = true;
      useProfile.subscribe(markDirty);
      useSettings.subscribe(markDirty);
      watchAuth((user, event) => {
        if (event === 'PASSWORD_RECOVERY') set({ recovering: true });
        if (user) get().setGuest(false);
        set({ user });
        if (user) reconcileOnce(user);
        else reconciledFor = null;
      })
        .then((user) => {
          set({ user, ready: true });
          if (user) reconcileOnce(user);
        })
        .catch(() => set({ ready: true, status: 'error', error: 'Service de comptes injoignable' }));
    },

    signIn: async (provider) => {
      set({ error: null });
      try {
        await signInWith(provider);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : 'Connexion impossible' });
      }
    },

    signOut: async () => {
      if (pushTimer) clearTimeout(pushTimer);
      // Last chance to save local changes before leaving.
      if (get().user && readMeta().dirtyAt) await push();
      await cloudSignOut().catch(() => undefined);
      writeMeta({ userId: null, lastSyncedAt: null, dirtyAt: null });
      reconciledFor = null;
      set({ user: null, status: 'idle', lastSyncedAt: null, conflict: null });
    },

    syncNow: async () => {
      const user = get().user;
      if (user) await reconcile(user);
    },

    resolveConflict: async (keep) => {
      const { conflict, user } = get();
      if (!conflict || !user) return;
      if (keep === 'cloud') return applyAndReload(conflict, user.id);
      set({ conflict: null });
      await push();
    },

    deleteAccount: async () => {
      await deleteCloudAccount();
      writeMeta({ userId: null, lastSyncedAt: null, dirtyAt: null });
      set({ user: null, status: 'idle', lastSyncedAt: null, conflict: null });
    },
  };
});
