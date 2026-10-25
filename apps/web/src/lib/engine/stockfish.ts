/**
 * Thin promise-based wrapper around the Stockfish 19 WASM worker (UCI protocol).
 * Searches are serialized: starting a new one stops the previous search first.
 */

export interface EngineLine {
  multipv: number;
  depth: number;
  /** Centipawns from White's point of view (undefined when a mate is found). */
  cp?: number;
  /** Moves to mate from White's point of view (positive = White mates). */
  mate?: number;
  pv: string[];
}

export interface SearchResult {
  bestmove: string | null;
  lines: EngineLine[];
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  nodes?: number;
  multipv?: number;
  /** Extra UCI options applied before the search (e.g. Skill Level). */
  setoptions?: Record<string, string | number | boolean>;
  onInfo?: (lines: EngineLine[]) => void;
  signal?: AbortSignal;
}

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish.js`;

export class Stockfish {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private lineHandler: ((line: string) => void) | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private current: { stop: () => void } | null = null;
  private appliedOptions = new Map<string, string>();

  private boot(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(ENGINE_URL);
      } catch (err) {
        reject(err);
        return;
      }
      this.worker = worker;
      const timeout = setTimeout(() => reject(new Error('Stockfish: délai de chargement dépassé')), 30_000);
      worker.onerror = (e) => {
        clearTimeout(timeout);
        reject(new Error(e.message || 'Stockfish: erreur de chargement'));
      };
      worker.onmessage = (e: MessageEvent) => {
        const text = typeof e.data === 'string' ? e.data : '';
        for (const line of text.split('\n')) {
          if (!line) continue;
          if (line === 'uciok') worker.postMessage('isready');
          else if (line === 'readyok' && this.lineHandler === null) {
            clearTimeout(timeout);
            resolve();
          } else this.lineHandler?.(line);
        }
      };
      worker.postMessage('uci');
    });
    this.ready.catch(() => {
      this.ready = null;
      this.worker?.terminate();
      this.worker = null;
    });
    return this.ready;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  /** Waits for `readyok`, used after option changes / new game. */
  private sync(): Promise<void> {
    return new Promise((resolve) => {
      this.lineHandler = (line) => {
        if (line === 'readyok') {
          this.lineHandler = null;
          resolve();
        }
      };
      this.send('isready');
    });
  }

  async newGame() {
    await this.enqueue(async () => {
      this.send('ucinewgame');
      await this.sync();
    });
  }

  /** Interrupts the running search (its promise still resolves with what it found). */
  stop() {
    this.current?.stop();
  }

  search(fen: string, opts: SearchOptions = {}): Promise<SearchResult> {
    this.stop();
    return this.enqueue(() => this.run(fen, opts));
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      await this.boot();
      return job();
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  private async run(fen: string, opts: SearchOptions): Promise<SearchResult> {
    if (opts.signal?.aborted) return { bestmove: null, lines: [] };

    const options: Record<string, string | number | boolean> = {
      MultiPV: opts.multipv ?? 1,
      UCI_LimitStrength: false,
      'Skill Level': 20,
      ...opts.setoptions,
    };
    let changed = false;
    for (const [name, value] of Object.entries(options)) {
      const v = String(value);
      if (this.appliedOptions.get(name) === v) continue;
      this.appliedOptions.set(name, v);
      this.send(`setoption name ${name} value ${v}`);
      changed = true;
    }
    if (changed) await this.sync();

    const whiteToMove = fen.split(' ')[1] !== 'b';
    const lines = new Map<number, EngineLine>();

    return new Promise<SearchResult>((resolve) => {
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        this.send('stop');
      };
      this.current = { stop };
      opts.signal?.addEventListener('abort', stop, { once: true });

      let lastEmit = 0;
      this.lineHandler = (line) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const parsed = parseInfo(line, whiteToMove);
          if (!parsed) return;
          lines.set(parsed.multipv, parsed);
          const now = performance.now();
          if (opts.onInfo && now - lastEmit > 80) {
            lastEmit = now;
            opts.onInfo(sortLines(lines));
          }
        } else if (line.startsWith('bestmove')) {
          this.lineHandler = null;
          this.current = null;
          opts.signal?.removeEventListener('abort', stop);
          const move = line.split(' ')[1];
          const result = { bestmove: move && move !== '(none)' ? move : null, lines: sortLines(lines) };
          opts.onInfo?.(result.lines);
          resolve(result);
        }
      };

      this.send(`position fen ${fen}`);
      let go = 'go';
      if (opts.depth) go += ` depth ${opts.depth}`;
      if (opts.movetime) go += ` movetime ${opts.movetime}`;
      if (opts.nodes) go += ` nodes ${opts.nodes}`;
      if (!opts.depth && !opts.movetime && !opts.nodes) go += ' infinite';
      this.send(go);
    });
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.appliedOptions.clear();
  }
}

function sortLines(lines: Map<number, EngineLine>): EngineLine[] {
  return [...lines.values()].sort((a, b) => a.multipv - b.multipv);
}

export function parseInfo(line: string, whiteToMove: boolean): EngineLine | null {
  const tokens = line.split(' ');
  let depth = 0;
  let multipv = 1;
  let cp: number | undefined;
  let mate: number | undefined;
  let pv: string[] = [];
  let bound = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'depth') depth = Number(tokens[++i]);
    else if (t === 'multipv') multipv = Number(tokens[++i]);
    else if (t === 'score') {
      const kind = tokens[++i];
      const value = Number(tokens[++i]);
      if (kind === 'cp') cp = value;
      else if (kind === 'mate') mate = value;
      if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') bound = true;
    } else if (t === 'pv') {
      pv = tokens.slice(i + 1);
      break;
    }
  }
  if (bound || !pv.length || (cp === undefined && mate === undefined)) return null;
  const sign = whiteToMove ? 1 : -1;
  return {
    depth,
    multipv,
    cp: cp === undefined ? undefined : cp * sign,
    mate: mate === undefined ? undefined : mate * sign,
    pv,
  };
}

let playEngine: Stockfish | null = null;
let analysisEngine: Stockfish | null = null;

/** Engine used by bots. */
export function getPlayEngine() {
  return (playEngine ??= new Stockfish());
}

/** Separate engine for eval bar / analysis so it never blocks the bot. */
export function getAnalysisEngine() {
  return (analysisEngine ??= new Stockfish());
}
