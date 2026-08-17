import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Productbeheer.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type Product = {
  id: string;
  sku: string | null;
  ean: string | null;
  art_nr_leverancier: string | null;
  naam: string;
  omschrijving: string | null;
  merk: string | null;
  categorie: string | null;
  subcategorie: string | null;
  geslacht: string | null;
  normeringen: string | null;
  materiaal: string | null;
  btw: number;
  min_voorraad: number | null;
  wasinstructies: string | null;
  leverancier_id: string | null;
  afbeeldingen: string[] | null;
  actief: boolean;
  created_at: string;
};

export type Variant = {
  id: string;
  product_id: string;
  maat: string | null;
  kleur: string | null;
  ean: string | null;
  inkoopprijs: number | null;
  verkoopprijs: number | null;
  meerprijs: number;
  voorraad: number;
  actief: boolean;
  created_at: string;
};

export type Leverancier = {
  id: string;
  leveranciersnummer: string | null;
  naam: string;
  contactpersoon: string | null;
  telefoon: string | null;
  email: string | null;
  levertijd_dagen: number | null;
  betaalcondities: string | null;
  merken: string[] | null;
  created_at: string;
};

export type ProductVelden = Partial<Omit<Product, 'id' | 'created_at'>> & { naam: string };
export type VariantVelden = Partial<Omit<Variant, 'id' | 'product_id' | 'created_at'>>;
export type LeverancierVelden = Partial<Omit<Leverancier, 'id' | 'created_at'>> & { naam: string };

export type ProductMetTelling = Product & { aantal_varianten: number };

export async function listProducten(zoek?: string, merk?: string): Promise<ProductMetTelling[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb.from('producten').select('*, product_varianten(count)').order('naam');
  if (zoek && zoek.trim()) {
    const term = `%${zoek.trim()}%`;
    q = q.or(`naam.ilike.${term},sku.ilike.${term},merk.ilike.${term},categorie.ilike.${term}`);
  }
  if (merk && merk.trim()) q = q.eq('merk', merk.trim());
  const { data } = await q;
  const rows = (data as (Product & { product_varianten: { count: number }[] })[]) ?? [];
  return rows.map((r) => {
    const { product_varianten, ...rest } = r;
    return { ...rest, aantal_varianten: product_varianten?.[0]?.count ?? 0 } as ProductMetTelling;
  });
}

/** Eén pagina producten (standaard gesorteerd op naam oplopend) met dezelfde zoek/merk-filters, plus het totaal aantal rijen voor paginering. Met optionele sort/dir voor sorteerbare kolomkoppen. */
export async function listProductenPaged(opts: { pagina: number; perPagina: number; zoek?: string; merk?: string; zonderFoto?: boolean; sort?: string; dir?: 'asc' | 'desc' }): Promise<{ rijen: ProductMetTelling[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  // Alleen echte DB-kolommen die we ook selecteren mogen gesorteerd worden; anders valt het terug op naam.
  const sorteerbaar = ['naam', 'merk', 'categorie', 'sku'];
  const kolom = opts.sort && sorteerbaar.includes(opts.sort) ? opts.sort : 'naam';
  const oplopend = opts.dir === 'asc' ? true : opts.dir === 'desc' ? false : true;
  let q = sb.from('producten').select('*, product_varianten(count)', { count: 'exact' }).order(kolom, { ascending: oplopend });
  if (opts.zoek && opts.zoek.trim()) {
    const term = `%${opts.zoek.trim()}%`;
    q = q.or(`naam.ilike.${term},sku.ilike.${term},merk.ilike.${term},categorie.ilike.${term}`);
  }
  if (opts.merk && opts.merk.trim()) q = q.eq('merk', opts.merk.trim());
  // Producten zonder foto: een lege array telt in Postgres niet als NULL,
  // dus beide gevallen apart afvangen.
  if (opts.zonderFoto) q = q.or('afbeeldingen.is.null,afbeeldingen.eq.{}');
  const { data, count } = await q.range(from, to);
  const rows = (data as (Product & { product_varianten: { count: number }[] })[]) ?? [];
  const rijen = rows.map((r) => {
    const { product_varianten, ...rest } = r;
    return { ...rest, aantal_varianten: product_varianten?.[0]?.count ?? 0 } as ProductMetTelling;
  });
  return { rijen, totaal: count ?? 0 };
}

export async function listMerken(): Promise<string[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('producten').select('merk').not('merk', 'is', null);
  const set = new Set<string>();
  for (const r of (data as { merk: string | null }[]) ?? []) if (r.merk) set.add(r.merk);
  return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
}

/**
 * Eén artikel zoals de artikelkiezer het toont. Bewust plat en klein gehouden:
 * deze lijst gaat in zijn geheel naar de browser, dus elk extra veld telt 549 keer mee.
 */
export type ArtikelKeuze = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  sku: string | null;
  art_nr_leverancier: string | null;
  afbeelding: string | null;
  /** Laagste variantprijs, anders de basisprijs. Null als er geen prijs bekend is. */
  vanafprijs: number | null;
  kleuren: string[];
};

/**
 * De hele actieve catalogus in één keer, met foto, kleuren en vanafprijs.
 *
 * Bewust alles in één keer en geen query per toetsaanslag: bij 549 artikelen is
 * dit ongeveer 120 kB die je één keer ophaalt, waarna filteren in de browser
 * binnen een paar milliseconden klaar is. Een server-actie per toets kost elke
 * keer opnieuw een netwerkrondje, moet je gaan uitstellen (debounce) en laat de
 * lijst achter je typen aan hobbelen. De kleuren gaan om dezelfde reden mee:
 * Jessi kiest in dezelfde handeling de kleur, en een tweede rondje naar de
 * server zou juist op dat moment een wachtmoment inbouwen.
 *
 * Alleen aanroepen wanneer de kiezer echt opengaat, niet bij elke paginalading.
 */
export async function listArtikelKeuze(): Promise<ArtikelKeuze[]> {
  const sb = kmsAdmin();
  if (!sb) return [];

  type ArtikelRij = {
    id: string;
    naam: string | null;
    merk: string | null;
    categorie: string | null;
    sku: string | null;
    art_nr_leverancier: string | null;
    afbeeldingen: string[] | null;
    verkoopprijs_basis: number | null;
  };
  type VariantRij = {
    product_id: string;
    kleur: string | null;
    verkoopprijs: number | null;
    actief: boolean | null;
  };

  const [{ data: artikelData }, { data: variantData }] = await Promise.all([
    sb
      .from('producten')
      .select('id, naam, merk, categorie, sku, art_nr_leverancier, afbeeldingen, verkoopprijs_basis')
      .eq('actief', true)
      .order('naam')
      .limit(5000),
    // Alle varianten in één keer: filteren op de productlijst zou 549 uuid's in
    // de query-URL zetten, en dat loopt PostgREST vast.
    sb.from('product_varianten').select('product_id, kleur, verkoopprijs, actief').limit(50000),
  ]);

  const kleurenVan = new Map<string, string[]>();
  const laagstePrijs = new Map<string, number>();
  for (const v of (variantData as VariantRij[]) ?? []) {
    // Alleen een expliciete false verbergt een variant; bij oudere rijen staat
    // hier null en die horen er gewoon bij.
    if (v.actief === false) continue;
    const kleur = (v.kleur ?? '').trim();
    if (kleur) {
      const lijst = kleurenVan.get(v.product_id);
      if (!lijst) kleurenVan.set(v.product_id, [kleur]);
      else if (!lijst.includes(kleur)) lijst.push(kleur);
    }
    const prijs = v.verkoopprijs == null ? null : Number(v.verkoopprijs);
    if (prijs != null && Number.isFinite(prijs) && prijs > 0) {
      const huidig = laagstePrijs.get(v.product_id);
      if (huidig == null || prijs < huidig) laagstePrijs.set(v.product_id, prijs);
    }
  }

  return ((artikelData as ArtikelRij[]) ?? []).map((p) => {
    const basis = p.verkoopprijs_basis == null ? null : Number(p.verkoopprijs_basis);
    const terugval = basis != null && Number.isFinite(basis) && basis > 0 ? basis : null;
    return {
      id: p.id,
      naam: p.naam?.trim() || 'Naamloos',
      merk: p.merk,
      categorie: p.categorie,
      sku: p.sku,
      art_nr_leverancier: p.art_nr_leverancier,
      afbeelding: (p.afbeeldingen ?? [])[0] ?? null,
      vanafprijs: laagstePrijs.get(p.id) ?? terugval,
      kleuren: (kleurenVan.get(p.id) ?? []).sort((a, b) => a.localeCompare(b, 'nl')),
    };
  });
}

export async function getProduct(id: string): Promise<Product | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('producten').select('*').eq('id', id).maybeSingle();
  return (data as Product) ?? null;
}

export async function maakProduct(v: ProductVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data, error } = await sb.from('producten').insert(v).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function werkProduct(id: string, v: Partial<ProductVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('producten').update(v).eq('id', id);
  return !error;
}

export async function zetProductActief(id: string, actief: boolean): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('producten').update({ actief }).eq('id', id);
  return !error;
}

export async function listVarianten(productId: string): Promise<Variant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('product_varianten').select('*').eq('product_id', productId).order('created_at');
  return (data as Variant[]) ?? [];
}

export async function maakVariant(productId: string, v: VariantVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('product_varianten').insert({ product_id: productId, ...v });
  return !error;
}

export async function werkVariant(id: string, v: VariantVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('product_varianten').update(v).eq('id', id);
  return !error;
}

export async function verwijderVariant(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('product_varianten').delete().eq('id', id);
  return !error;
}

export async function listLeveranciers(): Promise<Leverancier[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('leveranciers').select('*').order('naam');
  return (data as Leverancier[]) ?? [];
}

export async function maakLeverancier(v: LeverancierVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data, error } = await sb.from('leveranciers').insert(v).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function werkLeverancier(id: string, v: Partial<LeverancierVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('leveranciers').update(v).eq('id', id);
  return !error;
}
