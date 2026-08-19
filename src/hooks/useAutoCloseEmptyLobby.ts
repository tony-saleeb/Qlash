'use client';

import { useEffect, useRef } from 'react';
import {
  LAST_LOBBY_PLAYER_ABANDON_MS,
  lobbyAbandonedByLastPlayer,
  lobbyShouldCloseNow,
} from '@/lib/game/emptyLobby';

export function useAutoCloseEmptyLobby(params: {
  status: string;
  players: { connected: boolean }[];
  initiallyOccupied: boolean;
  onClose: () => void;
}) {
  const hadPlayersRef = useRef(params.initiallyOccupied);
  const closedRef = useRef(false);
  if (params.players.length > 0) hadPlayersRef.current = true;

  const playerCount = params.players.length;
  const connectedCount = params.players.filter((player) => player.connected).length;
  const empty = lobbyShouldCloseNow({
    status: params.status,
    hadPlayers: hadPlayersRef.current,
    playerCount,
  });
  const abandoned = lobbyAbandonedByLastPlayer({
    status: params.status,
    hadPlayers: hadPlayersRef.current,
    playerCount,
    connectedCount,
  });
  const { onClose, status } = params;

  useEffect(() => {
    if (closedRef.current) return;
    if (empty) {
      closedRef.current = true;
      onClose();
      return;
    }
    if (!abandoned) return;
    const timer = window.setTimeout(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      onClose();
    }, LAST_LOBBY_PLAYER_ABANDON_MS);
    return () => window.clearTimeout(timer);
  }, [abandoned, empty, onClose, status]);
}
