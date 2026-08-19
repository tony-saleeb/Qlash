export function lobbyJoinPath(pin: string): string {
  const clean = pin.replace(/\D/g, '').slice(0, 6);
  return `/play?pin=${clean}`;
}

export function pinFromSearch(search: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const pin = (new URLSearchParams(raw).get('pin') || '').replace(/\D/g, '').slice(0, 6);
  return pin.length === 6 ? pin : null;
}
