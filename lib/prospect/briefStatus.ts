/**
 * Statussen van een brief per prospect binnen een verzending, en de funnel.
 * Puur: zowel server als browser.
 *
 * Volgorde (rang) bepaalt wat "verder" is. Retour en geen interesse zijn
 * eindpunten naast de hoofdlijn: ze tellen in de funnel tot waar ze kwamen.
 */

export const ONTVANGER_STATUSSEN = [
  'klaargezet',
  'geprint',
  'verstuurd',
  'retour',
  'gescand',
  'gereageerd',
  'afspraak',
  'klant',
  'geen_interesse',
] as const;
export type OntvangerStatus = (typeof ONTVANGER_STATUSSEN)[number];

export const ONTVANGER_LABEL: Record<OntvangerStatus, string> = {
  klaargezet: 'Klaargezet',
  geprint: 'Geprint',
  verstuurd: 'Verstuurd',
  retour: 'Retour',
  gescand: 'Gescand',
  gereageerd: 'Gereageerd',
  afspraak: 'Afspraak',
  klant: 'Klant',
  geen_interesse: 'Geen interesse',
};

/** Badgeklasse per status (bestaande klassen uit globals.css plus een paar kleuren). */
export const ONTVANGER_BADGE: Record<OntvangerStatus, string> = {
  klaargezet: 'badge-rust',
  geprint: 'badge-rust',
  verstuurd: 'badge bg-ink-900 text-white',
  retour: 'badge bg-red-50 text-red-700',
  gescand: 'badge-actie',
  gereageerd: 'badge bg-amber-200 text-amber-900',
  afspraak: 'badge bg-amber-300 text-ink-900',
  klant: 'badge-klaar',
  geen_interesse: 'badge bg-ink-50 text-ink-400',
};

const RANG: Record<OntvangerStatus, number> = {
  klaargezet: 0,
  geprint: 1,
  verstuurd: 2,
  retour: 2,
  gescand: 3,
  gereageerd: 5,
  afspraak: 5,
  klant: 6,
  geen_interesse: 2,
};

export function isOntvangerStatus(s: unknown): s is OntvangerStatus {
  return typeof s === 'string' && (ONTVANGER_STATUSSEN as readonly string[]).includes(s);
}

export function ontvangerRang(s: string): number {
  return isOntvangerStatus(s) ? RANG[s] : 0;
}

/** Prospectstatus die bij een briefstatus hoort (alleen omhoog, nooit terug). */
const PROSPECT_RANG: Record<string, number> = { nieuw: 0, benaderd: 1, geinteresseerd: 2, reageerde: 3, gekwalificeerd: 4, klant: 5 };
export function prospectStatusNa(huidig: string, brief: OntvangerStatus): string | null {
  if (huidig === 'afgemeld') return null;
  const doel = brief === 'verstuurd' ? 'benaderd' : brief === 'gereageerd' ? 'reageerde' : brief === 'afspraak' ? 'gekwalificeerd' : brief === 'klant' ? 'klant' : null;
  if (!doel) return null;
  return (PROSPECT_RANG[doel] ?? 0) > (PROSPECT_RANG[huidig] ?? 0) ? doel : null;
}

/* ------------------------------------------------------------------ */
/* Funnel                                                              */
/* ------------------------------------------------------------------ */

export const FUNNEL_STAPPEN = [
  { sleutel: 'verstuurd', label: 'Verstuurd' },
  { sleutel: 'gescand', label: 'QR gescand' },
  { sleutel: 'portaal', label: 'Demo-portaal bekeken' },
  { sleutel: 'contact', label: 'Contact' },
  { sleutel: 'klant', label: 'Klant' },
] as const;
export type FunnelSleutel = (typeof FUNNEL_STAPPEN)[number]['sleutel'];

/** Wat we per ontvanger weten, uit de status, de prospect en de bezoeken. */
export type FunnelBewijs = {
  status: string;
  prospectStatus: string;
  qrScans: number;
  portaalBezoeken: number;
  aanvragen: number;
};

/**
 * Hoe ver een ontvanger kwam (0 = niet verstuurd, 1 = verstuurd ... 5 = klant).
 * Een stap verder telt ook voor de stappen ervoor: een klant die nooit scande
 * (maar wel belde) hoort niet uit de funnel te vallen.
 */
export function funnelNiveau(b: FunnelBewijs): number {
  const s = b.status;
  const p = b.prospectStatus;
  if (s === 'klant' || p === 'klant') return 5;
  if (s === 'gereageerd' || s === 'afspraak' || b.aanvragen > 0 || p === 'reageerde' || p === 'gekwalificeerd') return 4;
  if (b.portaalBezoeken > 0) return 3;
  if (s === 'gescand' || b.qrScans > 0) return 2;
  if (ontvangerRang(s) >= 2 && s !== 'retour') return 1;
  // Niet als verstuurd gemarkeerd, maar wel gescand: hij is dus wel aangekomen.
  return 0;
}

export type FunnelRij = { sleutel: FunnelSleutel; label: string; aantal: number; vanVorige: number | null; vanStart: number | null };

export function berekenFunnel(bewijzen: FunnelBewijs[]): FunnelRij[] {
  const niveaus = bewijzen.map(funnelNiveau);
  const aantallen = FUNNEL_STAPPEN.map((_, i) => niveaus.filter((n) => n >= i + 1).length);
  return FUNNEL_STAPPEN.map((s, i) => ({
    sleutel: s.sleutel,
    label: s.label,
    aantal: aantallen[i],
    vanVorige: i === 0 ? null : aantallen[i - 1] ? aantallen[i] / aantallen[i - 1] : null,
    vanStart: i === 0 ? null : aantallen[0] ? aantallen[i] / aantallen[0] : null,
  }));
}

export const procent = (v: number | null) => (v == null ? '-' : `${Math.round(v * 100)}%`);

/** Effectieve status: een opgeslagen 'verstuurd' met een scan erna is in feite 'gescand'. */
export function effectieveStatus(opgeslagen: string, qrScans: number): OntvangerStatus {
  const s = isOntvangerStatus(opgeslagen) ? opgeslagen : 'klaargezet';
  if (qrScans > 0 && ontvangerRang(s) < 3 && s !== 'geen_interesse') return 'gescand';
  return s;
}
