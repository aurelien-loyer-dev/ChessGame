#pragma once

#include "Types.hpp"
#include "Board.hpp"
#include "ChessLogic.hpp"
#include "Renderer.hpp"
#include "SoundManager.hpp"
#include "AIPlayer.hpp"
#include <SFML/Graphics.hpp>
#include <memory>
#include <optional>

namespace Chess {

// Structure pour les boutons de menu
struct Button {
    sf::FloatRect bounds;
    std::string text;
    bool hovered = false;
    bool selected = false;
};

// Options de temps disponibles
enum class TimeOption {
    NoTimer = 0,
    OneMinute = 1,
    ThreeMinutes = 3,
    FiveMinutes = 5,
    TenMinutes = 10,
    FifteenMinutes = 15,
    ThirtyMinutes = 30
};

// Mode de jeu
enum class GameMode {
    PlayerVsPlayer,
    PlayerVsAI
};

class Game {
public:
    Game();
    ~Game();
    
    bool initialize();
    void run();

private:
    void processEvents();
    void update(float dt);
    void render();
    
    void handleClick(int x, int y);
    void handlePromotion(PieceType type);
    void selectPiece(const Position& pos);
    void deselectPiece();
    void tryMove(const Position& to);
    void drawPromotionDialog();
    
    void resetGame();
    
    // Menu functions
    void handleMenuClick(int x, int y);
    void handleMouseMove(int x, int y);
    void drawMainMenu();
    void drawGameOverMenu();
    void drawTimer();
    void initMenuButtons();
    void updateTimer(float dt);
    std::string formatTime(float seconds);
    
    // AI functions
    void makeAIMove();
    void updateAI();

private:
    std::unique_ptr<sf::RenderWindow> m_window;
    std::unique_ptr<Board> m_board;
    std::unique_ptr<ChessLogic> m_logic;
    std::unique_ptr<Renderer> m_renderer;
    std::unique_ptr<SoundManager> m_soundManager;
    std::unique_ptr<AIPlayer> m_aiPlayer;
    
    std::optional<Position> m_selectedPosition;
    std::vector<Move> m_currentLegalMoves;
    
    bool m_waitingForPromotion;
    Move m_pendingPromotionMove;
    
    GameState m_gameState;
    
    sf::Clock m_clock;
    sf::Font m_menuFont;
    
    // Menu buttons
    Button m_playButton;
    Button m_restartButton;
    Button m_quitButton;
    
    // Time selection buttons
    std::vector<Button> m_timeButtons;
    TimeOption m_selectedTime;
    
    // Timer
    float m_whiteTime;
    float m_blackTime;
    bool m_timerEnabled;
    
    // Game mode
    GameMode m_gameMode;
    Button m_pvpButton;
    Button m_pvaButton;
    
    // AI difficulty buttons
    std::vector<Button> m_difficultyButtons;
    AIDifficulty m_selectedDifficulty;
    
    Color m_playerColor;
    
    // AI state
    bool m_aiThinking;
    Color m_aiColor;
    
    static constexpr int WINDOW_WIDTH = 1000;
    static constexpr int WINDOW_HEIGHT = 850;
};

} // namespace Chess
