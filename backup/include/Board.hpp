#pragma once

#include "Types.hpp"
#include "Piece.hpp"
#include <array>
#include <vector>

namespace Chess {

class Board {
public:
    Board();
    
    void initialize();
    void clear();
    
    Piece& getPiece(const Position& pos);
    const Piece& getPiece(const Position& pos) const;
    Piece& getPiece(int row, int col);
    const Piece& getPiece(int row, int col) const;
    
    void setPiece(const Position& pos, const Piece& piece);
    void movePiece(const Position& from, const Position& to);
    void removePiece(const Position& pos);
    
    Position findKing(Color color) const;
    std::vector<Position> findPieces(Color color) const;
    
    // En passant tracking
    Position getEnPassantTarget() const { return m_enPassantTarget; }
    void setEnPassantTarget(const Position& pos) { m_enPassantTarget = pos; }
    void clearEnPassantTarget() { m_enPassantTarget = {-1, -1}; }
    
    // Castling rights
    bool canCastleKingside(Color color) const;
    bool canCastleQueenside(Color color) const;
    void disableCastling(Color color, bool kingside);
    std::array<bool, 4> getCastlingRights() const { return m_castlingRights; }
    void setCastlingRights(const std::array<bool, 4>& rights) { m_castlingRights = rights; }

private:
    std::array<std::array<Piece, 8>, 8> m_board;
    Position m_enPassantTarget;
    
    // Castling rights: [white kingside, white queenside, black kingside, black queenside]
    std::array<bool, 4> m_castlingRights;
};

} // namespace Chess
