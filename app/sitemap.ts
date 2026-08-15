import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { branches } from '@/content/branches';
import { plaatsen } from '@/content/plaatsen';
import { artikelen } from '@/content/kennisbank';
import { catalogusOverzicht, alleProductPaden } from '@/lib/kms/catalogus';
import { normen } from '@/content/normen';
import { vakgebieden } from '@/content/vakgebieden';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, '');
  const now = new Date();
  const { categorieen, merken } = await catalogusOverzicht();
  const producten = await alleProductPaden();
  const staticRoutes = ['', '/assortiment', '/merk', '/normen', '/voor', '/werkkleding', '/werkschoenen', '/bedrukken-borduren', '/referenties', '/over-ons', '/contact', '/offerte', '/kledingadvies', '/kennisbank', '/pakket-samenstellen', '/kledingbeheer', '/regio', '/klantenservice', '/klantenservice/retourneren'];
  return [
    ...staticRoutes.map((r) => ({ url: `${base}${r}`, lastModified: now, changeFrequency: 'monthly' as const, priority: r === '' ? 1 : 0.8 })),
    ...branches.map((b) => ({ url: `${base}/branches/${b.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...plaatsen.map((p) => ({ url: `${base}/regio/${p.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...artikelen.map((a) => ({ url: `${base}/kennisbank/${a.slug}`, lastModified: new Date(a.date), changeFrequency: 'yearly' as const, priority: 0.6 })),
    // Assortiment: alleen artikelen met foto én omschrijving staan hierin,
    // want alleen die zijn ook echt publiceerbaar (zie lib/kms/catalogus.ts).
    ...categorieen.map((c) => ({ url: `${base}/assortiment/${c.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...merken.map((m) => ({ url: `${base}/merk/${m.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...producten.map((p) => ({ url: `${base}/assortiment/${p.categorie}/${p.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 })),
    // Normen en vakgebieden: onbevochten zoektermen met hoge koopintentie,
    // dus een hogere prioriteit dan de losse productpagina's.
    ...normen.map((n) => ({ url: `${base}/normen/${n.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 })),
    ...vakgebieden.map((v) => ({ url: `${base}/voor/${v.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 })),
  ];
}
