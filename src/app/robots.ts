import type { MetadataRoute } from 'next';
import { metadataBaseUrl } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = metadataBaseUrl().origin;
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/host/', '/api/', '/auth/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
