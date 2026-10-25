import { useEffect, useRef } from 'react';
import type { PlayedMove } from '../game/line';
import { MOVE_CLASS_META, type MoveClass } from '../lib/engine/eval';
import { frSan } from '../lib/chess';

export function MoveList({
  moves,
  ply,
  onSelect,
  classes,
  startPly = 0,
}: {
  moves: Pick<PlayedMove, 'san' | 'color'>[];
  ply: number;
  onSelect: (ply: number) => void;
  classes?: (MoveClass | undefined)[];
  /** Number of half-moves before the first listed move (for games starting from a FEN). */
  startPly?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-current="true"]');
    if (el && ref.current) {
      const box = ref.current;
      const top = el.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 40) box.scrollTo({ top: top - box.clientHeight / 2, behavior: 'smooth' });
    } else if (ply === moves.length && ref.current) ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [ply, moves.length]);

  const blackFirst = moves[0]?.color === 'black';
  const rows: { num: number; white?: number; black?: number }[] = [];
  moves.forEach((m, i) => {
    const num = Math.floor((startPly + i) / 2) + 1;
    if (m.color === 'white' || (i === 0 && blackFirst)) rows.push({ num, [m.color]: i });
    else if (rows.length) rows[rows.length - 1].black = i;
    else rows.push({ num, black: i });
  });

  if (!moves.length) {
    return (
      <div className="move-list empty" ref={ref}>
        <p className="faint">Les coups apparaîtront ici.</p>
      </div>
    );
  }

  const cell = (i: number | undefined) => {
    if (i === undefined) return <span className="move-cell" />;
    const cls = classes?.[i];
    const meta = cls ? MOVE_CLASS_META[cls] : null;
    return (
      <button
        className={`move-cell ${ply === i + 1 ? 'current' : ''} ${meta ? `mc-${meta.tone}` : ''}`}
        data-current={ply === i + 1}
        onClick={() => onSelect(i + 1)}
      >
        <span>{frSan(moves[i].san)}</span>
        {meta && cls !== 'best' && cls !== 'excellent' && cls !== 'good' && <em>{meta.symbol}</em>}
      </button>
    );
  };

  return (
    <div className="move-list" ref={ref}>
      {rows.map((r) => (
        <div className="move-row" key={`${r.num}-${r.white ?? r.black}`}>
          <span className="move-num mono">{r.num}.</span>
          {cell(r.white)}
          {cell(r.black)}
        </div>
      ))}
    </div>
  );
}
