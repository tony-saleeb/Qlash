import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LATE_JOIN_THROUGH_INDEX,
  canInsertNewPlayer,
  hostClickerPath,
  priorJoinTokens,
  isHostClickerView,
  isLateJoinEnabled,
  normalizeLateJoinThroughIndex,
  playerJoinedAfterQuestionStart,
  roomOpenedTooLongAgo,
} from '@/lib/game/lateJoin';

describe('late join', () => {
  it('defaults missing values to late join on', () => {
    expect(normalizeLateJoinThroughIndex(undefined)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(normalizeLateJoinThroughIndex(null)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(isLateJoinEnabled(-1)).toBe(false);
    expect(isLateJoinEnabled(2)).toBe(true);
  });

  it('lets new players into the lobby, and into a live game only while late join is on', () => {
    expect(canInsertNewPlayer({ status: 'lobby', late_join_through_index: -1 })).toBe(true);
    expect(canInsertNewPlayer({ status: 'finished', late_join_through_index: 2 })).toBe(false);
    expect(canInsertNewPlayer({ status: 'question_active', late_join_through_index: -1 })).toBe(false);
    expect(canInsertNewPlayer({ status: 'question_active', late_join_through_index: 2 })).toBe(true);
    expect(canInsertNewPlayer({ status: 'leaderboard', late_join_through_index: 0 })).toBe(true);
    expect(canInsertNewPlayer({ status: 'lobby', join_locked: true, late_join_through_index: 2 })).toBe(false);
    expect(canInsertNewPlayer({ status: 'question_active', join_locked: true, late_join_through_index: 2 })).toBe(
      false
    );
  });

  it('keeps only a short list of prior device tokens', () => {
    expect(priorJoinTokens(undefined)).toEqual([]);
    expect(priorJoinTokens([' tok ', '', 12, 'x'.repeat(81), 'ok'])).toEqual(['tok', 'ok']);
    expect(priorJoinTokens(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
  });

  it('refuses a room that opened more than 12 hours ago', () => {
    const now = Date.parse('2026-08-13T20:00:00.000Z');
    expect(roomOpenedTooLongAgo('2026-08-13T07:00:00.000Z', now)).toBe(true);
    expect(roomOpenedTooLongAgo('2026-08-13T08:00:00.000Z', now)).toBe(false);
    expect(roomOpenedTooLongAgo(undefined, now)).toBe(false);
  });

  it('treats a join after question start as a later arrival', () => {
    expect(
      playerJoinedAfterQuestionStart('2026-08-19T10:00:08.000Z', '2026-08-19T10:00:00.000Z')
    ).toBe(true);
    expect(
      playerJoinedAfterQuestionStart('2026-08-19T10:00:00.000Z', '2026-08-19T10:00:00.000Z')
    ).toBe(false);
    expect(playerJoinedAfterQuestionStart(null, '2026-08-19T10:00:00.000Z')).toBe(false);
  });

  it('builds the clicker path', () => {
    expect(hostClickerPath('sess-1')).toBe('/host/sess-1?view=clicker');
    expect(isHostClickerView('clicker')).toBe(true);
    expect(isHostClickerView(['remote'])).toBe(true);
    expect(isHostClickerView(['stage', 'clicker'])).toBe(false);
    expect(isHostClickerView(undefined)).toBe(false);
    expect(isHostClickerView('')).toBe(false);
    expect(isHostClickerView('stage')).toBe(false);
  });

  it('clamps garbage late-join values and ignores unreadable join times', () => {
    expect(normalizeLateJoinThroughIndex(Number.NaN)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(normalizeLateJoinThroughIndex(Number.POSITIVE_INFINITY)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(normalizeLateJoinThroughIndex('2')).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(normalizeLateJoinThroughIndex(-4.8)).toBe(-1);
    expect(normalizeLateJoinThroughIndex(2.9)).toBe(2);
    expect(playerJoinedAfterQuestionStart('not-a-date', '2026-08-19T10:00:00.000Z')).toBe(false);
    expect(playerJoinedAfterQuestionStart('2026-08-19T10:00:08.000Z', 'nope')).toBe(false);
  });
});
