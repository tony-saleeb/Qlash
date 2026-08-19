import { describe, expect, it } from 'vitest';
import { lobbyJoinPath, pinFromSearch } from '@/lib/game/lobbyLink';

describe('lobbyLink', () => {
  it('builds a join path from a PIN', () => {
    expect(lobbyJoinPath('847291')).toBe('/play?pin=847291');
  });

  it('reads a six-digit pin from a query string', () => {
    expect(pinFromSearch('?pin=847291')).toBe('847291');
    expect(pinFromSearch('pin=12ab34')).toBeNull();
    expect(pinFromSearch('?pin=123')).toBeNull();
  });
});
