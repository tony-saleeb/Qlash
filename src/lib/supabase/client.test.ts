import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn((url: string, key: string) => {
  void url;
  void key;
  return { stamp: Math.random() };
});

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (url: string, key: string) => createBrowserClient(url, key),
}));

describe('createClient', () => {
  beforeEach(() => {
    createBrowserClient.mockClear();
    globalThis.__qlashBrowserClient = undefined;
  });

  it('reuses one browser client so live channels are not torn down on tap', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const first = createClient();
    const second = createClient();
    expect(first).toBe(second);
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
  });
});
