import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { branches } from '@/content/branches';
import { plaatsen } from '@/content/plaatsen';
import { artikelen } from '@/content/kennisbank';
import { normen } from '@/content/normen';

/**
 * Sitemap zonder openbare catalogus, vakpagina's, formulieren en online agenda
 * (werkdocument Jessi, 20 okt 2026). Die adressen verwijzen door; zie next.config.mjs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl.replace(/\/$/, '');
  const now = new Date();
  const staticRoutes = ['', '/branches', '/werkkleding', '/werkschoenen', '/bedrukken-borduren', '/normen', '/referenties', '/over-ons', '/contact', '/kennisbank', '/kledingbeheer', '/kledingbeheer/demo', '/regio', '/klantenservice/retourneren', '/nieuwsbrief'];
  return [
    ...staticRoutes.map((r) => ({ url: `${base}${r}`, lastModified: now, changeFrequency: 'monthly' as const, priority: r === '' ? 1 : 0.8 })),
    ...branches.map((b) => ({ url: `${base}/branches/${b.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...plaatsen.map((p) => ({ url: `${base}/regio/${p.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...artikelen.map((a) => ({ url: `${base}/kennisbank/${a.slug}`, lastModified: new Date(a.date), changeFrequency: 'yearly' as const, priority: 0.6 })),
    ...normen.map((n) => ({ url: `${base}/normen/${n.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
}
