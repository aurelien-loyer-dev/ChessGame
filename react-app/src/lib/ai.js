/**
 * ai.js — IA d'échecs hybride (ES module)
 *
 * Niveau 1 (Facile)    : Negamax depth 2 + QS, 30 % coups aléatoires
 * Niveau 2 (Moyen)     : Negamax depth 4 + QS, éval avancée (pions, roi, mobilité)
 * Niveau 3 (Difficile) : Stockfish WASM Skill 10, movetime 2 s
 * Niveau 4 (Expert)    : Stockfish WASM Skill 18, movetime 5 s
 * Niveau 5 (GM)        : Lichess Cloud Eval (depth ≥ 40) → serveur → WASM Skill 20
 */

import { ChessEngine } from './chess.js';

// ─── Config env ────────────────────────────────────────────────────────────
var AI_API_BASE_URL    = (import.meta.env.VITE_AI_API_BASE_URL  || '').trim().replace(/\/$/, '');
var AI_API_MOVE_PATH   = (import.meta.env.VITE_AI_API_MOVE_PATH || '/api/ai-move').trim();
var AI_API_KEY         = (import.meta.env.VITE_AI_API_KEY       || '').trim();
var AI_API_TIMEOUT_MS  = Number(import.meta.env.VITE_AI_API_TIMEOUT_MS || 15000);
var AI_FORCE_SERVER    = String(import.meta.env.VITE_AI_FORCE_SERVER   || '').toLowerCase() === 'true';

function toAbsoluteApiUrl(base, path) {
  if (!base) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return base + (path.startsWith('/') ? path : '/' + path);
}

var AI_MOVE_ENDPOINT    = toAbsoluteApiUrl(AI_API_BASE_URL, AI_API_MOVE_PATH);
var LICHESS_CLOUD_EVAL  = 'https://lichess.org/api/cloud-eval';

export const AI_DIFFICULTY = { EASY: 1, MEDIUM: 2, HARD: 3, EXPERT: 4, GRANDMASTER: 5 };

// ─── Piece values ───────────────────────────────────────────────────────────
var PV = { P: 100, N: 325, B: 350, R: 500, Q: 975, K: 20000 };

// ─── Piece-Square Tables (white POV, row 0 = rank 8) ────────────────────────
// Compact tables from Chessprogramming wiki / Stockfish tuning
var PST_P = [
  [  0,  0,  0,  0,  0,  0,  0,  0],
  [ 98,134, 61, 95, 68,126, 34,-11],
  [ -6,  7, 26, 31, 65, 56, 25,-20],
  [-14, 13,  6, 21, 23, 12, 17,-23],
  [-27,  2, -5, 12, 17,  6, 10,-25],
  [-26,  5, -1, -3,  3,  7, -1,-34],
  [-35,  1,-20,-23,-15, 24, 38,-22],
  [  0,  0,  0,  0,  0,  0,  0,  0],
];
var PST_N = [
  [-167,-89,-34,-49, 61,-97,-15,-107],
  [ -73,-41, 72, 36, 23, 62,  7, -17],
  [ -47, 60, 37, 65, 84,129, 73,  44],
  [  -9, 17, 19, 53, 37, 69, 18,  22],
  [ -13,  4, 16, 13, 28, 19, 21,  -8],
  [ -23, -9, 12, 10, 19, 17, 25, -16],
  [ -29,-53,-12, -3, -1, 18,-14, -19],
  [-105,-21,-58,-33,-17,-28,-19, -23],
];
var PST_B = [
  [-29,  4,-82,-37,-25,-42,  7, -8],
  [-26, 16,-18,-13, 30, 59, 18,-47],
  [-16, 37, 43, 40, 35, 50, 37, -2],
  [ -4,  5, 19, 50, 37, 37,  7, -2],
  [ -6, 13, 13, 26, 34, 12, 10,  4],
  [  0, 15, 15, 15, 14, 27, 18, 10],
  [  4, 15, 16,  0,  7, 21, 33,  1],
  [-33, -3,-14,-21,-13,-12,-39,-21],
];
var PST_R = [
  [ 32, 42, 32, 51, 63,  9, 31, 43],
  [ 27, 32, 58, 62, 80, 67, 26, 44],
  [ -5, 19, 26, 36, 17, 45, 61, 16],
  [-24,-11,  7, 26, 24, 35, -8,-20],
  [-36,-26,-12, -1,  9, -7,  6,-23],
  [-45,-25,-16,-17,  3,  0, 29,-44],
  [-44,-16,-20,  5,  2, 12,-12,-28],
  [ -1, -9,  0,  0, -6, -7, -2,-22],
];
var PST_Q = [
  [-28,  0, 29, 12, 59, 44, 43, 45],
  [-24,-39,  2,  4, 14, 25, 35, 14],
  [-13,-17,  7,  8, 29, 56, 47, 57],
  [-27,-27,-16,-16, -1, 17, 17, -2],
  [ -9,-26, -9,-10, -2, -4,  3, -3],
  [-14,  2,-11,  2,  7,  6, 17,  4],
  [-21,  4,  6, 17,  1,  0,  2, -5],
  [-50, -7,-10, -3,  2,-10,-17,-31],
];
var PST_KMG = [
  [-65, 23, 16,-15,-56,-34,  2, 13],
  [ 29,  1,-20, -7, -8, -4,-38,-29],
  [ -9, 24,  2,-16,-20,  6, 22,-22],
  [-17,-20,-12,-27,-30,-25,-14,-36],
  [-49, -1,-27,-39,-46,-44,-33,-51],
  [-14,-14,-22,-46,-44,-30,-15,-27],
  [  1,  7, -8,-64,-43,-16,  9,  8],
  [-15, 36, 12,-54,  8,-28, 24, 14],
];
var PST_KEG = [
  [-74,-35,-18,-18,-11, 15,  4,-17],
  [-12, 17, 14, 17, 17, 38, 23, 11],
  [ 10, 17, 23, 15, 20, 45, 44, 13],
  [ -8, 22, 24, 27, 26, 33, 26,  3],
  [-18, -4, 21, 24, 27, 23,  9,-11],
  [-19, -3, 11, 21, 23, 16,  7, -9],
  [-27,-11,  4, 13, 14,  4, -5,-17],
  [-53,-34,-21,-11,-28,-14,-24,-43],
];

var PST = { P: PST_P, N: PST_N, B: PST_B, R: PST_R, Q: PST_Q, K: PST_KMG };

// ─── Stockfish WASM Bridge ──────────────────────────────────────────────────
var StockfishBridge = (function () {
  function SB() {
    this.worker = null;
    this.ready = false;
    this.readyPromise = null;
    this._readyResolve = null;
    this._searchResolve = null;
  }

  SB.prototype.init = function () {
    if (this.readyPromise) return this.readyPromise;
    var self = this;
    this.readyPromise = new Promise(function (resolve, reject) {
      self._readyResolve = resolve;
      try { self.worker = new Worker('/stockfish-worker.js'); }
      catch (e) { self._createInlineWorker(); }
      if (!self.worker) { reject(new Error('No worker')); return; }
      self.worker.onmessage = function (e) { self._onMessage(e.data); };
      self.worker.onerror   = function (e) { reject(e); };
      setTimeout(function () { if (!self.ready) reject(new Error('Stockfish init timeout')); }, 25000);
      self.worker.postMessage({ type: 'init' });
    });
    return this.readyPromise;
  };

  SB.prototype._createInlineWorker = function () {
    // Inline fallback with CDN waterfall
    var src = [
      "var sf=null;",
      "function send(cmd){if(sf&&sf.postMessage)sf.postMessage(cmd);}",
      "function onMsg(l){if(typeof l!=='string')return;",
      "if(l==='uciok'){send('setoption name Threads value 1');send('setoption name Hash value 64');send('isready');}",
      "if(l==='readyok')postMessage({type:'ready'});",
      "if(l.startsWith('bestmove '))postMessage({type:'bestmove',move:l.split(' ')[1]});}",
      "var CDNS=['https://cdn.jsdelivr.net/npm/stockfish.wasm@0.9.0/src/stockfish.js',",
      "'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js'];",
      "function tryLoad(i){try{importScripts(CDNS[i]);",
      "sf=typeof STOCKFISH==='function'?STOCKFISH():null;",
      "if(sf){if(sf.addMessageListener)sf.addMessageListener(onMsg);else sf.print=onMsg;send('uci');}",
      "}catch(e){if(i+1<CDNS.length)tryLoad(i+1);}}",
      "self.onmessage=function(e){var m=e.data;",
      "if(m.type==='init')tryLoad(0);",
      "else if(m.type==='search'){",
      "if(m.options.skillLevel!=null)send('setoption name Skill Level value '+m.options.skillLevel);",
      "send('position fen '+m.fen);var g='go';",
      "if(m.options.depth)g+=' depth '+m.options.depth;",
      "if(m.options.movetime)g+=' movetime '+m.options.movetime;",
      "send(g);}",
      "else if(m.type==='stop')send('stop');",
      "else if(m.type==='quit'){if(sf&&sf.terminate)sf.terminate();}};",
    ].join('\n');
    var blob = new Blob([src], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
  };

  SB.prototype._onMessage = function (msg) {
    if (msg.type === 'ready') {
      this.ready = true;
      if (this._readyResolve) { this._readyResolve(); this._readyResolve = null; }
    }
    if (msg.type === 'bestmove' && this._searchResolve) {
      var r = this._searchResolve; this._searchResolve = null; r(msg);
    }
  };

  SB.prototype.search = function (fen, options) {
    var self = this;
    return (this.ready ? Promise.resolve() : this.init()).then(function () {
      return new Promise(function (resolve, reject) {
        var budget = (options.movetime || 5000) + 8000;
        var timer = setTimeout(function () {
          if (self._searchResolve) { self._searchResolve = null; reject(new Error('WASM timeout')); }
        }, budget);
        self._searchResolve = function (r) { clearTimeout(timer); resolve(r); };
        self.worker.postMessage({ type: 'search', fen: fen, options: options });
      });
    });
  };

  SB.prototype.stop    = function () { if (this.worker) this.worker.postMessage({ type: 'stop' }); };
  SB.prototype.destroy = function () {
    if (this.worker) { this.worker.postMessage({ type: 'quit' }); this.worker.terminate(); this.worker = null; }
    this.ready = false; this.readyPromise = null;
  };

  return SB;
})();

export var stockfishBridge = new StockfishBridge();

// ─── ChessAI ────────────────────────────────────────────────────────────────
export var ChessAI = (function () {

  function AI(difficulty) {
    this.difficulty       = difficulty || AI_DIFFICULTY.MEDIUM;
    this.nodesSearched    = 0;
    this.timeStart        = 0;
    this.timeBudget       = 0;
    this.aborted          = false;
    this.serverAvailable  = true;
    this.serverRetryAt    = 0;
    this.lichessRetryAt   = 0;
  }

  AI.prototype.setDifficulty = function (level) { this.difficulty = level; };

  // ── Public entry point ────────────────────────────────────────────────────

  AI.prototype.findBestMove = function (engine, aiColor) {
    var allMoves = engine.getAllLegalMoves();
    if (!allMoves.length) return Promise.resolve(null);
    if (allMoves.length === 1) {
      var m = allMoves[0];
      return Promise.resolve({ from: m.from, to: m.to, promotion: m.promotion ? 'Q' : undefined });
    }

    if (AI_FORCE_SERVER || this.difficulty >= AI_DIFFICULTY.HARD) {
      return this._findWithEngine(engine, allMoves);
    }
    return Promise.resolve(this._findWithMinimax(engine, aiColor, allMoves));
  };

  // ── Iterative-deepening fallback (used when Stockfish WASM is unavailable) ─

  AI.prototype._findWithFallbackMinimax = function (engine, allMoves) {
    var budgets = {};
    budgets[AI_DIFFICULTY.HARD]        = 500;
    budgets[AI_DIFFICULTY.EXPERT]      = 700;
    budgets[AI_DIFFICULTY.GRANDMASTER] = 900;
    var budget = budgets[this.difficulty] || 3500;

    this.nodesSearched = 0;
    this.timeStart     = Date.now();
    this.timeBudget    = budget;
    this.aborted       = false;

    var bestMove = this._randomMove(allMoves); // always have a move
    var ordered  = this._orderMoves(allMoves, engine);

    for (var depth = 1; depth <= 30; depth++) {
      if (Date.now() - this.timeStart > budget * 0.85) break;

      var depthBest      = null;
      var depthBestScore = -Infinity;
      this.aborted       = false;

      for (var i = 0; i < ordered.length; i++) {
        var mv    = ordered[i];
        var promo = mv.promotion ? 'Q' : undefined;
        var copy  = this._clone(engine);
        if (!copy.makeMove(mv.from, mv.to, promo)) continue;

        var score = -this._negamax(copy, depth - 1, -Infinity, -depthBestScore);
        if (this.aborted) break;

        if (score > depthBestScore || !depthBest) {
          depthBestScore = score;
          depthBest      = { from: mv.from, to: mv.to, promotion: promo };
        }
      }

      if (!this.aborted && depthBest) {
        bestMove = depthBest;
        // Move best to front for next iteration (simple history heuristic)
        var front = null;
        var rest  = [];
        for (var j = 0; j < ordered.length; j++) {
          var om = ordered[j];
          if (om.from.row === depthBest.from.row && om.from.col === depthBest.from.col &&
              om.to.row   === depthBest.to.row   && om.to.col   === depthBest.to.col) {
            front = om;
          } else {
            rest.push(om);
          }
        }
        if (front) { rest.unshift(front); ordered = rest; }
      }
      if (this.aborted) break;
    }

    return bestMove;
  };

  AI.prototype._findQuickSafeMove = function (engine, allMoves) {
    var best = null;
    var bestScore = -Infinity;

    for (var i = 0; i < allMoves.length; i++) {
      var m = allMoves[i];
      var score = 0;
      var attacker = engine.board[m.from.row][m.from.col];
      var target = engine.board[m.to.row][m.to.col];

      // Prefer winning captures and promotions when we need an emergency move.
      if (target) {
        var gain = (PV[target.type] || 0) - (attacker ? (PV[attacker.type] || 0) : 0) * 0.2;
        score += 200 + gain;
      }
      if (m.isEnPassant) score += 160;
      if (m.promotion) score += 300;

      // Small center preference to avoid obviously passive emergency moves.
      var dc = Math.abs(3.5 - m.to.col);
      var dr = Math.abs(3.5 - m.to.row);
      score += 14 - (dc + dr) * 2;

      if (score > bestScore) {
        bestScore = score;
        best = { from: m.from, to: m.to, promotion: m.promotion ? 'Q' : undefined };
      }
    }

    return best || this._randomMove(allMoves);
  };

  // ── Engine pipeline: Lichess → Server → WASM → fallback minimax ──────────

  AI.prototype._findWithEngine = function (engine, allMoves) {
    var self = this;
    var fen  = engine.toFEN();

    if (this.difficulty === AI_DIFFICULTY.GRANDMASTER && Date.now() >= this.lichessRetryAt) {
      return this._callLichess(fen)
        .then(function (uci) {
          if (uci) { var p = self._uciToMove(uci); if (p && self._legal(p, allMoves)) return p; }
          return self._serverThenWasm(fen, allMoves, engine);
        })
        .catch(function () { return self._serverThenWasm(fen, allMoves, engine); });
    }

    return this._serverThenWasm(fen, allMoves, engine);
  };

  AI.prototype._serverThenWasm = function (fen, allMoves, engine) {
    var self = this;
    if (this.serverAvailable || Date.now() >= this.serverRetryAt) {
      return this._callServer(fen)
        .then(function (data) {
          self.serverAvailable = true; self.serverRetryAt = 0;
          var uci = self._extractUCI(data);
          if (uci) { var p = self._uciToMove(uci); if (p && self._legal(p, allMoves)) return p; }
          return self._findWithWASM(fen, allMoves, engine);
        })
        .catch(function () {
          self.serverAvailable = false;
          self.serverRetryAt   = Date.now() + 20000;
          return self._findWithWASM(fen, allMoves, engine);
        });
    }
    return this._findWithWASM(fen, allMoves, engine);
  };

  // ── Lichess Cloud Eval (free, no key, depth 40+) ─────────────────────────

  AI.prototype._callLichess = function (fen) {
    var self = this;
    var url  = LICHESS_CLOUD_EVAL + '?fen=' + encodeURIComponent(fen) + '&multiPv=1';
    var ctrl = new AbortController();
    var t    = setTimeout(function () { ctrl.abort(); }, 5000);

    return fetch(url, { signal: ctrl.signal })
      .then(function (res) {
        clearTimeout(t);
        if (res.status === 404) return null; // position not in cloud cache
        if (!res.ok) throw new Error('lichess ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.pvs || !data.pvs.length) return null;
        var moves = data.pvs[0].moves;
        return moves ? moves.split(' ')[0] : null;
      })
      .catch(function (err) {
        clearTimeout(t);
        if (err && err.name === 'AbortError') self.lichessRetryAt = Date.now() + 30000;
        return null;
      });
  };

  // ── Local server ──────────────────────────────────────────────────────────

  AI.prototype._serverParams = function () {
    switch (this.difficulty) {
      case AI_DIFFICULTY.HARD:        return { depth: 18, movetime: 3000 };
      case AI_DIFFICULTY.EXPERT:      return { depth: 22, movetime: 6000 };
      case AI_DIFFICULTY.GRANDMASTER: return { depth: 26, movetime: 12000 };
      default:                        return { depth: 14, movetime: 2000 };
    }
  };

  AI.prototype._callServer = function (fen) {
    var headers = { 'Content-Type': 'application/json' };
    if (AI_API_KEY) headers['x-api-key'] = AI_API_KEY;
    var ctrl = new AbortController();
    var t    = setTimeout(function () { ctrl.abort(); }, AI_API_TIMEOUT_MS);
    return fetch(AI_MOVE_ENDPOINT, {
      method: 'POST', headers: headers, signal: ctrl.signal,
      body: JSON.stringify({ fen: fen, difficulty: this.difficulty, search: this._serverParams() }),
    }).then(function (res) {
      clearTimeout(t);
      if (!res.ok) throw new Error('server ' + res.status);
      return res.json();
    }).catch(function (err) { clearTimeout(t); throw err; });
  };

  // ── WASM Stockfish ────────────────────────────────────────────────────────

  AI.prototype._wasmOptions = function () {
    switch (this.difficulty) {
      case AI_DIFFICULTY.HARD:        return { skillLevel: 10, movetime: 2000 };
      case AI_DIFFICULTY.EXPERT:      return { skillLevel: 18, movetime: 5000 };
      case AI_DIFFICULTY.GRANDMASTER: return { skillLevel: 20, movetime: 12000 };
      default:                        return { skillLevel: 10, movetime: 2000 };
    }
  };

  AI.prototype._findWithWASM = function (fen, allMoves, engine) {
    var self = this;
    return stockfishBridge.search(fen, this._wasmOptions())
      .then(function (res) {
        if (res && res.move) {
          var p = self._uciToMove(res.move);
          if (p && self._legal(p, allMoves)) return p;
        }
        // Stockfish gave no valid move — use instant safe fallback to avoid UI freeze
        return self._findQuickSafeMove(engine, allMoves);
      })
      .catch(function () {
        // Stockfish failed entirely (timeout/load error) — keep the app responsive
        return self._findQuickSafeMove(engine, allMoves);
      });
  };

  // ── Negamax with alpha-beta + quiescence (levels 1-2) ────────────────────

  AI.prototype._findWithMinimax = function (engine, aiColor, allMoves) {
    this.nodesSearched = 0;
    this.timeStart     = Date.now();
    this.timeBudget    = this.difficulty === 1 ? 400 : 2500;
    this.aborted       = false;

    var maxDepth = this.difficulty === 1 ? 2 : 4;

    var bestMove  = null;
    var bestScore = -Infinity;
    var ordered   = this._orderMoves(allMoves, engine);

    for (var i = 0; i < ordered.length; i++) {
      if (this.aborted) break;
      var mv    = ordered[i];
      var promo = mv.promotion ? 'Q' : undefined;
      var copy  = this._clone(engine);
      if (!copy.makeMove(mv.from, mv.to, promo)) continue;

      var score = -this._negamax(copy, maxDepth - 1, -Infinity, -bestScore);
      if (score > bestScore || !bestMove) {
        bestScore = score;
        bestMove  = { from: mv.from, to: mv.to, promotion: promo };
      }
    }

    // Easy: 30 % chance of a legal random move (makes it beatable)
    if (this.difficulty === 1 && Math.random() < 0.30) {
      var cands = allMoves.filter(function (m) {
        var p = engine.board[m.from.row][m.from.col];
        return p && p.type !== 'K';
      });
      if (cands.length) {
        var rm = cands[Math.floor(Math.random() * cands.length)];
        return { from: rm.from, to: rm.to, promotion: rm.promotion ? 'Q' : undefined };
      }
    }

    return bestMove || this._randomMove(allMoves);
  };

  AI.prototype._negamax = function (engine, depth, alpha, beta) {
    this.nodesSearched++;
    if ((this.nodesSearched & 1023) === 0 && Date.now() - this.timeStart > this.timeBudget) {
      this.aborted = true;
      return this._eval(engine);
    }
    if (this.aborted) return this._eval(engine);

    var moves = engine.getAllLegalMoves();
    if (!moves.length) return engine.isInCheck(engine.turn) ? -90000 + depth : 0;
    if (depth <= 0)    return this._quiesce(engine, alpha, beta, 0);

    var ordered = this._orderMoves(moves, engine);
    var best    = -Infinity;

    for (var i = 0; i < ordered.length; i++) {
      var mv   = ordered[i];
      var copy = this._clone(engine);
      copy.makeMove(mv.from, mv.to, mv.promotion ? 'Q' : undefined);

      var score = -this._negamax(copy, depth - 1, -beta, -alpha);
      if (this.aborted) return best;
      if (score > best)  best  = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  };

  AI.prototype._quiesce = function (engine, alpha, beta, qdepth) {
    this.nodesSearched++;
    if (qdepth > 7) return this._eval(engine);

    var standPat = this._eval(engine);
    if (standPat >= beta)  return beta;
    if (standPat < alpha - 975) return alpha; // delta pruning (skip if a queen can't save)
    if (standPat > alpha)  alpha = standPat;

    var all = engine.getAllLegalMoves();
    // Only captures, en-passant, and promotions
    var caps = [];
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (engine.board[m.to.row][m.to.col] || m.isEnPassant || m.promotion) caps.push(m);
    }
    // MVV-LVA sort
    caps.sort(function (a, b) {
      var av = engine.board[a.to.row][a.to.col] ? PV[engine.board[a.to.row][a.to.col].type] : (a.isEnPassant ? 100 : 975);
      var bv = engine.board[b.to.row][b.to.col] ? PV[engine.board[b.to.row][b.to.col].type] : (b.isEnPassant ? 100 : 975);
      var aa = engine.board[a.from.row][a.from.col] ? PV[engine.board[a.from.row][a.from.col].type] : 0;
      var ba = engine.board[b.from.row][b.from.col] ? PV[engine.board[b.from.row][b.from.col].type] : 0;
      return (bv - ba) - (av - aa);
    });

    for (var j = 0; j < caps.length; j++) {
      var cm   = caps[j];
      var copy = this._clone(engine);
      copy.makeMove(cm.from, cm.to, cm.promotion ? 'Q' : undefined);
      var score = -this._quiesce(copy, -beta, -alpha, qdepth + 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
      if (this.aborted)  return alpha;
    }
    return alpha;
  };

  // ── Evaluation (score from engine.turn's perspective) ─────────────────────

  AI.prototype._eval = function (engine) {
    var board = engine.board;
    var score = 0;
    var wP = [0,0,0,0,0,0,0,0], bP = [0,0,0,0,0,0,0,0]; // pawns per file
    var wB = 0, bB = 0;   // bishop count
    var totalMat = 0;

    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (!p) continue;
        var val  = PV[p.type] || 0;
        totalMat += val;
        var pr   = p.color === 'white' ? r : 7 - r;
        var pst  = PST[p.type];
        var bonus = pst ? pst[pr][c] : 0;
        if (p.color === 'white') {
          score += val + bonus;
          if (p.type === 'P') wP[c]++;
          if (p.type === 'B') wB++;
        } else {
          score -= val + bonus;
          if (p.type === 'P') bP[c]++;
          if (p.type === 'B') bB++;
        }
      }
    }

    // Endgame king centralization (when total material low)
    if (totalMat < 2600) {
      var egW = totalMat < 1300 ? 1.0 : (2600 - totalMat) / 1300;
      for (var r2 = 0; r2 < 8; r2++) {
        for (var c2 = 0; c2 < 8; c2++) {
          var pk = board[r2][c2];
          if (!pk || pk.type !== 'K') continue;
          var prk = pk.color === 'white' ? r2 : 7 - r2;
          var egDiff = PST_KEG[prk][c2] - PST_KMG[prk][c2];
          if (pk.color === 'white') score += egDiff * egW;
          else                      score -= egDiff * egW;
        }
      }
    }

    // Bishop pair
    if (wB >= 2) score += 30;
    if (bB >= 2) score -= 30;

    // Pawn structure
    for (var f = 0; f < 8; f++) {
      // Doubled pawns
      if (wP[f] > 1) score -= 15 * (wP[f] - 1);
      if (bP[f] > 1) score += 15 * (bP[f] - 1);
      // Isolated pawns
      var wIso = wP[f] > 0 && (f === 0 || wP[f-1] === 0) && (f === 7 || wP[f+1] === 0);
      var bIso = bP[f] > 0 && (f === 0 || bP[f-1] === 0) && (f === 7 || bP[f+1] === 0);
      if (wIso) score -= 15;
      if (bIso) score += 15;
    }

    // Passed pawns
    for (var f3 = 0; f3 < 8; f3++) {
      for (var r3 = 0; r3 < 8; r3++) {
        var pp = board[r3][f3];
        if (!pp || pp.type !== 'P') continue;
        if (pp.color === 'white') {
          var passed = true;
          outer: for (var pr4 = r3 - 1; pr4 >= 0; pr4--) {
            for (var pf4 = Math.max(0, f3-1); pf4 <= Math.min(7, f3+1); pf4++) {
              var opp = board[pr4][pf4];
              if (opp && opp.type === 'P' && opp.color === 'black') { passed = false; break outer; }
            }
          }
          if (passed) score += 10 + (7 - r3) * 10;
        } else {
          var bpassed = true;
          bouter: for (var bpr = r3 + 1; bpr <= 7; bpr++) {
            for (var bpf = Math.max(0, f3-1); bpf <= Math.min(7, f3+1); bpf++) {
              var bopp = board[bpr][bpf];
              if (bopp && bopp.type === 'P' && bopp.color === 'white') { bpassed = false; break bouter; }
            }
          }
          if (bpassed) score -= 10 + r3 * 10;
        }
      }
    }

    // Return from engine.turn's perspective
    return engine.turn === 'white' ? score : -score;
  };

  // ── Move ordering ─────────────────────────────────────────────────────────

  AI.prototype._orderMoves = function (moves, engine) {
    var board = engine.board;
    return moves.slice().sort(function (a, b) {
      return moveScore(b, board) - moveScore(a, board);
    });
  };

  function moveScore(m, board) {
    var s = 0;
    var victim   = board[m.to.row][m.to.col];
    var attacker = board[m.from.row][m.from.col];
    if (victim) s += 10 * (PV[victim.type] || 0) - (PV[attacker ? attacker.type : 'P'] || 0);
    if (m.promotion)  s += 8000;
    if (m.isEnPassant) s += 100;
    // Small bonus for moving toward the center
    var dr = m.to.row - 3.5, dc = m.to.col - 3.5;
    s += Math.max(0, 2 - Math.abs(dr)) + Math.max(0, 2 - Math.abs(dc));
    return s;
  }

  // ── Clone engine state ────────────────────────────────────────────────────

  AI.prototype._clone = function (engine) {
    var c = Object.create(ChessEngine.prototype);
    c.board = engine.board.map(function (row) {
      return row.map(function (p) { return p ? { type: p.type, color: p.color } : null; });
    });
    c.turn  = engine.turn;
    c.castlingRights = {
      white: { kingSide: engine.castlingRights.white.kingSide, queenSide: engine.castlingRights.white.queenSide },
      black: { kingSide: engine.castlingRights.black.kingSide, queenSide: engine.castlingRights.black.queenSide },
    };
    c.enPassantTarget = engine.enPassantTarget
      ? { row: engine.enPassantTarget.row, col: engine.enPassantTarget.col } : null;
    c.halfMoveClock  = engine.halfMoveClock;
    c.fullMoveNumber = engine.fullMoveNumber;
    c.moveHistory    = [];
    c.lastMove       = engine.lastMove ? { from: engine.lastMove.from, to: engine.lastMove.to } : null;
    c.gameOver = false; c.result = null; c.winner = null;
    return c;
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  AI.prototype._uciToMove = function (uci) {
    if (!uci || uci === '(none)' || uci.length < 4) return null;
    var f = 'abcdefgh';
    return {
      from:      { row: 8 - parseInt(uci[1]), col: f.indexOf(uci[0]) },
      to:        { row: 8 - parseInt(uci[3]), col: f.indexOf(uci[2]) },
      promotion: uci.length > 4 ? uci[4].toUpperCase() : undefined,
    };
  };

  AI.prototype._legal = function (parsed, allMoves) {
    return allMoves.some(function (m) {
      return m.from.row === parsed.from.row && m.from.col === parsed.from.col
          && m.to.row   === parsed.to.row   && m.to.col   === parsed.to.col;
    });
  };

  AI.prototype._extractUCI = function (data) {
    if (!data) return null;
    return data.move || data.bestmove || data.uci || null;
  };

  AI.prototype._randomMove = function (allMoves) {
    var m = allMoves[Math.floor(Math.random() * allMoves.length)];
    return { from: m.from, to: m.to, promotion: m.promotion ? 'Q' : undefined };
  };

  return AI;
})();
