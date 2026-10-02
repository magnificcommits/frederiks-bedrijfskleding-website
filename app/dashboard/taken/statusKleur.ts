/**
 * Kleurgroepen voor de status-pill in de takentabel, zoals in Jessi's Notion:
 * grijs = niet gestart, geel = bezig, oranje = (nog) bestellen of iets sturen,
 * blauw = factuur, groen = afgerond. Puur en zonder serverimports, zodat de
 * client-tabel dit ook kan gebruiken.
 */
export type StatusKleur = 'grijs' | 'geel' | 'oranje' | 'blauw' | 'groen';

const ORANJE = new Set([
  'Nog bestellen',
  'Passerie bestellen',
  "Logo's bestellen",
  'Offerte sturen',
  'Opsturen naar borduurder',
]);

export function statusKleur(werkstatus: string | null | undefined): StatusKleur {
  const w = String(werkstatus ?? '').trim();
  if (!w || w === 'Niet gestart') return 'grijs';
  if (w === 'Afgerond') return 'groen';
  if (w === 'Factuur sturen') return 'blauw';
  if (ORANJE.has(w)) return 'oranje';
  return 'geel';
}

/** Tailwind-klassen per kleurgroep: achtergrond + tekst, en de kleur van het bolletje. */
export const PILL_KLASSEN: Record<StatusKleur, { pill: string; dot: string }> = {
  grijs: { pill: 'bg-ink-100 text-ink-700', dot: 'bg-ink-400' },
  geel: { pill: 'bg-yellow-100 text-yellow-900', dot: 'bg-yellow-500' },
  oranje: { pill: 'bg-orange-100 text-orange-900', dot: 'bg-orange-500' },
  blauw: { pill: 'bg-sky-100 text-sky-900', dot: 'bg-sky-500' },
  groen: { pill: 'bg-green-100 text-green-900', dot: 'bg-green-600' },
};

export const KLEUR_LABELS: Record<StatusKleur, string> = {
  grijs: 'Niet gestart',
  geel: 'Bezig',
  oranje: 'Bestellen / sturen',
  blauw: 'Factuur',
  groen: 'Afgerond',
};
