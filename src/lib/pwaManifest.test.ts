import { describe, expect, it } from 'vitest';
import { playManifest } from '@/lib/pwaManifest';

describe('playManifest', () => {
  it('installs as a player-only home-screen app', () => {
    const manifest = playManifest();
    expect(manifest.start_url).toBe('/play');
    expect(manifest.scope).toBe('/play');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons?.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons?.some((icon) => icon.sizes === '512x512')).toBe(true);
  });
});
