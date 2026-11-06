/** Same-origin path only. Protocol-relative and off-site values stay on the dashboard. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}
