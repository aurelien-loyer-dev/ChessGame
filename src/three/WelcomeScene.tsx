import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pieceGeometry, pieceMaterials } from './pieces3d';
import { avatarMaterial, glyphPiece } from './avatarPiece';

/**
 * Sign-up celebration: the board assembles tile by tile, the pieces drop into
 * their starting squares, then the player's avatar lands in the middle with a
 * shockwave and a burst of sparks while the camera swoops down.
 */
const BACK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'] as const;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const bounce = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x - 1.5 / d) ** 2 + 0.75;
  if (x < 2.5 / d) return n * (x - 2.25 / d) ** 2 + 0.9375;
  return n * (x - 2.625 / d) ** 2 + 0.984375;
};

function Board() {
  const tiles = useRef<THREE.Mesh[]>([]);
  const light = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a9b6c6', roughness: 0.5, metalness: 0.15 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3e4c60', roughness: 0.5, metalness: 0.2 }), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    tiles.current.forEach((m, i) => {
      if (!m) return;
      const x = i % 8;
      const z = Math.floor(i / 8);
      // Ripple outward from the centre.
      const delay = Math.hypot(x - 3.5, z - 3.5) * 0.09;
      const k = ease((t - delay) / 0.6);
      m.position.y = -3 + k * 3 - 0.06;
      m.scale.setScalar(0.4 + k * 0.6);
    });
  });
  return (
    <>
      {Array.from({ length: 64 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) tiles.current[i] = el;
          }}
          position={[(i % 8) - 3.5, -3, Math.floor(i / 8) - 3.5]}
          material={((i % 8) + Math.floor(i / 8)) % 2 === 0 ? light : dark}
          receiveShadow
        >
          <boxGeometry args={[0.98, 0.12, 0.98]} />
        </mesh>
      ))}
    </>
  );
}

function Army() {
  const mats = useMemo(() => pieceMaterials(), []);
  const refs = useRef<THREE.Mesh[]>([]);
  const pieces = useMemo(() => {
    const out: { type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k'; color: 'w' | 'b'; x: number; z: number; delay: number }[] = [];
    for (let f = 0; f < 8; f++) {
      out.push({ type: BACK[f], color: 'w', x: f - 3.5, z: 3.5, delay: 1 + f * 0.05 });
      out.push({ type: 'p', color: 'w', x: f - 3.5, z: 2.5, delay: 1.2 + f * 0.04 });
      out.push({ type: BACK[f], color: 'b', x: f - 3.5, z: -3.5, delay: 1 + (7 - f) * 0.05 });
      out.push({ type: 'p', color: 'b', x: f - 3.5, z: -2.5, delay: 1.2 + (7 - f) * 0.04 });
    }
    return out;
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = pieces[i];
      const k = bounce((t - p.delay) / 0.7);
      m.position.y = 6 * (1 - k);
      m.visible = t > p.delay - 0.05;
    });
  });
  return (
    <>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) refs.current[i] = el;
          }}
          geometry={pieceGeometry(p.type)}
          material={p.color === 'w' ? mats.white : mats.black}
          position={[p.x, 6, p.z]}
          rotation={[0, p.color === 'w' ? -Math.PI / 4 : (3 * Math.PI) / 4, 0]}
          scale={0.8}
          castShadow
          visible={false}
        />
      ))}
    </>
  );
}

function Hero({ glyph, hue }: { glyph: string; hue: number }) {
  const piece = useRef<THREE.Mesh>(null);
  const wave = useRef<THREE.Mesh>(null);
  const sparks = useRef<THREE.Points>(null);
  const material = useMemo(() => avatarMaterial(hue), [hue]);
  const waveMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.85, 0.65), transparent: true, opacity: 0, side: THREE.DoubleSide }), [hue]);
  const LAND = 2.3;

  const spark = useMemo(() => {
    const n = 420;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const a = new THREE.Color().setHSL(hue / 360, 0.85, 0.65);
    const b = new THREE.Color('#e6c27e');
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const up = 2 + Math.random() * 5;
      const sp = 1.5 + Math.random() * 3.5;
      vel.set([Math.cos(th) * sp, up, Math.sin(th) * sp], i * 3);
      const c = Math.random() < 0.6 ? a : b;
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { g, vel, n };
  }, [hue]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const m = piece.current;
    if (m) {
      const k = bounce((t - LAND + 0.8) / 0.8);
      m.position.y = 0.2 + 8 * (1 - k);
      m.visible = t > LAND - 0.85;
      m.rotation.y = t * 0.6;
      const glow = Math.max(0, 1 - Math.abs(t - LAND) * 2);
      material.emissiveIntensity = 0.08 + glow * 0.6;
    }
    const w = wave.current;
    if (w) {
      const k = (t - LAND) / 1.1;
      w.visible = k > 0 && k < 1;
      w.scale.setScalar(0.3 + ease(k) * 7);
      waveMat.opacity = 0.7 * (1 - k);
    }
    const s = sparks.current;
    if (s) {
      const dt = t - LAND;
      s.visible = dt > 0 && dt < 3.5;
      if (s.visible) {
        const pos = spark.g.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < spark.n; i++) {
          pos.setXYZ(
            i,
            spark.vel[i * 3] * dt,
            0.8 + spark.vel[i * 3 + 1] * dt - 4.9 * dt * dt * 0.6,
            spark.vel[i * 3 + 2] * dt,
          );
        }
        pos.needsUpdate = true;
        (s.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - dt / 3.5);
      }
    }
  });

  return (
    <>
      {/* Raised pedestal in the middle of the board */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.7, 0.8, 0.22, 64]} />
        <meshStandardMaterial color="#121a27" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh ref={piece} geometry={pieceGeometry(glyphPiece(glyph))} material={material} scale={2.2} castShadow visible={false} />
      <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} material={waveMat} visible={false}>
        <ringGeometry args={[0.9, 1, 96]} />
      </mesh>
      <points ref={sparks} geometry={spark.g} visible={false}>
        <pointsMaterial size={0.07} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </>
  );
}

function CameraSwoop() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = ease(t / 3.2);
    const angle = -0.9 + k * 1.2 + Math.max(0, t - 3.2) * 0.08;
    const radius = 15 - k * 5;
    const height = 13 - k * 7;
    state.camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    // Aim below the centre so the board sits in the upper part, leaving room for the text.
    state.camera.lookAt(0, -1.6, 1);
  });
  return null;
}

export default function WelcomeScene({ glyph, hue }: { glyph: string; hue: number }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 13, 15], fov: 40 }} gl={{ antialias: true, alpha: true }}>
      <fog attach="fog" args={['#080c13', 12, 28]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={['#cfe9ff', '#0a0f17', 0.4]} />
      <directionalLight position={[5, 12, 6]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <pointLight position={[-6, 4, -6]} intensity={30} color="#8fd4ff" />
      <pointLight position={[6, 3, 6]} intensity={14} color="#e6c27e" />
      <CameraSwoop />
      <Board />
      <Army />
      <Hero glyph={glyph} hue={hue} />
    </Canvas>
  );
}
