/**
 * One phone hydrate runs at a time. A newer room event stamps the in-flight
 * response as stale and asks for one fresh read after it finishes.
 */
export type HydrateGate = {
  inFlight: boolean;
  pending: boolean;
  event: number;
};

export function createHydrateGate(): HydrateGate {
  return { inFlight: false, pending: false, event: 0 };
}

export function noteHydrateStateEvent(gate: HydrateGate): void {
  gate.event += 1;
  if (gate.inFlight) gate.pending = true;
}

/** Event stamp for this request, or null when another request should finish first. */
export function claimHydrate(gate: HydrateGate): number | null {
  if (gate.inFlight) {
    gate.pending = true;
    return null;
  }
  gate.inFlight = true;
  gate.pending = false;
  return gate.event;
}

export function hydrateResponseIsStale(capturedEvent: number, gate: HydrateGate): boolean {
  return capturedEvent !== gate.event;
}

/** True when the caller should read the room again. */
export function settleHydrate(gate: HydrateGate): boolean {
  if (gate.pending) {
    gate.pending = false;
    return true;
  }
  gate.inFlight = false;
  return false;
}
