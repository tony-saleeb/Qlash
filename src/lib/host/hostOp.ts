import type { HostOpName } from '@/lib/host/ops';

export async function hostOp<T>(op: HostOpName, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('/api/host/op', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, args }),
  });
  const body = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok) {
    throw new Error(body.error || 'Request failed.');
  }
  if (body.data === undefined) {
    throw new Error('Request failed.');
  }
  return body.data;
}
