/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_LOBBY_PLAYER_ABANDON_MS } from '@/lib/game/emptyLobby';
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

  it('closes after a grace period when every lobby player is offline', () => {
    const first = vi.fn();
    const second = vi.fn();
    const players = [{ connected: false }, { connected: false }];
    const { rerender } = renderHook((props) => useAutoCloseEmptyLobby(props), {
      initialProps: {
        status: 'lobby',
        players,
        initiallyOccupied: true,
        onClose: first,
      },
    });
    act(() => {
      vi.advanceTimersByTime(LAST_LOBBY_PLAYER_ABANDON_MS - 1);
    });
    expect(first).not.toHaveBeenCalled();
    rerender({
      status: 'lobby',
      players,
      initiallyOccupied: true,
      onClose: second,
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
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
      vi.advanceTimersByTime(LAST_LOBBY_PLAYER_ABANDON_MS + 100);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
