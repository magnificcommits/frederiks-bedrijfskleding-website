import { kmsAdmin } from '@/lib/kms/adminClient';
import type { OfferteKlantAdres } from '@/components/dashboard/OfferteDocument';

/**
 * Postadres van een klant voor op de offerte ("Offerte voor").
 * Alleen server-side, achter dashAuthed(). Geeft null bij een fout of
 * zonder adres: de offerte toont dan alleen de klantnaam.
 */
export async function klantAdresVoorDocument(organisatieId: string | null | undefined): Promise<OfferteKlantAdres | null> {
  const sb = kmsAdmin();
  if (!sb || !organisatieId) return null;
  try {
    const { data, error } = await sb.from('organisaties').select('adres, postcode, plaats').eq('id', organisatieId).maybeSingle();
    if (error || !data) return null;
    const rij = data as { adres: string | null; postcode: string | null; plaats: string | null };
    const schoon = (v: string | null) => (v && v.trim() ? v.trim() : null);
    const adres = { adres: schoon(rij.adres), postcode: schoon(rij.postcode), plaats: schoon(rij.plaats) };
    return adres.adres || adres.postcode || adres.plaats ? adres : null;
  } catch {
    return null;
  }
}
