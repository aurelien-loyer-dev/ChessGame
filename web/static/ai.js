/**
 * ai.js — IA d'echecs hybride (Server Stockfish + WASM fallback)
 *
 * Architecture :
 *   Niveaux 1-2 : Minimax local (instantane)
 *   Niveaux 3-5 : Stockfish natif cote serveur via /api/ai-move
 *                 Fallback : Stockfish WASM dans un Web Worker
 *
 * Le serveur execute Stockfish en natif (pas WASM) = pleine puissance.
 */

var AI_DIFFICULTY = {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3,
    EXPERT: 4,
    GRANDMASTER: 5
};

// ---- PST tables (minimax local niveaux 1-2) ----
var PAWN_TABLE = [
    [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
    [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
    [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
];
var KNIGHT_TABLE = [
    [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
    [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
    [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
    [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
];
var BISHOP_TABLE = [
    [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
    [-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
    [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],
    [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
];
var ROOK_TABLE = [
    [0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]
];
var QUEEN_TABLE = [
    [-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
    [-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],
    [0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],
    [-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]
];
var KING_MG_TABLE = [
    [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],
    [20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]
];
var PST = {P:PAWN_TABLE,N:KNIGHT_TABLE,B:BISHOP_TABLE,R:ROOK_TABLE,Q:QUEEN_TABLE,K:KING_MG_TABLE};
var PIECE_VALUES = {P:100,N:320,B:330,R:500,Q:900,K:20000};


// ==========================================================================
// StockfishBridge — Stockfish WASM Web Worker (fallback si serveur KO)
// ==========================================================================
var StockfishBridge = (function() {
    function SB() {
        this.worker = null;
        this.ready = false;
        this.readyPromise = null;
        this._readyResolve = null;
        this._searchResolve = null;
    }

    SB.prototype.init = function() {
        if (this.readyPromise) return this.readyPromise;
        var self = this;
        this.readyPromise = new Promise(function(resolve, reject) {
            self._readyResolve = resolve;
            try {
                self.worker = new Worker('stockfish-worker.js');
            } catch(e) {
                self._createInlineWorker();
            }
            if (!self.worker) { reject(new Error('No worker')); return; }
            self.worker.onmessage = function(e) { self._onMessage(e.data); };
            self.worker.onerror = function(e) { reject(e); };
            setTimeout(function() {
                if (!self.ready) reject(new Error('Stockfish WASM timeout'));
            }, 15000);
            self.worker.postMessage({type:'init'});
        });
        return this.readyPromise;
    };

    SB.prototype._createInlineWorker = function() {
        var c = [];
        c.push("var sf=null;");
        c.push("function send(cmd){if(sf&&sf.postMessage)sf.postMessage(cmd);}");
        c.push("function onMsg(l){if(typeof l!=='string')return;");
        c.push("if(l==='uciok'){send('setoption name Threads value 1');send('setoption name Hash value 32');send('isready');}");
        c.push("if(l==='readyok')postMessage({type:'ready'});");
        c.push("if(l.startsWith('bestmove '))postMessage({type:'bestmove',move:l.split(' ')[1],info:{}});}");
        c.push("self.onmessage=function(e){var m=e.data;");
        c.push("if(m.type==='init'){importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');");
        c.push("sf=typeof STOCKFISH==='function'?STOCKFISH():null;");
        c.push("if(sf){if(sf.addMessageListener)sf.addMessageListener(onMsg);else sf.print=onMsg;}send('uci');}");
        c.push("else if(m.type==='search'){");
        c.push("if(m.options.skillLevel!==undefined)send('setoption name Skill Level value '+m.options.skillLevel);");
        c.push("send('position fen '+m.fen);var go='go';");
        c.push("if(m.options.depth)go+=' depth '+m.options.depth;");
        c.push("if(m.options.movetime)go+=' movetime '+m.options.movetime;send(go);}");
        c.push("else if(m.type==='stop')send('stop');");
        c.push("else if(m.type==='quit'){if(sf&&sf.terminate)sf.terminate();}};");
        var blob = new Blob([c.join("\n")], {type:'application/javascript'});
        this.worker = new Worker(URL.createObjectURL(blob));
    };

    SB.prototype._onMessage = function(msg) {
        if (msg.type === 'ready') {
            this.ready = true;
            if (this._readyResolve) { this._readyResolve(); this._readyResolve = null; }
        }
        if (msg.type === 'bestmove' && this._searchResolve) {
            this._searchResolve(msg);
            this._searchResolve = null;
        }
    };

    SB.prototype.search = function(fen, options) {
        var self = this;
        var p = this.ready ? Promise.resolve() : this.init();
        return p.then(function() {
            return new Promise(function(resolve) {
                self._searchResolve = resolve;
                self.worker.postMessage({type:'search', fen:fen, options:options||{}});
            });
        });
    };

    SB.prototype.stop = function() {
        if (this.worker) this.worker.postMessage({type:'stop'});
    };

    SB.prototype.destroy = function() {
        if (this.worker) { this.worker.postMessage({type:'quit'}); this.worker.terminate(); this.worker = null; }
        this.ready = false; this.readyPromise = null;
    };

    return SB;
})();

var stockfishBridge = new StockfishBridge();


// ==========================================================================
// ChessAI — Interface unifiee
//   Niveaux 1-2 : minimax local
//   Niveaux 3-5 : API serveur /api/ai-move (Stockfish natif)
//                 Fallback : WASM si serveur indisponible
// ==========================================================================

var ChessAI = (function() {

    function AI(difficulty) {
        this.difficulty = difficulty || AI_DIFFICULTY.MEDIUM;
        this.nodesSearched = 0;
        this.timeStart = 0;
        this.timeBudget = 0;
        this.aborted = false;
        this.serverAvailable = true;  // On suppose le serveur dispo
        this.serverChecked = false;
    }

    AI.prototype.setDifficulty = function(level) {
        this.difficulty = level;
    };

    // ----- Server API -----

    AI.prototype._callServer = function(fen, difficulty) {
        return fetch('/api/ai-move', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({fen: fen, difficulty: difficulty})
        }).then(function(res) {
            if (!res.ok) throw new Error('Server error ' + res.status);
            return res.json();
        });
    };

    // ----- UCI move parsing -----

    AI.prototype._uciToMove = function(uciMove) {
        if (!uciMove || uciMove.length < 4) return null;
        var files = 'abcdefgh';
        return {
            from: { row: 8 - parseInt(uciMove[1]), col: files.indexOf(uciMove[0]) },
            to:   { row: 8 - parseInt(uciMove[3]), col: files.indexOf(uciMove[2]) },
            promotion: uciMove.length > 4 ? uciMove[4].toUpperCase() : undefined
        };
    };

    // ----- Main entry point -----

    AI.prototype.findBestMove = function(engine, aiColor) {
        var allMoves = engine.getAllLegalMoves();
        if (allMoves.length === 0) return Promise.resolve(null);
        if (allMoves.length === 1) {
            var m = allMoves[0];
            return Promise.resolve({from:m.from, to:m.to, promotion:m.promotion?'Q':undefined});
        }

        // Niveaux 3-5 : Stockfish (serveur ou WASM)
        if (this.difficulty >= AI_DIFFICULTY.HARD) {
            return this._findWithStockfish(engine, allMoves);
        }

        // Niveaux 1-2 : minimax local
        return Promise.resolve(this._findWithMinimax(engine, aiColor, allMoves));
    };

    // ----- Stockfish (server-first, WASM fallback) -----

    AI.prototype._findWithStockfish = function(engine, allMoves) {
        var self = this;
        var fen = engine.toFEN();

        // Try server first
        if (this.serverAvailable) {
            return this._callServer(fen, this.difficulty)
                .then(function(data) {
                    self.serverAvailable = true;
                    if (data && data.move) {
                        var parsed = self._uciToMove(data.move);
                        if (parsed) {
                            var legal = allMoves.find(function(m) {
                                return m.from.row === parsed.from.row && m.from.col === parsed.from.col &&
                                       m.to.row === parsed.to.row && m.to.col === parsed.to.col;
                            });
                            if (legal) {
                                console.log('[AI] Server Stockfish: ' + data.move +
                                    (data.depth ? ' (depth ' + data.depth + ')' : '') +
                                    (data.eval !== undefined ? ' eval=' + data.eval : '') +
                                    (data.mate !== undefined ? ' mate=' + data.mate : ''));
                                return parsed;
                            }
                        }
                    }
                    // Move not legal or no move, try WASM
                    return self._findWithWASM(fen, allMoves);
                })
                .catch(function(err) {
                    console.warn('[AI] Server unavailable, switching to WASM:', err.message);
                    self.serverAvailable = false;
                    return self._findWithWASM(fen, allMoves);
                });
        }

        // Server known unavailable, go straight to WASM
        return this._findWithWASM(fen, allMoves);
    };

    // ----- WASM Fallback -----

    AI.prototype._getWasmOptions = function() {
        switch (this.difficulty) {
            case AI_DIFFICULTY.HARD:
                return { skillLevel: 10, depth: 12, movetime: 2000 };
            case AI_DIFFICULTY.EXPERT:
                return { skillLevel: 18, depth: 16, movetime: 5000 };
            case AI_DIFFICULTY.GRANDMASTER:
                return { skillLevel: 20, depth: 20, movetime: 10000 };
            default:
                return { skillLevel: 10, depth: 12, movetime: 2000 };
        }
    };

    AI.prototype._findWithWASM = function(fen, allMoves) {
        var self = this;
        var options = this._getWasmOptions();
        return stockfishBridge.search(fen, options)
            .then(function(result) {
                if (result && result.move) {
                    var parsed = self._uciToMove(result.move);
                    if (parsed) {
                        var legal = allMoves.find(function(m) {
                            return m.from.row === parsed.from.row && m.from.col === parsed.from.col &&
                                   m.to.row === parsed.to.row && m.to.col === parsed.to.col;
                        });
                        if (legal) {
                            console.log('[AI] WASM Stockfish: ' + result.move);
                            return parsed;
                        }
                    }
                }
                // Last resort: random legal move
                var m = allMoves[Math.floor(Math.random() * allMoves.length)];
                return {from:m.from, to:m.to, promotion:m.promotion?'Q':undefined};
            })
            .catch(function() {
                var m = allMoves[Math.floor(Math.random() * allMoves.length)];
                return {from:m.from, to:m.to, promotion:m.promotion?'Q':undefined};
            });
    };

    // ======================================================================
    // MINIMAX LOCAL (niveaux 1-2)
    // ======================================================================

    AI.prototype._findWithMinimax = function(engine, aiColor, allMoves) {
        this.nodesSearched = 0;
        this.timeStart = Date.now();
        this.timeBudget = this.difficulty === 1 ? 500 : 1000;
        this.aborted = false;

        var depth = this.difficulty === 1 ? 1 : 2;
        var bestScore = -Infinity;
        var bestMoves = [];
        var alpha = -Infinity;

        for (var i = 0; i < allMoves.length; i++) {
            var move = allMoves[i];
            var promo = move.promotion ? 'Q' : undefined;
            var copy = this._clone(engine);
            if (!copy.makeMove(move.from, move.to, promo)) continue;
            var score = depth <= 1
                ? this._eval(copy.board, aiColor)
                : this._minimax(copy, depth - 1, alpha, Infinity, false, aiColor);
            if (this.aborted) break;
            if (score > bestScore) {
                bestScore = score;
                bestMoves = [{from:move.from, to:move.to, promotion:promo}];
            } else if (score === bestScore) {
                bestMoves.push({from:move.from, to:move.to, promotion:promo});
            }
            alpha = Math.max(alpha, score);
        }

        if (bestMoves.length === 0) {
            var m = allMoves[0];
            return {from:m.from, to:m.to, promotion:m.promotion?'Q':undefined};
        }
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    };

    AI.prototype._minimax = function(engine, depth, alpha, beta, maximizing, aiColor) {
        this.nodesSearched++;
        if ((this.nodesSearched & 1023) === 0 && Date.now() - this.timeStart > this.timeBudget) {
            this.aborted = true;
            return this._eval(engine.board, aiColor);
        }
        var moves = engine.getAllLegalMoves();
        if (moves.length === 0) {
            return engine.isInCheck(engine.turn)
                ? (maximizing ? -100000 + depth : 100000 - depth) : 0;
        }
        if (depth === 0) return this._eval(engine.board, aiColor);

        // MVV-LVA ordering
        moves.sort(function(a, b) {
            var sa = 0, sb = 0;
            var ta = engine.board[a.to.row][a.to.col];
            var tb = engine.board[b.to.row][b.to.col];
            if (ta) sa = PIECE_VALUES[ta.type] || 0;
            if (tb) sb = PIECE_VALUES[tb.type] || 0;
            if (a.promotion) sa += 900;
            if (b.promotion) sb += 900;
            return sb - sa;
        });

        var best, i, move, copy, val;
        if (maximizing) {
            best = -Infinity;
            for (i = 0; i < moves.length; i++) {
                move = moves[i]; copy = this._clone(engine);
                copy.makeMove(move.from, move.to, move.promotion || undefined);
                val = this._minimax(copy, depth-1, alpha, beta, false, aiColor);
                if (this.aborted) return val;
                if (val > best) best = val;
                if (val > alpha) alpha = val;
                if (beta <= alpha) break;
            }
        } else {
            best = Infinity;
            for (i = 0; i < moves.length; i++) {
                move = moves[i]; copy = this._clone(engine);
                copy.makeMove(move.from, move.to, move.promotion || undefined);
                val = this._minimax(copy, depth-1, alpha, beta, true, aiColor);
                if (this.aborted) return val;
                if (val < best) best = val;
                if (val < beta) beta = val;
                if (beta <= alpha) break;
            }
        }
        return best;
    };

    AI.prototype._clone = function(engine) {
        var c = Object.create(ChessEngine.prototype);
        c.board = engine.board.map(function(r){return r.map(function(p){return p?{type:p.type,color:p.color}:null;});});
        c.turn = engine.turn;
        c.castlingRights = {
            white:{kingSide:engine.castlingRights.white.kingSide,queenSide:engine.castlingRights.white.queenSide},
            black:{kingSide:engine.castlingRights.black.kingSide,queenSide:engine.castlingRights.black.queenSide}
        };
        c.enPassantTarget = engine.enPassantTarget ? {row:engine.enPassantTarget.row,col:engine.enPassantTarget.col} : null;
        c.halfMoveClock = engine.halfMoveClock;
        c.fullMoveNumber = engine.fullMoveNumber;
        c.moveHistory = [];
        c.lastMove = engine.lastMove ? {from:engine.lastMove.from,to:engine.lastMove.to} : null;
        c.gameOver = false; c.result = null; c.winner = null;
        return c;
    };

    AI.prototype._eval = function(board, aiColor) {
        var s = 0;
        for (var r = 0; r < 8; r++)
            for (var c = 0; c < 8; c++) {
                var p = board[r][c];
                if (!p) continue;
                var t = PST[p.type];
                var bonus = t ? t[p.color === 'white' ? r : 7 - r][c] : 0;
                var v = (PIECE_VALUES[p.type] || 0) + bonus;
                s += p.color === aiColor ? v : -v;
            }
        return s;
    };

    return AI;
})();
