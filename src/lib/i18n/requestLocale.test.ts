import { beforeEach, describe, expect, it, vi } from 'vitest';

const headerGet = vi.fn();
const cookieGet = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => ({ get: headerGet }),
  cookies: () => ({ get: cookieGet }),
}));

import { readRequestLocale } from '@/lib/i18n/requestLocale';

describe('readRequestLocale', () => {
  beforeEach(() => {
    headerGet.mockReset();
    cookieGet.mockReset();
  });

  it('prefers the middleware locale header', async () => {
    headerGet.mockReturnValue('ar');
    cookieGet.mockReturnValue({ value: 'en' });
    expect(await readRequestLocale()).toBe('ar');
  });

  it('falls back to the locale cookie', async () => {
    headerGet.mockReturnValue(null);
    cookieGet.mockReturnValue({ value: 'ar' });
    expect(await readRequestLocale()).toBe('ar');
  });

  it('defaults to English', async () => {
    headerGet.mockReturnValue(null);
    cookieGet.mockReturnValue(undefined);
    expect(await readRequestLocale()).toBe('en');
  });
});
