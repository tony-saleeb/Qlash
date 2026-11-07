/** True only when a Realtime DELETE payload is this player's own row. */
export function isOwnRemoval(payload: unknown, playerId: string): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (!('old' in payload)) return false;
  const oldRow = payload.old;
  if (!oldRow || typeof oldRow !== 'object') return false;
  if (!('id' in oldRow)) return false;
  return typeof oldRow.id === 'string' && oldRow.id === playerId;
}
