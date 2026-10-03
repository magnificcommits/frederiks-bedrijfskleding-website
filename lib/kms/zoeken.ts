import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Gedeelde hulpjes voor de zoekvelden op de lijstschermen van het dashboard.
 *
 * Elk woord uit de zoekterm moet ergens voorkomen (ilike `%woord%`), dus
 * "bakker doetinchem" vindt Bakkerij Jansen in Doetinchem, en "bak" vindt ook
 * Bakkerij. Tekens die een PostgREST-filter kunnen breken (% * , ( ) " ' \ :)
 * worden vooraf vervangen door een spatie.
 */
export function zoekWoorden(zoek: string | null | undefined, max = 6): string[] {
  return (zoek ?? '')
    .replace(/[%*,()"'\\:]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .slice(0, max);
}

/** Eén or-filter: dit woord komt voor in minstens één van deze kolommen. */
export function ilikeInKolommen(kolommen: readonly string[], woord: string): string {
  return kolommen.map((k) => `${k}.ilike.%${woord}%`).join(',');
}

/** Kolommen op `organisaties` waarop je een klant logischerwijs zoekt. */
export const KLANT_ZOEKKOLOMMEN = ['naam', 'plaats', 'klantnummer', 'contactpersoon'] as const;

/**
 * Ids van klanten waarbij elk woord voorkomt in naam, plaats, klantnummer of
 * contactpersoon. Bedoeld voor lijsten die via een join aan een klant hangen
 * (orders, offertes, facturen): PostgREST kan niet zonder meer op de join
 * filteren, dus eerst de ids. Begrensd, zodat de vervolgquery een korte URL houdt.
 */
export async function klantIdsVoorZoekterm(sb: SupabaseClient, woorden: string[], limiet = 200): Promise<string[]> {
  if (woorden.length === 0) return [];
  let q = sb.from('organisaties').select('id');
  for (const w of woorden) q = q.or(ilikeInKolommen(KLANT_ZOEKKOLOMMEN, w));
  const { data } = await q.limit(limiet);
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

/**
 * Per woord de ids van klanten met een contactpersoon (tabel `contactpersonen`)
 * waarvan naam of e-mail dat woord bevat. Ontbreekt de tabel, dan lege lijsten.
 */
export async function klantIdsViaContactpersonen(sb: SupabaseClient, woorden: string[], limiet = 100): Promise<string[][]> {
  return Promise.all(
    woorden.map(async (w) => {
      const { data, error } = await sb
        .from('contactpersonen')
        .select('organisatie_id')
        .or(ilikeInKolommen(['naam', 'email'], w))
        .limit(limiet);
      if (error) return [];
      const ids = ((data as { organisatie_id: string | null }[] | null) ?? [])
        .map((r) => r.organisatie_id)
        .filter((x): x is string => !!x);
      return [...new Set(ids)];
    }),
  );
}
