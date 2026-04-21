#include "SoundManager.hpp"
#include <cmath>
#include <cstdlib>

namespace Chess {

SoundManager::SoundManager() : m_volume(50.0f) {
    std::vector<std::int16_t> samples;
    std::vector<sf::SoundChannel> channelMap = {sf::SoundChannel::Mono};
    
    // Generate move sound (soft click)
    samples.clear();
    generateTone(samples, 800, 0.05f, 0.3f);
    generateTone(samples, 600, 0.03f, 0.2f);
    (void)m_moveBuffer.loadFromSamples(samples.data(), samples.size(), 1, SAMPLE_RATE, channelMap);
    
    // Generate capture sound (stronger impact)
    samples.clear();
    generateTone(samples, 300, 0.08f, 0.5f);
    generateTone(samples, 200, 0.1f, 0.4f);
    generateTone(samples, 150, 0.05f, 0.2f);
    (void)m_captureBuffer.loadFromSamples(samples.data(), samples.size(), 1, SAMPLE_RATE, channelMap);
    
    // Generate check sound (alert)
    samples.clear();
    generateTone(samples, 880, 0.1f, 0.4f);
    generateTone(samples, 1100, 0.1f, 0.5f);
    generateTone(samples, 880, 0.15f, 0.3f);
    (void)m_checkBuffer.loadFromSamples(samples.data(), samples.size(), 1, SAMPLE_RATE, channelMap);
    
    // Generate game over sound (fanfare)
    samples.clear();
    generateTone(samples, 523, 0.15f, 0.4f);  // C
    generateTone(samples, 659, 0.15f, 0.4f);  // E
    generateTone(samples, 784, 0.15f, 0.4f);  // G
    generateTone(samples, 1047, 0.3f, 0.5f);  // C (octave)
    (void)m_gameOverBuffer.loadFromSamples(samples.data(), samples.size(), 1, SAMPLE_RATE, channelMap);
    
    // Generate menu click sound
    samples.clear();
    generateClick(samples);
    (void)m_menuClickBuffer.loadFromSamples(samples.data(), samples.size(), 1, SAMPLE_RATE, channelMap);
    
    // Generate menu hover sound (soft blip)
    samples.clear();
    generateTone(samples, 1200, 0.03f, 0.15f);
    (void)m_menuHoverBuffer.loadFromSamples(samples.data(), samples.size(), 1, SAMPLE_RATE, channelMap);
}

void SoundManager::generateTone(std::vector<std::int16_t>& samples, float frequency, float duration, float volume) {
    size_t numSamples = static_cast<size_t>(SAMPLE_RATE * duration);
    size_t startSize = samples.size();
    samples.resize(startSize + numSamples);
    
    for (size_t i = 0; i < numSamples; ++i) {
        float t = static_cast<float>(i) / SAMPLE_RATE;
        float envelope = 1.0f;
        
        // Apply fade out
        float fadeStart = duration * 0.7f;
        if (t > fadeStart) {
            envelope = 1.0f - (t - fadeStart) / (duration - fadeStart);
        }
        
        // Apply fade in
        if (t < 0.01f) {
            envelope *= t / 0.01f;
        }
        
        float sample = std::sin(2.0f * 3.14159f * frequency * t) * envelope * volume;
        samples[startSize + i] = static_cast<std::int16_t>(sample * 32767);
    }
}

void SoundManager::generateClick(std::vector<std::int16_t>& samples) {
    size_t numSamples = static_cast<size_t>(SAMPLE_RATE * 0.05f);
    samples.resize(numSamples);
    
    for (size_t i = 0; i < numSamples; ++i) {
        float t = static_cast<float>(i) / SAMPLE_RATE;
        float envelope = std::exp(-t * 80.0f);
        
        // Mix of frequencies for click
        float sample = 0;
        sample += std::sin(2.0f * 3.14159f * 1500 * t) * 0.3f;
        sample += std::sin(2.0f * 3.14159f * 2500 * t) * 0.2f;
        sample += (static_cast<float>(rand()) / RAND_MAX * 2.0f - 1.0f) * 0.3f; // Noise
        
        samples[i] = static_cast<std::int16_t>(sample * envelope * 32767 * 0.4f);
    }
}

void SoundManager::playMove() {
    m_sound = std::make_unique<sf::Sound>(m_moveBuffer);
    m_sound->setVolume(m_volume);
    m_sound->play();
}

void SoundManager::playCapture() {
    m_sound = std::make_unique<sf::Sound>(m_captureBuffer);
    m_sound->setVolume(m_volume);
    m_sound->play();
}

void SoundManager::playCheck() {
    m_sound = std::make_unique<sf::Sound>(m_checkBuffer);
    m_sound->setVolume(m_volume);
    m_sound->play();
}

void SoundManager::playGameOver() {
    m_sound = std::make_unique<sf::Sound>(m_gameOverBuffer);
    m_sound->setVolume(m_volume);
    m_sound->play();
}

void SoundManager::playMenuClick() {
    m_sound = std::make_unique<sf::Sound>(m_menuClickBuffer);
    m_sound->setVolume(m_volume);
    m_sound->play();
}

void SoundManager::playMenuHover() {
    m_sound = std::make_unique<sf::Sound>(m_menuHoverBuffer);
    m_sound->setVolume(m_volume * 0.5f);
    m_sound->play();
}

void SoundManager::setVolume(float volume) {
    m_volume = volume;
}

} // namespace Chess
