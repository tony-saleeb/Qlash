import { describe, expect, it } from 'vitest';
import {
  canSendReaction,
  isLobbyReactionId,
  reactionLeftPercent,
  REACTION_COOLDOWN_MS,
} from '@/lib/game/reactions';

describe('lobby reactions', () => {
  it('accepts only the four Qlash marks', () => {
    expect(isLobbyReactionId('slash')).toBe(true);
    expect(isLobbyReactionId('bolt')).toBe(true);
    expect(isLobbyReactionId('star')).toBe(false);
  });

  it('enforces a cooldown so the projector is not flooded', () => {
    expect(canSendReaction(0, REACTION_COOLDOWN_MS)).toBe(true);
    expect(canSendReaction(100, 100 + REACTION_COOLDOWN_MS - 1)).toBe(false);
  });

  it('scatters floaters across the board', () => {
    expect(reactionLeftPercent(0)).toBe('8%');
    expect(reactionLeftPercent(83)).toBe('91%');
  });
});
