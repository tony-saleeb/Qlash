export function hostEntryFromSearch(search: string): {
  openHost: boolean;
  authMode: 'login' | 'signup';
  authError: boolean;
} {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    openHost: params.get('host') === '1',
    authMode: params.get('mode') === 'signup' ? 'signup' : 'login',
    authError: params.get('authError') === '1',
  };
}
