import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // '/k/' met slash: zonder slash zou '/k' ook /kennisbank, /kledingadvies en /klantenservice blokkeren.
      // Portaal en de persoonlijke tokenpagina's (drukproef, retour) horen niet in Google.
      disallow: ['/api/', '/dashboard', '/kennismaking', '/k/', '/portaal', '/drukproef/', '/retour/'],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
