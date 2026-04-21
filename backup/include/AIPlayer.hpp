#pragma once

#include "Types.hpp"
#include "Board.hpp"
#include "ChessLogic.hpp"
#include <random>
#include <vector>

namespace Chess {

// Niveaux de difficulté de l'IA
enum class AIDifficulty {
    Easy = 1,
    Medium = 2,
    Hard = 3,
    Expert = 4
};

class AIPlayer {
public:
    AIPlayer(Board& board, ChessLogic& logic);
    
    // Trouve le meilleur coup pour la couleur donnée
    Move findBestMove(Color color);
    
    // Définit le niveau de difficulté
    void setDifficulty(AIDifficulty difficulty) { m_difficulty = difficulty; }
    AIDifficulty getDifficulty() const { return m_difficulty; }

private:
    // Simule un coup sur une copie du board (retourne le nouveau board + nouveau tour)
    bool simulateMove(Board& board, const Move& move, Color currentTurn) const;
    
    // Génère tous les coups légaux pour une couleur sur un board donné
    std::vector<Move> generateMoves(const Board& board, Color color) const;
    
    // Vérifie si une position est attaquée
    bool isAttacked(const Board& board, const Position& pos, Color byColor) const;
    
    // Vérifie si le roi d'une couleur est en échec
    bool isInCheck(const Board& board, Color color) const;
    
    // Minimax sur des copies du board (JAMAIS de modification du board réel)
    int minimax(Board board, Color currentTurn, int depth, int alpha, int beta,
                bool maximizing, Color aiColor);
    
    // Évaluation statique
    int evaluateBoard(const Board& board, Color aiColor) const;
    
    // Profondeur maximale selon la difficulté
    int getMaxDepth() const;
    
    // Valeur des pièces
    int getPieceValue(PieceType type) const;
    
    // Bonus de position
    int getPositionBonus(const Position& pos, PieceType type, Color color) const;

    Board& m_board;
    ChessLogic& m_logic;
    AIDifficulty m_difficulty;
    std::mt19937 m_rng;
    
    // Tables de bonus de position
    static const int PAWN_TABLE[8][8];
    static const int KNIGHT_TABLE[8][8];
    static const int BISHOP_TABLE[8][8];
    static const int ROOK_TABLE[8][8];
    static const int QUEEN_TABLE[8][8];
    static const int KING_TABLE[8][8];
};

} // namespace Chess
