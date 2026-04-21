#pragma once

#include "Types.hpp"

namespace Chess {

class Piece {
public:
    Piece();
    Piece(PieceType type, Color color);
    
    PieceType getType() const { return m_type; }
    Color getColor() const { return m_color; }
    bool isEmpty() const { return m_type == PieceType::None; }
    bool hasMoved() const { return m_hasMoved; }
    void setMoved(bool moved) { m_hasMoved = moved; }
    
    // Get Unicode character for the piece
    char32_t getUnicodeChar() const;
    
    // Get piece value for evaluation
    int getValue() const;

private:
    PieceType m_type;
    Color m_color;
    bool m_hasMoved;
};

} // namespace Chess
