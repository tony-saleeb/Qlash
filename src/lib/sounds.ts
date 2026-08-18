let audioCtx: AudioContext | null = null;
let silentEl: HTMLAudioElement | null = null;

/** Tiny silent WAV so iOS keeps the audio session alive after a tap. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function createContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

function ensureSilentElement(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;
  if (silentEl) return silentEl;
  silentEl = document.createElement('audio');
  silentEl.setAttribute('playsinline', 'true');
  silentEl.setAttribute('webkit-playsinline', 'true');
  silentEl.preload = 'auto';
  silentEl.loop = true;
  silentEl.volume = 0.01;
  silentEl.src = SILENT_WAV;
  return silentEl;
}

/**
 * Must run in the same tick as a tap/click (before any await).
 * iOS Safari otherwise leaves AudioContext suspended and every SFX is silent.
 */
export function unlockGameAudio(): Promise<boolean> {
  const ctx = createContext();
  if (!ctx) return Promise.resolve(false);

  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // ignore
  }

  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  const el = ensureSilentElement();
  const playEl = el ? el.play().catch(() => undefined) : Promise.resolve();

  return Promise.all([resume, playEl]).then(() => ctx.state === 'running');
}

export function bindAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onGesture = () => {
    void unlockGameAudio();
  };

  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture);
  window.addEventListener('touchstart', onGesture, { passive: true });

  return () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    window.removeEventListener('touchstart', onGesture);
  };
}

function getAudioContext(): AudioContext | null {
  const ctx = createContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    void ctx.resume();
    if (ctx.state !== 'running') return null;
  }
  return ctx;
}

function tone(
  ctx: AudioContext,
  {
    type,
    freq,
    endFreq,
    start,
    duration,
    gain = 0.16,
  }: {
    type: OscillatorType;
    freq: number;
    endFreq?: number;
    start: number;
    duration: number;
    gain?: number;
  }
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (typeof endFreq === 'number') {
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), start + duration);
  }
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

export function playJoinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  tone(ctx, { type: 'sine', freq: 400, endFreq: 880, start: ctx.currentTime, duration: 0.16, gain: 0.18 });
}

export function playLockSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  tone(ctx, { type: 'square', freq: 720, endFreq: 420, start: ctx.currentTime, duration: 0.08, gain: 0.12 });
}

export function playQuestionStartSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, { type: 'triangle', freq: 392, start: now, duration: 0.12, gain: 0.16 });
  tone(ctx, { type: 'triangle', freq: 523.25, start: now + 0.1, duration: 0.16, gain: 0.16 });
}

export function playTickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  tone(ctx, { type: 'triangle', freq: 680, start: ctx.currentTime, duration: 0.06, gain: 0.14 });
}

export function playCorrectSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, idx) => {
    tone(ctx, { type: 'sine', freq, start: now + idx * 0.08, duration: 0.28, gain: 0.18 });
  });
}

export function playIncorrectSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  tone(ctx, {
    type: 'sawtooth',
    freq: 180,
    endFreq: 90,
    start: ctx.currentTime,
    duration: 0.38,
    gain: 0.14,
  });
}

export function playRevealSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  tone(ctx, {
    type: 'triangle',
    freq: 261.63,
    endFreq: 523.25,
    start: ctx.currentTime,
    duration: 0.32,
    gain: 0.18,
  });
}

export function playFanfareSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const chords = [
    [261.63, 329.63, 392.0],
    [349.23, 440.0, 523.25],
    [392.0, 493.88, 587.33],
    [523.25, 659.25, 783.99, 1046.5],
  ];

  chords.forEach((chord, chordIdx) => {
    const timeOffset = chordIdx * 0.22;
    const duration = chordIdx === chords.length - 1 ? 0.7 : 0.18;
    chord.forEach((freq) => {
      tone(ctx, { type: 'triangle', freq, start: now + timeOffset, duration, gain: 0.1 });
    });
  });
}
