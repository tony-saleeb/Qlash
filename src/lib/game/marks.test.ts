import { describe, expect, it } from 'vitest';
import {
  ANSWER_MARKS,
  answerMarkClass,
  answerUsesInk,
  markDefAt,
  resolveAnswerColor,
  resolveMarkId,
} from '@/lib/game/marks';

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
    expect(resolveMarkId('qring')).toBe('qring');
    expect(resolveMarkId('bolt')).toBe('bolt');
    expect(resolveMarkId('chevron')).toBe('chevron');
    expect(resolveMarkId('spark')).toBe('spark');
    expect(resolveMarkId('bars')).toBe('bars');
  });

  it('is case-insensitive and falls back to slash', () => {
    expect(resolveMarkId('BOLT')).toBe('bolt');
    expect(resolveMarkId('')).toBe('slash');
    expect(resolveMarkId(null)).toBe('slash');
    expect(resolveMarkId('unknown')).toBe('slash');
  });
});

describe('resolveAnswerColor', () => {
  it('maps Kahoot palette onto Qlash colors', () => {
    expect(resolveAnswerColor('#1368ce')).toBe('#4a2aff');
    expect(resolveAnswerColor('#d89e00')).toBe('#c8f542');
    expect(resolveAnswerColor('#26890c')).toBe('#0a6b5c');
    expect(resolveAnswerColor('#e21b3c')).toBe('#e11d2e');
    expect(resolveAnswerColor('#a855f7')).toBe('#ff2d6a');
    expect(resolveAnswerColor('#f97316')).toBe('#0a0c10');
    expect(resolveAnswerColor('#6366f1')).toBe('#4a2aff');
  });

  it('keeps native colors and is case-insensitive', () => {
    expect(resolveAnswerColor('#E11D2E')).toBe('#e11d2e');
    expect(resolveAnswerColor('  #c8f542  ')).toBe('#c8f542');
  });

  it('falls back to slash red for unknown colors', () => {
    expect(resolveAnswerColor('#ffffff')).toBe('#e11d2e');
    expect(resolveAnswerColor(null)).toBe('#e11d2e');
  });
});

describe('answerUsesInk / answerMarkClass', () => {
  it('uses ink glyphs only on acid/bolt', () => {
    expect(answerUsesInk('#c8f542')).toBe(true);
    expect(answerUsesInk('#d89e00')).toBe(true);
    expect(answerUsesInk('#e11d2e')).toBe(false);
  });

  it('uses acid text on the ink bars tile and white elsewhere', () => {
    expect(answerMarkClass('#c8f542')).toBe('text-arena-ink');
    expect(answerMarkClass('#0a0c10')).toBe('text-arena-acid');
    expect(answerMarkClass('#e11d2e')).toBe('text-white');
  });
});

describe('markDefAt', () => {
  it('wraps around the six Qlash marks', () => {
    expect(markDefAt(0)).toEqual(ANSWER_MARKS[0]);
    expect(markDefAt(6)).toEqual(ANSWER_MARKS[0]);
    expect(markDefAt(8)).toEqual(ANSWER_MARKS[2]);
  });
});
