'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type SessionBroadcastPayload = Record<string, unknown>;
export type SessionBroadcastHandler = (payload: {
  payload: SessionBroadcastPayload;
}) => void;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Long-lived Supabase broadcast channel for a game session.
 * Subscribe once; send with short retries so 80-player rooms don't drop events.
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
  const readyRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`session_channel_${sessionId}`, {
      config: { broadcast: { ack: true } },
    });
    channelRef.current = channel;
    setReady(false);
    readyRef.current = false;

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
      const isReady = status === 'SUBSCRIBED';
      readyRef.current = isReady;
      setReady(isReady);
    });

    return () => {
      readyRef.current = false;
      setReady(false);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, sessionId]);

  const send = useCallback(async (event: string, payload: SessionBroadcastPayload) => {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!readyRef.current || !channelRef.current) {
        await sleep(100 * attempt);
        continue;
      }

      const result = await channelRef.current.send({
        type: 'broadcast',
        event,
        payload,
      });

      if (result === 'ok') {
        return { ok: true as const };
      }

      await sleep(80 * attempt);
    }

    console.warn(`session channel failed to send ${event} after retries`);
    return { ok: false as const };
  }, []);

  return { ready, send, supabase };
}
