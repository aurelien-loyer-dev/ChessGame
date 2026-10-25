import { Chess } from 'chess.js';

/** A compact opening book: ECO code, name and the defining SAN sequence. */
export const OPENINGS: { eco: string; name: string; moves: string }[] = [
  { eco: 'B00', name: 'Ouverture du pion roi', moves: 'e4' },
  { eco: 'A40', name: 'Ouverture du pion dame', moves: 'd4' },
  { eco: 'A10', name: 'Ouverture anglaise', moves: 'c4' },
  { eco: 'A04', name: 'Ouverture Réti', moves: 'Nf3' },
  { eco: 'A00', name: 'Ouverture Larsen', moves: 'b3' },
  { eco: 'A02', name: 'Ouverture Bird', moves: 'f4' },
  { eco: 'C20', name: 'Partie ouverte', moves: 'e4 e5' },
  { eco: 'C40', name: 'Ouverture du cavalier roi', moves: 'e4 e5 Nf3' },
  { eco: 'C44', name: 'Partie du roi', moves: 'e4 e5 Nf3 Nc6' },
  { eco: 'C50', name: 'Partie italienne', moves: 'e4 e5 Nf3 Nc6 Bc4' },
  { eco: 'C50', name: 'Giuoco Piano', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5' },
  { eco: 'C54', name: 'Giuoco Piano, ligne principale', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6' },
  { eco: 'C51', name: 'Gambit Evans', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4' },
  { eco: 'C55', name: 'Défense des deux cavaliers', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6' },
  { eco: 'C57', name: 'Attaque Fried Liver (préparation)', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5' },
  { eco: 'C60', name: 'Partie espagnole (Ruy Lopez)', moves: 'e4 e5 Nf3 Nc6 Bb5' },
  { eco: 'C65', name: 'Espagnole, défense berlinoise', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6' },
  { eco: 'C68', name: 'Espagnole, variante d’échange', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6' },
  { eco: 'C70', name: 'Espagnole, défense Morphy', moves: 'e4 e5 Nf3 Nc6 Bb5 a6' },
  { eco: 'C78', name: 'Espagnole, ligne principale', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O' },
  { eco: 'C45', name: 'Partie écossaise', moves: 'e4 e5 Nf3 Nc6 d4' },
  { eco: 'C46', name: 'Partie des trois cavaliers', moves: 'e4 e5 Nf3 Nc6 Nc3' },
  { eco: 'C47', name: 'Partie des quatre cavaliers', moves: 'e4 e5 Nf3 Nc6 Nc3 Nf6' },
  { eco: 'C41', name: 'Défense Philidor', moves: 'e4 e5 Nf3 d6' },
  { eco: 'C42', name: 'Défense Petrov', moves: 'e4 e5 Nf3 Nf6' },
  { eco: 'C30', name: 'Gambit du roi', moves: 'e4 e5 f4' },
  { eco: 'C33', name: 'Gambit du roi accepté', moves: 'e4 e5 f4 exf4' },
  { eco: 'C23', name: 'Partie du fou', moves: 'e4 e5 Bc4' },
  { eco: 'C25', name: 'Partie viennoise', moves: 'e4 e5 Nc3' },
  { eco: 'C21', name: 'Gambit du centre', moves: 'e4 e5 d4 exd4' },
  { eco: 'B20', name: 'Défense sicilienne', moves: 'e4 c5' },
  { eco: 'B27', name: 'Sicilienne, ligne ouverte', moves: 'e4 c5 Nf3' },
  { eco: 'B22', name: 'Sicilienne Alapin', moves: 'e4 c5 c3' },
  { eco: 'B23', name: 'Sicilienne fermée', moves: 'e4 c5 Nc3' },
  { eco: 'B21', name: 'Gambit Smith-Morra', moves: 'e4 c5 d4 cxd4 c3' },
  { eco: 'B50', name: 'Sicilienne, 2...d6', moves: 'e4 c5 Nf3 d6' },
  { eco: 'B54', name: 'Sicilienne ouverte', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4' },
  { eco: 'B90', name: 'Sicilienne Najdorf', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6' },
  { eco: 'B70', name: 'Sicilienne du Dragon', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6' },
  { eco: 'B80', name: 'Sicilienne Scheveningue', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6' },
  { eco: 'B30', name: 'Sicilienne, 2...Cc6', moves: 'e4 c5 Nf3 Nc6' },
  { eco: 'B33', name: 'Sicilienne Sveshnikov', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5' },
  { eco: 'B40', name: 'Sicilienne, 2...e6', moves: 'e4 c5 Nf3 e6' },
  { eco: 'B45', name: 'Sicilienne Taimanov', moves: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6' },
  { eco: 'C00', name: 'Défense française', moves: 'e4 e6' },
  { eco: 'C01', name: 'Française, variante d’échange', moves: 'e4 e6 d4 d5 exd5' },
  { eco: 'C02', name: 'Française, variante d’avance', moves: 'e4 e6 d4 d5 e5' },
  { eco: 'C03', name: 'Française Tarrasch', moves: 'e4 e6 d4 d5 Nd2' },
  { eco: 'C10', name: 'Française, variante Paulsen', moves: 'e4 e6 d4 d5 Nc3' },
  { eco: 'C15', name: 'Française Winawer', moves: 'e4 e6 d4 d5 Nc3 Bb4' },
  { eco: 'B10', name: 'Défense Caro-Kann', moves: 'e4 c6' },
  { eco: 'B12', name: 'Caro-Kann, variante d’avance', moves: 'e4 c6 d4 d5 e5' },
  { eco: 'B13', name: 'Caro-Kann, variante d’échange', moves: 'e4 c6 d4 d5 exd5 cxd5' },
  { eco: 'B15', name: 'Caro-Kann, ligne principale', moves: 'e4 c6 d4 d5 Nc3' },
  { eco: 'B01', name: 'Défense scandinave', moves: 'e4 d5' },
  { eco: 'B01', name: 'Scandinave, 2...Dxd5', moves: 'e4 d5 exd5 Qxd5' },
  { eco: 'B02', name: 'Défense Alekhine', moves: 'e4 Nf6' },
  { eco: 'B07', name: 'Défense Pirc', moves: 'e4 d6 d4 Nf6' },
  { eco: 'B06', name: 'Défense moderne', moves: 'e4 g6' },
  { eco: 'B00', name: 'Défense Nimzowitsch', moves: 'e4 Nc6' },
  { eco: 'D00', name: 'Partie du pion dame', moves: 'd4 d5' },
  { eco: 'D02', name: 'Système de Londres', moves: 'd4 d5 Nf3 Nf6 Bf4' },
  { eco: 'D02', name: 'Système de Londres', moves: 'd4 d5 Bf4' },
  { eco: 'A46', name: 'Système de Londres', moves: 'd4 Nf6 Bf4' },
  { eco: 'D06', name: 'Gambit dame', moves: 'd4 d5 c4' },
  { eco: 'D20', name: 'Gambit dame accepté', moves: 'd4 d5 c4 dxc4' },
  { eco: 'D30', name: 'Gambit dame refusé', moves: 'd4 d5 c4 e6' },
  { eco: 'D35', name: 'Gambit dame refusé, variante d’échange', moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5' },
  { eco: 'D10', name: 'Défense slave', moves: 'd4 d5 c4 c6' },
  { eco: 'D43', name: 'Défense semi-slave', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6' },
  { eco: 'D08', name: 'Contre-gambit Albin', moves: 'd4 d5 c4 e5' },
  { eco: 'D07', name: 'Défense Tchigorine', moves: 'd4 d5 c4 Nc6' },
  { eco: 'A45', name: 'Défense indienne', moves: 'd4 Nf6' },
  { eco: 'E00', name: 'Défense indienne, 2.c4 e6', moves: 'd4 Nf6 c4 e6' },
  { eco: 'E20', name: 'Défense nimzo-indienne', moves: 'd4 Nf6 c4 e6 Nc3 Bb4' },
  { eco: 'E12', name: 'Défense ouest-indienne', moves: 'd4 Nf6 c4 e6 Nf3 b6' },
  { eco: 'E01', name: 'Ouverture catalane', moves: 'd4 Nf6 c4 e6 g3' },
  { eco: 'E60', name: 'Défense est-indienne', moves: 'd4 Nf6 c4 g6' },
  { eco: 'E70', name: 'Est-indienne, ligne principale', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6' },
  { eco: 'D80', name: 'Défense Grünfeld', moves: 'd4 Nf6 c4 g6 Nc3 d5' },
  { eco: 'A56', name: 'Défense Benoni', moves: 'd4 Nf6 c4 c5' },
  { eco: 'A57', name: 'Gambit Benko', moves: 'd4 Nf6 c4 c5 d5 b5' },
  { eco: 'E10', name: 'Gambit Blumenfeld (préparation)', moves: 'd4 Nf6 c4 e6 Nf3 c5' },
  { eco: 'A80', name: 'Défense hollandaise', moves: 'd4 f5' },
  { eco: 'A43', name: 'Vieille Benoni', moves: 'd4 c5' },
  { eco: 'A20', name: 'Anglaise, 1...e5', moves: 'c4 e5' },
  { eco: 'A30', name: 'Anglaise symétrique', moves: 'c4 c5' },
  { eco: 'A15', name: 'Anglaise, 1...Cf6', moves: 'c4 Nf6' },
  { eco: 'A05', name: 'Réti, 1...Cf6', moves: 'Nf3 Nf6' },
  { eco: 'A06', name: 'Réti, 1...d5', moves: 'Nf3 d5' },
  { eco: 'A07', name: 'Attaque est-indienne du roi', moves: 'Nf3 d5 g3' },
];

let index: Map<string, { eco: string; name: string }> | null = null;

/** Indexes the book by position (piece placement + side to move), so transpositions are recognised. */
function buildIndex() {
  const map = new Map<string, { eco: string; name: string }>();
  for (const o of OPENINGS) {
    const chess = new Chess();
    for (const san of o.moves.split(' ')) chess.move(san);
    map.set(positionKey(chess.fen()), { eco: o.eco, name: o.name });
  }
  return map;
}

function positionKey(fen: string) {
  return fen.split(' ').slice(0, 2).join(' ');
}

/** Name of the deepest book position reached along a list of FENs (positions after each move). */
export function detectOpening(fens: string[]): { eco: string; name: string; ply: number } | null {
  index ??= buildIndex();
  let found: { eco: string; name: string; ply: number } | null = null;
  for (let i = 0; i < Math.min(fens.length, 24); i++) {
    const hit = index.get(positionKey(fens[i]));
    if (hit) found = { ...hit, ply: i + 1 };
  }
  return found;
}

export function isBookPosition(fen: string): boolean {
  index ??= buildIndex();
  return index.has(positionKey(fen));
}
