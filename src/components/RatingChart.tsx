import { useMemo, useRef, useState } from 'react';
import type { RatingPoint } from '../store/profile';

const W = 640;
const H = 180;
const PAD = { l: 40, r: 12, t: 12, b: 22 };

/** Single-series rating line with a light area fill and a hover crosshair. */
export function RatingChart({ points, label }: { points: RatingPoint[]; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { min, max, ticks } = useMemo(() => {
    const vals = points.map((p) => p.rating);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < 100) {
      const mid = (hi + lo) / 2;
      lo = mid - 50;
      hi = mid + 50;
    }
    lo = Math.floor(lo / 50) * 50;
    hi = Math.ceil(hi / 50) * 50;
    const step = Math.max(50, Math.ceil((hi - lo) / 4 / 50) * 50);
    const t: number[] = [];
    for (let v = lo; v <= hi; v += step) t.push(v);
    return { min: lo, max: hi, ticks: t };
  }, [points]);

  if (points.length < 2) {
    return <p className="faint small chart-empty">Ta courbe apparaîtra après deux résultats classés.</p>;
  }

  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.rating)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`;
  const last = points[points.length - 1];
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="rating-chart">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Évolution du classement ${label}`}
        onPointerMove={(e) => {
          const rect = ref.current!.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`rc-${label}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgb(143 212 255)" stopOpacity="0.28" />
            <stop offset="1" stopColor="rgb(143 212 255)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="rc-grid" />
            <text x={PAD.l - 8} y={y(t) + 4} className="rc-tick" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#rc-${label})`} />
        <path d={line} className="rc-line" />
        <circle cx={x(points.length - 1)} cy={y(last.rating)} r="4.5" className="rc-end" />
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="rc-cross" />
            <circle cx={x(hover)} cy={y(h.rating)} r="4" className="rc-dot" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="rc-tip mono" style={{ left: `${(x(hover) / W) * 100}%` }}>
          {h.rating} · {new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  );
}
