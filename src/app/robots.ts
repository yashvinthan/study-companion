import type { MetadataRoute } from 'next';

const appUrl = process.env.APP_BASE_URL?.replace(/\/+$/, '') || 'https://studytether.online';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: ['/app', '/api', '/welcome'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
