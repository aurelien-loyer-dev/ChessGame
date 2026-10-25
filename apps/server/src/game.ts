import { Chess } from 'chess.js';
import type { Color, EndReason, GameResult, GameSnapshot, PublicPlayer, TimeControl } from '@chess/shared';

export interface GameEnd {
  result: GameResult;
  reason: EndReason;
}

/**
 * Authoritative state of one online game: validates moves with chess.js and
 * runs the clocks. Time is passed in explicitly so the class is testable.
 */
export class OnlineGame {
  readonly chess = new Chess();
  readonly moves: string[] = [];
  clocks: { white: number; black: number };
  running: Color | null = null;
  /** Timestamp at which the running clock last started. */
  private turnStartedAt = 0;
  result: GameResult | null = null;
  reason: EndReason | null = null;
  drawOfferBy: Color | null = null;
  rematchBy: Color | null = null;

  constructor(
    readonly id: string,
    readonly white: PublicPlayer,
    readonly black: PublicPlayer,
    readonly tc: TimeControl,
  ) {
    const ms = tc.initial * 1000;
    this.clocks = { white: ms, black: ms };
  }

  get timed() {
    return this.tc.initial > 0;
  }

  get over() {
    return this.result !== null;
  }

  get turn(): Color {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  colorOf(playerId: string): Color | null {
    if (this.white.id === playerId) return 'white';
    if (this.black.id === playerId) return 'black';
    return null;
  }

  /** Clocks as they stand at `now`, with the running side's elapsed time deducted. */
  clocksAt(now: number) {
    const clocks = { ...this.clocks };
    if (this.timed && this.running && !this.over) {
      clocks[this.running] = Math.max(0, clocks[this.running] - (now - this.turnStartedAt));
    }
    return clocks;
  }

  /** Ms until the side to move flags, or null if no clock is running. */
  msUntilFlag(now: number): number | null {
    if (!this.timed || !this.running || this.over) return null;
    return this.clocksAt(now)[this.running];
  }

  play(color: Color, uci: string, now: number): { ok: true; end: GameEnd | null } | { ok: false; error: string } {
    if (this.over) return { ok: false, error: 'Partie terminée' };
    if (color !== this.turn) return { ok: false, error: "Ce n'est pas votre tour" };

    if (this.timed && this.running) {
      const left = this.clocksAt(now)[color];
      if (left <= 0) {
        this.clocks[color] = 0;
        return { ok: true, end: this.finishOnTime(color) };
      }
      this.clocks[color] = left;
    }

    try {
      this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    } catch {
      return { ok: false, error: 'Coup illégal' };
    }
    this.moves.push(uci);
    this.drawOfferBy = null;

    // Increment is only granted once both sides have moved, like on most servers.
    if (this.timed && this.moves.length > 2) this.clocks[color] += this.tc.increment * 1000;

    // Clocks start after Black's first move so nobody loses on time before playing.
    this.running = this.moves.length >= 2 ? this.turn : null;
    this.turnStartedAt = now;

    return { ok: true, end: this.detectEnd() };
  }

  private detectEnd(): GameEnd | null {
    const c = this.chess;
    if (c.isCheckmate()) return this.finish(this.turn === 'white' ? '0-1' : '1-0', 'checkmate');
    if (c.isStalemate()) return this.finish('1/2-1/2', 'stalemate');
    if (c.isInsufficientMaterial()) return this.finish('1/2-1/2', 'insufficient');
    if (c.isThreefoldRepetition()) return this.finish('1/2-1/2', 'repetition');
    if (c.isDrawByFiftyMoves()) return this.finish('1/2-1/2', 'fifty-moves');
    return null;
  }

  /** The flagged side loses, unless the opponent cannot possibly mate. */
  finishOnTime(flagged: Color): GameEnd {
    const winner: Color = flagged === 'white' ? 'black' : 'white';
    const canMate = this.chess
      .board()
      .flat()
      .some((sq) => sq && sq.color === winner[0] && sq.type !== 'k');
    return this.finish(canMate ? (winner === 'white' ? '1-0' : '0-1') : '1/2-1/2', 'timeout');
  }

  resign(color: Color): GameEnd {
    return this.finish(color === 'white' ? '0-1' : '1-0', 'resign');
  }

  abandon(color: Color): GameEnd {
    return this.finish(color === 'white' ? '0-1' : '1-0', 'abandon');
  }

  agreeDraw(): GameEnd {
    return this.finish('1/2-1/2', 'agreement');
  }

  finish(result: GameResult, reason: EndReason): GameEnd {
    if (this.timed && this.running) this.clocks = this.clocksAt(Date.now());
    this.result = result;
    this.reason = reason;
    this.running = null;
    this.drawOfferBy = null;
    return { result, reason };
  }

  snapshot(now: number): GameSnapshot {
    return {
      id: this.id,
      white: this.white,
      black: this.black,
      tc: this.tc,
      moves: [...this.moves],
      clocks: this.clocksAt(now),
      serverTime: now,
      running: this.running,
      result: this.result,
      reason: this.reason,
      drawOfferBy: this.drawOfferBy,
    };
  }
}
