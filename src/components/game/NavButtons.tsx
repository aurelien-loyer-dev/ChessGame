import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';

export function NavButtons({ ply, max, setPly }: { ply: number; max: number; setPly: (p: number) => void }) {
  return (
    <div className="nav-row">
      <button className="btn sm" onClick={() => setPly(0)} disabled={ply === 0} aria-label="Début">
        <ChevronFirst />
      </button>
      <button className="btn sm" onClick={() => setPly(ply - 1)} disabled={ply === 0} aria-label="Coup précédent">
        <ChevronLeft />
      </button>
      <button className="btn sm" onClick={() => setPly(ply + 1)} disabled={ply >= max} aria-label="Coup suivant">
        <ChevronRight />
      </button>
      <button className="btn sm" onClick={() => setPly(max)} disabled={ply >= max} aria-label="Fin">
        <ChevronLast />
      </button>
    </div>
  );
}
