'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type SessionBroadcastPayload = Record<string, unknown>;
export type SessionBroadcastHandler = (payload: {
  payload: SessionBroadcastPayload;
}) => void;

/**
 * Long-lived Supabase broadcast channel for a game session.
 * Subscribe once for the session lifetime; send without per-event teardown.
 */
export function useSessionChannel(
  sessionId: string,
  options?: {
    supabase?: SupabaseClient;
    onEvents?: Record<string, SessionBroadcastHandler>;
  }
) {
  const supabase = options?.supabase ?? createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventsRef = useRef(options?.onEvents);
  onEventsRef.current = options?.onEvents;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`session_channel_${sessionId}`);
    channelRef.current = channel;
    setReady(false);

    const events = Object.keys(onEventsRef.current || {});
    for (const event of events) {
      channel.on('broadcast', { event }, (msg) => {
        const payload =
          (msg as unknown as { payload?: SessionBroadcastPayload }).payload ??
          (msg as unknown as SessionBroadcastPayload);
        onEventsRef.current?.[event]?.({ payload });
      });
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setReady(true);
    });

    return () => {
      setReady(false);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // Handlers are read from ref; only rebind when session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, sessionId]);

  const send = useCallback(async (event: string, payload: SessionBroadcastPayload) => {
    const channel = channelRef.current;
    if (!channel) {
      console.warn(`session channel not ready; dropped ${event}`);
      return { ok: false as const };
    }

    const result = await channel.send({
      type: 'broadcast',
      event,
      payload,
    });

    return { ok: result === 'ok' };
  }, []);

  return { ready, send, supabase };
}
