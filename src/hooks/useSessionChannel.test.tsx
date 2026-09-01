/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createClientMock } from '@/test/supabaseMock';
import { useSessionChannel } from '@/hooks/useSessionChannel';

describe('useSessionChannel', () => {
  it('subscribes to the session channel and can broadcast', async () => {
    const supabase = createClientMock();
    const onStart = vi.fn();
    const { result } = renderHook(() =>
      useSessionChannel('sess-1', {
        supabase: supabase as never,
        onEvents: { 'question:start': onStart },
      })
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(supabase.channel).toHaveBeenCalledWith(
      'session_channel_sess-1',
      expect.objectContaining({ config: { broadcast: { ack: false } } })
    );

    await result.current.send('host:skip', { reason: 'test' });
    const channel = supabase.channel.mock.results[0].value as {
      send: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
    };
    expect(channel.on).toHaveBeenCalledWith('broadcast', { event: 'question:start' }, expect.any(Function));
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'host:skip',
      payload: { reason: 'test' },
    });
  });

  it('does not resubscribe when the parent passes a new client object', async () => {
    const supabase = createClientMock();
    const { rerender } = renderHook(
      ({ client }) => useSessionChannel('sess-1', { supabase: client as never }),
      { initialProps: { client: supabase } }
    );
    await waitFor(() => expect(supabase.channel).toHaveBeenCalledTimes(1));
    const other = createClientMock();
    rerender({ client: other });
    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(other.channel).not.toHaveBeenCalled();
  });
});
