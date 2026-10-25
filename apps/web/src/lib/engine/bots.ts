import { Chess } from 'chess.js';
import { getAnalysisEngine, getPlayEngine } from './stockfish';
import { lineToCp } from './eval';

/**
 * Bot personas. Levels at 1320+ use Stockfish's own Elo limiter (UCI_Elo),
 * lower ones sample among the top engine moves with a temperature so they
 * make human-like mistakes instead of random blunders.
 */
export type BotStyle =
  | { kind: 'sample'; depth: number; multipv: number; temperature: number; blunder: number }
  | { kind: 'elo'; elo: number; movetime: number }
  | { kind: 'max'; movetime: number };

export interface Bot {
  id: string;
  name: string;
  elo: number;
  title: string;
  bio: string;
  hue: number;
  glyph: string;
  style: BotStyle;
}

export const BOTS: Bot[] = [
  {
    id: 'pixel',
    name: 'Pixel',
    elo: 400,
    title: 'Débutant',
    bio: 'Connaît les règles, laisse souvent des pièces en prise.',
    hue: 160,
    glyph: '♙',
    style: { kind: 'sample', depth: 2, multipv: 10, temperature: 260, blunder: 0.2 },
  },
  {
    id: 'nova',
    name: 'Nova',
    elo: 800,
    title: 'Novice',
    bio: 'Voit les prises simples, rate les tactiques à deux coups.',
    hue: 190,
    glyph: '♘',
    style: { kind: 'sample', depth: 4, multipv: 6, temperature: 130, blunder: 0.08 },
  },
  {
    id: 'orion',
    name: 'Orion',
    elo: 1100,
    title: 'Joueur de club',
    bio: 'Solide dans les ouvertures, fragile sous la pression.',
    hue: 210,
    glyph: '♗',
    style: { kind: 'sample', depth: 7, multipv: 4, temperature: 55, blunder: 0.03 },
  },
  {
    id: 'vega',
    name: 'Vega',
    elo: 1400,
    title: 'Confirmé',
    bio: 'Calcule proprement et punit les pièces non défendues.',
    hue: 235,
    glyph: '♖',
    style: { kind: 'elo', elo: 1400, movetime: 600 },
  },
  {
    id: 'atlas',
    name: 'Atlas',
    elo: 1700,
    title: 'Fort joueur',
    bio: 'Positionnel, aime échanger vers des finales favorables.',
    hue: 260,
    glyph: '♕',
    style: { kind: 'elo', elo: 1700, movetime: 800 },
  },
  {
    id: 'helix',
    name: 'Helix',
    elo: 2000,
    title: 'Expert',
    bio: 'Tactique tranchante, rarement pris en défaut.',
    hue: 290,
    glyph: '♔',
    style: { kind: 'elo', elo: 2000, movetime: 1000 },
  },
  {
    id: 'zenith',
    name: 'Zenith',
    elo: 2400,
    title: 'Maître international',
    bio: 'Niveau titré : chaque imprécision se paie.',
    hue: 330,
    glyph: '♛',
    style: { kind: 'elo', elo: 2400, movetime: 1200 },
  },
  {
    id: 'apex',
    name: 'Apex',
    elo: 2800,
    title: 'Super grand maître',
    bio: 'Le niveau des meilleurs joueurs du monde.',
    hue: 20,
    glyph: '♚',
    style: { kind: 'elo', elo: 2800, movetime: 1500 },
  },
  {
    id: 'singularity',
    name: 'Singularity',
    elo: 3200,
    title: 'Stockfish 19 · pleine puissance',
    bio: 'Aucune limite. Bonne chance.',
    hue: 45,
    glyph: '◆',
    style: { kind: 'max', movetime: 2000 },
  },
];

export function getBot(id: string): Bot {
  return BOTS.find((b) => b.id === id) ?? BOTS[2];
}

const MIN_THINK_MS = 450;

/** Picks the bot's move (UCI) for the given position. */
export async function botMove(bot: Bot, fen: string, signal?: AbortSignal): Promise<string | null> {
  const started = performance.now();
  const engine = getPlayEngine();
  const style = bot.style;
  let move: string | null = null;

  if (style.kind === 'sample') {
    const { lines, bestmove } = await engine.search(fen, {
      depth: style.depth,
      multipv: style.multipv,
      signal,
    });
    move = sampleMove(fen, lines, style.temperature, style.blunder) ?? bestmove;
  } else if (style.kind === 'elo') {
    const res = await engine.search(fen, {
      movetime: style.movetime,
      setoptions: { UCI_LimitStrength: true, UCI_Elo: style.elo },
      signal,
    });
    move = res.bestmove;
  } else {
    const res = await engine.search(fen, { movetime: style.movetime, signal });
    move = res.bestmove;
  }

  // Small human-like pause so instant replies don't feel robotic.
  const elapsed = performance.now() - started;
  const pause = MIN_THINK_MS + Math.random() * 350 - elapsed;
  if (pause > 0) await new Promise((r) => setTimeout(r, pause));
  if (signal?.aborted) return null;
  return move;
}

function sampleMove(
  fen: string,
  lines: { cp?: number; mate?: number; pv: string[] }[],
  temperature: number,
  blunder: number,
): string | null {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;

  if (Math.random() < blunder) {
    const pick = legal[Math.floor(Math.random() * legal.length)];
    return pick.from + pick.to + (pick.promotion ?? '');
  }
  if (!lines.length) return null;

  const sign = chess.turn() === 'w' ? 1 : -1;
  const scores = lines.map((l) => sign * lineToCp(l));
  const best = Math.max(...scores);
  const weights = scores.map((s) => Math.exp((s - best) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < lines.length; i++) {
    r -= weights[i];
    if (r <= 0) return lines[i].pv[0];
  }
  return lines[0].pv[0];
}

/** Best move for hints, at a strength high enough to be trustworthy. */
export async function hintMove(fen: string): Promise<string | null> {
  const res = await getAnalysisEngine().search(fen, { depth: 16, movetime: 1500 });
  return res.bestmove;
}
