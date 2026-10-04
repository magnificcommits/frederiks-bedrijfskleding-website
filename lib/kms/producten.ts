import { kmsAdmin } from '@/lib/kms/adminClient';
import { zoekWoorden, ilikeInKolommen } from '@/lib/kms/zoeken';
import { haalAllesOp, laadVariantLijsten, tabelOntbreekt } from '@/lib/kms/varianten';
import { fotosVan } from '@/lib/kms/catalogus';
import { kleurZoektermen, vindKleur, type VariantLijsten } from '@/lib/kms/variantenStandaard';

/** Kolommen waarop je een product zoekt; elk woord moet in een ervan voorkomen. */
const PRODUCT_ZOEKKOLOMMEN = ['naam', 'sku', 'merk', 'categorie', 'art_nr_leverancier'] as const;

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
  for (const w of zoekWoorden(zoek)) q = q.or(ilikeInKolommen(PRODUCT_ZOEKKOLOMMEN, w));
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
  // Elk woord moet in naam, SKU, merk, categorie of leveranciersnummer voorkomen.
  for (const w of zoekWoorden(opts.zoek)) q = q.or(ilikeInKolommen(PRODUCT_ZOEKKOLOMMEN, w));
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

// ---------------------------------------------------------------------------
// Productenlijst met filters
// ---------------------------------------------------------------------------

export type ProductFilters = {
  zoek?: string;
  merk?: string;
  categorie?: string;
  leverancier?: string;
  status?: 'actief' | 'inactief';
  /** met: minstens één foto; zonder: geen enkele; afwijkend: de fotocontrole vond iets. */
  foto?: 'met' | 'zonder' | 'afwijkend';
  prijsMin?: number;
  prijsMax?: number;
  /** Standaardkleur; zoekt ook op de aliassen in de ruwe variantdata. */
  kleur?: string;
  maat?: string;
  opVoorraad?: boolean;
  /** Organisatie-id: alleen producten in het assortiment van deze klant. */
  klant?: string;
};

export type ProductLijstRij = ProductMetTelling & {
  voorraad_totaal: number | null;
  prijs_vanaf: number | null;
  aantal_fotos: number | null;
  foto_problemen: string[] | null;
};

export const PRODUCT_SORTEERBAAR = ['naam', 'merk', 'categorie', 'sku', 'prijs_vanaf', 'voorraad_totaal', 'aantal_varianten'] as const;

/** Tekens die een PostgREST or-filter breken, en lege of rare aliassen, eruit. */
const veiligeTerm = (t: string) => {
  const s = t.replace(/[%*,()"'\\:]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return s.length >= 2 && s.length <= 40 ? s : null;
};

/** Zoektermen voor een kleur: de naam en alle aliassen ("zwart" vindt ook "black"). */
function kleurTermen(woord: string, lijst: VariantLijsten): string[] {
  const k = vindKleur(woord, lijst);
  const termen = k ? kleurZoektermen(k.naam, lijst) : [woord.toLowerCase()];
  return [...new Set(termen.map(veiligeTerm).filter((t): t is string => !!t))].slice(0, 12);
}

/**
 * Eén pagina producten met alle filters, plus het totaal.
 *
 * Met de migratie loopt alles via de view `producten_overzicht` (één query,
 * filters op kleur, maat, voorraad, prijs, klant en fotoproblemen in de
 * database). Zonder die view valt het terug op ophalen en filteren in Node:
 * trager, maar dezelfde uitkomst, behalve het filter "foto's die afwijken".
 */
export async function listProductenGefilterd(opts: {
  pagina: number;
  perPagina: number;
  filters: ProductFilters;
  sort?: string;
  dir?: 'asc' | 'desc';
}): Promise<{ rijen: ProductLijstRij[]; totaal: number; bron: 'view' | 'terugval' }> {
  const sb = kmsAdmin();
  if (!sb) return { rijen: [], totaal: 0, bron: 'view' };
  const f = opts.filters;
  const lijst = await laadVariantLijsten();
  const pagina = Math.max(1, opts.pagina);
  const van = (pagina - 1) * opts.perPagina;
  const tot = van + opts.perPagina - 1;
  const kolom = (PRODUCT_SORTEERBAAR as readonly string[]).includes(opts.sort ?? '') ? (opts.sort as string) : 'naam';
  const oplopend = opts.dir !== 'desc';
  const woorden = zoekWoorden(f.zoek);

  // 1. Via de view.
  let q = sb
    .from('producten_overzicht')
    .select(
      'id, sku, ean, art_nr_leverancier, naam, omschrijving, merk, categorie, subcategorie, geslacht, normeringen, materiaal, btw, min_voorraad, wasinstructies, leverancier_id, afbeeldingen, actief, created_at, aantal_varianten, voorraad_totaal, prijs_vanaf, aantal_fotos, foto_problemen',
      { count: 'exact' },
    )
    .order(kolom, { ascending: oplopend, nullsFirst: false });
  if (kolom !== 'naam') q = q.order('naam');
  for (const w of woorden) {
    const kleurDelen = kleurTermen(w, lijst).map((t) => `variant_kleuren.ilike.%${t}%`);
    q = q.or([ilikeInKolommen(PRODUCT_ZOEKKOLOMMEN, w), ...kleurDelen].join(','));
  }
  if (f.merk) q = q.eq('merk', f.merk);
  if (f.categorie) q = q.eq('categorie', f.categorie);
  if (f.leverancier) q = q.eq('leverancier_id', f.leverancier);
  if (f.status) q = q.eq('actief', f.status === 'actief');
  if (f.foto === 'zonder') q = q.eq('aantal_fotos', 0);
  if (f.foto === 'met') q = q.gt('aantal_fotos', 0);
  if (f.foto === 'afwijkend') q = q.neq('foto_problemen', '{}');
  if (f.prijsMin != null) q = q.gte('prijs_vanaf', f.prijsMin);
  if (f.prijsMax != null) q = q.lte('prijs_vanaf', f.prijsMax);
  if (f.kleur) {
    const termen = kleurTermen(f.kleur, lijst);
    if (termen.length) q = q.or(termen.map((t) => `variant_kleuren.ilike.%${t}%`).join(','));
  }
  if (f.maat) q = q.contains('variant_maten', [f.maat]);
  if (f.opVoorraad) q = q.gt('voorraad_totaal', 0);
  if (f.klant) q = q.contains('assortiment_klanten', [f.klant]);

  const { data, count, error } = await q.range(van, tot);
  if (!error) return { rijen: (data as ProductLijstRij[] | null) ?? [], totaal: count ?? 0, bron: 'view' };
  if (!tabelOntbreekt(error)) return { rijen: [], totaal: 0, bron: 'view' };

  // 2. Terugval zonder view: alles ophalen (een paar honderd producten) en hier filteren.
  return terugvalLijst(f, woorden, lijst, kolom, oplopend, van, opts.perPagina);
}

async function terugvalLijst(
  f: ProductFilters,
  woorden: string[],
  lijst: VariantLijsten,
  kolom: string,
  oplopend: boolean,
  van: number,
  perPagina: number,
): Promise<{ rijen: ProductLijstRij[]; totaal: number; bron: 'terugval' }> {
  const sb = kmsAdmin();
  if (!sb) return { rijen: [], totaal: 0, bron: 'terugval' };
  let q = sb.from('producten').select('*, product_varianten(count)').order('naam').range(0, 4999);
  if (f.merk) q = q.eq('merk', f.merk);
  if (f.categorie) q = q.eq('categorie', f.categorie);
  if (f.leverancier) q = q.eq('leverancier_id', f.leverancier);
  if (f.status) q = q.eq('actief', f.status === 'actief');
  const { data } = await q;
  type Rij = Product & { verkoopprijs_basis?: number | null; product_varianten: { count: number }[] };
  let producten = (data as Rij[] | null) ?? [];

  // Variantgegevens alleen ophalen als een filter erom vraagt.
  const variantNodig = woorden.length > 0 || !!f.kleur || !!f.maat || !!f.opVoorraad || f.prijsMin != null || f.prijsMax != null || kolom === 'voorraad_totaal' || kolom === 'prijs_vanaf';
  const agg = new Map<string, { kleuren: string; maten: Set<string>; voorraad: number; prijs: number | null }>();
  if (variantNodig) {
    const varianten = await haalAllesOp<{ product_id: string; kleur: string | null; maat: string | null; voorraad: number | null; verkoopprijs: number | null }>(
      (a, b) => sb.from('product_varianten').select('product_id, kleur, maat, voorraad, verkoopprijs').order('id').range(a, b),
    );
    for (const v of varianten) {
      const a = agg.get(v.product_id) ?? { kleuren: '', maten: new Set<string>(), voorraad: 0, prijs: null };
      if (v.kleur) a.kleuren += ` | ${v.kleur.toLowerCase()}`;
      if (v.maat) a.maten.add(v.maat);
      a.voorraad += Math.max(0, Number(v.voorraad) || 0);
      const p = Number(v.verkoopprijs);
      if (p > 0 && (a.prijs == null || p < a.prijs)) a.prijs = p;
      agg.set(v.product_id, a);
    }
  }
  const klantIds = f.klant
    ? new Set(
        (((await sb.from('assortiment').select('product_id').eq('organisatie_id', f.klant).neq('toegestaan', false)).data as { product_id: string }[] | null) ?? []).map(
          (r) => r.product_id,
        ),
      )
    : null;

  const prijsVan = (p: Rij) => agg.get(p.id)?.prijs ?? (p.verkoopprijs_basis != null ? Number(p.verkoopprijs_basis) : null);
  const bevat = (waarde: unknown, w: string) => String(waarde ?? '').toLowerCase().includes(w.toLowerCase());

  producten = producten.filter((p) => {
    const a = agg.get(p.id);
    for (const w of woorden) {
      const inProduct = PRODUCT_ZOEKKOLOMMEN.some((k) => bevat(p[k as keyof Rij], w));
      const inKleur = !!a && kleurTermen(w, lijst).some((t) => a.kleuren.includes(t));
      if (!inProduct && !inKleur) return false;
    }
    if (f.foto) {
      const n = fotosVan(p.afbeeldingen).length;
      if (f.foto === 'zonder' && n > 0) return false;
      if (f.foto === 'met' && n === 0) return false;
      if (f.foto === 'afwijkend') return false;
    }
    if (f.kleur && !(a && kleurTermen(f.kleur, lijst).some((t) => a.kleuren.includes(t)))) return false;
    if (f.maat && !a?.maten.has(f.maat)) return false;
    if (f.opVoorraad && !((a?.voorraad ?? 0) > 0)) return false;
    const prijs = prijsVan(p);
    if (f.prijsMin != null && (prijs == null || prijs < f.prijsMin)) return false;
    if (f.prijsMax != null && (prijs == null || prijs > f.prijsMax)) return false;
    if (klantIds && !klantIds.has(p.id)) return false;
    return true;
  });

  const waardeVoor = (p: Rij): string | number | null => {
    if (kolom === 'voorraad_totaal') return agg.get(p.id)?.voorraad ?? 0;
    if (kolom === 'prijs_vanaf') return prijsVan(p);
    if (kolom === 'aantal_varianten') return p.product_varianten?.[0]?.count ?? 0;
    return (p[kolom as keyof Rij] as string | null) ?? null;
  };
  producten.sort((x, y) => {
    const a = waardeVoor(x);
    const b = waardeVoor(y);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    const r = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'nl');
    return oplopend ? r : -r;
  });

  const rijen = producten.slice(van, van + perPagina).map((r) => {
    const { product_varianten, ...rest } = r;
    return {
      ...rest,
      aantal_varianten: product_varianten?.[0]?.count ?? 0,
      voorraad_totaal: agg.get(r.id)?.voorraad ?? null,
      prijs_vanaf: prijsVan(r),
      aantal_fotos: fotosVan(r.afbeeldingen).length,
      foto_problemen: null,
    } as ProductLijstRij;
  });
  return { rijen, totaal: producten.length, bron: 'terugval' };
}

/** Unieke categorieën, alfabetisch. */
export async function listCategorieen(): Promise<string[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('producten').select('categorie').not('categorie', 'is', null).range(0, 4999);
  const set = new Set<string>();
  for (const r of (data as { categorie: string | null }[] | null) ?? []) if (r.categorie?.trim()) set.add(r.categorie.trim());
  return [...set].sort((a, b) => a.localeCompare(b, 'nl'));
}

/** Klanten die een eigen assortiment hebben, voor het filter "in assortiment bij". */
export async function listKlantenMetAssortiment(): Promise<{ id: string; naam: string }[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('assortiment').select('organisatie_id').not('organisatie_id', 'is', null).range(0, 9999);
  const ids = [...new Set(((data as { organisatie_id: string }[] | null) ?? []).map((r) => r.organisatie_id))];
  if (ids.length === 0) return [];
  const { data: orgs } = await sb.from('organisaties').select('id, naam').in('id', ids.slice(0, 200));
  return ((orgs as { id: string; naam: string | null }[] | null) ?? [])
    .map((o) => ({ id: o.id, naam: o.naam?.trim() || 'Naamloze klant' }))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
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
