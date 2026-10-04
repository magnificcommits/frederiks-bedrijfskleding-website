import { kmsAdmin } from '@/lib/kms/adminClient';
import { kolomOntbreekt, metIdTerugval } from '@/lib/kms/kolomTerugval';
import { site } from '@/content/site';

/**
 * Data-access voor Service: Retouren en Klachten/Vragen (beheerkant), plus het
 * retourbeleid en de klachtinstellingen.
 *
 * - Retouren komen binnen via het klantportaal, het publieke retourportaal
 *   (ordernummer + e-mail) of handmatig. Het kantoor beoordeelt ze, neemt een
 *   beslissing (goedkeuren, afkeuren, omruilen, creditnota) en zet een vervolgactie in gang.
 * - Klachten en vragen zijn een eenvoudig ticket-systeem: categorie, prioriteit,
 *   toegewezen collega, streefreactietijd, gesprekstijdlijn en oorzaak bij het sluiten.
 *
 * Alle instellingen staan als sleutel/waarde in `instellingen` (RLS zonder policies,
 * dus alleen via de service role). De retourtermijn houdt zijn oude sleutel
 * `retourtermijn_dagen`, zodat het portaal en het publieke retourportaal blijven werken.
 *
 * Nieuwe kolommen (zie supabase/migrations/20261004_service_tickets_retouren.sql) zijn
 * optioneel: zolang de migratie niet gedraaid is, vallen schrijfacties terug op de oude
 * kolommen en lezen we met select('*').
 *
 * Alleen server-side gebruiken; in het dashboard altijd achter dashAuthed().
 */

/* =============================================================== algemeen */

export const RETOUR_STATUSSEN = ['aangemeld', 'goedgekeurd', 'afgewezen', 'verwerkt'] as const;
export type RetourStatus = (typeof RETOUR_STATUSSEN)[number];

export const RETOUR_BESLISSINGEN = ['goedkeuren', 'afkeuren', 'omruilen', 'creditnota'] as const;
export type RetourBeslissing = (typeof RETOUR_BESLISSINGEN)[number];
export const BESLISSING_LABEL: Record<RetourBeslissing, string> = {
  goedkeuren: 'Goedgekeurd',
  afkeuren: 'Afgekeurd',
  omruilen: 'Omruilen',
  creditnota: 'Creditnota',
};

/** Soort aanmelding: terugsturen, ruilen of laten repareren. */
export const RETOUR_SOORTEN = ['retour', 'ruilen', 'reparatie'] as const;
export type RetourSoort = (typeof RETOUR_SOORTEN)[number];
export const SOORT_LABEL: Record<RetourSoort, string> = {
  retour: 'Retour',
  ruilen: 'Ruilen',
  reparatie: 'Reparatie',
};
export function isRetourSoort(v: unknown): v is RetourSoort {
  return typeof v === 'string' && (RETOUR_SOORTEN as readonly string[]).includes(v);
}

/** Wat er kapot is aan het kledingstuk. */
export const REPARATIE_ONDERDELEN = ['naad', 'rits', 'knoop', 'logo', 'reflectie', 'anders'] as const;
export type ReparatieOnderdeel = (typeof REPARATIE_ONDERDELEN)[number];
export const ONDERDEEL_LABEL: Record<ReparatieOnderdeel, string> = {
  naad: 'Naad of scheur',
  rits: 'Rits',
  knoop: 'Knoop of drukker',
  logo: 'Logo of bedrukking',
  reflectie: 'Reflectie',
  anders: 'Iets anders',
};
export function isOnderdeel(v: unknown): v is ReparatieOnderdeel {
  return typeof v === 'string' && (REPARATIE_ONDERDELEN as readonly string[]).includes(v);
}

/** Stappen van een reparatie. De laatste twee zijn allebei een eindstap. */
export const REPARATIE_STATUSSEN = ['aangemeld', 'ontvangen', 'in_reparatie', 'klaar', 'teruggestuurd', 'opgehaald'] as const;
export type ReparatieStatus = (typeof REPARATIE_STATUSSEN)[number];
export const REPARATIE_STATUS_LABEL: Record<ReparatieStatus, string> = {
  aangemeld: 'Aangemeld',
  ontvangen: 'Ontvangen',
  in_reparatie: 'In reparatie',
  klaar: 'Klaar',
  teruggestuurd: 'Teruggestuurd',
  opgehaald: 'Opgehaald',
};
export function isReparatieStatus(v: unknown): v is ReparatieStatus {
  return typeof v === 'string' && (REPARATIE_STATUSSEN as readonly string[]).includes(v);
}
/**
 * De algemene retourstatus die bij een reparatiestap hoort, zodat tellers als
 * "open" en "te beoordelen" ook reparaties meenemen.
 */
export function retourStatusVoorReparatie(stap: ReparatieStatus): RetourStatus {
  if (stap === 'aangemeld') return 'aangemeld';
  if (stap === 'teruggestuurd' || stap === 'opgehaald') return 'verwerkt';
  return 'goedgekeurd';
}

export const KLACHT_STATUSSEN = ['open', 'in_behandeling', 'afgehandeld'] as const;
export type KlachtStatus = (typeof KLACHT_STATUSSEN)[number];

export const KLACHT_SOORTEN = ['vraag', 'klacht'] as const;
export type KlachtSoort = (typeof KLACHT_SOORTEN)[number];

export const KLACHT_PRIORITEITEN = ['hoog', 'normaal', 'laag'] as const;
export type KlachtPrioriteit = (typeof KLACHT_PRIORITEITEN)[number];

export const KLACHT_BRONNEN = ['portaal', 'telefoon', 'mail', 'balie', 'dashboard'] as const;
export const BRON_LABEL: Record<string, string> = {
  portaal: 'Portaal',
  telefoon: 'Telefoon',
  mail: 'Mail',
  balie: 'Balie',
  dashboard: 'Dashboard',
  retourportaal: 'Retourformulier',
};

export type OrganisatieKeuze = { id: string; naam: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

type PgFout = { code?: string; message?: string } | null | undefined;

/** Tabel bestaat (nog) niet: migratie niet gedraaid. */
function tabelOntbreekt(fout: PgFout): boolean {
  if (!fout) return false;
  if (fout.code === '42P01' || fout.code === 'PGRST205') return true;
  const m = String(fout.message ?? '').toLowerCase();
  return m.includes('could not find the table') || (m.includes('relation') && m.includes('does not exist'));
}

function tekst(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** In blokken ophalen, zodat een lange .in()-lijst de URL niet opblaast. */
async function haalIn<T>(tabel: string, kolommen: string, ids: string[], kolom = 'id'): Promise<T[]> {
  const sb = kmsAdmin();
  const schoon = [...new Set(ids.filter(isUuid))];
  if (!sb || schoon.length === 0) return [];
  const uit: T[] = [];
  for (let i = 0; i < schoon.length; i += 150) {
    const { data, error } = await sb.from(tabel).select(kolommen).in(kolom, schoon.slice(i, i + 150));
    if (error) break;
    uit.push(...((data as unknown as T[]) ?? []));
  }
  return uit;
}

/** Klanten voor keuzelijsten, op naam gesorteerd. */
export async function listOrganisaties(): Promise<OrganisatieKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam').order('naam');
  return (data as OrganisatieKeuze[]) ?? [];
}

/** Klanten met plaats en adres, voor de klantzoeker. */
export async function listKlantKeuzesService(): Promise<{ id: string; naam: string; plaats: string | null; adres: string | null }[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data, error } = await sb.from('organisaties').select('id, naam, plaats, adres').order('naam').limit(2000);
  if (error) {
    const { data: kaal } = await sb.from('organisaties').select('id, naam').order('naam').limit(2000);
    return ((kaal as { id: string; naam: string }[]) ?? []).map((o) => ({ ...o, plaats: null, adres: null }));
  }
  return (data as { id: string; naam: string; plaats: string | null; adres: string | null }[]) ?? [];
}

/** Laatste orders van een klant, voor het koppelen van een klacht of retour. */
export async function ordersVoorKlant(orgId: string): Promise<{ id: string; ordernummer: number | null; besteldatum: string | null; status: string | null }[]> {
  const sb = kmsAdmin(); if (!sb || !isUuid(orgId)) return [];
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, besteldatum, status')
    .eq('organisatie_id', orgId)
    .order('besteldatum', { ascending: false })
    .limit(40);
  return (data as { id: string; ordernummer: number | null; besteldatum: string | null; status: string | null }[]) ?? [];
}

export type ProductKeuze = { id: string; naam: string; merk: string | null };

/** Artikel zoeken op naam, merk of artikelnummer (max 8 treffers). */
export async function zoekProducten(q: string): Promise<ProductKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const term = q.replace(/[%,()]/g, ' ').trim();
  if (term.length < 2) return [];
  const { data } = await sb
    .from('producten')
    .select('id, naam, merk')
    .or(`naam.ilike.%${term}%,merk.ilike.%${term}%,sku.ilike.%${term}%`)
    .order('naam')
    .limit(8);
  return (data as ProductKeuze[]) ?? [];
}

/** Artikelen die op een order staan (voor de productkeuze bij een klacht). */
export async function productenVanOrder(orderId: string): Promise<ProductKeuze[]> {
  const sb = kmsAdmin(); if (!sb || !isUuid(orderId)) return [];
  const { data } = await sb.from('orderregels').select('product_id').eq('order_id', orderId);
  const ids = ((data as { product_id: string | null }[]) ?? []).map((r) => r.product_id).filter(isUuid);
  return haalIn<ProductKeuze>('producten', 'id, naam, merk', ids);
}

/* =============================================================== instellingen */

export const SLEUTEL_RETOURTERMIJN = 'retourtermijn_dagen';
const SLEUTEL_RETOURBELEID = 'retourbeleid';
const SLEUTEL_RETOURREDENEN = 'retour_redenen';
const SLEUTEL_TERMIJN_PER_KLANT = 'retourtermijn_per_klant';
const SLEUTEL_KLACHT_CATEGORIEEN = 'klacht_categorieen';
const SLEUTEL_KLACHT_SLA = 'klacht_sla_uren';

export const RETOURTERMIJN_STANDAARD = 30;

/** Dezelfde labels als het publieke retourformulier (lib/retourportaal.ts), zodat de analyse ze samen telt. */
export const STANDAARD_RETOURREDENEN = [
  'Maat te klein',
  'Maat te groot',
  'Zit niet lekker',
  'Verkeerd artikel geleverd',
  'Beschadigd of defect',
  'Logo niet goed aangebracht',
  'Te veel besteld',
  'Anders',
];

export const STANDAARD_KLACHTCATEGORIEEN = ['Levering', 'Kwaliteit', 'Maat', 'Bedrukking/borduring', 'Factuur', 'Overig'];

/** Streefreactietijd in uren per prioriteit (kalenderuren). */
export type SlaUren = Record<KlachtPrioriteit, number>;
export const STANDAARD_SLA: SlaUren = { hoog: 4, normaal: 24, laag: 72 };

export type RetourVoorwaarden = {
  ongedragen: boolean;
  metLabels: boolean;
  geenBedrukt: boolean;
  /** Vrije extra regels, één per regel. */
  extra: string;
};

export type Retourbeleid = {
  termijnDagen: number;
  voorwaarden: RetourVoorwaarden;
  retouradres: string;
  instructie: string;
  redenen: string[];
  /** Afwijkende termijn per klant: organisatie_id → dagen. */
  termijnPerKlant: Record<string, number>;
};

export const STANDAARD_RETOURADRES = `${site.name}, ${site.address.street}, ${site.address.postalCode} ${site.address.city}`;
export const STANDAARD_INSTRUCTIE =
  'Stuur de artikelen terug in de originele verpakking en doe een briefje met het retournummer of ordernummer in de doos.';

async function leesInstellingen(sleutels: string[]): Promise<Map<string, string | null>> {
  const sb = kmsAdmin();
  const uit = new Map<string, string | null>();
  if (!sb) return uit;
  const { data } = await sb.from('instellingen').select('sleutel, waarde').in('sleutel', sleutels);
  for (const r of (data as { sleutel: string; waarde: string | null }[]) ?? []) uit.set(r.sleutel, r.waarde);
  return uit;
}

async function zetInstelling(sleutel: string, waarde: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('instellingen')
    .upsert({ sleutel, waarde, bijgewerkt_op: new Date().toISOString() }, { onConflict: 'sleutel' });
  if (error && kolomOntbreekt(error)) {
    const { error: e2 } = await sb.from('instellingen').upsert({ sleutel, waarde }, { onConflict: 'sleutel' });
    return !e2;
  }
  return !error;
}

function leesJson<T>(raw: string | null | undefined, terugval: T): T {
  if (!raw) return terugval;
  try {
    const v = JSON.parse(raw);
    return (v ?? terugval) as T;
  } catch {
    return terugval;
  }
}

function schoneLijst(v: unknown, terugval: string[]): string[] {
  if (!Array.isArray(v)) return terugval;
  const lijst = [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))].slice(0, 40);
  return lijst.length ? lijst : terugval;
}

function schoneDagen(v: unknown, terugval: number): number {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 && n <= 730 ? n : terugval;
}

export async function getRetourbeleid(): Promise<Retourbeleid> {
  const m = await leesInstellingen([SLEUTEL_RETOURTERMIJN, SLEUTEL_RETOURBELEID, SLEUTEL_RETOURREDENEN, SLEUTEL_TERMIJN_PER_KLANT]);
  const beleid = leesJson<Partial<Retourbeleid> & { voorwaarden?: Partial<RetourVoorwaarden> }>(m.get(SLEUTEL_RETOURBELEID), {});
  const perKlantRuw = leesJson<Record<string, unknown>>(m.get(SLEUTEL_TERMIJN_PER_KLANT), {});
  const termijnPerKlant: Record<string, number> = {};
  for (const [id, d] of Object.entries(perKlantRuw ?? {})) {
    const n = schoneDagen(d, 0);
    if (isUuid(id) && n > 0) termijnPerKlant[id] = n;
  }
  const v: Partial<RetourVoorwaarden> = beleid.voorwaarden ?? {};
  return {
    termijnDagen: schoneDagen(m.get(SLEUTEL_RETOURTERMIJN), RETOURTERMIJN_STANDAARD),
    voorwaarden: {
      ongedragen: v.ongedragen !== false,
      metLabels: v.metLabels !== false,
      geenBedrukt: v.geenBedrukt !== false,
      extra: typeof v.extra === 'string' ? v.extra : '',
    },
    retouradres: typeof beleid.retouradres === 'string' && beleid.retouradres.trim() ? beleid.retouradres : STANDAARD_RETOURADRES,
    instructie: typeof beleid.instructie === 'string' && beleid.instructie.trim() ? beleid.instructie : STANDAARD_INSTRUCTIE,
    redenen: schoneLijst(leesJson<unknown>(m.get(SLEUTEL_RETOURREDENEN), null), STANDAARD_RETOURREDENEN),
    termijnPerKlant,
  };
}

/** Voorwaarden als losse zinnen, voor het portaal en de retourmail. */
export function voorwaardenTekst(v: RetourVoorwaarden): string[] {
  const uit: string[] = [];
  if (v.ongedragen) uit.push('Ongedragen en ongewassen.');
  if (v.metLabels) uit.push('Met de originele labels er nog aan.');
  if (v.geenBedrukt) uit.push('Bedrukte of geborduurde artikelen nemen we niet terug, behalve als wij een fout hebben gemaakt.');
  for (const regel of v.extra.split('\n')) if (regel.trim()) uit.push(regel.trim());
  return uit;
}

/** Termijn voor één klant: de afwijkende termijn als die er is, anders de standaard. */
export function termijnVoorKlant(beleid: Retourbeleid, orgId: string | null | undefined): number {
  return (orgId && beleid.termijnPerKlant[orgId]) || beleid.termijnDagen;
}

export async function zetRetourbeleidVelden(b: {
  termijnDagen: number;
  voorwaarden: RetourVoorwaarden;
  retouradres: string;
  instructie: string;
}): Promise<boolean> {
  const termijn = schoneDagen(b.termijnDagen, RETOURTERMIJN_STANDAARD);
  const a = await zetInstelling(SLEUTEL_RETOURTERMIJN, String(termijn));
  const c = await zetInstelling(
    SLEUTEL_RETOURBELEID,
    JSON.stringify({
      voorwaarden: { ...b.voorwaarden, extra: b.voorwaarden.extra.slice(0, 2000) },
      retouradres: b.retouradres.trim().slice(0, 500),
      instructie: b.instructie.trim().slice(0, 2000),
    }),
  );
  return a && c;
}

export async function zetRetourredenen(lijst: string[]): Promise<boolean> {
  return zetInstelling(SLEUTEL_RETOURREDENEN, JSON.stringify(schoneLijst(lijst, STANDAARD_RETOURREDENEN)));
}

export async function zetTermijnVoorKlant(orgId: string, dagen: number | null): Promise<boolean> {
  if (!isUuid(orgId)) return false;
  const huidig = (await getRetourbeleid()).termijnPerKlant;
  const nieuw = { ...huidig };
  if (dagen == null || !(dagen > 0)) delete nieuw[orgId];
  else nieuw[orgId] = schoneDagen(dagen, RETOURTERMIJN_STANDAARD);
  return zetInstelling(SLEUTEL_TERMIJN_PER_KLANT, JSON.stringify(nieuw));
}

/* ---------- reparaties ---------- */

const SLEUTEL_REPARATIES = 'reparatie_instellingen';

export type ReparatieInstellingen = {
  /** Kunnen klanten in het portaal een reparatie aanmelden? */
  aan: boolean;
  /** Standaard reparatiekosten excl. btw; null = gratis of per keer bepalen. */
  kosten: number | null;
  /** Korte uitleg die de klant boven het formulier ziet. */
  tekst: string;
};

export const STANDAARD_REPARATIETEKST =
  'Is er iets kapot aan je werkkleding, zoals een naad, rits of drukker? Meld het hier met een foto. We laten je weten wanneer we het ophalen of hoe je het opstuurt, en sturen het gerepareerd terug.';

export async function getReparatieInstellingen(): Promise<ReparatieInstellingen> {
  const m = await leesInstellingen([SLEUTEL_REPARATIES]);
  const r = leesJson<Partial<Record<string, unknown>>>(m.get(SLEUTEL_REPARATIES), {});
  const kosten = Number(r?.kosten);
  return {
    aan: r?.aan === true,
    kosten: r?.kosten != null && r.kosten !== '' && Number.isFinite(kosten) && kosten >= 0 ? Math.round(kosten * 100) / 100 : null,
    tekst: typeof r?.tekst === 'string' && r.tekst.trim() ? r.tekst.trim() : STANDAARD_REPARATIETEKST,
  };
}

export async function zetReparatieInstellingen(i: ReparatieInstellingen): Promise<boolean> {
  return zetInstelling(
    SLEUTEL_REPARATIES,
    JSON.stringify({
      aan: i.aan,
      kosten: i.kosten != null && Number.isFinite(i.kosten) && i.kosten >= 0 ? Math.round(i.kosten * 100) / 100 : null,
      tekst: i.tekst.trim().slice(0, 1000),
    }),
  );
}

export type KlachtInstellingen = { categorieen: string[]; sla: SlaUren };

export async function getKlachtInstellingen(): Promise<KlachtInstellingen> {
  const m = await leesInstellingen([SLEUTEL_KLACHT_CATEGORIEEN, SLEUTEL_KLACHT_SLA]);
  const slaRuw = leesJson<Partial<Record<string, unknown>>>(m.get(SLEUTEL_KLACHT_SLA), {});
  const uren = (k: KlachtPrioriteit) => {
    const n = Number(slaRuw?.[k]);
    return Number.isFinite(n) && n > 0 && n <= 24 * 30 ? n : STANDAARD_SLA[k];
  };
  return {
    categorieen: schoneLijst(leesJson<unknown>(m.get(SLEUTEL_KLACHT_CATEGORIEEN), null), STANDAARD_KLACHTCATEGORIEEN),
    sla: { hoog: uren('hoog'), normaal: uren('normaal'), laag: uren('laag') },
  };
}

export async function zetKlachtInstellingen(i: KlachtInstellingen): Promise<boolean> {
  const a = await zetInstelling(SLEUTEL_KLACHT_CATEGORIEEN, JSON.stringify(schoneLijst(i.categorieen, STANDAARD_KLACHTCATEGORIEEN)));
  const b = await zetInstelling(SLEUTEL_KLACHT_SLA, JSON.stringify(i.sla));
  return a && b;
}

/* =============================================================== retouren */

export type RetourRegelVol = {
  orderregel_id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  /** Reden per regel (publiek retourformulier en portaal); anders de reden van de hele retour. */
  reden: string | null;
  product_id: string | null;
  merk: string | null;
  stukprijs: number | null;
};

export type Retour = {
  id: string;
  organisatie_id: string | null;
  order_id: string | null;
  medewerker_id: string | null;
  reden: string | null;
  status: string;
  retouradres: string | null;
  instructie: string | null;
  created_at: string;
};

export type RetourMetLabels = Retour & {
  organisatie_naam: string | null;
  ordernummer: string | null;
  retournummer: string | null;
  methode: string | null;
  contact_email: string | null;
  bron: string | null;
  beslissing: RetourBeslissing | null;
  beslissing_notitie: string | null;
  afgehandeld_op: string | null;
  vervolg_order_id: string | null;
  creditfactuur_id: string | null;
  taak_id: string | null;
  fotos: string[];
  regels: RetourRegelVol[];
  /** Retour, ruilen of reparatie. Oude omruil-retouren tellen als ruilen. */
  soort: RetourSoort;
  reparatie_onderdeel: ReparatieOnderdeel | null;
  reparatie_status: ReparatieStatus | null;
  reparatie_kosten: number | null;
  reparatie_factuur_id: string | null;
  /** Hoofdreden, herleid uit de vaste redenlijst. */
  redenLabel: string;
  aantalStuks: number;
};

/** Leest de hoofdreden uit de vrije tekst: welke vaste reden staat erin? */
export function herleidReden(tekstRuw: string | null | undefined, redenen: string[]): string {
  const t = String(tekstRuw ?? '').toLowerCase();
  if (!t.trim()) return 'Niet opgegeven';
  const exact = redenen.find((r) => t.startsWith(r.toLowerCase()));
  if (exact) return exact;
  const ergens = redenen.find((r) => r.toLowerCase() !== 'anders' && t.includes(r.toLowerCase()));
  if (ergens) return ergens;
  if (/te klein|kleiner|valt klein/.test(t)) return redenen.find((r) => /klein/i.test(r)) ?? 'Anders';
  if (/te groot|groter|valt groot/.test(t)) return redenen.find((r) => /groot/i.test(r)) ?? 'Anders';
  if (/kapot|scheur|beschadig|defect/.test(t)) return redenen.find((r) => /beschadig|defect/i.test(r)) ?? 'Anders';
  return 'Anders';
}

function leesFotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => (typeof f === 'string' ? f : (f as { url?: string } | null)?.url ?? ''))
    .filter((u) => /^https?:\/\//.test(u))
    .slice(0, 12);
}

function isBeslissing(v: unknown): v is RetourBeslissing {
  return typeof v === 'string' && (RETOUR_BESLISSINGEN as readonly string[]).includes(v);
}

/**
 * Alle retouren (nieuwste eerst), met klant, order, regels verrijkt met artikel en merk,
 * en de hoofdreden uit de vaste lijst. Filteren gebeurt op de pagina: het gaat om
 * tientallen tot honderden retouren per jaar.
 */
export async function listRetouren(): Promise<RetourMetLabels[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const [{ data }, beleid] = await Promise.all([
    sb
      .from('retouren')
      .select('*, organisaties(naam), orders(ordernummer)')
      .order('created_at', { ascending: false })
      .limit(2000),
    getRetourbeleid(),
  ]);
  const rijen = (data as Record<string, unknown>[] | null) ?? [];

  // Orderregels erbij voor artikel, merk en stukprijs.
  const regelIds: string[] = [];
  for (const r of rijen) {
    for (const rg of Array.isArray(r.regels) ? (r.regels as { orderregel_id?: string }[]) : []) {
      if (rg?.orderregel_id) regelIds.push(rg.orderregel_id);
    }
  }
  const orderregels = await haalIn<{ id: string; product_id: string | null; stukprijs: number | null }>(
    'orderregels',
    'id, product_id, stukprijs',
    regelIds,
  );
  const perOrderregel = new Map(orderregels.map((o) => [o.id, o]));
  const producten = await haalIn<{ id: string; merk: string | null }>(
    'producten',
    'id, merk',
    orderregels.map((o) => o.product_id ?? ''),
  );
  const merkVan = new Map(producten.map((p) => [p.id, p.merk]));

  return rijen.map((r) => {
    const org = r.organisaties as { naam: string } | null;
    const ord = r.orders as { ordernummer: number | string | null } | null;
    const regels: RetourRegelVol[] = (Array.isArray(r.regels) ? (r.regels as Record<string, unknown>[]) : [])
      .map((o) => {
        const aantal = Number(o?.aantal);
        const orId = String(o?.orderregel_id ?? '');
        const bron = perOrderregel.get(orId);
        const pid = bron?.product_id ?? null;
        return {
          orderregel_id: orId,
          item_naam: String(o?.item_naam ?? ''),
          maat: o?.maat == null || o.maat === '' ? null : String(o.maat),
          kleur: o?.kleur == null || o.kleur === '' ? null : String(o.kleur),
          aantal: Number.isFinite(aantal) && aantal > 0 ? aantal : 1,
          reden: tekst(o?.reden) ? herleidReden(String(o.reden), beleid.redenen) : null,
          product_id: pid,
          merk: pid ? merkVan.get(pid) ?? null : null,
          stukprijs: bron?.stukprijs ?? null,
        };
      })
      .filter((x) => x.item_naam !== '');
    // Redenen per regel (publiek retourformulier, portaal) gaan voor de vrije tekst.
    const regelTel = new Map<string, number>();
    for (const x of regels) if (x.reden) regelTel.set(x.reden, (regelTel.get(x.reden) ?? 0) + x.aantal);
    const regelReden = [...regelTel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      id: String(r.id),
      organisatie_id: (r.organisatie_id as string) ?? null,
      order_id: (r.order_id as string) ?? null,
      medewerker_id: (r.medewerker_id as string) ?? null,
      reden: (r.reden as string) ?? null,
      status: String(r.status ?? 'aangemeld'),
      retouradres: (r.retouradres as string) ?? null,
      instructie: (r.instructie as string) ?? null,
      created_at: String(r.created_at),
      organisatie_naam: org?.naam ?? null,
      ordernummer: ord?.ordernummer != null ? String(ord.ordernummer) : null,
      retournummer: (r.retournummer as string) ?? null,
      methode: (r.methode as string) ?? null,
      contact_email: (r.contact_email as string) ?? null,
      bron: (r.bron as string) ?? null,
      beslissing: isBeslissing(r.beslissing) ? r.beslissing : null,
      beslissing_notitie: (r.beslissing_notitie as string) ?? null,
      afgehandeld_op: (r.afgehandeld_op as string) ?? null,
      vervolg_order_id: (r.vervolg_order_id as string) ?? null,
      creditfactuur_id: (r.creditfactuur_id as string) ?? null,
      taak_id: (r.taak_id as string) ?? null,
      fotos: leesFotos(r.fotos),
      regels,
      soort: isRetourSoort(r.soort) ? (r.soort === 'retour' && r.beslissing === 'omruilen' ? 'ruilen' : r.soort) : r.beslissing === 'omruilen' ? 'ruilen' : 'retour',
      reparatie_onderdeel: isOnderdeel(r.reparatie_onderdeel) ? r.reparatie_onderdeel : null,
      reparatie_status: isReparatieStatus(r.reparatie_status) ? r.reparatie_status : r.soort === 'reparatie' ? 'aangemeld' : null,
      reparatie_kosten: r.reparatie_kosten != null && Number.isFinite(Number(r.reparatie_kosten)) ? Number(r.reparatie_kosten) : null,
      reparatie_factuur_id: (r.reparatie_factuur_id as string) ?? null,
      redenLabel: regelReden ?? herleidReden(r.reden as string | null, beleid.redenen),
      aantalStuks: regels.reduce((n, x) => n + x.aantal, 0),
    };
  });
}

export async function getRetour(id: string): Promise<RetourMetLabels | null> {
  if (!isUuid(id)) return null;
  const alle = await listRetouren();
  return alle.find((r) => r.id === id) ?? null;
}

/** Verkochte stuks per artikel sinds een datum, voor het retourpercentage. */
export async function verkochtPerProduct(sinds: Date): Promise<Map<string, { naam: string; stuks: number }>> {
  const sb = kmsAdmin();
  const uit = new Map<string, { naam: string; stuks: number }>();
  if (!sb) return uit;
  const { data } = await sb
    .from('orderregels')
    .select('product_id, item_naam, aantal')
    .gte('created_at', sinds.toISOString())
    .limit(10000);
  for (const r of (data as { product_id: string | null; item_naam: string | null; aantal: number | null }[]) ?? []) {
    const sleutel = r.product_id ?? `naam:${(r.item_naam ?? '').toLowerCase()}`;
    const huidig = uit.get(sleutel) ?? { naam: r.item_naam ?? 'Artikel', stuks: 0 };
    huidig.stuks += Number(r.aantal) || 0;
    uit.set(sleutel, huidig);
  }
  return uit;
}

export async function maakRetour(velden: {
  organisatie_id?: string | null;
  order_id?: string | null;
  medewerker_id?: string | null;
  reden?: string | null;
  retouradres?: string | null;
  instructie?: string | null;
  soort?: RetourSoort;
  reparatie_onderdeel?: ReparatieOnderdeel | null;
  /** Wat er gerepareerd moet worden, als er geen orderregel bij hoort. */
  kledingstuk?: string | null;
}): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const soort = velden.soort ?? 'retour';
  const rij: Record<string, unknown> = {
    organisatie_id: velden.organisatie_id ?? null,
    order_id: velden.order_id ?? null,
    medewerker_id: velden.medewerker_id ?? null,
    reden: velden.reden ?? null,
    retouradres: velden.retouradres ?? null,
    instructie: velden.instructie ?? null,
    bron: 'dashboard',
    soort,
  };
  if (soort === 'reparatie') {
    const onderdeel = velden.reparatie_onderdeel ?? 'anders';
    rij.reparatie_onderdeel = onderdeel;
    rij.reparatie_status = 'aangemeld';
    const kosten = (await getReparatieInstellingen()).kosten;
    if (kosten != null) rij.reparatie_kosten = kosten;
    if (velden.kledingstuk) {
      rij.regels = [{ orderregel_id: '', item_naam: velden.kledingstuk.slice(0, 200), maat: null, kleur: null, aantal: 1, reden: ONDERDEEL_LABEL[onderdeel] }];
    }
  }
  const { error } = await metIdTerugval(
    rij,
    ['bron', 'soort', 'reparatie_onderdeel', 'reparatie_status', 'reparatie_kosten'],
    (x) => sb.from('retouren').insert(x),
  );
  return !error;
}

/**
 * Volgende stap van een reparatie. De algemene status loopt mee (aangemeld,
 * goedgekeurd zolang hij bij ons is, verwerkt zodra hij terug is bij de klant).
 */
export async function zetReparatieStatus(id: string, stap: ReparatieStatus): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb || !isUuid(id)) return false;
  const status = retourStatusVoorReparatie(stap);
  const rij: Record<string, unknown> = { reparatie_status: stap, status };
  rij.afgehandeld_op = status === 'verwerkt' ? new Date().toISOString() : null;
  const { error } = await sb.from('retouren').update(rij).eq('id', id);
  return !error;
}

/** Reparatiekosten (excl. btw) vastleggen of wissen. */
export async function zetReparatieKosten(id: string, kosten: number | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb || !isUuid(id)) return false;
  const schoon = kosten != null && Number.isFinite(kosten) && kosten >= 0 ? Math.round(kosten * 100) / 100 : null;
  const { error } = await sb.from('retouren').update({ reparatie_kosten: schoon }).eq('id', id);
  return !error;
}

/** Conceptfactuur voor de reparatiekosten: één regel, 21% btw. Blijft concept tot je hem verstuurt. */
export async function maakReparatieFactuur(retourId: string): Promise<{ factuurId: string } | { fout: string }> {
  const r = await getRetour(retourId);
  if (!r) return { fout: 'Reparatie niet gevonden.' };
  if (r.soort !== 'reparatie') return { fout: 'Dit is geen reparatie.' };
  if (!r.organisatie_id) return { fout: 'Koppel eerst een klant aan deze reparatie.' };
  if (r.reparatie_factuur_id) return { factuurId: r.reparatie_factuur_id };
  if (!r.reparatie_kosten || r.reparatie_kosten <= 0) return { fout: 'Vul eerst de reparatiekosten in.' };
  const { maakLegeFactuur, voegFactuurregelToe } = await import('@/lib/kms/facturen');
  const factuurId = await maakLegeFactuur(r.organisatie_id);
  if (!factuurId) return { fout: 'De factuur kon niet worden aangemaakt.' };
  const wat = r.regels.map((x) => `${x.aantal}x ${x.item_naam}`).join(', ');
  const onderdeel = r.reparatie_onderdeel ? ONDERDEEL_LABEL[r.reparatie_onderdeel].toLowerCase() : null;
  await voegFactuurregelToe(factuurId, {
    omschrijving: `Reparatie ${retourNaam(r)}${onderdeel ? ` (${onderdeel})` : ''}${wat ? `: ${wat}` : ''}`.slice(0, 300),
    aantal: 1,
    stukprijs: r.reparatie_kosten,
    btw_pct: 21,
    product_id: null,
    maat: null,
    kleur: null,
  });
  await koppelAanRetour(retourId, 'reparatie_factuur_id', factuurId);
  return { factuurId };
}

export async function zetRetourStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const rij: Record<string, unknown> = { status };
  if (status === 'verwerkt' || status === 'afgewezen') rij.afgehandeld_op = new Date().toISOString();
  const { error } = await metIdTerugval(rij, ['afgehandeld_op'], (x) => sb.from('retouren').update(x).eq('id', id));
  return !error;
}

export async function zetRetourInstructie(
  id: string,
  retouradres: string | null,
  instructie: string | null,
): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('retouren').update({ retouradres, instructie }).eq('id', id);
  return !error;
}

/**
 * Legt de beslissing vast. Afkeuren sluit de retour (status afgewezen); de andere
 * beslissingen zetten hem op goedgekeurd, zodat de klant het retouradres en de
 * instructie in het portaal ziet. Verwerkt wordt hij pas als de spullen binnen zijn.
 */
export async function zetRetourBeslissing(
  id: string,
  beslissing: RetourBeslissing,
  velden: { notitie: string | null; retouradres: string | null; instructie: string | null },
): Promise<{ ok: boolean; zonderMigratie: boolean }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, zonderMigratie: false };
  const status: RetourStatus = beslissing === 'afkeuren' ? 'afgewezen' : 'goedgekeurd';
  const rij: Record<string, unknown> = {
    status,
    beslissing,
    beslissing_notitie: velden.notitie,
    retouradres: beslissing === 'afkeuren' ? null : velden.retouradres,
    instructie: velden.instructie,
  };
  if (beslissing === 'afkeuren') rij.afgehandeld_op = new Date().toISOString();
  const nieuwe = ['beslissing', 'beslissing_notitie', 'afgehandeld_op'];
  const eerste = await sb.from('retouren').update(rij).eq('id', id);
  if (!eerste.error) return { ok: true, zonderMigratie: false };
  if (!kolomOntbreekt(eerste.error)) return { ok: false, zonderMigratie: false };
  const zonder = { ...rij };
  for (const k of nieuwe) delete zonder[k];
  // Zonder beslissingkolom: zet de beslissing voor in de instructie, zodat hij niet verloren gaat.
  const voorvoegsel = `${BESLISSING_LABEL[beslissing]}.`;
  zonder.instructie = [voorvoegsel, velden.instructie].filter(Boolean).join(' ');
  const tweede = await sb.from('retouren').update(zonder).eq('id', id);
  return { ok: !tweede.error, zonderMigratie: true };
}

async function koppelAanRetour(id: string, kolom: 'vervolg_order_id' | 'creditfactuur_id' | 'taak_id' | 'reparatie_factuur_id', waarde: string) {
  const sb = kmsAdmin(); if (!sb) return;
  await sb.from('retouren').update({ [kolom]: waarde }).eq('id', id); // faalt stil zonder migratie
}

function retourNaam(r: RetourMetLabels): string {
  return r.retournummer ?? (r.ordernummer ? `bij order ${r.ordernummer}` : r.id.slice(0, 8));
}

/**
 * Omruilen: maakt een conceptorder met dezelfde artikelen voor nul euro. Maat of kleur
 * pas je op de order aan (de omruil gaat meestal om een andere maat).
 */
export async function maakVervangendeOrder(retourId: string): Promise<{ orderId: string } | { fout: string }> {
  const sb = kmsAdmin(); if (!sb) return { fout: 'Database niet bereikbaar.' };
  const r = await getRetour(retourId);
  if (!r) return { fout: 'Retour niet gevonden.' };
  if (!r.organisatie_id) return { fout: 'Koppel eerst een klant aan deze retour.' };
  if (r.vervolg_order_id) return { orderId: r.vervolg_order_id };
  const { maakOrder, voegOrderregelToe } = await import('@/lib/kms/orders');
  const varianten = await haalIn<{ id: string; variant_id: string | null; lengte: number | null }>(
    'orderregels',
    'id, variant_id, lengte',
    r.regels.map((x) => x.orderregel_id),
  );
  const variantVan = new Map(varianten.map((v) => [v.id, v]));
  const orderId = await maakOrder({
    organisatie_id: r.organisatie_id,
    medewerker_id: r.medewerker_id,
    notitie: `Vervangende levering voor retour ${retourNaam(r)}.`,
    interne_notitie: `Omruil vanuit retour ${retourNaam(r)}. Regels staan op nul euro; pas maat of kleur aan waar nodig.`,
  });
  if (!orderId) return { fout: 'De order kon niet worden aangemaakt.' };
  for (const rg of r.regels) {
    const v = variantVan.get(rg.orderregel_id);
    await voegOrderregelToe(orderId, {
      product_id: rg.product_id,
      variant_id: v?.variant_id ?? null,
      item_naam: rg.item_naam,
      maat: rg.maat,
      kleur: rg.kleur,
      lengte: v?.lengte ?? null,
      aantal: rg.aantal,
      stukprijs: 0,
    });
  }
  await koppelAanRetour(retourId, 'vervolg_order_id', orderId);
  return { orderId };
}

/**
 * Creditnota: conceptfactuur met negatieve regels tegen de oorspronkelijke stukprijs.
 * Hij blijft concept, zodat je hem nakijkt voor hij de deur uitgaat.
 */
export async function maakCreditfactuur(retourId: string): Promise<{ factuurId: string } | { fout: string }> {
  const r = await getRetour(retourId);
  if (!r) return { fout: 'Retour niet gevonden.' };
  if (!r.organisatie_id) return { fout: 'Koppel eerst een klant aan deze retour.' };
  if (r.creditfactuur_id) return { factuurId: r.creditfactuur_id };
  if (r.regels.length === 0) return { fout: 'Deze retour heeft geen artikelregels om te crediteren.' };
  const { maakLegeFactuur, voegFactuurregelToe } = await import('@/lib/kms/facturen');
  const btw = await haalIn<{ id: string; btw: number | null }>('producten', 'id, btw', r.regels.map((x) => x.product_id ?? ''));
  const btwVan = new Map(btw.map((p) => [p.id, p.btw]));
  const factuurId = await maakLegeFactuur(r.organisatie_id);
  if (!factuurId) return { fout: 'De creditfactuur kon niet worden aangemaakt.' };
  for (const rg of r.regels) {
    await voegFactuurregelToe(factuurId, {
      omschrijving: `Creditering retour ${retourNaam(r)}: ${rg.item_naam}`,
      aantal: -rg.aantal,
      stukprijs: rg.stukprijs ?? 0,
      btw_pct: (rg.product_id ? btwVan.get(rg.product_id) : null) ?? 21,
      product_id: rg.product_id,
      maat: rg.maat,
      kleur: rg.kleur,
    });
  }
  await koppelAanRetour(retourId, 'creditfactuur_id', factuurId);
  return { factuurId };
}

/** Taak voor de afhandeling (ophalen, controleren, terugstorten). */
export async function maakRetourTaak(retourId: string, persoonId: string | null): Promise<{ taakId: string } | { fout: string }> {
  const r = await getRetour(retourId);
  if (!r) return { fout: 'Retour niet gevonden.' };
  const { maakTaak } = await import('@/lib/kms/taken');
  const over2 = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const wat =
    r.soort === 'reparatie' ? 'repareren' : r.beslissing === 'omruilen' ? 'omruilen' : r.beslissing === 'creditnota' ? 'crediteren' : r.methode === 'ophalen' ? 'ophalen' : 'afhandelen';
  const res = await maakTaak({
    titel: `${r.soort === 'reparatie' ? 'Reparatie' : 'Retour'} ${retourNaam(r)} ${wat}${r.organisatie_naam ? `: ${r.organisatie_naam}` : ''}`,
    organisatie_id: r.organisatie_id,
    omschrijving: [
      r.regels.map((x) => `${x.aantal}x ${x.item_naam}${x.maat ? ` (${x.maat})` : ''}`).join(', '),
      r.reden ? `Reden: ${r.reden}` : '',
      r.beslissing_notitie ? `Notitie: ${r.beslissing_notitie}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    vervaldatum: over2,
    persoon_id: persoonId,
    prioriteit: 'normaal',
  });
  if ('fout' in res) return res;
  await koppelAanRetour(retourId, 'taak_id', res.id);
  return { taakId: res.id };
}

/** Mail aan de klant over de beslissing. Geeft sent:false terug als mail (nog) niet is ingesteld. */
export async function mailRetourBeslissing(retourId: string): Promise<{ sent: boolean; reden?: string }> {
  const r = await getRetour(retourId);
  if (!r) return { sent: false, reden: 'Retour niet gevonden.' };
  let naar = r.contact_email;
  if (!naar && r.medewerker_id) {
    const [m] = await haalIn<{ id: string; email: string | null }>('medewerkers', 'id, email', [r.medewerker_id]);
    naar = m?.email ?? null;
  }
  if (!naar) return { sent: false, reden: 'Geen e-mailadres bekend bij deze retour.' };
  const { sendEmail, emailLayout, escapeHtml } = await import('@/lib/email');
  const beslissing = r.beslissing ? BESLISSING_LABEL[r.beslissing] : r.status;
  const html = emailLayout({
    heading: r.beslissing === 'afkeuren' ? 'Je retour kunnen we niet aannemen' : 'Je retour is beoordeeld',
    preheader: `Retour ${retourNaam(r)}: ${beslissing}`,
    bodyHtml: `
      <p>Retour <strong>${escapeHtml(retourNaam(r))}</strong>${r.ordernummer ? `, bij bestelling ${escapeHtml(r.ordernummer)}` : ''}.</p>
      <p>Beslissing: <strong>${escapeHtml(beslissing)}</strong>.</p>
      ${r.beslissing_notitie ? `<p>${escapeHtml(r.beslissing_notitie)}</p>` : ''}
      ${r.retouradres ? `<p><strong>Retouradres:</strong> ${escapeHtml(r.retouradres)}</p>` : ''}
      ${r.instructie ? `<p><strong>Zo stuur je het terug:</strong> ${escapeHtml(r.instructie)}</p>` : ''}
      <p>Vragen? Bel ${escapeHtml(site.phone)} of beantwoord deze mail.</p>`,
  });
  const res = await sendEmail({ to: naar, subject: `Retour ${retourNaam(r)}: ${beslissing}`, html, replyTo: site.email });
  return res.sent ? { sent: true } : { sent: false, reden: res.error };
}

/* =============================================================== klachten */

export type Klacht = {
  id: string;
  organisatie_id: string | null;
  order_id: string | null;
  medewerker_id: string | null;
  soort: string;
  omschrijving: string;
  status: string;
  antwoord: string | null;
  created_at: string;
};

export type KlachtMetLabels = Klacht & {
  organisatie_naam: string | null;
  ordernummer: string | null;
  categorie: string | null;
  prioriteit: KlachtPrioriteit;
  toegewezen_aan: string | null;
  toegewezen_naam: string | null;
  sla_reactie_voor: string;
  eerste_reactie_op: string | null;
  oorzaak: string | null;
  oplossing: string | null;
  opgelost_op: string | null;
  product_id: string | null;
  product_naam: string | null;
  product_merk: string | null;
  contact_id: string | null;
  contact_naam: string | null;
  medewerker_naam: string | null;
  bron: string;
  sla: SlaStaat;
};

export type SlaStaat = 'gehaald' | 'op_tijd' | 'bijna' | 'te_laat' | 'te_laat_gereageerd';

function isPrioriteit(v: unknown): v is KlachtPrioriteit {
  return typeof v === 'string' && (KLACHT_PRIORITEITEN as readonly string[]).includes(v);
}

export function slaDeadline(createdAt: string, prioriteit: KlachtPrioriteit, sla: SlaUren): string {
  return new Date(new Date(createdAt).getTime() + sla[prioriteit] * 3_600_000).toISOString();
}

/**
 * Staat van de streefreactietijd. "Te laat" alleen zolang er nog geen eerste
 * antwoord aan de klant is; daarna "gehaald" of "te laat gereageerd" (voor de analyse).
 */
export function slaStaat(k: { status: string; eerste_reactie_op: string | null; antwoord: string | null; sla_reactie_voor: string; prioriteit: KlachtPrioriteit }, sla: SlaUren, nu = Date.now()): SlaStaat {
  const voor = new Date(k.sla_reactie_voor).getTime();
  if (k.eerste_reactie_op) return new Date(k.eerste_reactie_op).getTime() <= voor ? 'gehaald' : 'te_laat_gereageerd';
  if (k.antwoord || k.status === 'afgehandeld') return 'gehaald';
  if (nu > voor) return 'te_laat';
  const venster = sla[k.prioriteit] * 3_600_000;
  return voor - nu < Math.max(venster * 0.25, 3_600_000) ? 'bijna' : 'op_tijd';
}

export async function listKlachten(): Promise<KlachtMetLabels[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const [{ data }, inst] = await Promise.all([
    sb
      .from('klachten')
      .select('*, organisaties(naam), orders(ordernummer)')
      .order('created_at', { ascending: false })
      .limit(2000),
    getKlachtInstellingen(),
  ]);
  const rijen = (data as Record<string, unknown>[] | null) ?? [];
  const [producten, personen, medewerkers] = await Promise.all([
    haalIn<{ id: string; naam: string; merk: string | null }>('producten', 'id, naam, merk', rijen.map((r) => String(r.product_id ?? ''))),
    haalIn<{ id: string; naam: string }>('taak_personen', 'id, naam', rijen.map((r) => String(r.toegewezen_aan ?? ''))),
    haalIn<{ id: string; naam: string }>('medewerkers', 'id, naam', rijen.map((r) => String(r.medewerker_id ?? ''))),
  ]);
  const prod = new Map(producten.map((p) => [p.id, p]));
  const pers = new Map(personen.map((p) => [p.id, p.naam]));
  const mw = new Map(medewerkers.map((p) => [p.id, p.naam]));

  return rijen.map((r) => {
    const prioriteit: KlachtPrioriteit = isPrioriteit(r.prioriteit) ? r.prioriteit : 'normaal';
    const created_at = String(r.created_at);
    const sla_reactie_voor = (r.sla_reactie_voor as string) ?? slaDeadline(created_at, prioriteit, inst.sla);
    const pid = (r.product_id as string) ?? null;
    const p = pid ? prod.get(pid) : undefined;
    const org = r.organisaties as { naam: string } | null;
    const ord = r.orders as { ordernummer: number | string | null } | null;
    const basis = {
      id: String(r.id),
      organisatie_id: (r.organisatie_id as string) ?? null,
      order_id: (r.order_id as string) ?? null,
      medewerker_id: (r.medewerker_id as string) ?? null,
      soort: String(r.soort ?? 'vraag'),
      omschrijving: String(r.omschrijving ?? ''),
      status: String(r.status ?? 'open'),
      antwoord: (r.antwoord as string) ?? null,
      created_at,
      organisatie_naam: org?.naam ?? null,
      ordernummer: ord?.ordernummer != null ? String(ord.ordernummer) : null,
      categorie: (r.categorie as string) ?? null,
      prioriteit,
      toegewezen_aan: (r.toegewezen_aan as string) ?? null,
      toegewezen_naam: r.toegewezen_aan ? pers.get(String(r.toegewezen_aan)) ?? null : null,
      sla_reactie_voor,
      eerste_reactie_op: (r.eerste_reactie_op as string) ?? null,
      oorzaak: (r.oorzaak as string) ?? null,
      oplossing: (r.oplossing as string) ?? null,
      opgelost_op: (r.opgelost_op as string) ?? null,
      product_id: pid,
      product_naam: p?.naam ?? null,
      product_merk: p?.merk ?? null,
      contact_id: (r.contact_id as string) ?? null,
      contact_naam: (r.contact_naam as string) ?? null,
      medewerker_naam: r.medewerker_id ? mw.get(String(r.medewerker_id)) ?? null : null,
      bron: String(r.bron ?? 'portaal'),
    };
    return { ...basis, sla: slaStaat(basis, inst.sla) };
  });
}

export type KlachtBericht = {
  id: string;
  soort: 'antwoord' | 'notitie' | 'klant';
  tekst: string;
  auteur: string | null;
  gemaild_op: string | null;
  created_at: string;
};

/** Gesprekstijdlijn. tabelBestaat=false zolang de migratie niet gedraaid is. */
export async function getKlachtBerichten(klachtId: string): Promise<{ berichten: KlachtBericht[]; tabelBestaat: boolean }> {
  const sb = kmsAdmin(); if (!sb || !isUuid(klachtId)) return { berichten: [], tabelBestaat: false };
  const { data, error } = await sb
    .from('klacht_berichten')
    .select('id, soort, tekst, auteur, gemaild_op, created_at')
    .eq('klacht_id', klachtId)
    .order('created_at');
  if (error) return { berichten: [], tabelBestaat: !tabelOntbreekt(error) };
  return { berichten: (data as KlachtBericht[]) ?? [], tabelBestaat: true };
}

/** Voor het portaal: alleen antwoorden en klantreacties, voor klachten die het portaal al (met RLS) heeft opgehaald. */
export async function berichtenVoorKlant(klachtIds: string[]): Promise<Map<string, KlachtBericht[]>> {
  const uit = new Map<string, KlachtBericht[]>();
  const sb = kmsAdmin();
  const ids = klachtIds.filter(isUuid);
  if (!sb || ids.length === 0) return uit;
  const { data, error } = await sb
    .from('klacht_berichten')
    .select('id, klacht_id, soort, tekst, auteur, gemaild_op, created_at')
    .in('klacht_id', ids.slice(0, 300))
    .in('soort', ['antwoord', 'klant'])
    .order('created_at');
  if (error) return uit;
  for (const b of (data as (KlachtBericht & { klacht_id: string })[]) ?? []) {
    const lijst = uit.get(b.klacht_id) ?? [];
    lijst.push({ ...b, auteur: b.soort === 'antwoord' ? site.name : b.auteur });
    uit.set(b.klacht_id, lijst);
  }
  return uit;
}

export type NieuweKlacht = {
  organisatie_id: string;
  order_id?: string | null;
  medewerker_id?: string | null;
  soort?: string | null;
  omschrijving: string;
  categorie?: string | null;
  prioriteit?: string | null;
  toegewezen_aan?: string | null;
  contact_id?: string | null;
  contact_naam?: string | null;
  product_id?: string | null;
  bron?: string | null;
};

const KLACHT_NIEUWE_KOLOMMEN = [
  'categorie',
  'prioriteit',
  'toegewezen_aan',
  'sla_reactie_voor',
  'contact_id',
  'contact_naam',
  'product_id',
  'bron',
];

export async function maakKlacht(velden: NieuweKlacht): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb || !isUuid(velden.organisatie_id)) return null;
  const inst = await getKlachtInstellingen();
  const prioriteit: KlachtPrioriteit = isPrioriteit(velden.prioriteit) ? velden.prioriteit : 'normaal';
  const nu = new Date().toISOString();
  const rij: Record<string, unknown> = {
    organisatie_id: velden.organisatie_id,
    order_id: isUuid(velden.order_id) ? velden.order_id : null,
    medewerker_id: isUuid(velden.medewerker_id) ? velden.medewerker_id : null,
    omschrijving: velden.omschrijving,
    soort: velden.soort === 'klacht' ? 'klacht' : 'vraag',
    categorie: tekst(velden.categorie),
    prioriteit,
    toegewezen_aan: isUuid(velden.toegewezen_aan) ? velden.toegewezen_aan : null,
    sla_reactie_voor: slaDeadline(nu, prioriteit, inst.sla),
    contact_id: isUuid(velden.contact_id) ? velden.contact_id : null,
    contact_naam: tekst(velden.contact_naam),
    product_id: isUuid(velden.product_id) ? velden.product_id : null,
    bron: tekst(velden.bron) ?? 'dashboard',
  };
  const { data, error } = await metIdTerugval(rij, KLACHT_NIEUWE_KOLOMMEN, (x) =>
    sb.from('klachten').insert(x).select('id').single(),
  );
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function zetKlachtStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const rij: Record<string, unknown> = { status };
  if (status === 'afgehandeld') rij.opgelost_op = new Date().toISOString();
  else rij.opgelost_op = null;
  const { error } = await metIdTerugval(rij, ['opgelost_op'], (x) => sb.from('klachten').update(x).eq('id', id));
  return !error;
}

/** Ticketvelden bijwerken: categorie, prioriteit, toegewezen, order, artikel. */
export async function werkKlachtBij(
  id: string,
  v: { categorie: string | null; prioriteit: string | null; toegewezen_aan: string | null; order_id: string | null; product_id: string | null; soort: string | null },
): Promise<{ ok: boolean; zonderMigratie: boolean }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, zonderMigratie: false };
  const prioriteit: KlachtPrioriteit = isPrioriteit(v.prioriteit) ? v.prioriteit : 'normaal';
  const inst = await getKlachtInstellingen();
  const { data: oud } = await sb.from('klachten').select('*').eq('id', id).maybeSingle();
  const o = (oud as Record<string, unknown> | null) ?? {};
  const rij: Record<string, unknown> = {
    order_id: isUuid(v.order_id) ? v.order_id : null,
    soort: v.soort === 'klacht' ? 'klacht' : 'vraag',
    categorie: tekst(v.categorie),
    prioriteit,
    toegewezen_aan: isUuid(v.toegewezen_aan) ? v.toegewezen_aan : null,
    product_id: isUuid(v.product_id) ? v.product_id : null,
  };
  // Andere prioriteit: streeftijd opnieuw berekenen vanaf binnenkomst.
  if (o.created_at && o.prioriteit !== prioriteit) rij.sla_reactie_voor = slaDeadline(String(o.created_at), prioriteit, inst.sla);
  const eerste = await sb.from('klachten').update(rij).eq('id', id);
  if (!eerste.error) return { ok: true, zonderMigratie: false };
  if (!kolomOntbreekt(eerste.error)) return { ok: false, zonderMigratie: false };
  const tweede = await sb.from('klachten').update({ order_id: rij.order_id, soort: rij.soort }).eq('id', id);
  return { ok: !tweede.error, zonderMigratie: true };
}

/**
 * Bericht in de tijdlijn. Een antwoord aan de klant komt ook in klachten.antwoord
 * (het portaal en oude code lezen dat), zet de eerste reactietijd en haalt een
 * open ticket naar "in behandeling". Zonder berichtentabel werkt alleen het antwoord.
 */
export async function voegKlachtBerichtToe(
  klachtId: string,
  soort: 'antwoord' | 'notitie' | 'klant',
  tekstIn: string,
  auteur: string | null,
): Promise<{ ok: boolean; berichtId: string | null; zonderMigratie: boolean }> {
  const sb = kmsAdmin();
  const inhoud = tekstIn.trim().slice(0, 8000);
  if (!sb || !isUuid(klachtId) || !inhoud) return { ok: false, berichtId: null, zonderMigratie: false };

  const { data, error } = await sb
    .from('klacht_berichten')
    .insert({ klacht_id: klachtId, soort, tekst: inhoud, auteur })
    .select('id')
    .single();
  const zonderMigratie = Boolean(error && tabelOntbreekt(error));
  if (error && !zonderMigratie) return { ok: false, berichtId: null, zonderMigratie: false };
  if (zonderMigratie && soort === 'notitie') return { ok: false, berichtId: null, zonderMigratie: true };

  const { data: k } = await sb.from('klachten').select('*').eq('id', klachtId).maybeSingle();
  const huidig = (k as Record<string, unknown> | null) ?? {};
  if (soort === 'antwoord') {
    const rij: Record<string, unknown> = { antwoord: inhoud };
    if (huidig.status === 'open') rij.status = 'in_behandeling';
    if (!huidig.eerste_reactie_op) rij.eerste_reactie_op = new Date().toISOString();
    await metIdTerugval(rij, ['eerste_reactie_op'], (x) => sb.from('klachten').update(x).eq('id', klachtId));
  } else if (soort === 'klant' && huidig.status === 'afgehandeld') {
    // Klant reageert op een gesloten ticket: weer open.
    await metIdTerugval({ status: 'open', opgelost_op: null }, ['opgelost_op'], (x) => sb.from('klachten').update(x).eq('id', klachtId));
  }
  return { ok: true, berichtId: (data as { id: string } | null)?.id ?? null, zonderMigratie };
}

/** Mailt een antwoord naar de contactpersoon of werknemer van de klacht. */
export async function mailKlachtAntwoord(klachtId: string, berichtId: string | null, antwoord: string): Promise<{ sent: boolean; reden?: string }> {
  const sb = kmsAdmin(); if (!sb) return { sent: false, reden: 'Database niet bereikbaar.' };
  const { data: k } = await sb.from('klachten').select('*').eq('id', klachtId).maybeSingle();
  const rij = k as Record<string, unknown> | null;
  if (!rij) return { sent: false, reden: 'Klacht niet gevonden.' };
  let naar: string | null = null;
  if (isUuid(rij.contact_id)) {
    const [c] = await haalIn<{ id: string; email: string | null }>('contactpersonen', 'id, email', [rij.contact_id]);
    naar = c?.email ?? null;
  }
  if (!naar && isUuid(rij.medewerker_id)) {
    const [m] = await haalIn<{ id: string; email: string | null }>('medewerkers', 'id, email', [rij.medewerker_id]);
    naar = m?.email ?? null;
  }
  if (!naar) return { sent: false, reden: 'Geen e-mailadres bekend bij deze vraag of klacht.' };
  const { sendEmail, emailLayout, escapeHtml } = await import('@/lib/email');
  const { env } = await import('@/lib/env');
  const link = `${env.siteUrl.replace(/\/$/, '')}/portaal/klachten`;
  const soortTekst = rij.soort === 'klacht' ? 'klacht' : 'vraag';
  const html = emailLayout({
    heading: `Antwoord op je ${soortTekst}`,
    preheader: antwoord.slice(0, 90),
    bodyHtml: `
      <p>${escapeHtml(antwoord).replace(/\n/g, '<br/>')}</p>
      <p style="margin-top:18px;color:#8a8784;font-size:13px;">Je ${soortTekst}: &ldquo;${escapeHtml(String(rij.omschrijving ?? '').slice(0, 300))}&rdquo;</p>
      <p>Je kunt reageren door deze mail te beantwoorden of in het <a href="${escapeHtml(link)}">klantportaal</a>.</p>`,
  });
  const res = await sendEmail({ to: naar, subject: `Antwoord op je ${soortTekst}`, html, replyTo: site.email });
  if (res.sent && berichtId) await sb.from('klacht_berichten').update({ gemaild_op: new Date().toISOString() }).eq('id', berichtId);
  return res.sent ? { sent: true } : { sent: false, reden: res.error };
}

/** Sluiten met oplossing en oorzaak (de oorzaak voedt de top 5 in de analyse). */
export async function sluitKlacht(id: string, oplossing: string | null, oorzaak: string | null): Promise<{ ok: boolean; zonderMigratie: boolean }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, zonderMigratie: false };
  const rij: Record<string, unknown> = {
    status: 'afgehandeld',
    oplossing,
    oorzaak,
    opgelost_op: new Date().toISOString(),
  };
  const eerste = await sb.from('klachten').update(rij).eq('id', id);
  if (!eerste.error) return { ok: true, zonderMigratie: false };
  if (!kolomOntbreekt(eerste.error)) return { ok: false, zonderMigratie: false };
  const tweede = await sb.from('klachten').update({ status: 'afgehandeld' }).eq('id', id);
  return { ok: !tweede.error, zonderMigratie: true };
}

/** Eerder ingevulde oorzaken, als suggesties bij het sluiten (zo groeperen ze netjes). */
export function bekendeOorzaken(klachten: KlachtMetLabels[]): string[] {
  const tel = new Map<string, { label: string; n: number }>();
  for (const k of klachten) {
    const o = tekst(k.oorzaak);
    if (!o) continue;
    const key = o.toLowerCase();
    const h = tel.get(key) ?? { label: o, n: 0 };
    h.n += 1;
    tel.set(key, h);
  }
  return [...tel.values()].sort((a, b) => b.n - a.n).map((x) => x.label).slice(0, 30);
}

/** Oude functie, nog gebruikt als terugval: antwoord direct in de kolom. */
export async function beantwoordKlacht(id: string, antwoord: string | null): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('klachten').update({ antwoord }).eq('id', id);
  return !error;
}
