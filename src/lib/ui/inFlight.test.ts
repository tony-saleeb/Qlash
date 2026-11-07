import { describe, expect, it } from 'vitest';
import { claimInFlight, releaseInFlight } from '@/lib/ui/inFlight';

describe('in-flight guard', () => {
  it('lets the first click through and ignores the next until the request finishes', () => {
    const flag = { current: false };
    expect(claimInFlight(flag)).toBe(true);
    expect(claimInFlight(flag)).toBe(false);
    releaseInFlight(flag);
    expect(claimInFlight(flag)).toBe(true);
  });
});