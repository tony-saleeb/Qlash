import { describe, expect, it, vi } from 'vitest';
import { fill } from '@/lib/i18n/messages';
import { formatHostDate, formatHostNumber } from '@/lib/i18n/format';

describe('host formatting', () => {
  it('fills named tokens and leaves unknown ones', () => {
    expect(fill('Move question {n} down', { n: 1 })).toBe('Move question 1 down');
    expect(fill('{count}/{cap}', { count: 2 })).toBe('2/{cap}');
  });

  it('formats a date with the app locale', () => {
    const RealDate = Intl.DateTimeFormat;
    const dateSpy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ) {
      return new RealDate(locales, options);
    });
    formatHostDate('ar', '2026-08-13T20:00:00.000Z', true);
    expect(dateSpy).toHaveBeenCalledWith('ar', { dateStyle: 'medium', timeStyle: 'short' });
    dateSpy.mockRestore();

    const RealNumber = Intl.NumberFormat;
    const numberSpy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (
      locales?: Intl.LocalesArgument
    ) {
      return new RealNumber(locales);
    });
    formatHostNumber('ar', 1400);
    expect(numberSpy).toHaveBeenCalledWith('ar');
    numberSpy.mockRestore();
  });

  it('returns nothing for a date that cannot be read', () => {
    expect(formatHostDate('en', 'not-a-date')).toBe('');
  });
});
