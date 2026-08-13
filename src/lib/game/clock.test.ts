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

  it('returns the full limit when startedAt is missing', () => {
    expect(remainingSeconds(null, 20, Date.now())).toBe(20);
    expect(remainingSeconds(undefined, 20, Date.now())).toBe(20);
  });

  it('returns the full limit when startedAt is not a real date', () => {
    expect(remainingSeconds('not-a-date', 20, Date.now())).toBe(20);
  });

  it('returns 0 for missing or negative limits', () => {
    expect(remainingSeconds('2026-08-13T20:00:00.000Z', 0)).toBe(0);
    expect(remainingSeconds('2026-08-13T20:00:00.000Z', -5)).toBe(0);
  });

  it('ceils partial seconds so the last second still shows 1', () => {
    const started = '2026-08-13T20:00:00.000Z';
    const now = Date.parse('2026-08-13T20:00:19.200Z');
    expect(remainingSeconds(started, 20, now)).toBe(1);
  });
});

describe('startedAtFromRemaining', () => {
  it('reconstructs a start so remaining matches', () => {
    const now = Date.parse('2026-08-13T20:00:10.000Z');
    const started = startedAtFromRemaining(30, 25, now);
    expect(remainingSeconds(started, 30, now)).toBe(25);
  });

  it('treats remaining above the limit as zero elapsed', () => {
    const now = Date.parse('2026-08-13T20:00:10.000Z');
    const started = startedAtFromRemaining(20, 50, now);
    expect(new Date(started).getTime()).toBe(now);
  });
});

describe('remainingFromPausedElapsed', () => {
  it('reads elapsed-ms pause encoding', () => {
    const pausedAt = new Date(5000).toISOString();
    expect(remainingFromPausedElapsed(pausedAt, 20)).toBe(15);
  });

  it('returns the full limit when pause timestamp is missing', () => {
    expect(remainingFromPausedElapsed(null, 20)).toBe(20);
    expect(remainingFromPausedElapsed(undefined, 0)).toBe(0);
  });

  it('never goes negative when elapsed exceeds the limit', () => {
    const pausedAt = new Date(60_000).toISOString();
    expect(remainingFromPausedElapsed(pausedAt, 20)).toBe(0);
  });
});
