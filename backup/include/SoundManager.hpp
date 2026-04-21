#pragma once

#include <SFML/Audio.hpp>
#include <vector>
#include <cmath>
#include <memory>
#include <cstdint>

namespace Chess {

class SoundManager {
public:
    SoundManager();
    
    void playMove();
    void playCapture();
    void playCheck();
    void playGameOver();
    void playMenuClick();
    void playMenuHover();
    
    void setVolume(float volume);
    
private:
    void generateTone(std::vector<std::int16_t>& samples, float frequency, float duration, float volume = 0.5f);
    void generateClick(std::vector<std::int16_t>& samples);
    
    sf::SoundBuffer m_moveBuffer;
    sf::SoundBuffer m_captureBuffer;
    sf::SoundBuffer m_checkBuffer;
    sf::SoundBuffer m_gameOverBuffer;
    sf::SoundBuffer m_menuClickBuffer;
    sf::SoundBuffer m_menuHoverBuffer;
    
    std::unique_ptr<sf::Sound> m_sound;
    float m_volume;
    
    static constexpr unsigned int SAMPLE_RATE = 44100;
};

} // namespace Chess
