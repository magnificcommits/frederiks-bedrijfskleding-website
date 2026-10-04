/**
 * Eén plek voor GA4-events op de publieke site.
 *
 * Regel: er gaat pas iets naar Google als de bezoeker in de cookiebanner op
 * "Accepteren" klikte (localStorage 'fb-consent' = 'granted'). Consent Mode
 * zou een event bij 'denied' ook als cookieloze ping doorsturen; dat willen we
 * niet, dus we houden het hier al tegen.
 *
 * Gebruik vanuit een client component:
 *   import { track } from '@/lib/analytics';
 *   track('afspraak_geboekt', { branche: 'Bouw & infra' });
 *
 * Of zonder import, vanaf elke plek in de browser:
 *   window.dispatchEvent(new CustomEvent('fb:track', { detail: { event: 'afspraak_geboekt' } }));
 *
 * De eventnamen en parameters staan beschreven in docs/meetplan.md. Voeg een
 * nieuw event daar ook toe, anders weet niemand over een half jaar wat het is.
 */

export type FbEvent =
  | 'cta_klik'
  | 'telefoon_klik'
  | 'whatsapp_klik'
  | 'email_klik'
  | 'formulier_gestart'
  | 'generate_lead'
  | 'afspraak_klik'
  | 'afspraak_geboekt';

export type FbEventParams = Record<string, string | number | boolean | undefined>;

const CONSENT_KEY = 'fb-consent';

export function heeftConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function track(event: FbEvent, params: FbEventParams = {}): void {
  if (!heeftConsent()) return;
  const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (!g) return;
  const schoon: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') schoon[k] = v;
  schoon.page_path = window.location.pathname;
  g('event', event, schoon);
}
