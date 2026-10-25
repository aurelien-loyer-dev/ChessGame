// Copies the single-threaded Stockfish WASM build into public/ so it can be
// loaded as a Web Worker without cross-origin isolation headers.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'engine');

let binDir;
try {
  binDir = join(dirname(require.resolve('stockfish/package.json')), 'bin');
} catch {
  console.warn('[copy-engine] stockfish package not installed yet, skipping');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
for (const [src, dst] of [
  ['stockfish-19-lite-single.js', 'stockfish.js'],
  ['stockfish-19-lite-single.wasm', 'stockfish.wasm'],
]) {
  const from = join(binDir, src);
  if (!existsSync(from)) throw new Error(`[copy-engine] missing ${from}`);
  copyFileSync(from, join(outDir, dst));
}
console.log('[copy-engine] Stockfish 19 lite copied to public/engine');
