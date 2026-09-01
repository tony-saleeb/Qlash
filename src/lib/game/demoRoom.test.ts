import { beforeEach, describe, expect, it } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { DEMO_PIN, DEMO_SHARE_CODE, ensureDemoSession } from '@/lib/game/demoRoom';

describe('ensureDemoSession', () => {
  const admin = createClientMock();

  beforeEach(() => {
    admin.reset();
  });

  it('reuses a live lobby on the demo PIN', async () => {
    admin.setTable('game_sessions', { data: { id: 'sess-live', status: 'lobby', pin: DEMO_PIN }, error: null });
    await expect(ensureDemoSession(admin as never)).resolves.toEqual({ sessionId: 'sess-live', pin: DEMO_PIN });
  });

  it('returns null when no host exists yet', async () => {
    admin.setTables({
      game_sessions: { data: null, error: null },
      hosts: { data: null, error: null },
    });
    await expect(ensureDemoSession(admin as never)).resolves.toBeNull();
  });

  it('seeds a warmup quiz and lobby for the first host', async () => {
    admin.setTables({
      game_sessions: [
        { data: null, error: null },
        { data: { id: 'sess-new' }, error: null },
      ],
      hosts: { data: { id: 'host-1' }, error: null },
      quizzes: [
        { data: null, error: null },
        { data: { id: 'quiz-demo' }, error: null },
      ],
      questions: { data: {}, error: null },
    });
    await expect(ensureDemoSession(admin as never)).resolves.toEqual({ sessionId: 'sess-new', pin: DEMO_PIN });
    expect(admin.lastInsert('quizzes')).toMatchObject({
      host_id: 'host-1',
      share_code: DEMO_SHARE_CODE,
    });
  });

  it('frees a finished demo PIN before opening a new lobby', async () => {
    admin.setTables({
      game_sessions: [
        { data: { id: 'sess-old', status: 'finished', pin: DEMO_PIN }, error: null },
        { data: {}, error: null },
        { data: { id: 'sess-fresh' }, error: null },
      ],
      hosts: { data: { id: 'host-1' }, error: null },
      quizzes: { data: { id: 'quiz-demo' }, error: null },
    });
    await expect(ensureDemoSession(admin as never)).resolves.toEqual({ sessionId: 'sess-fresh', pin: DEMO_PIN });
    const updateCall = admin.fromCalls.find(
      (call) =>
        call.table === 'game_sessions' &&
        (call.chain as { _captured?: { method: string }[] })._captured?.some((item) => item.method === 'update')
    );
    const captured = (updateCall?.chain as { _captured?: { method: string; args: unknown[] }[] })._captured;
    const pin = (captured?.find((item) => item.method === 'update')?.args[0] as { pin?: string } | undefined)?.pin;
    expect(pin).toMatch(/^9\d{5}$/);
  });
});
