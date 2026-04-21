/**
 * stockfish-worker.js — Web Worker qui charge Stockfish WASM (NNUE)
 *
 * Communication par postMessage :
 *   → { type: 'init' }                    — Charge le moteur
 *   → { type: 'search', fen, options }    — Lance une recherche
 *   → { type: 'stop' }                    — Arrête la recherche en cours
 *   ← { type: 'ready' }                   — Moteur prêt
 *   ← { type: 'bestmove', move, info }    — Meilleur coup trouvé
 *   ← { type: 'error', message }          — Erreur
 */

let stockfish = null;
let pendingResolve = null;
let searchInfo = {};

// Load Stockfish WASM from CDN (stockfish.js 16.1 NNUE)
async function initEngine() {
    try {
        // Use stockfish.js WASM build from CDN
        // This loads the WASM build of Stockfish 10 (niklasf)
        importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');

        stockfish = typeof STOCKFISH === 'function' ? STOCKFISH() : null;

        if (!stockfish) {
            // Fallback: try the global Module approach
            if (typeof Stockfish === 'function') {
                stockfish = await Stockfish();
            }
        }

        if (!stockfish) {
            throw new Error('Stockfish failed to load');
        }

        // Setup message listener from Stockfish
        const originalPostMessage = stockfish.postMessage || stockfish.postRun;

        stockfish.addMessageListener = stockfish.addMessageListener || null;

        if (stockfish.addMessageListener) {
            stockfish.addMessageListener(onStockfishMessage);
        } else if (stockfish.onmessage !== undefined) {
            stockfish.onmessage = (msg) => onStockfishMessage(typeof msg === 'string' ? msg : msg.data);
        } else {
            // Listen via print callback
            stockfish.print = onStockfishMessage;
        }

        // Send initial UCI commands
        sendToEngine('uci');
        sendToEngine('isready');

    } catch (e) {
        postMessage({ type: 'error', message: 'Stockfish load failed: ' + e.message });
    }
}

function sendToEngine(cmd) {
    if (!stockfish) return;
    if (stockfish.postMessage) {
        stockfish.postMessage(cmd);
    } else if (stockfish.cmd) {
        stockfish.cmd(cmd);
    }
}

function onStockfishMessage(line) {
    if (typeof line !== 'string') return;

    if (line === 'uciok') {
        // Configure engine
        sendToEngine('setoption name Threads value 1');
        sendToEngine('setoption name Hash value 32');
        sendToEngine('isready');
    }

    if (line === 'readyok') {
        postMessage({ type: 'ready' });
    }

    // Parse search info
    if (line.startsWith('info ')) {
        const depthMatch = line.match(/\bdepth (\d+)/);
        const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
        const nodesMatch = line.match(/\bnodes (\d+)/);
        const pvMatch = line.match(/\bpv (.+)/);

        if (depthMatch) searchInfo.depth = parseInt(depthMatch[1]);
        if (scoreMatch) {
            searchInfo.scoreType = scoreMatch[1];
            searchInfo.scoreValue = parseInt(scoreMatch[2]);
        }
        if (nodesMatch) searchInfo.nodes = parseInt(nodesMatch[1]);
        if (pvMatch) searchInfo.pv = pvMatch[1];
    }

    // Best move found
    if (line.startsWith('bestmove ')) {
        const parts = line.split(' ');
        const move = parts[1];
        postMessage({
            type: 'bestmove',
            move: move,
            info: { ...searchInfo }
        });
        searchInfo = {};
    }
}

// Handle messages from main thread
self.onmessage = function (e) {
    const msg = e.data;

    switch (msg.type) {
        case 'init':
            initEngine();
            break;

        case 'search': {
            const { fen, options } = msg;
            searchInfo = {};

            // Set skill level (0-20, supported in Stockfish 10)
            if (options.skillLevel !== undefined) {
                sendToEngine(`setoption name Skill Level value ${options.skillLevel}`);
            }

            // Position
            sendToEngine(`position fen ${fen}`);

            // Go command with limits
            let goCmd = 'go';
            if (options.depth) goCmd += ` depth ${options.depth}`;
            if (options.movetime) goCmd += ` movetime ${options.movetime}`;
            if (options.nodes) goCmd += ` nodes ${options.nodes}`;

            sendToEngine(goCmd);
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
