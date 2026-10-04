import { cache } from 'react';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';

/**
 * Gedeelde data-laag voor Analyse en Rapportages.
 *
 * - Alles via kmsAdmin() (service role): alleen server-side, achter dashAuthed().
 * - Nooit meer dan 1000 rijen per verzoek: grotere sets worden gepagineerd.
 * - Alleen de kolommen die nodig zijn.
 * - Lijsten met id's gaan in stukken van 150 (een URL met 1000 uuid's is te lang).
 * - De basissets (facturen, orders, klanten) zijn per request gecachet met
 *   React cache(), zodat tabbladen en de AI-samenvatting ze delen.
 *
 * Definities, gelijk aan de startpagina (lib/kms/dashboardStats.ts):
 * - Omzet = gefactureerd excl. btw op factuurdatum, alles behalve concept.
 * - Een order telt op besteldatum (anders aanmaakdatum), in Nederlandse tijd.
 * - Orderwaarde telt zonder concepten.
 * - Offertewaarde = som van regels: aantal × stukprijs × (1 − korting).
 */

export type PgFout = { code?: string; message?: string } | null | undefined;

/** Tabel, kolom of functie bestaat (nog) niet: migratie niet gedraaid. */
export function ontbreekt(fout: PgFout): boolean {
  if (!fout) return false;
  if (kolomOntbreekt(fout)) return true;
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(fout.code ?? '');
}

export const num = (v: unknown) => Number(v) || 0;

/** 'yyyy-mm-dd' in Nederlandse tijd voor een timestamp of datum. */
export function nlDatum(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

type Antwoord = { data: unknown; error: PgFout };

/** Haalt een query op in pagina's van 1000 rijen, tot `max`. */
export async function pagineer<T>(
  maak: (van: number, tot: number) => PromiseLike<Antwoord>,
  max = 20_000,
): Promise<{ rijen: T[]; fout: PgFout }> {
  const rijen: T[] = [];
  for (let van = 0; van < max; van += 1000) {
    const { data, error } = await maak(van, van + 999);
    if (error) return { rijen, fout: error };
    const deel = (data as T[]) ?? [];
    rijen.push(...deel);
    if (deel.length < 1000) break;
  }
  return { rijen, fout: null };
}

/** Voert een query uit per stuk id's (parallel) en voegt de resultaten samen. */
export async function inStukken<T>(
  ids: string[],
  maak: (stuk: string[]) => PromiseLike<Antwoord>,
  grootte = 150,
): Promise<T[]> {
  const uniek = Array.from(new Set(ids.filter(Boolean)));
  if (!uniek.length) return [];
  const stukken: string[][] = [];
  for (let i = 0; i < uniek.length; i += grootte) stukken.push(uniek.slice(i, i + grootte));
  const res = await Promise.all(stukken.map((s) => maak(s)));
  return res.flatMap((r) => (r.error ? [] : ((r.data as T[]) ?? [])));
}

/* ------------------------------------------------------------------ */
/* Basissets                                                           */
/* ------------------------------------------------------------------ */

export type Factuur = {
  id: string;
  factuurnummer: string | null;
  organisatie_id: string | null;
  order_id: string | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  bedrag_excl: number | null;
  btw_bedrag: number | null;
  bedrag_incl: number | null;
  status: string;
  betaaldatum: string | null;
};

/** Alle facturen behalve concepten (omzetdefinitie), oudste eerst. */
export const laadFacturen = cache(async (): Promise<Factuur[]> => {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { rijen } = await pagineer<Factuur>((a, b) =>
    sb.from('facturen')
      .select('id, factuurnummer, organisatie_id, order_id, factuurdatum, vervaldatum, bedrag_excl, btw_bedrag, bedrag_incl, status, betaaldatum')
      .neq('status', 'concept')
      .order('factuurdatum', { ascending: true })
      .order('id', { ascending: true })
      .range(a, b),
  );
  return rijen;
});

export type Order = {
  id: string;
  ordernummer: number | null;
  organisatie_id: string | null;
  medewerker_id: string | null;
  vestiging_id: string | null;
  afdeling_id: string | null;
  status: string;
  bedrag: number | null;
  besteldatum: string | null;
  created_at: string;
  /** Afgeleid: NL-datum van besteldatum, anders aanmaakdatum. */
  datum: string | null;
};

export const laadOrders = cache(async (): Promise<Order[]> => {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { rijen } = await pagineer<Omit<Order, 'datum'>>((a, b) =>
    sb.from('orders')
      .select('id, ordernummer, organisatie_id, medewerker_id, vestiging_id, afdeling_id, status, bedrag, besteldatum, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(a, b),
  );
  return rijen.map((o) => ({ ...o, datum: nlDatum(o.besteldatum ?? o.created_at) }));
});

/** Statussen die niet als verkocht tellen (stuks, producten). Gelijk aan analytics.ts. */
export const NIET_VERKOCHT = new Set(['concept', 'geannuleerd', 'offerte_verstuurd']);

export type Klant = { id: string; naam: string; branche: string | null; plaats: string | null; actief: boolean | null; created_at: string | null };

export const laadKlanten = cache(async (): Promise<Map<string, Klant>> => {
  const sb = kmsAdmin();
  const kaart = new Map<string, Klant>();
  if (!sb) return kaart;
  const { rijen } = await pagineer<Klant>((a, b) =>
    sb.from('organisaties').select('id, naam, branche, plaats, actief, created_at').order('naam').order('id').range(a, b),
  );
  for (const k of rijen) kaart.set(k.id, k);
  return kaart;
});

export type Medewerker = {
  id: string;
  naam: string;
  organisatie_id: string | null;
  vestiging_id: string | null;
  afdeling_id: string | null;
  budget: number | null;
  actief: boolean | null;
};

export const laadMedewerkers = cache(async (): Promise<Medewerker[]> => {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { rijen } = await pagineer<Medewerker>((a, b) =>
    sb.from('medewerkers').select('id, naam, organisatie_id, vestiging_id, afdeling_id, budget, actief').order('naam').order('id').range(a, b),
  );
  return rijen;
});

/* ------------------------------------------------------------------ */
/* Orderregels met merk, categorie en inkoopprijs                       */
/* ------------------------------------------------------------------ */

export type Regel = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  item_naam: string | null;
  maat: string | null;
  kleur: string | null;
  aantal: number | null;
  stukprijs: number | null;
};

export type VerrijkteRegel = Regel & {
  /** Product via product_id, anders via de variant. */
  productId: string | null;
  productNaam: string;
  merk: string;
  categorie: string;
  /** Inkoopprijs per stuk als die bekend is: variant, anders dezelfde maat/kleur, anders mediaan van het product. */
  inkoop: number | null;
  vrij: boolean;
  stuks: number;
  omzet: number;
};

export const VRIJE_REGEL = 'Vrije regel';

export async function laadRegels(orderIds: string[]): Promise<Regel[]> {
  const sb = kmsAdmin();
  if (!sb || !orderIds.length) return [];
  return inStukken<Regel>(orderIds, (stuk) =>
    sb.from('orderregels')
      .select('id, order_id, product_id, variant_id, item_naam, maat, kleur, aantal, stukprijs')
      .in('order_id', stuk)
      .limit(1000),
  );
}

const sleutel = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

function mediaan(waarden: number[]): number | null {
  const w = waarden.filter((v) => v > 0).sort((a, b) => a - b);
  if (!w.length) return null;
  const m = Math.floor(w.length / 2);
  return w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2;
}

/**
 * Vult merk, categorie en inkoopprijs aan. Een orderregel zonder product_id
 * krijgt het product van zijn variant; zonder beide is het een vrije regel
 * (handmatig getypt), en dat staat er dan ook zo.
 */
export async function verrijkRegels(regels: Regel[]): Promise<VerrijkteRegel[]> {
  const sb = kmsAdmin();
  if (!sb || !regels.length) return [];

  type V = { id: string; product_id: string | null; maat: string | null; kleur: string | null; inkoopprijs: number | null };
  type P = { id: string; naam: string | null; merk: string | null; categorie: string | null };

  const varianten = await inStukken<V>(
    regels.map((r) => r.variant_id ?? ''),
    (stuk) => sb.from('product_varianten').select('id, product_id, maat, kleur, inkoopprijs').in('id', stuk).limit(1000),
  );
  const variantPer = new Map(varianten.map((v) => [v.id, v]));
  const productVan = (r: Regel) => r.product_id ?? (r.variant_id ? variantPer.get(r.variant_id)?.product_id ?? null : null);

  const productIds = Array.from(new Set(regels.map(productVan).filter((p): p is string => !!p)));
  // Regels met een product maar zonder variant: inkoopprijs uit de varianten van dat product.
  const zonderVariant = Array.from(new Set(
    regels.filter((r) => !r.variant_id || !variantPer.has(r.variant_id)).map(productVan).filter((p): p is string => !!p),
  ));

  const [producten, productVarianten] = await Promise.all([
    inStukken<P>(productIds, (stuk) => sb.from('producten').select('id, naam, merk, categorie').in('id', stuk).limit(1000)),
    // Een product heeft tientallen varianten: kleine stukken en per stuk gepagineerd.
    Promise.all(
      Array.from({ length: Math.ceil(zonderVariant.length / 20) }, (_, i) => zonderVariant.slice(i * 20, i * 20 + 20)).map((stuk) =>
        pagineer<V>((a, b) =>
          sb.from('product_varianten').select('id, product_id, maat, kleur, inkoopprijs').in('product_id', stuk).order('id').range(a, b),
        5000).then((r) => r.rijen),
      ),
    ).then((d) => d.flat()),
  ]);
  const productPer = new Map(producten.map((p) => [p.id, p]));
  const variantenPerProduct = new Map<string, V[]>();
  for (const v of productVarianten) {
    if (!v.product_id) continue;
    const l = variantenPerProduct.get(v.product_id) ?? [];
    l.push(v);
    variantenPerProduct.set(v.product_id, l);
  }

  return regels.map((r) => {
    const pid = productVan(r);
    const p = pid ? productPer.get(pid) : undefined;
    const variant = r.variant_id ? variantPer.get(r.variant_id) : undefined;
    let inkoop: number | null = variant && num(variant.inkoopprijs) > 0 ? num(variant.inkoopprijs) : null;
    if (inkoop === null && pid) {
      const lijst = variantenPerProduct.get(pid) ?? [];
      const zelfde = lijst.find((v) => sleutel(v.maat) === sleutel(r.maat) && sleutel(v.kleur) === sleutel(r.kleur) && num(v.inkoopprijs) > 0);
      inkoop = zelfde ? num(zelfde.inkoopprijs) : mediaan(lijst.map((v) => num(v.inkoopprijs)));
    }
    const stuks = num(r.aantal);
    const vrij = !p;
    return {
      ...r,
      productId: p?.id ?? null,
      productNaam: p?.naam?.trim() || r.item_naam?.trim() || 'Zonder omschrijving',
      merk: vrij ? VRIJE_REGEL : p?.merk?.trim() || 'Merk niet ingevuld',
      categorie: vrij ? VRIJE_REGEL : p?.categorie?.trim() || 'Geen categorie',
      inkoop,
      vrij,
      stuks,
      omzet: stuks * num(r.stukprijs),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Maten sorteren                                                      */
/* ------------------------------------------------------------------ */

const MAAT_VOLGORDE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'];
const MAAT_ALIAS: Record<string, string> = { '2XL': 'XXL', XXXL: '3XL', XXXXL: '4XL', '2XS': 'XXS' };

/** 'xl ', 'XL' en 'Xl' zijn dezelfde maat; '2XL' heet hier XXL. */
export function normMaat(m: string | null | undefined): string {
  const s = (m ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return 'Geen maat';
  return MAAT_ALIAS[s] ?? s;
}

export function vergelijkMaat(a: string, b: string): number {
  const ia = MAAT_VOLGORDE.indexOf(a);
  const ib = MAAT_VOLGORDE.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  const na = parseFloat(a.replace(',', '.'));
  const nb = parseFloat(b.replace(',', '.'));
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (a === 'Geen maat') return 1;
  if (b === 'Geen maat') return -1;
  return a.localeCompare(b, 'nl');
}

/* ------------------------------------------------------------------ */
/* Statushistorie (migratie 20261004_analyse_rapportages)               */
/* ------------------------------------------------------------------ */

export type StatusEvent = { entiteit: string; entiteit_id: string; van_status: string | null; naar_status: string; moment: string };

/**
 * Statuswijzigingen van orders en offertes vanaf `vanaf`. Null als de tabel
 * nog niet bestaat: dan tonen de doorlooptijden een uitleg in plaats van nullen.
 */
export const laadStatusHistorie = cache(async (vanaf: string): Promise<StatusEvent[] | null> => {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { rijen, fout } = await pagineer<StatusEvent>((a, b) =>
    sb.from('status_historie')
      .select('entiteit, entiteit_id, van_status, naar_status, moment')
      .in('entiteit', ['order', 'offerte'])
      .gte('moment', vanaf)
      .order('moment', { ascending: true })
      .order('id', { ascending: true })
      .range(a, b),
  );
  if (fout) return ontbreekt(fout) ? null : [];
  return rijen;
});

/* ------------------------------------------------------------------ */
/* Kleine statistiekjes                                                 */
/* ------------------------------------------------------------------ */

export type Duur = { mediaan: number; gemiddeld: number; n: number };

export function duurStat(dagen: number[]): Duur | null {
  const w = dagen.filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b);
  if (!w.length) return null;
  const m = Math.floor(w.length / 2);
  return {
    mediaan: w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2,
    gemiddeld: w.reduce((t, d) => t + d, 0) / w.length,
    n: w.length,
  };
}

export function dagenTussenMomenten(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}
