import type { Bot } from '../lib/engine/bots';

/** Geometric avatar: a glyph on a tinted disc with an orbit ring, colored per bot. */
export function BotAvatar({ bot, size = 44 }: { bot: Pick<Bot, 'hue' | 'glyph' | 'name'>; size?: number }) {
  return (
    <span
      className="bot-avatar"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        ['--hue' as string]: bot.hue,
      }}
    >
      {bot.glyph}
    </span>
  );
}

export function UserAvatar({ name, size = 44, hue = 200 }: { name: string; size?: number; hue?: number }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="bot-avatar user" aria-hidden style={{ width: size, height: size, fontSize: size * 0.42, ['--hue' as string]: hue }}>
      {letter}
    </span>
  );
}

export function hueFromName(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
