import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const host = createClientMock({ id: 'host-1', email: 'host@qlash.test' });

describe('readHostAuth', () => {
  beforeEach(() => {
    host.reset();
    vi.mocked(createClient).mockReturnValue(host as never);
  });

  it('uses the cookie session and does not call Auth', async () => {
    const { readHostAuth } = await import('@/lib/supabase/hostAuth');
    const result = await readHostAuth();
    expect(result.user?.id).toBe('host-1');
    expect(host.auth.getUser).not.toHaveBeenCalled();
  });

  it('falls back to getUser when the cookie is empty', async () => {
    host.auth.getSession.mockResolvedValue({ data: { session: null } });
    host.auth.getUser.mockResolvedValue({
      data: { user: { id: 'host-2' } },
      error: null,
    });
    const { readHostAuth } = await import('@/lib/supabase/hostAuth');
    const result = await readHostAuth();
    expect(result.user?.id).toBe('host-2');
    expect(host.auth.getUser).toHaveBeenCalled();
  });
});
