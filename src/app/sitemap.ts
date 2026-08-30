import type { MetadataRoute } from 'next';
import { metadataBaseUrl } from '@/lib/siteUrl';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = metadataBaseUrl().origin;
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/play`, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
