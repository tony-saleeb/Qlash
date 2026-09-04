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

export function tooManyRequests(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please wait.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}
