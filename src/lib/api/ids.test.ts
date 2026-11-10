import { describe, expect, it } from 'vitest';
import { isUuid, tokenBucketSuffix } from '@/lib/api/ids';

describe('player ids', () => {
  it('accepts a uuid and rejects everything else', () => {
    expect(isUuid('22222222-2222-4222-8222-222222222222')).toBe(true);
    expect(isUuid('p1')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it('gives two tokens different buckets for the same player', () => {
    const player = '22222222-2222-4222-8222-222222222222';
    const real = tokenBucketSuffix('real-token');
    const guessed = tokenBucketSuffix('guessed');
    expect(real).not.toBe(guessed);
    expect(`submit:player:${player}:${real}`).not.toBe(`submit:player:${player}:${guessed}`);
  });
});
