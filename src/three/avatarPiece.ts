import * as THREE from 'three';

export const AVATAR_GLYPHS = ['♔', '♕', '♖', '♗', '♘', '♙'] as const;
export const AVATAR_HUES = [200, 160, 260, 330, 20, 45] as const;

/** 3D piece type behind each avatar glyph. */
export function glyphPiece(glyph: string): 'k' | 'q' | 'r' | 'b' | 'n' | 'p' {
  return ({ '♔': 'k', '♕': 'q', '♖': 'r', '♗': 'b', '♘': 'n', '♙': 'p' } as const)[glyph as '♔'] ?? 'k';
}

/** Pearl-like material tinted by the avatar hue. */
export function avatarMaterial(hue: number) {
  const tint = new THREE.Color().setHSL(hue / 360, 0.7, 0.62);
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eef3f9').lerp(tint, 0.38),
    roughness: 0.22,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 1,
    sheenColor: tint,
    emissive: tint,
    emissiveIntensity: 0.08,
  });
}
