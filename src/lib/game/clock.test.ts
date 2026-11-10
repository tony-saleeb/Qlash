import { describe, expect, it } from 'vitest';
import {
  adoptServerClock,
  remainingFromPausedElapsed,
  remainingMs,
  remainingSeconds,
  serverClockOffsetMs,
  startedAtFromRemaining,
} from '@/lib/game/clock';
import { HOST_REVEAL_DELAY_MS, SERVER_LATE_CUTOFF_MS } from '@/lib/game/constants';

describe('serverClockOffsetMs', () => {
  const stamp = '2026-08-13T20:00:00.000Z';

  it('measures how far the local clock runs ahead of or behind the server', () => {
    expect(serverClockOffsetMs(stamp, Date.parse('2026-08-13T20:00:04.000Z'))).toBe(-4000);
    expect(serverClockOffsetMs(stamp, Date.parse('2026-08-13T19:59:57.000Z'))).toBe(3000);
  });

  it('returns null without a usable stamp', () => {
    expect(serverClockOffsetMs(null)).toBeNull();
    expect(serverClockOffsetMs(undefined)).toBeNull();
    expect(serverClockOffsetMs('not a date')).toBeNull();
  });

  it('keeps a fast host laptop from closing the round before the late cutoff', () => {
    const limitMs = 20_000;
    const fastByMs = 4000;
    const responseLagMs = 300;
    const serverStart = Date.parse(stamp);
    const offset = serverClockOffsetMs(stamp, serverStart + responseLagMs + fastByMs) ?? 0;

    // The host timer hits zero once the corrected clock reaches the limit.
    const localAtZero = serverStart + limitMs - offset;
    expect(remainingMs(stamp, limitMs / 1000, localAtZero + offset)).toBe(0);
    expect(remainingMs(stamp, limitMs / 1000, localAtZero + offset - 1)).toBe(1);

    const serverAtReveal = localAtZero - fastByMs + HOST_REVEAL_DELAY_MS;
    expect(serverAtReveal - serverStart).toBeGreaterThan(limitMs + SERVER_LATE_CUTOFF_MS);

    // Uncorrected, the same laptop closed the round while phones still showed time.
    const uncorrectedServerAtReveal = serverStart + limitMs - fastByMs + HOST_REVEAL_DELAY_MS;
    expect(uncorrectedServerAtReveal - serverStart).toBeLessThan(limitMs);
  });
});

describe('adoptServerClock', () => {
  it('keeps the previous offset when the row has no fresh stamp', () => {
    expect(adoptServerClock(-2500, null, 1_000)).toBe(-2500);
    expect(adoptServerClock(-2500, undefined, 1_000)).toBe(-2500);
    expect(adoptServerClock(-2500, 'not a date', 1_000)).toBe(-2500);
  });

  it('corrects a reloaded projector from the page server time, not from the question start', () => {
    const started = Date.parse('2026-08-13T20:00:00.000Z');
    const serverNow = started + 8_000;
    const fastByMs = 4_000;
    const pageLagMs = 500;
    const receivedAt = serverNow + pageLagMs + fastByMs;
    const offset = adoptServerClock(0, new Date(serverNow).toISOString(), receivedAt);

    const localWhenServerHitsLimit = started + 20_000 + fastByMs;
    expect(remainingMs(new Date(started).toISOString(), 20, localWhenServerHitsLimit + offset)).toBeGreaterThan(0);
    // At arrival the corrected clock equals the stamp, so it trails the server by the page lag.
    expect(remainingSeconds(new Date(started).toISOString(), 20, receivedAt + offset)).toBe(12);

    const uncorrectedRemaining = remainingSeconds(
      new Date(started).toISOString(),
      20,
      localWhenServerHitsLimit
    );
    expect(uncorrectedRemaining).toBe(0);
  });

  it('refreshes the offset from a session row written while the clicker advances', () => {
    const started = Date.parse('2026-08-13T20:00:00.000Z');
    const serverNow = started + 12_000;
    const fastByMs = 4_000;
    const deliveryMs = 200;
    const receivedAt = serverNow + deliveryMs + fastByMs;
    const offset = adoptServerClock(
      0,
      new Date(serverNow).toISOString(),
      receivedAt
    );

    expect(offset).toBe(serverNow - receivedAt);
    expect(remainingSeconds(new Date(started).toISOString(), 20, receivedAt + offset)).toBe(8);
    expect(remainingSeconds(new Date(started).toISOString(), 20, receivedAt)).toBe(3);
  });
});

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

  it('floors partial seconds so 1 means a full second remains', () => {
    const started = '2026-08-13T20:00:00.000Z';
    expect(remainingSeconds(started, 20, Date.parse('2026-08-13T20:00:19.200Z'))).toBe(0);
    expect(remainingSeconds(started, 20, Date.parse('2026-08-13T20:00:18.200Z'))).toBe(1);
    expect(remainingMs(started, 20, Date.parse('2026-08-13T20:00:19.200Z'))).toBe(800);
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

  it('returns the full limit when the pause timestamp is not a date', () => {
    expect(remainingFromPausedElapsed('not-a-date', 20)).toBe(20);
  });

  it('hits zero on the exact expiry instant', () => {
    const started = '2026-08-13T20:00:00.000Z';
    const now = Date.parse('2026-08-13T20:00:20.000Z');
    expect(remainingMs(started, 20, now)).toBe(0);
    expect(remainingSeconds(started, 20, now)).toBe(0);
  });
});
