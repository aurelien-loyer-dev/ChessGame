import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural Staunton-style pieces built from lathe profiles, so the 3D view
 * ships without any model files. Units: one board square = 1.
 */
type Profile = [number, number][];

const SEGMENTS = 48;

function arc(cx: number, cy: number, r: number, from: number, to: number, steps = 10): Profile {
  const pts: Profile = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push([Math.max(0.0001, cx + Math.cos(a) * r), cy + Math.sin(a) * r]);
  }
  return pts;
}

/** Shared base: a stepped plinth that all pieces stand on. */
const BASE: Profile = [
  [0.0001, 0],
  [0.34, 0],
  [0.34, 0.05],
  [0.31, 0.075],
  [0.3, 0.1],
  [0.25, 0.12],
  [0.23, 0.15],
];

function lathe(profile: Profile) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, SEGMENTS).toNonIndexed();
}

function pawn() {
  return lathe([
    ...BASE,
    [0.17, 0.2],
    [0.12, 0.34],
    [0.18, 0.37],
    [0.18, 0.39],
    [0.1, 0.42],
    ...arc(0, 0.52, 0.12, -Math.PI / 2 + 0.55, Math.PI / 2, 12),
  ]);
}

function rook() {
  const body = lathe([
    ...BASE,
    [0.2, 0.2],
    [0.18, 0.5],
    [0.24, 0.54],
    [0.24, 0.66],
    [0.17, 0.66],
    [0.17, 0.6],
    [0.0001, 0.6],
  ]);
  // Battlements: four blocks cut out by leaving gaps between merlons.
  const merlons: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.BoxGeometry(0.1, 0.07, 0.07).toNonIndexed();
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    m.translate(Math.cos(a) * 0.205, 0.695, Math.sin(a) * 0.205);
    m.rotateY(0);
    merlons.push(dropUv(m));
  }
  return merge([dropUv(body), ...merlons]);
}

function bishop() {
  return lathe([
    ...BASE,
    [0.16, 0.2],
    [0.1, 0.46],
    [0.17, 0.49],
    [0.17, 0.51],
    [0.09, 0.53],
    [0.12, 0.58],
    [0.135, 0.65],
    [0.12, 0.72],
    [0.07, 0.79],
    [0.03, 0.81],
    ...arc(0, 0.85, 0.045, -Math.PI / 2, Math.PI / 2, 8),
  ]);
}

function queen() {
  return lathe([
    ...BASE,
    [0.17, 0.2],
    [0.1, 0.58],
    [0.18, 0.62],
    [0.18, 0.64],
    [0.1, 0.66],
    [0.12, 0.7],
    [0.2, 0.84],
    [0.16, 0.86],
    [0.08, 0.86],
    ...arc(0, 0.9, 0.06, -Math.PI / 2, Math.PI / 2, 8),
  ]);
}

function king() {
  const body = lathe([
    ...BASE,
    [0.18, 0.2],
    [0.11, 0.62],
    [0.19, 0.66],
    [0.19, 0.68],
    [0.11, 0.7],
    [0.13, 0.74],
    [0.18, 0.86],
    [0.0001, 0.88],
  ]);
  const v = dropUv(new THREE.BoxGeometry(0.06, 0.2, 0.06).toNonIndexed());
  v.translate(0, 0.98, 0);
  const h = dropUv(new THREE.BoxGeometry(0.16, 0.055, 0.06).toNonIndexed());
  h.translate(0, 1.0, 0);
  return merge([dropUv(body), v, h]);
}

function knight() {
  const base = lathe([...BASE, [0.2, 0.18], [0.0001, 0.2]]);
  // Horse head silhouette, extruded and centered.
  const s = new THREE.Shape();
  s.moveTo(-0.2, 0.18);
  s.lineTo(0.2, 0.18);
  s.bezierCurveTo(0.22, 0.34, 0.16, 0.46, 0.12, 0.56);
  s.bezierCurveTo(0.1, 0.64, 0.08, 0.72, 0.02, 0.78);
  s.lineTo(0.0, 0.86);
  s.lineTo(-0.05, 0.79);
  s.bezierCurveTo(-0.14, 0.76, -0.24, 0.66, -0.3, 0.55);
  s.lineTo(-0.32, 0.5);
  s.bezierCurveTo(-0.3, 0.45, -0.24, 0.44, -0.18, 0.47);
  s.bezierCurveTo(-0.12, 0.49, -0.07, 0.48, -0.05, 0.44);
  s.bezierCurveTo(-0.1, 0.36, -0.2, 0.28, -0.2, 0.18);
  const head = new THREE.ExtrudeGeometry(s, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 4,
    curveSegments: 18,
  }).toNonIndexed();
  head.translate(0, 0, -0.12);
  return merge([dropUv(base), dropUv(head)]);
}

function dropUv(g: THREE.BufferGeometry) {
  g.deleteAttribute('uv');
  return g;
}

function merge(parts: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  merged.computeVertexNormals();
  return merged;
}

const cache = new Map<string, THREE.BufferGeometry>();

export function pieceGeometry(type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k'): THREE.BufferGeometry {
  let g = cache.get(type);
  if (!g) {
    const build = { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king }[type];
    g = build();
    if (type !== 'r' && type !== 'k' && type !== 'n') dropUv(g);
    g.computeBoundingBox();
    cache.set(type, g);
  }
  return g;
}

export function pieceMaterials() {
  const white = new THREE.MeshPhysicalMaterial({
    color: '#e8edf4',
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
    sheen: 0.4,
    sheenColor: new THREE.Color('#bfe6ff'),
  });
  const black = new THREE.MeshPhysicalMaterial({
    color: '#1a212d',
    roughness: 0.32,
    metalness: 0.35,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
  });
  return { white, black };
}
