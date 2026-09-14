import { describe, expect, it } from 'vitest';
import {
  isMissingCreateLobbyRpc,
  parseCreatedSession,
  toGameSessionRow,
} from '@/lib/host/createLobbySession';
import { unwrapOne, sortPlayersByJoin } from '@/lib/host/hostRoomFields';

describe('createLiveLobby helpers', () => {
  it('parses a jsonb session row', () => {
    const session = parseCreatedSession({
      id: 'sess-1',
      pin: '550000',
      status: 'lobby',
      quiz_id: 'quiz-1',
      host_id: 'host-1',
      current_question_index: 0,
      active_multiplier: 1,
      late_join_through_index: 2,
    });
    expect(session).toMatchObject({ id: 'sess-1', pin: '550000', quiz_id: 'quiz-1' });
  });

  it('treats a missing RPC as fallback', () => {
    expect(isMissingCreateLobbyRpc(null)).toBe(true);
    expect(isMissingCreateLobbyRpc({ code: 'PGRST202', message: 'function not found' })).toBe(true);
    expect(isMissingCreateLobbyRpc({ message: 'Quiz not found or unauthorized.' })).toBe(false);
  });
});

describe('host room helpers', () => {
  it('unwraps a nested one-to-one embed', () => {
    expect(unwrapOne({ id: 'q1', title: 'Nayrouz' })).toEqual({ id: 'q1', title: 'Nayrouz' });
    expect(unwrapOne([{ id: 'q1', title: 'Nayrouz' }])).toEqual({ id: 'q1', title: 'Nayrouz' });
    expect(unwrapOne(null)).toBeNull();
  });

  it('sorts players by join time', () => {
    const sorted = sortPlayersByJoin([
      {
        id: 'b',
        session_id: 's',
        nickname: 'B',
        score: 0,
        streak: 0,
        joined_at: '2026-09-14T10:00:02.000Z',
        connected: true,
      },
      {
        id: 'a',
        session_id: 's',
        nickname: 'A',
        score: 0,
        streak: 0,
        joined_at: '2026-09-14T10:00:01.000Z',
        connected: true,
      },
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('strips host_id from the projector session row', () => {
    const row = toGameSessionRow({
      id: 'sess-1',
      pin: '550000',
      status: 'lobby',
      current_question_index: 0,
      question_started_at: null,
      quiz_id: 'quiz-1',
      host_id: 'host-1',
      active_multiplier: 1,
      question_order: null,
      late_join_through_index: 2,
    });
    expect(row).toMatchObject({ id: 'sess-1', pin: '550000', quiz_id: 'quiz-1' });
    expect(row).not.toHaveProperty('host_id');
  });
});
