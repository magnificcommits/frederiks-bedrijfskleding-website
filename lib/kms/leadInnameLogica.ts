import type { LeadRegelInvoer } from '@/lib/leadHerkomst';

/**
 * Pure logica voor de weblead-inname (lib/kms/leadInname.ts): geen database,
 * geen server-only imports, dus los te testen.
 */

/** Een tweede aanvraag van hetzelfde adres binnen zoveel dagen komt bij de open lead. */
export const SAMENVOEG_DAGEN = 7;

/** Vanaf welk moment (ISO) een open lead nog als "dezelfde aanvraag" telt. */
export function samenvoegGrens(nu: Date = new Date(), dagen = SAMENVOEG_DAGEN): string {
  return new Date(nu.getTime() - dagen * 86_400_000).toISOString();
}

/** Tekens die in een ilike-patroon iets betekenen onschadelijk maken. */
export function ilikePatroon(v: string): string {
  return v.trim().replace(/[\\%_]/g, (t) => `\\${t}`);
}

/**
 * Product-id's komen uit de browser. Een id dat niet (meer) in `producten` staat
 * breekt de foreign key en daarmee de hele insert van lead_regels. Onbekende
 * id's gaan daarom op null; de omschrijving blijft staan.
 */
export function zonderOnbekendeProducten(regels: LeadRegelInvoer[], bekend: ReadonlySet<string>): LeadRegelInvoer[] {
  return regels.map((r) => (r.product_id && !bekend.has(r.product_id) ? { ...r, product_id: null } : r));
}

type RegelKern = Pick<LeadRegelInvoer, 'product_id' | 'omschrijving' | 'kleur' | 'maat' | 'aantal'>;

function regelSleutel(r: RegelKern): string {
  const t = (v: string | null | undefined) => String(v ?? '').trim().toLowerCase();
  return [r.product_id ?? '', t(r.omschrijving), t(r.kleur), t(r.maat), r.aantal ?? ''].join('|');
}

/**
 * Bij samenvoegen: alleen regels die nog niet bij de lead staan. Wie het formulier
 * twee keer verstuurt krijgt zo geen dubbele artikelen op de lead en de offerte.
 */
export function alleenNieuweRegels(bestaand: RegelKern[], nieuw: LeadRegelInvoer[]): LeadRegelInvoer[] {
  const gezien = new Set(bestaand.map(regelSleutel));
  const uit: LeadRegelInvoer[] = [];
  for (const r of nieuw) {
    const k = regelSleutel(r);
    if (gezien.has(k)) continue;
    gezien.add(k);
    uit.push(r);
  }
  return uit;
}

/**
 * Het bericht van een tweede aanvraag onder het eerste zetten. Hetzelfde bericht
 * nog een keer (dubbel verstuurd) verandert niets.
 */
export function voegBerichtSamen(oud: string | null | undefined, nieuw: string | null | undefined, datumLabel: string, max = 6000): string | null {
  const a = String(oud ?? '').trim();
  const b = String(nieuw ?? '').trim();
  if (!b) return a || null;
  if (!a) return b.slice(0, max);
  if (a.includes(b)) return a;
  return `${a}\n\nAanvulling van ${datumLabel}:\n${b}`.slice(0, max);
}
