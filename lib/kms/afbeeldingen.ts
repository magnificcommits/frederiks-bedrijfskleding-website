import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor afbeelding per kleur (een voorkant-afbeelding per productkleur).
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type KleurAfbeelding = {
  id: string;
  product_id: string;
  kleur: string;
  afbeelding_url: string;
};

/** De distinct, niet-lege kleuren van een product op basis van de varianten, gesorteerd. */
export async function getKleurenVanProduct(productId: string): Promise<string[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('product_varianten').select('kleur').eq('product_id', productId).not('kleur', 'is', null);
  const set = new Set<string>();
  for (const r of (data as { kleur: string | null }[]) ?? []) {
    const k = (r.kleur ?? '').trim();
    if (k) set.add(k);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
}

/** Map van kleur naar afbeelding_url voor een product. */
export async function listKleurAfbeeldingen(productId: string): Promise<Record<string, string>> {
  const sb = kmsAdmin(); if (!sb) return {};
  const { data } = await sb.from('product_kleur_afbeeldingen').select('kleur, afbeelding_url').eq('product_id', productId);
  const map: Record<string, string> = {};
  for (const r of (data as { kleur: string; afbeelding_url: string }[]) ?? []) {
    if (r.kleur && r.afbeelding_url) map[r.kleur] = r.afbeelding_url;
  }
  return map;
}

/** Zet (upsert) de afbeelding voor een kleur van een product op (product_id, kleur). */
export async function zetKleurAfbeelding(productId: string, kleur: string, url: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const k = kleur.trim();
  const u = url.trim();
  if (!k || !u) return false;
  const { error } = await sb
    .from('product_kleur_afbeeldingen')
    .upsert({ product_id: productId, kleur: k, afbeelding_url: u }, { onConflict: 'product_id,kleur' });
  return !error;
}

/** Verwijder de afbeelding voor een kleur van een product. */
export async function verwijderKleurAfbeelding(productId: string, kleur: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('product_kleur_afbeeldingen')
    .delete()
    .eq('product_id', productId)
    .eq('kleur', kleur.trim());
  return !error;
}
