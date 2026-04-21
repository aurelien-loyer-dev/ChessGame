#include "Piece.hpp"

namespace Chess {

Piece::Piece() 
    : m_type(PieceType::None)
    , m_color(Color::None)
    , m_hasMoved(false) {
}

Piece::Piece(PieceType type, Color color)
    : m_type(type)
    , m_color(color)
    , m_hasMoved(false) {
}

char32_t Piece::getUnicodeChar() const {
    if (m_color == Color::White) {
        switch (m_type) {
            case PieceType::King:   return U'\u2654'; // ♔
            case PieceType::Queen:  return U'\u2655'; // ♕
            case PieceType::Rook:   return U'\u2656'; // ♖
            case PieceType::Bishop: return U'\u2657'; // ♗
            case PieceType::Knight: return U'\u2658'; // ♘
            case PieceType::Pawn:   return U'\u2659'; // ♙
            default: return U' ';
        }
    } else if (m_color == Color::Black) {
        switch (m_type) {
            case PieceType::King:   return U'\u265A'; // ♚
            case PieceType::Queen:  return U'\u265B'; // ♛
            case PieceType::Rook:   return U'\u265C'; // ♜
            case PieceType::Bishop: return U'\u265D'; // ♝
            case PieceType::Knight: return U'\u265E'; // ♞
            case PieceType::Pawn:   return U'\u265F'; // ♟
            default: return U' ';
        }
    }
    return U' ';
}

int Piece::getValue() const {
    switch (m_type) {
        case PieceType::Pawn:   return 100;
        case PieceType::Knight: return 320;
        case PieceType::Bishop: return 330;
        case PieceType::Rook:   return 500;
        case PieceType::Queen:  return 900;
        case PieceType::King:   return 20000;
        default: return 0;
    }
}

} // namespace Chess
