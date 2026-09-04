import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupTeamModeByPin } from '@/lib/game/roomByPin';

describe('lookupTeamModeByPin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the pin-lookup API and never reads game_sessions from the browser', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ teamMode: true }),
      }))
    );
    await expect(lookupTeamModeByPin('847291')).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      '/api/player/room',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pin: '847291' }),
      })
    );
  });

  it('treats a short pin as not team mode', async () => {
    await expect(lookupTeamModeByPin('12')).resolves.toBe(false);
  });
});
