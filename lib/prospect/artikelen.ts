import type { SupabaseClient } from '@supabase/supabase-js';
import type { MockupArtikel } from '@/lib/prospect/types';
import { fotosVan, publiekeProductUrl } from '@/lib/kms/catalogus';
import {
  ARTIKELEN_PER_BRANCHE,
  brancheGroep,
  kleurRang,
  logoPositieVoor,
  type ArtikelPlek,
} from '@/content/kennismaking';

/**
 * Artikelkeuze voor de kennismakingsbrief en -pagina.
 *
 * Werkt in drie stappen, zodat de brievengenerator voor honderd prospects niet
 * honderd keer de catalogus hoeft te laden:
 *  1. laadPool(): actieve artikelen + kleurfoto's, één keer per request;
 *  2. kiesVoorBranche() / schoneKeuzes(): welk artikel in welke kleur (puur);
 *  3. bouwMockups(): prijzen erbij en omzetten naar MockupArtikel.
 *
 * Alleen server-side gebruiken (service-role client).
 */

export type Keuze = { productId: string; kleur: string | null };

export type PoolProduct = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  subcategorie: string | null;
  sku: string | null;
  omschrijving: string | null;
  afbeeldingen: string[] | null;
  verkoopprijs_basis: number | null;
  /** Schone fotolijst uit `afbeeldingen`. */
  fotos: string[];
};

export type Pool = {
  producten: Map<string, PoolProduct>;
  /** product_id -> (kleur -> foto-url) */
  kleurFotos: Map<string, Map<string, string>>;
};

const PRODUCT_VELDEN = 'id, naam, merk, categorie, subcategorie, sku, omschrijving, afbeeldingen, verkoopprijs_basis';
const PAGINA = 1000;
/** Uuid's per .in()-filter: houdt de query-url ruim onder de limiet. */
const IN_BLOK = 80;

function blokken<T>(lijst: T[], grootte: number): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) uit.push(lijst.slice(i, i + grootte));
  return uit;
}

/**
 * Laadt actieve artikelen en hun kleurfoto's. Met `ids` alleen die artikelen
 * (voor een prospect waarvoor Jessi zelf de artikelen koos).
 */
export async function laadPool(sb: SupabaseClient, opts: { ids?: string[] } = {}): Promise<Pool> {
  const producten = new Map<string, PoolProduct>();
  const kleurFotos = new Map<string, Map<string, string>>();

  type Rij = Omit<PoolProduct, 'fotos'>;
  const voegToe = (rijen: Rij[] | null) => {
    for (const r of rijen ?? []) producten.set(r.id, { ...r, fotos: fotosVan(r.afbeeldingen) });
  };

  if (opts.ids) {
    const ids = [...new Set(opts.ids.filter(Boolean))];
    for (const deel of blokken(ids, IN_BLOK)) {
      const { data } = await sb.from('producten').select(PRODUCT_VELDEN).eq('actief', true).in('id', deel);
      voegToe(data as Rij[] | null);
    }
  } else {
    for (let van = 0; van < 20_000; van += PAGINA) {
      const { data, error } = await sb
        .from('producten')
        .select(PRODUCT_VELDEN)
        .eq('actief', true)
        .order('id')
        .range(van, van + PAGINA - 1);
      if (error || !data) break;
      voegToe(data as Rij[]);
      if (data.length < PAGINA) break;
    }
  }

  const productIds = [...producten.keys()];
  if (productIds.length) {
    type KleurRij = { product_id: string; kleur: string | null; afbeelding_url: string | null };
    const verwerk = (rijen: KleurRij[] | null) => {
      for (const r of rijen ?? []) {
        const kleur = (r.kleur ?? '').trim();
        const url = (r.afbeelding_url ?? '').trim();
        if (!kleur || !url || !producten.has(r.product_id)) continue;
        if (!/^(\/|https?:\/\/)/.test(url)) continue;
        let m = kleurFotos.get(r.product_id);
        if (!m) kleurFotos.set(r.product_id, (m = new Map()));
        m.set(kleur, url);
      }
    };
    if (opts.ids) {
      for (const deel of blokken(productIds, IN_BLOK)) {
        const { data } = await sb.from('product_kleur_afbeeldingen').select('product_id, kleur, afbeelding_url').in('product_id', deel);
        verwerk(data as KleurRij[] | null);
      }
    } else {
      for (let van = 0; van < 50_000; van += PAGINA) {
        const { data, error } = await sb
          .from('product_kleur_afbeeldingen')
          .select('product_id, kleur, afbeelding_url')
          .order('product_id')
          .range(van, van + PAGINA - 1);
        if (error || !data) break;
        verwerk(data as KleurRij[]);
        if (data.length < PAGINA) break;
      }
    }
  }

  return { producten, kleurFotos };
}

/** Beste kleurfoto voor een mockup: donker en neutraal gaat voor. */
function besteKleurFoto(pool: Pool, productId: string): { kleur: string; url: string; rang: number } | null {
  const m = pool.kleurFotos.get(productId);
  if (!m || m.size === 0) return null;
  let beste: { kleur: string; url: string; rang: number } | null = null;
  for (const [kleur, url] of m) {
    const rang = kleurRang(kleur);
    if (!beste || rang < beste.rang || (rang === beste.rang && kleur.localeCompare(beste.kleur, 'nl') < 0)) {
      beste = { kleur, url, rang };
    }
  }
  return beste;
}

function heeftFoto(pool: Pool, p: PoolProduct): boolean {
  return p.fotos.length > 0 || (pool.kleurFotos.get(p.id)?.size ?? 0) > 0;
}

function treft(p: PoolProduct, woorden: string[]): boolean {
  const tekst = `${p.naam} ${p.subcategorie ?? ''}`.toLowerCase();
  return woorden.some((w) => tekst.includes(w));
}

/** Score per kandidaat; hoger is beter. */
function score(pool: Pool, p: PoolProduct, plek: ArtikelPlek): number {
  let s = 0;
  if (plek.trefwoorden.length && treft(p, plek.trefwoorden)) s += 100;
  // Eerste trefwoord is het eigenlijke artikel ("softshell" voor "jas").
  if (plek.trefwoorden[0] && treft(p, [plek.trefwoorden[0]])) s += 20;
  const kf = besteKleurFoto(pool, p.id);
  if (kf) s += 40 - Math.min(40, kf.rang);
  if (p.verkoopprijs_basis != null && Number(p.verkoopprijs_basis) > 0) s += 5;
  if (publiekeProductUrl({ ...p, actief: true })) s += 5;
  // Dames-, kinder- en hi-vis-uitvoeringen liever niet als eerste indruk.
  if (/lady|dames|women|kids|kinder|junior|hi-vis|fluor|rws/i.test(p.naam)) s -= 30;
  return s;
}

function kiesVoorPlek(pool: Pool, plek: ArtikelPlek, bezet: Set<string>): Keuze | null {
  const kandidaten = [...pool.producten.values()].filter(
    (p) =>
      !bezet.has(p.id) &&
      heeftFoto(pool, p) &&
      (plek.categorieen.length === 0 || (p.categorie != null && plek.categorieen.includes(p.categorie))) &&
      (!plek.trefwoordVerplicht || treft(p, plek.trefwoorden)),
  );
  if (kandidaten.length === 0) return plek.terugval ? kiesVoorPlek(pool, plek.terugval, bezet) : null;
  const scores = new Map(kandidaten.map((p) => [p.id, score(pool, p, plek)]));
  kandidaten.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.naam.localeCompare(b.naam, 'nl') || a.id.localeCompare(b.id));
  const p = kandidaten[0];
  const kf = besteKleurFoto(pool, p.id);
  return { productId: p.id, kleur: kf?.kleur ?? null };
}

/** Vier artikelen automatisch gekozen op branche (zie content/kennismaking.ts). */
export function kiesVoorBranche(pool: Pool, branche: string | null, aantal = 4): Keuze[] {
  const plekken = ARTIKELEN_PER_BRANCHE[brancheGroep(branche)];
  const bezet = new Set<string>();
  const uit: Keuze[] = [];
  for (const plek of plekken) {
    const k = kiesVoorPlek(pool, plek, bezet);
    if (!k) continue;
    bezet.add(k.productId);
    uit.push(k);
    if (uit.length >= aantal) break;
  }
  return uit;
}

/** Leest `mockup_artikelen` uit de database tolerant in: alleen geldige {productId, kleur}. */
export function leesMockupKeuzes(ruw: unknown): Keuze[] | null {
  if (!Array.isArray(ruw)) return null;
  const uit: Keuze[] = [];
  for (const item of ruw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const productId = typeof o.productId === 'string' ? o.productId.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(productId)) continue;
    const kleur = typeof o.kleur === 'string' && o.kleur.trim() ? o.kleur.trim() : null;
    uit.push({ productId, kleur });
  }
  return uit.length ? uit : null;
}

type VariantRij = { product_id: string; kleur: string | null; verkoopprijs: number | null; actief: boolean | null };

/** Laagste verkoopprijs per product (en per product+kleur) voor de opgegeven artikelen. */
async function laadPrijzen(sb: SupabaseClient, ids: string[]) {
  const perProduct = new Map<string, number>();
  const perKleur = new Map<string, number>();
  for (const deel of blokken([...new Set(ids)], IN_BLOK)) {
    const { data } = await sb.from('product_varianten').select('product_id, kleur, verkoopprijs, actief').in('product_id', deel);
    for (const v of (data as VariantRij[] | null) ?? []) {
      if (v.actief === false) continue;
      const prijs = v.verkoopprijs == null ? NaN : Number(v.verkoopprijs);
      if (!Number.isFinite(prijs) || prijs <= 0) continue;
      const a = perProduct.get(v.product_id);
      if (a == null || prijs < a) perProduct.set(v.product_id, prijs);
      const sleutel = `${v.product_id}|${(v.kleur ?? '').trim().toLowerCase()}`;
      const b = perKleur.get(sleutel);
      if (b == null || prijs < b) perKleur.set(sleutel, prijs);
    }
  }
  return { perProduct, perKleur };
}

/** Kleuren van de varianten per product (voor de kleurkeuze in het dashboard). */
export async function laadKleuren(sb: SupabaseClient, ids: string[]): Promise<Map<string, string[]>> {
  const uit = new Map<string, string[]>();
  for (const deel of blokken([...new Set(ids)], IN_BLOK)) {
    const { data } = await sb.from('product_varianten').select('product_id, kleur, actief').in('product_id', deel);
    for (const v of (data as { product_id: string; kleur: string | null; actief: boolean | null }[] | null) ?? []) {
      if (v.actief === false) continue;
      const k = (v.kleur ?? '').trim();
      if (!k) continue;
      const lijst = uit.get(v.product_id) ?? [];
      if (!lijst.includes(k)) lijst.push(k);
      uit.set(v.product_id, lijst);
    }
  }
  for (const lijst of uit.values()) lijst.sort((a, b) => a.localeCompare(b, 'nl'));
  return uit;
}

/**
 * Zet keuzes om naar MockupArtikel, voor meerdere prospects tegelijk. Artikelen
 * zonder foto of die niet (meer) actief zijn vallen weg.
 */
export async function bouwMockups(sb: SupabaseClient, pool: Pool, sets: Keuze[][]): Promise<MockupArtikel[][]> {
  const ids = sets.flat().map((k) => k.productId).filter((id) => pool.producten.has(id));
  const { perProduct, perKleur } = await laadPrijzen(sb, ids);
  return sets.map((set) =>
    set.flatMap((k): MockupArtikel[] => {
      const p = pool.producten.get(k.productId);
      if (!p) return [];
      const kleurMap = pool.kleurFotos.get(p.id);
      let kleur = k.kleur;
      let foto: string | null = null;
      if (kleur && kleurMap) {
        foto = kleurMap.get(kleur) ?? null;
        if (!foto) {
          const laag = kleur.toLowerCase();
          for (const [kk, url] of kleurMap) if (kk.toLowerCase() === laag) { foto = url; break; }
        }
      }
      if (!foto) foto = p.fotos[0] ?? null;
      if (!foto) {
        const kf = besteKleurFoto(pool, p.id);
        if (kf) { foto = kf.url; kleur = kf.kleur; }
      }
      if (!foto) return [];
      const prijs = (kleur ? perKleur.get(`${p.id}|${kleur.trim().toLowerCase()}`) : undefined)
        ?? perProduct.get(p.id)
        ?? (p.verkoopprijs_basis != null && Number(p.verkoopprijs_basis) > 0 ? Number(p.verkoopprijs_basis) : null);
      return [{
        productId: p.id,
        naam: p.naam,
        merk: p.merk,
        categorie: p.categorie,
        kleur,
        fotoUrl: foto,
        prijs,
        url: publiekeProductUrl({ ...p, actief: true }),
        logoPositie: logoPositieVoor(p.categorie, p.naam),
      }];
    }),
  );
}
