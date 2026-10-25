// Verifies lesson exercises with Stockfish: every accepted first move must be
// winning/holding and clearly better than the alternatives the learner might try.
import { Chess } from 'chess.js';
import { Engine, score } from './uci.mjs';

const { COURSES } = await import('../src/data/lessons.ts');
const engine = new Engine();
await engine.init();
let problems = 0;

for (const course of COURSES) {
  for (const lesson of course.lessons) {
    for (const [i, step] of lesson.steps.entries()) {
      if (step.kind !== 'move' || step.rule) continue;
      const chess = new Chess(step.fen);
      if (step.moves) for (const san of step.moves.split(' ')) chess.move(san);
      const fen = chess.fen();
      const accepted = [step.solution[0], ...(step.alternatives ?? [])];
      if (step.fen && !chess) continue;
      const { lines } = await engine.analyse(fen, { depth: 18, multipv: 5 });
      const best = score(lines[0]);
      const tag = `${course.id}/${lesson.id}#${i}`;
      const desc = lines.map((l) => `${l.pv[0]}:${l.mate !== undefined ? 'M' + l.mate : l.cp}`).join(' ');
      for (const mv of accepted) {
        const line = lines.find((l) => l.pv[0] === mv);
        const s = line ? score(line) : null;
        if (s === null || s < best - 150) {
          problems++;
          console.log(`✗ ${tag} accepted ${mv} not among good moves: ${desc}`);
        }
      }
      const rejectedGood = lines.filter((l) => !accepted.includes(l.pv[0]) && score(l) >= best - 60 && !(step.anyMate && l.mate === 1));
      if (rejectedGood.length) console.log(`! ${tag} other strong moves not accepted: ${rejectedGood.map((l) => l.pv[0]).join(',')} | ${desc}`);
      else console.log(`✓ ${tag} ${desc}`);
    }
  }
}
engine.quit();
process.exit(problems ? 1 : 0);
