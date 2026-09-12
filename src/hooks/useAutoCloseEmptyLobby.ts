'use client';

import { useEffect, useRef } from 'react';
import { lobbyShouldCloseNow } from '@/lib/game/emptyLobby';

/**
 * Seal a lobby that emptied out. Only player rows count — never presence.
 * Phones report connected=false on screen lock, so an offline room is still
 * a full room waiting for the host to press Start.
 */
export function useAutoCloseEmptyLobby(params: {
  status: string;
  players: { connected?: boolean | null }[];
  initiallyOccupied: boolean;
  onClose: () => void;
}) {
  const hadPlayersRef = useRef(params.initiallyOccupied);
  const closedRef = useRef(false);
  const onCloseRef = useRef(params.onClose);
  onCloseRef.current = params.onClose;

  if (params.players.length > 0) hadPlayersRef.current = true;

  const empty = lobbyShouldCloseNow({
    status: params.status,
    hadPlayers: hadPlayersRef.current,
    playerCount: params.players.length,
  });

  useEffect(() => {
    if (closedRef.current || !empty) return;
    closedRef.current = true;
    onCloseRef.current();
  }, [empty]);
}
