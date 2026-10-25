import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Hub } from './hub.js';
import { PlayerStore } from './store.js';

const PORT = Number(process.env.PORT ?? 8080);
const here = fileURLToPath(new URL('.', import.meta.url));
const WEB_DIST = resolve(process.env.WEB_DIST ?? join(here, '../../web/dist'));
const DATA_FILE = process.env.DATA_FILE ?? join(here, '../data/players.json');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const store = new PlayerStore(DATA_FILE);
const hub = new Hub(store);

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  if (!existsSync(WEB_DIST)) return json(res, 404, { error: 'Frontend not built' });
  const url = new URL(req.url ?? '/', 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = join(WEB_DIST, rel);
  if (!file.startsWith(WEB_DIST)) return json(res, 403, { error: 'Forbidden' });
  // SPA fallback: unknown paths without an extension get index.html.
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(rel)) return json(res, 404, { error: 'Not found' });
    file = join(WEB_DIST, 'index.html');
  }
  const ext = extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  cors(req, res);
  const path = (req.url ?? '/').split('?')[0];
  if (path === '/health' || path === '/api/health') return json(res, 200, { ok: true, ...hub.stats() });
  if (path === '/api/leaderboard') return json(res, 200, { players: store.leaderboard() });
  if (path.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
  serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) {
    ws.close(1008, 'Origin not allowed');
    return;
  }
  hub.attach(ws);
});

// Drop dead sockets so presence counters stay honest.
const alive = new WeakSet<object>();
wss.on('connection', (ws) => {
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, 30_000).unref();

const shutdown = () => {
  store.flush();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`♛ Chess Arena server on http://localhost:${PORT} (ws: /ws)`);
});
