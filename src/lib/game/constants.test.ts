import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';
import { DEFAULT_QUIZ_THEME, QLASH_CONFETTI } from '@/lib/game/theme';
import {
  MAX_PLAYERS_PER_SESSION,
  NICKNAME_MAX_LEN,
  NICKNAME_MIN_LEN,
  RATE_LIMITS,
  livePlayerCap,
  quizLibraryCap,
} from '@/lib/game/constants';

describe('cn', () => {
  it('merges tailwind classes and drops conflicts', () => {
    expect(cn('px-2', 'px-4', false && 'hidden', 'font-bold')).toBe('px-4 font-bold');
  });
});

describe('theme + capacity constants', () => {
  it('keeps the Qlash stage palette', () => {
    expect(DEFAULT_QUIZ_THEME.bgColor).toBe('#0c0e14');
    expect(DEFAULT_QUIZ_THEME.primaryColor).toBe('#e11d2e');
    expect(DEFAULT_QUIZ_THEME.accentColor).toBe('#c8f542');
    expect(QLASH_CONFETTI).toEqual(['#e11d2e', '#c8f542', '#4a2aff', '#0a6b5c', '#ff2d6a', '#ffffff']);
  });

  it('caps a live room at 80 players with classroom-scale rate limits', () => {
    expect(MAX_PLAYERS_PER_SESSION).toBe(80);
    expect(NICKNAME_MIN_LEN).toBe(1);
    expect(NICKNAME_MAX_LEN).toBe(20);
    expect(RATE_LIMITS.joinPerIp.limit).toBe(120);
    expect(RATE_LIMITS.submitPerPlayer.limit).toBe(8);
    expect(livePlayerCap('free')).toBe(30);
    expect(livePlayerCap('pro')).toBe(80);
    expect(quizLibraryCap('free')).toBe(5);
    expect(quizLibraryCap('org')).toBe(Number.POSITIVE_INFINITY);
  });
});
