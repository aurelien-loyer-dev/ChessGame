import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BoardTheme = 'steel' | 'glacier' | 'walnut' | 'jade';

export const BOARD_THEMES: Record<BoardTheme, { label: string; light: string; dark: string }> = {
  steel: { label: 'Acier', light: '#a9b6c6', dark: '#4d5d72' },
  glacier: { label: 'Glacier', light: '#dfe9f2', dark: '#7d9bb8' },
  walnut: { label: 'Noyer', light: '#e6cfa8', dark: '#a4774f' },
  jade: { label: 'Jade', light: '#d4dfc8', dark: '#5f8a6c' },
};

interface SettingsState {
  boardTheme: BoardTheme;
  sound: boolean;
  volume: number;
  coordinates: boolean;
  legalMoves: boolean;
  animations: boolean;
  autoQueen: boolean;
  view3d: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      boardTheme: 'steel',
      sound: true,
      volume: 0.6,
      coordinates: true,
      legalMoves: true,
      animations: true,
      autoQueen: false,
      view3d: false,
      set: (patch) => set(patch),
    }),
    { name: 'arena.settings', version: 1 },
  ),
);
