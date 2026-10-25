import wK from '../../assets/pieces/wK.svg';
import wQ from '../../assets/pieces/wQ.svg';
import wR from '../../assets/pieces/wR.svg';
import wB from '../../assets/pieces/wB.svg';
import wN from '../../assets/pieces/wN.svg';
import wP from '../../assets/pieces/wP.svg';
import bK from '../../assets/pieces/bK.svg';
import bQ from '../../assets/pieces/bQ.svg';
import bR from '../../assets/pieces/bR.svg';
import bB from '../../assets/pieces/bB.svg';
import bN from '../../assets/pieces/bN.svg';
import bP from '../../assets/pieces/bP.svg';

/** Piece artwork: "cburnett" set by Colin M.L. Burnett (BSD/GPL/GFDL). */
export const PIECE_IMG: Record<string, string> = { wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP };

/** 'wN' style code for a FEN letter. */
export function codeOf(letter: string): string {
  return (letter === letter.toUpperCase() ? 'w' : 'b') + letter.toUpperCase();
}
