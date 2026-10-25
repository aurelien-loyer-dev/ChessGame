import { useEffect } from 'react';

/** Arrow keys browse the move list, F flips the board. */
export function useBoardKeys(opts: { ply: number; max: number; setPly: (p: number) => void; flip?: () => void }) {
  const { ply, max, setPly, flip } = opts;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowLeft') setPly(Math.max(0, ply - 1));
      else if (e.key === 'ArrowRight') setPly(Math.min(max, ply + 1));
      else if (e.key === 'ArrowUp' || e.key === 'Home') setPly(0);
      else if (e.key === 'ArrowDown' || e.key === 'End') setPly(max);
      else if ((e.key === 'f' || e.key === 'F') && flip) flip();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ply, max, setPly, flip]);
}
