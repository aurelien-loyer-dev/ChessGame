import type { Provider, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Optional cloud accounts (Supabase): OAuth sign-in with GitHub or Google, and
 * one JSON save per player. Without the two env variables the
 * whole feature stays hidden and the app works offline as before.
 */

const URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const CLOUD_ENABLED = !!(URL && KEY);

export const PROVIDERS: { id: Provider; label: string }[] = (import.meta.env.VITE_AUTH_PROVIDERS ?? 'github,google')
  .split(',')
  .map((p) => p.trim())
  .filter((p): p is 'github' | 'google' => p === 'github' || p === 'google')
  .map((id) => ({ id, label: { github: 'GitHub', google: 'Google' }[id] }));

/** Local keys that travel with a cloud save. Consent and session stay per device. */
export const SAVED_KEYS = ['arena.profile', 'arena.settings'] as const;

export interface CloudSave {
  data: Record<string, string>;
  updatedAt: number;
}

export interface CloudUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: string | null;
}

let client: SupabaseClient | null = null;

async function supabase(): Promise<SupabaseClient> {
  if (!CLOUD_ENABLED) throw new Error('Cloud désactivé');
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(URL!, KEY!, {
      auth: {
        // PKCE puts ?code= in the query string, which leaves the hash router alone.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'arena.cloud-auth',
      },
    });
  }
  return client;
}

export function toCloudUser(u: User): CloudUser {
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? null,
    name: (meta.user_name as string) || (meta.full_name as string) || (meta.name as string) || null,
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
    provider: (u.app_metadata?.provider as string) ?? null,
  };
}

export async function signInWith(provider: Provider) {
  const sb = await supabase();
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
}

/** Resolves the current user (finishing an OAuth redirect if there is one) and reports later changes. */
export async function watchAuth(onChange: (user: CloudUser | null) => void): Promise<CloudUser | null> {
  const sb = await supabase();
  sb.auth.onAuthStateChange((_event, session) => onChange(session?.user ? toCloudUser(session.user) : null));
  const { data } = await sb.auth.getSession();
  // Drop ?code=… from the address bar once the session has been exchanged.
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  return data.session?.user ? toCloudUser(data.session.user) : null;
}

export async function cloudSignOut() {
  if (!client) return;
  await client.auth.signOut();
}

export async function loadSave(userId: string): Promise<CloudSave | null> {
  const sb = await supabase();
  const { data, error } = await sb.from('saves').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { data: data.data as Record<string, string>, updatedAt: new Date(data.updated_at as string).getTime() };
}

export async function writeSave(userId: string, data: Record<string, string>): Promise<number> {
  const sb = await supabase();
  const updatedAt = new Date().toISOString();
  const { error } = await sb.from('saves').upsert({ user_id: userId, data, updated_at: updatedAt });
  if (error) throw error;
  return new Date(updatedAt).getTime();
}

export async function deleteCloudAccount() {
  const sb = await supabase();
  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;
  await sb.auth.signOut();
}

export type SyncDecision = 'push' | 'pull' | 'conflict' | 'none';

/**
 * What to do when a player signs in or reopens the app.
 * - nothing in the cloud: upload the local profile if there is one
 * - nothing locally: restore the cloud save
 * - both: whichever side changed since the last sync wins; both changed → ask
 */
export function decideSync(opts: {
  localRegistered: boolean;
  cloud: { updatedAt: number } | null;
  /** Last successful sync for this same user on this device. */
  lastSyncedAt: number | null;
  /** Last local change, or null when nothing changed since the last sync. */
  dirtyAt: number | null;
}): SyncDecision {
  const { localRegistered, cloud, lastSyncedAt, dirtyAt } = opts;
  if (!cloud) return localRegistered ? 'push' : 'none';
  if (!localRegistered) return 'pull';
  if (lastSyncedAt === null) return 'conflict';
  const cloudChanged = cloud.updatedAt > lastSyncedAt + 1000;
  const localChanged = dirtyAt !== null && dirtyAt > lastSyncedAt;
  if (cloudChanged && localChanged) return 'conflict';
  if (cloudChanged) return 'pull';
  if (localChanged) return 'push';
  return 'none';
}
