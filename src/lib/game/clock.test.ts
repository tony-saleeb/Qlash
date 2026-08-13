import { describe, expect, it } from 'vitest';
import { remainingFromPausedElapsed, remainingSeconds, startedAtFromRemaining } from '@/lib/game/clock';

describe('remainingSeconds', () => {
  it('counts down from a server timestamp', () => {
    const now = Date.parse('2026-08-13T20:00:20.000Z');
    const started = '2026-08-13T20:00:00.000Z';
    expect(remainingSeconds(started, 30, now)).toBe(10);
  });

  it('never goes negative', () => {
    const now = Date.parse('2026-08-13T20:01:00.000Z');
    expect(remainingSeconds('2026-08-13T20:00:00.000Z', 20, now)).toBe(0);
  });
});

describe('startedAtFromRemaining', () => {
  it('reconstructs a start so remaining matches', () => {
    const now = Date.parse('2026-08-13T20:00:10.000Z');
    const started = startedAtFromRemaining(30, 25, now);
    expect(remainingSeconds(started, 30, now)).toBe(25);
  });
});

describe('remainingFromPausedElapsed', () => {
  it('reads elapsed-ms pause encoding', () => {
    const pausedAt = new Date(5000).toISOString();
    expect(remainingFromPausedElapsed(pausedAt, 20)).toBe(15);
  });
});
