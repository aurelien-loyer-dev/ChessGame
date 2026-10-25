import type { ReactNode } from 'react';
import type { PieceSymbol } from '../lib/chess';
import { PIECE_IMG } from './board/pieces';
import { Clock } from './Clock';

export function CapturedRow({ pieces, color, advantage }: { pieces: PieceSymbol[]; color: 'w' | 'b'; advantage: number }) {
  return (
    <div className="captured" aria-label="Pièces capturées">
      {pieces.map((p, i) => (
        <img key={i} src={PIECE_IMG[color + p.toUpperCase()]} alt="" className={i > 0 && pieces[i - 1] === p ? 'stack' : ''} />
      ))}
      {advantage > 0 && <span className="adv mono">+{advantage}</span>}
    </div>
  );
}

export function PlayerStrip({
  avatar,
  name,
  rating,
  sub,
  captured,
  clock,
  active,
  thinking,
  badge,
}: {
  avatar: ReactNode;
  name: string;
  rating?: number | string;
  sub?: ReactNode;
  captured?: ReactNode;
  clock?: { ms: number } | null;
  active: boolean;
  thinking?: boolean;
  badge?: ReactNode;
}) {
  return (
    <div className={`player-strip ${active ? 'active' : ''}`}>
      {avatar}
      <div className="player-meta">
        <div className="player-name">
          <span>{name}</span>
          {rating !== undefined && <span className="rating mono">{rating}</span>}
          {badge}
          {thinking && (
            <span className="thinking" aria-label="Réfléchit">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
        <div className="player-sub">{captured ?? sub}</div>
      </div>
      {clock && <Clock ms={clock.ms} active={active} />}
    </div>
  );
}
