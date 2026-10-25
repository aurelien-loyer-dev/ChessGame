import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PlayerProfile } from '@chess/shared';

interface StoredPlayer extends PlayerProfile {
  token: string;
  lastSeen: number;
}

/**
 * Tiny JSON-file backed player store. Players are anonymous: the client keeps
 * the token we hand out and presents it again on reconnect.
 */
export class PlayerStore {
  private players = new Map<string, StoredPlayer>();
  private byToken = new Map<string, StoredPlayer>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string | null) {
    if (file && existsSync(file)) {
      try {
        const rows = JSON.parse(readFileSync(file, 'utf8')) as StoredPlayer[];
        for (const row of rows) this.index(row);
      } catch (err) {
        console.warn('[store] could not read players file, starting empty', err);
      }
    }
  }

  private index(player: StoredPlayer) {
    this.players.set(player.id, player);
    this.byToken.set(player.token, player);
  }

  /** Returns the player for `token`, or registers a new one. */
  resolve(token: string | undefined, name: string): { token: string; player: StoredPlayer } {
    const existing = token ? this.byToken.get(token) : undefined;
    if (existing) {
      existing.lastSeen = Date.now();
      if (name) existing.name = name;
      this.scheduleSave();
      return { token: existing.token, player: existing };
    }
    const player: StoredPlayer = {
      id: randomUUID(),
      token: randomBytes(24).toString('base64url'),
      name,
      rating: 1200,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      lastSeen: Date.now(),
    };
    this.index(player);
    this.scheduleSave();
    return { token: player.token, player };
  }

  get(id: string): StoredPlayer | undefined {
    return this.players.get(id);
  }

  touch() {
    this.scheduleSave();
  }

  leaderboard(limit = 50): PlayerProfile[] {
    return [...this.players.values()]
      .filter((p) => p.games > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map(({ id, name, rating, games, wins, losses, draws }) => ({ id, name, rating, games, wins, losses, draws }));
  }

  private scheduleSave() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 1000);
  }

  flush() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify([...this.players.values()]));
    renameSync(tmp, this.file);
  }
}
