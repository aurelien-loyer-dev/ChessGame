import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { COURSES } from '../data/lessons';
import { OPENINGS, detectOpening } from '../data/openings';
import puzzles from '../data/puzzles.json';
import { validateFen } from '../lib/chess';

function playUci(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

describe('lessons', () => {
  for (const course of COURSES) {
    for (const lesson of course.lessons) {
      lesson.steps.forEach((step, i) => {
        it(`${course.id}/${lesson.id} step ${i} is playable`, () => {
          if (step.kind === 'info') {
            if (step.moves) {
              const chess = new Chess();
              for (const san of step.moves.split(' ')) chess.move(san);
            }
            return;
          }
          if (step.kind === 'line') {
            const chess = new Chess();
            for (const san of step.line.split(' ')) expect(() => chess.move(san), san).not.toThrow();
            return;
          }
          const chess = new Chess(step.fen);
          if (step.moves) for (const san of step.moves.split(' ')) chess.move(san);
          expect(validateFen(chess.fen())).toBeNull();
          for (const alt of step.alternatives ?? []) {
            expect(() => playUci(new Chess(chess.fen()), alt), alt).not.toThrow();
          }
          for (const uci of step.solution) expect(() => playUci(chess, uci), uci).not.toThrow();
          if (step.anyMate) expect(chess.isCheckmate()).toBe(true);
        });
      });
    }
  }
});

describe('openings', () => {
  it('every book line is legal', () => {
    for (const o of OPENINGS) {
      const chess = new Chess();
      for (const san of o.moves.split(' ')) expect(() => chess.move(san), `${o.name}: ${san}`).not.toThrow();
    }
  });

  it('detects the Najdorf by transposition-aware lookup', () => {
    const chess = new Chess();
    const fens: string[] = [];
    for (const san of 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3'.split(' ')) {
      chess.move(san);
      fens.push(chess.fen());
    }
    expect(detectOpening(fens)?.name).toBe('Sicilienne Najdorf');
  });
});

describe('puzzles', () => {
  it('has a healthy collection', () => {
    expect(puzzles.length).toBeGreaterThan(20);
  });

  for (const p of puzzles as { id: string; fen: string; moves: string[] }[]) {
    it(`puzzle ${p.id} is legal and ends with the solver`, () => {
      const chess = new Chess(p.fen);
      expect(p.moves.length % 2).toBe(0);
      for (const uci of p.moves) expect(() => playUci(chess, uci), uci).not.toThrow();
    });
  }
});
