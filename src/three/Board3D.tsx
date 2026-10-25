import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { Color } from '../lib/types';
import type { BoardProps } from '../components/board/Board';
import { FILES, type PieceSymbol, type Square } from '../lib/chess';
import { BOARD_THEMES, useSettings } from '../store/settings';
import { pieceGeometry, pieceMaterials } from './pieces3d';
import { PIECE_IMG } from '../components/board/pieces';

interface Piece3D {
  id: number;
  type: PieceSymbol;
  color: 'w' | 'b';
  square: Square;
}

let nextId = 1;

function squarePos(sq: Square): [number, number] {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  return [file - 3.5, 3.5 - rank];
}

function parse(fen: string): { type: PieceSymbol; color: 'w' | 'b'; square: Square }[] {
  const out: { type: PieceSymbol; color: 'w' | 'b'; square: Square }[] = [];
  fen
    .split(' ')[0]
    .split('/')
    .forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) f += Number(ch);
        else {
          out.push({
            type: ch.toLowerCase() as PieceSymbol,
            color: ch === ch.toLowerCase() ? 'b' : 'w',
            square: `${FILES[f]}${8 - r}` as Square,
          });
          f++;
        }
      }
    });
  return out;
}

/** Same identity-preserving diff as the 2D board so pieces glide between squares. */
function diff(prev: Piece3D[], fen: string): Piece3D[] {
  const next = parse(fen);
  const pool = [...prev];
  const result: Piece3D[] = [];
  const pending: typeof next = [];
  for (const p of next) {
    const i = pool.findIndex((o) => o.square === p.square && o.type === p.type && o.color === p.color);
    if (i >= 0) result.push(pool.splice(i, 1)[0]);
    else pending.push(p);
  }
  for (const p of pending) {
    let best = -1;
    let bestD = Infinity;
    pool.forEach((o, i) => {
      if (o.type !== p.type || o.color !== p.color) return;
      const [ax, az] = squarePos(o.square);
      const [bx, bz] = squarePos(p.square);
      const d = Math.abs(ax - bx) + Math.abs(az - bz);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) result.push({ ...pool.splice(best, 1)[0], square: p.square });
    else result.push({ id: nextId++, ...p });
  }
  return result;
}

function PieceMesh({
  piece,
  materials,
  selected,
  onPick,
}: {
  piece: Piece3D;
  materials: ReturnType<typeof pieceMaterials>;
  selected: boolean;
  onPick: (sq: Square) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [x, z] = squarePos(piece.square);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const k = 1 - Math.exp(-dt * 12);
    const dx = x - m.position.x;
    const dz = z - m.position.z;
    const moving = Math.hypot(dx, dz) > 0.02;
    m.position.x += dx * k;
    m.position.z += dz * k;
    // Hop while travelling, lift slightly when selected.
    const targetY = moving ? Math.min(0.5, Math.hypot(dx, dz) * 0.35) : selected ? 0.18 : 0;
    m.position.y += (targetY - m.position.y) * k;
  });
  const geometry = pieceGeometry(piece.type);
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={piece.color === 'w' ? materials.white : materials.black}
      position={[x, 0, z]}
      // Knights look diagonally forward so their profile reads from the player's seat.
      rotation={[0, piece.color === 'w' ? -Math.PI / 4 : (3 * Math.PI) / 4, 0]}
      castShadow
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onPick(piece.square);
      }}
    />
  );
}

function CameraRig({ orientation }: { orientation: Color }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 11.5, orientation === 'white' ? 9.6 : -9.6), [orientation]);
  const settle = useRef(0);
  useEffect(() => {
    settle.current = 1.2;
  }, [orientation]);
  useFrame((_, dt) => {
    if (settle.current <= 0) return;
    settle.current -= dt;
    camera.position.lerp(target, 1 - Math.exp(-dt * 4));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({ fen, orientation, movable, dests, lastMove, check, onMove, onPromotion }: BoardProps & { onPromotion: (from: Square, to: Square, color: 'w' | 'b') => void }) {
  const { boardTheme, legalMoves, autoQueen } = useSettings();
  const theme = BOARD_THEMES[boardTheme];
  const materials = useMemo(() => pieceMaterials(), []);
  const [pieces, setPieces] = useState<Piece3D[]>(() => diff([], fen));
  const [selected, setSelected] = useState<Square | null>(null);

  useEffect(() => {
    setPieces((prev) => diff(prev, fen));
    setSelected(null);
  }, [fen]);

  const turn = fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const bySquare = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);
  const targets = (selected && dests?.get(selected)) || [];

  const canMove = (sq: Square) => {
    const p = bySquare.get(sq);
    if (!p || !movable || !onMove) return false;
    const color = p.color === 'w' ? 'white' : 'black';
    return (movable === 'both' || movable === color) && color === turn;
  };

  const pick = (sq: Square) => {
    if (selected && targets.includes(sq)) {
      const p = bySquare.get(selected)!;
      if (p.type === 'p' && (sq[1] === '8' || sq[1] === '1')) {
        if (autoQueen) onMove?.(selected, sq, 'q');
        else onPromotion(selected, sq, p.color);
      } else onMove?.(selected, sq);
      setSelected(null);
      return;
    }
    setSelected(canMove(sq) && sq !== selected ? sq : null);
  };

  const light = useMemo(() => new THREE.Color(theme.light), [theme.light]);
  const dark = useMemo(() => new THREE.Color(theme.dark), [theme.dark]);

  const squares: Square[] = [];
  for (let r = 1; r <= 8; r++) for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${r}` as Square);

  return (
    <>
      <CameraRig orientation={orientation} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={['#cfe9ff', '#0a0f17', 0.45]} />
      <directionalLight
        position={[5, 12, 6]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <pointLight position={[-6, 4, -6]} intensity={30} color="#8fd4ff" />
      <pointLight position={[6, 3, 6]} intensity={12} color="#e6c27e" />

      {/* Frame with a thin glowing edge */}
      <RoundedBox args={[9.1, 0.4, 9.1]} radius={0.12} position={[0, -0.21, 0]} receiveShadow>
        <meshStandardMaterial color="#0f1520" roughness={0.6} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.16, 8.16]} />
        <meshBasicMaterial color="#8fd4ff" transparent opacity={0.35} />
      </mesh>

      {squares.map((sq) => {
        const [x, z] = squarePos(sq);
        const isLight = (sq.charCodeAt(0) - 97 + Number(sq[1])) % 2 === 1;
        let color = isLight ? light : dark;
        let emissive = '#000000';
        if (lastMove && (lastMove[0] === sq || lastMove[1] === sq)) emissive = '#2b5b78';
        if (selected === sq) emissive = '#3d86b3';
        if (check === sq) emissive = '#a3162b';
        if (targets.includes(sq) && legalMoves) color = color.clone().lerp(new THREE.Color('#8fd4ff'), 0.35);
        return (
          <mesh
            key={sq}
            position={[x, 0, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              pick(sq);
            }}
          >
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color={color} emissive={emissive} roughness={0.55} metalness={0.1} />
          </mesh>
        );
      })}

      {legalMoves &&
        targets.map((sq) => {
          const [x, z] = squarePos(sq);
          return (
            <mesh key={`t-${sq}`} position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <ringGeometry args={bySquare.has(sq) ? [0.38, 0.46, 40] : [0, 0.13, 32]} />
              <meshBasicMaterial color="#0a0f17" transparent opacity={0.45} />
            </mesh>
          );
        })}

      {pieces.map((p) => (
        <PieceMesh key={p.id} piece={p} materials={materials} selected={selected === p.square} onPick={pick} />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={9}
        maxDistance={18}
        minPolarAngle={0.15}
        maxPolarAngle={1.2}
        enableDamping
        makeDefault
      />
    </>
  );
}

export default function Board3D(props: BoardProps) {
  const [promo, setPromo] = useState<{ from: Square; to: Square; color: 'w' | 'b' } | null>(null);
  return (
    <div className="board3d">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 11.5, props.orientation === 'white' ? 9.6 : -9.6], fov: 40 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#080c13']} />
        <fog attach="fog" args={['#080c13', 16, 32]} />
        <Scene {...props} onPromotion={(from, to, color) => setPromo({ from, to, color })} />
      </Canvas>
      {promo && (
        <div className="board3d-promo">
          {(['q', 'n', 'r', 'b'] as PieceSymbol[]).map((p) => (
            <button
              key={p}
              className="promo-choice"
              style={{ backgroundImage: `url("${PIECE_IMG[promo.color + p.toUpperCase()]}")` }}
              onClick={() => {
                props.onMove?.(promo.from, promo.to, p);
                setPromo(null);
              }}
              aria-label={`Promotion ${p}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
