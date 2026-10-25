import { describe, expect, it } from 'vitest';
import { parseInfo } from '../lib/engine/stockfish';
import { classifyMove, formatScore, winChance } from '../lib/engine/eval';
import { capturedPieces, validateFen } from '../lib/chess';
import { buildLine, detectEnd } from '../game/line';
import { START_FEN } from '../lib/chess';

describe('engine output parsing', () => {
  it('normalises scores to White’s point of view', () => {
    const line = 'info depth 12 seldepth 18 multipv 2 score cp 35 nodes 1000 pv e7e5 g1f3';
    expect(parseInfo(line, false)).toMatchObject({ depth: 12, multipv: 2, cp: -35, pv: ['e7e5', 'g1f3'] });
    expect(parseInfo('info depth 9 multipv 1 score mate 3 pv d1h5', true)?.mate).toBe(3);
  });

  it('ignores bound scores', () => {
    expect(parseInfo('info depth 10 multipv 1 score cp 20 lowerbound pv e2e4', true)).toBeNull();
  });
});

describe('evaluation helpers', () => {
  it('maps centipawns to winning chances', () => {
    expect(winChance(0)).toBeCloseTo(50);
    expect(winChance(1000)).toBeGreaterThan(95);
    expect(formatScore({ mate: -2 })).toBe('-M2');
  });

  it('classifies a large drop as a blunder', () => {
    expect(classifyMove(60, 20, 'white', false)).toBe('blunder');
    expect(classifyMove(50, 49.5, 'black', false)).toBe('best');
  });
});

describe('chess helpers', () => {
  it('counts captured material', () => {
    const r = capturedPieces('rnb1kbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 3');
    expect(r.byWhite).toEqual(['q']);
    expect(r.diff).toBe(9);
  });

  it('rejects positions where the side not to move is in check', () => {
    expect(validateFen('k7/8/1K6/8/8/8/8/7Q w - - 0 1')).not.toBeNull();
    expect(validateFen(START_FEN)).toBeNull();
  });

  it('detects the fool’s mate', () => {
    const moves = buildLine(START_FEN, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(detectEnd(START_FEN, moves)).toEqual({ result: '0-1', reason: 'checkmate' });
  });
});
