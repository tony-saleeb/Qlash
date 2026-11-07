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
  const [connection, setConnection] = useState(0);
  const readyRef = useRef(false);
  const deniedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    const client = supabaseRef.current;
    deniedRef.current = false;
    const channel = client.channel(`session:${sessionId}`, {
      config: { private: true, broadcast: { ack: false } },
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

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        readyRef.current = false;
        setReady(false);
        if (!deniedRef.current) {
          deniedRef.current = true;
          const message =
            err && typeof err === 'object' && 'message' in err
              ? String(err.message)
              : 'session channel CHANNEL_ERROR';
          console.warn(message);
        }
        return;
      }
      const isReady = status === 'SUBSCRIBED';
      readyRef.current = isReady;
      setReady(isReady);
      if (isReady) setConnection((count) => count + 1);
    });

    return () => {
      readyRef.current = false;
      deniedRef.current = false;
      setReady(false);
      channelRef.current = null;
      client.removeChannel(channel);
    };
  }, [sessionId]);

  const send = useCallback(async (event: string, payload: SessionBroadcastPayload) => {
    if (deniedRef.current) return { ok: false as const };
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

  return { ready, connection, send, supabase };
}
