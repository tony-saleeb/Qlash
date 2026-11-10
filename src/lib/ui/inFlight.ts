/** The first caller takes the turn. A second click while it is held does nothing. */
export function claimInFlight(flag: { current: boolean }): boolean {
  if (flag.current) return false;
  flag.current = true;
  return true;
}

export function releaseInFlight(flag: { current: boolean }): void {
  flag.current = false;
}
