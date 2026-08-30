import type { MetadataRoute } from 'next';
import { playManifest } from '@/lib/pwaManifest';

export default function manifest(): MetadataRoute.Manifest {
  return playManifest();
}
