import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenLobbyConfirm } from '@/app/host/open/[quizId]/OpenLobbyConfirm';
import { createGameSession } from '@/lib/host/hostApi';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/host/hostApi', () => ({
  createGameSession: vi.fn(async () => ({ id: 'sess-1' })),
}));

vi.mock('@/lib/i18n/useLocale', () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        openLobby: 'Open lobby',
        openLobbyHint: 'This starts a live room.',
        library: 'Library',
        failedOpenLobby: 'Could not open the lobby.',
      })[key] ?? key,
  }),
}));

describe('open lobby confirm', () => {
  beforeEach(() => {
    vi.mocked(createGameSession).mockClear();
  });

  it('does not start a room until the host presses the button', async () => {
    render(<OpenLobbyConfirm quizId="quiz-1" title="Capitals" />);
    expect(createGameSession).not.toHaveBeenCalled();
    expect(screen.getByText('Capitals')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Open lobby' }));
    expect(createGameSession).toHaveBeenCalledWith('quiz-1');
  });
});
