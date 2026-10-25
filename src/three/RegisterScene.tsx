import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pieceGeometry } from './pieces3d';
import { avatarMaterial, glyphPiece } from './avatarPiece';

/** The chosen avatar as a slowly turning 3D piece on a glowing plinth; updates live while the form changes. */
function Showcase({ glyph, hue }: { glyph: string; hue: number }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const material = useMemo(() => avatarMaterial(hue), [hue]);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.8, 0.65), transparent: true, opacity: 0.6 }), [hue]);
  const pop = useRef(0);
  useEffect(() => {
    pop.current = 1;
  }, [glyph, hue]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.5;
    g.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.06;
    pop.current = Math.max(0, pop.current - dt * 2.5);
    const s = 1.6 + Math.sin(pop.current * Math.PI) * 0.25;
    g.scale.setScalar(s);
    if (ring.current) {
      ring.current.rotation.z += dt * 0.4;
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
    }
  });

  return (
    <>
      <group ref={group}>
        <mesh geometry={pieceGeometry(glyphPiece(glyph))} material={material} castShadow />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[1.3, 64]} />
        <meshStandardMaterial color="#0f1622" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={ringMat}>
        <ringGeometry args={[1.32, 1.36, 96]} />
      </mesh>
    </>
  );
}

function Dust() {
  const points = useMemo(() => {
    const n = 300;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 2 + Math.random() * 5;
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, Math.random() * 4 - 0.5, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y -= dt * 0.03;
  });
  return (
    <points ref={ref} geometry={points}>
      <pointsMaterial size={0.03} color="#8fd4ff" transparent opacity={0.55} />
    </points>
  );
}

export default function RegisterScene({ glyph, hue }: { glyph: string; hue: number }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.6, 4.4], fov: 38 }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0.7, 0)}>
      <fog attach="fog" args={['#080c13', 5, 12]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 4]} intensity={2} castShadow />
      <pointLight position={[-3, 2, -2]} intensity={18} color="#8fd4ff" />
      <pointLight position={[2.5, 1, 2.5]} intensity={8} color="#e6c27e" />
      <Showcase glyph={glyph} hue={hue} />
      <Dust />
    </Canvas>
  );
}
