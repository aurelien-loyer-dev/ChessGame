#include "Game.hpp"
#include <iostream>

int main() {
    std::cout << "Starting Chess Game..." << std::endl;
    
    Chess::Game game;
    
    if (!game.initialize()) {
        std::cerr << "Failed to initialize game!" << std::endl;
        return 1;
    }
    
    std::cout << "Game initialized successfully!" << std::endl;
    std::cout << "Controls:" << std::endl;
    std::cout << "  - Left click to select/move pieces" << std::endl;
    std::cout << "  - Right click to deselect" << std::endl;
    std::cout << "  - Press 'R' to restart the game" << std::endl;
    std::cout << "  - Press 'ESC' to quit" << std::endl;
    std::cout << "  - For pawn promotion: Q=Queen, R=Rook, B=Bishop, N=Knight" << std::endl;
    
    game.run();
    
    return 0;
}
