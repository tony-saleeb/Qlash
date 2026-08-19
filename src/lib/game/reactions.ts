export const LOBBY_REACTION_IDS = ['slash', 'qring', 'bolt', 'chevron'] as const;
export type LobbyReactionId = (typeof LOBBY_REACTION_IDS)[number];

export const LOBBY_REACTION_MARKS: {
  id: LobbyReactionId;
  color: string;
  colorClass: string;
  markClass: string;
}[] = [
  { id: 'slash', color: '#e11d2e', colorClass: 'bg-arena-signal', markClass: 'text-white' },
  { id: 'qring', color: '#4a2aff', colorClass: 'bg-[#4a2aff]', markClass: 'text-white' },
  { id: 'bolt', color: '#c8f542', colorClass: 'bg-arena-acid', markClass: 'text-arena-ink' },
  { id: 'chevron', color: '#0a6b5c', colorClass: 'bg-arena-court', markClass: 'text-white' },
];

export const REACTION_COOLDOWN_MS = 650;
export const MAX_FLOATING_REACTIONS = 36;
export const REACTION_FLOAT_MS = 2400;

export function isLobbyReactionId(value: unknown): value is LobbyReactionId {
  return typeof value === 'string' && (LOBBY_REACTION_IDS as readonly string[]).includes(value);
}

export function canSendReaction(lastSentAt: number, now: number): boolean {
  return now - lastSentAt >= REACTION_COOLDOWN_MS;
}

export function reactionLeftPercent(seed: number): string {
  const n = Number.isFinite(seed) ? Math.abs(seed) : 0;
  return `${8 + (n % 84)}%`;
}
