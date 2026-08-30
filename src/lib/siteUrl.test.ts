import { afterEach, describe, expect, it, vi } from 'vitest';
import { authCallbackUrl, metadataBaseUrl, publicSiteUrl } from '@/lib/siteUrl';

describe('publicSiteUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses NEXT_PUBLIC_SITE_URL on the server', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://qlash.app/');
    expect(publicSiteUrl()).toBe('https://qlash.app');
    expect(authCallbackUrl()).toBe('https://qlash.app/auth/callback');
  });

  it('returns empty on the server when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(publicSiteUrl()).toBe('');
  });

  it('uses NEXT_PUBLIC_SITE_URL for metadataBase and falls back to localhost', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://qlash.app/');
    expect(metadataBaseUrl().origin).toBe('https://qlash.app');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(metadataBaseUrl().origin).toBe('http://localhost:3000');
  });
});
