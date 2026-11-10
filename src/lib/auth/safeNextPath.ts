/** Same-origin path only. Protocol-relative, backslash, and off-site values stay on the dashboard. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/dashboard';
  return next;
}
