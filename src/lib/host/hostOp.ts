export async function hostOp<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('/api/host/op', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, args }),
  });
  const body = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok) {
    throw new Error(body.error || 'Request failed.');
  }
  return body.data as T;
}
