'use server';

import { dashAuthed } from '@/lib/kms/adminClient';
import { aanvragersVoorOrderFilter } from '@/lib/kms/personen';
import { zoekKlantOpties, zoekOfferteContactOpties } from '@/lib/kms/filterOpties';
import { isUuid, type FilterContext, type FilterOptie } from '@/lib/filterBalk';

/**
 * Server actions achter de typeaheadfilters van de FilterBalk. Elke actie
 * controleert zelf de login: een server action is een publiek eindpunt.
 * Andere lijstschermen kunnen deze acties hergebruiken als `zoek` in een
 * FilterDef van soort 'zoek'.
 */

/** Zoekbare klantkeuze. Zonder tekst de eerste 30 klanten op naam. */
export async function zoekKlantenVoorFilter(term: string, _context: FilterContext = {}): Promise<FilterOptie[]> {
  if (!(await dashAuthed())) return [];
  return zoekKlantOpties(String(term ?? '').slice(0, 80));
}

/**
 * "Aangevraagd door" op de orderlijst. Staat er een klantfilter (`klant`) in
 * de URL, dan meteen de aanvragers van die klant; anders vanaf 2 letters.
 */
export async function zoekAanvragersVoorFilter(term: string, context: FilterContext = {}): Promise<FilterOptie[]> {
  if (!(await dashAuthed())) return [];
  const klantId = isUuid(context?.klant) ? context.klant : null;
  return aanvragersVoorOrderFilter({ klantId, zoek: String(term ?? '').slice(0, 80) });
}

/** Contactpersoon op de offertelijst; met klantfilter alle contactpersonen van die klant. */
export async function zoekOfferteContactenVoorFilter(term: string, context: FilterContext = {}): Promise<FilterOptie[]> {
  if (!(await dashAuthed())) return [];
  return zoekOfferteContactOpties(String(term ?? '').slice(0, 80), context ?? {});
}
