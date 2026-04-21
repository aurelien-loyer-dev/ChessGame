#include "Game.hpp"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <random>

namespace Chess {

Game::Game()
    : m_waitingForPromotion(false)
    , m_gameState(GameState::MainMenu)
    , m_selectedTime(TimeOption::FiveMinutes)
    , m_whiteTime(300.0f)
    , m_blackTime(300.0f)
    , m_timerEnabled(true)
    , m_gameMode(GameMode::PlayerVsPlayer)
    , m_selectedDifficulty(AIDifficulty::Medium)
    , m_playerColor(Color::White)
    , m_aiThinking(false)
    , m_aiColor(Color::Black) {
}

Game::~Game() = default;

bool Game::initialize() {
    m_window = std::make_unique<sf::RenderWindow>(
        sf::VideoMode(sf::Vector2u(WINDOW_WIDTH, WINDOW_HEIGHT)),
        "Chess - SFML",
        sf::Style::Close | sf::Style::Titlebar
    );
    m_window->setFramerateLimit(60);
    
    m_board = std::make_unique<Board>();
    m_board->initialize();
    m_logic = std::make_unique<ChessLogic>(*m_board);
    m_aiPlayer = std::make_unique<AIPlayer>(*m_board, *m_logic);
    
    m_renderer = std::make_unique<Renderer>(*m_window, *m_board);
    if (!m_renderer->loadResources()) {
        std::cerr << "Warning: Some resources could not be loaded." << std::endl;
    }
    
    m_soundManager = std::make_unique<SoundManager>();
    initMenuButtons();
    
    return true;
}

void Game::initMenuButtons() {
    float buttonWidth = 250;
    float buttonHeight = 60;
    float centerX = WINDOW_WIDTH / 2 - buttonWidth / 2;
    
    m_playButton.bounds = sf::FloatRect(sf::Vector2f(centerX, 650), sf::Vector2f(buttonWidth, buttonHeight));
    m_playButton.text = "Jouer";
    
    m_restartButton.bounds = sf::FloatRect(sf::Vector2f(centerX, 420), sf::Vector2f(buttonWidth, buttonHeight));
    m_restartButton.text = "Rejouer";
    
    m_quitButton.bounds = sf::FloatRect(sf::Vector2f(centerX, 730), sf::Vector2f(buttonWidth, buttonHeight));
    m_quitButton.text = "Quitter";
    
    // Game mode buttons
    float modeButtonWidth = 200;
    float modeButtonHeight = 50;
    float totalModeWidth = 2 * modeButtonWidth + 15;
    float modeStartX = (WINDOW_WIDTH - totalModeWidth) / 2;
    float modeY = 280;
    
    m_pvpButton.bounds = sf::FloatRect(sf::Vector2f(modeStartX, modeY), sf::Vector2f(modeButtonWidth, modeButtonHeight));
    m_pvpButton.text = "Joueur vs Joueur";
    m_pvpButton.selected = (m_gameMode == GameMode::PlayerVsPlayer);
    
    m_pvaButton.bounds = sf::FloatRect(sf::Vector2f(modeStartX + modeButtonWidth + 15, modeY), sf::Vector2f(modeButtonWidth, modeButtonHeight));
    m_pvaButton.text = "Joueur vs IA";
    m_pvaButton.selected = (m_gameMode == GameMode::PlayerVsAI);
    
    // AI Difficulty buttons
    m_difficultyButtons.clear();
    std::vector<std::pair<std::string, AIDifficulty>> difficultyOptions = {
        {"Facile", AIDifficulty::Easy},
        {"Moyen", AIDifficulty::Medium},
        {"Difficile", AIDifficulty::Hard},
        {"Expert", AIDifficulty::Expert}
    };
    
    float diffBtnWidth = 100;
    float diffBtnHeight = 40;
    float diffStartX = (WINDOW_WIDTH - (difficultyOptions.size() * diffBtnWidth + (difficultyOptions.size() - 1) * 10)) / 2;
    float diffY = 370;
    
    for (size_t i = 0; i < difficultyOptions.size(); ++i) {
        Button btn;
        btn.bounds = sf::FloatRect(sf::Vector2f(diffStartX + i * (diffBtnWidth + 10), diffY), sf::Vector2f(diffBtnWidth, diffBtnHeight));
        btn.text = difficultyOptions[i].first;
        btn.selected = (difficultyOptions[i].second == m_selectedDifficulty);
        m_difficultyButtons.push_back(btn);
    }
    
    // Time selection buttons
    m_timeButtons.clear();
    std::vector<std::pair<std::string, TimeOption>> timeOptions = {
        {"Sans timer", TimeOption::NoTimer},
        {"1 min", TimeOption::OneMinute},
        {"3 min", TimeOption::ThreeMinutes},
        {"5 min", TimeOption::FiveMinutes},
        {"10 min", TimeOption::TenMinutes},
        {"15 min", TimeOption::FifteenMinutes},
        {"30 min", TimeOption::ThirtyMinutes}
    };
    
    float btnWidth = 100;
    float btnHeight = 40;
    float startX = (WINDOW_WIDTH - (timeOptions.size() * btnWidth + (timeOptions.size() - 1) * 10)) / 2;
    float btnY = 520;
    
    for (size_t i = 0; i < timeOptions.size(); ++i) {
        Button btn;
        btn.bounds = sf::FloatRect(sf::Vector2f(startX + i * (btnWidth + 10), btnY), sf::Vector2f(btnWidth, btnHeight));
        btn.text = timeOptions[i].first;
        btn.selected = (timeOptions[i].second == m_selectedTime);
        m_timeButtons.push_back(btn);
    }
}

void Game::run() {
    while (m_window->isOpen()) {
        float dt = m_clock.restart().asSeconds();
        processEvents();
        update(dt);
        render();
    }
}

void Game::processEvents() {
    while (const std::optional event = m_window->pollEvent()) {
        if (event->is<sf::Event::Closed>()) {
            m_window->close();
        }
        else if (const auto* mouseMoved = event->getIf<sf::Event::MouseMoved>()) {
            handleMouseMove(mouseMoved->position.x, mouseMoved->position.y);
        }
        else if (const auto* keyPressed = event->getIf<sf::Event::KeyPressed>()) {
            if (keyPressed->code == sf::Keyboard::Key::Escape) {
                if (m_gameState == GameState::MainMenu) {
                    m_window->close();
                } else if (m_gameState == GameState::Playing || m_gameState == GameState::Check) {
                    m_gameState = GameState::MainMenu;
                }
            } else if (keyPressed->code == sf::Keyboard::Key::R && 
                      (m_gameState == GameState::Playing || m_gameState == GameState::Check)) {
                resetGame();
                m_soundManager->playMenuClick();
            }
            else if (m_waitingForPromotion) {
                if (keyPressed->code == sf::Keyboard::Key::Q) {
                    handlePromotion(PieceType::Queen);
                } else if (keyPressed->code == sf::Keyboard::Key::R) {
                    handlePromotion(PieceType::Rook);
                } else if (keyPressed->code == sf::Keyboard::Key::B) {
                    handlePromotion(PieceType::Bishop);
                } else if (keyPressed->code == sf::Keyboard::Key::N) {
                    handlePromotion(PieceType::Knight);
                }
            }
        }
        else if (const auto* mousePressed = event->getIf<sf::Event::MouseButtonPressed>()) {
            if (mousePressed->button == sf::Mouse::Button::Left) {
                if (m_gameState == GameState::MainMenu) {
                    handleMenuClick(mousePressed->position.x, mousePressed->position.y);
                } else if (m_gameState == GameState::Checkmate || 
                          m_gameState == GameState::Stalemate || 
                          m_gameState == GameState::Draw ||
                          m_gameState == GameState::WhiteTimeout ||
                          m_gameState == GameState::BlackTimeout) {
                    handleMenuClick(mousePressed->position.x, mousePressed->position.y);
                } else if (!m_renderer->isAnimating() && !m_waitingForPromotion) {
                    handleClick(mousePressed->position.x, mousePressed->position.y);
                }
            } else if (mousePressed->button == sf::Mouse::Button::Right) {
                deselectPiece();
            }
        }
    }
}

void Game::handleMouseMove(int x, int y) {
    sf::Vector2f pos(static_cast<float>(x), static_cast<float>(y));
    
    bool wasPlayHovered = m_playButton.hovered;
    bool wasRestartHovered = m_restartButton.hovered;
    bool wasQuitHovered = m_quitButton.hovered;
    bool wasPvpHovered = m_pvpButton.hovered;
    bool wasPvaHovered = m_pvaButton.hovered;
    
    m_playButton.hovered = m_playButton.bounds.contains(pos);
    m_restartButton.hovered = m_restartButton.bounds.contains(pos);
    m_quitButton.hovered = m_quitButton.bounds.contains(pos);
    m_pvpButton.hovered = m_pvpButton.bounds.contains(pos);
    m_pvaButton.hovered = m_pvaButton.bounds.contains(pos);
    
    bool anyTimeHovered = false;
    for (auto& btn : m_timeButtons) {
        bool wasHovered = btn.hovered;
        btn.hovered = btn.bounds.contains(pos);
        if (btn.hovered && !wasHovered) anyTimeHovered = true;
    }
    
    bool anyDiffHovered = false;
    for (auto& btn : m_difficultyButtons) {
        bool wasHovered = btn.hovered;
        btn.hovered = btn.bounds.contains(pos);
        if (btn.hovered && !wasHovered) anyDiffHovered = true;
    }
    
    if ((m_playButton.hovered && !wasPlayHovered) ||
        (m_restartButton.hovered && !wasRestartHovered) ||
        (m_quitButton.hovered && !wasQuitHovered) ||
        (m_pvpButton.hovered && !wasPvpHovered) ||
        (m_pvaButton.hovered && !wasPvaHovered) ||
        anyTimeHovered || anyDiffHovered) {
        m_soundManager->playMenuHover();
    }
}

void Game::handleMenuClick(int x, int y) {
    sf::Vector2f pos(static_cast<float>(x), static_cast<float>(y));
    
    if (m_gameState == GameState::MainMenu) {
        // Check game mode buttons
        if (m_pvpButton.bounds.contains(pos)) {
            m_soundManager->playMenuClick();
            m_gameMode = GameMode::PlayerVsPlayer;
            m_pvpButton.selected = true;
            m_pvaButton.selected = false;
        } else if (m_pvaButton.bounds.contains(pos)) {
            m_soundManager->playMenuClick();
            m_gameMode = GameMode::PlayerVsAI;
            m_pvpButton.selected = false;
            m_pvaButton.selected = true;
        }
        
        // Check difficulty buttons (only if vs AI mode)
        if (m_gameMode == GameMode::PlayerVsAI) {
            std::vector<AIDifficulty> diffValues = {
                AIDifficulty::Easy,
                AIDifficulty::Medium,
                AIDifficulty::Hard,
                AIDifficulty::Expert
            };
            
            for (size_t i = 0; i < m_difficultyButtons.size(); ++i) {
                if (m_difficultyButtons[i].bounds.contains(pos)) {
                    m_soundManager->playMenuClick();
                    m_selectedDifficulty = diffValues[i];
                    for (auto& btn : m_difficultyButtons) btn.selected = false;
                    m_difficultyButtons[i].selected = true;
                }
            }
        }
        
        // Check time buttons
        std::vector<TimeOption> timeValues = {
            TimeOption::NoTimer,
            TimeOption::OneMinute,
            TimeOption::ThreeMinutes,
            TimeOption::FiveMinutes,
            TimeOption::TenMinutes,
            TimeOption::FifteenMinutes,
            TimeOption::ThirtyMinutes
        };
        
        for (size_t i = 0; i < m_timeButtons.size(); ++i) {
            if (m_timeButtons[i].bounds.contains(pos)) {
                m_soundManager->playMenuClick();
                m_selectedTime = timeValues[i];
                for (auto& btn : m_timeButtons) btn.selected = false;
                m_timeButtons[i].selected = true;
            }
        }
        
        if (m_playButton.bounds.contains(pos)) {
            m_soundManager->playMenuClick();
            resetGame();
            m_gameState = GameState::Playing;
        } else if (m_quitButton.bounds.contains(pos)) {
            m_soundManager->playMenuClick();
            m_window->close();
        }
    } else if (m_gameState == GameState::Checkmate || 
               m_gameState == GameState::Stalemate || 
               m_gameState == GameState::Draw ||
               m_gameState == GameState::WhiteTimeout ||
               m_gameState == GameState::BlackTimeout) {
        if (m_restartButton.bounds.contains(pos)) {
            m_soundManager->playMenuClick();
            resetGame();
            m_gameState = GameState::Playing;
        } else if (m_quitButton.bounds.contains(pos)) {
            m_soundManager->playMenuClick();
            m_gameState = GameState::MainMenu;
        }
    }
}

void Game::updateTimer(float dt) {
    if (!m_timerEnabled) return;
    if (m_gameState != GameState::Playing && m_gameState != GameState::Check) return;
    if (m_waitingForPromotion) return;
    
    if (m_logic->getCurrentTurn() == Color::White) {
        m_whiteTime -= dt;
        if (m_whiteTime <= 0) {
            m_whiteTime = 0;
            m_gameState = GameState::WhiteTimeout;
            m_soundManager->playGameOver();
        }
    } else {
        m_blackTime -= dt;
        if (m_blackTime <= 0) {
            m_blackTime = 0;
            m_gameState = GameState::BlackTimeout;
            m_soundManager->playGameOver();
        }
    }
}

void Game::update(float dt) {
    m_renderer->updateAnimation(dt);
    
    if (m_gameState == GameState::Playing || m_gameState == GameState::Check) {
        updateTimer(dt);
        updateAI();
        
        if (m_gameState != GameState::WhiteTimeout && m_gameState != GameState::BlackTimeout) {
            GameState newState = m_logic->getGameState();
            if (newState != m_gameState) {
                if (newState == GameState::Checkmate || 
                    newState == GameState::Stalemate || 
                    newState == GameState::Draw) {
                    m_soundManager->playGameOver();
                } else if (newState == GameState::Check && m_gameState != GameState::Check) {
                    m_soundManager->playCheck();
                }
                m_gameState = newState;
            }
        }
    }
}

std::string Game::formatTime(float seconds) {
    int mins = static_cast<int>(seconds) / 60;
    int secs = static_cast<int>(seconds) % 60;
    std::ostringstream oss;
    oss << mins << ":" << std::setfill('0') << std::setw(2) << secs;
    return oss.str();
}

void Game::drawTimer() {
    if (!m_timerEnabled) return;
    
    const sf::Font* font = m_renderer->getFont();
    if (!font) return;
    
    float timerX = 820;
    float timerWidth = 160;
    
    // Black timer (top)
    sf::RectangleShape blackTimerBg(sf::Vector2f(timerWidth, 60));
    blackTimerBg.setPosition(sf::Vector2f(timerX, 30));
    bool blackTurn = (m_logic->getCurrentTurn() == Color::Black);
    blackTimerBg.setFillColor(blackTurn ? sf::Color(60, 60, 60) : sf::Color(40, 40, 40));
    blackTimerBg.setOutlineColor(blackTurn ? sf::Color(200, 100, 100) : sf::Color(80, 80, 80));
    blackTimerBg.setOutlineThickness(blackTurn ? 3 : 1);
    m_window->draw(blackTimerBg);
    
    sf::Color blackTimeColor = (m_blackTime < 30) ? sf::Color(255, 100, 100) : sf::Color::White;
    sf::Text blackTimeText(*font, formatTime(m_blackTime), 32);
    blackTimeText.setFillColor(blackTimeColor);
    sf::FloatRect blackBounds = blackTimeText.getLocalBounds();
    blackTimeText.setPosition(sf::Vector2f(timerX + (timerWidth - blackBounds.size.x) / 2, 42));
    m_window->draw(blackTimeText);
    
    sf::Text blackLabel(*font, "NOIRS", 14);
    blackLabel.setFillColor(sf::Color(150, 150, 150));
    sf::FloatRect blackLabelBounds = blackLabel.getLocalBounds();
    blackLabel.setPosition(sf::Vector2f(timerX + (timerWidth - blackLabelBounds.size.x) / 2, 15));
    m_window->draw(blackLabel);
    
    // White timer (bottom)
    sf::RectangleShape whiteTimerBg(sf::Vector2f(timerWidth, 60));
    whiteTimerBg.setPosition(sf::Vector2f(timerX, 760));
    bool whiteTurn = (m_logic->getCurrentTurn() == Color::White);
    whiteTimerBg.setFillColor(whiteTurn ? sf::Color(80, 80, 80) : sf::Color(50, 50, 50));
    whiteTimerBg.setOutlineColor(whiteTurn ? sf::Color(100, 200, 100) : sf::Color(80, 80, 80));
    whiteTimerBg.setOutlineThickness(whiteTurn ? 3 : 1);
    m_window->draw(whiteTimerBg);
    
    sf::Color whiteTimeColor = (m_whiteTime < 30) ? sf::Color(255, 100, 100) : sf::Color::White;
    sf::Text whiteTimeText(*font, formatTime(m_whiteTime), 32);
    whiteTimeText.setFillColor(whiteTimeColor);
    sf::FloatRect whiteBounds = whiteTimeText.getLocalBounds();
    whiteTimeText.setPosition(sf::Vector2f(timerX + (timerWidth - whiteBounds.size.x) / 2, 772));
    m_window->draw(whiteTimeText);
    
    sf::Text whiteLabel(*font, "BLANCS", 14);
    whiteLabel.setFillColor(sf::Color(150, 150, 150));
    sf::FloatRect whiteLabelBounds = whiteLabel.getLocalBounds();
    whiteLabel.setPosition(sf::Vector2f(timerX + (timerWidth - whiteLabelBounds.size.x) / 2, 830));
    m_window->draw(whiteLabel);
}

void Game::render() {
    m_window->clear(sf::Color(30, 30, 30));
    
    if (m_gameState == GameState::MainMenu) {
        drawMainMenu();
    } else {
        Position* selectedPtr = m_selectedPosition.has_value() ? &m_selectedPosition.value() : nullptr;
        std::vector<Move>* movesPtr = m_currentLegalMoves.empty() ? nullptr : &m_currentLegalMoves;
        
        m_renderer->render(selectedPtr, movesPtr, m_gameState, m_logic->getCurrentTurn());
        
        drawTimer();
        
        if (m_waitingForPromotion) {
            drawPromotionDialog();
        }
        
        if (m_gameState == GameState::Checkmate || 
            m_gameState == GameState::Stalemate || 
            m_gameState == GameState::Draw ||
            m_gameState == GameState::WhiteTimeout ||
            m_gameState == GameState::BlackTimeout) {
            drawGameOverMenu();
        }
    }
    
    m_window->display();
}

void Game::drawMainMenu() {
    const sf::Font* font = m_renderer->getFont();
    if (!font) return;
    
    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            sf::RectangleShape square(sf::Vector2f(100.f, 100.f));
            square.setPosition(sf::Vector2f(static_cast<float>(i * 125), static_cast<float>(j * 110)));
            if ((i + j) % 2 == 0) {
                square.setFillColor(sf::Color(60, 60, 60, 100));
            } else {
                square.setFillColor(sf::Color(40, 40, 40, 100));
            }
            m_window->draw(square);
        }
    }
    
    sf::Text title(*font, "ECHECS", 72);
    title.setFillColor(sf::Color(118, 150, 86));
    title.setStyle(sf::Text::Bold);
    sf::FloatRect titleBounds = title.getLocalBounds();
    title.setPosition(sf::Vector2f((WINDOW_WIDTH - titleBounds.size.x) / 2, 80));
    m_window->draw(title);
    
    sf::Text subtitle(*font, sf::String(U"\u2654 \u2655 \u2656 \u2657 \u2658 \u2659"), 36);
    subtitle.setFillColor(sf::Color(180, 180, 180));
    sf::FloatRect subBounds = subtitle.getLocalBounds();
    subtitle.setPosition(sf::Vector2f((WINDOW_WIDTH - subBounds.size.x) / 2, 170));
    m_window->draw(subtitle);
    
    // Game mode label
    sf::Text modeLabel(*font, "Mode de jeu:", 22);
    modeLabel.setFillColor(sf::Color(200, 200, 200));
    sf::FloatRect modeLabelBounds = modeLabel.getLocalBounds();
    modeLabel.setPosition(sf::Vector2f((WINDOW_WIDTH - modeLabelBounds.size.x) / 2, 240));
    m_window->draw(modeLabel);
    
    // Game mode buttons
    auto drawModeButton = [&](const Button& btn) {
        sf::Color btnColor;
        if (btn.selected) {
            btnColor = sf::Color(118, 150, 86);
        } else if (btn.hovered) {
            btnColor = sf::Color(80, 100, 60);
        } else {
            btnColor = sf::Color(60, 60, 60);
        }
        
        sf::RectangleShape btnShape(sf::Vector2f(btn.bounds.size.x, btn.bounds.size.y));
        btnShape.setPosition(sf::Vector2f(btn.bounds.position.x, btn.bounds.position.y));
        btnShape.setFillColor(btnColor);
        btnShape.setOutlineColor(btn.selected ? sf::Color(150, 200, 100) : sf::Color(80, 80, 80));
        btnShape.setOutlineThickness(btn.selected ? 2 : 1);
        m_window->draw(btnShape);
        
        sf::Text btnText(*font, btn.text, 16);
        btnText.setFillColor(sf::Color::White);
        sf::FloatRect btnTextBounds = btnText.getLocalBounds();
        btnText.setPosition(sf::Vector2f(
            btn.bounds.position.x + (btn.bounds.size.x - btnTextBounds.size.x) / 2,
            btn.bounds.position.y + (btn.bounds.size.y - btnTextBounds.size.y) / 2 - 3
        ));
        m_window->draw(btnText);
    };
    
    drawModeButton(m_pvpButton);
    drawModeButton(m_pvaButton);
    
    // AI Difficulty section (only visible when vs AI)
    if (m_gameMode == GameMode::PlayerVsAI) {
        sf::Text diffLabel(*font, "Difficulte de l'IA:", 22);
        diffLabel.setFillColor(sf::Color(200, 200, 200));
        sf::FloatRect diffLabelBounds = diffLabel.getLocalBounds();
        diffLabel.setPosition(sf::Vector2f((WINDOW_WIDTH - diffLabelBounds.size.x) / 2, 340));
        m_window->draw(diffLabel);
        
        for (const auto& btn : m_difficultyButtons) {
            sf::Color btnColor;
            if (btn.selected) {
                btnColor = sf::Color(180, 120, 60);
            } else if (btn.hovered) {
                btnColor = sf::Color(140, 100, 50);
            } else {
                btnColor = sf::Color(80, 60, 40);
            }
            
            sf::RectangleShape btnShape(sf::Vector2f(btn.bounds.size.x, btn.bounds.size.y));
            btnShape.setPosition(sf::Vector2f(btn.bounds.position.x, btn.bounds.position.y));
            btnShape.setFillColor(btnColor);
            btnShape.setOutlineColor(btn.selected ? sf::Color(220, 160, 80) : sf::Color(100, 80, 60));
            btnShape.setOutlineThickness(btn.selected ? 2 : 1);
            m_window->draw(btnShape);
            
            sf::Text btnText(*font, btn.text, 14);
            btnText.setFillColor(sf::Color::White);
            sf::FloatRect btnTextBounds = btnText.getLocalBounds();
            btnText.setPosition(sf::Vector2f(
                btn.bounds.position.x + (btn.bounds.size.x - btnTextBounds.size.x) / 2,
                btn.bounds.position.y + (btn.bounds.size.y - btnTextBounds.size.y) / 2 - 3
            ));
            m_window->draw(btnText);
        }
    }
    
    // Time selection label
    sf::Text timeLabel(*font, "Temps par joueur:", 22);
    timeLabel.setFillColor(sf::Color(200, 200, 200));
    sf::FloatRect timeLabelBounds = timeLabel.getLocalBounds();
    timeLabel.setPosition(sf::Vector2f((WINDOW_WIDTH - timeLabelBounds.size.x) / 2, 470));
    m_window->draw(timeLabel);
    
    // Time buttons
    for (const auto& btn : m_timeButtons) {
        sf::Color btnColor;
        if (btn.selected) {
            btnColor = sf::Color(118, 150, 86);
        } else if (btn.hovered) {
            btnColor = sf::Color(80, 100, 60);
        } else {
            btnColor = sf::Color(60, 60, 60);
        }
        
        sf::RectangleShape btnShape(sf::Vector2f(btn.bounds.size.x, btn.bounds.size.y));
        btnShape.setPosition(sf::Vector2f(btn.bounds.position.x, btn.bounds.position.y));
        btnShape.setFillColor(btnColor);
        btnShape.setOutlineColor(btn.selected ? sf::Color(150, 200, 100) : sf::Color(80, 80, 80));
        btnShape.setOutlineThickness(btn.selected ? 2 : 1);
        m_window->draw(btnShape);
        
        sf::Text btnText(*font, btn.text, 14);
        btnText.setFillColor(sf::Color::White);
        sf::FloatRect btnTextBounds = btnText.getLocalBounds();
        btnText.setPosition(sf::Vector2f(
            btn.bounds.position.x + (btn.bounds.size.x - btnTextBounds.size.x) / 2,
            btn.bounds.position.y + (btn.bounds.size.y - btnTextBounds.size.y) / 2 - 3
        ));
        m_window->draw(btnText);
    }
    
    // Play button
    sf::Color playColor = m_playButton.hovered ? sf::Color(140, 180, 100) : sf::Color(118, 150, 86);
    sf::RectangleShape playBtn(sf::Vector2f(m_playButton.bounds.size.x, m_playButton.bounds.size.y));
    playBtn.setPosition(sf::Vector2f(m_playButton.bounds.position.x, m_playButton.bounds.position.y));
    playBtn.setFillColor(playColor);
    playBtn.setOutlineColor(sf::Color(90, 120, 60));
    playBtn.setOutlineThickness(3);
    m_window->draw(playBtn);
    
    sf::Text playText(*font, m_playButton.text, 28);
    playText.setFillColor(sf::Color::White);
    playText.setStyle(sf::Text::Bold);
    sf::FloatRect playBounds = playText.getLocalBounds();
    playText.setPosition(sf::Vector2f(
        m_playButton.bounds.position.x + (m_playButton.bounds.size.x - playBounds.size.x) / 2,
        m_playButton.bounds.position.y + (m_playButton.bounds.size.y - playBounds.size.y) / 2 - 5
    ));
    m_window->draw(playText);
    
    // Quit button
    sf::Color quitColor = m_quitButton.hovered ? sf::Color(180, 80, 80) : sf::Color(150, 60, 60);
    sf::RectangleShape quitBtn(sf::Vector2f(m_quitButton.bounds.size.x, m_quitButton.bounds.size.y));
    quitBtn.setPosition(sf::Vector2f(m_quitButton.bounds.position.x, m_quitButton.bounds.position.y));
    quitBtn.setFillColor(quitColor);
    quitBtn.setOutlineColor(sf::Color(120, 40, 40));
    quitBtn.setOutlineThickness(3);
    m_window->draw(quitBtn);
    
    sf::Text quitText(*font, m_quitButton.text, 28);
    quitText.setFillColor(sf::Color::White);
    quitText.setStyle(sf::Text::Bold);
    sf::FloatRect quitBounds = quitText.getLocalBounds();
    quitText.setPosition(sf::Vector2f(
        m_quitButton.bounds.position.x + (m_quitButton.bounds.size.x - quitBounds.size.x) / 2,
        m_quitButton.bounds.position.y + (m_quitButton.bounds.size.y - quitBounds.size.y) / 2 - 5
    ));
    m_window->draw(quitText);
}

void Game::drawGameOverMenu() {
    const sf::Font* font = m_renderer->getFont();
    if (!font) return;
    
    sf::RectangleShape overlay(sf::Vector2f(static_cast<float>(WINDOW_WIDTH), 
                                            static_cast<float>(WINDOW_HEIGHT)));
    overlay.setFillColor(sf::Color(0, 0, 0, 200));
    m_window->draw(overlay);
    
    std::string resultText;
    sf::Color resultColor;
    
    if (m_gameState == GameState::Checkmate) {
        Color winner = (m_logic->getCurrentTurn() == Color::White) ? Color::Black : Color::White;
        resultText = (winner == Color::White) ? "Les Blancs gagnent !" : "Les Noirs gagnent !";
        resultColor = sf::Color(220, 180, 50);
    } else if (m_gameState == GameState::Stalemate) {
        resultText = "PAT - Match nul !";
        resultColor = sf::Color(150, 150, 200);
    } else if (m_gameState == GameState::WhiteTimeout) {
        resultText = "Temps ecoule - Noirs gagnent !";
        resultColor = sf::Color(255, 100, 100);
    } else if (m_gameState == GameState::BlackTimeout) {
        resultText = "Temps ecoule - Blancs gagnent !";
        resultColor = sf::Color(255, 100, 100);
    } else {
        resultText = "Match nul !";
        resultColor = sf::Color(150, 150, 200);
    }
    
    sf::Text result(*font, resultText, 42);
    result.setFillColor(resultColor);
    result.setStyle(sf::Text::Bold);
    sf::FloatRect resultBounds = result.getLocalBounds();
    result.setPosition(sf::Vector2f((WINDOW_WIDTH - resultBounds.size.x) / 2, 200));
    m_window->draw(result);
    
    sf::Color restartColor = m_restartButton.hovered ? sf::Color(140, 180, 100) : sf::Color(118, 150, 86);
    sf::RectangleShape restartBtn(sf::Vector2f(m_restartButton.bounds.size.x, m_restartButton.bounds.size.y));
    restartBtn.setPosition(sf::Vector2f(m_restartButton.bounds.position.x, m_restartButton.bounds.position.y));
    restartBtn.setFillColor(restartColor);
    restartBtn.setOutlineColor(sf::Color(90, 120, 60));
    restartBtn.setOutlineThickness(3);
    m_window->draw(restartBtn);
    
    sf::Text restartText(*font, m_restartButton.text, 28);
    restartText.setFillColor(sf::Color::White);
    restartText.setStyle(sf::Text::Bold);
    sf::FloatRect restartBounds = restartText.getLocalBounds();
    restartText.setPosition(sf::Vector2f(
        m_restartButton.bounds.position.x + (m_restartButton.bounds.size.x - restartBounds.size.x) / 2,
        m_restartButton.bounds.position.y + (m_restartButton.bounds.size.y - restartBounds.size.y) / 2 - 5
    ));
    m_window->draw(restartText);
    
    sf::Color menuColor = m_quitButton.hovered ? sf::Color(100, 100, 120) : sf::Color(80, 80, 100);
    sf::RectangleShape menuBtn(sf::Vector2f(m_quitButton.bounds.size.x, m_quitButton.bounds.size.y));
    menuBtn.setPosition(sf::Vector2f(m_quitButton.bounds.position.x, m_quitButton.bounds.position.y));
    menuBtn.setFillColor(menuColor);
    menuBtn.setOutlineColor(sf::Color(60, 60, 80));
    menuBtn.setOutlineThickness(3);
    m_window->draw(menuBtn);
    
    sf::Text menuText(*font, "Menu", 28);
    menuText.setFillColor(sf::Color::White);
    menuText.setStyle(sf::Text::Bold);
    sf::FloatRect menuBounds = menuText.getLocalBounds();
    menuText.setPosition(sf::Vector2f(
        m_quitButton.bounds.position.x + (m_quitButton.bounds.size.x - menuBounds.size.x) / 2,
        m_quitButton.bounds.position.y + (m_quitButton.bounds.size.y - menuBounds.size.y) / 2 - 5
    ));
    m_window->draw(menuText);
}

void Game::drawPromotionDialog() {
    const sf::Font* font = m_renderer->getFont();
    if (!font) return;
    
    sf::RectangleShape overlay(sf::Vector2f(static_cast<float>(WINDOW_WIDTH), 
                                            static_cast<float>(WINDOW_HEIGHT)));
    overlay.setFillColor(sf::Color(0, 0, 0, 180));
    m_window->draw(overlay);
    
    float dialogWidth = 380;
    float dialogHeight = 200;
    float dialogX = (WINDOW_WIDTH - dialogWidth) / 2;
    float dialogY = (WINDOW_HEIGHT - dialogHeight) / 2;
    
    sf::RectangleShape dialog(sf::Vector2f(dialogWidth, dialogHeight));
    dialog.setPosition(sf::Vector2f(dialogX, dialogY));
    dialog.setFillColor(sf::Color(35, 40, 48));
    dialog.setOutlineColor(sf::Color(118, 150, 86));
    dialog.setOutlineThickness(3);
    m_window->draw(dialog);
    
    sf::RectangleShape header(sf::Vector2f(dialogWidth, 45));
    header.setPosition(sf::Vector2f(dialogX, dialogY));
    header.setFillColor(sf::Color(118, 150, 86));
    m_window->draw(header);
    
    sf::Text title(*font, "Promotion du Pion", 22);
    title.setFillColor(sf::Color::White);
    title.setStyle(sf::Text::Bold);
    sf::FloatRect titleBounds = title.getLocalBounds();
    title.setPosition(sf::Vector2f(dialogX + (dialogWidth - titleBounds.size.x) / 2, dialogY + 10));
    m_window->draw(title);
    
    Color promotionColor = m_logic->getCurrentTurn();
    PieceType pieces[] = {PieceType::Queen, PieceType::Rook, PieceType::Bishop, PieceType::Knight};
    std::string keys[] = {"Q", "R", "B", "N"};
    
    float pieceSize = 65;
    float spacing = 85;
    float startX = dialogX + (dialogWidth - 4 * spacing + (spacing - pieceSize)) / 2;
    float pieceY = dialogY + 60;
    
    for (int i = 0; i < 4; ++i) {
        float boxX = startX + i * spacing;
        
        sf::RectangleShape box(sf::Vector2f(pieceSize, pieceSize));
        box.setPosition(sf::Vector2f(boxX, pieceY));
        box.setFillColor(sf::Color(238, 238, 210));
        box.setOutlineColor(sf::Color(180, 180, 150));
        box.setOutlineThickness(2);
        m_window->draw(box);
        
        Piece p(pieces[i], promotionColor);
        sf::String sfStr;
        sfStr += static_cast<char32_t>(p.getUnicodeChar());
        
        sf::Text pieceText(*font, sfStr, 50);
        pieceText.setFillColor(promotionColor == Color::White ? sf::Color(255, 255, 255) : sf::Color(30, 30, 30));
        if (promotionColor == Color::White) {
            pieceText.setOutlineColor(sf::Color(50, 50, 50));
            pieceText.setOutlineThickness(1.5f);
        }
        sf::FloatRect pBounds = pieceText.getLocalBounds();
        pieceText.setPosition(sf::Vector2f(boxX + (pieceSize - pBounds.size.x) / 2 - pBounds.position.x, 
                                           pieceY + (pieceSize - pBounds.size.y) / 2 - pBounds.position.y - 5));
        m_window->draw(pieceText);
        
        sf::CircleShape keyBadge(12);
        keyBadge.setPosition(sf::Vector2f(boxX + pieceSize - 18, pieceY - 6));
        keyBadge.setFillColor(sf::Color(70, 130, 70));
        m_window->draw(keyBadge);
        
        sf::Text keyText(*font, keys[i], 14);
        keyText.setFillColor(sf::Color::White);
        keyText.setStyle(sf::Text::Bold);
        sf::FloatRect kBounds = keyText.getLocalBounds();
        keyText.setPosition(sf::Vector2f(boxX + pieceSize - 12 - kBounds.size.x / 2, pieceY - 3));
        m_window->draw(keyText);
    }
}

void Game::handleClick(int x, int y) {
    if (m_gameState == GameState::Checkmate || m_gameState == GameState::Stalemate || 
        m_gameState == GameState::Draw || m_gameState == GameState::WhiteTimeout ||
        m_gameState == GameState::BlackTimeout) {
        return;
    }
    
    // Block player input during AI turn
    if (m_gameMode == GameMode::PlayerVsAI && m_logic->getCurrentTurn() == m_aiColor) {
        return;
    }
    if (m_aiThinking) {
        return;
    }
    
    Position clickedPos = m_renderer->screenToBoard(x, y);
    
    if (!clickedPos.isValid()) {
        deselectPiece();
        return;
    }
    
    if (m_selectedPosition.has_value()) {
        if (clickedPos == m_selectedPosition.value()) {
            deselectPiece();
            return;
        }
        
        const Piece& clickedPiece = m_board->getPiece(clickedPos);
        if (!clickedPiece.isEmpty() && clickedPiece.getColor() == m_logic->getCurrentTurn()) {
            selectPiece(clickedPos);
            return;
        }
        
        tryMove(clickedPos);
    } else {
        selectPiece(clickedPos);
    }
}

void Game::handlePromotion(PieceType type) {
    m_pendingPromotionMove.promotion = type;
    
    if (m_logic->makeMove(m_pendingPromotionMove)) {
        m_soundManager->playMove();
    }
    
    m_waitingForPromotion = false;
    deselectPiece();
}

void Game::selectPiece(const Position& pos) {
    const Piece& piece = m_board->getPiece(pos);
    
    if (piece.isEmpty() || piece.getColor() != m_logic->getCurrentTurn()) {
        return;
    }
    
    m_selectedPosition = pos;
    m_currentLegalMoves = m_logic->getLegalMoves(pos);
}

void Game::deselectPiece() {
    m_selectedPosition.reset();
    m_currentLegalMoves.clear();
}

void Game::tryMove(const Position& to) {
    if (!m_selectedPosition.has_value()) {
        return;
    }
    
    for (const Move& move : m_currentLegalMoves) {
        if (move.to == to) {
            if (move.promotion != PieceType::None) {
                m_waitingForPromotion = true;
                m_pendingPromotionMove = move;
                return;
            }
            
            bool isCapture = !m_board->getPiece(to).isEmpty() || move.isEnPassant;
            
            Position from = m_selectedPosition.value();
            if (m_logic->makeMove(move)) {
                m_renderer->setAnimating(true, from, to);
                
                if (isCapture) {
                    m_soundManager->playCapture();
                } else {
                    m_soundManager->playMove();
                }
            }
            
            deselectPiece();
            return;
        }
    }
}

void Game::resetGame() {
    m_board->initialize();
    m_logic = std::make_unique<ChessLogic>(*m_board);
    m_aiPlayer = std::make_unique<AIPlayer>(*m_board, *m_logic);
    m_aiPlayer->setDifficulty(m_selectedDifficulty);
    deselectPiece();
    m_waitingForPromotion = false;
    m_aiThinking = false;
    
    // Couleur aléatoire pour le mode IA
    if (m_gameMode == GameMode::PlayerVsAI) {
        std::random_device rd;
        std::mt19937 rng(rd());
        std::uniform_int_distribution<int> dist(0, 1);
        m_playerColor = (dist(rng) == 0) ? Color::White : Color::Black;
        m_aiColor = (m_playerColor == Color::White) ? Color::Black : Color::White;
    } else {
        m_playerColor = Color::White;
        m_aiColor = Color::Black;
    }
    
    // Setup timer based on selected time
    m_timerEnabled = (m_selectedTime != TimeOption::NoTimer);
    float timeInSeconds = static_cast<float>(static_cast<int>(m_selectedTime)) * 60.0f;
    m_whiteTime = timeInSeconds;
    m_blackTime = timeInSeconds;
}

void Game::makeAIMove() {
    if (!m_aiPlayer) return;
    
    Move bestMove = m_aiPlayer->findBestMove(m_aiColor);
    
    if (bestMove.from.isValid() && bestMove.to.isValid()) {
        bool isCapture = !m_board->getPiece(bestMove.to).isEmpty() || bestMove.isEnPassant;
        
        Position from = bestMove.from;
        Position to = bestMove.to;
        
        if (m_logic->makeMove(bestMove)) {
            m_renderer->setAnimating(true, from, to);
            
            if (isCapture) {
                m_soundManager->playCapture();
            } else {
                m_soundManager->playMove();
            }
        }
    }
}

void Game::updateAI() {
    if (m_gameMode != GameMode::PlayerVsAI) return;
    if (m_logic->getCurrentTurn() != m_aiColor) return;
    if (m_waitingForPromotion) return;
    if (m_renderer->isAnimating()) return;
    if (m_gameState == GameState::Checkmate || 
        m_gameState == GameState::Stalemate || 
        m_gameState == GameState::Draw ||
        m_gameState == GameState::WhiteTimeout ||
        m_gameState == GameState::BlackTimeout) return;
    
    // Toujours synchrone — l'IA travaille sur des copies, pas besoin de thread
    if (!m_aiThinking) {
        m_aiThinking = true;
        makeAIMove();
        m_aiThinking = false;
    }
}

} // namespace Chess
