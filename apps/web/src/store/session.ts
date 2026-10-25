import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Color, TimeControl } from '@chess/shared';

export interface Assists {
  hints: boolean;
  takebacks: boolean;
  evalBar: boolean;
}

export interface OfflineSession {
  key: number;
  mode: 'bot' | 'local';
  botId: string;
  colorChoice: Color | 'random';
  color: Color;
  tc: TimeControl;
  startFen?: string;
  assists: Assists;
}

interface SessionState {
  offline: OfflineSession | null;
  /** Last choices on the play screen, remembered between visits. */
  prefs: { botId: string; colorChoice: Color | 'random'; tcId: string; assists: Assists; onlineTcId: string };
  startOffline: (s: Omit<OfflineSession, 'key' | 'color'>) => void;
  rematch: () => void;
  setPrefs: (p: Partial<SessionState['prefs']>) => void;
}

function pickColor(choice: Color | 'random'): Color {
  return choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : choice;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      offline: null,
      prefs: {
        botId: 'orion',
        colorChoice: 'white',
        tcId: '10+0',
        assists: { hints: true, takebacks: true, evalBar: false },
        onlineTcId: '5+0',
      },
      startOffline: (s) => set({ offline: { ...s, key: Date.now(), color: pickColor(s.colorChoice) } }),
      rematch: () => {
        const cur = get().offline;
        if (!cur) return;
        // Alternate colors on rematch unless a fixed color was chosen.
        const color = cur.colorChoice === 'random' ? (cur.color === 'white' ? 'black' : 'white') : cur.color;
        set({ offline: { ...cur, key: Date.now(), color } });
      },
      setPrefs: (p) => set({ prefs: { ...get().prefs, ...p } }),
    }),
    { name: 'arena.session', version: 1 },
  ),
);
