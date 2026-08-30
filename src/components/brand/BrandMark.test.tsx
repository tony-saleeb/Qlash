/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AnswerButton,
  ArenaFloor,
  BrandMark,
  LobbyWaitMarks,
  PinDisplay,
  StageBadge,
  playerChipColor,
} from '@/components/brand/BrandMark';
import { LobbyQr } from '@/components/brand/LobbyQr';
import { AnswerMark, AnswerSwatch } from '@/components/brand/AnswerMark';
import { GameShell, LiveChip, StatBox } from '@/components/brand/GameShell';

describe('BrandMark', () => {
  it('renders the Qlash wordmark', () => {
    render(<BrandMark />);
    expect(screen.getByText('Qlash')).toBeInTheDocument();
  });

  it('can hide the wordmark', () => {
    render(<BrandMark wordmark={false} />);
    expect(screen.queryByText('Qlash')).not.toBeInTheDocument();
  });
});

describe('PinDisplay', () => {
  it('splits a 6-digit PIN into cells', () => {
    render(<PinDisplay pin="847291" />);
    expect(screen.getByLabelText('PIN 847291')).toBeInTheDocument();
    for (const digit of '847291') {
      expect(screen.getAllByText(digit).length).toBeGreaterThan(0);
    }
  });

  it('keeps PIN digits left-to-right inside an RTL page', () => {
    render(
      <div dir="rtl">
        <PinDisplay pin="847291" />
      </div>
    );
    const row = screen.getByLabelText('PIN 847291');
    expect(row).toHaveAttribute('dir', 'ltr');
    expect(row).toHaveClass('ltr-isolate');
    expect([...row.querySelectorAll(':scope > span')].map((cell) => cell.textContent).join('')).toBe('847291');
  });
});

describe('Answer identity', () => {
  it('renders Kahoot aliases as Qlash marks', () => {
    const { container } = render(<AnswerMark shape="triangle" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('paints a swatch with the resolved Qlash color', () => {
    const { container } = render(<AnswerSwatch shape="diamond" color="#1368ce" />);
    expect(container.firstChild).toHaveStyle({ backgroundColor: '#4a2aff' });
  });

  it('fires AnswerButton clicks and shows the label', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <AnswerButton color="#e11d2e" shape="slash" label="Lock it" onClick={onClick} />
    );
    await user.click(screen.getByRole('button', { name: /lock it/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Lock it')).toHaveAttribute('dir', 'auto');
  });
});

describe('GameShell + chips', () => {
  it('wraps live UI on the arena stage', () => {
    render(
      <GameShell>
        <LiveChip>Question 1 of 10</LiveChip>
        <StatBox value={12} label="Seconds" />
        <StageBadge>80 players</StageBadge>
      </GameShell>
    );
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Seconds')).toBeInTheDocument();
    expect(screen.getByText('80 players')).toBeInTheDocument();
  });

  it('renders the four-mark arena floor', () => {
    const { container } = render(<ArenaFloor />);
    expect(container.querySelectorAll('svg').length).toBe(4);
  });

  it('renders looping lobby wait marks', () => {
    const { container } = render(<LobbyWaitMarks />);
    expect(container.querySelectorAll('svg').length).toBe(4);
  });

  it('lets a player tap a lobby mark', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<LobbyWaitMarks onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: 'bolt' }));
    expect(onPick).toHaveBeenCalledWith('bolt');
  });
});

describe('LobbyQr', () => {
  it('renders a themed room mark with the Qlash logo in the center', () => {
    render(<LobbyQr value="https://qlash.test/play?pin=847291" caption="Scan" />);
    const mark = screen.getByRole('img', { name: 'Lobby QR code' });
    expect(mark).toBeInTheDocument();
    expect(mark.querySelectorAll('circle').length).toBeGreaterThan(20);
    expect(screen.getByText('Scan')).toBeInTheDocument();
  });

  it('isolates the seal from an RTL page so the pattern does not mirror', () => {
    const { container } = render(
      <div dir="rtl">
        <LobbyQr value="https://qlash.test/play?pin=847291" />
      </div>
    );
    const wrap = container.querySelector('.ltr-isolate');
    expect(wrap).toHaveAttribute('dir', 'ltr');
    expect(wrap).toHaveClass('ltr-isolate');
  });
});

describe('playerChipColor', () => {
  it('is deterministic for a nickname', () => {
    expect(playerChipColor('Ada')).toBe(playerChipColor('Ada'));
    expect(playerChipColor('Ada')).not.toBe(playerChipColor('Bob'));
  });
});
