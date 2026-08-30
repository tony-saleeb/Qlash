/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createClientMock } from '@/test/supabaseMock';
import { MESSAGES } from '@/lib/i18n/messages';

const router = { push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() };
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

import PlayJoinClient from '@/app/play/PlayJoinClient';
import { joinOrReconnect } from '@/lib/game/joinClient';

describe('Player join page', () => {
  beforeEach(() => {
    localStorage.clear();
    router.replace.mockReset();
    vi.mocked(joinOrReconnect).mockReset();
    supabase.reset();
    supabase.setTable('game_sessions', { data: { id: 'sess-1', quizzes: { team_mode: false } } });
  });

  it('hides the PIN field when opened from a lobby invite link', async () => {
    window.history.replaceState({}, '', '/play?pin=847291');
    render(<PlayJoinClient />);
    expect(await screen.findByText(MESSAGES.en.inviteOnlyHint)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('······')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(MESSAGES.en.nicknamePlaceholder)).toBeInTheDocument();
  });

  it('joins with the pin from the invite link', async () => {
    vi.mocked(joinOrReconnect).mockResolvedValue({ sessionId: 'sess-1', reconnected: false });
    window.history.replaceState({}, '', '/play?pin=847291');
    const user = userEvent.setup();
    render(<PlayJoinClient />);
    await screen.findByText(MESSAGES.en.inviteOnlyHint);
    await user.type(screen.getByPlaceholderText(MESSAGES.en.nicknamePlaceholder), 'Nour');
    await user.click(screen.getByRole('button', { name: /jump in/i }));
    expect(joinOrReconnect).toHaveBeenCalledWith({
      pin: '847291',
      nickname: 'Nour',
      teamName: undefined,
    });
    expect(router.replace).toHaveBeenCalledWith('/play/sess-1');
  });

  it('blocks join when the phone is offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    window.history.replaceState({}, '', '/play?pin=847291');
    render(<PlayJoinClient />);
    expect(await screen.findByText(MESSAGES.en.youAreOffline, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jump in/i })).toBeDisabled();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });
});
