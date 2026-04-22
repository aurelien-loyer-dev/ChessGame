/**
 * minimax.worker.js — moteur de jeu pur JS dans un Web Worker
 *
 * Tourne hors du thread principal → zéro freeze.
 * Reçoit  : { type:'search', state, timeBudget }
 * Répond  : { type:'bestmove', move }
 */

import { ChessEngine } from '../lib/chess.js';

// ─── Valeurs des pièces ────────────────────────────────────────────────────────
var PV = { P: 100, N: 325, B: 350, R: 500, Q: 975, K: 20000 };

// ─── Piece-Square Tables ───────────────────────────────────────────────────────
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

// ─── État de la recherche (module-level, une seule recherche à la fois) ────────
var _timeStart     = 0;
var _timeBudget    = 0;
var _nodesSearched = 0;
var _aborted       = false;

// ─── Reconstruction du moteur ─────────────────────────────────────────────────
function buildEngine(board, turn, cr, ep, hmc, fmn, lastMove) {
  var c = Object.create(ChessEngine.prototype);
  c.board = board.map(function (row) {
    return row.map(function (p) { return p ? { type: p.type, color: p.color } : null; });
  });
  c.turn = turn;
  c.castlingRights = {
    white: { kingSide: cr.white.kingSide, queenSide: cr.white.queenSide },
    black: { kingSide: cr.black.kingSide, queenSide: cr.black.queenSide },
  };
  c.enPassantTarget = ep ? { row: ep.row, col: ep.col } : null;
  c.halfMoveClock   = hmc;
  c.fullMoveNumber  = fmn;
  c.moveHistory     = [];
  c.lastMove        = lastMove ? { from: lastMove.from, to: lastMove.to } : null;
  c.gameOver = false; c.result = null; c.winner = null;
  return c;
}

function fromState(s) {
  return buildEngine(s.board, s.turn, s.castlingRights, s.enPassantTarget, s.halfMoveClock, s.fullMoveNumber, s.lastMove);
}

function cloneEngine(e) {
  return buildEngine(e.board, e.turn, e.castlingRights, e.enPassantTarget, e.halfMoveClock, e.fullMoveNumber, e.lastMove);
}

// ─── Évaluation statique ──────────────────────────────────────────────────────
function evalPosition(engine) {
  var board    = engine.board;
  var score    = 0;
  var wP = [0,0,0,0,0,0,0,0], bP = [0,0,0,0,0,0,0,0];
  var wB = 0, bB = 0, totalMat = 0;

  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      var p = board[r][c];
      if (!p) continue;
      var val   = PV[p.type] || 0;
      totalMat += val;
      var pr    = p.color === 'white' ? r : 7 - r;
      var pst   = PST[p.type];
      var bonus = pst ? pst[pr][c] : 0;
      if (p.color === 'white') { score += val + bonus; if (p.type === 'P') wP[c]++; if (p.type === 'B') wB++; }
      else                     { score -= val + bonus; if (p.type === 'P') bP[c]++; if (p.type === 'B') bB++; }
    }
  }

  // Roi en finale
  if (totalMat < 2600) {
    var egW = totalMat < 1300 ? 1.0 : (2600 - totalMat) / 1300;
    for (var r2 = 0; r2 < 8; r2++) {
      for (var c2 = 0; c2 < 8; c2++) {
        var pk = board[r2][c2];
        if (!pk || pk.type !== 'K') continue;
        var prk    = pk.color === 'white' ? r2 : 7 - r2;
        var egDiff = PST_KEG[prk][c2] - PST_KMG[prk][c2];
        if (pk.color === 'white') score += egDiff * egW;
        else                      score -= egDiff * egW;
      }
    }
  }

  if (wB >= 2) score += 30;
  if (bB >= 2) score -= 30;

  for (var f = 0; f < 8; f++) {
    if (wP[f] > 1) score -= 15 * (wP[f] - 1);
    if (bP[f] > 1) score += 15 * (bP[f] - 1);
    var wIso = wP[f] > 0 && (f === 0 || wP[f-1] === 0) && (f === 7 || wP[f+1] === 0);
    var bIso = bP[f] > 0 && (f === 0 || bP[f-1] === 0) && (f === 7 || bP[f+1] === 0);
    if (wIso) score -= 15;
    if (bIso) score += 15;
  }

  // Pions passés
  for (var f3 = 0; f3 < 8; f3++) {
    for (var r3 = 0; r3 < 8; r3++) {
      var pp = board[r3][f3];
      if (!pp || pp.type !== 'P') continue;
      if (pp.color === 'white') {
        var wpass = true;
        for (var wr = r3 - 1; wr >= 0 && wpass; wr--) {
          for (var wf = Math.max(0, f3-1); wf <= Math.min(7, f3+1); wf++) {
            var wo = board[wr][wf];
            if (wo && wo.type === 'P' && wo.color === 'black') { wpass = false; break; }
          }
        }
        if (wpass) score += 10 + (7 - r3) * 10;
      } else {
        var bpass = true;
        for (var br = r3 + 1; br <= 7 && bpass; br++) {
          for (var bf = Math.max(0, f3-1); bf <= Math.min(7, f3+1); bf++) {
            var bo = board[br][bf];
            if (bo && bo.type === 'P' && bo.color === 'white') { bpass = false; break; }
          }
        }
        if (bpass) score -= 10 + r3 * 10;
      }
    }
  }

  return engine.turn === 'white' ? score : -score;
}

// ─── Tri des coups ─────────────────────────────────────────────────────────────
function movePriority(m, board) {
  var s = 0;
  var victim   = board[m.to.row][m.to.col];
  var attacker = board[m.from.row][m.from.col];
  if (victim)        s += 10 * (PV[victim.type] || 0) - (attacker ? PV[attacker.type] || 0 : 0);
  if (m.promotion)   s += 8000;
  if (m.isEnPassant) s += 100;
  var dr = m.to.row - 3.5, dc = m.to.col - 3.5;
  s += Math.max(0, 2 - Math.abs(dr)) + Math.max(0, 2 - Math.abs(dc));
  return s;
}

function orderMoves(moves, engine) {
  var board = engine.board;
  return moves.slice().sort(function (a, b) { return movePriority(b, board) - movePriority(a, board); });
}

// ─── Recherche de quiescence ──────────────────────────────────────────────────
function quiesce(engine, alpha, beta, qdepth) {
  _nodesSearched++;
  if (qdepth > 7) return evalPosition(engine);

  var standPat = evalPosition(engine);
  if (standPat >= beta)       return beta;
  if (standPat < alpha - 975) return alpha;
  if (standPat > alpha)       alpha = standPat;

  var all  = engine.getAllLegalMoves();
  var caps = [];
  for (var i = 0; i < all.length; i++) {
    var m = all[i];
    if (engine.board[m.to.row][m.to.col] || m.isEnPassant || m.promotion) caps.push(m);
  }
  caps.sort(function (a, b) {
    var av = engine.board[a.to.row][a.to.col] ? PV[engine.board[a.to.row][a.to.col].type] : (a.isEnPassant ? 100 : 975);
    var bv = engine.board[b.to.row][b.to.col] ? PV[engine.board[b.to.row][b.to.col].type] : (b.isEnPassant ? 100 : 975);
    var aa = engine.board[a.from.row][a.from.col] ? PV[engine.board[a.from.row][a.from.col].type] : 0;
    var ba = engine.board[b.from.row][b.from.col] ? PV[engine.board[b.from.row][b.from.col].type] : 0;
    return (bv - ba) - (av - aa);
  });

  for (var j = 0; j < caps.length; j++) {
    var cm   = caps[j];
    var copy = cloneEngine(engine);
    copy.makeMove(cm.from, cm.to, cm.promotion ? 'Q' : undefined);
    var score = -quiesce(copy, -beta, -alpha, qdepth + 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
    if (_aborted)      return alpha;
  }
  return alpha;
}

// ─── Negamax alpha-beta ───────────────────────────────────────────────────────
function negamax(engine, depth, alpha, beta) {
  _nodesSearched++;
  if ((_nodesSearched & 1023) === 0 && Date.now() - _timeStart > _timeBudget) {
    _aborted = true;
    return evalPosition(engine);
  }
  if (_aborted) return evalPosition(engine);

  var moves = engine.getAllLegalMoves();
  if (!moves.length) return engine.isInCheck(engine.turn) ? -90000 + depth : 0;
  if (depth <= 0)    return quiesce(engine, alpha, beta, 0);

  var ordered = orderMoves(moves, engine);
  var best    = -Infinity;

  for (var i = 0; i < ordered.length; i++) {
    var mv   = ordered[i];
    var copy = cloneEngine(engine);
    copy.makeMove(mv.from, mv.to, mv.promotion ? 'Q' : undefined);
    var score = -negamax(copy, depth - 1, -beta, -alpha);
    if (_aborted) return best;
    if (score > best)  best  = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

// ─── Approfondissement itératif ────────────────────────────────────────────────
function findBestMove(state, budget) {
  _timeStart     = Date.now();
  _timeBudget    = budget;
  _nodesSearched = 0;
  _aborted       = false;

  var engine   = fromState(state);
  var allMoves = engine.getAllLegalMoves();

  if (!allMoves.length) return null;
  if (allMoves.length === 1) {
    var only = allMoves[0];
    return { from: only.from, to: only.to, promotion: only.promotion ? 'Q' : undefined };
  }

  var ordered   = orderMoves(allMoves, engine);
  var bestMove  = { from: ordered[0].from, to: ordered[0].to, promotion: ordered[0].promotion ? 'Q' : undefined };

  for (var depth = 1; depth <= 30; depth++) {
    if (Date.now() - _timeStart > budget * 0.85) break;

    var depthBest      = null;
    var depthBestScore = -Infinity;
    _aborted           = false;

    for (var i = 0; i < ordered.length; i++) {
      var mv    = ordered[i];
      var promo = mv.promotion ? 'Q' : undefined;
      var copy  = cloneEngine(engine);
      if (!copy.makeMove(mv.from, mv.to, promo)) continue;

      var score = -negamax(copy, depth - 1, -Infinity, -depthBestScore);
      if (_aborted) break;

      if (score > depthBestScore || !depthBest) {
        depthBestScore = score;
        depthBest      = { from: mv.from, to: mv.to, promotion: promo };
      }
    }

    if (!_aborted && depthBest) {
      bestMove = depthBest;
      // Meilleur coup en tête pour la prochaine itération
      var front = null, rest = [];
      for (var j = 0; j < ordered.length; j++) {
        var om = ordered[j];
        if (om.from.row === depthBest.from.row && om.from.col === depthBest.from.col &&
            om.to.row   === depthBest.to.row   && om.to.col   === depthBest.to.col) {
          front = om;
        } else { rest.push(om); }
      }
      if (front) { rest.unshift(front); ordered = rest; }
    }
    if (_aborted) break;
  }

  return bestMove;
}

// ─── Interface worker ─────────────────────────────────────────────────────────
self.onmessage = function (e) {
  var msg = e.data;
  if (msg.type === 'search') {
    var move = findBestMove(msg.state, msg.timeBudget);
    self.postMessage({ type: 'bestmove', move: move });
  }
};
