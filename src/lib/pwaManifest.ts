import type { MetadataRoute } from 'next';
import { PLAY_DESCRIPTION, SITE_NAME } from '@/lib/siteMeta';

export function playManifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: PLAY_DESCRIPTION,
    start_url: '/play',
    scope: '/play',
    display: 'standalone',
    background_color: '#eef1f4',
    theme_color: '#e11d2e',
    icons: [
      { src: '/icon', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
