import { describe, expect, it } from 'vitest';
import { OnlineGame } from '../src/game';
import { eloUpdate } from '../src/elo';

const W = { id: 'w', name: 'White', rating: 1200 };
const B = { id: 'b', name: 'Black', rating: 1200 };

describe('OnlineGame', () => {
  it('rejects illegal and out-of-turn moves', () => {
    const g = new OnlineGame('g', W, B, { initial: 60, increment: 0 });
    expect(g.play('black', 'e7e5', 0).ok).toBe(false);
    expect(g.play('white', 'e2e5', 0).ok).toBe(false);
    expect(g.play('white', 'e2e4', 0).ok).toBe(true);
  });

  it('starts clocks after both first moves and applies increments from move 2', () => {
    const g = new OnlineGame('g', W, B, { initial: 60, increment: 2 });
    g.play('white', 'e2e4', 0);
    g.play('black', 'e7e5', 5_000);
    expect(g.clocks).toEqual({ white: 60_000, black: 60_000 });
    expect(g.running).toBe('white');
    g.play('white', 'g1f3', 15_000);
    // 10s spent, +2s increment
    expect(g.clocks.white).toBe(52_000);
    expect(g.clocksAt(20_000).black).toBe(55_000);
  });

  it('flags a player who runs out of time', () => {
    const g = new OnlineGame('g', W, B, { initial: 10, increment: 0 });
    g.play('white', 'e2e4', 0);
    g.play('black', 'e7e5', 0);
    const res = g.play('white', 'g1f3', 11_000);
    expect(res.ok && res.end?.reason).toBe('timeout');
    expect(g.result).toBe('0-1');
  });

  it('draws on time when the opponent has a lone king', () => {
    const g = new OnlineGame('g', W, B, { initial: 10, increment: 0 });
    g.chess.load('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(g.finishOnTime('white').result).toBe('1/2-1/2');
  });

  it('detects checkmate', () => {
    const g = new OnlineGame('g', W, B, { initial: 0, increment: 0 });
    for (const [c, m] of [['white', 'f2f3'], ['black', 'e7e5'], ['white', 'g2g4']] as const) g.play(c, m, 0);
    const res = g.play('black', 'd8h4', 0);
    expect(res.ok && res.end).toEqual({ result: '0-1', reason: 'checkmate' });
  });
});

describe('eloUpdate', () => {
  it('moves ratings symmetrically between equals', () => {
    expect(eloUpdate(1200, 1200, 1, 30)).toBe(1210);
    expect(eloUpdate(1200, 1200, 0, 30)).toBe(1190);
    expect(eloUpdate(1200, 1200, 0.5, 30)).toBe(1200);
  });
});
