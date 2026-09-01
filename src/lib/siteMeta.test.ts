import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { PLAY_TITLE, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/siteMeta';

describe('public site metadata', () => {
  it('leads with Arabic in the default title and description', () => {
    expect(SITE_TITLE.startsWith('قلاش')).toBe(true);
    expect(SITE_DESCRIPTION).toContain('كويز حي');
    expect(PLAY_TITLE).toContain('ادخل الغرفة');
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
