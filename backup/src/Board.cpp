#include "Board.hpp"

namespace Chess {

Board::Board() {
    clear();
}

void Board::initialize() {
    clear();
    
    // Set up pawns
    for (int col = 0; col < 8; ++col) {
        m_board[1][col] = Piece(PieceType::Pawn, Color::Black);
        m_board[6][col] = Piece(PieceType::Pawn, Color::White);
    }
    
    // Set up back ranks
    PieceType backRank[] = {
        PieceType::Rook, PieceType::Knight, PieceType::Bishop, PieceType::Queen,
        PieceType::King, PieceType::Bishop, PieceType::Knight, PieceType::Rook
    };
    
    for (int col = 0; col < 8; ++col) {
        m_board[0][col] = Piece(backRank[col], Color::Black);
        m_board[7][col] = Piece(backRank[col], Color::White);
    }
    
    // Reset castling rights
    m_castlingRights = {true, true, true, true};
    
    // Clear en passant
    clearEnPassantTarget();
}

void Board::clear() {
    for (auto& row : m_board) {
        for (auto& piece : row) {
            piece = Piece();
        }
    }
    m_castlingRights = {false, false, false, false};
    clearEnPassantTarget();
}

Piece& Board::getPiece(const Position& pos) {
    return m_board[pos.row][pos.col];
}

const Piece& Board::getPiece(const Position& pos) const {
    return m_board[pos.row][pos.col];
}

Piece& Board::getPiece(int row, int col) {
    return m_board[row][col];
}

const Piece& Board::getPiece(int row, int col) const {
    return m_board[row][col];
}

void Board::setPiece(const Position& pos, const Piece& piece) {
    m_board[pos.row][pos.col] = piece;
}

void Board::movePiece(const Position& from, const Position& to) {
    m_board[to.row][to.col] = m_board[from.row][from.col];
    m_board[to.row][to.col].setMoved(true);
    m_board[from.row][from.col] = Piece();
}

void Board::removePiece(const Position& pos) {
    m_board[pos.row][pos.col] = Piece();
}

Position Board::findKing(Color color) const {
    for (int row = 0; row < 8; ++row) {
        for (int col = 0; col < 8; ++col) {
            const Piece& piece = m_board[row][col];
            if (piece.getType() == PieceType::King && piece.getColor() == color) {
                return {row, col};
            }
        }
    }
    return {-1, -1};
}

std::vector<Position> Board::findPieces(Color color) const {
    std::vector<Position> positions;
    for (int row = 0; row < 8; ++row) {
        for (int col = 0; col < 8; ++col) {
            if (m_board[row][col].getColor() == color) {
                positions.push_back({row, col});
            }
        }
    }
    return positions;
}

bool Board::canCastleKingside(Color color) const {
    return color == Color::White ? m_castlingRights[0] : m_castlingRights[2];
}

bool Board::canCastleQueenside(Color color) const {
    return color == Color::White ? m_castlingRights[1] : m_castlingRights[3];
}

void Board::disableCastling(Color color, bool kingside) {
    if (color == Color::White) {
        if (kingside) m_castlingRights[0] = false;
        else m_castlingRights[1] = false;
    } else {
        if (kingside) m_castlingRights[2] = false;
        else m_castlingRights[3] = false;
    }
}

} // namespace Chess
