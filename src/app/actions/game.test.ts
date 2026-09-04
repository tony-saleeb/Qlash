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
  });

  it('refuses unauthenticated hosts', async () => {
    host.auth.getSession.mockResolvedValue({ data: { session: null } });
    host.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'no' } });
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
        { data: null, error: { code: '23505', message: 'duplicate pin' } },
        { data: { id: 'sess-2', pin: '550000', status: 'lobby', host_id: 'host-1' }, error: null },
      ],
    });
    const { createGameSession } = await import('@/app/actions/game');
    const session = await createGameSession('quiz-1');
    expect(session.id).toBe('sess-2');
  });

  it('refuses to start without a question order and only from lobby', async () => {
    const { startGameSession } = await import('@/app/actions/game');
    await expect(startGameSession('sess-1', [])).rejects.toThrow(/Question order is required/);

    host.setTable('game_sessions', { data: null, error: { message: 'not lobby' } });
    await expect(startGameSession('sess-1', ['q1'])).rejects.toThrow(/Ensure the session is in lobby/);
  });

  it('starts the first question and persists play order', async () => {
    host.setTable('game_sessions', {
      data: { id: 'sess-1', status: 'question_active', question_started_at: '2026-08-13T20:00:00.000Z' },
      error: null,
    });
    const { startGameSession } = await import('@/app/actions/game');
    const result = await startGameSession('sess-1', ['q1', 'q2']);
    expect(result.success).toBe(true);
    expect(host.lastUpdate('game_sessions')).toMatchObject({
      status: 'question_active',
      current_question_index: 0,
      question_order: ['q1', 'q2'],
      active_multiplier: 1,
      scores_applied_question_id: null,
    });
  });

  it('encodes pause as elapsed milliseconds on question_started_at', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T20:00:10.000Z'));
    host.setTables({
      game_sessions: [
        {
          data: {
            id: 'sess-1',
            status: 'question_active',
            question_started_at: '2026-08-13T20:00:00.000Z',
          },
          error: null,
        },
        { data: {}, error: null },
      ],
    });
    const { pauseGameSession } = await import('@/app/actions/game');
    await expect(pauseGameSession('sess-1')).resolves.toEqual({ success: true });
    expect(host.lastUpdate('game_sessions')).toEqual({
      status: 'question_paused',
      question_started_at: new Date(10_000).toISOString(),
    });
    vi.useRealTimers();
  });

  it('refuses pause when the round is not active', async () => {
    host.setTable('game_sessions', {
      data: { id: 'sess-1', status: 'lobby', question_started_at: null },
      error: null,
    });
    const { pauseGameSession } = await import('@/app/actions/game');
    await expect(pauseGameSession('sess-1')).rejects.toThrow(/not in an active question state/);
  });

  it('resumes by subtracting encoded elapsed from now', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T20:01:00.000Z'));
    host.setTables({
      game_sessions: [
        {
          data: {
            id: 'sess-1',
            status: 'question_paused',
            question_started_at: new Date(5000).toISOString(),
          },
          error: null,
        },
        { data: {}, error: null },
      ],
    });
    const { resumeGameSession } = await import('@/app/actions/game');
    const result = await resumeGameSession('sess-1');
    expect(new Date(result.serverStartedAt).getTime()).toBe(Date.parse('2026-08-13T20:01:00.000Z') - 5000);
    vi.useRealTimers();
  });

  it('adds time on an active clock by shifting startedAt forward', async () => {
    host.setTables({
      game_sessions: [
        {
          data: {
            id: 'sess-1',
            status: 'question_active',
            question_started_at: '2026-08-13T20:00:00.000Z',
          },
          error: null,
        },
        { data: {}, error: null },
      ],
    });
    const { addQuestionTime } = await import('@/app/actions/game');
    const result = await addQuestionTime('sess-1', 10);
    expect(result.addedSeconds).toBe(10);
    expect(result.serverStartedAt).toBe('2026-08-13T20:00:10.000Z');
  });

  it('adds time on a paused clock by reducing encoded elapsed', async () => {
    host.setTables({
      game_sessions: [
        {
          data: {
            id: 'sess-1',
            status: 'question_paused',
            question_started_at: new Date(8000).toISOString(),
          },
          error: null,
        },
        { data: {}, error: null },
      ],
    });
    const { addQuestionTime } = await import('@/app/actions/game');
    const result = await addQuestionTime('sess-1', 3);
    expect(new Date(result.serverStartedAt).getTime()).toBe(5000);
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
  });

  it('persists the live 2x multiplier', async () => {
    host.setTable('game_sessions', {
      data: { id: 'sess-1', active_multiplier: 2, status: 'question_active' },
      error: null,
    });
    const { setSessionMultiplier } = await import('@/app/actions/game');
    await expect(setSessionMultiplier('sess-1', 2)).resolves.toEqual({
      success: true,
      active_multiplier: 2,
    });
    expect(host.lastUpdate('game_sessions')).toEqual({ active_multiplier: 2 });
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
      serverStartedAt: 't-next',
    });
    expect(host.rpc).toHaveBeenCalledWith('apply_question_scores_and_reveal', {
      p_session_id: 'sess-1',
      p_question_id: 'q1',
    });
  });

  it('advances leaderboard, next question, podium, and end', async () => {
    host.setTable('game_sessions', { data: { question_started_at: 't' }, error: null });
    const actions = await import('@/app/actions/game');
    await expect(actions.goToLeaderboard('sess-1')).resolves.toEqual({ success: true });
    await expect(actions.goToNextQuestion('sess-1', 2)).resolves.toEqual({
      success: true,
      serverStartedAt: 't',
    });
    expect(host.lastUpdate('game_sessions')).toMatchObject({
      status: 'question_active',
      current_question_index: 2,
      active_multiplier: 1,
    });
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
