const K_PROVISIONAL = 40;
const K_DEFAULT = 20;

/** Standard Elo update. `score` is 1 for a win, 0.5 for a draw, 0 for a loss. */
export function eloUpdate(rating: number, opponent: number, score: number, games: number): number {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400));
  const k = games < 20 ? K_PROVISIONAL : K_DEFAULT;
  return Math.round(rating + k * (score - expected));
}
