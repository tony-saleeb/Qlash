import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/auth/safeNextPath';

const origin = 'http://qlash.test';

function hostAfterRedirect(next: string | null): string {
  return new URL(`${origin}${safeNextPath(next)}`).host;
}

describe('safeNextPath', () => {
  it('keeps an in-app path, including a query', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/dashboard/quizzes/1?tab=edit')).toBe('/dashboard/quizzes/1?tab=edit');
    expect(safeNextPath('/host/sess-1')).toBe('/host/sess-1');
  });

  it('sends empty, relative, and off-site values to the dashboard', () => {
    for (const next of [
      null,
      '',
      '   ',
      'dashboard',
      'https://evil.com',
      'http://evil.com/phish',
      'javascript:alert(1)',
      '//evil.com',
      '///evil.com',
      '/\\evil.com',
      '/\\\\evil.com',
      '\\\\evil.com',
    ]) {
      expect(safeNextPath(next), JSON.stringify(next)).toBe('/dashboard');
      expect(hostAfterRedirect(next), JSON.stringify(next)).toBe('qlash.test');
    }
  });
});
