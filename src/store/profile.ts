import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Color, EndReason, GameResult } from '../lib/types';

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

export type PlayerLevel = 'discover' | 'rules' | 'club' | 'strong';

export const LEVELS: Record<PlayerLevel, { label: string; desc: string; rating: number; botId: string; course: string }> = {
  discover: { label: 'Je découvre', desc: 'Je ne connais pas encore bien les règles.', rating: 400, botId: 'pixel', course: 'bases/plateau' },
  rules: { label: 'Je connais les règles', desc: 'Je joue de temps en temps, sans plan précis.', rating: 800, botId: 'nova', course: 'mats/berger' },
  club: { label: 'Joueur régulier', desc: 'Je connais les tactiques et quelques ouvertures.', rating: 1200, botId: 'orion', course: 'tactiques/fourchette' },
  strong: { label: 'Confirmé', desc: 'Je joue en club ou en ligne au-dessus de 1500.', rating: 1600, botId: 'atlas', course: 'finales/carre' },
};

export interface Avatar {
  glyph: string;
  hue: number;
}

export interface Registration {
  name: string;
  avatar: Avatar;
  level: PlayerLevel;
}

interface ProfileState {
  name: string;
  avatar: Avatar;
  level: PlayerLevel | null;
  /** Timestamp of the sign-up; null until the profile has been created. */
  registeredAt: number | null;
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
  register: (r: Registration) => void;
  setAvatar: (a: Avatar) => void;
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
  avatar: { glyph: '♔', hue: 200 } as Avatar,
  level: null as PlayerLevel | null,
  registeredAt: null as number | null,
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

      register: ({ name, avatar, level }) => {
        const start = LEVELS[level];
        // A brand-new profile starts at the self-assessed strength; an existing one keeps its history.
        const fresh = get().ratingHistory.length === 0 && get().puzzleHistory.length === 0;
        set({
          name,
          avatar,
          level,
          registeredAt: Date.now(),
          lastBotId: start.botId,
          ...(fresh ? { rating: start.rating, puzzleRating: start.rating } : {}),
        });
        get().touchDaily();
      },

      setAvatar: (avatar) => set({ avatar }),

      recordGame: (game) => {
        const state = get();
        let change: { before: number; after: number } | null = null;
        const patch: Partial<ProfileState> = { games: [game, ...state.games].slice(0, 200) };

        // Only bot games move the rating: opponents online have no verified strength.
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
