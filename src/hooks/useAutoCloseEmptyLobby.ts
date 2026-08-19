'use client';

import { useEffect, useRef } from 'react';
import {
  LAST_LOBBY_PLAYER_ABANDON_MS,
  connectedPlayerCount,
  lobbyAbandonedOffline,
  lobbyShouldCloseNow,
} from '@/lib/game/emptyLobby';

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

  const playerCount = params.players.length;
  const connectedCount = connectedPlayerCount(params.players);
  const empty = lobbyShouldCloseNow({
    status: params.status,
    hadPlayers: hadPlayersRef.current,
    playerCount,
  });
  const abandoned = lobbyAbandonedOffline({
    status: params.status,
    hadPlayers: hadPlayersRef.current,
    playerCount,
    connectedCount,
  });

  useEffect(() => {
    if (closedRef.current) return;
    if (empty) {
      closedRef.current = true;
      onCloseRef.current();
      return;
    }
    if (!abandoned) return;
    const timer = window.setTimeout(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      onCloseRef.current();
    }, LAST_LOBBY_PLAYER_ABANDON_MS);
    return () => window.clearTimeout(timer);
  }, [abandoned, empty, params.status]);
}
