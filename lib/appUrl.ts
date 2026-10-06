import { site } from '@/content/site';

/**
 * Het adres waarop de app echt draait, voor links in mails (inloggen, portaal).
 * site.url is het canonieke domein voor SEO; zolang dat nog naar de oude site wijst,
 * zou een inloglink daarheen doodlopen. Volgorde: NEXT_PUBLIC_APP_URL, het productie-
 * adres dat Vercel zelf meegeeft (wordt vanzelf het eigen domein zodra dat gekoppeld is),
 * en pas daarna site.url.
 */
export function appUrl(): string {
  const eigen = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim();
  if (eigen) return eigen.replace(/\/$/, '');
  const prod = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '').trim();
  if (prod) return `https://${prod.replace(/\/$/, '')}`;
  return site.url.replace(/\/$/, '');
}
