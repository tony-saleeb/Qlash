import { describe, expect, it } from 'vitest';
import {
  HYDRATE_MAX_ATTEMPTS,
  HYDRATE_WATCHDOG_MS,
  hydrateRetryDelayMs,
  hydrateShouldRetry,
  needsQuestionHydrate,
} from '@/lib/game/hydrateRetry';

describe('hydrate retry', () => {
  it('retries throttling and server faults, not auth or missing rows', () => {
    expect(hydrateShouldRetry(429)).toBe(true);
    expect(hydrateShouldRetry(408)).toBe(true);
    expect(hydrateShouldRetry(500)).toBe(true);
    expect(hydrateShouldRetry(503)).toBe(true);
    expect(hydrateShouldRetry(401)).toBe(false);
    expect(hydrateShouldRetry(404)).toBe(false);
    expect(hydrateShouldRetry(400)).toBe(false);
  });

  it('backs off and honours Retry-After without stalling the round', () => {
    expect(hydrateRetryDelayMs(0)).toBe(400);
    expect(hydrateRetryDelayMs(1)).toBe(900);
    expect(hydrateRetryDelayMs(2)).toBe(1800);
    expect(hydrateRetryDelayMs(3)).toBe(3000);
    expect(hydrateRetryDelayMs(9)).toBe(3000);
    expect(hydrateRetryDelayMs(0, 2)).toBe(2000);
    expect(hydrateRetryDelayMs(0, 60)).toBe(5000);
    expect(hydrateRetryDelayMs(2, 1)).toBe(1800);
    expect(hydrateRetryDelayMs(0, null)).toBe(400);
    expect(hydrateRetryDelayMs(0, 0)).toBe(400);
    expect(HYDRATE_MAX_ATTEMPTS).toBe(4);
  });

  it('keeps asking while the player owes a question payload', () => {
    expect(needsQuestionHydrate({ status: 'question_active', hasQuestion: false })).toBe(true);
    expect(needsQuestionHydrate({ status: 'question_paused', hasQuestion: false })).toBe(true);
    expect(needsQuestionHydrate({ status: 'question_reveal', hasQuestion: false })).toBe(true);
    expect(needsQuestionHydrate({ status: 'leaderboard', hasQuestion: false })).toBe(true);
    expect(needsQuestionHydrate({ status: 'question_active', hasQuestion: true })).toBe(false);
    expect(needsQuestionHydrate({ status: 'lobby', hasQuestion: false })).toBe(false);
    expect(needsQuestionHydrate({ status: 'finished', hasQuestion: false })).toBe(false);
  });

  it('polls slower than the per-player hydrate budget', () => {
    expect(HYDRATE_WATCHDOG_MS).toBe(2_500);
    expect(60_000 / HYDRATE_WATCHDOG_MS).toBeLessThan(40);
  });
});
