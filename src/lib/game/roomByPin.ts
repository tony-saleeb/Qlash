export async function lookupTeamModeByPin(pin: string): Promise<boolean> {
  if (pin.length !== 6) return false;
  try {
    const res = await fetch('/api/player/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { teamMode?: boolean };
    return Boolean(body.teamMode);
  } catch {
    return false;
  }
}
