export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10_000) {
    const s = Math.floor(total / 1000);
    const tenths = Math.floor((total % 1000) / 100);
    return `0:${String(s).padStart(2, '0')}.${tenths}`;
  }
  const secs = Math.ceil(total / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function Clock({ ms, active, low = 20_000 }: { ms: number; active: boolean; low?: number }) {
  return (
    <div className={`clock mono ${active ? 'active' : ''} ${ms <= low ? 'low' : ''}`} role="timer" aria-live="off">
      {formatClock(ms)}
    </div>
  );
}
