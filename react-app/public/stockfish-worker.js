/**
 * stockfish-worker.js — Web Worker Stockfish WASM
 *
 * Tentative de chargement par ordre de qualité :
 *   1. stockfish.wasm 0.9 (Stockfish 12 + NNUE partiel)
 *   2. stockfish.js 10.0.2 (Stockfish 10, fallback garanti)
 *
 * Protocole (postMessage) :
 *   → { type: 'init' }               — Charge et initialise le moteur
 *   → { type: 'search', fen, options } — Lance une recherche
 *   → { type: 'stop' }               — Arrête la recherche
 *   ← { type: 'ready' }              — Moteur prêt
 *   ← { type: 'bestmove', move, info } — Meilleur coup
 *   ← { type: 'error', message }     — Erreur
 */

var stockfish = null;
var searchInfo = {};
var initialized = false;

var CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/stockfish.wasm@0.9.0/src/stockfish.js',
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
];

function tryLoadEngine(urlIndex) {
  if (urlIndex >= CDN_URLS.length) {
    postMessage({ type: 'error', message: 'All Stockfish CDN URLs failed' });
    return;
  }

  try {
    importScripts(CDN_URLS[urlIndex]);

    var engine = typeof STOCKFISH === 'function' ? STOCKFISH() : null;
    if (!engine) throw new Error('STOCKFISH() returned null');

    stockfish = engine;

    if (stockfish.addMessageListener) {
      stockfish.addMessageListener(onStockfishLine);
    } else {
      stockfish.print = onStockfishLine;
    }

    sendToEngine('uci');
  } catch (e) {
    // Try next CDN
    tryLoadEngine(urlIndex + 1);
  }
}

function sendToEngine(cmd) {
  if (!stockfish) return;
  if (stockfish.postMessage) stockfish.postMessage(cmd);
  else if (stockfish.cmd)    stockfish.cmd(cmd);
}

function onStockfishLine(line) {
  if (typeof line !== 'string') return;

  if (line === 'uciok') {
    sendToEngine('setoption name Threads value 1');
    sendToEngine('setoption name Hash value 64');
    sendToEngine('isready');
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
    if (dm) searchInfo.depth      = parseInt(dm[1]);
    if (sm) { searchInfo.scoreType = sm[1]; searchInfo.score = parseInt(sm[2]); }
    if (nm) searchInfo.nodes      = parseInt(nm[1]);
    if (pm) searchInfo.pv         = pm[1];
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
      tryLoadEngine(0);
      break;

    case 'search': {
      var fen     = msg.fen;
      var options = msg.options || {};
      searchInfo  = {};

      if (options.skillLevel != null) {
        sendToEngine('setoption name Skill Level value ' + options.skillLevel);
      }

      sendToEngine('position fen ' + fen);

      var go = 'go';
      if (options.depth)    go += ' depth '    + options.depth;
      if (options.movetime) go += ' movetime ' + options.movetime;
      if (options.nodes)    go += ' nodes '    + options.nodes;
      sendToEngine(go);
      break;
    }

    case 'stop':
      sendToEngine('stop');
      break;

    case 'quit':
      sendToEngine('quit');
      break;
  }
};
