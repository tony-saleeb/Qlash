/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoCloseEmptyLobby } from '@/hooks/useAutoCloseEmptyLobby';

describe('useAutoCloseEmptyLobby', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes immediately when the last player row is gone', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook((props) => useAutoCloseEmptyLobby(props), {
      initialProps: {
        status: 'lobby',
        players: [{ connected: true }],
        initiallyOccupied: true,
        onClose,
      },
    });
    expect(onClose).not.toHaveBeenCalled();
    rerender({
      status: 'lobby',
      players: [],
      initiallyOccupied: true,
      onClose,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never closes a lobby whose players are all offline', () => {
    const onClose = vi.fn();
    const players = Array.from({ length: 80 }, () => ({ connected: false }));
    renderHook(() =>
      useAutoCloseEmptyLobby({
        status: 'lobby',
        players,
        initiallyOccupied: true,
        onClose,
      })
    );
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('treats missing connected as online', () => {
    const onClose = vi.fn();
    renderHook(() =>
      useAutoCloseEmptyLobby({
        status: 'lobby',
        players: [{}],
        initiallyOccupied: true,
        onClose,
      })
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
