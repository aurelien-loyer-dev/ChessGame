import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Color, EndReason, GameResult } from '@chess/shared';

export type GameMode = 'bot' | 'local' | 'online';

export interface SavedGame {
  id: string;
  date: number;
  mode: GameMode;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  /** Side played by the user (null for local games). */
  you: Color | null;
  result: GameResult;
  reason: EndReason;
  moves: string[];
  startFen?: string;
  tc: string;
  botId?: string;
  accuracy?: { white: number; black: number };
}

export interface RatingPoint {
  date: number;
  rating: number;
}

interface ProfileState {
  name: string;
  rating: number;
  ratingHistory: RatingPoint[];
  games: SavedGame[];
  puzzleRating: number;
  puzzleHistory: RatingPoint[];
  puzzlesSolved: string[];
  puzzleStreak: number;
  bestPuzzleStreak: number;
  rushBest: number;
  lessonsDone: string[];
  botsBeaten: string[];
  lastBotId: string;
  dailyStreak: { lastDay: string; count: number };

  setName: (name: string) => void;
  recordGame: (game: SavedGame) => { before: number; after: number } | null;
  updateGame: (id: string, patch: Partial<SavedGame>) => void;
  recordPuzzle: (id: string, rating: number, solved: boolean) => { before: number; after: number };
  setRushBest: (score: number) => void;
  completeLesson: (id: string) => void;
  setLastBot: (id: string) => void;
  touchDaily: () => void;
  reset: () => void;
}

function expected(a: number, b: number) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const initial = {
  name: '',
  rating: 1000,
  ratingHistory: [] as RatingPoint[],
  games: [] as SavedGame[],
  puzzleRating: 1000,
  puzzleHistory: [] as RatingPoint[],
  puzzlesSolved: [] as string[],
  puzzleStreak: 0,
  bestPuzzleStreak: 0,
  rushBest: 0,
  lessonsDone: [] as string[],
  botsBeaten: [] as string[],
  lastBotId: 'orion',
  dailyStreak: { lastDay: '', count: 0 },
};

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...initial,

      setName: (name) => set({ name }),

      recordGame: (game) => {
        const state = get();
        let change: { before: number; after: number } | null = null;
        const patch: Partial<ProfileState> = { games: [game, ...state.games].slice(0, 200) };

        // Only bot games move the local rating: online games use the server rating.
        if (game.mode === 'bot' && game.you && game.moves.length >= 2) {
          const opp = game.you === 'white' ? game.blackElo : game.whiteElo;
          if (opp) {
            const score = game.result === '1/2-1/2' ? 0.5 : (game.result === '1-0') === (game.you === 'white') ? 1 : 0;
            const k = state.ratingHistory.length < 15 ? 40 : 24;
            const after = Math.max(100, Math.round(state.rating + k * (score - expected(state.rating, opp))));
            change = { before: state.rating, after };
            patch.rating = after;
            patch.ratingHistory = [...state.ratingHistory, { date: game.date, rating: after }].slice(-300);
            if (score === 1 && game.botId && !state.botsBeaten.includes(game.botId)) {
              patch.botsBeaten = [...state.botsBeaten, game.botId];
            }
          }
        }
        set(patch);
        get().touchDaily();
        return change;
      },

      updateGame: (id, patch) => set({ games: get().games.map((g) => (g.id === id ? { ...g, ...patch } : g)) }),

      recordPuzzle: (id, rating, solved) => {
        const s = get();
        const k = s.puzzleHistory.length < 20 ? 40 : 20;
        const after = Math.max(100, Math.round(s.puzzleRating + k * ((solved ? 1 : 0) - expected(s.puzzleRating, rating))));
        const streak = solved ? s.puzzleStreak + 1 : 0;
        set({
          puzzleRating: after,
          puzzleHistory: [...s.puzzleHistory, { date: Date.now(), rating: after }].slice(-300),
          puzzlesSolved: solved && !s.puzzlesSolved.includes(id) ? [...s.puzzlesSolved, id] : s.puzzlesSolved,
          puzzleStreak: streak,
          bestPuzzleStreak: Math.max(s.bestPuzzleStreak, streak),
        });
        get().touchDaily();
        return { before: s.puzzleRating, after };
      },

      setRushBest: (score) => set({ rushBest: Math.max(get().rushBest, score) }),

      completeLesson: (id) => {
        const done = get().lessonsDone;
        if (!done.includes(id)) set({ lessonsDone: [...done, id] });
        get().touchDaily();
      },

      setLastBot: (id) => set({ lastBotId: id }),

      touchDaily: () => {
        const { dailyStreak } = get();
        const day = today();
        if (dailyStreak.lastDay === day) return;
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        set({ dailyStreak: { lastDay: day, count: dailyStreak.lastDay === yesterday ? dailyStreak.count + 1 : 1 } });
      },

      reset: () => set({ ...initial }),
    }),
    { name: 'arena.profile', version: 1 },
  ),
);
