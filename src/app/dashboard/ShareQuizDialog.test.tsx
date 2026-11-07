import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareQuizDialog } from '@/app/dashboard/ShareQuizDialog';
import { enableQuizShare, rotateQuizShare, stopQuizShare } from '@/lib/host/hostApi';

vi.mock('@/lib/host/hostApi', () => ({
  enableQuizShare: vi.fn(async () => ({ shareCode: 'NEWLINK1' })),
  rotateQuizShare: vi.fn(async () => ({ shareCode: 'NEWLINK2' })),
  stopQuizShare: vi.fn(async () => ({ shareCode: null })),
}));

vi.mock('@/lib/i18n/useLocale', () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        shareQuiz: 'Share',
        shareAnswersWarning: 'Anyone with this link can import the quiz, including the correct answers.',
        createShareLink: 'Create link',
        newShareLink: 'New link',
        stopSharing: 'Stop sharing',
        copyLink: 'Copy link',
        linkCopied: 'Share link copied.',
        sharingStopped: 'Sharing is off.',
        shareLinkUpdated: 'New link copied.',
      })[key] ?? key,
  }),
}));

const quiz = { id: 'quiz-1', title: 'Capitals', share_code: 'ABCD2345' };

describe('share quiz dialog', () => {
  beforeEach(() => {
    vi.mocked(enableQuizShare).mockClear();
    vi.mocked(rotateQuizShare).mockClear();
    vi.mocked(stopQuizShare).mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
  });

  it('warns that the link includes the answers, then replaces or stops the link', async () => {
    const onShareCode = vi.fn();
    render(<ShareQuizDialog quiz={quiz} open onOpenChange={vi.fn()} onShareCode={onShareCode} />);

    expect(screen.getByText(/including the correct answers/i)).toBeTruthy();
    expect(enableQuizShare).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'New link' }));
    expect(rotateQuizShare).toHaveBeenCalledWith('quiz-1');
    expect(onShareCode).toHaveBeenCalledWith('quiz-1', 'NEWLINK2');

    await userEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(stopQuizShare).toHaveBeenCalledWith('quiz-1');
    expect(onShareCode).toHaveBeenCalledWith('quiz-1', null);
  });

  it('creates a link only after the host asks', async () => {
    render(
      <ShareQuizDialog
        quiz={{ id: 'quiz-1', title: 'Capitals', share_code: null }}
        open
        onOpenChange={vi.fn()}
        onShareCode={vi.fn()}
      />
    );
    expect(screen.getByText(/including the correct answers/i)).toBeTruthy();
    expect(enableQuizShare).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }));
    expect(enableQuizShare).toHaveBeenCalledWith('quiz-1');
  });
});