import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Artikel zoeken en kleuren van één artikel ophalen, voor regelkiezers
 * (factuur, en bruikbaar voor andere documenten).
 *
 * Supabase geeft per verzoek hoogstens 1000 rijen terug. Daarom haalt de zoeker
 * niet de hele catalogus naar de browser, maar zoekt hij server-side met ilike
 * en een limit. Kleuren en maten worden pas opgehaald zodra een artikel gekozen
 * is, in blokken van 1000 zodat ook artikelen met heel veel varianten compleet zijn.
 *
 * Alleen server-side gebruiken, achter dashAuthed().
 */

export type ZoekArtikel = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  sku: string | null;
  afbeelding: string | null;
  /** Btw-tarief van het artikel (producten.btw), standaard 21. */
  btw: number;
  /** Staat in het assortiment van deze klant: die komen bovenaan. */
  inAssortiment: boolean;
  /** De vaste kleur uit het assortiment van de klant, als die eenduidig is. */
  assortimentKleur: string | null;
};

export type ZoekMaat = { variantId: string; maat: string; prijs: number | null };

export type ZoekKleur = {
  /** Kleurnaam zoals hij op het document komt ('' bij artikelen zonder kleur). */
  kleur: string;
  afbeelding: string | null;
  maten: ZoekMaat[];
  /** Prijs zonder gekozen maat: gelijk voor alle maten, of de laagste. */
  prijs: number | null;
  prijsVerschiltPerMaat: boolean;
};

const STAP = 1000;

/** Alle rijen van een query ophalen, ook boven de 1000 (vaste volgorde vereist). */
async function allesOphalen<T>(pagina: (van: number, tot: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const uit: T[] = [];
  for (let i = 0; i < 100; i++) {
    const van = i * STAP;
    const { data, error } = await pagina(van, van + STAP - 1);
    if (error) break;
    const rijen = (data as T[]) ?? [];
    uit.push(...rijen);
    if (rijen.length < STAP) break;
  }
  return uit;
}

function inStukken<T>(lijst: T[], grootte = 150): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) uit.push(lijst.slice(i, i + grootte));
  return uit;
}

const kleurSleutel = (k: string | null | undefined) => (k ?? '').trim().toLowerCase();

/**
 * Zoekwoorden veilig voor een PostgREST or-filter: komma's, haakjes, sterretjes,
 * procenttekens en aanhalingstekens hebben daar een betekenis en gaan eruit.
 */
function zoekwoorden(term: string): string[] {
  return term
    .replace(/[%*,()"'\\:]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .slice(0, 6);
}

type AssRij = { product_id: string | null; toegestaan: boolean | null; afdeling_id: string | null; medewerker_id: string | null; kleur?: string | null };

/**
 * Assortiment van een klant: welke artikelen, en per artikel de vaste kleur als
 * die eenduidig is. Een regel voor de hele klant gaat voor regels per afdeling of
 * werknemer. Valt terug op een select zonder kleur als die kolom nog niet bestaat.
 */
async function assortimentVan(sb: SupabaseClient, orgId: string): Promise<Map<string, string | null>> {
  const basis = 'product_id, toegestaan, afdeling_id, medewerker_id';
  // Eerste blok apart: geeft dat een fout (kolom kleur bestaat nog niet), dan zonder kleur.
  const eerste = await sb.from('assortiment').select(`${basis}, kleur`).eq('organisatie_id', orgId).order('id').range(0, STAP - 1);
  const kolommen = eerste.error ? basis : `${basis}, kleur`;
  let rijen: AssRij[];
  if (!eerste.error && ((eerste.data as AssRij[]) ?? []).length < STAP) {
    rijen = (eerste.data as AssRij[]) ?? [];
  } else {
    rijen = await allesOphalen<AssRij>((van, tot) =>
      sb.from('assortiment').select(kolommen).eq('organisatie_id', orgId).order('id').range(van, tot),
    );
  }
  const perArtikel = new Map<string, { klant: Set<string>; overig: Set<string>; namen: Map<string, string> }>();
  for (const r of rijen) {
    if (!r.product_id || r.toegestaan === false) continue;
    let p = perArtikel.get(r.product_id);
    if (!p) {
      p = { klant: new Set(), overig: new Set(), namen: new Map() };
      perArtikel.set(r.product_id, p);
    }
    const kleur = (r.kleur ?? '').trim();
    if (!kleur) continue;
    const sleutel = kleur.toLowerCase();
    p.namen.set(sleutel, kleur);
    if (!r.afdeling_id && !r.medewerker_id) p.klant.add(sleutel);
    else p.overig.add(sleutel);
  }
  const uit = new Map<string, string | null>();
  for (const [id, p] of perArtikel) {
    const set = p.klant.size > 0 ? p.klant : p.overig;
    uit.set(id, set.size === 1 ? p.namen.get([...set][0]) ?? null : null);
  }
  return uit;
}

type ProdRij = { id: string; naam: string | null; merk: string | null; categorie: string | null; sku: string | null; afbeeldingen: string[] | null; btw: number | null };
const PROD_SELECT = 'id, naam, merk, categorie, sku, afbeeldingen, btw';

/**
 * Zoekt actieve artikelen op naam, merk, categorie, artikelnummer of
 * leveranciersnummer. Elk woord moet ergens voorkomen. Artikelen uit het
 * assortiment van de klant staan bovenaan. `meer` zegt of er meer treffers zijn
 * dan getoond.
 */
export async function zoekArtikelen(
  term: string,
  orgId: string | null,
  limiet = 24,
): Promise<{ artikelen: ZoekArtikel[]; meer: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { artikelen: [], meer: false };
  const woorden = zoekwoorden(term);
  const max = Math.max(1, Math.min(60, limiet));

  const filter = <Q extends { or: (f: string) => Q }>(q: Q): Q => {
    let uit = q;
    for (const w of woorden) {
      uit = uit.or(`naam.ilike.%${w}%,merk.ilike.%${w}%,categorie.ilike.%${w}%,sku.ilike.%${w}%,art_nr_leverancier.ilike.%${w}%`);
    }
    return uit;
  };

  const assortiment = orgId ? await assortimentVan(sb, orgId) : new Map<string, string | null>();
  const assIds = [...assortiment.keys()];

  // 1. Treffers binnen het assortiment van de klant (in stukken, zodat de URL kort blijft).
  const assTreffers: ProdRij[] = [];
  for (const stuk of inStukken(assIds)) {
    if (assTreffers.length > max) break;
    const { data } = await filter(
      sb.from('producten').select(PROD_SELECT).eq('actief', true).in('id', stuk),
    ).order('naam').limit(max + 1);
    assTreffers.push(...(((data as ProdRij[]) ?? [])));
  }
  assTreffers.sort((a, b) => (a.naam ?? '').localeCompare(b.naam ?? '', 'nl'));

  // 2. Treffers in de hele catalogus.
  const { data: alleData } = await filter(sb.from('producten').select(PROD_SELECT).eq('actief', true))
    .order('naam')
    .limit(max + 1 + Math.min(assTreffers.length, max));
  const alle = (alleData as ProdRij[]) ?? [];

  const gezien = new Set<string>();
  const samen: ProdRij[] = [];
  for (const p of [...assTreffers, ...alle]) {
    if (gezien.has(p.id)) continue;
    gezien.add(p.id);
    samen.push(p);
  }
  const meer = samen.length > max;
  const artikelen = samen.slice(0, max).map((p) => ({
    id: p.id,
    naam: p.naam ?? 'Naamloos',
    merk: p.merk,
    categorie: p.categorie,
    sku: p.sku,
    afbeelding: (p.afbeeldingen ?? [])[0] ?? null,
    btw: p.btw != null && Number.isFinite(Number(p.btw)) ? Number(p.btw) : 21,
    inAssortiment: assortiment.has(p.id),
    assortimentKleur: assortiment.get(p.id) ?? null,
  }));
  return { artikelen, meer };
}

/** Confectiematen in logische volgorde (XS voor S voor M ... voor 4XL); onbekend achteraan. */
const MAAT_RIJ = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '6XL', '7XL', '8XL'];
function maatVolgorde(maat: string): number {
  const m = maat.trim().toUpperCase().replace(/^2XL$/, 'XXL').replace(/^3XL$/, 'XXXL');
  const i = MAAT_RIJ.indexOf(m);
  return i === -1 ? 100 : i;
}

/**
 * Kleuren van één artikel, elk met kleurfoto en de maten in die kleur.
 * Alleen kleuren die als actieve variant bestaan. Prijs per maat: verkoopprijs
 * plus meerprijs van de variant (de lijstprijs, zoals op order en webshop),
 * anders de basisverkoopprijs van het artikel.
 */
export async function kleurenVanArtikel(productId: string): Promise<ZoekKleur[]> {
  const sb = kmsAdmin();
  const id = (productId ?? '').trim();
  if (!sb || !id) return [];

  type VarRij = { id: string; maat: string | null; kleur: string | null; verkoopprijs: number | null; meerprijs: number | null };
  const [varianten, { data: fotoData }, { data: prodData }] = await Promise.all([
    allesOphalen<VarRij>((van, tot) =>
      sb
        .from('product_varianten')
        .select('id, maat, kleur, verkoopprijs, meerprijs')
        .eq('product_id', id)
        .or('actief.is.null,actief.eq.true')
        .order('id')
        .range(van, tot),
    ),
    sb.from('product_kleur_afbeeldingen').select('kleur, afbeelding_url').eq('product_id', id).limit(1000),
    sb.from('producten').select('afbeeldingen, verkoopprijs_basis').eq('id', id).maybeSingle(),
  ]);
  const prod = prodData as { afbeeldingen: string[] | null; verkoopprijs_basis: number | null } | null;
  const basis = prod?.verkoopprijs_basis != null && Number.isFinite(Number(prod.verkoopprijs_basis)) ? Number(prod.verkoopprijs_basis) : null;
  const eersteFoto = (prod?.afbeeldingen ?? [])[0] ?? null;

  const fotoVan = new Map<string, string>();
  for (const f of (fotoData as { kleur: string | null; afbeelding_url: string | null }[]) ?? []) {
    if (f.afbeelding_url) fotoVan.set(kleurSleutel(f.kleur), f.afbeelding_url);
  }

  const groepen = new Map<string, ZoekKleur>();
  for (const v of varianten) {
    const sleutel = kleurSleutel(v.kleur);
    let g = groepen.get(sleutel);
    if (!g) {
      g = { kleur: (v.kleur ?? '').trim(), afbeelding: fotoVan.get(sleutel) ?? eersteFoto, maten: [], prijs: null, prijsVerschiltPerMaat: false };
      groepen.set(sleutel, g);
    }
    const maat = (v.maat ?? '').trim();
    if (g.maten.some((m) => m.maat.toLowerCase() === maat.toLowerCase())) continue;
    const prijs =
      v.verkoopprijs != null ? Math.round(((Number(v.verkoopprijs) || 0) + (Number(v.meerprijs) || 0)) * 100) / 100 : basis;
    g.maten.push({ variantId: v.id, maat, prijs });
  }

  const kleuren = [...groepen.values()];
  if (kleuren.length === 0) {
    return basis != null || eersteFoto ? [{ kleur: '', afbeelding: eersteFoto, maten: [], prijs: basis, prijsVerschiltPerMaat: false }] : [];
  }
  for (const g of kleuren) {
    g.maten.sort((a, b) => {
      const na = a.maat ? Number(a.maat) : NaN;
      const nb = b.maat ? Number(b.maat) : NaN;
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return maatVolgorde(a.maat) - maatVolgorde(b.maat) || a.maat.localeCompare(b.maat, 'nl', { numeric: true });
    });
    const prijzen = g.maten.map((m) => m.prijs).filter((p): p is number => p != null);
    g.prijs = prijzen.length ? Math.min(...prijzen) : basis;
    g.prijsVerschiltPerMaat = new Set(prijzen).size > 1;
  }
  kleuren.sort((a, b) => (a.kleur || '\uffff').localeCompare(b.kleur || '\uffff', 'nl'));
  return kleuren;
}

/** Omschrijving van een artikelregel: merk + naam, gekozen kleur, en eventueel de maat. */
export function artikelOmschrijving(a: { merk: string | null; naam: string }, kleur: string | null, maat: string | null): string {
  const naam = a.merk && !a.naam.toLowerCase().startsWith(a.merk.toLowerCase()) ? `${a.merk} ${a.naam}` : a.naam;
  return [naam, (kleur ?? '').trim(), maat && maat.trim() ? `maat ${maat.trim()}` : ''].filter(Boolean).join(', ');
}
