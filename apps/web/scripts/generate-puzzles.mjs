// Generates tactical puzzles by self-play: finds positions right after a mistake
// where exactly one move wins, then extends the forced line. Output is merged
// into src/data/puzzles.json. Usage: node scripts/generate-puzzles.mjs <count> <workers>
import { Chess } from 'chess.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Engine, score } from './uci.mjs';

const TARGET = Number(process.argv[2] ?? 60);
const MIN_RATING = Number(process.argv[4] ?? 0);
const WORKERS = Number(process.argv[3] ?? 3);
const OUT = new URL('../src/data/puzzles.json', import.meta.url);
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const existing = (existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : []).map((p) => ({ ...p, themes: classify(p) }));
const seen = new Set(existing.map((p) => p.fen.split(' ').slice(0, 4).join(' ')));
const puzzles = [...existing];
let produced = 0;

function uciMove(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

function pick(lines, temperature) {
  const scores = lines.map(score);
  const best = Math.max(...scores);
  const w = scores.map((s) => Math.exp((s - best) / temperature));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lines.length; i++) if ((r -= w[i]) <= 0) return lines[i].pv[0];
  return lines[0].pv[0];
}

function attackedValuable(chess, square) {
  // Count enemy pieces (or king) attacked by the piece on `square`.
  const piece = chess.get(square);
  if (!piece) return 0;
  const fen = chess.fen().split(' ');
  fen[1] = piece.color; // pretend it's our move again to list attacks
  fen[3] = '-';
  let probe;
  try {
    probe = new Chess(fen.join(' '));
  } catch {
    return 0;
  }
  const targets = new Set();
  for (const m of probe.moves({ square, verbose: true })) {
    if (m.captured && (VALUE[m.captured] > VALUE[piece.type] || m.captured === 'k' || VALUE[m.captured] >= 3)) targets.add(m.to);
  }
  // A check counts as attacking the king.
  if (chess.inCheck()) targets.add('king');
  return targets.size;
}

function material(chess, color) {
  let m = 0;
  for (const row of chess.board()) for (const sq of row) if (sq) m += (sq.color === color ? 1 : -1) * VALUE[sq.type];
  return m;
}

/** Tags a puzzle from its solution line (solver = side to move after moves[0]). */
export function classify(p) {
  const chess = new Chess(p.fen);
  uciMove(chess, p.moves[0]);
  const solver = chess.turn();
  const start = material(chess, solver);
  const themes = [];
  const solverMoves = p.moves.slice(1).filter((_, i) => i % 2 === 0);
  let afterReply = null;
  let first = null;
  p.moves.slice(1).forEach((uci, i) => {
    const m = uciMove(chess, uci);
    if (i === 0) first = { move: m, fen: chess.fen() };
    if (i === 1) afterReply = material(chess, solver);
    if (m.promotion && i % 2 === 0) themes.push('promotion');
  });
  if (chess.isCheckmate()) themes.unshift(`mateIn${solverMoves.length}`);
  const end = material(chess, solver);
  if (first && first.move.piece !== 'k' && attackedValuable(new Chess(first.fen), first.move.to) >= 2) themes.push('fork');
  if (afterReply !== null && afterReply < start && (end > start || chess.isCheckmate())) themes.push('sacrifice');
  if (!themes.length && solverMoves.length === 1 && first?.move.captured) themes.push('hanging');
  if (!themes.length) themes.push('advantage');
  return [...new Set(themes)];
}

async function solveLine(engine, fen) {
  // Extends the forced line from the solver's perspective.
  const chess = new Chess(fen);
  const moves = [];
  let mateLine = false;
  for (let i = 0; i < 4; i++) {
    const { lines } = await engine.analyse(chess.fen(), { depth: 16, multipv: 2 });
    const [a, b] = lines;
    if (!a) break;
    const sa = score(a);
    const sb = b ? score(b) : -100000;
    const unique =
      a.mate > 0 ? i > 0 || !(b && b.mate > 0) : sa >= 200 && sa - sb >= 220;
    if (!unique) {
      if (i === 0) return null;
      moves.pop(); // drop the opponent reply that led nowhere forced
      break;
    }
    if (a.mate > 0) mateLine = true;
    uciMove(chess, a.pv[0]);
    moves.push(a.pv[0]);
    if (chess.isCheckmate()) return { moves, mate: true };
    if (chess.isGameOver() || (!mateLine && i >= 2)) break;
    const reply = await engine.analyse(chess.fen(), { depth: 14, multipv: 1 });
    if (!reply.bestmove || reply.bestmove === '(none)') break;
    uciMove(chess, reply.bestmove);
    moves.push(reply.bestmove);
  }
  if (moves.length % 2 === 0) moves.pop();
  return moves.length ? { moves, mate: false } : null;
}

async function estimateRating(engine, fen, first, mateIn) {
  for (const [depth, rating] of [[3, 700], [6, 1050], [9, 1400], [12, 1750]]) {
    const { bestmove } = await engine.analyse(fen, { depth, multipv: 1 });
    if (bestmove === first) return rating + (mateIn ? -100 : 0) + Math.round(Math.random() * 120);
  }
  return 2050 + Math.round(Math.random() * 200);
}

async function worker(id) {
  const engine = new Engine();
  await engine.init();
  while (produced < TARGET) {
    const chess = new Chess();
    let prevEval = 0;
    for (let ply = 0; ply < 90 && !chess.isGameOver() && produced < TARGET; ply++) {
      const fen = chess.fen();
      const { lines } = await engine.analyse(fen, { depth: 8, multipv: 5 });
      if (!lines.length) break;
      const evalNow = score(lines[0]);

      // A puzzle appears when the side to move suddenly has one winning move.
      if (ply >= 12 && prevEval <= 120 && evalNow >= 280 && !seen.has(fen.split(' ').slice(0, 4).join(' '))) {
        const deep = await engine.analyse(fen, { depth: 16, multipv: 2 });
        const [a, b] = deep.lines;
        const sa = score(a);
        const sb = b ? score(b) : -100000;
        if (a && sa >= 250 && (sa - sb >= 220 || (a.mate > 0 && !(b?.mate > 0)))) {
          const line = await solveLine(engine, fen);
          const last = chess.history({ verbose: true }).at(-1);
          const trivialRecapture = last?.captured && line && line.moves[0].slice(2, 4) === last.to;
          if (line && !trivialRecapture && last) {
            const mateIn = line.mate ? Math.ceil(line.moves.length / 2) : 0;
            const rating = await estimateRating(engine, fen, line.moves[0], mateIn);
            // Store the position before the opponent's mistake, like Lichess does.
            const before = new Chess();
            const hist = chess.history({ verbose: true });
            for (const m of hist.slice(0, -1)) before.move(m.san);
            const puzzle = {
              id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
              fen: before.fen(),
              moves: [last.from + last.to + (last.promotion ?? ''), ...line.moves],
              rating,
              themes: [],
            };
            puzzle.themes = classify(puzzle);
            if (rating < MIN_RATING && !puzzle.themes.some((t) => t.startsWith('mate') || t === 'fork' || t === 'sacrifice')) {
              break;
            }
            seen.add(fen.split(' ').slice(0, 4).join(' '));
            puzzles.push(puzzle);
            produced++;
            writeFileSync(OUT, JSON.stringify(puzzles, null, 0).replace(/},{/g, '},\n{'));
            console.log(`[w${id}] #${produced} rating ${rating} ${puzzle.themes.join(',')} ${puzzle.moves.join(' ')}`);
            break; // new game after a puzzle, for variety
          }
        }
      }

      // Self-play with mistakes: mostly reasonable moves, sometimes poor ones.
      const temperature = Math.random() < 0.25 ? 140 : 35;
      uciMove(chess, pick(lines, temperature));
      // Eval before this move, seen from the side that moves next.
      prevEval = -evalNow;
    }
  }
  engine.quit();
}

await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
console.log(`done: ${puzzles.length} puzzles`);
process.exit(0);
