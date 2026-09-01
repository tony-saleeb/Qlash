import { describe, expect, it, vi } from 'vitest';
import { hostOp } from '@/lib/host/hostOp';

describe('hostOp', () => {
  it('returns JSON data from the host API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { id: 'sess-1' } }),
      }))
    );
    await expect(hostOp('createGameSession', { quizId: 'q1' })).resolves.toEqual({ id: 'sess-1' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/host/op',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ op: 'createGameSession', args: { quizId: 'q1' } }),
      })
    );
    vi.unstubAllGlobals();
  });

  it('throws the server error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: 'Quiz not found or unauthorized.' }),
      }))
    );
    await expect(hostOp('createGameSession', { quizId: 'nope' })).rejects.toThrow(/Quiz not found/);
    vi.unstubAllGlobals();
  });
});
