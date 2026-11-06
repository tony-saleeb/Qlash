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

  it('returns the subject from verified claims and does not read the cookie session', async () => {
    const { readHostAuth } = await import('@/lib/supabase/hostAuth');
    const result = await readHostAuth();
    expect(result.user).toEqual({ id: 'host-1', email: 'host@qlash.test' });
    expect(host.auth.getClaims).toHaveBeenCalled();
    expect(host.auth.getSession).not.toHaveBeenCalled();
    expect(host.auth.getUser).not.toHaveBeenCalled();
  });

  it('returns null when the token has no subject', async () => {
    host.auth.getClaims.mockResolvedValue({ data: null, error: { message: 'no' } });
    const { readHostAuth } = await import('@/lib/supabase/hostAuth');
    const result = await readHostAuth();
    expect(result.user).toBeNull();
  });
});
