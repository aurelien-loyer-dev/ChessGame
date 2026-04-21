/**
 * chess.js - Moteur d'échecs complet côté client
 * Gère toutes les règles, les coups légaux, et la détection d'échec/mat/pat.
 */

const PIECE_SYMBOLS = {
    'K': { white: '♔', black: '♚' },
    'Q': { white: '♕', black: '♛' },
    'R': { white: '♖', black: '♜' },
    'B': { white: '♗', black: '♝' },
    'N': { white: '♘', black: '♞' },
    'P': { white: '♙', black: '♟' },
};

const PIECE_NAMES = { 'K': 'Roi', 'Q': 'Dame', 'R': 'Tour', 'B': 'Fou', 'N': 'Cavalier', 'P': 'Pion' };
const PIECE_LETTERS = { 'K': 'R', 'Q': 'D', 'R': 'T', 'B': 'F', 'N': 'C', 'P': '' };

class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        // board[row][col] - row 0 = rang 8 (haut, noirs), row 7 = rang 1 (bas, blancs)
        this.board = this._initialBoard();
        this.turn = 'white';
        this.castlingRights = { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } };
        this.enPassantTarget = null; // {row, col}
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.moveHistory = [];
        this.lastMove = null;
        this.gameOver = false;
        this.result = null; // 'checkmate', 'stalemate', 'draw', 'resign'
        this.winner = null;
    }

    _initialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
        for (let c = 0; c < 8; c++) {
            board[0][c] = { type: backRank[c], color: 'black' };
            board[1][c] = { type: 'P', color: 'black' };
            board[6][c] = { type: 'P', color: 'white' };
            board[7][c] = { type: backRank[c], color: 'white' };
        }
        return board;
    }

    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row][col];
    }

    _opponent(color) {
        return color === 'white' ? 'black' : 'white';
    }

    /**
     * Trouve la position du roi de la couleur donnée.
     */
    _findKing(color, board) {
        board = board || this.board;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p && p.type === 'K' && p.color === color) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    /**
     * Vérifie si une case est attaquée par la couleur donnée.
     */
    _isSquareAttacked(row, col, byColor, board) {
        board = board || this.board;
        const opp = byColor;

        // Cavalier
        const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of knightMoves) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const p = board[r][c];
                if (p && p.color === opp && p.type === 'N') return true;
            }
        }

        // Roi (adjacent)
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    const p = board[r][c];
                    if (p && p.color === opp && p.type === 'K') return true;
                }
            }
        }

        // Pion
        const pawnDir = opp === 'white' ? 1 : -1; // direction d'attaque du pion adverse
        for (const dc of [-1, 1]) {
            const r = row + pawnDir, c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const p = board[r][c];
                if (p && p.color === opp && p.type === 'P') return true;
            }
        }

        // Lignes droites (Tour, Dame)
        const straightDirs = [[0,1],[0,-1],[1,0],[-1,0]];
        for (const [dr, dc] of straightDirs) {
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const p = board[r][c];
                if (p) {
                    if (p.color === opp && (p.type === 'R' || p.type === 'Q')) return true;
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        // Diagonales (Fou, Dame)
        const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
        for (const [dr, dc] of diagDirs) {
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const p = board[r][c];
                if (p) {
                    if (p.color === opp && (p.type === 'B' || p.type === 'Q')) return true;
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        return false;
    }

    /**
     * Vérifie si le roi de la couleur est en échec.
     */
    isInCheck(color, board) {
        board = board || this.board;
        const king = this._findKing(color, board);
        if (!king) return false;
        return this._isSquareAttacked(king.row, king.col, this._opponent(color), board);
    }

    /**
     * Clone le plateau.
     */
    _cloneBoard() {
        return this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    /**
     * Teste si un coup laisse le roi en échec.
     */
    _wouldBeInCheck(from, to, color) {
        const testBoard = this._cloneBoard();
        const piece = testBoard[from.row][from.col];

        // En passant
        if (piece.type === 'P' && this.enPassantTarget &&
            to.row === this.enPassantTarget.row && to.col === this.enPassantTarget.col) {
            const capturedRow = from.row;
            testBoard[capturedRow][to.col] = null;
        }

        // Roque : déplacer aussi la tour
        if (piece.type === 'K' && Math.abs(to.col - from.col) === 2) {
            if (to.col === 6) { // petit roque
                testBoard[from.row][5] = testBoard[from.row][7];
                testBoard[from.row][7] = null;
            } else if (to.col === 2) { // grand roque
                testBoard[from.row][3] = testBoard[from.row][0];
                testBoard[from.row][0] = null;
            }
        }

        testBoard[to.row][to.col] = piece;
        testBoard[from.row][from.col] = null;

        const king = piece.type === 'K' ? to : this._findKing(color, testBoard);
        if (!king) return false;
        return this._isSquareAttacked(king.row, king.col, this._opponent(color), testBoard);
    }

    /**
     * Retourne tous les coups pseudo-légaux pour une pièce à la position donnée.
     */
    _pseudoLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const moves = [];
        const color = piece.color;
        const opp = this._opponent(color);

        const addMove = (tr, tc, extra = {}) => {
            if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                const target = this.board[tr][tc];
                if (!target || target.color !== color) {
                    moves.push({ from: { row, col }, to: { row: tr, col: tc }, ...extra });
                }
            }
        };

        switch (piece.type) {
            case 'P': {
                const dir = color === 'white' ? -1 : 1;
                const startRow = color === 'white' ? 6 : 1;
                const promoRow = color === 'white' ? 0 : 7;

                // Avancer d'une case
                if (!this.board[row + dir]?.[col]) {
                    if (row + dir === promoRow) {
                        for (const promo of ['Q', 'R', 'B', 'N']) {
                            moves.push({ from: { row, col }, to: { row: row + dir, col }, promotion: promo });
                        }
                    } else {
                        moves.push({ from: { row, col }, to: { row: row + dir, col } });
                    }

                    // Avancer de deux cases
                    if (row === startRow && !this.board[row + 2 * dir]?.[col]) {
                        moves.push({ from: { row, col }, to: { row: row + 2 * dir, col } });
                    }
                }

                // Captures diagonales
                for (const dc of [-1, 1]) {
                    const tr = row + dir, tc = col + dc;
                    if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                        const target = this.board[tr][tc];
                        if (target && target.color === opp) {
                            if (tr === promoRow) {
                                for (const promo of ['Q', 'R', 'B', 'N']) {
                                    moves.push({ from: { row, col }, to: { row: tr, col: tc }, promotion: promo });
                                }
                            } else {
                                moves.push({ from: { row, col }, to: { row: tr, col: tc }, isCapture: true });
                            }
                        }
                        // En passant
                        if (this.enPassantTarget && tr === this.enPassantTarget.row && tc === this.enPassantTarget.col) {
                            moves.push({ from: { row, col }, to: { row: tr, col: tc }, isEnPassant: true });
                        }
                    }
                }
                break;
            }

            case 'N': {
                const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
                for (const [dr, dc] of knightMoves) {
                    addMove(row + dr, col + dc);
                }
                break;
            }

            case 'B': {
                for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        const target = this.board[r][c];
                        if (target) {
                            if (target.color !== color) moves.push({ from: { row, col }, to: { row: r, col: c }, isCapture: true });
                            break;
                        }
                        moves.push({ from: { row, col }, to: { row: r, col: c } });
                        r += dr;
                        c += dc;
                    }
                }
                break;
            }

            case 'R': {
                for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        const target = this.board[r][c];
                        if (target) {
                            if (target.color !== color) moves.push({ from: { row, col }, to: { row: r, col: c }, isCapture: true });
                            break;
                        }
                        moves.push({ from: { row, col }, to: { row: r, col: c } });
                        r += dr;
                        c += dc;
                    }
                }
                break;
            }

            case 'Q': {
                for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
                    let r = row + dr, c = col + dc;
                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        const target = this.board[r][c];
                        if (target) {
                            if (target.color !== color) moves.push({ from: { row, col }, to: { row: r, col: c }, isCapture: true });
                            break;
                        }
                        moves.push({ from: { row, col }, to: { row: r, col: c } });
                        r += dr;
                        c += dc;
                    }
                }
                break;
            }

            case 'K': {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        addMove(row + dr, col + dc);
                    }
                }

                // Roque
                const rights = this.castlingRights[color];
                const homeRow = color === 'white' ? 7 : 0;
                if (row === homeRow && col === 4 && !this.isInCheck(color)) {
                    // Petit roque
                    if (rights.kingSide &&
                        !this.board[homeRow][5] && !this.board[homeRow][6] &&
                        this.board[homeRow][7]?.type === 'R' && this.board[homeRow][7]?.color === color &&
                        !this._isSquareAttacked(homeRow, 5, opp) &&
                        !this._isSquareAttacked(homeRow, 6, opp)) {
                        moves.push({ from: { row, col }, to: { row: homeRow, col: 6 }, isCastling: 'kingSide' });
                    }
                    // Grand roque
                    if (rights.queenSide &&
                        !this.board[homeRow][1] && !this.board[homeRow][2] && !this.board[homeRow][3] &&
                        this.board[homeRow][0]?.type === 'R' && this.board[homeRow][0]?.color === color &&
                        !this._isSquareAttacked(homeRow, 2, opp) &&
                        !this._isSquareAttacked(homeRow, 3, opp)) {
                        moves.push({ from: { row, col }, to: { row: homeRow, col: 2 }, isCastling: 'queenSide' });
                    }
                }
                break;
            }
        }

        return moves;
    }

    /**
     * Retourne les coups légaux pour une case.
     */
    getLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece || piece.color !== this.turn) return [];

        return this._pseudoLegalMoves(row, col).filter(move =>
            !this._wouldBeInCheck(move.from, move.to, piece.color)
        );
    }

    /**
     * Retourne tous les coups légaux pour le joueur courant.
     */
    getAllLegalMoves() {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === this.turn) {
                    moves.push(...this.getLegalMoves(r, c));
                }
            }
        }
        return moves;
    }

    /**
     * Joue un coup. Retourne true si le coup est valide.
     */
    makeMove(from, to, promotion) {
        if (this.gameOver) return false;

        const piece = this.board[from.row][from.col];
        if (!piece || piece.color !== this.turn) return false;

        // Trouver le coup dans les coups légaux
        const legalMoves = this.getLegalMoves(from.row, from.col);
        let move = legalMoves.find(m =>
            m.to.row === to.row && m.to.col === to.col &&
            (!m.promotion || m.promotion === promotion)
        );

        if (!move) return false;

        // Sauvegarder pour l'historique
        const captured = this.board[to.row][to.col];
        const moveRecord = {
            from: { ...from },
            to: { ...to },
            piece: piece.type,
            color: piece.color,
            captured: captured?.type || null,
            promotion: move.promotion || null,
            isEnPassant: !!move.isEnPassant,
            isCastling: move.isCastling || null,
        };

        // En passant capture
        if (move.isEnPassant) {
            moveRecord.captured = 'P';
            this.board[from.row][to.col] = null;
        }

        // Roque
        if (move.isCastling) {
            const row = from.row;
            if (move.isCastling === 'kingSide') {
                this.board[row][5] = this.board[row][7];
                this.board[row][7] = null;
            } else {
                this.board[row][3] = this.board[row][0];
                this.board[row][0] = null;
            }
        }

        // Déplacer la pièce
        this.board[to.row][to.col] = piece;
        this.board[from.row][from.col] = null;

        // Promotion
        if (move.promotion) {
            this.board[to.row][to.col] = { type: move.promotion, color: piece.color };
        }

        // Mettre à jour en passant
        this.enPassantTarget = null;
        if (piece.type === 'P' && Math.abs(to.row - from.row) === 2) {
            this.enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
        }

        // Mettre à jour les droits de roque
        if (piece.type === 'K') {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        if (piece.type === 'R') {
            if (from.row === 7 && from.col === 0) this.castlingRights.white.queenSide = false;
            if (from.row === 7 && from.col === 7) this.castlingRights.white.kingSide = false;
            if (from.row === 0 && from.col === 0) this.castlingRights.black.queenSide = false;
            if (from.row === 0 && from.col === 7) this.castlingRights.black.kingSide = false;
        }
        // Si une tour est capturée
        if (to.row === 7 && to.col === 0) this.castlingRights.white.queenSide = false;
        if (to.row === 7 && to.col === 7) this.castlingRights.white.kingSide = false;
        if (to.row === 0 && to.col === 0) this.castlingRights.black.queenSide = false;
        if (to.row === 0 && to.col === 7) this.castlingRights.black.kingSide = false;

        // Notation
        moveRecord.notation = this._buildNotation(moveRecord);

        this.lastMove = moveRecord;
        this.moveHistory.push(moveRecord);

        // Changer de tour
        this.turn = this._opponent(this.turn);
        if (this.turn === 'white') this.fullMoveNumber++;

        // Vérifier l'état du jeu
        this._checkGameState();

        // Ajouter check/checkmate à la notation
        if (this.gameOver && this.result === 'checkmate') {
            moveRecord.notation += '#';
        } else if (this.isInCheck(this.turn)) {
            moveRecord.notation += '+';
        }

        return true;
    }

    /**
     * Applique un coup reçu du réseau (sans vérification de tour).
     */
    applyNetworkMove(from, to, promotion) {
        // Temporairement permettre le coup
        const piece = this.board[from.row][from.col];
        if (!piece) return false;

        // Forcer le tour pour que makeMove accepte
        const savedTurn = this.turn;
        this.turn = piece.color;
        const result = this.makeMove(from, to, promotion);
        if (!result) {
            this.turn = savedTurn;
        }
        return result;
    }

    _buildNotation(move) {
        if (move.isCastling === 'kingSide') return 'O-O';
        if (move.isCastling === 'queenSide') return 'O-O-O';

        const files = 'abcdefgh';
        const ranks = '87654321';
        let notation = '';

        if (move.piece !== 'P') {
            notation += PIECE_LETTERS[move.piece] || move.piece;
        }

        // Pion avec capture : inclure la colonne d'origine
        if (move.piece === 'P' && (move.captured || move.isEnPassant)) {
            notation += files[move.from.col];
        }

        if (move.captured || move.isEnPassant) {
            notation += 'x';
        }

        notation += files[move.to.col] + ranks[move.to.row];

        if (move.promotion) {
            notation += '=' + (PIECE_LETTERS[move.promotion] || move.promotion);
        }

        return notation;
    }

    _checkGameState() {
        const allMoves = this.getAllLegalMoves();
        if (allMoves.length === 0) {
            this.gameOver = true;
            if (this.isInCheck(this.turn)) {
                this.result = 'checkmate';
                this.winner = this._opponent(this.turn);
            } else {
                this.result = 'stalemate';
                this.winner = null;
            }
        }
        // Matériel insuffisant
        else if (this._isInsufficientMaterial()) {
            this.gameOver = true;
            this.result = 'draw';
            this.winner = null;
        }
    }

    _isInsufficientMaterial() {
        const pieces = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c]) {
                    pieces.push(this.board[r][c]);
                }
            }
        }
        // Roi vs Roi
        if (pieces.length === 2) return true;
        // Roi + pièce mineure vs Roi
        if (pieces.length === 3) {
            const minor = pieces.find(p => p.type === 'B' || p.type === 'N');
            if (minor) return true;
        }
        return false;
    }

    _pieceAttacksSquare(fromRow, fromCol, targetRow, targetCol, board) {
        board = board || this.board;
        const piece = board[fromRow][fromCol];
        if (!piece) return false;

        const dr = targetRow - fromRow;
        const dc = targetCol - fromCol;
        const adr = Math.abs(dr);
        const adc = Math.abs(dc);

        switch (piece.type) {
            case 'N':
                return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
            case 'K':
                return adr <= 1 && adc <= 1 && (adr + adc > 0);
            case 'P': {
                const pawnDir = piece.color === 'white' ? -1 : 1;
                return dr === pawnDir && adc === 1;
            }
            case 'B':
            case 'R':
            case 'Q': {
                const isDiag = adr === adc && adr !== 0;
                const isStraight = (dr === 0 && adc !== 0) || (dc === 0 && adr !== 0);
                if (piece.type === 'B' && !isDiag) return false;
                if (piece.type === 'R' && !isStraight) return false;
                if (piece.type === 'Q' && !(isDiag || isStraight)) return false;

                const stepR = dr === 0 ? 0 : dr / adr;
                const stepC = dc === 0 ? 0 : dc / adc;
                let r = fromRow + stepR;
                let c = fromCol + stepC;
                while (r !== targetRow || c !== targetCol) {
                    if (board[r][c]) return false;
                    r += stepR;
                    c += stepC;
                }
                return true;
            }
            default:
                return false;
        }
    }

    getCheckAttackers(color) {
        const king = this._findKing(color);
        if (!king) return [];
        const attackers = [];
        const opp = this._opponent(color);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (!p || p.color !== opp) continue;
                if (this._pieceAttacksSquare(r, c, king.row, king.col)) {
                    attackers.push({ row: r, col: c });
                }
            }
        }
        return attackers;
    }

    getKingPosition(color) {
        return this._findKing(color);
    }

    /**
     * Convertit la position courante en notation FEN.
     */
    toFEN() {
        const pieceChar = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P' };
        let fen = '';

        // 1. Pièces
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (!p) {
                    empty++;
                } else {
                    if (empty > 0) { fen += empty; empty = 0; }
                    const ch = pieceChar[p.type];
                    fen += p.color === 'white' ? ch : ch.toLowerCase();
                }
            }
            if (empty > 0) fen += empty;
            if (r < 7) fen += '/';
        }

        // 2. Trait
        fen += ' ' + (this.turn === 'white' ? 'w' : 'b');

        // 3. Droits de roque
        let castling = '';
        if (this.castlingRights.white.kingSide) castling += 'K';
        if (this.castlingRights.white.queenSide) castling += 'Q';
        if (this.castlingRights.black.kingSide) castling += 'k';
        if (this.castlingRights.black.queenSide) castling += 'q';
        fen += ' ' + (castling || '-');

        // 4. En passant
        if (this.enPassantTarget) {
            const files = 'abcdefgh';
            const ranks = '87654321';
            fen += ' ' + files[this.enPassantTarget.col] + ranks[this.enPassantTarget.row];
        } else {
            fen += ' -';
        }

        // 5. Demi-coups / coups complets
        fen += ' ' + this.halfMoveClock + ' ' + this.fullMoveNumber;

        return fen;
    }
}
