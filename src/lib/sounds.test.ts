import { describe, expect, it } from 'vitest';
import { unlockGameAudio, playCorrectSound, playLockSound } from '@/lib/sounds';

describe('game audio', () => {
  it('unlocks as a no-op when Web Audio is unavailable', async () => {
    await expect(unlockGameAudio()).resolves.toBe(false);
  });

  it('play helpers do not throw without an AudioContext', () => {
    expect(() => playCorrectSound()).not.toThrow();
    expect(() => playLockSound()).not.toThrow();
  });
});
