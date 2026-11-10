export type RosterSource = {
  id: string;
  nickname: string;
  score: number;
  streak: number;
  connected: boolean;
  team_name?: string | null;
};

export type PublicRosterRow = {
  nickname: string;
  score: number;
  streak: number;
  connected: boolean;
  team_name: string | null;
  isMe: boolean;
};

/** Phones need rank and team totals. They do not need anyone else's id. */
export function publicRoster(players: readonly RosterSource[], callerId: string): PublicRosterRow[] {
  return players.map((player) => ({
    nickname: player.nickname,
    score: player.score,
    streak: player.streak,
    connected: player.connected,
    team_name: player.team_name ?? null,
    isMe: player.id === callerId,
  }));
}
