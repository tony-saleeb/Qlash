import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { PLAY_TITLE, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/siteMeta';

describe('public site metadata', () => {
  it('keeps the browser title in English', () => {
    expect(SITE_TITLE).toBe('Qlash — live classroom quiz');
    expect(SITE_TITLE).not.toMatch(/[\u0600-\u06FF]/);
    expect(PLAY_TITLE).toBe('Join a Qlash room');
    expect(PLAY_TITLE).not.toMatch(/[\u0600-\u06FF]/);
    expect(SITE_DESCRIPTION).toContain('كويز حي');
  });

  it('lists only public routes on the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith('/') || url.includes('localhost'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/play'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/demo'))).toBe(true);
    expect(urls.some((url) => url.includes('/dashboard'))).toBe(false);
  });

  it('hides host and API paths from crawlers', () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule?.disallow).toEqual(expect.arrayContaining(['/dashboard', '/host/', '/api/', '/auth/']));
    expect(robots().sitemap).toMatch(/sitemap\.xml$/);
  });
});
