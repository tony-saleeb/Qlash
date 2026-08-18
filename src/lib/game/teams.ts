import type { Player } from '@/lib/game/types';

export interface TeamScoreRow {
  team_name: string;
  score: number;
  members: number;
  topPlayer: string;
}

/** Sum player scores by team_name (ignores empty team names). */
export function aggregateTeamScores(players: Player[]): TeamScoreRow[] {
  const map = new Map<string, TeamScoreRow>();

  for (const player of players) {
    const team = (player.team_name || '').trim();
    if (!team) continue;

    const existing = map.get(team);
    if (!existing) {
      map.set(team, {
        team_name: team,
        score: player.score,
        members: 1,
        topPlayer: player.nickname,
      });
    } else {
      existing.score += player.score;
      existing.members += 1;
      // Keep a representative name (highest individual score on the team)
      const currentTop = players.find((p) => p.nickname === existing.topPlayer);
      if (!currentTop || player.score > currentTop.score) {
        existing.topPlayer = player.nickname;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

/** Bar width for projector scoreboards. Never 0% so a last-place row still reads. */
export function scoreBarPercent(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.max(6, Math.round((Math.max(0, score) / maxScore) * 100));
}
