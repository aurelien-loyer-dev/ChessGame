declare const __VERCEL__: boolean;

interface ImportMetaEnv {
  /** Self-hosted PeerJS broker for online play (defaults to the public 0.peerjs.com). */
  readonly VITE_PEER_HOST?: string;
  readonly VITE_PEER_PORT?: string;
  readonly VITE_PEER_PATH?: string;
  readonly VITE_PEER_SECURE?: string;
}
