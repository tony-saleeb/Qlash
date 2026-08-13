import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(() => ({ ok: true as const })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  clientIpFromRequest: () => 'test-ip',
}));

const admin = createClientMock();

const validBody = {
  sessionId: 'sess-1',
  playerId: 'p1',
  token: 'tok',
  questionId: 'q1',
  selectedAnswerIds: ['a'],
};

describe('POST /api/submit-answer', () => {
  beforeEach(() => {
    admin.reset();
    rateLimitMock.mockReturnValue({ ok: true });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
  });

  it('rejects missing fields and empty/oversized answer arrays', async () => {
    const { POST } = await import('@/app/api/submit-answer/route');
    expect((await readJson(await POST(jsonRequest({ sessionId: 's' })))).status).toBe(400);
    expect(
      (await readJson(await POST(jsonRequest({ ...validBody, selectedAnswerIds: [] })))).status
    ).toBe(400);
    expect(
      (
        await readJson(
          await POST(jsonRequest({ ...validBody, selectedAnswerIds: ['1', '2', '3', '4', '5', '6', '7'] }))
        )
      ).status
    ).toBe(400);
  });

  it('rate-limits by IP before calling Postgres', async () => {
    rateLimitMock.mockReturnValueOnce({ ok: false, retryAfterSec: 9 });
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest(validBody)));
    expect(result.status).toBe(429);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('rate-limits by player after validating the payload', async () => {
    rateLimitMock.mockReturnValueOnce({ ok: true }).mockReturnValueOnce({ ok: false, retryAfterSec: 3 });
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest(validBody)));
    expect(result.status).toBe(429);
    expect(result.body.error).toMatch(/Slow down/);
  });

  it('maps RPC auth and closed-round errors', async () => {
    const { POST } = await import('@/app/api/submit-answer/route');
    admin.setRpc('submit_live_answer', { data: null, error: { message: 'UNAUTHORIZED' } });
    expect((await readJson(await POST(jsonRequest(validBody)))).status).toBe(401);

    admin.setRpc('submit_live_answer', { data: null, error: { message: 'SUBMISSIONS_CLOSED' } });
    expect((await readJson(await POST(jsonRequest(validBody)))).status).toBe(403);

    admin.setRpc('submit_live_answer', { data: null, error: { message: 'WRONG_QUESTION' } });
    expect((await readJson(await POST(jsonRequest(validBody)))).status).toBe(403);

    admin.setRpc('submit_live_answer', { data: null, error: { message: 'INVALID_ANSWER' } });
    expect((await readJson(await POST(jsonRequest(validBody)))).status).toBe(400);
  });

  it('explains a missing submit_live_answer function as 503', async () => {
    admin.setRpc('submit_live_answer', {
      data: null,
      error: { message: 'function public.submit_live_answer(uuid) does not exist' },
    });
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest(validBody)));
    expect(result.status).toBe(503);
    expect(result.body.error).toMatch(/schema-fast-submit/);
  });

  it('returns points and duplicate flag from a successful RPC', async () => {
    admin.setRpc('submit_live_answer', {
      data: { success: true, duplicate: true, pointsAwarded: 750, isCorrect: true },
      error: null,
    });
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest(validBody)));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      duplicate: true,
      pointsAwarded: 750,
      isCorrect: true,
      message: 'Answer already recorded.',
    });
    expect(admin.rpc).toHaveBeenCalledWith('submit_live_answer', {
      p_player_id: 'p1',
      p_token: 'tok',
      p_session_id: 'sess-1',
      p_question_id: 'q1',
      p_selected: ['a'],
    });
  });
});
