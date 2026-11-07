import { describe, expect, it } from 'vitest';
import { hostEntryFromSearch } from '@/lib/auth/hostEntry';

describe('hostEntryFromSearch', () => {
  it('opens the host form in sign-in for /login', () => {
    expect(hostEntryFromSearch('?host=1&mode=login')).toEqual({
      openHost: true,
      authMode: 'login',
      authError: false,
    });
  });

  it('opens sign-up only when signup is asked for', () => {
    expect(hostEntryFromSearch('?host=1&mode=signup').authMode).toBe('signup');
    expect(hostEntryFromSearch('?host=1').authMode).toBe('login');
  });

  it('flags a failed confirmation link', () => {
    expect(hostEntryFromSearch('?authError=1').authError).toBe(true);
    expect(hostEntryFromSearch('?host=1').openHost).toBe(true);
    expect(hostEntryFromSearch('').openHost).toBe(false);
  });
});
