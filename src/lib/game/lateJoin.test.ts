import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LATE_JOIN_THROUGH_INDEX,
  LATE_JOIN_LOBBY_ONLY,
  canInsertNewPlayer,
  hostClickerPath,
  isHostClickerView,
  isLateJoinEnabled,
  normalizeLateJoinThroughIndex,
} from '@/lib/game/lateJoin';

describe('late join', () => {
  it('defaults missing cutoffs to through question 3', () => {
    expect(normalizeLateJoinThroughIndex(undefined)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(normalizeLateJoinThroughIndex(null)).toBe(DEFAULT_LATE_JOIN_THROUGH_INDEX);
    expect(isLateJoinEnabled(-1)).toBe(false);
    expect(isLateJoinEnabled(2)).toBe(true);
  });

  it('always allows lobby inserts and never finished rooms', () => {
    expect(canInsertNewPlayer({ status: 'lobby', late_join_through_index: LATE_JOIN_LOBBY_ONLY })).toBe(true);
    expect(canInsertNewPlayer({ status: 'finished', current_question_index: 0, late_join_through_index: 8 })).toBe(
      false
    );
  });

  it('allows live inserts through the cutoff and blocks after', () => {
    expect(
      canInsertNewPlayer({
        status: 'question_active',
        current_question_index: 1,
        late_join_through_index: 2,
      })
    ).toBe(true);
    expect(
      canInsertNewPlayer({
        status: 'leaderboard',
        current_question_index: 2,
        late_join_through_index: 2,
      })
    ).toBe(true);
    expect(
      canInsertNewPlayer({
        status: 'question_active',
        current_question_index: 3,
        late_join_through_index: 2,
      })
    ).toBe(false);
    expect(
      canInsertNewPlayer({
        status: 'question_active',
        current_question_index: 0,
        late_join_through_index: LATE_JOIN_LOBBY_ONLY,
      })
    ).toBe(false);
  });

  it('builds the clicker path', () => {
    expect(hostClickerPath('sess-1')).toBe('/host/sess-1?view=clicker');
    expect(isHostClickerView('clicker')).toBe(true);
    expect(isHostClickerView('stage')).toBe(false);
  });
});
