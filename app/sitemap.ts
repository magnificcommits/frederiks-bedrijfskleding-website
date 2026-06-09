import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { branches } from '@/content/branches';
import { plaatsen } from '@/content/plaatsen';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl.replace(/\/$/, '');
  const now = new Date();
  const staticRoutes = ['', '/werkkleding', '/werkschoenen', '/bedrukken-borduren', '/referenties', '/over-ons', '/contact', '/offerte', '/kledingadvies'];
  return [
    ...staticRoutes.map((r) => ({ url: `${base}${r}`, lastModified: now, changeFrequency: 'monthly' as const, priority: r === '' ? 1 : 0.8 })),
    ...branches.map((b) => ({ url: `${base}/branches/${b.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...plaatsen.map((p) => ({ url: `${base}/regio/${p.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
