import { ImageResponse } from 'next/og';
import { pwaIconMark } from '@/lib/pwaIconMark';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(pwaIconMark(), { width: 512, height: 512 });
}
