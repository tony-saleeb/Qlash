import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LATE_JOIN_THROUGH_INDEX,
  LATE_JOIN_LOBBY_ONLY,
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

  it('always allows lobby inserts and never finished rooms', () => {
    expect(canInsertNewPlayer({ status: 'lobby', late_join_through_index: LATE_JOIN_LOBBY_ONLY })).toBe(true);
    expect(canInsertNewPlayer({ status: 'finished', current_question_index: 0, late_join_through_index: 8 })).toBe(
      false
    );
  });

  it('allows live inserts on any question when late join is on', () => {
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
        current_question_index: 7,
        late_join_through_index: 2,
      })
    ).toBe(true);
    expect(
      canInsertNewPlayer({
        status: 'question_active',
        current_question_index: 12,
        late_join_through_index: 2,
      })
    ).toBe(true);
    expect(
      canInsertNewPlayer({
        status: 'question_active',
        current_question_index: 0,
        late_join_through_index: LATE_JOIN_LOBBY_ONLY,
      })
    ).toBe(false);
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
