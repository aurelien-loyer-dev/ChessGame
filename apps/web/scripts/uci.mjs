// Minimal Node UCI driver for the Stockfish WASM build (used by offline scripts and tests).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export class Engine {
  constructor() {
    const path = require('stockfish').findEngine('lite-single');
    this.proc = spawn(process.execPath, [path], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buffer = '';
    this.waiters = [];
    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString();
      let idx;
      while ((idx = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        for (const w of [...this.waiters]) w(line);
      }
    });
  }

  send(cmd) {
    this.proc.stdin.write(cmd + '\n');
  }

  waitFor(pred, onLine) {
    return new Promise((resolve) => {
      const w = (line) => {
        onLine?.(line);
        if (pred(line)) {
          this.waiters = this.waiters.filter((x) => x !== w);
          resolve(line);
        }
      };
      this.waiters.push(w);
    });
  }

  async init() {
    this.send('uci');
    await this.waitFor((l) => l === 'uciok');
    this.send('setoption name Hash value 32');
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  async setMultiPV(n) {
    this.send(`setoption name MultiPV value ${n}`);
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  /** Returns lines sorted by multipv, scores from the side to move. */
  async analyse(fen, { depth = 14, multipv = 1, movetime } = {}) {
    if (this.multipv !== multipv) {
      await this.setMultiPV(multipv);
      this.multipv = multipv;
    }
    const lines = new Map();
    this.send(`position fen ${fen}`);
    this.send(movetime ? `go movetime ${movetime}` : `go depth ${depth}`);
    const best = await this.waitFor(
      (l) => l.startsWith('bestmove'),
      (l) => {
        if (!l.startsWith('info') || !l.includes(' pv ') || l.includes('bound')) return;
        const t = l.split(' ');
        const get = (k) => t[t.indexOf(k) + 1];
        const mpv = Number(get('multipv') ?? 1);
        const scoreIdx = t.indexOf('score');
        const kind = t[scoreIdx + 1];
        const val = Number(t[scoreIdx + 2]);
        lines.set(mpv, {
          depth: Number(get('depth')),
          cp: kind === 'cp' ? val : undefined,
          mate: kind === 'mate' ? val : undefined,
          pv: t.slice(t.indexOf('pv') + 1),
        });
      },
    );
    return { bestmove: best.split(' ')[1], lines: [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]) };
  }

  quit() {
    this.send('quit');
    setTimeout(() => this.proc.kill(), 200);
  }
}

export function score(line) {
  if (!line) return -100000;
  if (line.mate !== undefined) return line.mate > 0 ? 100000 - line.mate * 100 : -100000 - line.mate * 100;
  return line.cp;
}
