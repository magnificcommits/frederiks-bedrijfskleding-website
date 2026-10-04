'use client';
import { useEffect } from 'react';
import { track, type FbEvent, type FbEventParams } from '@/lib/analytics';

/**
 * Luistert op documentniveau naar kliks en formulierfocus, zodat losse
 * componenten (ook die van andere teams) niets hoeven in te bouwen.
 *
 *  - tel:-links          -> telefoon_klik
 *  - wa.me-links         -> whatsapp_klik
 *  - mailto:-links       -> email_klik
 *  - links naar /afspraak -> afspraak_klik
 *  - elk element met data-cta="naam" -> cta_klik { cta: naam }
 *  - eerste focus in een <form> -> formulier_gestart (naam uit data-formulier;
 *    sla over met data-niet-meten)
 *  - CustomEvent 'fb:track' met detail { event, ...params } -> dat event
 *
 * Geeft niets weer en doet niets zonder toestemming (zie lib/analytics.ts).
 */
export function AnalyticsEvents() {
  useEffect(() => {
    const gestart = new WeakSet<HTMLFormElement>();

    const opKlik = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('a, button, [data-cta]');
      if (!el) return;
      const plek = el.closest('[data-plek]')?.getAttribute('data-plek') ?? undefined;
      const tekst = (el.textContent ?? '').trim().slice(0, 60);
      const cta = el.getAttribute('data-cta');
      if (cta) track('cta_klik', { cta, plek, tekst });

      const href = el instanceof HTMLAnchorElement ? el.getAttribute('href') ?? '' : '';
      if (href.startsWith('tel:')) track('telefoon_klik', { plek });
      else if (href.includes('wa.me/')) track('whatsapp_klik', { plek });
      else if (href.startsWith('mailto:')) track('email_klik', { plek });
      else if (href.startsWith('/afspraak')) track('afspraak_klik', { plek, tekst });
    };

    const opFocus = (e: FocusEvent) => {
      const form = (e.target as Element | null)?.closest?.('form');
      if (!form || gestart.has(form) || form.hasAttribute('data-niet-meten')) return;
      gestart.add(form);
      track('formulier_gestart', {
        formulier: form.getAttribute('data-formulier') ?? form.getAttribute('aria-label') ?? 'onbekend',
      });
    };

    const opEigen = (e: Event) => {
      const d = (e as CustomEvent<{ event?: FbEvent } & FbEventParams>).detail;
      if (!d?.event) return;
      const { event, ...rest } = d;
      track(event, rest as FbEventParams);
    };

    document.addEventListener('click', opKlik, { capture: true });
    document.addEventListener('focusin', opFocus);
    window.addEventListener('fb:track', opEigen);
    return () => {
      document.removeEventListener('click', opKlik, { capture: true });
      document.removeEventListener('focusin', opFocus);
      window.removeEventListener('fb:track', opEigen);
    };
  }, []);

  return null;
}
