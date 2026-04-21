#include "AIPlayer.hpp"
#include <algorithm>
#include <limits>
#include <cmath>

namespace Chess {

// Tables de bonus de position (du point de vue des blancs, row 0 = rang 8)
const int AIPlayer::PAWN_TABLE[8][8] = {
    {  0,  0,  0,  0,  0,  0,  0,  0 },
    { 50, 50, 50, 50, 50, 50, 50, 50 },
    { 10, 10, 20, 30, 30, 20, 10, 10 },
    {  5,  5, 10, 25, 25, 10,  5,  5 },
    {  0,  0,  0, 20, 20,  0,  0,  0 },
    {  5, -5,-10,  0,  0,-10, -5,  5 },
    {  5, 10, 10,-20,-20, 10, 10,  5 },
    {  0,  0,  0,  0,  0,  0,  0,  0 }
};

const int AIPlayer::KNIGHT_TABLE[8][8] = {
    {-50,-40,-30,-30,-30,-30,-40,-50 },
    {-40,-20,  0,  0,  0,  0,-20,-40 },
    {-30,  0, 10, 15, 15, 10,  0,-30 },
    {-30,  5, 15, 20, 20, 15,  5,-30 },
    {-30,  0, 15, 20, 20, 15,  0,-30 },
    {-30,  5, 10, 15, 15, 10,  5,-30 },
    {-40,-20,  0,  5,  5,  0,-20,-40 },
    {-50,-40,-30,-30,-30,-30,-40,-50 }
};

const int AIPlayer::BISHOP_TABLE[8][8] = {
    {-20,-10,-10,-10,-10,-10,-10,-20 },
    {-10,  0,  0,  0,  0,  0,  0,-10 },
    {-10,  0,  5, 10, 10,  5,  0,-10 },
    {-10,  5,  5, 10, 10,  5,  5,-10 },
    {-10,  0, 10, 10, 10, 10,  0,-10 },
    {-10, 10, 10, 10, 10, 10, 10,-10 },
    {-10,  5,  0,  0,  0,  0,  5,-10 },
    {-20,-10,-10,-10,-10,-10,-10,-20 }
};

const int AIPlayer::ROOK_TABLE[8][8] = {
    {  0,  0,  0,  0,  0,  0,  0,  0 },
    {  5, 10, 10, 10, 10, 10, 10,  5 },
    { -5,  0,  0,  0,  0,  0,  0, -5 },
    { -5,  0,  0,  0,  0,  0,  0, -5 },
    { -5,  0,  0,  0,  0,  0,  0, -5 },
    { -5,  0,  0,  0,  0,  0,  0, -5 },
    { -5,  0,  0,  0,  0,  0,  0, -5 },
    {  0,  0,  0,  5,  5,  0,  0,  0 }
};

const int AIPlayer::QUEEN_TABLE[8][8] = {
    {-20,-10,-10, -5, -5,-10,-10,-20 },
    {-10,  0,  0,  0,  0,  0,  0,-10 },
    {-10,  0,  5,  5,  5,  5,  0,-10 },
    { -5,  0,  5,  5,  5,  5,  0, -5 },
    {  0,  0,  5,  5,  5,  5,  0, -5 },
    {-10,  5,  5,  5,  5,  5,  0,-10 },
    {-10,  0,  5,  0,  0,  0,  0,-10 },
    {-20,-10,-10, -5, -5,-10,-10,-20 }
};

const int AIPlayer::KING_TABLE[8][8] = {
    {-30,-40,-40,-50,-50,-40,-40,-30 },
    {-30,-40,-40,-50,-50,-40,-40,-30 },
    {-30,-40,-40,-50,-50,-40,-40,-30 },
    {-30,-40,-40,-50,-50,-40,-40,-30 },
    {-20,-30,-30,-40,-40,-30,-30,-20 },
    {-10,-20,-20,-20,-20,-20,-20,-10 },
    { 20, 20,  0,  0,  0,  0, 20, 20 },
    { 20, 30, 10,  0,  0, 10, 30, 20 }
};

AIPlayer::AIPlayer(Board& board, ChessLogic& logic)
    : m_board(board)
    , m_logic(logic)
    , m_difficulty(AIDifficulty::Medium)
    , m_rng(std::random_device{}()) {
}

int AIPlayer::getPieceValue(PieceType type) const {
    switch (type) {
        case PieceType::Pawn:   return 100;
        case PieceType::Knight: return 320;
        case PieceType::Bishop: return 330;
        case PieceType::Rook:   return 500;
        case PieceType::Queen:  return 900;
        case PieceType::King:   return 20000;
        default: return 0;
    }
}

int AIPlayer::getPositionBonus(const Position& pos, PieceType type, Color color) const {
    int row = (color == Color::White) ? pos.row : (7 - pos.row);
    int col = pos.col;
    
    switch (type) {
        case PieceType::Pawn:   return PAWN_TABLE[row][col];
        case PieceType::Knight: return KNIGHT_TABLE[row][col];
        case PieceType::Bishop: return BISHOP_TABLE[row][col];
        case PieceType::Rook:   return ROOK_TABLE[row][col];
        case PieceType::Queen:  return QUEEN_TABLE[row][col];
        case PieceType::King:   return KING_TABLE[row][col];
        default: return 0;
    }
}

// Évaluation statique — du point de vue de l'IA
int AIPlayer::evaluateBoard(const Board& board, Color aiColor) const {
    int score = 0;
    
    for (int row = 0; row < 8; ++row) {
        for (int col = 0; col < 8; ++col) {
            const Piece& piece = board.getPiece(row, col);
            if (piece.isEmpty()) continue;
            
            int value = getPieceValue(piece.getType());
            int bonus = getPositionBonus({row, col}, piece.getType(), piece.getColor());
            
            if (piece.getColor() == aiColor) {
                score += value + bonus;
            } else {
                score -= value + bonus;
            }
        }
    }
    
    return score;
}

// Vérifie si une case est attaquée par une couleur sur un board donné
bool AIPlayer::isAttacked(const Board& board, const Position& pos, Color byColor) const {
    for (int row = 0; row < 8; ++row) {
        for (int col = 0; col < 8; ++col) {
            const Piece& piece = board.getPiece(row, col);
            if (piece.isEmpty() || piece.getColor() != byColor) continue;
            
            int rowDiff = pos.row - row;
            int colDiff = pos.col - col;
            int absRow = std::abs(rowDiff);
            int absCol = std::abs(colDiff);
            
            switch (piece.getType()) {
                case PieceType::Pawn: {
                    int dir = (byColor == Color::White) ? -1 : 1;
                    if (rowDiff == dir && absCol == 1) return true;
                    break;
                }
                case PieceType::Knight:
                    if ((absRow == 2 && absCol == 1) || (absRow == 1 && absCol == 2))
                        return true;
                    break;
                case PieceType::Bishop: {
                    if (absRow == absCol && absRow > 0) {
                        int rs = (rowDiff > 0) ? 1 : -1;
                        int cs = (colDiff > 0) ? 1 : -1;
                        bool clear = true;
                        for (int i = 1; i < absRow; ++i) {
                            if (!board.getPiece(row + i * rs, col + i * cs).isEmpty()) {
                                clear = false; break;
                            }
                        }
                        if (clear) return true;
                    }
                    break;
                }
                case PieceType::Rook: {
                    if ((rowDiff == 0 || colDiff == 0) && (absRow + absCol > 0)) {
                        int rs = (rowDiff == 0) ? 0 : (rowDiff > 0 ? 1 : -1);
                        int cs = (colDiff == 0) ? 0 : (colDiff > 0 ? 1 : -1);
                        int steps = std::max(absRow, absCol);
                        bool clear = true;
                        for (int i = 1; i < steps; ++i) {
                            if (!board.getPiece(row + i * rs, col + i * cs).isEmpty()) {
                                clear = false; break;
                            }
                        }
                        if (clear) return true;
                    }
                    break;
                }
                case PieceType::Queen: {
                    bool diag = (absRow == absCol && absRow > 0);
                    bool straight = ((rowDiff == 0 || colDiff == 0) && (absRow + absCol > 0));
                    if (diag || straight) {
                        int rs = (rowDiff == 0) ? 0 : (rowDiff > 0 ? 1 : -1);
                        int cs = (colDiff == 0) ? 0 : (colDiff > 0 ? 1 : -1);
                        int steps = std::max(absRow, absCol);
                        bool clear = true;
                        for (int i = 1; i < steps; ++i) {
                            if (!board.getPiece(row + i * rs, col + i * cs).isEmpty()) {
                                clear = false; break;
                            }
                        }
                        if (clear) return true;
                    }
                    break;
                }
                case PieceType::King:
                    if (absRow <= 1 && absCol <= 1 && (absRow + absCol > 0))
                        return true;
                    break;
                default: break;
            }
        }
    }
    return false;
}

bool AIPlayer::isInCheck(const Board& board, Color color) const {
    Position kingPos = board.findKing(color);
    if (!kingPos.isValid()) return true; // Roi absent = considéré en échec
    Color opponent = (color == Color::White) ? Color::Black : Color::White;
    return isAttacked(board, kingPos, opponent);
}

// Simule un coup sur le board (modifie le board passé par référence)
// Retourne false si le coup laisse le roi en échec
bool AIPlayer::simulateMove(Board& board, const Move& move, Color currentTurn) const {
    // En passant : capturer le pion
    if (move.isEnPassant) {
        board.removePiece({move.from.row, move.to.col});
    }
    
    // Roque : déplacer la tour aussi
    if (move.isCastling) {
        board.movePiece(move.from, move.to);
        int rookFromCol = (move.to.col > move.from.col) ? 7 : 0;
        int rookToCol = (move.to.col > move.from.col) ? 5 : 3;
        board.movePiece({move.from.row, rookFromCol}, {move.from.row, rookToCol});
    } else {
        board.movePiece(move.from, move.to);
    }
    
    // Promotion
    if (move.promotion != PieceType::None) {
        Piece promoted(move.promotion, currentTurn);
        promoted.setMoved(true);
        board.setPiece(move.to, promoted);
    }
    
    // En passant target pour le prochain coup
    board.clearEnPassantTarget();
    const Piece& movedPiece = board.getPiece(move.to);
    if (movedPiece.getType() == PieceType::Pawn) {
        if (std::abs(move.to.row - move.from.row) == 2) {
            board.setEnPassantTarget({(move.from.row + move.to.row) / 2, move.from.col});
        }
    }
    
    // Vérifier si le roi est en échec après le coup
    if (isInCheck(board, currentTurn)) {
        return false; // Coup illégal
    }
    
    return true;
}

// Génère tous les coups pseudo-légaux puis filtre les illégaux (via copie)
std::vector<Move> AIPlayer::generateMoves(const Board& board, Color color) const {
    std::vector<Move> legalMoves;
    
    for (int row = 0; row < 8; ++row) {
        for (int col = 0; col < 8; ++col) {
            const Piece& piece = board.getPiece(row, col);
            if (piece.isEmpty() || piece.getColor() != color) continue;
            
            Position from = {row, col};
            std::vector<Move> pseudoMoves;
            
            switch (piece.getType()) {
                case PieceType::Pawn: {
                    int dir = (color == Color::White) ? -1 : 1;
                    int startRow = (color == Color::White) ? 6 : 1;
                    int promoRow = (color == Color::White) ? 0 : 7;
                    
                    // Avance simple
                    Position fwd = {row + dir, col};
                    if (fwd.isValid() && board.getPiece(fwd).isEmpty()) {
                        if (fwd.row == promoRow) {
                            pseudoMoves.push_back({from, fwd, PieceType::Queen, false, false, false});
                        } else {
                            pseudoMoves.push_back({from, fwd});
                        }
                        // Avance double
                        if (row == startRow) {
                            Position fwd2 = {row + 2 * dir, col};
                            if (board.getPiece(fwd2).isEmpty()) {
                                pseudoMoves.push_back({from, fwd2});
                            }
                        }
                    }
                    // Captures
                    for (int dc : {-1, 1}) {
                        Position cap = {row + dir, col + dc};
                        if (!cap.isValid()) continue;
                        const Piece& target = board.getPiece(cap);
                        bool isCapture = !target.isEmpty() && target.getColor() != color;
                        bool isEP = (cap == board.getEnPassantTarget());
                        if (isCapture || isEP) {
                            if (cap.row == promoRow) {
                                pseudoMoves.push_back({from, cap, PieceType::Queen, true, false, false});
                            } else {
                                pseudoMoves.push_back({from, cap, PieceType::None, isCapture, false, isEP});
                            }
                        }
                    }
                    break;
                }
                case PieceType::Knight: {
                    int offsets[][2] = {{-2,-1},{-2,1},{-1,-2},{-1,2},{1,-2},{1,2},{2,-1},{2,1}};
                    for (auto& o : offsets) {
                        Position to = {row + o[0], col + o[1]};
                        if (!to.isValid()) continue;
                        const Piece& t = board.getPiece(to);
                        if (t.isEmpty() || t.getColor() != color) {
                            pseudoMoves.push_back({from, to, PieceType::None, !t.isEmpty()});
                        }
                    }
                    break;
                }
                case PieceType::Bishop: {
                    int dirs[][2] = {{-1,-1},{-1,1},{1,-1},{1,1}};
                    for (auto& d : dirs) {
                        Position to = from;
                        while (true) {
                            to = {to.row + d[0], to.col + d[1]};
                            if (!to.isValid()) break;
                            const Piece& t = board.getPiece(to);
                            if (t.isEmpty()) {
                                pseudoMoves.push_back({from, to});
                            } else {
                                if (t.getColor() != color)
                                    pseudoMoves.push_back({from, to, PieceType::None, true});
                                break;
                            }
                        }
                    }
                    break;
                }
                case PieceType::Rook: {
                    int dirs[][2] = {{-1,0},{1,0},{0,-1},{0,1}};
                    for (auto& d : dirs) {
                        Position to = from;
                        while (true) {
                            to = {to.row + d[0], to.col + d[1]};
                            if (!to.isValid()) break;
                            const Piece& t = board.getPiece(to);
                            if (t.isEmpty()) {
                                pseudoMoves.push_back({from, to});
                            } else {
                                if (t.getColor() != color)
                                    pseudoMoves.push_back({from, to, PieceType::None, true});
                                break;
                            }
                        }
                    }
                    break;
                }
                case PieceType::Queen: {
                    int dirs[][2] = {{-1,-1},{-1,0},{-1,1},{0,-1},{0,1},{1,-1},{1,0},{1,1}};
                    for (auto& d : dirs) {
                        Position to = from;
                        while (true) {
                            to = {to.row + d[0], to.col + d[1]};
                            if (!to.isValid()) break;
                            const Piece& t = board.getPiece(to);
                            if (t.isEmpty()) {
                                pseudoMoves.push_back({from, to});
                            } else {
                                if (t.getColor() != color)
                                    pseudoMoves.push_back({from, to, PieceType::None, true});
                                break;
                            }
                        }
                    }
                    break;
                }
                case PieceType::King: {
                    for (int dr = -1; dr <= 1; ++dr) {
                        for (int dc = -1; dc <= 1; ++dc) {
                            if (dr == 0 && dc == 0) continue;
                            Position to = {row + dr, col + dc};
                            if (!to.isValid()) continue;
                            const Piece& t = board.getPiece(to);
                            if (t.isEmpty() || t.getColor() != color) {
                                pseudoMoves.push_back({from, to, PieceType::None, !t.isEmpty()});
                            }
                        }
                    }
                    // Roque (simplifié : vérifier droits et chemin libre)
                    if (!piece.hasMoved() && !isInCheck(board, color)) {
                        Color opp = (color == Color::White) ? Color::Black : Color::White;
                        // Petit roque
                        if (board.canCastleKingside(color)) {
                            const Piece& rook = board.getPiece(row, 7);
                            if (rook.getType() == PieceType::Rook && !rook.hasMoved() &&
                                board.getPiece(row, 5).isEmpty() && board.getPiece(row, 6).isEmpty() &&
                                !isAttacked(board, {row, 5}, opp) && !isAttacked(board, {row, 6}, opp)) {
                                pseudoMoves.push_back({from, {row, 6}, PieceType::None, false, true, false});
                            }
                        }
                        // Grand roque
                        if (board.canCastleQueenside(color)) {
                            const Piece& rook = board.getPiece(row, 0);
                            if (rook.getType() == PieceType::Rook && !rook.hasMoved() &&
                                board.getPiece(row, 1).isEmpty() && board.getPiece(row, 2).isEmpty() &&
                                board.getPiece(row, 3).isEmpty() &&
                                !isAttacked(board, {row, 2}, opp) && !isAttacked(board, {row, 3}, opp)) {
                                pseudoMoves.push_back({from, {row, 2}, PieceType::None, false, true, false});
                            }
                        }
                    }
                    break;
                }
                default: break;
            }
            
            // Filtrer : garder seulement les coups qui ne laissent pas le roi en échec
            for (const Move& m : pseudoMoves) {
                Board copy = board; // Copie du board
                if (simulateMove(copy, m, color)) {
                    legalMoves.push_back(m);
                }
            }
        }
    }
    
    return legalMoves;
}

// Minimax avec alpha-beta — travaille UNIQUEMENT sur des copies
int AIPlayer::minimax(Board board, Color currentTurn, int depth, int alpha, int beta,
                      bool maximizing, Color aiColor) {
    // Générer les coups pour le joueur courant
    std::vector<Move> moves = generateMoves(board, currentTurn);
    Color opponent = (currentTurn == Color::White) ? Color::Black : Color::White;
    
    // Pas de coups légaux
    if (moves.empty()) {
        if (isInCheck(board, currentTurn)) {
            // Mat
            return maximizing ? (-100000 + (getMaxDepth() - depth))
                              : (100000 - (getMaxDepth() - depth));
        }
        return 0; // Pat
    }
    
    // Profondeur 0 : évaluation statique
    if (depth == 0) {
        return evaluateBoard(board, aiColor);
    }
    
    // Trier les coups : captures d'abord (simple heuristique)
    std::sort(moves.begin(), moves.end(), [&](const Move& a, const Move& b) {
        int scoreA = 0, scoreB = 0;
        if (a.isCapture || !board.getPiece(a.to).isEmpty()) {
            scoreA += 10 * getPieceValue(board.getPiece(a.to).getType());
        }
        if (a.promotion != PieceType::None) scoreA += 900;
        if (b.isCapture || !board.getPiece(b.to).isEmpty()) {
            scoreB += 10 * getPieceValue(board.getPiece(b.to).getType());
        }
        if (b.promotion != PieceType::None) scoreB += 900;
        return scoreA > scoreB;
    });
    
    if (maximizing) {
        int maxEval = std::numeric_limits<int>::min();
        for (const Move& move : moves) {
            Board copy = board; // Copie fraîche pour chaque coup
            simulateMove(copy, move, currentTurn);
            int eval = minimax(copy, opponent, depth - 1, alpha, beta, false, aiColor);
            maxEval = std::max(maxEval, eval);
            alpha = std::max(alpha, eval);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        int minEval = std::numeric_limits<int>::max();
        for (const Move& move : moves) {
            Board copy = board;
            simulateMove(copy, move, currentTurn);
            int eval = minimax(copy, opponent, depth - 1, alpha, beta, true, aiColor);
            minEval = std::min(minEval, eval);
            beta = std::min(beta, eval);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

int AIPlayer::getMaxDepth() const {
    switch (m_difficulty) {
        case AIDifficulty::Easy:   return 1;
        case AIDifficulty::Medium: return 2;
        case AIDifficulty::Hard:   return 3;
        case AIDifficulty::Expert: return 4;
        default: return 2;
    }
}

Move AIPlayer::findBestMove(Color color) {
    // Utiliser le vrai board pour obtenir les coups légaux via ChessLogic
    // (on fait confiance à ChessLogic pour le premier niveau seulement)
    std::vector<Move> moves = m_logic.getAllLegalMoves(color);
    
    if (moves.empty()) {
        return Move{};
    }
    
    int depth = getMaxDepth();
    int bestScore = std::numeric_limits<int>::min();
    std::vector<Move> bestMoves;
    
    Color opponent = (color == Color::White) ? Color::Black : Color::White;
    
    int alpha = std::numeric_limits<int>::min();
    int beta = std::numeric_limits<int>::max();
    
    for (Move move : moves) {
        // Toujours promouvoir en dame
        if (move.promotion != PieceType::None) {
            move.promotion = PieceType::Queen;
        }
        
        // Créer une COPIE du board et simuler le coup dessus
        Board boardCopy = m_board;
        if (!simulateMove(boardCopy, move, color)) {
            continue; // Coup illégal (ne devrait pas arriver)
        }
        
        int score;
        if (depth <= 1) {
            // Pour Easy : évaluation directe
            score = evaluateBoard(boardCopy, color);
        } else {
            // Minimax sur la copie
            score = minimax(boardCopy, opponent, depth - 1, alpha, beta, false, color);
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestMoves.clear();
            bestMoves.push_back(move);
        } else if (score == bestScore) {
            bestMoves.push_back(move);
        }
        
        alpha = std::max(alpha, score);
    }
    
    if (bestMoves.empty()) {
        return moves[0];
    }
    
    // Choisir aléatoirement parmi les meilleurs coups
    std::uniform_int_distribution<size_t> dist(0, bestMoves.size() - 1);
    return bestMoves[dist(m_rng)];
}

} // namespace Chess
