import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';

/**
 * Data-access voor het voorraadoverzicht.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 *
 * Het meeste bij Frederiks wordt op order besteld. Daarom is "voorraadartikel"
 * een expliciete instelling (producten.voorraad_bijhouden, per variant te
 * overschrijven). Zonder die instelling zou de lijst vol nullen staan. Staat de
 * migratie nog niet, dan telt een variant als voorraadartikel zodra er voorraad
 * ligt of het product een minimum heeft.
 */

type PgFout = { code?: string; message?: string } | null | undefined;

/** Tabel bestaat (nog) niet: 42P01 in Postgres, PGRST205 in PostgREST. */
export function tabelOntbreekt(fout: PgFout): boolean {
  if (!fout) return false;
  if (fout.code === '42P01' || fout.code === 'PGRST205') return true;
  const m = String(fout.message ?? '').toLowerCase();
  return m.includes('could not find the table') || (m.includes('relation') && m.includes('does not exist'));
}

/** Kolom of tabel ontbreekt: alles wat betekent dat de migratie nog niet gedraaid is. */
export function migratieOntbreekt(fout: PgFout): boolean {
  return kolomOntbreekt(fout) || tabelOntbreekt(fout);
}

/** Haalt alle rijen op in blokken, want PostgREST geeft er standaard maximaal 1000 per keer. */
export async function alleRijen<T>(
  maak: (van: number, tot: number) => PromiseLike<{ data: unknown; error: PgFout }>,
  stap = 1000,
): Promise<{ rijen: T[]; error: PgFout }> {
  const rijen: T[] = [];
  for (let van = 0; van < 200_000; van += stap) {
    const { data, error } = await maak(van, van + stap - 1);
    if (error) return { rijen, error };
    const blok = (data as T[]) ?? [];
    rijen.push(...blok);
    if (blok.length < stap) break;
  }
  return { rijen, error: null };
}

/** .in() met honderden id's wordt een te lange URL; dus in stukken. */
export async function inStukken<T>(
  ids: string[],
  maak: (stuk: string[]) => PromiseLike<{ data: unknown; error: PgFout }>,
  grootte = 150,
): Promise<T[]> {
  const uit: T[] = [];
  for (let i = 0; i < ids.length; i += grootte) {
    const { data } = await maak(ids.slice(i, i + grootte));
    uit.push(...(((data as T[]) ?? [])));
  }
  return uit;
}

/** Orderstatussen waarin de goederen nog bij ons liggen of moeten komen: die reserveren voorraad. */
export const RESERVERENDE_ORDERSTATUSSEN = [
  'offerte_goedgekeurd',
  'nog_bestellen',
  'besteld',
  'deellevering',
  'compleet_geleverd',
  'bedrukken',
  'borduren',
  'verpakken',
] as const;

/** Statussen die niet als verkoop tellen voor "niet-lopend". */
const GEEN_VERKOOP = ['concept', 'offerte_verstuurd', 'geannuleerd'];

export const MUTATIE_REDENEN = ['telling', 'ontvangst', 'correctie', 'retour'] as const;
export type MutatieReden = (typeof MUTATIE_REDENEN)[number];
export const REDEN_LABEL: Record<string, string> = {
  telling: 'Telling',
  ontvangst: 'Ontvangst',
  correctie: 'Correctie',
  retour: 'Retour',
  verkoop: 'Verkoop',
  instelling: 'Instelling',
};

export type VoorraadStatus = 'ok' | 'laag' | 'op' | 'niet';
export const STATUS_LABEL: Record<VoorraadStatus, string> = {
  ok: 'op voorraad',
  laag: 'laag',
  op: 'op',
  niet: 'niet op voorraad gehouden',
};

export type VoorraadRij = {
  variant_id: string;
  product_id: string;
  product_naam: string;
  merk: string | null;
  categorie: string | null;
  leverancier_id: string | null;
  leverancier_naam: string | null;
  foto: string | null;
  maat: string | null;
  kleur: string | null;
  locatie: string | null;
  voorraad: number;
  gereserveerd: number;
  beschikbaar: number;
  /** Bijbesteld en nog niet binnen (inkoopregels zonder klantorder). */
  onderweg: number;
  min_voorraad: number | null;
  inkoopprijs: number | null;
  verkoopprijs: number | null;
  inkoopwaarde: number;
  bijhouden: boolean;
  /** Komt de instelling van de variant zelf, of volgt hij het product? */
  bijhoudenEigen: boolean;
  status: VoorraadStatus;
  actief: boolean;
  laatsteVerkoop: string | null;
  nietLopend: boolean;
};

export type VoorraadKpis = {
  waardeInkoop: number;
  waardeVerkoop: number;
  artikelenOpVoorraad: number;
  stuksOpVoorraad: number;
  onderMinimum: number;
  op: number;
  nietLopend: number;
  nietLopendWaarde: number;
  gereserveerdStuks: number;
  openOrders: number;
  voorraadartikelen: number;
};

export type VoorraadOverzicht = {
  rijen: VoorraadRij[];
  kpis: VoorraadKpis;
  merken: string[];
  categorieen: string[];
  leveranciers: { id: string; naam: string }[];
  locaties: string[];
  /** false = migratie voor voorraadartikel/minimum per variant nog niet gedraaid. */
  instellingenKlaar: boolean;
  /** false = voorraad_mutaties bestaat nog niet. */
  mutatiesKlaar: boolean;
};

type VariantDb = {
  id: string;
  maat: string | null;
  kleur: string | null;
  voorraad: number | null;
  inkoopprijs: number | null;
  verkoopprijs: number | null;
  actief: boolean | null;
  voorraad_bijhouden?: boolean | null;
  min_voorraad?: number | null;
  locatie?: string | null;
};

type ProductDb = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  leverancier_id: string | null;
  afbeeldingen: string[] | null;
  min_voorraad: number | null;
  verkoopprijs_basis: number | null;
  voorraad_bijhouden?: boolean | null;
  product_varianten: VariantDb[] | null;
};

const VARIANT_BASIS = 'id, maat, kleur, voorraad, inkoopprijs, verkoopprijs, actief';
const VARIANT_NIEUW = ', voorraad_bijhouden, min_voorraad, locatie';
const PRODUCT_BASIS = 'id, naam, merk, categorie, leverancier_id, afbeeldingen, min_voorraad, verkoopprijs_basis';

async function haalProducten(sb: SupabaseClient): Promise<{ producten: ProductDb[]; nieuw: boolean }> {
  const met = await alleRijen<ProductDb>(
    (van, tot) =>
      sb
        .from('producten')
        .select(`${PRODUCT_BASIS}, voorraad_bijhouden, product_varianten(${VARIANT_BASIS}${VARIANT_NIEUW})`)
        .order('naam')
        .range(van, tot),
    500,
  );
  if (!met.error) return { producten: met.rijen, nieuw: true };
  if (!kolomOntbreekt(met.error)) return { producten: met.rijen, nieuw: true };
  const zonder = await alleRijen<ProductDb>(
    (van, tot) =>
      sb
        .from('producten')
        .select(`${PRODUCT_BASIS}, product_varianten(${VARIANT_BASIS})`)
        .order('naam')
        .range(van, tot),
    500,
  );
  return { producten: zonder.rijen, nieuw: false };
}

type OrderInfo = { id: string; status: string | null; besteldatum: string | null; created_at: string | null };

/** Gereserveerd per variant (open orders) en laatste verkoopdatum per variant. */
async function haalOrderGebruik(sb: SupabaseClient) {
  const zesMaanden = new Date();
  zesMaanden.setMonth(zesMaanden.getMonth() - 6);
  const grens = zesMaanden.toISOString();

  const [{ rijen: open }, { rijen: recent }] = await Promise.all([
    alleRijen<OrderInfo>((van, tot) =>
      sb.from('orders').select('id, status, besteldatum, created_at').in('status', [...RESERVERENDE_ORDERSTATUSSEN]).range(van, tot),
    ),
    alleRijen<OrderInfo>((van, tot) =>
      sb.from('orders').select('id, status, besteldatum, created_at').gte('created_at', grens).range(van, tot),
    ),
  ]);

  const orders = new Map<string, OrderInfo>();
  for (const o of [...open, ...recent]) orders.set(o.id, o);
  const openIds = new Set(open.map((o) => o.id));

  const regels = await inStukken<{ order_id: string; variant_id: string | null; aantal: number | null }>(
    [...orders.keys()],
    (stuk) => sb.from('orderregels').select('order_id, variant_id, aantal').in('order_id', stuk),
  );

  const gereserveerd = new Map<string, number>();
  const laatsteVerkoop = new Map<string, string>();
  for (const r of regels) {
    if (!r.variant_id) continue;
    const o = orders.get(r.order_id);
    if (!o) continue;
    if (openIds.has(r.order_id)) gereserveerd.set(r.variant_id, (gereserveerd.get(r.variant_id) ?? 0) + (Number(r.aantal) || 0));
    if (!GEEN_VERKOOP.includes(o.status ?? '')) {
      const datum = o.besteldatum ?? o.created_at;
      if (datum && datum >= grens && (laatsteVerkoop.get(r.variant_id) ?? '') < datum) laatsteVerkoop.set(r.variant_id, datum);
    }
  }
  return { gereserveerd, laatsteVerkoop, openOrders: openIds.size };
}

/** Wat er bijbesteld is maar nog niet binnen (inkoopregels zonder klantorder). */
async function haalOnderweg(sb: SupabaseClient): Promise<Map<string, number>> {
  const { rijen } = await alleRijen<{ variant_id: string | null; aantal: number | null; geleverd_aantal: number | null }>((van, tot) =>
    sb
      .from('inkoopregels')
      .select('variant_id, aantal, geleverd_aantal')
      .is('order_id', null)
      .in('status', ['te_bestellen', 'besteld', 'deels'])
      .range(van, tot),
  );
  const kaart = new Map<string, number>();
  for (const r of rijen) {
    if (!r.variant_id) continue;
    const rest = Math.max(0, (Number(r.aantal) || 0) - (Number(r.geleverd_aantal) || 0));
    kaart.set(r.variant_id, (kaart.get(r.variant_id) ?? 0) + rest);
  }
  return kaart;
}

async function mutatieTabelBestaat(sb: SupabaseClient): Promise<boolean> {
  // Geen HEAD-verzoek: dan ontbreekt bij een onbekende tabel soms de foutcode.
  const { error } = await sb.from('voorraad_mutaties').select('id').limit(1);
  return !error || !migratieOntbreekt(error);
}

function bepaalStatus(r: { bijhouden: boolean; voorraad: number; beschikbaar: number; min_voorraad: number | null }): VoorraadStatus {
  if (!r.bijhouden) return 'niet';
  if (r.voorraad <= 0 || r.beschikbaar <= 0) return 'op';
  if (r.min_voorraad != null && r.beschikbaar < r.min_voorraad) return 'laag';
  return 'ok';
}

const centen = (n: number) => Math.round(n * 100) / 100;

export async function getVoorraadOverzicht(): Promise<VoorraadOverzicht> {
  const leeg: VoorraadOverzicht = {
    rijen: [],
    kpis: {
      waardeInkoop: 0, waardeVerkoop: 0, artikelenOpVoorraad: 0, stuksOpVoorraad: 0, onderMinimum: 0, op: 0,
      nietLopend: 0, nietLopendWaarde: 0, gereserveerdStuks: 0, openOrders: 0, voorraadartikelen: 0,
    },
    merken: [], categorieen: [], leveranciers: [], locaties: [], instellingenKlaar: false, mutatiesKlaar: false,
  };
  const sb = kmsAdmin();
  if (!sb) return leeg;

  const [{ producten, nieuw }, levRes, gebruik, onderweg, mutatiesKlaar] = await Promise.all([
    haalProducten(sb),
    sb.from('leveranciers').select('id, naam').order('naam'),
    haalOrderGebruik(sb),
    haalOnderweg(sb),
    mutatieTabelBestaat(sb),
  ]);
  const leveranciers = ((levRes.data as { id: string; naam: string }[]) ?? []).filter((l) => l.naam);
  const levNaam = new Map(leveranciers.map((l) => [l.id, l.naam]));

  const rijen: VoorraadRij[] = [];
  const merken = new Set<string>();
  const categorieen = new Set<string>();
  const locaties = new Set<string>();
  const k = { ...leeg.kpis, openOrders: gebruik.openOrders };

  for (const p of producten) {
    if (p.merk) merken.add(p.merk);
    if (p.categorie) categorieen.add(p.categorie);
    const foto = (p.afbeeldingen ?? []).find((u) => typeof u === 'string' && u.trim()) ?? null;
    for (const v of p.product_varianten ?? []) {
      const voorraad = Number(v.voorraad) || 0;
      const gereserveerd = gebruik.gereserveerd.get(v.id) ?? 0;
      const beschikbaar = voorraad - gereserveerd;
      const minVariant = v.min_voorraad ?? null;
      const eigen = nieuw && v.voorraad_bijhouden !== null && v.voorraad_bijhouden !== undefined;
      const instelling = nieuw
        ? (eigen ? Boolean(v.voorraad_bijhouden) : Boolean(p.voorraad_bijhouden))
        : p.min_voorraad != null;
      // Ligt er echt iets, dan is het een voorraadartikel, wat de instelling ook zegt.
      const bijhouden = instelling || voorraad > 0;
      const inkoopprijs = v.inkoopprijs === null || v.inkoopprijs === undefined ? null : Number(v.inkoopprijs);
      const verkoopprijs = v.verkoopprijs ?? p.verkoopprijs_basis ?? null;
      const laatste = gebruik.laatsteVerkoop.get(v.id) ?? null;
      const locatie = (v.locatie ?? '').trim() || null;
      if (locatie) locaties.add(locatie);

      const rij: VoorraadRij = {
        variant_id: v.id,
        product_id: p.id,
        product_naam: p.naam,
        merk: p.merk,
        categorie: p.categorie,
        leverancier_id: p.leverancier_id,
        leverancier_naam: p.leverancier_id ? levNaam.get(p.leverancier_id) ?? null : null,
        foto,
        maat: v.maat,
        kleur: v.kleur,
        locatie,
        voorraad,
        gereserveerd,
        beschikbaar,
        onderweg: onderweg.get(v.id) ?? 0,
        min_voorraad: minVariant,
        inkoopprijs,
        verkoopprijs: verkoopprijs === null ? null : Number(verkoopprijs),
        inkoopwaarde: centen(Math.max(0, voorraad) * (inkoopprijs ?? 0)),
        bijhouden,
        bijhoudenEigen: eigen,
        status: 'niet',
        actief: v.actief !== false,
        laatsteVerkoop: laatste,
        nietLopend: voorraad > 0 && !laatste,
      };
      rij.status = bepaalStatus(rij);
      rijen.push(rij);

      if (bijhouden) k.voorraadartikelen += 1;
      if (voorraad > 0) {
        k.artikelenOpVoorraad += 1;
        k.stuksOpVoorraad += voorraad;
        k.waardeInkoop += voorraad * (inkoopprijs ?? 0);
        k.waardeVerkoop += voorraad * (rij.verkoopprijs ?? 0);
      }
      if (rij.status === 'laag') k.onderMinimum += 1;
      if (rij.status === 'op' && minVariant != null) k.onderMinimum += 1;
      if (rij.status === 'op') k.op += 1;
      if (rij.nietLopend) {
        k.nietLopend += 1;
        k.nietLopendWaarde += rij.inkoopwaarde;
      }
      if (bijhouden) k.gereserveerdStuks += gereserveerd;
    }
  }
  k.waardeInkoop = centen(k.waardeInkoop);
  k.waardeVerkoop = centen(k.waardeVerkoop);
  k.nietLopendWaarde = centen(k.nietLopendWaarde);

  const nl = (a: string, b: string) => a.localeCompare(b, 'nl');
  return {
    rijen,
    kpis: k,
    merken: [...merken].sort(nl),
    categorieen: [...categorieen].sort(nl),
    leveranciers,
    locaties: [...locaties].sort(nl),
    instellingenKlaar: nieuw,
    mutatiesKlaar,
  };
}

/* ------------------------------------------------------------ filteren */

export const GROEPERINGEN = ['geen', 'merk', 'categorie', 'leverancier'] as const;
export type Groepering = (typeof GROEPERINGEN)[number];
export const SORTEERKOLOMMEN = ['product', 'maat', 'voorraad', 'gereserveerd', 'beschikbaar', 'minimum', 'waarde', 'status'] as const;

export type VoorraadFilter = {
  q?: string;
  merk?: string;
  categorie?: string;
  leverancier?: string;
  status?: string;
  metVoorraad?: boolean;
  /** 'ja' = alleen voorraadartikelen (standaard), 'alle', 'nee'. */
  bijhouden?: string;
  groep?: Groepering;
  sort?: string;
  dir?: 'asc' | 'desc';
};

const STATUS_VOLGORDE: Record<VoorraadStatus, number> = { op: 0, laag: 1, ok: 2, niet: 3 };

/** Maatvolgorde zoals in de winkel: XS < S < M < L < XL < 2XL, getallen numeriek. */
const MAATRANG = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'];
export function maatSleutel(maat: string | null): string {
  const m = (maat ?? '').trim().toUpperCase();
  const i = MAATRANG.indexOf(m);
  if (i >= 0) return `a${String(i).padStart(3, '0')}`;
  const n = parseFloat(m.replace(',', '.'));
  if (Number.isFinite(n)) return `b${String(Math.round(n * 10)).padStart(6, '0')}`;
  return `c${m}`;
}

export function groepSleutel(r: VoorraadRij, groep: Groepering): string {
  if (groep === 'merk') return r.merk || 'Geen merk';
  if (groep === 'categorie') return r.categorie || 'Geen categorie';
  if (groep === 'leverancier') return r.leverancier_naam || 'Geen leverancier';
  return '';
}

export function filterVoorraad(rijen: VoorraadRij[], f: VoorraadFilter): VoorraadRij[] {
  const woorden = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const bijhouden = f.bijhouden === 'alle' || f.bijhouden === 'nee' ? f.bijhouden : 'ja';
  return rijen.filter((r) => {
    if (bijhouden === 'ja' && !r.bijhouden) return false;
    if (bijhouden === 'nee' && r.bijhouden) return false;
    if (f.merk && (r.merk ?? '') !== f.merk) return false;
    if (f.categorie && (r.categorie ?? '') !== f.categorie) return false;
    if (f.leverancier && (r.leverancier_id ?? '') !== f.leverancier) return false;
    if (f.metVoorraad && r.voorraad <= 0) return false;
    if (f.status) {
      if (f.status === 'onder_minimum') {
        if (!(r.status === 'laag' || (r.status === 'op' && r.min_voorraad != null))) return false;
      } else if (f.status === 'niet_lopend') {
        if (!r.nietLopend) return false;
      } else if (f.status === 'gereserveerd') {
        if (r.gereserveerd <= 0) return false;
      } else if (r.status !== f.status) return false;
    }
    if (woorden.length) {
      const hooi = [r.product_naam, r.merk, r.kleur, r.maat, r.categorie, r.locatie].join(' ').toLowerCase();
      if (!woorden.every((w) => hooi.includes(w))) return false;
    }
    return true;
  });
}

export function sorteerVoorraad(rijen: VoorraadRij[], f: VoorraadFilter): VoorraadRij[] {
  const groep = f.groep ?? 'geen';
  const dir = f.dir === 'desc' ? -1 : 1;
  const sort = f.sort ?? 'product';
  const nl = (a: string, b: string) => a.localeCompare(b, 'nl');
  const basis = (a: VoorraadRij, b: VoorraadRij) =>
    nl(a.product_naam, b.product_naam) || nl(a.kleur ?? '', b.kleur ?? '') || maatSleutel(a.maat).localeCompare(maatSleutel(b.maat));
  const kolom = (a: VoorraadRij, b: VoorraadRij): number => {
    switch (sort) {
      case 'maat': return nl(a.kleur ?? '', b.kleur ?? '') || maatSleutel(a.maat).localeCompare(maatSleutel(b.maat));
      case 'voorraad': return a.voorraad - b.voorraad;
      case 'gereserveerd': return a.gereserveerd - b.gereserveerd;
      case 'beschikbaar': return a.beschikbaar - b.beschikbaar;
      case 'minimum': return (a.min_voorraad ?? -1) - (b.min_voorraad ?? -1);
      case 'waarde': return a.inkoopwaarde - b.inkoopwaarde;
      case 'status': return STATUS_VOLGORDE[a.status] - STATUS_VOLGORDE[b.status];
      default: return 0;
    }
  };
  return [...rijen].sort((a, b) => {
    if (groep !== 'geen') {
      const g = nl(groepSleutel(a, groep), groepSleutel(b, groep));
      if (g !== 0) return g;
    }
    return kolom(a, b) * dir || basis(a, b) * (sort === 'product' ? dir : 1);
  });
}

/* ------------------------------------------------------------ mutaties */

export type Mutatie = {
  id: string;
  veld: string;
  soort: string;
  oud: number | null;
  nieuw: number | null;
  verschil: number | null;
  notitie: string | null;
  actor: string | null;
  created_at: string;
};

export async function mutatiesVoorVariant(variantId: string, limiet = 40): Promise<{ mutaties: Mutatie[]; klaar: boolean }> {
  const sb = kmsAdmin();
  if (!sb || !variantId) return { mutaties: [], klaar: false };
  const { data, error } = await sb
    .from('voorraad_mutaties')
    .select('id, veld, soort, oud, nieuw, verschil, notitie, actor, created_at')
    .eq('variant_id', variantId)
    .order('created_at', { ascending: false })
    .limit(limiet);
  if (error) return { mutaties: [], klaar: !migratieOntbreekt(error) };
  return { mutaties: (data as Mutatie[]) ?? [], klaar: true };
}

export type WijzigResultaat = {
  ok: boolean;
  oud: number | null;
  nieuw: number | null;
  /** Kon de mutatie in de historie worden vastgelegd? */
  gelogd: boolean;
  fout?: 'migratie' | 'onbekend' | 'niet_gevonden';
};

async function logMutatie(
  sb: SupabaseClient,
  m: { variant_id: string; product_id: string | null; veld: string; soort: string; oud: number | null; nieuw: number | null; notitie?: string | null; inkoopregel_id?: string | null; actor?: string | null },
): Promise<boolean> {
  const verschil = m.oud === null || m.nieuw === null ? null : m.nieuw - m.oud;
  const { error } = await sb.from('voorraad_mutaties').insert({ ...m, verschil });
  return !error;
}

/**
 * Zet voorraad of minimum van één variant op een nieuwe waarde en legt de
 * wijziging vast met reden. Wie een aantal of minimum invult bij een artikel
 * dat nog niet als voorraadartikel staat, bedoelt dat het er een is: dan zetten
 * we die vlag ook meteen op de variant.
 */
export async function wijzigVariant(
  variantId: string,
  veld: 'voorraad' | 'min_voorraad',
  waarde: number | null,
  soort: string,
  opties: { notitie?: string | null; actor?: string | null; inkoopregelId?: string | null } = {},
): Promise<WijzigResultaat> {
  const sb = kmsAdmin();
  if (!sb || !variantId) return { ok: false, oud: null, nieuw: null, gelogd: false, fout: 'onbekend' };

  const kolommen = veld === 'min_voorraad' ? 'id, product_id, min_voorraad, voorraad_bijhouden' : 'id, product_id, voorraad';
  const { data, error } = await sb.from('product_varianten').select(kolommen).eq('id', variantId).maybeSingle();
  if (error && migratieOntbreekt(error)) return { ok: false, oud: null, nieuw: null, gelogd: false, fout: 'migratie' };
  const huidig = data as { product_id: string | null; voorraad?: number | null; min_voorraad?: number | null; voorraad_bijhouden?: boolean | null } | null;
  if (!huidig) return { ok: false, oud: null, nieuw: null, gelogd: false, fout: 'niet_gevonden' };

  const oud = veld === 'voorraad' ? Number(huidig.voorraad) || 0 : huidig.min_voorraad ?? null;
  const nieuw = veld === 'voorraad' ? Math.max(0, Math.round(waarde ?? 0)) : waarde === null ? null : Math.max(0, Math.round(waarde));

  const { error: updFout } = await sb.from('product_varianten').update({ [veld]: nieuw }).eq('id', variantId);
  if (updFout) return { ok: false, oud, nieuw, gelogd: false, fout: migratieOntbreekt(updFout) ? 'migratie' : 'onbekend' };

  if ((nieuw ?? 0) > 0) {
    // Stil: zonder migratie bestaat de kolom niet, en dan telt voorraad > 0 al als voorraadartikel.
    await sb.from('product_varianten').update({ voorraad_bijhouden: true }).eq('id', variantId).is('voorraad_bijhouden', null);
  }

  const gelogd = await logMutatie(sb, {
    variant_id: variantId,
    product_id: huidig.product_id,
    veld,
    soort: veld === 'min_voorraad' ? 'instelling' : soort,
    oud,
    nieuw,
    notitie: opties.notitie ?? null,
    inkoopregel_id: opties.inkoopregelId ?? null,
    actor: opties.actor ?? null,
  });
  return { ok: true, oud, nieuw, gelogd };
}

/**
 * Telt een aantal op bij de voorraad (ontvangst, retour). Leest eerst de
 * huidige stand, zodat de historie oud en nieuw goed heeft.
 */
export async function verhoogVoorraad(
  variantId: string,
  erbij: number,
  soort: string,
  opties: { notitie?: string | null; actor?: string | null; inkoopregelId?: string | null } = {},
): Promise<WijzigResultaat> {
  const sb = kmsAdmin();
  if (!sb || !variantId) return { ok: false, oud: null, nieuw: null, gelogd: false, fout: 'onbekend' };
  const { data } = await sb.from('product_varianten').select('voorraad').eq('id', variantId).maybeSingle();
  if (!data) return { ok: false, oud: null, nieuw: null, gelogd: false, fout: 'niet_gevonden' };
  const oud = Number((data as { voorraad: number | null }).voorraad) || 0;
  return wijzigVariant(variantId, 'voorraad', oud + erbij, soort, opties);
}

/** Verwerkt een telling: alleen ingevulde regels, ook als het getal gelijk blijft (dan weet je dat het geteld is). */
export async function verwerkTelling(
  tellingen: { variantId: string; geteld: number }[],
  opties: { notitie?: string | null; actor?: string | null } = {},
): Promise<{ geteld: number; gewijzigd: number; mislukt: number }> {
  let gewijzigd = 0;
  let mislukt = 0;
  for (let i = 0; i < tellingen.length; i += 8) {
    const blok = tellingen.slice(i, i + 8);
    const uitkomsten = await Promise.all(
      blok.map((t) => wijzigVariant(t.variantId, 'voorraad', t.geteld, 'telling', opties)),
    );
    for (const u of uitkomsten) {
      if (!u.ok) mislukt += 1;
      else if (u.oud !== u.nieuw) gewijzigd += 1;
    }
  }
  return { geteld: tellingen.length - mislukt, gewijzigd, mislukt };
}

/**
 * Voorraadartikel ja/nee. Op productniveau: de vlag op het product en de
 * eigen instelling van de varianten wissen, zodat ze het product volgen.
 */
export async function zetVoorraadBijhouden(
  variantIds: string[],
  waarde: boolean,
  niveau: 'variant' | 'product',
): Promise<{ ok: boolean; aantal: number; fout?: 'migratie' }> {
  const sb = kmsAdmin();
  const ids = [...new Set(variantIds.filter(Boolean))];
  if (!sb || ids.length === 0) return { ok: false, aantal: 0 };

  if (niveau === 'variant') {
    let aantal = 0;
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error } = await sb.from('product_varianten').update({ voorraad_bijhouden: waarde }).in('id', ids.slice(i, i + 150)).select('id');
      if (error) return { ok: false, aantal, fout: migratieOntbreekt(error) ? 'migratie' : undefined };
      aantal += ((data as unknown[]) ?? []).length;
    }
    return { ok: true, aantal };
  }

  const varianten = await inStukken<{ product_id: string }>(ids, (stuk) => sb.from('product_varianten').select('product_id').in('id', stuk));
  const productIds = [...new Set(varianten.map((v) => v.product_id).filter(Boolean))];
  let aantal = 0;
  for (let i = 0; i < productIds.length; i += 150) {
    const stuk = productIds.slice(i, i + 150);
    const { data, error } = await sb.from('producten').update({ voorraad_bijhouden: waarde }).in('id', stuk).select('id');
    if (error) return { ok: false, aantal, fout: migratieOntbreekt(error) ? 'migratie' : undefined };
    aantal += ((data as unknown[]) ?? []).length;
    await sb.from('product_varianten').update({ voorraad_bijhouden: null }).in('product_id', stuk);
  }
  return { ok: true, aantal };
}

/** Locatie (schap/magazijn) van een variant, voor de telling per locatie. */
export async function zetLocatie(variantId: string, locatie: string | null): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !variantId) return false;
  const { error } = await sb.from('product_varianten').update({ locatie: (locatie ?? '').trim() || null }).eq('id', variantId);
  return !error;
}
