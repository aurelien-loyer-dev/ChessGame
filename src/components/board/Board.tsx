import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { motion } from 'motion/react';
import type { Color } from '../../lib/types';
import type { Dests, PieceSymbol, Square } from '../../lib/chess';
import { FILES } from '../../lib/chess';
import { BOARD_THEMES, useSettings } from '../../store/settings';
import { PIECE_IMG, codeOf } from './pieces';
import './board.css';

export interface Arrow {
  from: Square;
  to: Square;
  tone?: 'user' | 'engine' | 'hint' | 'good' | 'bad';
}

export interface Mark {
  square: Square;
  tone: 'good' | 'bad' | 'hint' | 'focus';
}

export interface BoardProps {
  fen: string;
  orientation: Color;
  /** Which side the user may move. */
  movable?: Color | 'both' | null;
  dests?: Dests;
  lastMove?: [Square, Square] | null;
  check?: Square | null;
  arrows?: Arrow[];
  marks?: Mark[];
  onMove?: (from: Square, to: Square, promotion?: PieceSymbol) => void;
  /** Called on every square click (used by lessons that ask to pick a square). */
  onSquareClick?: (square: Square) => void;
  className?: string;
}

interface PieceState {
  id: number;
  code: string;
  square: Square;
  leaving?: boolean;
}

let nextPieceId = 1;

function parsePlacement(fen: string): Map<Square, string> {
  const map = new Map<Square, string>();
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        map.set(`${FILES[file]}${8 - r}` as Square, codeOf(ch));
        file++;
      }
    }
  });
  return map;
}

function dist(a: Square, b: Square) {
  return Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(Number(a[1]) - Number(b[1]));
}

/**
 * Keeps a stable id per physical piece across positions so pieces slide
 * from their old square instead of popping in (same idea as chessground).
 */
function diffPieces(prev: PieceState[], fen: string): PieceState[] {
  const placement = parsePlacement(fen);
  const result: PieceState[] = [];
  const unmatchedOld = prev.filter((p) => !p.leaving);
  const unmatchedNew: [Square, string][] = [];

  for (const [square, code] of placement) {
    const idx = unmatchedOld.findIndex((p) => p.square === square && p.code === code);
    if (idx >= 0) {
      result.push(unmatchedOld[idx]);
      unmatchedOld.splice(idx, 1);
    } else unmatchedNew.push([square, code]);
  }
  for (const [square, code] of unmatchedNew) {
    let best = -1;
    for (let i = 0; i < unmatchedOld.length; i++) {
      if (unmatchedOld[i].code !== code) continue;
      if (best < 0 || dist(unmatchedOld[i].square, square) < dist(unmatchedOld[best].square, square)) best = i;
    }
    if (best >= 0) {
      result.push({ ...unmatchedOld[best], square });
      unmatchedOld.splice(best, 1);
    } else result.push({ id: nextPieceId++, code, square });
  }
  for (const gone of unmatchedOld) result.push({ ...gone, leaving: true });
  return result;
}

export function Board({
  fen,
  orientation,
  movable = null,
  dests,
  lastMove,
  check,
  arrows = [],
  marks = [],
  onMove,
  onSquareClick,
  className,
}: BoardProps) {
  const { boardTheme, coordinates, legalMoves, animations, autoQueen } = useSettings();
  const theme = BOARD_THEMES[boardTheme];
  const boardRef = useRef<HTMLDivElement>(null);

  const [pieces, setPieces] = useState<PieceState[]>(() => diffPieces([], fen));
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  useLayoutEffect(() => {
    const next = diffPieces(piecesRef.current, fen);
    setPieces(next);
    if (next.some((p) => p.leaving)) {
      const t = setTimeout(() => setPieces((cur) => cur.filter((p) => !p.leaving)), 260);
      return () => clearTimeout(t);
    }
  }, [fen]);

  const placement = useMemo(() => parsePlacement(fen), [fen]);
  const turn: Color = fen.split(' ')[1] === 'b' ? 'black' : 'white';

  const [selected, setSelected] = useState<Square | null>(null);
  const [drag, setDrag] = useState<{ square: Square; x: number; y: number; over: Square | null } | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; color: 'w' | 'b' } | null>(null);
  const [userArrows, setUserArrows] = useState<Arrow[]>([]);
  const [userCircles, setUserCircles] = useState<Square[]>([]);
  // The piece released by a drag should snap into place, not slide.
  const [justDropped, setJustDropped] = useState<Square | null>(null);
  const pointer = useRef<{ square: Square; startX: number; startY: number; button: number; wasSelected: boolean } | null>(null);

  // Reset transient UI when the position changes.
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
    setUserArrows([]);
    setUserCircles([]);
    setJustDropped(null);
  }, [fen]);

  const canMove = useCallback(
    (sq: Square) => {
      const code = placement.get(sq);
      if (!code || !movable || !onMove) return false;
      const color: Color = code[0] === 'w' ? 'white' : 'black';
      if (movable !== 'both' && color !== movable) return false;
      return color === turn;
    },
    [placement, movable, onMove, turn],
  );

  const squareAt = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const el = boardRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      let file = Math.floor(((clientX - rect.left) / rect.width) * 8);
      let rank = 7 - Math.floor(((clientY - rect.top) / rect.height) * 8);
      if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
      if (orientation === 'black') {
        file = 7 - file;
        rank = 7 - rank;
      }
      return `${FILES[file]}${rank + 1}` as Square;
    },
    [orientation],
  );

  const targets = useMemo(() => (selected && dests?.get(selected)) || [], [selected, dests]);

  const tryMove = (from: Square, to: Square): boolean => {
    if (!dests?.get(from)?.includes(to)) return false;
    const code = placement.get(from);
    if (code && code[1] === 'P' && (to[1] === '8' || to[1] === '1')) {
      if (autoQueen) onMove?.(from, to, 'q');
      else setPromotion({ from, to, color: code[0] as 'w' | 'b' });
      setSelected(null);
      return true;
    }
    onMove?.(from, to);
    setSelected(null);
    return true;
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (promotion) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (e.button === 2) {
      pointer.current = { square: sq, startX: e.clientX, startY: e.clientY, button: 2, wasSelected: false };
      return;
    }
    if (e.button !== 0) return;
    setUserArrows([]);
    setUserCircles([]);
    onSquareClick?.(sq);

    if (selected && selected !== sq && tryMove(selected, sq)) {
      pointer.current = null;
      return;
    }
    if (canMove(sq)) {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      pointer.current = { square: sq, startX: e.clientX, startY: e.clientY, button: 0, wasSelected: selected === sq };
      setSelected(sq);
    } else {
      setSelected(null);
      pointer.current = null;
    }
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.button !== 0) return;
    if (!drag && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < 4) return;
    const rect = boardRef.current!.getBoundingClientRect();
    setDrag({
      square: p.square,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      over: squareAt(e.clientX, e.clientY),
    });
  };

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    pointer.current = null;
    if (!p) return;
    const sq = squareAt(e.clientX, e.clientY);

    if (p.button === 2) {
      if (!sq) return;
      if (sq === p.square) {
        setUserCircles((c) => (c.includes(sq) ? c.filter((s) => s !== sq) : [...c, sq]));
      } else {
        setUserArrows((a) => {
          const exists = a.some((x) => x.from === p.square && x.to === sq);
          return exists ? a.filter((x) => !(x.from === p.square && x.to === sq)) : [...a, { from: p.square, to: sq, tone: 'user' }];
        });
      }
      return;
    }

    if (drag) {
      setDrag(null);
      if (sq && sq !== p.square && tryMove(p.square, sq)) {
        setJustDropped(sq);
        return;
      }
      if (sq !== p.square) setSelected(null);
    } else if (p.wasSelected && sq === p.square) {
      setSelected(null);
    }
  };

  const toXY = (sq: Square) => {
    const file = sq.charCodeAt(0) - 97;
    const rank = Number(sq[1]) - 1;
    return orientation === 'white' ? { x: file, y: 7 - rank } : { x: 7 - file, y: rank };
  };

  const highlights: { square: Square; cls: string }[] = [];
  if (lastMove) {
    highlights.push({ square: lastMove[0], cls: 'hl-last' }, { square: lastMove[1], cls: 'hl-last' });
  }
  if (selected) highlights.push({ square: selected, cls: 'hl-selected' });
  if (check) highlights.push({ square: check, cls: 'hl-check' });
  if (drag?.over && targets.includes(drag.over)) highlights.push({ square: drag.over, cls: 'hl-hover' });
  for (const m of marks) highlights.push({ square: m.square, cls: `hl-mark hl-${m.tone}` });

  const allArrows = [...arrows, ...userArrows];
  const squareSize = 100 / 8;

  return (
    <div
      className={`board ${animations ? 'animated' : ''} ${className ?? ''}`}
      style={{ '--sq-light': theme.light, '--sq-dark': theme.dark } as React.CSSProperties}
    >
      <motion.div
        key={orientation}
        className="board-inner"
        ref={boardRef}
        initial={animations ? { rotateX: 55, scale: 0.92, opacity: 0 } : false}
        animate={{ rotateX: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null;
          setDrag(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        role="grid"
        aria-label="Échiquier"
      >
        <div className={`squares ${orientation}`} />

        {highlights.map((h, i) => {
          const { x, y } = toXY(h.square);
          return <div key={`${h.cls}-${h.square}-${i}`} className={`hl ${h.cls}`} style={{ left: `${x * squareSize}%`, top: `${y * squareSize}%` }} />;
        })}

        {userCircles.map((sq) => {
          const { x, y } = toXY(sq);
          return <div key={`c-${sq}`} className="hl hl-circle" style={{ left: `${x * squareSize}%`, top: `${y * squareSize}%` }} />;
        })}

        {coordinates && (
          <div className="coords" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => {
              const rank = orientation === 'white' ? 8 - i : i + 1;
              const file = orientation === 'white' ? FILES[i] : FILES[7 - i];
              return (
                <span key={i}>
                  <span className={`coord rank ${i % 2 === 0 ? 'on-light' : 'on-dark'}`} style={{ top: `${i * squareSize}%` }}>
                    {rank}
                  </span>
                  <span className={`coord file ${i % 2 === 0 ? 'on-dark' : 'on-light'}`} style={{ left: `${i * squareSize}%` }}>
                    {file}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {legalMoves &&
          targets.map((sq) => {
            const { x, y } = toXY(sq);
            return (
              <div
                key={`d-${sq}`}
                className={`dest ${placement.has(sq) ? 'capture' : ''}`}
                style={{ left: `${x * squareSize}%`, top: `${y * squareSize}%` }}
              />
            );
          })}

        {pieces.map((p) => {
          const { x, y } = toXY(p.square);
          const dragging = drag && drag.square === p.square && !p.leaving;
          const style: React.CSSProperties = dragging
            ? { translate: `calc(${drag.x}px - 50%) calc(${drag.y}px - 50%)`, backgroundImage: `url("${PIECE_IMG[p.code]}")` }
            : { translate: `${x * 100}% ${y * 100}%`, backgroundImage: `url("${PIECE_IMG[p.code]}")` };
          return (
            <div
              key={p.id}
              className={`piece ${p.leaving ? 'leaving' : ''} ${dragging ? 'dragging' : ''} ${justDropped === p.square ? 'snap' : ''}`}
              style={style}
              data-square={p.square}
              data-piece={p.code}
            />
          );
        })}

        {allArrows.length > 0 && <Arrows arrows={allArrows} toXY={toXY} />}

        {promotion && (
          <PromotionPicker
            color={promotion.color}
            file={toXY(promotion.to).x}
            fromTop={toXY(promotion.to).y === 0}
            onPick={(piece) => {
              onMove?.(promotion.from, promotion.to, piece);
              setPromotion(null);
            }}
            onCancel={() => setPromotion(null)}
          />
        )}
      </motion.div>
    </div>
  );
}

function Arrows({ arrows, toXY }: { arrows: Arrow[]; toXY: (sq: Square) => { x: number; y: number } }) {
  return (
    <svg className="arrows" viewBox="0 0 8 8" aria-hidden>
      <defs>
        {['user', 'engine', 'hint', 'good', 'bad'].map((tone) => (
          <marker key={tone} id={`ah-${tone}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className={`arrow-head ${tone}`} />
          </marker>
        ))}
      </defs>
      {arrows.map((a, i) => {
        const f = toXY(a.from);
        const t = toXY(a.to);
        const x1 = f.x + 0.5;
        const y1 = f.y + 0.5;
        const x2 = t.x + 0.5;
        const y2 = t.y + 0.5;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const shorten = 0.32;
        const ex = x2 - ((x2 - x1) / len) * shorten;
        const ey = y2 - ((y2 - y1) / len) * shorten;
        const tone = a.tone ?? 'user';
        return (
          <line
            key={`${a.from}${a.to}${i}`}
            x1={x1}
            y1={y1}
            x2={ex}
            y2={ey}
            className={`arrow ${tone}`}
            markerEnd={`url(#ah-${tone})`}
          />
        );
      })}
    </svg>
  );
}

function PromotionPicker({
  color,
  file,
  fromTop,
  onPick,
  onCancel,
}: {
  color: 'w' | 'b';
  file: number;
  fromTop: boolean;
  onPick: (p: PieceSymbol) => void;
  onCancel: () => void;
}) {
  const choices: PieceSymbol[] = ['q', 'n', 'r', 'b'];
  return (
    <div className="promo-backdrop" onPointerDown={(e) => { e.stopPropagation(); onCancel(); }}>
      <motion.div
        className={`promo ${fromTop ? 'top' : 'bottom'}`}
        style={{ left: `${file * 12.5}%` }}
        initial={{ opacity: 0, scaleY: 0.4 }}
        animate={{ opacity: 1, scaleY: 1 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {choices.map((p) => (
          <button
            key={p}
            className="promo-choice"
            aria-label={`Promouvoir en ${{ q: 'dame', n: 'cavalier', r: 'tour', b: 'fou' }[p as 'q' | 'n' | 'r' | 'b']}`}
            onClick={() => onPick(p)}
            style={{ backgroundImage: `url("${PIECE_IMG[color + p.toUpperCase()]}")` }}
          />
        ))}
      </motion.div>
    </div>
  );
}
