import type { Color } from '../lib/types';
import { formatScore, lineToCp, winChance } from '../lib/engine/eval';

export function EvalBar({
  line,
  orientation,
  className = '',
}: {
  line: { cp?: number; mate?: number } | null;
  orientation: Color;
  className?: string;
}) {
  const white = line ? winChance(lineToCp(line)) : 50;
  const label = formatScore(line);
  const whiteAhead = white >= 50;
  return (
    <div className={`eval-bar ${orientation} ${className}`} aria-label={`Évaluation ${label}`}>
      <div className="eval-white" style={{ height: `${white}%` }} />
      <span className={`eval-label mono ${whiteAhead ? 'w' : 'b'}`}>{label.replace('+', '')}</span>
    </div>
  );
}
