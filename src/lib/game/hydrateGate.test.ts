import { describe, expect, it } from 'vitest';
import {
  claimHydrate,
  createHydrateGate,
  hydrateResponseIsStale,
  noteHydrateStateEvent,
  settleHydrate,
} from '@/lib/game/hydrateGate';

describe('hydrate gate', () => {
  it('keeps one read in flight and replays after a newer room event', () => {
    const gate = createHydrateGate();
    const first = claimHydrate(gate);
    expect(first).toBe(0);
    expect(claimHydrate(gate)).toBeNull();

    noteHydrateStateEvent(gate);
    expect(hydrateResponseIsStale(first ?? -1, gate)).toBe(true);
    expect(settleHydrate(gate)).toBe(true);

    const second = gate.event;
    expect(hydrateResponseIsStale(second, gate)).toBe(false);
    expect(settleHydrate(gate)).toBe(false);
    expect(gate.inFlight).toBe(false);
  });
});