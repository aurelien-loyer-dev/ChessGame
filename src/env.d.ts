declare const __VERCEL__: boolean;

interface ImportMetaEnv {
  /** Self-hosted PeerJS broker for online play (defaults to the public 0.peerjs.com). */
  readonly VITE_PEER_HOST?: string;
  readonly VITE_PEER_PORT?: string;
  readonly VITE_PEER_PATH?: string;
  readonly VITE_PEER_SECURE?: string;
  /** Supabase project for cloud accounts; leave both empty to keep the app fully local. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Comma-separated sign-in providers shown to players (github, google, apple). */
  readonly VITE_AUTH_PROVIDERS?: string;
}
