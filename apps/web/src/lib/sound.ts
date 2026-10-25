import { useSettings } from '../store/settings';

/**
 * Procedural sound effects (Web Audio): no audio files to download,
 * and every sound shares the same soft, slightly synthetic timbre.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, opts: { type?: OscillatorType; gain?: number; slide?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const { volume } = useSettings.getState();
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(freq * opts.slide, t0 + duration);
  const peak = (opts.gain ?? 0.3) * volume;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(start: number, duration: number, gainValue: number, filterFreq: number) {
  const ac = audio();
  if (!ac) return;
  const { volume } = useSettings.getState();
  const t0 = ac.currentTime + start;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.2;
  const gain = ac.createGain();
  gain.gain.value = gainValue * volume;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
}

export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'start' | 'end' | 'notify' | 'error' | 'success' | 'tick';

const SOUNDS: Record<SoundName, () => void> = {
  move: () => {
    noise(0, 0.06, 0.5, 1800);
    tone(420, 0, 0.07, { type: 'triangle', gain: 0.12 });
  },
  capture: () => {
    noise(0, 0.1, 0.8, 900);
    tone(220, 0, 0.12, { type: 'triangle', gain: 0.2, slide: 0.7 });
  },
  check: () => {
    tone(880, 0, 0.12, { type: 'square', gain: 0.06 });
    tone(1320, 0.09, 0.16, { type: 'square', gain: 0.05 });
  },
  castle: () => {
    noise(0, 0.05, 0.5, 1600);
    noise(0.09, 0.05, 0.5, 1400);
  },
  promote: () => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.06, 0.18, { type: 'triangle', gain: 0.12 }));
  },
  start: () => {
    tone(392, 0, 0.18, { type: 'sine', gain: 0.18 });
    tone(587, 0.12, 0.3, { type: 'sine', gain: 0.16 });
  },
  end: () => {
    [659, 523, 392].forEach((f, i) => tone(f, i * 0.12, 0.35, { type: 'sine', gain: 0.15 }));
  },
  notify: () => tone(988, 0, 0.18, { type: 'sine', gain: 0.12 }),
  error: () => tone(180, 0, 0.18, { type: 'sawtooth', gain: 0.06, slide: 0.8 }),
  success: () => {
    [523, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.22, { type: 'triangle', gain: 0.12 }));
  },
  tick: () => tone(1400, 0, 0.03, { type: 'square', gain: 0.03 }),
};

export function play(name: SoundName) {
  if (!useSettings.getState().sound) return;
  try {
    SOUNDS[name]();
  } catch {
    // Audio is a nicety; never let it break the game.
  }
}

/** Picks the right sound for a SAN move. */
export function playMoveSound(san: string) {
  if (san.includes('#') || san.includes('+')) play('check');
  else if (san.startsWith('O-O')) play('castle');
  else if (san.includes('=')) play('promote');
  else if (san.includes('x')) play('capture');
  else play('move');
}
