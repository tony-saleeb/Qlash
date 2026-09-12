/**
 * A class joins in one burst. The projector batches arrivals instead of
 * rendering the roster once per phone, so this merge has to stay duplicate-safe
 * even when a row shows up in both the seated list and the pending batch.
 */
export function seatArrivals<T extends { id: string }>(seated: T[], arrivals: T[]): T[] {
  if (arrivals.length === 0) return seated;
  const taken = new Set(seated.map((row) => row.id));
  const added: T[] = [];
  for (const arrival of arrivals) {
    if (taken.has(arrival.id)) continue;
    taken.add(arrival.id);
    added.push(arrival);
  }
  return added.length === 0 ? seated : [...seated, ...added];
}
