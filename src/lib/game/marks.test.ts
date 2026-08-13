import { describe, expect, it } from 'vitest';
import { resolveAnswerColor, resolveMarkId } from '@/lib/game/marks';

describe('resolveMarkId', () => {
  it('maps Kahoot shapes onto Qlash marks', () => {
    expect(resolveMarkId('triangle')).toBe('slash');
    expect(resolveMarkId('diamond')).toBe('qring');
    expect(resolveMarkId('circle')).toBe('bolt');
    expect(resolveMarkId('square')).toBe('chevron');
    expect(resolveMarkId('star')).toBe('spark');
    expect(resolveMarkId('hexagon')).toBe('bars');
  });

  it('keeps native Qlash ids', () => {
    expect(resolveMarkId('slash')).toBe('slash');
    expect(resolveMarkId('bolt')).toBe('bolt');
  });
});

describe('resolveAnswerColor', () => {
  it('maps Kahoot palette onto Qlash colors', () => {
    expect(resolveAnswerColor('#1368ce')).toBe('#4a2aff');
    expect(resolveAnswerColor('#d89e00')).toBe('#c8f542');
    expect(resolveAnswerColor('#26890c')).toBe('#0a6b5c');
  });
});
