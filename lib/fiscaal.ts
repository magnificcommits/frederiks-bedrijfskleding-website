/**
 * Fiscale rekenregels rond werkkleding, voor de logo-check en de onbelast-calculator.
 *
 * Twee regels uit de werkkostenregeling (WKR):
 * 1. Kleding die je als werkgever geeft is onbelast als er een of meer duidelijk
 *    zichtbare logo's op zitten van samen minimaal 70 cm² (of als het echte werk-
 *    kleding is, zoals een overall). Anders telt de waarde mee in de vrije ruimte.
 * 2. Boven de vrije ruimte betaalt de werkgever 80% eindheffing.
 *
 * De percentages van de vrije ruimte veranderen per jaar. Pas WKR aan bij een nieuw
 * jaar; alles op de site rekent hiermee. Bron 2026: 2,00% over de fiscale loonsom tot
 * en met € 400.000 en 1,18% daarboven.
 *
 * Dit is een indicatie, geen fiscaal advies. De teksten op de site zeggen dat ook.
 */

export const LOGO_MIN_CM2 = 70;

export const WKR = {
  jaar: 2026,
  grens: 400_000,
  pctTot: 0.02,
  pctBoven: 0.0118,
  eindheffing: 0.8,
} as const;

export const BRON_WERKKLEDING =
  'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/inkomstenbelasting/inkomstenbelasting_voor_ondernemers/zakelijke_kosten/kosten-voor-werkkleding';

/** Logo-afmetingen die we in de pakketsamensteller laten kiezen. */
export const logoFormaten = [
  { id: 'klein', label: 'Klein, 8 x 5 cm', b: 8, h: 5 },
  { id: 'standaard', label: 'Standaard, 10 x 7 cm', b: 10, h: 7 },
  { id: 'groot', label: 'Groot, 12 x 9 cm', b: 12, h: 9 },
  { id: 'rug', label: 'Rug, 30 x 20 cm', b: 30, h: 20 },
] as const;

export type LogoFormaatId = (typeof logoFormaten)[number]['id'];

export function oppervlakVan(formaat: string | undefined): number {
  const f = logoFormaten.find((x) => x.id === formaat) ?? logoFormaten[1];
  return f.b * f.h;
}

/** Een ruglogo is groot, de rest begint op het standaardformaat. */
export function standaardFormaatVoor(positie: string): LogoFormaatId {
  return positie === 'rug' ? 'rug' : 'standaard';
}

export function logoCheck(cm2: number): { onbelast: boolean; tekort: number } {
  const opp = Math.max(0, Math.round(cm2));
  return { onbelast: opp >= LOGO_MIN_CM2, tekort: Math.max(0, LOGO_MIN_CM2 - opp) };
}

/** Vrije ruimte van de werkkostenregeling bij een fiscale loonsom. */
export function vrijeRuimte(loonsom: number): number {
  const l = Math.max(0, loonsom);
  const tot = Math.min(l, WKR.grens) * WKR.pctTot;
  const boven = Math.max(0, l - WKR.grens) * WKR.pctBoven;
  return Math.round(tot + boven);
}

/**
 * Wat kleding zonder 70 cm²-logo kost aan vrije ruimte, en wat het kost als die ruimte
 * al op is (kerstpakket, personeelsfeest, fiets van de zaak).
 */
export function kledingImpact(opts: { medewerkers: number; budgetPp: number; jaarloon: number }) {
  const medewerkers = Math.max(0, Math.round(opts.medewerkers));
  const budgetPp = Math.max(0, opts.budgetPp);
  const loonsom = medewerkers * Math.max(0, opts.jaarloon);
  const ruimte = vrijeRuimte(loonsom);
  const kleding = Math.round(medewerkers * budgetPp);
  const aandeel = ruimte > 0 ? kleding / ruimte : 0;
  const overschrijding = Math.max(0, kleding - ruimte);
  return {
    loonsom,
    vrijeRuimte: ruimte,
    kleding,
    /** Deel van de vrije ruimte dat de kleding opsoupeert, 0..n (1 = helemaal vol). */
    aandeel,
    /** Eindheffing die nu al valt omdat de kleding alleen de ruimte overschrijdt. */
    heffingNu: Math.round(overschrijding * WKR.eindheffing),
    /** Eindheffing als de vrije ruimte al door andere dingen gebruikt wordt. */
    heffingAlsVol: Math.round(kleding * WKR.eindheffing),
  };
}

export const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
