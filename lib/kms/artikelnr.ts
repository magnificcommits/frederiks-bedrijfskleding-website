import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Artikelnummer van de leverancier per artikel (producten.art_nr_leverancier).
 * Jessi werkt bij het inkopen met die nummers (27 okt), dus ze staan op de
 * orderregels, in de zoekers en op offerte, order en factuur.
 */
export async function artikelnrPerProduct(sb: SupabaseClient, productIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(productIds.filter((p): p is string => !!p))];
  const uit = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('producten').select('id, art_nr_leverancier').in('id', ids.slice(i, i + 200));
    for (const p of (data as { id: string; art_nr_leverancier: string | null }[]) ?? []) {
      const nr = p.art_nr_leverancier?.trim();
      if (nr) uit.set(p.id, nr);
    }
  }
  return uit;
}
