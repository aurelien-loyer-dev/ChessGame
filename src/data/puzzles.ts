import raw from './puzzles.json';

export interface Puzzle {
  id: string;
  /** Position before the opponent's last move (that move is moves[0]). */
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

export const PUZZLES = raw as Puzzle[];

export const THEME_LABEL: Record<string, string> = {
  mateIn1: 'Mat en 1',
  mateIn2: 'Mat en 2',
  mateIn3: 'Mat en 3',
  mateIn4: 'Mat en 4',
  fork: 'Fourchette',
  sacrifice: 'Sacrifice',
  promotion: 'Promotion',
  hanging: 'Pièce en prise',
  advantage: 'Avantage décisif',
};

function hash(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Same puzzle for everyone on a given day. */
export function dailyPuzzle(date = new Date()): Puzzle {
  const pool = PUZZLES.filter((p) => p.rating >= 1000 && p.rating <= 1900);
  const list = pool.length ? pool : PUZZLES;
  return list[hash(date.toISOString().slice(0, 10)) % list.length];
}

/** Picks an unsolved puzzle close to the player's rating. */
export function nextPuzzle(rating: number, solved: string[], exclude?: string): Puzzle {
  const done = new Set(solved);
  const candidates = PUZZLES.filter((p) => p.id !== exclude && !done.has(p.id));
  const pool = candidates.length ? candidates : PUZZLES.filter((p) => p.id !== exclude);
  const sorted = [...pool].sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating));
  const near = sorted.slice(0, Math.min(8, sorted.length));
  return near[Math.floor(Math.random() * near.length)];
}

/** Increasing-difficulty sequence for Puzzle Rush. */
export function rushSequence(): Puzzle[] {
  const sorted = [...PUZZLES].sort((a, b) => a.rating - b.rating);
  const out: Puzzle[] = [];
  const buckets = 6;
  const size = Math.ceil(sorted.length / buckets);
  for (let b = 0; b < buckets; b++) {
    const slice = sorted.slice(b * size, (b + 1) * size).sort(() => Math.random() - 0.5);
    out.push(...slice.slice(0, 12));
  }
  return out;
}
