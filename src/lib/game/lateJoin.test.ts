import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LATE_JOIN_THROUGH_INDEX,
  canInsertNewPlayer,
  hostClickerPath,
  isHostClickerView,
  isLateJoinEnabled,
  normalizeLateJoinThroughIndex,
  playerJoinedAfterQuestionStart,
} from '@/lib/game/lateJoin';

describe('late join', () => {
  it('defaults missing values to late join on', () => {
    expect(normalizeLateJoinThroughIndex(undefined)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(normalizeLateJoinThroughIndex(null)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(isLateJoinEnabled(-1)).toBe(false);
    expect(isLateJoinEnabled(2)).toBe(true);
  });

  it('allows inserts in any live room and never in a finished one', () => {
    expect(canInsertNewPlayer({ status: 'lobby' })).toBe(true);
    expect(canInsertNewPlayer({ status: 'finished' })).toBe(false);
    expect(canInsertNewPlayer({ status: 'question_active' })).toBe(true);
    expect(canInsertNewPlayer({ status: 'question_paused' })).toBe(true);
    expect(canInsertNewPlayer({ status: 'question_reveal' })).toBe(true);
    expect(canInsertNewPlayer({ status: 'leaderboard' })).toBe(true);
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
    expect(isHostClickerView('stage')).toBe(false);
  });
});
