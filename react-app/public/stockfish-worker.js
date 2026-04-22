/**
 * stockfish-worker.js
 *
 * Chargement dans l'ordre :
 *   1. /stockfish.js  (copie locale – fiable, pas de CDN)
 *   2. CDN jsdelivr   (fallback réseau)
 *
 * Bug corrigé : stockfish.wasm retourne une Promise asynchrone (pas un objet
 * synchrone). L'ancien code traitait cette Promise comme un engine → aucune
 * commande UCI n'arrivait → timeout 25 s → coups aléatoires.
 * Solution : on n'utilise que stockfish.js (asm.js pur, init synchrone).
 */

var stockfish    = null;
var searchInfo   = {};
var initialized  = false;

var SOURCES = [
  '/stockfish.js',                                                     // local
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',    // CDN
];

function tryLoad(idx) {
  if (idx >= SOURCES.length) {
    postMessage({ type: 'error', message: 'Toutes les sources Stockfish ont échoué' });
    return;
  }
  try {
    importScripts(SOURCES[idx]);

    if (typeof STOCKFISH !== 'function') throw new Error('STOCKFISH indéfini');

    var result = STOCKFISH();

    /* stockfish.js ≥ 0.9 (WASM) retourne une Promise — on détecte et on
       attend la résolution. stockfish.js@10 (asm.js) retourne l'objet
       directement → branche synchrone. */
    if (result && typeof result.then === 'function') {
      result
        .then(function (engine) {
          if (engine) { setupEngine(engine); }
          else         { tryLoad(idx + 1); }
        })
        .catch(function () { tryLoad(idx + 1); });
    } else if (result) {
      setupEngine(result);
    } else {
      throw new Error('STOCKFISH() a renvoyé null');
    }
  } catch (e) {
    tryLoad(idx + 1);
  }
}

function setupEngine(engine) {
  stockfish = engine;
  if (stockfish.addMessageListener) {
    stockfish.addMessageListener(onLine);
  } else {
    stockfish.print = onLine;
  }
  send('uci');
}

function send(cmd) {
  if (!stockfish) return;
  if (stockfish.postMessage) stockfish.postMessage(cmd);
  else if (stockfish.cmd)    stockfish.cmd(cmd);
}

function onLine(line) {
  if (typeof line !== 'string') return;

  if (line === 'uciok') {
    send('setoption name Threads value 1');
    send('setoption name Hash value 64');
    send('isready');
  }

  if (line === 'readyok' && !initialized) {
    initialized = true;
    postMessage({ type: 'ready' });
  }

  if (line.startsWith('info ')) {
    var dm = line.match(/\bdepth (\d+)/);
    var sm = line.match(/\bscore (cp|mate) (-?\d+)/);
    var nm = line.match(/\bnodes (\d+)/);
    var pm = line.match(/\bpv (.+)/);
    if (dm) searchInfo.depth     = parseInt(dm[1]);
    if (sm) { searchInfo.scoreType = sm[1]; searchInfo.score = parseInt(sm[2]); }
    if (nm) searchInfo.nodes     = parseInt(nm[1]);
    if (pm) searchInfo.pv        = pm[1];
  }

  if (line.startsWith('bestmove ')) {
    var move = line.split(' ')[1];
    if (move === '(none)') move = null;
    postMessage({ type: 'bestmove', move: move, info: Object.assign({}, searchInfo) });
    searchInfo = {};
  }
}

self.onmessage = function (e) {
  var msg = e.data;
  switch (msg.type) {
    case 'init':
      tryLoad(0);
      break;

    case 'search': {
      var opts = msg.options || {};
      searchInfo = {};
      if (opts.skillLevel != null) {
        send('setoption name Skill Level value ' + opts.skillLevel);
      }
      send('position fen ' + msg.fen);
      var go = 'go';
      if (opts.depth)    go += ' depth '    + opts.depth;
      if (opts.movetime) go += ' movetime ' + opts.movetime;
      send(go);
      break;
    }

    case 'stop': send('stop'); break;
    case 'quit': send('quit'); break;
  }
};
