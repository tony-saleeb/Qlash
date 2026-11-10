import { describe, expect, it } from 'vitest';
import { realtimeProbeFailures } from './realtimeProbeResult.mjs';

describe('realtimeProbeFailures', () => {
  it('passes when anonymous clients are kept off the host and public topics', () => {
    expect(
      realtimeProbeFailures({
        hostStatus: 'CHANNEL_ERROR',
        legacyStatus: 'CLOSED',
        sendStatus: 'error',
        spoofedStarts: 0,
      })
    ).toEqual([]);
  });

  it('fails when a spoof lands or a private host topic accepts an anonymous client', () => {
    expect(
      realtimeProbeFailures({
        hostStatus: 'SUBSCRIBED',
        legacyStatus: 'SUBSCRIBED',
        sendStatus: 'ok',
        spoofedStarts: 1,
      })
    ).toEqual([
      'anon joined the private host topic',
      'anon joined the legacy public topic',
      'anon broadcast was accepted',
      'listener received a spoofed question:start',
    ]);
  });
});
