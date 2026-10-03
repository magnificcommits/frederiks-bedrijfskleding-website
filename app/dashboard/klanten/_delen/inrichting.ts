/**
 * Wat er bij een nieuwe klant ingericht moet zijn, met waar je dat doet.
 * Gedeeld door de wizard (stap Klaar) en de checklist op de klantkaart.
 */

export const WIZARD_STAPPEN = [
  { nr: 1, label: 'Bedrijf' },
  { nr: 2, label: 'Contactpersonen' },
  { nr: 3, label: 'Afdelingen' },
  { nr: 4, label: 'Werknemers' },
  { nr: 5, label: 'Assortiment' },
  { nr: 6, label: 'Klaar' },
] as const;

export const LAATSTE_STAP = WIZARD_STAPPEN.length;

export function wizardUrl(klantId: string, stap: number, extra?: Record<string, string>): string {
  const p = new URLSearchParams({ klant: klantId, stap: String(stap) });
  for (const [k, v] of Object.entries(extra ?? {})) if (v) p.set(k, v);
  return `/dashboard/klanten/nieuw?${p.toString()}`;
}

export type InrichtingTelling = {
  contactpersonen: number;
  /** Facturatiecontact gekozen, of een factuur-e-mailadres op de klant. */
  facturatiecontact: boolean;
  afdelingen: number;
  werknemers: number;
  assortiment: number;
  portaalgebruikers: number;
};

export type InrichtingPunt = {
  sleutel: string;
  label: string;
  klaar: boolean;
  /** Wat er moet gebeuren, in één zin. */
  uitleg: string;
  href: string;
  /** Telt niet mee voor 'alles klaar' (bijv. afdelingen: één groep mag ook). */
  optioneel?: boolean;
};

export function inrichtingPunten(orgId: string, t: InrichtingTelling): InrichtingPunt[] {
  const kaart = (tab: string, anker = '') => `/dashboard/klanten/${orgId}?tab=${tab}${anker}`;
  return [
    {
      sleutel: 'contact',
      label: 'Contactpersoon',
      klaar: t.contactpersonen > 0,
      uitleg: 'Met wie maak je afspraken?',
      href: kaart('contact'),
    },
    {
      sleutel: 'facturatie',
      label: 'Facturatiecontact',
      klaar: t.facturatiecontact,
      uitleg: 'Vink bij een contactpersoon Facturatie aan, of vul een factuur-e-mailadres in.',
      href: kaart('contact'),
    },
    {
      sleutel: 'afdelingen',
      label: 'Afdelingen',
      klaar: t.afdelingen > 0,
      uitleg: 'Alleen nodig als groepen andere kleding krijgen.',
      href: kaart('afdelingen'),
      optioneel: true,
    },
    {
      sleutel: 'werknemers',
      label: 'Werknemers',
      klaar: t.werknemers > 0,
      uitleg: 'Wie draagt de kleding?',
      href: kaart('werknemers'),
    },
    {
      sleutel: 'assortiment',
      label: 'Assortiment',
      klaar: t.assortiment > 0,
      uitleg: 'Welke artikelen mag de klant bestellen?',
      href: kaart('assortiment'),
    },
    {
      sleutel: 'portaal',
      label: 'Portaaltoegang',
      klaar: t.portaalgebruikers > 0,
      uitleg: 'Wie mag inloggen op het portaal?',
      href: kaart('contact', '#gebruikers'),
    },
  ];
}

/** De eerste wizardstap waar nog iets ontbreekt, voor de knop 'Stap voor stap verder'. */
export function eersteOpenStap(t: InrichtingTelling): number {
  if (t.contactpersonen === 0) return 2;
  if (t.werknemers === 0) return t.afdelingen === 0 ? 3 : 4;
  if (t.assortiment === 0) return 5;
  return LAATSTE_STAP;
}
