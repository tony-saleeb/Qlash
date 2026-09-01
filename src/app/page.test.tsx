/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createClientMock } from '@/test/supabaseMock';

const router = { push: vi.fn(), prefetch: vi.fn() };
const supabase = createClientMock();

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/game/joinClient', () => ({
  joinOrReconnect: vi.fn(),
}));

import LandingClient from '@/app/LandingClient';
import { joinOrReconnect } from '@/lib/game/joinClient';
import { MESSAGES } from '@/lib/i18n/messages';

describe('Landing page', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'qlash_locale=; path=/; max-age=0';
  });

  it('shows player join by default and the Qlash identity', () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    const { container } = render(<LandingClient />);
    expect(container.firstElementChild).toHaveAttribute('dir', 'ltr');
    expect(screen.getAllByText('Qlash').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /jump in/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: MESSAGES.en.tryDemo }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
  });

  it('opens the host panel with Google sign-in', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    const user = userEvent.setup();
    render(<LandingClient />);
    await user.click(screen.getByRole('button', { name: /^host$/i }));
    const google = await screen.findByRole('button', { name: /continue with google/i });
    expect(google).toBeInTheDocument();
    expect(google.querySelector('svg')).toBeTruthy();
  });

  it('joins a room through joinOrReconnect and routes into play', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    vi.mocked(joinOrReconnect).mockResolvedValue({ sessionId: 'sess-9', reconnected: false });
    const user = userEvent.setup();
    render(<LandingClient />);
    await user.type(screen.getByPlaceholderText('······'), '123456');
    await user.type(screen.getByPlaceholderText('Name on the board'), 'Ada');
    await user.click(screen.getByRole('button', { name: /jump in/i }));
    expect(joinOrReconnect).toHaveBeenCalledWith({ pin: '123456', nickname: 'Ada', teamName: undefined });
    expect(router.push).toHaveBeenCalledWith('/play/sess-9');
  });

  it('renders the landing in Arabic when the server locale is ar', () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    const { container } = render(<LandingClient initialLocale="ar" />);
    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText(MESSAGES.ar.heroBody)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MESSAGES.ar.jumpIn })).toBeInTheDocument();
  });
});
