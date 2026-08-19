import { describe, expect, it } from 'vitest';
import { unlockGameAudio, playCorrectSound, playLockSound, playClashSound, setGameAudioMuted, isGameAudioMuted } from '@/lib/sounds';

describe('game audio', () => {
  it('unlocks as a no-op when Web Audio is unavailable', async () => {
    await expect(unlockGameAudio()).resolves.toBe(false);
  });

  it('play helpers do not throw without an AudioContext', () => {
    expect(() => playCorrectSound()).not.toThrow();
    expect(() => playLockSound()).not.toThrow();
    expect(() => playClashSound()).not.toThrow();
  });

  it('persists mute in localStorage', () => {
    setGameAudioMuted(true);
    expect(isGameAudioMuted()).toBe(true);
    setGameAudioMuted(false);
    expect(isGameAudioMuted()).toBe(false);
  });
});
