/** Security failures the probe must not ignore. A missed host click is not one of them. */
export function realtimeProbeFailures({ hostStatus, legacyStatus, sendStatus, spoofedStarts }) {
  const failures = [];
  if (hostStatus === 'SUBSCRIBED') failures.push('anon joined the private host topic');
  if (legacyStatus === 'SUBSCRIBED') failures.push('anon joined the legacy public topic');
  if (sendStatus === 'ok') failures.push('anon broadcast was accepted');
  if (spoofedStarts > 0) failures.push('listener received a spoofed question:start');
  return failures;
}
