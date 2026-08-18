import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientMock } from '@/test/supabaseMock';
import { createClient } from '@/lib/supabase/server';
import { setHostLocale } from '@/app/actions/host';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const host = createClientMock({ id: 'host-1', email: 'host@qlash.test' });

describe('setHostLocale', () => {
  beforeEach(() => {
    host.reset();
    vi.mocked(createClient).mockReturnValue(host as never);
  });

  it('persists en or ar on the host profile', async () => {
    host.setTable('hosts', { data: null, error: null });
    const result = await setHostLocale('ar');
    expect(result).toEqual({ success: true, locale: 'ar' });
    expect(host.lastUpdate('hosts')).toEqual({ ui_locale: 'ar' });
  });

  it('keeps the local choice when the column is missing', async () => {
    host.setTable('hosts', { data: null, error: { message: 'column ui_locale does not exist' } });
    const result = await setHostLocale('ar');
    expect(result).toEqual({ success: false, locale: 'ar' });
  });
});
