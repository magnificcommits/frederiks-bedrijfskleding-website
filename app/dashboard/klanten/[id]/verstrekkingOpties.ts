import type { Periode, VerstrekkingType } from '@/lib/kms/assortiment';

/**
 * De keuzes voor verstrekking in gewone taal, gedeeld door de artikelkiezer en
 * het assortimentsoverzicht. Alleen types uit lib/kms/assortiment worden hier
 * geïmporteerd, geen functies: dat bestand praat met Supabase en hoort niet in
 * de browserbundel terecht te komen.
 */
export const VERSTREKKING_OPTIES: { waarde: VerstrekkingType; label: string }[] = [
  { waarde: 'budget', label: 'Van het budget' },
  { waarde: 'periodiek_gratis', label: 'Gratis, aantal per periode' },
  { waarde: 'altijd_gratis', label: 'Altijd gratis' },
  { waarde: 'punten', label: 'Punten' },
];

export const PERIODE_OPTIES: { waarde: Periode; label: string }[] = [
  { waarde: 'maand', label: 'per maand' },
  { waarde: 'kwartaal', label: 'per kwartaal' },
  { waarde: 'jaar', label: 'per jaar' },
];

export function verstrekkingLabel(type: VerstrekkingType): string {
  return VERSTREKKING_OPTIES.find((o) => o.waarde === type)?.label ?? 'Van het budget';
}

export function periodeLabel(periode: Periode): string {
  return PERIODE_OPTIES.find((o) => o.waarde === periode)?.label ?? 'per jaar';
}

/** Bedragen zoals Jessi ze op de bon ziet. */
export const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
