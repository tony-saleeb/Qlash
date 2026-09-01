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
 * ack:false so send() does not wait a full RTT; retries happen in the background.
 */
export function useSessionChannel(
  sessionId: string,
  options?: {
    supabase?: SupabaseClient;
    onEvents?: Record<string, SessionBroadcastHandler>;
  }
) {
  const supabase = options?.supabase ?? createClient();
  const supabaseRef = useRef(supabase);
  supabaseRef.current = supabase;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventsRef = useRef(options?.onEvents);
  onEventsRef.current = options?.onEvents;
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    const client = supabaseRef.current;
    const channel = client.channel(`session_channel_${sessionId}`, {
      config: { broadcast: { ack: false } },
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
      client.removeChannel(channel);
    };
  }, [sessionId]);

  const send = useCallback(async (event: string, payload: SessionBroadcastPayload) => {
    const trySend = async () => {
      if (!channelRef.current) return 'error' as const;
      return channelRef.current.send({
        type: 'broadcast',
        event,
        payload,
      });
    };

    if (!readyRef.current) {
      for (let i = 0; i < 8 && !readyRef.current; i++) {
        await sleep(25);
      }
    }

    const first = await trySend();
    if (first === 'ok') {
      return { ok: true as const };
    }

    void (async () => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        await sleep(40 * attempt);
        if ((await trySend()) === 'ok') return;
      }
      console.warn(`session channel failed to send ${event} after retries`);
    })();

    return { ok: Boolean(channelRef.current) };
  }, []);

  return { ready, send, supabase };
}
