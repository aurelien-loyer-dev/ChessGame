#pragma once

#include "Types.hpp"
#include "Board.hpp"
#include <SFML/Graphics.hpp>
#include <vector>
#include <string>
#include <optional>

namespace Chess {

class Renderer {
public:
    Renderer(sf::RenderWindow& window, const Board& board);
    
    bool loadResources();
    void render(const Position* selectedPos = nullptr, 
                const std::vector<Move>* legalMoves = nullptr,
                GameState gameState = GameState::Playing,
                Color currentTurn = Color::White);
    
    // Convert mouse position to board position
    Position screenToBoard(int x, int y) const;
    
    // Get board offset and tile size
    float getTileSize() const { return m_tileSize; }
    sf::Vector2f getBoardOffset() const { return m_boardOffset; }
    
    // Animation
    void setAnimating(bool animating, const Position& from, const Position& to);
    void updateAnimation(float dt);
    bool isAnimating() const { return m_isAnimating; }
    
    // Get font for external use
    const sf::Font* getFont() const { return m_font ? &(*m_font) : nullptr; }

private:
    sf::RenderWindow& m_window;
    const Board& m_board;
    
    std::optional<sf::Font> m_font;
    
    float m_tileSize;
    sf::Vector2f m_boardOffset;
    
    // Colors
    sf::Color m_lightColor;
    sf::Color m_darkColor;
    sf::Color m_selectedColor;
    sf::Color m_legalMoveColor;
    sf::Color m_captureColor;
    sf::Color m_lastMoveColor;
    sf::Color m_checkColor;
    
    // Animation
    bool m_isAnimating;
    Position m_animFrom;
    Position m_animTo;
    float m_animProgress;
    static constexpr float ANIM_DURATION = 0.2f;
    
    // Rendering methods
    void drawBoard();
    void drawCoordinates();
    void drawPieces(const Position* selectedPos);
    void drawHighlights(const Position* selectedPos, 
                        const std::vector<Move>* legalMoves);
    void drawGameState(GameState state, Color currentTurn);
    void drawGameOverOverlay(GameState state, Color currentTurn);
    void drawPiece(const Piece& piece, float x, float y, float alpha = 1.0f);
    
    // Get piece character from Unicode font
    sf::String getPieceString(const Piece& piece) const;
};

} // namespace Chess
