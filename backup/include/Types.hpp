/*
** EPITECH PROJECT, 2025
** echecs
** File description:
** Types.hpp
*/
#pragma once
#include <cstdint>

namespace Chess {

enum class PieceType {
    None = 0,
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King
};

enum class Color {
    None = 0,
    White,
    Black
};

struct Position {
    int row;
    int col;
    
    bool operator==(const Position& other) const {
        return row == other.row && col == other.col;
    }
    
    bool operator!=(const Position& other) const {
        return !(*this == other);
    }
    
    bool isValid() const {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }
};

struct Move {
    Position from;
    Position to;
    PieceType promotion = PieceType::None;
    bool isCapture = false;
    bool isCastling = false;
    bool isEnPassant = false;
};

enum class GameState {
    MainMenu,
    Playing,
    Check,
    Checkmate,
    Stalemate,
    Draw,
    WhiteTimeout,
    BlackTimeout
};

} // namespace Chess
