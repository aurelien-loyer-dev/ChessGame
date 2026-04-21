/**
 * =========================================================================
 * CORE MODULE — Shared utilities and constants
 * =========================================================================
 */

// DOM Helper
export const $ = id => document.getElementById(id);

// Piece values for material calculation
export const PIECE_VALUES = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0
};

// Piece display order
export const PIECE_ORDER = ['Q', 'R', 'B', 'N', 'P'];

// Format time for display
export function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Show toast notification
export function showToast(element, text, type = 'info') {
  element.textContent = text;
  element.className = 'toast ' + type;
  element.classList.remove('hidden');
}

// Hide element
export function hide(element) {
  element.classList.add('hidden');
}

// Show element
export function show(element) {
  element.classList.remove('hidden');
}

// Toggle element visibility
export function toggle(element, show) {
  element.classList.toggle('hidden', !show);
}
