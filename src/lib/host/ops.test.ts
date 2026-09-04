import { describe, expect, it } from 'vitest';
import { HOST_OPS, isHostOp } from '@/lib/host/ops';

describe('host ops', () => {
  it('accepts every dispatched host operation and rejects unknown names', () => {
    expect(HOST_OPS).toContain('saveQuizData');
    expect(isHostOp('createGameSession')).toBe(true);
    expect(isHostOp('not-an-op')).toBe(false);
  });
});
