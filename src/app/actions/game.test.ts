import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomLivePin } from '@/lib/game/livePin';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/game/livePin', () => ({
  randomLivePin: vi.fn(() => '550000'),
}));

const host = createClientMock({ id: 'host-1', email: 'host@qlash.test' });
const admin = createClientMock();

describe('host game actions', () => {
  beforeEach(() => {
    host.reset();
    admin.reset();
    vi.mocked(createClient).mockReturnValue(host as never);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    host.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'host-1', email: 'host@qlash.test' } } },
    });
    host.setRpc('advance_question', { data: 'pg-now', error: null });
  });

  it('refuses unauthenticated hosts', async () => {
    host.auth.getClaims.mockResolvedValue({ data: null, error: { message: 'no' } });
    const { endGameSession } = await import('@/app/actions/game');
    await expect(endGameSession('sess-1')).rejects.toThrow(/Unauthorized/);
  });

  it('creates a lobby session with a unique 6-digit PIN for the owning host', async () => {
    vi.mocked(randomLivePin).mockReturnValue('550000');
    host.setTables({
      quizzes: { data: { id: 'quiz-1' }, error: null },
      game_sessions: {
        data: { id: 'sess-1', pin: '550000', status: 'lobby', host_id: 'host-1' },
        error: null,
      },
    });
    const { createGameSession } = await import('@/app/actions/game');
    const session = await createGameSession('quiz-1');
    expect(session.pin).toBe('550000');
    expect(host.lastInsert('game_sessions')).toMatchObject({
      quiz_id: 'quiz-1',
      host_id: 'host-1',
      pin: '550000',
      status: 'lobby',
      current_question_index: 0,
      active_multiplier: 1,
      late_join_through_index: 2,
    });
  });

  it('retries lobby insert when the PIN is already taken', async () => {
    vi.mocked(randomLivePin).mockReturnValueOnce('190000').mockReturnValueOnce('550000');
    host.setTables({
      quizzes: { data: { id: 'quiz-1' }, error: null },
      game_sessions: [
        { data: null, error: null, count: 0 },
        { data: null, error: { code: '23505', message: 'duplicate pin' } },
        { data: { id: 'sess-2', pin: '550000', status: 'lobby', host_id: 'host-1' }, error: null },
      ],
    });
    const { createGameSession } = await import('@/app/actions/game');
    const session = await createGameSession('quiz-1');
    expect(session.id).toBe('sess-2');
  });

  it('creates a lobby in one RPC round-trip when create_live_lobby exists', async () => {
    host.setRpc('create_live_lobby', {
      data: {
        id: 'sess-rpc',
        pin: '654321',
        status: 'lobby',
        host_id: 'host-1',
        quiz_id: 'quiz-1',
        current_question_index: 0,
      },
      error: null,
    });
    const { createGameSession } = await import('@/app/actions/game');
    const session = await createGameSession('quiz-1');
    expect(session.id).toBe('sess-rpc');
    expect(session.pin).toBe('654321');
    expect(host.lastInsert('game_sessions')).toBeUndefined();
  });

  it('does not fall back to insert when the quiz is unauthorized', async () => {
    host.setRpc('create_live_lobby', {
      data: null,
      error: { message: 'Quiz not found or unauthorized.' },
    });
    const { createGameSession } = await import('@/app/actions/game');
    await expect(createGameSession('quiz-1')).rejects.toThrow(/Quiz not found or unauthorized/);
    expect(host.lastInsert('game_sessions')).toBeUndefined();
  });

  it('refuses another lobby when this host already has the open-room cap', async () => {
    host.setTables({
      game_sessions: { data: null, error: null, count: 8 },
    });
    const { createGameSession } = await import('@/app/actions/game');
    await expect(createGameSession('quiz-1')).rejects.toThrow(/Finish an open room/);
    expect(host.rpc).not.toHaveBeenCalled();
  });

  it('refuses to start without a question order and only from lobby', async () => {
    const { startGameSession } = await import('@/app/actions/game');
    await expect(startGameSession('sess-1', [])).rejects.toThrow(/Question order is required/);

    host.setRpc('start_game', { data: null, error: { message: 'Unable to start game. Ensure the session is in lobby and you are the host.' } });
    await expect(startGameSession('sess-1', ['q1'])).rejects.toThrow(/Ensure the session is in lobby/);
  });

  it('starts the first question and persists play order', async () => {
    host.setRpc('start_game', { data: '2026-08-13T20:00:00.000Z', error: null });
    const { startGameSession } = await import('@/app/actions/game');
    const result = await startGameSession('sess-1', ['q1', 'q2']);
    expect(result).toEqual({ success: true, serverStartedAt: '2026-08-13T20:00:00.000Z' });
    expect(host.rpc).toHaveBeenCalledWith('start_game', {
      p_session_id: 'sess-1',
      p_question_order: ['q1', 'q2'],
    });
  });

  it('pauses through pause_question', async () => {
    host.setRpc('pause_question', { data: '1970-01-01T00:00:10.000Z', error: null });
    const { pauseGameSession } = await import('@/app/actions/game');
    await expect(pauseGameSession('sess-1')).resolves.toEqual({ success: true });
    expect(host.rpc).toHaveBeenCalledWith('pause_question', { p_session_id: 'sess-1' });
  });

  it('refuses pause when the round is not active', async () => {
    host.setRpc('pause_question', {
      data: null,
      error: { message: 'Game is not in an active question state.' },
    });
    const { pauseGameSession } = await import('@/app/actions/game');
    await expect(pauseGameSession('sess-1')).rejects.toThrow(/not in an active question state/);
  });

  it('resumes through resume_question', async () => {
    host.setRpc('resume_question', { data: '2026-08-13T20:00:55.000Z', error: null });
    const { resumeGameSession } = await import('@/app/actions/game');
    await expect(resumeGameSession('sess-1')).resolves.toEqual({
      success: true,
      serverStartedAt: '2026-08-13T20:00:55.000Z',
    });
    expect(host.rpc).toHaveBeenCalledWith('resume_question', { p_session_id: 'sess-1' });
  });

  it('adds time through add_question_time', async () => {
    host.setRpc('add_question_time', { data: '2026-08-13T20:00:10.000Z', error: null });
    const { addQuestionTime } = await import('@/app/actions/game');
    const result = await addQuestionTime('sess-1', 10);
    expect(result).toEqual({
      success: true,
      serverStartedAt: '2026-08-13T20:00:10.000Z',
      addedSeconds: 10,
    });
    expect(host.rpc).toHaveBeenCalledWith('add_question_time', {
      p_session_id: 'sess-1',
      p_seconds: 10,
    });
  });

  it('adds time on a paused clock through the same RPC', async () => {
    host.setRpc('add_question_time', { data: '1970-01-01T00:00:05.000Z', error: null });
    const { addQuestionTime } = await import('@/app/actions/game');
    const result = await addQuestionTime('sess-1', 3);
    expect(result.addedSeconds).toBe(3);
    expect(result.serverStartedAt).toBe('1970-01-01T00:00:05.000Z');
    expect(host.rpc).toHaveBeenCalledWith('add_question_time', {
      p_session_id: 'sess-1',
      p_seconds: 3,
    });
  });

  it('kicks only after confirming the caller owns the session', async () => {
    host.setTable('game_sessions', { data: null, error: { message: 'nope' } });
    const { kickPlayer } = await import('@/app/actions/game');
    await expect(kickPlayer('p1', 'sess-1')).rejects.toThrow(/Unauthorized or session not found/);

    host.setTables({
      game_sessions: { data: { id: 'sess-1' }, error: null },
      players: { data: {}, error: null },
    });
    await expect(kickPlayer('p1', 'sess-1')).resolves.toEqual({ success: true });

    admin.setTables({
      players: { data: { nickname: 'Ada' }, error: null },
      player_tokens: { data: { client_token: 'tok-1' }, error: null },
      session_kicks: { data: {}, error: null },
    });
    await expect(kickPlayer('p1', 'sess-1')).resolves.toEqual({ success: true });
    expect(admin.lastInsert('session_kicks')).toEqual({
      session_id: 'sess-1',
      nickname: 'Ada',
      client_token: 'tok-1',
    });
  });

  it('arms 2x on the leaderboard and locks it once the question starts', async () => {
    host.setTable('game_sessions', {
      data: { id: 'sess-1', active_multiplier: 2, status: 'leaderboard' },
      error: null,
    });
    const { setSessionMultiplier } = await import('@/app/actions/game');
    await expect(setSessionMultiplier('sess-1', 2)).resolves.toEqual({
      success: true,
      active_multiplier: 2,
    });
    expect(host.lastUpdate('game_sessions')).toEqual({ active_multiplier: 2 });

    host.setTable('game_sessions', {
      data: { id: 'sess-1', active_multiplier: 1, status: 'question_active' },
      error: null,
    });
    await expect(setSessionMultiplier('sess-1', 2)).rejects.toThrow(/lock once the question starts/);
  });

  it('reveals via the scoring RPC', async () => {
    host.setRpc('apply_question_scores_and_reveal', {
      data: {
        optionCounts: { a: 3 },
        leaderboard: [{ id: 'p1', nickname: 'Ada', score: 900, streak: 1, connected: true }],
        alreadyApplied: false,
      },
      error: null,
    });
    const { revealQuestionResults } = await import('@/app/actions/game');
    const result = await revealQuestionResults('sess-1', 'q1');
    expect(result.optionCounts).toEqual({ a: 3 });
    expect(result.leaderboard[0].nickname).toBe('Ada');
    expect(host.rpc).toHaveBeenCalledWith('apply_question_scores_and_reveal', {
      p_session_id: 'sess-1',
      p_question_id: 'q1',
    });
  });

  it('stops the jump when the live room cannot be read', async () => {
    host.rpc.mockClear();
    host.setTable('game_sessions', { data: null, error: { message: 'read failed' } });
    const { goToNextQuestion } = await import('@/app/actions/game');
    await expect(goToNextQuestion('sess-1', 1)).rejects.toThrow(/read failed/);
    expect(host.rpc).not.toHaveBeenCalled();
  });

  it('applies the current round scores before jumping to another question', async () => {
    host.setTables({
      game_sessions: [
        {
          data: {
            status: 'question_active',
            current_question_index: 0,
            question_order: ['q1', 'q2'],
            scores_applied_question_id: null,
            quiz_id: 'quiz-1',
          },
          error: null,
        },
        { data: { question_started_at: 't-next' }, error: null },
      ],
    });
    host.setRpc('apply_question_scores_and_reveal', { data: { alreadyApplied: false }, error: null });
    const { goToNextQuestion } = await import('@/app/actions/game');
    await expect(goToNextQuestion('sess-1', 1)).resolves.toEqual({
      success: true,
      serverStartedAt: 'pg-now',
    });
    expect(host.rpc).toHaveBeenCalledWith('apply_question_scores_and_reveal', {
      p_session_id: 'sess-1',
      p_question_id: 'q1',
    });
  });

  it('does not re-apply scores when the question is already in scored_question_ids', async () => {
    host.setTables({
      game_sessions: [
        {
          data: {
            status: 'question_active',
            current_question_index: 0,
            question_order: ['q1', 'q2'],
            scores_applied_question_id: null,
            scored_question_ids: ['q1'],
            quiz_id: 'quiz-1',
          },
          error: null,
        },
        { data: { question_started_at: 't-next' }, error: null },
      ],
    });
    const { goToNextQuestion } = await import('@/app/actions/game');
    await expect(goToNextQuestion('sess-1', 1)).resolves.toEqual({
      success: true,
      serverStartedAt: 'pg-now',
    });
    expect(host.rpc).toHaveBeenCalledWith('advance_question', { p_session_id: 'sess-1', p_index: 1 });
    expect(
      host.rpc.mock.calls.every((call) => call[0] !== 'apply_question_scores_and_reveal')
    ).toBe(true);
  });

  it('advances leaderboard, next question, podium, and end', async () => {
    host.setTable('game_sessions', { data: { question_started_at: 't' }, error: null });
    const actions = await import('@/app/actions/game');
    await expect(actions.goToLeaderboard('sess-1')).resolves.toEqual({ success: true });
    await expect(actions.goToNextQuestion('sess-1', 2)).resolves.toEqual({
      success: true,
      serverStartedAt: 'pg-now',
    });
    expect(host.rpc).toHaveBeenCalledWith('advance_question', { p_session_id: 'sess-1', p_index: 2 });
    await expect(actions.goToPodium('sess-1')).resolves.toEqual({ success: true });
    await expect(actions.endGameSession('sess-1')).resolves.toEqual({ success: true });
  });

  it('updates connection only when the player token matches', async () => {
    admin.setTable('player_tokens', { data: { client_token: 'good' }, error: null });
    const { updatePlayerConnection } = await import('@/app/actions/game');
    await expect(updatePlayerConnection('p1', 'bad', false)).resolves.toMatchObject({
      success: false,
    });

    admin.setTables({
      player_tokens: { data: { client_token: 'good' }, error: null },
      players: { data: {}, error: null },
    });
    await expect(updatePlayerConnection('p1', 'good', false)).resolves.toEqual({ success: true });
    expect(admin.lastUpdate('players')).toEqual({ connected: false });
  });

  it('persists a late-join cutoff for the owning host', async () => {
    host.setTable('game_sessions', { data: { late_join_through_index: -1 }, error: null });
    const { setLateJoinThroughIndex } = await import('@/app/actions/game');
    await expect(setLateJoinThroughIndex('sess-1', -1)).resolves.toEqual({
      success: true,
      late_join_through_index: -1,
    });
    expect(host.lastUpdate('game_sessions')).toEqual({ late_join_through_index: -1 });
  });
});
