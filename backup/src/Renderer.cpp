#include "Renderer.hpp"
#include <cmath>
#include <iostream>

namespace Chess {

Renderer::Renderer(sf::RenderWindow& window, const Board& board)
    : m_window(window)
    , m_board(board)
    , m_tileSize(90.0f)
    , m_boardOffset(40.0f, 40.0f)
    , m_isAnimating(false)
    , m_animProgress(0.0f)
{
    // Modern color scheme - elegant green/cream chess board
    m_lightColor = sf::Color(238, 238, 210);      // Cream
    m_darkColor = sf::Color(118, 150, 86);        // Forest green
    m_selectedColor = sf::Color(186, 202, 68);    // Highlight yellow-green
    m_legalMoveColor = sf::Color(100, 100, 100, 100); // Semi-transparent gray
    m_captureColor = sf::Color(255, 80, 80, 150); // Red for captures
    m_lastMoveColor = sf::Color(255, 255, 0, 80); // Yellow for last move
    m_checkColor = sf::Color(255, 0, 0, 150);     // Red for check
}

bool Renderer::loadResources() {
    // Try to load a system font that supports chess pieces
    std::vector<std::string> fontPaths = {
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Apple Symbols.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNS.ttf"
    };
    
    for (const auto& path : fontPaths) {
        sf::Font font;
        if (font.openFromFile(path)) {
            m_font = std::move(font);
            return true;
        }
    }
    
    std::cerr << "Warning: Could not load font. Text may not display correctly." << std::endl;
    return false;
}

void Renderer::render(const Position* selectedPos, 
                      const std::vector<Move>* legalMoves,
                      GameState gameState,
                      Color currentTurn) {
    // Draw gradient background
    sf::RectangleShape background(sf::Vector2f(static_cast<float>(m_window.getSize().x), 
                                                static_cast<float>(m_window.getSize().y)));
    background.setFillColor(sf::Color(40, 44, 52));
    m_window.draw(background);
    
    // Draw board shadow
    sf::RectangleShape shadow(sf::Vector2f(m_tileSize * 8 + 10, m_tileSize * 8 + 10));
    shadow.setPosition(sf::Vector2f(m_boardOffset.x + 5, m_boardOffset.y + 5));
    shadow.setFillColor(sf::Color(0, 0, 0, 100));
    m_window.draw(shadow);
    
    // Draw board border
    sf::RectangleShape border(sf::Vector2f(m_tileSize * 8 + 8, m_tileSize * 8 + 8));
    border.setPosition(sf::Vector2f(m_boardOffset.x - 4, m_boardOffset.y - 4));
    border.setFillColor(sf::Color(60, 60, 50));
    m_window.draw(border);
    
    drawBoard();
    drawHighlights(selectedPos, legalMoves);
    drawPieces(selectedPos);
    drawCoordinates();
    drawGameState(gameState, currentTurn);
    
    // Draw game over overlay for checkmate and stalemate
    if (gameState == GameState::Checkmate || gameState == GameState::Stalemate) {
        drawGameOverOverlay(gameState, currentTurn);
    }
}

void Renderer::drawBoard() {
    for (int row = 0; row < 8; ++row) {
        for (int col = 0; col < 8; ++col) {
            sf::RectangleShape tile(sf::Vector2f(m_tileSize, m_tileSize));
            tile.setPosition(sf::Vector2f(m_boardOffset.x + col * m_tileSize, 
                                          m_boardOffset.y + row * m_tileSize));
            
            bool isLight = (row + col) % 2 == 0;
            tile.setFillColor(isLight ? m_lightColor : m_darkColor);
            
            m_window.draw(tile);
        }
    }
}

void Renderer::drawCoordinates() {
    if (!m_font) return;
    
    unsigned int fontSize = 14;
    
    for (int i = 0; i < 8; ++i) {
        // Row numbers (8-1)
        sf::Text rowText(*m_font, std::to_string(8 - i), fontSize);
        rowText.setFillColor(sf::Color(200, 200, 200));
        rowText.setPosition(sf::Vector2f(m_boardOffset.x - 20, 
                           m_boardOffset.y + i * m_tileSize + m_tileSize / 2 - fontSize / 2));
        m_window.draw(rowText);
        
        // Also on right side
        sf::Text rowText2(*m_font, std::to_string(8 - i), fontSize);
        rowText2.setFillColor(sf::Color(200, 200, 200));
        rowText2.setPosition(sf::Vector2f(m_boardOffset.x + 8 * m_tileSize + 8,
                           m_boardOffset.y + i * m_tileSize + m_tileSize / 2 - fontSize / 2));
        m_window.draw(rowText2);
        
        // Column letters (a-h)
        sf::Text colText(*m_font, std::string(1, 'a' + i), fontSize);
        colText.setFillColor(sf::Color(200, 200, 200));
        colText.setPosition(sf::Vector2f(m_boardOffset.x + i * m_tileSize + m_tileSize / 2 - fontSize / 3,
                           m_boardOffset.y + 8 * m_tileSize + 5));
        m_window.draw(colText);
        
        // Also on top
        sf::Text colText2(*m_font, std::string(1, 'a' + i), fontSize);
        colText2.setFillColor(sf::Color(200, 200, 200));
        colText2.setPosition(sf::Vector2f(m_boardOffset.x + i * m_tileSize + m_tileSize / 2 - fontSize / 3,
                           m_boardOffset.y - 22));
        m_window.draw(colText2);
    }
}

void Renderer::drawPieces(const Position* selectedPos) {
    for (int row = 0; row < 8; ++row) {
        for (int col = 0; col < 8; ++col) {
            const Piece& piece = m_board.getPiece(row, col);
            if (piece.isEmpty()) continue;
            
            // Skip drawing piece at original position if it's being animated
            if (m_isAnimating && selectedPos && selectedPos->row == row && selectedPos->col == col) {
                continue;
            }
            
            float x = m_boardOffset.x + col * m_tileSize;
            float y = m_boardOffset.y + row * m_tileSize;
            
            float alpha = 1.0f;
            if (selectedPos && selectedPos->row == row && selectedPos->col == col) {
                alpha = 0.5f; // Semi-transparent for selected piece
            }
            
            drawPiece(piece, x, y, alpha);
        }
    }
    
    // Draw animated piece
    if (m_isAnimating) {
        const Piece& piece = m_board.getPiece(m_animTo);
        if (!piece.isEmpty()) {
            float startX = m_boardOffset.x + m_animFrom.col * m_tileSize;
            float startY = m_boardOffset.y + m_animFrom.row * m_tileSize;
            float endX = m_boardOffset.x + m_animTo.col * m_tileSize;
            float endY = m_boardOffset.y + m_animTo.row * m_tileSize;
            
            // Smooth easing
            float t = m_animProgress;
            t = t * t * (3.0f - 2.0f * t); // Smoothstep
            
            float x = startX + (endX - startX) * t;
            float y = startY + (endY - startY) * t;
            
            drawPiece(piece, x, y);
        }
    }
}

void Renderer::drawPiece(const Piece& piece, float x, float y, float alpha) {
    if (!m_font) return;
    
    sf::String sfStr = getPieceString(piece);
    unsigned int charSize = static_cast<unsigned int>(m_tileSize * 0.85f);
    
    sf::Text pieceText(*m_font, sfStr, charSize);
    
    // Color based on piece color with shadow effect
    sf::Color pieceColor;
    if (piece.getColor() == Color::White) {
        pieceColor = sf::Color(255, 255, 255, static_cast<std::uint8_t>(255 * alpha));
    } else {
        pieceColor = sf::Color(30, 30, 30, static_cast<std::uint8_t>(255 * alpha));
    }
    
    // Draw shadow
    sf::Text shadowText(*m_font, sfStr, charSize);
    shadowText.setFillColor(sf::Color(0, 0, 0, static_cast<std::uint8_t>(100 * alpha)));
    
    // Center the piece
    sf::FloatRect bounds = pieceText.getLocalBounds();
    float offsetX = (m_tileSize - bounds.size.x) / 2 - bounds.position.x;
    float offsetY = (m_tileSize - bounds.size.y) / 2 - bounds.position.y - m_tileSize * 0.08f;
    
    shadowText.setPosition(sf::Vector2f(x + offsetX + 2, y + offsetY + 2));
    m_window.draw(shadowText);
    
    pieceText.setFillColor(pieceColor);
    pieceText.setPosition(sf::Vector2f(x + offsetX, y + offsetY));
    
    // Add outline for white pieces
    if (piece.getColor() == Color::White) {
        pieceText.setOutlineColor(sf::Color(50, 50, 50, static_cast<std::uint8_t>(200 * alpha)));
        pieceText.setOutlineThickness(1.0f);
    }
    
    m_window.draw(pieceText);
}

void Renderer::drawHighlights(const Position* selectedPos, 
                              const std::vector<Move>* legalMoves) {
    // Highlight selected square
    if (selectedPos && selectedPos->isValid()) {
        sf::RectangleShape highlight(sf::Vector2f(m_tileSize, m_tileSize));
        highlight.setPosition(sf::Vector2f(m_boardOffset.x + selectedPos->col * m_tileSize,
                             m_boardOffset.y + selectedPos->row * m_tileSize));
        highlight.setFillColor(m_selectedColor);
        m_window.draw(highlight);
    }
    
    // Highlight legal moves
    if (legalMoves) {
        for (const Move& move : *legalMoves) {
            float x = m_boardOffset.x + move.to.col * m_tileSize;
            float y = m_boardOffset.y + move.to.row * m_tileSize;
            
            if (move.isCapture || move.isEnPassant) {
                // Draw capture indicator (ring)
                sf::CircleShape ring(m_tileSize / 2 - 4);
                ring.setPosition(sf::Vector2f(x + 4, y + 4));
                ring.setFillColor(sf::Color::Transparent);
                ring.setOutlineColor(m_captureColor);
                ring.setOutlineThickness(4);
                m_window.draw(ring);
            } else {
                // Draw move indicator (dot)
                sf::CircleShape dot(m_tileSize / 6);
                dot.setPosition(sf::Vector2f(x + m_tileSize / 2 - m_tileSize / 6,
                               y + m_tileSize / 2 - m_tileSize / 6));
                dot.setFillColor(m_legalMoveColor);
                m_window.draw(dot);
            }
        }
    }
}

void Renderer::drawGameState(GameState state, Color currentTurn) {
    if (!m_font) return;
    
    float panelX = m_boardOffset.x + 8 * m_tileSize + 20;
    float panelWidth = 180;
    
    // Side panel background
    sf::RectangleShape panel(sf::Vector2f(panelWidth, 200));
    panel.setPosition(sf::Vector2f(panelX, m_boardOffset.y));
    panel.setFillColor(sf::Color(30, 34, 42));
    panel.setOutlineColor(sf::Color(50, 55, 65));
    panel.setOutlineThickness(2);
    m_window.draw(panel);
    
    // Panel header
    sf::RectangleShape panelHeader(sf::Vector2f(panelWidth, 35));
    panelHeader.setPosition(sf::Vector2f(panelX, m_boardOffset.y));
    panelHeader.setFillColor(sf::Color(45, 50, 60));
    m_window.draw(panelHeader);
    
    sf::Text headerText(*m_font, "ECHECS", 16);
    headerText.setFillColor(sf::Color(200, 200, 200));
    headerText.setStyle(sf::Text::Bold);
    sf::FloatRect hBounds = headerText.getLocalBounds();
    headerText.setPosition(sf::Vector2f(panelX + (panelWidth - hBounds.size.x) / 2, m_boardOffset.y + 8));
    m_window.draw(headerText);
    
    // Turn indicator section
    float turnY = m_boardOffset.y + 50;
    
    sf::Text turnLabel(*m_font, "Tour actuel", 12);
    turnLabel.setFillColor(sf::Color(140, 140, 140));
    turnLabel.setPosition(sf::Vector2f(panelX + 15, turnY));
    m_window.draw(turnLabel);
    
    // Turn box
    sf::RectangleShape turnBox(sf::Vector2f(panelWidth - 30, 40));
    turnBox.setPosition(sf::Vector2f(panelX + 15, turnY + 20));
    turnBox.setFillColor(sf::Color(40, 44, 52));
    turnBox.setOutlineColor(currentTurn == Color::White ? sf::Color(200, 200, 200) : sf::Color(80, 80, 80));
    turnBox.setOutlineThickness(2);
    m_window.draw(turnBox);
    
    // Turn piece icon and text
    sf::String turnPiece;
    turnPiece += currentTurn == Color::White ? U'♔' : U'♚';
    sf::Text turnIcon(*m_font, turnPiece, 28);
    turnIcon.setFillColor(currentTurn == Color::White ? sf::Color::White : sf::Color(60, 60, 60));
    if (currentTurn == Color::White) {
        turnIcon.setOutlineColor(sf::Color(80, 80, 80));
        turnIcon.setOutlineThickness(1);
    }
    turnIcon.setPosition(sf::Vector2f(panelX + 25, turnY + 23));
    m_window.draw(turnIcon);
    
    sf::Text turnText(*m_font, currentTurn == Color::White ? "Blancs" : "Noirs", 16);
    turnText.setFillColor(sf::Color::White);
    turnText.setStyle(sf::Text::Bold);
    turnText.setPosition(sf::Vector2f(panelX + 65, turnY + 30));
    m_window.draw(turnText);
    
    // Game state message
    std::string stateMessage;
    std::string stateEmoji;
    sf::Color stateColor = sf::Color::White;
    sf::Color stateBgColor = sf::Color(40, 44, 52);
    
    switch (state) {
        case GameState::Check:
            stateMessage = "ECHEC !";
            stateEmoji = "⚠";
            stateColor = sf::Color(255, 200, 0);
            stateBgColor = sf::Color(80, 60, 0);
            break;
        case GameState::Checkmate:
            stateMessage = currentTurn == Color::White ? "Noirs gagnent!" : "Blancs gagnent!";
            stateEmoji = "🏆";
            stateColor = sf::Color(100, 255, 100);
            stateBgColor = sf::Color(30, 80, 30);
            break;
        case GameState::Stalemate:
            stateMessage = "Pat - Nulle";
            stateEmoji = "🤝";
            stateColor = sf::Color(200, 200, 200);
            stateBgColor = sf::Color(60, 60, 60);
            break;
        case GameState::Draw:
            stateMessage = "Nulle";
            stateEmoji = "🤝";
            stateColor = sf::Color(200, 200, 200);
            stateBgColor = sf::Color(60, 60, 60);
            break;
        default:
            break;
    }
    
    if (!stateMessage.empty()) {
        float stateY = turnY + 80;
        
        // State box with pulsing effect idea
        sf::RectangleShape stateBox(sf::Vector2f(panelWidth - 30, 45));
        stateBox.setPosition(sf::Vector2f(panelX + 15, stateY));
        stateBox.setFillColor(stateBgColor);
        stateBox.setOutlineColor(stateColor);
        stateBox.setOutlineThickness(2);
        m_window.draw(stateBox);
        
        sf::Text stateText(*m_font, stateMessage, 14);
        stateText.setFillColor(stateColor);
        stateText.setStyle(sf::Text::Bold);
        sf::FloatRect sBounds = stateText.getLocalBounds();
        stateText.setPosition(sf::Vector2f(panelX + 15 + (panelWidth - 30 - sBounds.size.x) / 2, stateY + 13));
        m_window.draw(stateText);
    }
    
    // Draw check highlight on king with gradient effect
    if (state == GameState::Check || state == GameState::Checkmate) {
        Position kingPos = const_cast<Board&>(m_board).findKing(currentTurn);
        if (kingPos.isValid()) {
            // Outer glow
            sf::RectangleShape checkGlow(sf::Vector2f(m_tileSize + 8, m_tileSize + 8));
            checkGlow.setPosition(sf::Vector2f(m_boardOffset.x + kingPos.col * m_tileSize - 4,
                                              m_boardOffset.y + kingPos.row * m_tileSize - 4));
            checkGlow.setFillColor(sf::Color(255, 0, 0, 60));
            m_window.draw(checkGlow);
            
            sf::RectangleShape checkHighlight(sf::Vector2f(m_tileSize, m_tileSize));
            checkHighlight.setPosition(sf::Vector2f(m_boardOffset.x + kingPos.col * m_tileSize,
                                      m_boardOffset.y + kingPos.row * m_tileSize));
            checkHighlight.setFillColor(m_checkColor);
            m_window.draw(checkHighlight);
        }
    }
    
    // Instructions at bottom with better styling
    float helpY = m_boardOffset.y + 8 * m_tileSize + 20;
    
    sf::RectangleShape helpBg(sf::Vector2f(8 * m_tileSize, 35));
    helpBg.setPosition(sf::Vector2f(m_boardOffset.x, helpY));
    helpBg.setFillColor(sf::Color(30, 34, 42, 200));
    m_window.draw(helpBg);
    
    sf::Text helpText(*m_font, "R = Nouvelle partie | ESC = Quitter", 13);
    helpText.setFillColor(sf::Color(140, 140, 140));
    sf::FloatRect helpBounds = helpText.getLocalBounds();
    helpText.setPosition(sf::Vector2f(m_boardOffset.x + (8 * m_tileSize - helpBounds.size.x) / 2, helpY + 10));
    m_window.draw(helpText);
}

Position Renderer::screenToBoard(int x, int y) const {
    int col = static_cast<int>((x - m_boardOffset.x) / m_tileSize);
    int row = static_cast<int>((y - m_boardOffset.y) / m_tileSize);
    
    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
        return {row, col};
    }
    return {-1, -1};
}

void Renderer::setAnimating(bool animating, const Position& from, const Position& to) {
    m_isAnimating = animating;
    m_animFrom = from;
    m_animTo = to;
    m_animProgress = 0.0f;
}

void Renderer::updateAnimation(float dt) {
    if (m_isAnimating) {
        m_animProgress += dt / ANIM_DURATION;
        if (m_animProgress >= 1.0f) {
            m_animProgress = 1.0f;
            m_isAnimating = false;
        }
    }
}

sf::String Renderer::getPieceString(const Piece& piece) const {
    sf::String result;
    result += static_cast<char32_t>(piece.getUnicodeChar());
    return result;
}

void Renderer::drawGameOverOverlay(GameState state, Color currentTurn) {
    if (!m_font) return;
    
    // Semi-transparent dark overlay
    sf::RectangleShape overlay(sf::Vector2f(static_cast<float>(m_window.getSize().x), 
                                            static_cast<float>(m_window.getSize().y)));
    overlay.setFillColor(sf::Color(0, 0, 0, 180));
    m_window.draw(overlay);
    
    // Main dialog
    float dialogWidth = 400;
    float dialogHeight = 220;
    float dialogX = (m_window.getSize().x - dialogWidth) / 2;
    float dialogY = (m_window.getSize().y - dialogHeight) / 2 - 30;
    
    // Glow effect
    sf::Color glowColor = (state == GameState::Checkmate) ? sf::Color(100, 200, 100, 40) : sf::Color(150, 150, 200, 40);
    sf::RectangleShape glow(sf::Vector2f(dialogWidth + 30, dialogHeight + 30));
    glow.setPosition(sf::Vector2f(dialogX - 15, dialogY - 15));
    glow.setFillColor(glowColor);
    m_window.draw(glow);
    
    // Dialog background
    sf::RectangleShape dialog(sf::Vector2f(dialogWidth, dialogHeight));
    dialog.setPosition(sf::Vector2f(dialogX, dialogY));
    dialog.setFillColor(sf::Color(35, 40, 48));
    dialog.setOutlineColor((state == GameState::Checkmate) ? sf::Color(100, 200, 100) : sf::Color(180, 180, 220));
    dialog.setOutlineThickness(4);
    m_window.draw(dialog);
    
    // Header
    sf::Color headerColor = (state == GameState::Checkmate) ? sf::Color(70, 140, 70) : sf::Color(100, 100, 140);
    sf::RectangleShape header(sf::Vector2f(dialogWidth, 55));
    header.setPosition(sf::Vector2f(dialogX, dialogY));
    header.setFillColor(headerColor);
    m_window.draw(header);
    
    // Title
    std::string title;
    std::string subtitle;
    sf::String icon;
    
    if (state == GameState::Checkmate) {
        title = "ECHEC ET MAT !";
        subtitle = (currentTurn == Color::White) ? "Les Noirs remportent la partie" : "Les Blancs remportent la partie";
        icon += (currentTurn == Color::White) ? U'♚' : U'♔';
    } else if (state == GameState::Stalemate) {
        title = "PAT !";
        subtitle = "Match nul - Aucun coup legal possible";
        icon += U'♔';
    }
    
    sf::Text titleText(*m_font, title, 28);
    titleText.setFillColor(sf::Color::White);
    titleText.setStyle(sf::Text::Bold);
    sf::FloatRect titleBounds = titleText.getLocalBounds();
    titleText.setPosition(sf::Vector2f(dialogX + (dialogWidth - titleBounds.size.x) / 2, dialogY + 12));
    m_window.draw(titleText);
    
    // Large icon
    sf::Text iconText(*m_font, icon, 70);
    iconText.setFillColor(sf::Color::White);
    if (state == GameState::Checkmate) {
        iconText.setFillColor((currentTurn == Color::White) ? sf::Color(50, 50, 50) : sf::Color::White);
        if (currentTurn == Color::Black) {
            iconText.setOutlineColor(sf::Color(80, 80, 80));
            iconText.setOutlineThickness(2);
        }
    }
    sf::FloatRect iconBounds = iconText.getLocalBounds();
    iconText.setPosition(sf::Vector2f(dialogX + (dialogWidth - iconBounds.size.x) / 2 - iconBounds.position.x, dialogY + 65));
    m_window.draw(iconText);
    
    // Subtitle
    sf::Text subtitleText(*m_font, subtitle, 16);
    subtitleText.setFillColor(sf::Color(200, 200, 200));
    sf::FloatRect subBounds = subtitleText.getLocalBounds();
    subtitleText.setPosition(sf::Vector2f(dialogX + (dialogWidth - subBounds.size.x) / 2, dialogY + 145));
    m_window.draw(subtitleText);
    
    // Restart hint
    sf::RectangleShape hintBox(sf::Vector2f(200, 35));
    hintBox.setPosition(sf::Vector2f(dialogX + (dialogWidth - 200) / 2, dialogY + 175));
    hintBox.setFillColor(sf::Color(50, 55, 65));
    hintBox.setOutlineColor(sf::Color(80, 85, 95));
    hintBox.setOutlineThickness(1);
    m_window.draw(hintBox);
    
    sf::Text hintText(*m_font, "Appuyez sur R pour rejouer", 14);
    hintText.setFillColor(sf::Color(150, 200, 150));
    sf::FloatRect hintBounds = hintText.getLocalBounds();
    hintText.setPosition(sf::Vector2f(dialogX + (dialogWidth - hintBounds.size.x) / 2, dialogY + 183));
    m_window.draw(hintText);
}

} // namespace Chess
