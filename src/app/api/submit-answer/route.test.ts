import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock, jsonRequest, readJson } from '@/test/supabaseMock';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

type RateLimitResult = { ok: boolean; retryAfterSec?: number };
type RateLimitParams = { key: string; limit: number; windowMs: number };
type ShardedRateLimitParams = RateLimitParams & { seed: string; shards?: number };

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn((params: RateLimitParams | ShardedRateLimitParams): RateLimitResult => {
    void params;
    return { ok: true };
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (params: RateLimitParams) => rateLimitMock(params),
  rateLimitSharded: (params: ShardedRateLimitParams) => rateLimitMock(params),
  clientIpFromRequest: () => 'test-ip',
}));

const admin = createClientMock();

const validBody = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  playerId: '22222222-2222-4222-8222-222222222222',
  token: '44444444-4444-4444-8444-444444444444',
  questionId: '33333333-3333-4333-8333-333333333333',
  selectedAnswerIds: ['a'],
};

describe('POST /api/submit-answer', () => {
  beforeEach(() => {
    admin.reset();
    rateLimitMock.mockReset();
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

  it('rejects a repeated choice and a typed answer past 80 characters', async () => {
    const { POST } = await import('@/app/api/submit-answer/route');
    const stuffed = await readJson(
      await POST(jsonRequest({ ...validBody, selectedAnswerIds: ['1', '1', '1', '1', '1', '1'] }))
    );
    expect(stuffed.status).toBe(400);
    const longText = await readJson(
      await POST(jsonRequest({ ...validBody, selectedAnswerIds: ['a'.repeat(81)] }))
    );
    expect(longText.status).toBe(400);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('rejects a non-array answer and a body that is not JSON', async () => {
    const { POST } = await import('@/app/api/submit-answer/route');
    const shaped = await readJson(await POST(jsonRequest({ ...validBody, selectedAnswerIds: 'a' })));
    expect(shaped.status).toBe(400);
    expect(shaped.body.error).toBe('Invalid answer payload.');
    const broken = await POST(
      new Request('http://localhost/api', {
        method: 'POST',
        body: 'not-json',
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(broken.status).toBe(400);
    expect((await readJson(broken)).body.error).toBe('The request body must be JSON.');
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid player before charging any bucket', async () => {
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest({ ...validBody, playerId: 'p1' })));
    expect(result.status).toBe(400);
    const longToken = await readJson(await POST(jsonRequest({ ...validBody, token: 't'.repeat(200) })));
    expect(longToken.status).toBe(400);
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('rate-limits the caller token, so a guessed token cannot fill the real bucket', async () => {
    const { tokenBucketSuffix } = await import('@/lib/api/ids');
    rateLimitMock.mockReturnValueOnce({ ok: false, retryAfterSec: 3 });
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest(validBody)));
    expect(result.status).toBe(429);
    expect(result.body.error).toMatch(/Slow down/);
    expect(rateLimitMock.mock.calls[0][0].key).toBe(
      `submit:player:${validBody.playerId}:${tokenBucketSuffix(validBody.token)}`
    );
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('charges the network only after the token is rejected', async () => {
    admin.setRpc('submit_live_answer', { data: null, error: { message: 'UNAUTHORIZED' } });
    rateLimitMock.mockReturnValueOnce({ ok: true }).mockReturnValueOnce({ ok: false, retryAfterSec: 9 });
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest(validBody)));
    expect(result.status).toBe(429);
    expect(result.body.error).toMatch(/this network/);
    const keys = rateLimitMock.mock.calls.map((call) => call[0].key);
    expect(keys[1]).toBe('authfail:test-ip');
    expect(keys.some((key) => key === 'submit:test-ip')).toBe(false);
  });

  it('maps RPC auth and closed-round errors', async () => {
    const { POST } = await import('@/app/api/submit-answer/route');
    admin.setRpc('submit_live_answer', { data: null, error: { message: 'UNAUTHORIZED' } });
    expect((await readJson(await POST(jsonRequest(validBody)))).status).toBe(401);

    admin.setRpc('submit_live_answer', { data: null, error: { message: 'SUBMISSIONS_CLOSED' } });
    expect((await readJson(await POST(jsonRequest(validBody)))).status).toBe(403);

    admin.setRpc('submit_live_answer', { data: null, error: { message: 'QUESTION_PAUSED' } });
    const paused = await readJson(await POST(jsonRequest(validBody)));
    expect(paused.status).toBe(403);
    expect(paused.body.error).toMatch(/paused/i);

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

  it('returns only success, duplicate, and message from a successful RPC', async () => {
    admin.setRpc('submit_live_answer', {
      data: { success: true, duplicate: true, pointsAwarded: 750, isCorrect: true },
      error: null,
    });
    const { POST } = await import('@/app/api/submit-answer/route');
    const result = await readJson(await POST(jsonRequest(validBody)));
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      duplicate: true,
      message: 'Answer already recorded.',
    });
    expect(result.body).not.toHaveProperty('isCorrect');
    expect(result.body).not.toHaveProperty('pointsAwarded');
    expect(admin.rpc).toHaveBeenCalledWith('submit_live_answer', {
      p_player_id: validBody.playerId,
      p_token: validBody.token,
      p_session_id: validBody.sessionId,
      p_question_id: validBody.questionId,
      p_selected: ['a'],
    });
  });
});
