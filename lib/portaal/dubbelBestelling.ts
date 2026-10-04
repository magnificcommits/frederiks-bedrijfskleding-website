/**
 * Dubbel bestellen in het portaal herkennen: zelfde gebruiker, zelfde regels,
 * binnen een minuut (dubbelklik, terugknop, twee tabbladen). Puur, zonder
 * database, zodat het los te testen is. De query staat in lib/portaal/webshop.ts.
 */

/** Binnen zoveel seconden telt een identieke bestelling als dubbel. */
export const DUBBEL_VENSTER_SECONDEN = 60;

export type RegelKern = { variant_id: string | null; product_id?: string | null; item_naam?: string | null; aantal: number };

/** Volgorde-onafhankelijke sleutel van een bestelling: artikel (variant, anders product of naam) en aantal. */
export function regelsSleutel(regels: RegelKern[]): string {
  const telling = new Map<string, number>();
  for (const r of regels) {
    const artikel = r.variant_id || r.product_id || String(r.item_naam ?? '').trim().toLowerCase();
    telling.set(artikel, (telling.get(artikel) ?? 0) + (Math.floor(Number(r.aantal)) || 0));
  }
  return [...telling.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([artikel, aantal]) => `${artikel}x${aantal}`)
    .join('|');
}

/** Staat er tussen de recente bestellingen een met precies dezelfde regels? */
export function isDubbeleBestelling(nieuw: RegelKern[], recent: RegelKern[][]): boolean {
  if (nieuw.length === 0) return false;
  const sleutel = regelsSleutel(nieuw);
  return recent.some((regels) => regels.length > 0 && regelsSleutel(regels) === sleutel);
}
