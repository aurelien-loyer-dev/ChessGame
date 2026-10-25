import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pieceGeometry, pieceMaterials } from './pieces3d';

const LAYOUT: { type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k'; color: 'w' | 'b'; x: number; z: number }[] = [
  { type: 'k', color: 'w', x: 0, z: 0 },
  { type: 'q', color: 'b', x: 1, z: -1 },
  { type: 'n', color: 'w', x: -1, z: 1 },
  { type: 'p', color: 'b', x: 2, z: 1 },
  { type: 'b', color: 'b', x: -2, z: -1 },
  { type: 'r', color: 'w', x: 2, z: -2 },
  { type: 'p', color: 'w', x: -1, z: -2 },
];

function Pieces() {
  const group = useRef<THREE.Group>(null);
  const materials = useMemo(() => pieceMaterials(), []);
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    pointer.current.x += (state.pointer.x - pointer.current.x) * Math.min(1, dt * 2);
    pointer.current.y += (state.pointer.y - pointer.current.y) * Math.min(1, dt * 2);
    g.rotation.y += dt * 0.08;
    g.rotation.x = -pointer.current.y * 0.08;
    g.position.x = pointer.current.x * 0.25;
    g.children.forEach((child, i) => {
      if (child.userData.float) child.position.y = Math.sin(state.clock.elapsedTime * 0.8 + i) * 0.06 + 0.06;
    });
  });

  return (
    <group ref={group}>
      {/* A 5x5 board fragment that fades into the dark */}
      {Array.from({ length: 25 }, (_, i) => {
        const x = (i % 5) - 2;
        const z = Math.floor(i / 5) - 2;
        const light = (x + z) % 2 === 0;
        const fade = 1 - Math.min(1, Math.hypot(x, z) / 3.4);
        return (
          <mesh key={i} position={[x, -0.05, z]} receiveShadow>
            <boxGeometry args={[0.98, 0.1, 0.98]} />
            <meshStandardMaterial
              color={light ? '#a9b6c6' : '#3e4c60'}
              roughness={0.5}
              metalness={0.2}
              transparent
              opacity={0.25 + fade * 0.75}
            />
          </mesh>
        );
      })}
      {LAYOUT.map((p, i) => (
        <mesh
          key={i}
          geometry={pieceGeometry(p.type)}
          material={p.color === 'w' ? materials.white : materials.black}
          position={[p.x, 0, p.z]}
          rotation={[0, p.color === 'w' ? -Math.PI / 4 : (3 * Math.PI) / 4, 0]}
          scale={p.type === 'k' ? 1.35 : 1}
          castShadow
          userData={{ float: p.type === 'k' }}
        />
      ))}
    </group>
  );
}

export default function Hero3D() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [4.6, 3.4, 5.2], fov: 38 }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}>
      <fog attach="fog" args={['#080c13', 6, 14]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 8, 3]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 2.5, -3]} intensity={26} color="#8fd4ff" />
      <pointLight position={[3, 1.5, 4]} intensity={10} color="#e6c27e" />
      <group position={[0, -0.6, 0]}>
        <Pieces />
      </group>
    </Canvas>
  );
}
