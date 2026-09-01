import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn(() => ({ stamp: Math.random() }));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClient(...args),
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
