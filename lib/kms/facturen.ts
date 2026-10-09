import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { zoekWoorden, klantIdsVoorZoekterm } from '@/lib/kms/zoeken';
import { isEmailConfigured, env } from '@/lib/env';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { factuurMailHtml } from '@/lib/documentMail';
import { factuurEmailVoor, type FactuurEmailBron } from '@/lib/kms/factuurEmail';
import { artikelOmschrijving } from '@/lib/kms/productZoeker';
import { bedrijf } from '@/content/bedrijf';
import { eisData } from '@/lib/dbFout';

/**
 * Data-access voor de module Facturatie (zelf gebouwd, geen externe boekhouding).
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export const FACTUUR_STATUSSEN = ['concept', 'verzonden', 'betaald'] as const;
export type FactuurStatus = (typeof FACTUUR_STATUSSEN)[number];

export type Factuur = {
  id: string;
  factuurnummer: string | null;
  organisatie_id: string;
  order_id: string | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  bedrag_excl: number | null;
  btw_bedrag: number | null;
  bedrag_incl: number | null;
  status: string;
  factuur_email: string | null;
  betaaldatum: string | null;
  toegepaste_prijsafspraken: string | null;
  gemaild_op: string | null;
  created_at: string;
  /** Koppeling met de boekhouding (migratie 20261005_boekhouding_koppeling.sql); zie lib/kms/boekhouding.ts. */
  moneybird_factuur_id?: string | null;
  moneybird_status?: string | null;
  moneybird_gesynct_op?: string | null;
  moneybird_totaal?: number | null;
  boekhouding_fout?: string | null;
  boekhouding_status?: string | null;
};

export type Factuurregel = {
  id: string;
  factuur_id: string;
  omschrijving: string;
  aantal: number;
  stukprijs: number;
  btw_pct: number;
  bedrag: number;
  /**
   * Kolommen uit migratie 20261003_factuurregels.sql. Zolang die niet gedraaid
   * is ontbreken ze (undefined); de code werkt dan zoals voorheen.
   */
  korting_pct?: number | null;
  product_id?: string | null;
  kleur?: string | null;
  maat?: string | null;
  positie?: number | null;
  created_at?: string | null;
  /** Artikelfoto in de gekozen kleur; niet in de tabel, bijgezocht door getFactuur. */
  afbeelding?: string | null;
};

export type Organisatie = {
  id: string;
  naam: string;
  factuur_email: string | null;
  btw_nummer: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  klantnummer: string | null;
};

export type FactuurMetKlant = Factuur & { organisatie_naam: string | null };
export type FactuurDetail = Factuur & { regels: Factuurregel[]; organisatie: Organisatie | null };

/** De facturen die bij een order horen (voor de koppeling order <-> factuur). */
export async function facturenVoorOrder(orderId: string): Promise<{ id: string; factuurnummer: string | null; status: string; bedrag_incl: number | null }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('facturen')
    .select('id, factuurnummer, status, bedrag_incl')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  return (data as { id: string; factuurnummer: string | null; status: string; bedrag_incl: number | null }[]) ?? [];
}

export type FactuurregelVelden = {
  omschrijving: string;
  aantal?: number;
  stukprijs?: number;
  btw_pct?: number;
  korting_pct?: number;
  /** Alleen bij een artikelregel; een vrije regel laat ze weg. */
  product_id?: string | null;
  kleur?: string | null;
  /** undefined = niet wijzigen; null of '' = wissen. */
  maat?: string | null;
};

const ORG_SELECT = 'id, naam, factuur_email, btw_nummer, adres, postcode, plaats, klantnummer';
const TIJDZONE = 'Europe/Amsterdam';
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Vandaag als JJJJ-MM-DD in Nederlandse tijd (niet UTC: tussen 0 en 2 uur 's nachts scheelt dat een dag). */
function vandaagISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIJDZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Datum (JJJJ-MM-DD) plus een aantal dagen, zonder tijdzone-verschuiving. */
function plusDagen(datum: string | null, dagen: number): string {
  const basis = datum && /^\d{4}-\d{2}-\d{2}/.test(datum) ? datum.slice(0, 10) : vandaagISO();
  const d = new Date(`${basis}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

/** Vervaldatum die bij een factuurdatum hoort: factuurdatum plus de betaaltermijn uit content/bedrijf.ts. */
export function vervaldatumVoor(factuurdatum: string | null): string {
  return plusDagen(factuurdatum, bedrijf.betaaltermijnDagen);
}

/**
 * Btw-tarief van een regel; zonder (geldig) tarief 21%. Let op: Number(null) is 0,
 * dus een lege waarde moet apart worden afgevangen, anders werd het stil 0% btw.
 */
export function btwTarief(pct: number | string | null | undefined): number {
  if (pct === null || pct === undefined || pct === '') return 21;
  const n = Number(pct);
  return Number.isFinite(n) ? n : 21;
}

/** Bedrag excl. btw van één regel: aantal x stukprijs min de regelkorting, op centen. */
export function regelBedrag(r: { aantal: number | null; stukprijs: number | null; korting_pct?: number | null }): number {
  const aantal = Number(r.aantal) || 0;
  const stuk = Number(r.stukprijs) || 0;
  const kort = Math.min(100, Math.max(0, Number(r.korting_pct) || 0));
  return r2(aantal * stuk * (1 - kort / 100));
}

export type FactuurTotalen = {
  /** Subtotaal excl. btw, na regelkorting. */
  excl: number;
  /** Totale korting (bruto min netto), voor de weergave. */
  korting: number;
  btw: number;
  incl: number;
  /** Btw per tarief, oplopend: grondslag en btw-bedrag. */
  perTarief: { pct: number; grondslag: number; btw: number }[];
};

/**
 * Totalen van een factuur. Btw wordt per tarief over de som van de regels
 * berekend en dan afgerond (zoals de Belastingdienst het wil), niet per regel.
 */
export function factuurTotalen(
  regels: { aantal: number | null; stukprijs: number | null; korting_pct?: number | null; btw_pct: number | null }[],
): FactuurTotalen {
  let bruto = 0;
  let excl = 0;
  const tarieven = new Map<number, number>();
  for (const r of regels) {
    const bedrag = regelBedrag(r);
    bruto += r2((Number(r.aantal) || 0) * (Number(r.stukprijs) || 0));
    excl += bedrag;
    const pct = btwTarief(r.btw_pct);
    tarieven.set(pct, (tarieven.get(pct) ?? 0) + bedrag);
  }
  const perTarief = [...tarieven.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pct, grondslag]) => ({ pct, grondslag: r2(grondslag), btw: r2((grondslag * pct) / 100) }));
  const btw = r2(perTarief.reduce((t, x) => t + x.btw, 0));
  excl = r2(excl);
  return { excl, korting: r2(bruto - excl), btw, incl: r2(excl + btw), perTarief };
}

async function volgendFactuurnummer(sb: SupabaseClient): Promise<string> {
  const jaar = vandaagISO().slice(0, 4);
  const prefix = `FR-${jaar}-`;
  const { data } = await sb
    .from('facturen')
    .select('factuurnummer')
    .like('factuurnummer', `${prefix}%`)
    .order('factuurnummer', { ascending: false })
    .limit(1);
  const laatste = (data as { factuurnummer: string | null }[] | null)?.[0]?.factuurnummer ?? null;
  let volgnr = 1;
  if (laatste) {
    const staart = Number(laatste.slice(prefix.length));
    if (Number.isFinite(staart)) volgnr = staart + 1;
  }
  return `${prefix}${String(volgnr).padStart(4, '0')}`;
}

/** Fout van PostgREST/Postgres omdat een kolom (nog) niet bestaat: migratie niet gedraaid. */
function kolomOntbreekt(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /column .* (does not exist|not find)/i.test(error.message ?? '');
}

const EXTRA_KOLOMMEN = ['korting_pct', 'product_id', 'kleur', 'maat', 'positie'] as const;

/**
 * Zonder de nieuwe kolommen: korting gaat in de stukprijs (nettoprijs), zodat het
 * bedrag en de totalen kloppen, en artikel/kleur/maat staan al in de omschrijving.
 */
function zonderExtraKolommen(rij: Record<string, unknown>): Record<string, unknown> {
  const uit: Record<string, unknown> = { ...rij };
  const kort = Number(rij.korting_pct) || 0;
  if (kort && rij.stukprijs !== undefined) {
    uit.stukprijs = r2((Number(rij.stukprijs) || 0) * (1 - kort / 100));
  }
  for (const k of EXTRA_KOLOMMEN) delete uit[k];
  return uit;
}

async function voegRegelsIn(sb: SupabaseClient, rijen: Record<string, unknown>[]): Promise<boolean> {
  if (rijen.length === 0) return true;
  const { error } = await sb.from('factuurregels').insert(rijen);
  if (!error) return true;
  if (!kolomOntbreekt(error)) return false;
  const { error: fout2 } = await sb.from('factuurregels').insert(rijen.map(zonderExtraKolommen));
  return !fout2;
}

async function volgendePositie(sb: SupabaseClient, factuurId: string): Promise<number> {
  const { data, error } = await sb.from('factuurregels').select('positie').eq('factuur_id', factuurId);
  if (error) return 1;
  const rijen = (data as { positie: number | null }[]) ?? [];
  const hoogste = rijen.reduce((m, r) => (r.positie != null && r.positie > m ? r.positie : m), 0);
  return Math.max(hoogste, rijen.length) + 1;
}

export async function listFacturen(statusFilter?: string): Promise<FactuurMetKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb
    .from('facturen')
    .select('*, organisaties(naam)')
    .order('created_at', { ascending: false });
  if (statusFilter && statusFilter.trim()) q = q.eq('status', statusFilter.trim());
  const { data } = await q;
  const rows = (data as unknown as (Factuur & { organisaties: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { organisaties, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null } as FactuurMetKlant;
  });
}

/** Toegestane sorteerkolommen: echte DB-kolommen die deze query selecteert. */
const FACTUUR_SORTKOLOMMEN = ['factuurnummer', 'factuurdatum', 'vervaldatum', 'bedrag_incl', 'status', 'created_at'] as const;

/** Extra filters op de facturenlijst (FilterBalk). Alles optioneel. */
export type FactuurLijstFilters = {
  /** organisatie_id */
  klant?: string | null;
  /** Factuurdatum vanaf (inclusief), ISO-datum. */
  van?: string | null;
  /** Factuurdatum tot (exclusief), ISO-datum. */
  totExclusief?: string | null;
  /** Vervaldatum voorbij en nog niet betaald. */
  vervallen?: boolean;
  bedragMin?: number | null;
  bedragMax?: number | null;
  /** Wel of niet naar de boekhouder gemaild. */
  gemaild?: 'ja' | 'nee' | null;
  /** Boekhoudstatus: in Moneybird, nog niet doorgezet (alleen definitieve facturen) of fout. */
  boekhouding?: 'doorgezet' | 'niet' | 'fout' | null;
};

/** Eén pagina facturen (standaard nieuwste eerst) met optioneel statusfilter, plus het totaal aantal rijen voor paginering. */
export async function listFacturenPaged(opts: { pagina: number; perPagina: number; status?: string; zoek?: string; sort?: string; dir?: 'asc' | 'desc'; filters?: FactuurLijstFilters }): Promise<{ rijen: FactuurMetKlant[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  const kolom = (FACTUUR_SORTKOLOMMEN as readonly string[]).includes(opts.sort ?? '') ? (opts.sort as string) : 'created_at';
  const oplopend = opts.dir === 'asc';
  let q = sb
    .from('facturen')
    .select('*, organisaties(naam)', { count: 'exact' })
    .order(kolom, { ascending: oplopend });
  if (opts.status && opts.status.trim()) q = q.eq('status', opts.status.trim());
  const f = opts.filters ?? {};
  if (f.klant) q = q.eq('organisatie_id', f.klant);
  if (f.van) q = q.gte('factuurdatum', f.van);
  if (f.totExclusief) q = q.lt('factuurdatum', f.totExclusief);
  if (f.vervallen) q = q.lt('vervaldatum', new Date().toISOString().slice(0, 10)).neq('status', 'betaald');
  if (f.bedragMin != null) q = q.gte('bedrag_incl', f.bedragMin);
  if (f.bedragMax != null) q = q.lte('bedrag_incl', f.bedragMax);
  if (f.gemaild === 'ja') q = q.not('gemaild_op', 'is', null);
  if (f.gemaild === 'nee') q = q.is('gemaild_op', null);
  if (f.boekhouding === 'doorgezet') q = q.not('moneybird_factuur_id', 'is', null);
  if (f.boekhouding === 'fout') q = q.eq('boekhouding_status', 'fout');
  if (f.boekhouding === 'niet') q = q.is('moneybird_factuur_id', null).neq('status', 'concept');
  // Zoeken op klant (naam, plaats, klantnummer, contactpersoon; elk woord moet
  // passen) of op factuurnummer. De klant zit in een join, en PostgREST kan daar
  // niet zonder meer op filteren; daarom eerst de klant-ids.
  const woorden = zoekWoorden(opts.zoek);
  if (woorden.length) {
    const term = woorden.join(' ');
    const orgIds = await klantIdsVoorZoekterm(sb, woorden, 150);
    const delen: string[] = [`factuurnummer.ilike.%${term}%`];
    if (orgIds.length) delen.push(`organisatie_id.in.(${orgIds.join(',')})`);
    q = q.or(delen.join(','));
  }

  const res = await q.range(from, to);
  const data = eisData('facturen.lijst', res);
  const count = res.count;
  const rows = (data as unknown as (Factuur & { organisaties: { naam: string } | null })[]) ?? [];
  const rijen = rows.map((r) => {
    const { organisaties, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null } as FactuurMetKlant;
  });
  return { rijen, totaal: count ?? 0 };
}

/** Regels van een factuur in de volgorde waarin ze zijn toegevoegd. */
async function regelsVan(sb: SupabaseClient, factuurId: string): Promise<Factuurregel[]> {
  // Volgorde op positie en aanmaakmoment. Bestaan die kolommen nog niet (migratie
  // niet gedraaid), dan zonder; een volgorde op id alleen is willekeurig (uuid).
  const metVolgorde = await sb
    .from('factuurregels')
    .select('*')
    .eq('factuur_id', factuurId)
    .order('positie', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .order('id');
  if (!metVolgorde.error) return (metVolgorde.data as Factuurregel[]) ?? [];
  // Zonder regels zou een factuur (of UBL, of Moneybird) stil op 0 euro uitkomen: fout tonen.
  const data = eisData('facturen.regels', await sb.from('factuurregels').select('*').eq('factuur_id', factuurId).order('id'));
  return (data as Factuurregel[]) ?? [];
}

/** Artikelfoto per regel: kleurfoto, anders de eerste foto van het artikel. */
async function voegFotosToe(sb: SupabaseClient, regels: Factuurregel[]): Promise<Factuurregel[]> {
  const ids = [...new Set(regels.map((r) => r.product_id).filter((x): x is string => !!x))];
  if (ids.length === 0) return regels;
  const [{ data: prodData }, { data: fotoData }] = await Promise.all([
    sb.from('producten').select('id, afbeeldingen').in('id', ids),
    sb.from('product_kleur_afbeeldingen').select('product_id, kleur, afbeelding_url').in('product_id', ids).limit(1000),
  ]);
  const hoofd = new Map<string, string>();
  for (const p of (prodData as { id: string; afbeeldingen: string[] | null }[]) ?? []) {
    const f = (p.afbeeldingen ?? [])[0];
    if (f) hoofd.set(p.id, f);
  }
  const kleurFoto = new Map<string, string>();
  for (const k of (fotoData as { product_id: string; kleur: string | null; afbeelding_url: string | null }[]) ?? []) {
    if (k.afbeelding_url) kleurFoto.set(`${k.product_id}|${(k.kleur ?? '').trim().toLowerCase()}`, k.afbeelding_url);
  }
  return regels.map((r) =>
    r.product_id
      ? { ...r, afbeelding: kleurFoto.get(`${r.product_id}|${(r.kleur ?? '').trim().toLowerCase()}`) ?? hoofd.get(r.product_id) ?? null }
      : r,
  );
}

export async function getFactuur(id: string): Promise<FactuurDetail | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const data = eisData('facturen.detail', await sb.from('facturen').select('*').eq('id', id).maybeSingle());
  if (!data) return null;
  const factuur = data as Factuur;
  const [regels, { data: orgData }] = await Promise.all([
    regelsVan(sb, id).then((rs) => voegFotosToe(sb, rs)),
    sb.from('organisaties').select(ORG_SELECT).eq('id', factuur.organisatie_id).maybeSingle(),
  ]);
  return {
    ...factuur,
    regels,
    organisatie: (orgData as Organisatie | null) ?? null,
  };
}

/** Kortingspercentage van de klant (organisaties.korting_pct, o.a. voor de webshop); null als er geen is. */
export async function klantKortingPct(organisatieId: string): Promise<number | null> {
  const sb = kmsAdmin(); if (!sb || !organisatieId) return null;
  const { data, error } = await sb.from('organisaties').select('korting_pct').eq('id', organisatieId).maybeSingle();
  if (error) return null;
  const pct = Number((data as { korting_pct: number | null } | null)?.korting_pct);
  return Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : null;
}

export async function maakLegeFactuur(organisatieId: string): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  // Adres van het facturatiecontact van de klant (met terugval, zie factuurEmailVoor).
  const factuurEmail = (await factuurEmailVoor(organisatieId))?.email ?? null;
  const factuurnummer = await volgendFactuurnummer(sb);
  const { data, error } = await sb
    .from('facturen')
    .insert({
      factuurnummer,
      organisatie_id: organisatieId,
      factuurdatum: vandaagISO(),
      status: 'concept',
      factuur_email: factuurEmail,
      bedrag_excl: 0,
      btw_bedrag: 0,
      bedrag_incl: 0,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

type OrderregelRij = {
  item_naam: string | null;
  product_id: string | null;
  variant_id: string | null;
  maat: string | null;
  kleur: string | null;
  lengte: number | null;
  aantal: number | null;
  stukprijs: number | null;
};

/**
 * Maakt een conceptfactuur van een order en neemt alle orderregels over:
 * artikel, kleur, maat (en lengte) en de stukprijs van de order. Staat er op een
 * orderregel geen prijs, dan nemen we de verkoopprijs van de variant (plus
 * meerprijs) of anders de basisprijs van het artikel, zodat er geen regels van
 * nul euro op de factuur komen. Btw volgt het tarief van het artikel (standaard 21%).
 */
export async function maakFactuurVanOrder(orderId: string): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data: orderData } = await sb
    .from('orders')
    .select('id, organisatie_id, ordernummer, status, bedrag, notitie')
    .eq('id', orderId)
    .maybeSingle();
  const order = orderData as {
    id: string;
    organisatie_id: string;
    ordernummer: number | null;
    status: string | null;
    bedrag: number | null;
    notitie: string | null;
  } | null;
  if (!order) return null;
  // Een geannuleerde order factureer je niet.
  if (order.status === 'geannuleerd') return null;
  // Al een factuur voor deze order (dubbele klik, of "Factureer alle" naast een
  // losse factuur): die teruggeven in plaats van een tweede factuurnummer te verbruiken.
  const { data: alData } = await sb.from('facturen').select('id').eq('order_id', orderId).order('created_at').limit(1);
  const al = ((alData as { id: string }[]) ?? [])[0];
  if (al) return al.id;
  // Btw-tarief van de offerte waar de order uit komt (bijv. 0% bij een buitenlandse klant).
  const offerteBtw = await btwVanOfferteVoorOrder(sb, orderId);

  const [{ data: regelData }, gevonden] = await Promise.all([
    sb
      .from('orderregels')
      .select('item_naam, product_id, variant_id, maat, kleur, lengte, aantal, stukprijs')
      .eq('order_id', orderId)
      .order('created_at')
      .limit(1000),
    factuurEmailVoor(order.organisatie_id),
  ]);
  const orderregels = (regelData as OrderregelRij[]) ?? [];
  // Zonder regels wordt het een factuur van nul euro die wel een nummer opmaakt.
  if (orderregels.length === 0) return null;
  // Adres van het facturatiecontact van de klant (met terugval, zie factuurEmailVoor).
  const factuurEmail = gevonden?.email ?? null;

  // Ontbrekende prijzen en btw-tarieven opzoeken bij variant en artikel.
  const productIds = [...new Set(orderregels.map((r) => r.product_id).filter((x): x is string => !!x))];
  const variantIds = [...new Set(orderregels.filter((r) => r.stukprijs == null && r.variant_id).map((r) => r.variant_id as string))];
  const [prodRes, varRes] = await Promise.all([
    productIds.length
      ? sb.from('producten').select('id, naam, merk, btw, verkoopprijs_basis').in('id', productIds)
      : Promise.resolve({ data: [] as unknown[] }),
    variantIds.length
      ? sb.from('product_varianten').select('id, verkoopprijs, meerprijs').in('id', variantIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const producten = new Map<string, { naam: string | null; merk: string | null; btw: number | null; verkoopprijs_basis: number | null }>();
  for (const p of (prodRes.data as { id: string; naam: string | null; merk: string | null; btw: number | null; verkoopprijs_basis: number | null }[]) ?? []) {
    producten.set(p.id, p);
  }
  const varPrijs = new Map<string, number>();
  for (const v of (varRes.data as { id: string; verkoopprijs: number | null; meerprijs: number | null }[]) ?? []) {
    if (v.verkoopprijs != null) varPrijs.set(v.id, r2((Number(v.verkoopprijs) || 0) + (Number(v.meerprijs) || 0)));
  }

  const factuurnummer = await volgendFactuurnummer(sb);
  const { data: factuurData, error } = await sb
    .from('facturen')
    .insert({
      factuurnummer,
      organisatie_id: order.organisatie_id,
      order_id: orderId,
      factuurdatum: vandaagISO(),
      status: 'concept',
      factuur_email: factuurEmail,
      bedrag_excl: 0,
      btw_bedrag: 0,
      bedrag_incl: 0,
    })
    .select('id')
    .single();
  if (error || !factuurData) return null;
  const factuurId = (factuurData as { id: string }).id;

  const rijen = orderregels.map((r, i) => {
    const aantal = Number(r.aantal) || 0;
    const prod = r.product_id ? producten.get(r.product_id) ?? null : null;
    let stukprijs = r.stukprijs != null ? Number(r.stukprijs) || 0 : null;
    if (stukprijs == null && r.variant_id) stukprijs = varPrijs.get(r.variant_id) ?? null;
    if (stukprijs == null && prod?.verkoopprijs_basis != null) stukprijs = Number(prod.verkoopprijs_basis) || 0;
    stukprijs = stukprijs ?? 0;
    const kleur = r.kleur?.trim() || null;
    const maat = r.maat?.trim() || null;
    const naam = (r.item_naam ?? '').trim() || prod?.naam || 'Regel';
    // Kleur en maat staan soms al in de itemnaam (oudere orders); dan niet dubbel.
    const laag = naam.toLowerCase();
    const kleurErbij = kleur && !laag.includes(kleur.toLowerCase()) ? kleur : null;
    const maatErbij = maat && !laag.includes(`maat ${maat.toLowerCase()}`) ? maat : null;
    let omschrijving = artikelOmschrijving({ naam, merk: null }, kleurErbij, maatErbij);
    if (r.lengte != null && Number(r.lengte) > 0) omschrijving += `, lengte ${r.lengte} cm`;
    const btwPct = offerteBtw ?? (prod?.btw != null && Number.isFinite(Number(prod.btw)) ? Number(prod.btw) : 21);
    const rij: Record<string, unknown> = {
      factuur_id: factuurId,
      omschrijving,
      aantal,
      stukprijs,
      btw_pct: btwPct,
      korting_pct: 0,
      bedrag: regelBedrag({ aantal, stukprijs }),
      positie: i + 1,
    };
    if (r.product_id) rij.product_id = r.product_id;
    if (kleur) rij.kleur = kleur;
    if (maat) rij.maat = maat;
    return rij;
  });
  // Pakketbestelling: de artikelen staan op nul en de pakketprijs alleen op de
  // order. Zonder deze regel werd het een factuur van nul euro.
  const regelTotaal = rijen.reduce((t, r) => t + (Number(r.bedrag) || 0), 0);
  const orderBedrag = r2(Number(order.bedrag) || 0);
  if (regelTotaal === 0 && orderBedrag > 0) {
    rijen.push({
      factuur_id: factuurId,
      // "(buiten budget)" is een interne markering voor het portaalbudget, niet voor de klant.
      omschrijving: (order.notitie?.trim().startsWith('Pakket:')
        ? order.notitie.trim().replace(/\s*\(buiten budget\)/, '').split(' · ')[0]
        : `Pakketprijs order${order.ordernummer != null ? ` #${order.ordernummer}` : ''}`
      ).slice(0, 200),
      aantal: 1,
      stukprijs: orderBedrag,
      btw_pct: offerteBtw ?? 21,
      korting_pct: 0,
      bedrag: orderBedrag,
      positie: rijen.length + 1,
    });
  }
  if (!(await voegRegelsIn(sb, rijen))) {
    // Geen halve factuur laten staan: zonder regels is hij niets waard.
    await sb.from('facturen').delete().eq('id', factuurId);
    return null;
  }
  await herberekenFactuur(factuurId);
  return factuurId;
}

/**
 * Btw van de offerte achter een order, als die afwijkt van het standaardtarief
 * van de artikelen. Null als de order niet uit een offerte komt (of de kolom
 * offerte_id nog niet bestaat): dan volgt de btw het artikel.
 */
async function btwVanOfferteVoorOrder(sb: SupabaseClient, orderId: string): Promise<number | null> {
  const { data, error } = await sb.from('orders').select('offerte_id').eq('id', orderId).maybeSingle();
  const offerteId = error ? null : (data as { offerte_id: string | null } | null)?.offerte_id ?? null;
  if (!offerteId) return null;
  const { data: off } = await sb.from('offertes').select('btw_pct').eq('id', offerteId).maybeSingle();
  const pct = Number((off as { btw_pct: number | null } | null)?.btw_pct);
  return Number.isFinite(pct) ? pct : null;
}

/**
 * Reden waarom de regels van een factuur niet meer mogen wijzigen, of null.
 * Een verzonden of betaalde factuur is een boekstuk: corrigeren gaat met een
 * creditfactuur, of eerst terug naar concept (kan niet meer als hij al in
 * Moneybird staat).
 */
export async function factuurRegelsGeslotenReden(factuurId: string): Promise<'verzonden' | 'betaald' | 'boekhouding' | null> {
  const sb = kmsAdmin(); if (!sb || !factuurId) return null;
  const { data } = await sb.from('facturen').select('status, moneybird_factuur_id').eq('id', factuurId).maybeSingle();
  const f = data as { status: string; moneybird_factuur_id: string | null } | null;
  if (!f) return null;
  if (f.moneybird_factuur_id) return 'boekhouding';
  if (f.status === 'betaald') return 'betaald';
  if (f.status === 'verzonden') return 'verzonden';
  return null;
}

export async function voegFactuurregelToe(factuurId: string, v: FactuurregelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const aantal = Number(v.aantal) || 0;
  const stukprijs = Number(v.stukprijs) || 0;
  const korting_pct = Math.min(100, Math.max(0, Number(v.korting_pct) || 0));
  const btw_pct = v.btw_pct == null || !Number.isFinite(Number(v.btw_pct)) ? 21 : Number(v.btw_pct);
  const rij: Record<string, unknown> = {
    factuur_id: factuurId,
    omschrijving: v.omschrijving,
    aantal,
    stukprijs,
    btw_pct,
    korting_pct,
    bedrag: regelBedrag({ aantal, stukprijs, korting_pct }),
    positie: await volgendePositie(sb, factuurId),
  };
  // Alleen meesturen als er echt een artikel gekozen is; een vrije regel laat ze weg.
  if (v.product_id) rij.product_id = v.product_id;
  if (v.kleur && v.kleur.trim()) rij.kleur = v.kleur.trim();
  if (v.maat && v.maat.trim()) rij.maat = v.maat.trim();
  const ok = await voegRegelsIn(sb, [rij]);
  if (!ok) return false;
  await herberekenFactuur(factuurId);
  return true;
}

/** Huidige waarden van een regel (voor het auditlog en om de factuur te vinden). */
export async function getFactuurregel(id: string): Promise<Factuurregel | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('factuurregels').select('*').eq('id', id).maybeSingle();
  return (data as Factuurregel | null) ?? null;
}

export async function werkFactuurregel(id: string, v: FactuurregelVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const huidig = await getFactuurregel(id);
  if (!huidig) return false;
  const aantal = Number(v.aantal) || 0;
  const stukprijs = Number(v.stukprijs) || 0;
  const btw_pct = v.btw_pct == null || !Number.isFinite(Number(v.btw_pct)) ? 21 : Number(v.btw_pct);
  // Korting alleen als de kolom bestaat (dan staat hij in de rij) of als hij is meegegeven.
  const korting_pct = v.korting_pct !== undefined ? Math.min(100, Math.max(0, Number(v.korting_pct) || 0)) : Number(huidig.korting_pct) || 0;
  const patch: Record<string, unknown> = {
    omschrijving: v.omschrijving,
    aantal,
    stukprijs,
    btw_pct,
    bedrag: regelBedrag({ aantal, stukprijs, korting_pct }),
  };
  if (v.korting_pct !== undefined) patch.korting_pct = korting_pct;
  // Maat mag later alsnog ingevuld of gewist worden; artikel en kleur blijven staan.
  if (v.maat !== undefined) patch.maat = v.maat && v.maat.trim() ? v.maat.trim() : null;
  let { error } = await sb.from('factuurregels').update(patch).eq('id', id);
  if (error && kolomOntbreekt(error)) {
    ({ error } = await sb.from('factuurregels').update(zonderExtraKolommen(patch)).eq('id', id));
  }
  if (error) return false;
  await herberekenFactuur(huidig.factuur_id);
  return true;
}

export async function verwijderFactuurregel(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { data } = await sb.from('factuurregels').select('factuur_id').eq('id', id).maybeSingle();
  const factuurId = (data as { factuur_id: string } | null)?.factuur_id ?? null;
  const { error } = await sb.from('factuurregels').delete().eq('id', id);
  if (error) return false;
  if (factuurId) await herberekenFactuur(factuurId);
  return true;
}

/** Zet de bedragen op de factuur gelijk aan de som van de regels (btw per tarief). */
export async function herberekenFactuur(factuurId: string): Promise<void> {
  const sb = kmsAdmin(); if (!sb) return;
  const regels = await regelsVan(sb, factuurId);
  const t = factuurTotalen(regels);
  await sb
    .from('facturen')
    .update({ bedrag_excl: t.excl, btw_bedrag: t.btw, bedrag_incl: t.incl })
    .eq('id', factuurId);
}

/** Orderstatussen van waaruit een betaalde factuur de order afrondt (de afleverfase). */
const AFROND_NA_BETALING: readonly string[] = ['compleet_geleverd', 'verpakken', 'bezorgen', 'verzonden', 'factureren'];

export function isFactuurStatus(s: string): s is FactuurStatus {
  return (FACTUUR_STATUSSEN as readonly string[]).includes(s);
}

/**
 * Zet de status. Verzonden: vervaldatum wordt factuurdatum + betaaltermijn als
 * die nog leeg is. Betaald: betaaldatum vandaag (of de meegegeven datum).
 * Terug naar concept of verzonden: de betaaldatum gaat eraf, anders blijft
 * "Betaald op" staan bij een factuur die niet betaald is.
 */
export async function zetFactuurStatus(id: string, status: string, betaaldatum?: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  if (!isFactuurStatus(status)) return false;
  const { data } = await sb.from('facturen').select('factuurdatum, vervaldatum, betaaldatum, order_id, moneybird_factuur_id').eq('id', id).maybeSingle();
  const huidig = data as { factuurdatum: string | null; vervaldatum: string | null; betaaldatum: string | null; order_id: string | null; moneybird_factuur_id: string | null } | null;
  if (!huidig) return false;
  // Staat hij al in Moneybird, dan kan hij niet meer terug naar concept: dan lopen KMS en boekhouding uit elkaar.
  if (status === 'concept' && huidig.moneybird_factuur_id) return false;
  const patch: Record<string, unknown> = { status };
  if (status === 'betaald') {
    patch.betaaldatum = betaaldatum ?? huidig.betaaldatum ?? vandaagISO();
  } else if (huidig.betaaldatum) {
    patch.betaaldatum = null;
  }
  if (status !== 'concept' && !huidig.vervaldatum) {
    patch.vervaldatum = vervaldatumVoor(huidig.factuurdatum);
  }
  const { error } = await sb.from('facturen').update(patch).eq('id', id);
  if (error) return false;
  // Betaald: de order is klaar. Alleen vanuit de afleverfase, een order die nog
  // in productie staat (vooruitbetaling) laten we staan.
  // Via zetOrderStatusMetGevolgen, zodat de voorraad wordt afgeboekt (één keer) en de
  // besteller zijn statusmail krijgt; een kale update sloeg dat over.
  if (status === 'betaald' && huidig.order_id) {
    const { data: o } = await sb.from('orders').select('status').eq('id', huidig.order_id).maybeSingle();
    const orderStatus = (o as { status: string } | null)?.status ?? '';
    if (AFROND_NA_BETALING.includes(orderStatus)) {
      // Dynamisch geladen: orders.ts en facturen.ts mogen elkaar niet bij het laden nodig hebben.
      const { zetOrderStatusMetGevolgen } = await import('@/lib/kms/orders');
      const uitkomst = await zetOrderStatusMetGevolgen(huidig.order_id, 'afgerond').catch(() => ({ ok: false }));
      if (!uitkomst.ok) console.error('[factuur] betaald, maar de order kon niet worden afgerond:', huidig.order_id);
    }
  }
  return true;
}

export async function listOrganisaties(): Promise<{ id: string; naam: string }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const uit: { id: string; naam: string }[] = [];
  for (let van = 0; van < 50000; van += 1000) {
    const { data, error } = await sb.from('organisaties').select('id, naam').order('naam').order('id').range(van, van + 999);
    if (error) break;
    const rijen = (data as { id: string; naam: string }[]) ?? [];
    uit.push(...rijen);
    if (rijen.length < 1000) break;
  }
  return uit;
}

/** Orderstatussen waarin een order klaar is om te factureren (geleverd of verder). */
export const FACTUREERBARE_ORDERSTATUSSEN: readonly string[] = ['compleet_geleverd', 'verpakken', 'bezorgen', 'verzonden', 'factureren', 'afgerond'];

/**
 * Orders zonder factuur. Concept- en geannuleerde orders en orders zonder bedrag
 * vallen af. `klaar` zegt of de order al geleverd is; alleen die gaan mee met
 * "Factureer alle" (vooraf factureren kan per order).
 */
export async function listFactureerbareOrders(): Promise<{ id: string; ordernummer: number; organisatie_naam: string | null; bedrag: number | null; status: string; klaar: boolean }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  // Beide lijsten in blokken van 1000: Supabase geeft er per verzoek niet meer.
  const metFactuur = new Set<string>();
  for (let van = 0; van < 100000; van += 1000) {
    const { data, error } = await sb.from('facturen').select('order_id').not('order_id', 'is', null).order('id').range(van, van + 999);
    if (error) break;
    const rijen = (data as { order_id: string | null }[]) ?? [];
    for (const f of rijen) if (f.order_id) metFactuur.add(f.order_id);
    if (rijen.length < 1000) break;
  }
  type Rij = { id: string; ordernummer: number; bedrag: number | null; status: string; organisaties: { naam: string } | null };
  const orders: Rij[] = [];
  for (let van = 0; van < 100000; van += 1000) {
    const { data, error } = await sb
      .from('orders')
      .select('id, ordernummer, bedrag, status, organisaties(naam)')
      .not('status', 'in', '(concept,geannuleerd)')
      .order('ordernummer', { ascending: false })
      .range(van, van + 999);
    if (error) break;
    const rijen = (data as unknown as Rij[]) ?? [];
    orders.push(...rijen);
    if (rijen.length < 1000) break;
  }
  return orders
    .filter((o) => !metFactuur.has(o.id) && (Number(o.bedrag) || 0) !== 0)
    .map((o) => ({
      id: o.id,
      ordernummer: o.ordernummer,
      bedrag: o.bedrag,
      organisatie_naam: o.organisaties?.naam ?? null,
      status: o.status,
      klaar: FACTUREERBARE_ORDERSTATUSSEN.includes(o.status),
    }));
}

/** Het ingestelde e-mailadres van de boekhouder ('' als nog niet ingesteld). */
export async function getBoekhouderEmail(): Promise<string> {
  const sb = kmsAdmin(); if (!sb) return '';
  const { data } = await sb
    .from('instellingen')
    .select('waarde')
    .eq('sleutel', 'boekhouder_email')
    .maybeSingle();
  return (data as { waarde: string | null } | null)?.waarde ?? '';
}

/** Bewaart (upsert) het e-mailadres van de boekhouder. */
export async function zetBoekhouderEmail(email: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('instellingen')
    .upsert(
      { sleutel: 'boekhouder_email', waarde: email.trim(), bijgewerkt_op: new Date().toISOString() },
      { onConflict: 'sleutel' },
    );
  return !error;
}

export type BoekhoudFactuur = { id: string; factuurnummer: string | null; bedrag_incl: number | null; factuurdatum: string | null; organisaties: { naam: string } | null };

/** HTML van de mail aan de boekhouder met de geselecteerde facturen. */
export function boekhouderMailHtml(rows: BoekhoudFactuur[]): string {
  const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const datum = (d: string | null) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const rijenHtml = rows.map((r) => {
    const klant = escapeHtml(r.organisaties?.naam ?? '-');
    const nummer = escapeHtml(r.factuurnummer || 'concept');
    const link = `${env.siteUrl}/dashboard/facturen/${r.id}`;
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;"><a href="${escapeHtml(link)}" style="color:#b04318;font-weight:700;text-decoration:none;">${nummer}</a></td>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;">${klant}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;">${datum(r.factuurdatum)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e4e2e0;text-align:right;">${euro(Number(r.bedrag_incl) || 0)}</td>
    </tr>`;
  }).join('');

  const bodyHtml = `
    <p style="margin:14px 0 16px;">Hierbij ${rows.length === 1 ? 'de factuur' : `de ${rows.length} facturen`} ter verwerking. Klik op een factuurnummer om de factuur in te zien.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background-color:#f6f5f4;">
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Nummer</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Klant</th>
          <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Datum</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e4e2e0;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#52504e;">Bedrag incl.</th>
        </tr>
      </thead>
      <tbody>${rijenHtml}</tbody>
    </table>
    <p style="margin:20px 0 0;">Met vriendelijke groet,<br/>Frederiks Bedrijfskleding</p>`;

  return emailLayout({
    heading: 'Facturen ter verwerking',
    preheader: `${rows.length} ${rows.length === 1 ? 'factuur' : 'facturen'} ter verwerking`,
    bodyHtml,
  });
}

/**
 * Mailt de geselecteerde facturen in één e-mail naar de boekhouder, markeert ze
 * als gemaild (facturen.gemaild_op) en logt elke verzending in factuur_mail_log.
 */
export async function mailFacturenNaarBoekhouder(ids: string[]): Promise<{ ok: boolean; aantal: number; error?: string }> {
  if (!ids || ids.length === 0) return { ok: false, aantal: 0, error: 'Geen facturen geselecteerd.' };
  if (!isEmailConfigured) {
    return { ok: false, aantal: 0, error: 'E-mail is nog niet geconfigureerd (Resend). Stel dat eerst in voordat je facturen kunt mailen.' };
  }
  const boekhouder = await getBoekhouderEmail();
  if (!boekhouder.trim()) return { ok: false, aantal: 0, error: 'Stel eerst het e-mailadres van de boekhouder in.' };

  const sb = kmsAdmin();
  if (!sb) return { ok: false, aantal: 0, error: 'Leaddatabase niet gekoppeld.' };

  const { data } = await sb
    .from('facturen')
    .select('id, factuurnummer, bedrag_incl, factuurdatum, status, organisaties(naam)')
    .in('id', ids);
  const rows = (data as unknown as {
    id: string;
    factuurnummer: string | null;
    bedrag_incl: number | null;
    factuurdatum: string | null;
    status: string;
    organisaties: { naam: string } | null;
  }[]) ?? [];
  if (rows.length === 0) return { ok: false, aantal: 0, error: 'Geen facturen gevonden.' };

  const html = boekhouderMailHtml(rows);

  try {
    await sendEmail({ to: boekhouder, subject: 'Facturen ter verwerking voor Frederiks Bedrijfskleding', html });
  } catch {
    return { ok: false, aantal: 0, error: 'Versturen mislukt.' };
  }

  const nu = new Date().toISOString();
  await sb.from('facturen').update({ gemaild_op: nu }).in('id', ids);
  await sb.from('factuur_mail_log').insert(ids.map((id) => ({ factuur_id: id, naar_email: boekhouder.trim() })));

  return { ok: true, aantal: ids.length };
}

/** Leesbare herkomst van een factuuradres, voor op de factuurpagina. */
export function factuurEmailHerkomst(bron: FactuurEmailBron, naam: string | null): string {
  switch (bron) {
    case 'facturatiecontact':
      return naam ? `facturatiecontact ${naam}` : 'het facturatiecontact van de klant';
    case 'factuur_email':
      return 'het factuur-e-mailadres op de klantkaart';
    case 'email_algemeen':
      return 'het algemene e-mailadres van de klant';
    case 'hoofdcontact':
      return naam ? `hoofdcontact ${naam}` : 'het hoofdcontact van de klant';
  }
}

/** Voorgesteld factuuradres voor een klant met de herkomst in gewone taal. */
export async function factuurEmailSuggestie(organisatieId: string): Promise<{ email: string; herkomst: string; bron: FactuurEmailBron } | null> {
  const r = await factuurEmailVoor(organisatieId);
  if (!r) return null;
  return { email: r.email, bron: r.bron, herkomst: factuurEmailHerkomst(r.bron, r.naam) };
}

/** Zet het e-mailadres voor deze ene factuur (de klantkaart blijft ongemoeid). */
export async function zetFactuurEmail(id: string, email: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('facturen').update({ factuur_email: email && email.trim() ? email.trim() : null }).eq('id', id);
  return !error;
}

/**
 * Mailt de factuur naar de klant: de complete factuur als overzicht in de mail,
 * met betaalgegevens. Bij een conceptfactuur gaat de status daarna op
 * 'verzonden' (en wordt de vervaldatum gezet). Een betaalde factuur blijft betaald.
 */
export async function mailFactuurNaarKlant(id: string, to: string): Promise<{ ok: boolean; error?: string }> {
  const adres = to.trim();
  if (!adres || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adres)) return { ok: false, error: 'Vul een geldig e-mailadres in.' };
  if (!isEmailConfigured) return { ok: false, error: 'E-mail is nog niet ingesteld. Vraag Tim om dit aan te zetten.' };
  const f = await getFactuur(id).catch(() => undefined);
  if (f === undefined) return { ok: false, error: 'De factuur kon niet uit de database worden gelezen. Probeer het opnieuw.' };
  if (!f) return { ok: false, error: 'Factuur niet gevonden.' };

  const vervaldatum = f.vervaldatum ?? vervaldatumVoor(f.factuurdatum);
  const nummer = f.factuurnummer || 'concept';
  // Zelfde opbouw als het factuurdocument: logo, "Te betalen" met IBAN en kenmerk, regels, btw.
  const html = factuurMailHtml({
    factuurnummer: f.factuurnummer,
    factuurdatum: f.factuurdatum,
    vervaldatum,
    status: f.status,
    betaaldatum: f.betaaldatum,
    organisatie_naam: f.organisatie?.naam ?? null,
    klantnummer: f.organisatie?.klantnummer ?? null,
    regels: f.regels.map((r) => ({ ...r, bedrag: regelBedrag(r) })),
    totalen: factuurTotalen(f.regels),
  });
  try {
    const r = await sendEmail({
      to: adres,
      replyTo: bedrijf.email,
      subject: `Factuur ${nummer} van ${bedrijf.naam}`,
      html,
    });
    if (!r.sent) return { ok: false, error: `Versturen mislukt: ${r.error ?? 'onbekende fout'}` };
  } catch {
    return { ok: false, error: 'Versturen mislukt. Probeer het later nog eens.' };
  }
  if (f.status === 'concept') await zetFactuurStatus(id, 'verzonden');
  return { ok: true };
}

/** Verzendlogboek van een factuur naar de boekhouder, nieuwste eerst. */
export async function getFactuurMailLog(factuurId: string): Promise<{ naar_email: string; verzonden_op: string }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('factuur_mail_log')
    .select('naar_email, verzonden_op')
    .eq('factuur_id', factuurId)
    .order('verzonden_op', { ascending: false });
  return (data as { naar_email: string; verzonden_op: string }[]) ?? [];
}
