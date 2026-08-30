import { describe, expect, it } from 'vitest';
import { lobbyJoinPath, lobbyJoinUrl, lobbyShareText, lobbyWhatsAppHref, pinFromSearch } from '@/lib/game/lobbyLink';

describe('lobbyLink', () => {
  it('builds a join path from a PIN', () => {
    expect(lobbyJoinPath('847291')).toBe('/play?pin=847291');
    expect(lobbyJoinUrl('https://qlash.test/', '847291')).toBe('https://qlash.test/play?pin=847291');
  });

  it('reads a six-digit pin from a query string', () => {
    expect(pinFromSearch('?pin=847291')).toBe('847291');
    expect(pinFromSearch('pin=12ab34')).toBeNull();
    expect(pinFromSearch('?pin=123')).toBeNull();
  });

  it('builds a WhatsApp invite with PIN and join link', () => {
    const url = 'https://qlash.test/play?pin=847291';
    expect(lobbyShareText('en', '847291', url)).toContain('PIN: 847291');
    expect(lobbyShareText('ar', '847291', url)).toContain('الكود: 847291');
    const href = lobbyWhatsAppHref('https://qlash.test', '847291', 'ar');
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('ادخلوا غرفة قلاش');
    expect(decodeURIComponent(href)).toContain(url);
  });
});
