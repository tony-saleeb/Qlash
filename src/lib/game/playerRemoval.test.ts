import { describe, expect, it } from 'vitest';
import { isOwnRemoval } from '@/lib/game/playerRemoval';

describe('isOwnRemoval', () => {
  it('accepts this player id', () => {
    expect(isOwnRemoval({ old: { id: 'p1' } }, 'p1')).toBe(true);
  });

  it('rejects another player id', () => {
    expect(isOwnRemoval({ old: { id: 'p2' } }, 'p1')).toBe(false);
  });

  it('rejects an old row with no id', () => {
    expect(isOwnRemoval({ old: {} }, 'p1')).toBe(false);
  });

  it('rejects null', () => {
    expect(isOwnRemoval(null, 'p1')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isOwnRemoval(undefined, 'p1')).toBe(false);
  });

  it('rejects a string', () => {
    expect(isOwnRemoval('p1', 'p1')).toBe(false);
  });

  it('rejects a non-string id', () => {
    expect(isOwnRemoval({ old: { id: 42 } }, 'p1')).toBe(false);
  });
});
