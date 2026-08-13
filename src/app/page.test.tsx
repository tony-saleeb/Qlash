/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
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

import LandingPage from '@/app/page';
import { joinOrReconnect } from '@/lib/game/joinClient';

describe('Landing page', () => {
  it('shows player join by default and the Qlash identity', () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    render(<LandingPage />);
    expect(screen.getAllByText('Qlash').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /jump in/i })).toBeInTheDocument();
    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument();
  });

  it('opens the host panel with Google sign-in', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    const user = userEvent.setup();
    render(<LandingPage />);
    await user.click(screen.getByRole('button', { name: /^host$/i }));
    const google = await screen.findByRole('button', { name: /continue with google/i });
    expect(google).toBeInTheDocument();
    expect(google.querySelector('svg')).toBeTruthy();
  });

  it('joins a room through joinOrReconnect and routes into play', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    vi.mocked(joinOrReconnect).mockResolvedValue({ sessionId: 'sess-9', reconnected: false });
    const user = userEvent.setup();
    render(<LandingPage />);
    await user.type(screen.getByPlaceholderText('······'), '123456');
    await user.type(screen.getByPlaceholderText('Name on the board'), 'Ada');
    await user.click(screen.getByRole('button', { name: /jump in/i }));
    expect(joinOrReconnect).toHaveBeenCalledWith({ pin: '123456', nickname: 'Ada', teamName: undefined });
    expect(router.push).toHaveBeenCalledWith('/play/sess-9');
  });
});
