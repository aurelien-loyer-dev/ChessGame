import { useMemo, useRef, useState } from 'react';
import type { MoveClass } from '../lib/engine/eval';
import { formatScore, lineToCp, winChance } from '../lib/engine/eval';

interface Props {
  evals: { cp?: number; mate?: number }[];
  classes?: MoveClass[];
  ply: number;
  onSelect: (ply: number) => void;
}

const W = 600;
const H = 120;

/** White's winning chances over the game; the area above the midline is White's share. */
export function EvalGraph({ evals, classes, ply, onSelect }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = evals.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (i: number) => H - (winChance(lineToCp(evals[i])) / 100) * H;

  const path = useMemo(() => {
    if (!n) return { line: '', area: '' };
    let line = `M${x(0)},${y(0)}`;
    for (let i = 1; i < n; i++) line += ` L${x(i)},${y(i)}`;
    return { line, area: `${line} L${x(n - 1)},${H} L0,${H} Z` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evals]);

  const indexAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(((clientX - rect.left) / rect.width) * (n - 1))));
  };

  const shown = hover ?? ply;
  const markers = (classes ?? [])
    .map((c, i) => ({ c, i: i + 1 }))
    .filter((m) => m.c === 'blunder' || m.c === 'mistake' || m.c === 'inaccuracy');

  return (
    <div className="eval-graph">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Évolution de l’évaluation"
        onPointerMove={(e) => n > 1 && setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => n > 1 && onSelect(indexAt(e.clientX))}
      >
        <rect x="0" y="0" width={W} height={H} className="eg-bg" />
        <path d={path.area} className="eg-area" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="eg-mid" />
        <path d={path.line} className="eg-line" vectorEffect="non-scaling-stroke" />
        {n > 1 && <line x1={x(shown)} x2={x(shown)} y1="0" y2={H} className="eg-cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* Markers live in HTML so they keep their shape when the SVG stretches. */}
      {markers.map((m) => (
        <button
          key={m.i}
          className={`eg-marker ${m.c}`}
          style={{ left: `${(x(m.i) / W) * 100}%`, top: `${(y(m.i) / H) * 100}%` }}
          onClick={() => onSelect(m.i)}
          aria-label={`Coup ${Math.ceil(m.i / 2)} : ${m.c}`}
        />
      ))}
      {hover !== null && n > 1 && (
        <div className="eg-tip mono" style={{ left: `${(x(hover) / W) * 100}%` }}>
          {hover === 0 ? 'Départ' : `${Math.ceil(hover / 2)}${hover % 2 ? '.' : '...'}`} {formatScore(evals[hover])}
        </div>
      )}
    </div>
  );
}
