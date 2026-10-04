import { vulBriefIn } from '@/content/kennismaking';
import type { MockupArtikel } from './types';

/**
 * Pure hulpfuncties voor het renderen van een brief: velden invullen, tekst in
 * alinea's met vet, het adres in PostNL-notatie. Server en browser.
 */

/** Alles wat de A4-weergave van één prospect nodig heeft. */
export type BriefPersoon = {
  id: string;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  plaats: string | null;
  branche: string | null;
  adres: string | null;
  postcode: string | null;
  logoUrl: string | null;
  /** https://.../k/<token> */
  korteUrl: string;
  /** QR-code als data-url (svg). Leeg = placeholder. */
  qr: string;
  mockups: MockupArtikel[];
};

/** Voor de editor als er nog niemand in de verzending zit. */
export const VOORBEELD_PERSOON: BriefPersoon = {
  id: 'voorbeeld',
  bedrijfsnaam: 'Bouwbedrijf Voorbeeld',
  contactpersoon: 'Marco Jansen',
  plaats: 'Doetinchem',
  branche: 'Bouw',
  adres: 'Industrieweg 12',
  postcode: '7004 HB',
  logoUrl: null,
  korteUrl: 'https://www.frederiksbedrijfskleding.nl/k/0000000000',
  qr: '',
  mockups: [],
};

export function datumLang(d: Date = new Date()): string {
  return d.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Velden invullen; {{datum}} eerst, de rest (met de aanhef-uitzondering) via vulBriefIn. */
export function vulVelden(tekst: string, p: Pick<BriefPersoon, 'bedrijfsnaam' | 'contactpersoon' | 'plaats' | 'branche'>, datum: string): string {
  if (!tekst) return '';
  const metDatum = tekst.replace(/\{\{\s*datum\s*\}\}/gi, datum);
  return vulBriefIn(metDatum, { bedrijf: p.bedrijfsnaam, contactpersoon: p.contactpersoon, plaats: p.plaats, branche: p.branche });
}

/** PostNL-notatie: postcode met spatie, twee spaties, plaats in hoofdletters. */
export function postcodePlaats(postcode: string | null, plaats: string | null): string {
  const pc = (postcode ?? '').toUpperCase().replace(/\s+/g, '').replace(/^(\d{4})([A-Z]{2})$/, '$1 $2');
  return [pc, (plaats ?? '').toUpperCase()].filter(Boolean).join('  ');
}

export type TekstDeel = { tekst: string; vet: boolean };

/** Lege regel = nieuwe alinea, enkele regel = regelovergang, **zo** = vet. */
export function alineas(tekst: string): TekstDeel[][][] {
  return tekst
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((a) => a.replace(/^\n+|\n+$/g, ''))
    .filter((a) => a.trim())
    .map((a) =>
      a.split('\n').map((regel) =>
        regel
          .split(/(\*\*[^*]+\*\*)/g)
          .filter(Boolean)
          .map((stuk) => (/^\*\*[^*]+\*\*$/.test(stuk) ? { tekst: stuk.slice(2, -2), vet: true } : { tekst: stuk, vet: false })),
      ),
    );
}

export function heeftAdres(p: Pick<BriefPersoon, 'adres' | 'postcode'>): boolean {
  return Boolean(p.adres?.trim() && p.postcode?.trim());
}

/** Onbekende velden ({{voornaam}}) die niet worden ingevuld, om te waarschuwen. */
export function onbekendeVelden(tekst: string): string[] {
  const bekend = new Set(['bedrijf', 'contactpersoon', 'plaats', 'branche', 'datum']);
  const uit = new Set<string>();
  for (const m of tekst.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) if (!bekend.has(m[1].toLowerCase())) uit.add(m[0]);
  return [...uit];
}
