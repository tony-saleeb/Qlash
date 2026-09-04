import { NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/game/constants';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';

export async function limitPlayerHydrate(request: Request, bucket: string) {
  return rateLimit({
    key: `${bucket}:${clientIpFromRequest(request)}`,
    limit: RATE_LIMITS.playerHydratePerIp.limit,
    windowMs: RATE_LIMITS.playerHydratePerIp.windowMs,
  });
}

export async function limitPlayerHydrateByPlayer(playerId: string, bucket: string) {
  return rateLimit({
    key: `${bucket}:player:${playerId}`,
    limit: RATE_LIMITS.playerHydratePerPlayer.limit,
    windowMs: RATE_LIMITS.playerHydratePerPlayer.windowMs,
  });
}

export async function tooManyIfPlayerHydrateLimited(playerId: string, bucket: string) {
  const limited = await limitPlayerHydrateByPlayer(playerId, bucket);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSec);
  return null;
}

export function tooManyRequests(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please wait.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}
