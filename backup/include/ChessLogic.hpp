#pragma once

#include "Types.hpp"
#include "Board.hpp"
#include <vector>
#include <array>

namespace Chess {

// Structure pour stocker toutes les informations nécessaires à l'annulation d'un coup
struct MoveRecord {
    Move move;
    Piece capturedPiece;
    Piece movedPiece;
    Position enPassantTarget;
    std::array<bool, 4> castlingRights;
    bool wasEnPassantCapture;
    Position enPassantCapturePos;
};

class ChessLogic {
public:
    ChessLogic(Board& board);
    
    // Get all legal moves for a piece at position
    std::vector<Move> getLegalMoves(const Position& pos) const;
    
    // Check if a move is legal
    bool isLegalMove(const Move& move) const;
    
    // Execute a move on the board
    bool makeMove(const Move& move);
    
    // Undo last move
    bool undoMove();
    
    // Check game state
    bool isInCheck(Color color) const;
    bool isCheckmate(Color color) const;
    bool isStalemate(Color color) const;
    GameState getGameState() const;
    
    // Get current turn
    Color getCurrentTurn() const { return m_currentTurn; }
    
    // Get all legal moves for a specific color (for AI)
    std::vector<Move> getAllLegalMoves(Color color) const;
    
    // Check if position is attacked by a color
    bool isAttacked(const Position& pos, Color byColor) const;

private:
    Board& m_board;
    Color m_currentTurn;
    std::vector<MoveRecord> m_moveHistory;
    
    // Generate pseudo-legal moves (before checking if king is in check)
    std::vector<Move> getPseudoLegalMoves(const Position& pos) const;
    
    // Move generators for each piece type
    std::vector<Move> getPawnMoves(const Position& pos) const;
    std::vector<Move> getKnightMoves(const Position& pos) const;
    std::vector<Move> getBishopMoves(const Position& pos) const;
    std::vector<Move> getRookMoves(const Position& pos) const;
    std::vector<Move> getQueenMoves(const Position& pos) const;
    std::vector<Move> getKingMoves(const Position& pos) const;
    
    // Sliding piece move generation helper
    std::vector<Move> getSlidingMoves(const Position& pos, 
                                       const std::vector<std::pair<int, int>>& directions) const;
    
    // Check if a move would leave own king in check
    bool wouldBeInCheck(const Move& move) const;
};

} // namespace Chess
