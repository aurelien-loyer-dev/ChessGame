export const PIECE_VALUES_DISPLAY = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
export const PIECE_ORDER = ['Q', 'R', 'B', 'N', 'P'];

export function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function computeCaptured(moveHistory) {
  const capturedByWhite = [];
  const capturedByBlack = [];
  for (const m of moveHistory) {
    if (m.captured) {
      if (m.color === 'white') capturedByWhite.push(m.captured);
      else capturedByBlack.push(m.captured);
    }
  }
  return { capturedByWhite, capturedByBlack };
}

export function computeCheckState(engine) {
  if (!engine.isInCheck(engine.turn)) return { kingInCheck: null, checkAttackers: [] };
  const king = engine.getKingPosition(engine.turn);
  const checkAttackers = engine.getCheckAttackers(engine.turn);
  return { kingInCheck: king, checkAttackers };
}

export function computeGameOverData(engine, variant, myColor) {
  const { result, winner } = engine;
  const isWinner = winner === myColor;
  const selfMode = variant === 'self';

  switch (result) {
    case 'checkmate':
      if (selfMode) return { icon: '♛', title: 'Échec et mat', message: winner === 'white' ? 'Victoire des blancs.' : 'Victoire des noirs.' };
      return {
        icon: isWinner ? '🏆' : '💀',
        title: isWinner ? 'Victoire !' : 'Défaite',
        message: isWinner
          ? (variant === 'ai' ? "Échec et mat contre l'IA !" : 'Échec et mat !')
          : (variant === 'ai' ? "L'IA vous a maté." : 'Vous êtes maté.'),
      };
    case 'stalemate': return { icon: '🤝', title: 'Pat', message: 'Match nul.' };
    case 'draw': return { icon: '🤝', title: 'Nulle', message: 'Matériel insuffisant.' };
    case 'resign':
      return { icon: '🏳', title: 'Abandon', message: 'Vous avez abandonné.' };
    case 'disconnect':
      if (isWinner) return { icon: '🔌', title: 'Victoire', message: 'Déconnexion adverse.' };
      return { icon: '🔌', title: 'Déconnexion', message: 'Connexion perdue.' };
    case 'timeout':
      if (selfMode) return { icon: '⏱', title: 'Temps écoulé', message: winner === 'white' ? 'Les noirs perdent au temps.' : 'Les blancs perdent au temps.' };
      return {
        icon: isWinner ? '🏆' : '⏱',
        title: isWinner ? 'Victoire !' : 'Temps écoulé',
        message: isWinner ? 'Temps adverse écoulé !' : 'Votre temps est écoulé.',
      };
    default: return { icon: '🏁', title: 'Partie terminée', message: '' };
  }
}

export function generateGuestName() {
  const adjs = ['Grand', 'Royal', 'Speedy', 'Silent', 'Golden', 'Silver', 'Iron', 'Mystic'];
  const nouns = ['King', 'Rook', 'Knight', 'Pawn', 'Master', 'Legend', 'Ghost', 'Wolf'];
  return adjs[Math.floor(Math.random() * adjs.length)] + nouns[Math.floor(Math.random() * nouns.length)];
}
