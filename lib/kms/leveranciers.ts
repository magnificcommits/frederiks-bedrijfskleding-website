import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { kolomOntbreekt, metIdTerugval } from '@/lib/kms/kolomTerugval';
import { alleRijen, migratieOntbreekt } from '@/lib/kms/voorraad';

/**
 * Data-access voor leveranciers: overzicht met cijfers, detailpagina,
 * contactpersonen, documenten en notities.
 * Alle queries via kmsAdmin() (service-role). Alleen server-side, achter dashAuthed().
 *
 * Let op het model: elk MERK is een rij in `leveranciers`. De handelspartij waar
 * Jessi bestelt staat in `inkoop_bij` (Houweling levert tien merken). De
 * overzichtspagina groepeert daarom op inkooppartij.
 */

export type Document = { naam: string; url: string };

export type LeverancierVol = {
  id: string;
  leveranciersnummer: string | null;
  naam: string;
  contactpersoon: string | null;
  telefoon: string | null;
  telefoon_hoofdkantoor: string | null;
  email: string | null;
  levertijd_dagen: number | null;
  betaalcondities: string | null;
  merken: string[] | null;
  kortingspercentage: number | null;
  inkoop_bij: string | null;
  bestelportaal_url: string | null;
  bestelwijze: string | null;
  created_at: string;
  // Vanaf migratie 20261004_voorraad_inkoop_leveranciers:
  website?: string | null;
  logo_url?: string | null;
  klantnummer?: string | null;
  franco_bedrag?: number | null;
  notities?: string | null;
  documenten?: Document[] | null;
};

export const NIEUWE_LEVERANCIER_KOLOMMEN = ['website', 'logo_url', 'klantnummer', 'franco_bedrag', 'notities', 'documenten'];

export const CONTACT_ROLLEN = ['binnendienst', 'accountmanager', 'buitendienst', 'administratie', 'retouren', 'overig'] as const;

/**
 * Logo's die in public/Logo's leveranciers staan. Sleutel = stuk van de naam
 * (kleine letters, zonder spaties of streepjes).
 */
const LOGO_BESTANDEN: [string, string][] = [
  ['fhb', 'FHB-Workwear-Logo.jpg'],
  ['chaud', 'chaud-devant.png'],
  ['berkel', 'logo-deberkel.svg'],
  ['mascot', 'mascot-workwear.png'],
  ['snickers', 'snickers-workwear.webp'],
  ['tricorp', 'tricorp.webp'],
  ['upower', 'u-power workwear.webp'],
];

export function logoVoor(naam: string | null | undefined, eigen?: string | null): string | null {
  const url = (eigen ?? '').trim();
  if (url && (/^https?:\/\//i.test(url) || url.startsWith('/'))) return url;
  const sleutel = (naam ?? '').toLowerCase().replace(/[\s\-_.]/g, '');
  const hit = LOGO_BESTANDEN.find(([k]) => sleutel.includes(k));
  return hit ? `/Logo%27s%20leveranciers/${encodeURIComponent(hit[1])}` : null;
}

/** Initialen voor als er geen logo is: "Brook Taverner" -> "BT". */
export function initialen(naam: string): string {
  const delen = naam.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (delen.length === 0) return '?';
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[1][0]).toUpperCase();
}

type RegelDb = {
  id: string;
  leverancier_id: string | null;
  variant_id: string | null;
  order_id: string | null;
  aantal: number;
  geleverd_aantal: number | null;
  status: string;
  besteld_op: string | null;
  created_at: string;
  inkooporder_id?: string | null;
  inkoopprijs?: number | null;
  ontvangen_op?: string | null;
};

type PoDb = {
  id: string;
  nummer: number | null;
  status: string;
  inkoop_partij: string | null;
  besteld_op: string | null;
  verwacht_op: string | null;
  ontvangen_op: string | null;
  created_at: string;
};

async function haalRegels(sb: SupabaseClient, leverancierIds?: string[]): Promise<{ regels: RegelDb[]; nieuw: boolean }> {
  const basis = 'id, leverancier_id, variant_id, order_id, aantal, geleverd_aantal, status, besteld_op, created_at';
  const bouw = (kolommen: string) => (van: number, tot: number) => {
    let q = sb.from('inkoopregels').select(kolommen).range(van, tot);
    if (leverancierIds) q = q.in('leverancier_id', leverancierIds);
    return q;
  };
  const met = await alleRijen<RegelDb>(bouw(`${basis}, inkooporder_id, inkoopprijs, ontvangen_op`));
  if (!met.error) return { regels: met.rijen, nieuw: true };
  if (!kolomOntbreekt(met.error)) return { regels: [], nieuw: true };
  const zonder = await alleRijen<RegelDb>(bouw(basis));
  return { regels: zonder.rijen, nieuw: false };
}

async function haalPos(sb: SupabaseClient): Promise<{ pos: Map<string, PoDb>; klaar: boolean }> {
  const { rijen, error } = await alleRijen<PoDb>((van, tot) =>
    sb.from('inkooporders').select('id, nummer, status, inkoop_partij, besteld_op, verwacht_op, ontvangen_op, created_at').range(van, tot),
  );
  return { pos: new Map(rijen.map((p) => [p.id, p])), klaar: !error || !migratieOntbreekt(error) };
}

async function haalPrijzen(sb: SupabaseClient, regels: RegelDb[]): Promise<Map<string, number>> {
  const ids = [...new Set(regels.filter((r) => r.inkoopprijs == null && r.variant_id).map((r) => r.variant_id as string))];
  const kaart = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await sb.from('product_varianten').select('id, inkoopprijs').in('id', ids.slice(i, i + 150));
    for (const v of (data as { id: string; inkoopprijs: number | null }[]) ?? []) if (v.inkoopprijs != null) kaart.set(v.id, Number(v.inkoopprijs));
  }
  return kaart;
}

const prijsVan = (r: RegelDb, prijzen: Map<string, number>) =>
  r.inkoopprijs != null ? Number(r.inkoopprijs) : r.variant_id ? prijzen.get(r.variant_id) ?? 0 : 0;

const OPEN_PO = ['concept', 'verstuurd', 'deels_ontvangen'];

function dagen(van: string, tot: string): number {
  return Math.round((Date.parse(`${tot.slice(0, 10)}T12:00:00Z`) - Date.parse(`${van.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

function vatSamenPerLeverancier(regels: RegelDb[], pos: Map<string, PoDb>, prijzen: Map<string, number>) {
  const jaarStart = `${new Date().getFullYear()}-01-01`;
  const uit = new Map<string, { openPos: Set<string>; openRegels: number; inkoopJaar: number; levertijden: number[] }>();
  for (const r of regels) {
    if (!r.leverancier_id) continue;
    const s = uit.get(r.leverancier_id) ?? { openPos: new Set<string>(), openRegels: 0, inkoopJaar: 0, levertijden: [] };
    const po = r.inkooporder_id ? pos.get(r.inkooporder_id) : undefined;
    if (po && OPEN_PO.includes(po.status)) s.openPos.add(po.id);
    if (r.status === 'besteld' || r.status === 'deels') s.openRegels += 1;
    const besteld = po?.besteld_op ?? r.besteld_op;
    if (besteld && besteld >= jaarStart && r.status !== 'te_bestellen') s.inkoopJaar += prijsVan(r, prijzen) * (Number(r.aantal) || 0);
    const ontvangen = po?.ontvangen_op ?? r.ontvangen_op ?? null;
    if (besteld && ontvangen && r.status === 'geleverd') s.levertijden.push(Math.max(0, dagen(besteld, ontvangen)));
    uit.set(r.leverancier_id, s);
  }
  return uit;
}

export type LeverancierKaart = LeverancierVol & {
  logo: string | null;
  aantalProducten: number;
  openInkooporders: number;
  openRegels: number;
  inkoopwaardeJaar: number;
  /** Gemeten uit ontvangsten, anders null. */
  gemLevertijd: number | null;
};

export type LeverancierOverzicht = {
  leveranciers: LeverancierKaart[];
  /** Bestaan de inkooporders al (migratie)? Anders tellen we open regels. */
  inkoopordersKlaar: boolean;
};

export async function listLeveranciersOverzicht(): Promise<LeverancierOverzicht> {
  const sb = kmsAdmin();
  if (!sb) return { leveranciers: [], inkoopordersKlaar: false };

  const [{ data: levData }, productRes, { regels }, { pos, klaar }] = await Promise.all([
    sb.from('leveranciers').select('*').order('naam'),
    alleRijen<{ leverancier_id: string | null; merk: string | null }>((van, tot) =>
      sb.from('producten').select('leverancier_id, merk').range(van, tot),
    ),
    haalRegels(sb),
    haalPos(sb),
  ]);
  const prijzen = await haalPrijzen(sb, regels);
  const stats = vatSamenPerLeverancier(regels, pos, prijzen);

  const perLev = new Map<string, number>();
  const perMerk = new Map<string, number>();
  for (const p of productRes.rijen) {
    if (p.leverancier_id) perLev.set(p.leverancier_id, (perLev.get(p.leverancier_id) ?? 0) + 1);
    else if (p.merk) perMerk.set(p.merk.toLowerCase(), (perMerk.get(p.merk.toLowerCase()) ?? 0) + 1);
  }

  const leveranciers = ((levData as LeverancierVol[]) ?? []).map((l) => {
    const s = stats.get(l.id);
    const losse = (l.merken ?? []).reduce((t, m) => t + (perMerk.get(m.toLowerCase()) ?? 0), 0);
    const gem = s && s.levertijden.length ? Math.round(s.levertijden.reduce((a, b) => a + b, 0) / s.levertijden.length) : null;
    return {
      ...l,
      logo: logoVoor(l.naam, l.logo_url),
      aantalProducten: (perLev.get(l.id) ?? 0) + losse,
      openInkooporders: s?.openPos.size ?? 0,
      openRegels: s?.openRegels ?? 0,
      inkoopwaardeJaar: Math.round((s?.inkoopJaar ?? 0) * 100) / 100,
      gemLevertijd: gem,
    };
  });
  return { leveranciers, inkoopordersKlaar: klaar };
}

/* ---------------------------------------------------------------- detail */

export type Contact = {
  id: string;
  leverancier_id: string;
  naam: string;
  rol: string | null;
  email: string | null;
  telefoon: string | null;
  notitie: string | null;
};

export type MaandInkoop = { sleutel: string; label: string; labelLang: string; waarde: number; regels: number };

export type OpenBestelling = {
  id: string;
  soort: 'inkooporder' | 'regel';
  titel: string;
  status: string;
  besteld_op: string | null;
  verwacht_op: string | null;
  stuks: number;
  ontvangen: number;
  waarde: number;
  teLaat: boolean;
};

export type Betrouwbaarheid = {
  /** Aantal ontvangen inkooporders met een verwachte datum. */
  gemeten: number;
  opTijd: number;
  teLaat: number;
  gemDagenTeLaat: number | null;
  gemLevertijd: number | null;
};

export type ProductKort = { id: string; naam: string; merk: string | null; categorie: string | null; foto: string | null; actief: boolean };

export type LeverancierDetail = {
  leverancier: LeverancierVol;
  logo: string | null;
  partijGenoten: { id: string; naam: string }[];
  contacten: Contact[];
  contactenKlaar: boolean;
  velden: { nieuw: boolean };
  producten: ProductKort[];
  aantalProducten: number;
  maanden: MaandInkoop[];
  inkoopJaar: number;
  open: OpenBestelling[];
  openWaarde: number;
  betrouwbaarheid: Betrouwbaarheid;
  inkoopordersKlaar: boolean;
};

const MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAAND_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function laatste12Maanden(): MaandInkoop[] {
  const nu = new Date();
  const uit: MaandInkoop[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    uit.push({
      sleutel: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MAAND_KORT[d.getMonth()],
      labelLang: `${MAAND_LANG[d.getMonth()]} ${d.getFullYear()}`,
      waarde: 0,
      regels: 0,
    });
  }
  return uit;
}

export async function getLeverancierDetail(id: string): Promise<LeverancierDetail | null> {
  const sb = kmsAdmin();
  if (!sb || !id) return null;
  const { data } = await sb.from('leveranciers').select('*').eq('id', id).maybeSingle();
  const lev = data as LeverancierVol | null;
  if (!lev) return null;

  const merken = (lev.merken ?? []).filter(Boolean);
  const [genotenRes, contactRes, prodLev, prodMerk, { regels }, { pos, klaar }] = await Promise.all([
    lev.inkoop_bij
      ? sb.from('leveranciers').select('id, naam').eq('inkoop_bij', lev.inkoop_bij).neq('id', id).order('naam')
      : Promise.resolve({ data: [] as { id: string; naam: string }[] }),
    sb.from('leverancier_contacten').select('*').eq('leverancier_id', id).order('created_at'),
    sb.from('producten').select('id, naam, merk, categorie, afbeeldingen, actief').eq('leverancier_id', id).order('naam').limit(1000),
    merken.length
      ? sb.from('producten').select('id, naam, merk, categorie, afbeeldingen, actief').in('merk', merken).is('leverancier_id', null).order('naam').limit(1000)
      : Promise.resolve({ data: [] }),
    haalRegels(sb, [id]),
    haalPos(sb),
  ]);

  type P = { id: string; naam: string; merk: string | null; categorie: string | null; afbeeldingen: string[] | null; actief: boolean | null };
  const alleProducten = [...((prodLev.data as P[]) ?? []), ...((prodMerk.data as P[]) ?? [])];
  const producten: ProductKort[] = alleProducten.map((p) => ({
    id: p.id,
    naam: p.naam,
    merk: p.merk,
    categorie: p.categorie,
    foto: (p.afbeeldingen ?? []).find((u) => typeof u === 'string' && u.trim()) ?? null,
    actief: p.actief !== false,
  }));

  const prijzen = await haalPrijzen(sb, regels);
  const maanden = laatste12Maanden();
  const index = new Map(maanden.map((m, i) => [m.sleutel, i]));
  const jaarStart = `${new Date().getFullYear()}-01-01`;
  const vandaag = new Date().toISOString().slice(0, 10);
  let inkoopJaar = 0;

  const openPerPo = new Map<string, OpenBestelling>();
  const losseOpen: OpenBestelling[] = [];
  const levertijden: number[] = [];
  const gemetenPos = new Map<string, { opTijd: boolean; dagenLaat: number }>();

  for (const r of regels) {
    const po = r.inkooporder_id ? pos.get(r.inkooporder_id) : undefined;
    const besteld = po?.besteld_op ?? r.besteld_op;
    const prijs = prijsVan(r, prijzen);
    const aantal = Number(r.aantal) || 0;
    const geleverd = Number(r.geleverd_aantal) || 0;
    if (besteld && r.status !== 'te_bestellen') {
      const i = index.get(besteld.slice(0, 7));
      if (i !== undefined) {
        maanden[i].waarde += prijs * aantal;
        maanden[i].regels += 1;
      }
      if (besteld >= jaarStart) inkoopJaar += prijs * aantal;
    }

    const ontvangen = po?.ontvangen_op ?? r.ontvangen_op ?? null;
    if (besteld && ontvangen && r.status === 'geleverd') levertijden.push(Math.max(0, dagen(besteld, ontvangen)));
    if (po && po.status === 'ontvangen' && po.verwacht_op && po.ontvangen_op && !gemetenPos.has(po.id)) {
      const laat = dagen(po.verwacht_op, po.ontvangen_op);
      gemetenPos.set(po.id, { opTijd: laat <= 0, dagenLaat: Math.max(0, laat) });
    }

    if (po && OPEN_PO.includes(po.status)) {
      const o = openPerPo.get(po.id) ?? {
        id: po.id,
        soort: 'inkooporder' as const,
        titel: `Inkooporder ${po.nummer ?? ''}`.trim(),
        status: po.status,
        besteld_op: po.besteld_op,
        verwacht_op: po.verwacht_op,
        stuks: 0,
        ontvangen: 0,
        waarde: 0,
        teLaat: Boolean(po.verwacht_op && po.verwacht_op < vandaag && po.status !== 'concept'),
      };
      o.stuks += aantal;
      o.ontvangen += Math.min(aantal, geleverd);
      o.waarde += prijs * Math.max(0, aantal - geleverd);
      openPerPo.set(po.id, o);
    } else if (!po && (r.status === 'besteld' || r.status === 'deels')) {
      const verwacht = r.besteld_op && lev.levertijd_dagen ? new Date(Date.parse(r.besteld_op) + lev.levertijd_dagen * 86_400_000).toISOString().slice(0, 10) : null;
      losseOpen.push({
        id: r.id,
        soort: 'regel',
        titel: 'Losse inkoopregel',
        status: r.status,
        besteld_op: r.besteld_op,
        verwacht_op: verwacht,
        stuks: aantal,
        ontvangen: geleverd,
        waarde: prijs * Math.max(0, aantal - geleverd),
        teLaat: Boolean(verwacht && verwacht < vandaag),
      });
    }
  }
  for (const m of maanden) m.waarde = Math.round(m.waarde * 100) / 100;
  const open = [...openPerPo.values(), ...losseOpen].sort((a, b) => (a.verwacht_op ?? '9999').localeCompare(b.verwacht_op ?? '9999'));

  const gemeten = [...gemetenPos.values()];
  const laat = gemeten.filter((g) => !g.opTijd);
  const contactFout = (contactRes as { error?: { code?: string; message?: string } | null }).error;

  return {
    leverancier: { ...lev, documenten: Array.isArray(lev.documenten) ? lev.documenten : [] },
    logo: logoVoor(lev.naam, lev.logo_url),
    partijGenoten: ((genotenRes.data as { id: string; naam: string }[]) ?? []),
    contacten: contactFout ? [] : ((contactRes.data as Contact[]) ?? []),
    contactenKlaar: !contactFout || !migratieOntbreekt(contactFout),
    velden: { nieuw: 'documenten' in lev },
    producten,
    aantalProducten: producten.length,
    maanden,
    inkoopJaar: Math.round(inkoopJaar * 100) / 100,
    open,
    openWaarde: Math.round(open.reduce((t, o) => t + o.waarde, 0) * 100) / 100,
    betrouwbaarheid: {
      gemeten: gemeten.length,
      opTijd: gemeten.length - laat.length,
      teLaat: laat.length,
      gemDagenTeLaat: laat.length ? Math.round(laat.reduce((t, g) => t + g.dagenLaat, 0) / laat.length) : null,
      gemLevertijd: levertijden.length ? Math.round(levertijden.reduce((a, b) => a + b, 0) / levertijden.length) : null,
    },
    inkoopordersKlaar: klaar,
  };
}

/* ---------------------------------------------------------------- schrijven */

export type LeverancierInvoer = Partial<Omit<LeverancierVol, 'id' | 'created_at'>>;

/** Update met terugval: bestaan de nieuwe kolommen nog niet, dan opnieuw zonder. */
export async function werkLeverancierBij(id: string, velden: LeverancierInvoer): Promise<{ ok: boolean; zonderNieuw: boolean }> {
  const sb = kmsAdmin();
  if (!sb || !id) return { ok: false, zonderNieuw: false };
  let zonderNieuw = false;
  const res = await metIdTerugval(velden as Record<string, unknown>, NIEUWE_LEVERANCIER_KOLOMMEN, async (rij) => {
    if (rij !== (velden as Record<string, unknown>)) zonderNieuw = true;
    return sb.from('leveranciers').update(rij).eq('id', id);
  });
  return { ok: !res.error, zonderNieuw };
}

export async function maakLeverancierVol(velden: LeverancierInvoer & { naam: string }): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const res = await metIdTerugval(velden as Record<string, unknown>, NIEUWE_LEVERANCIER_KOLOMMEN, (rij) =>
    sb.from('leveranciers').insert(rij).select('id').single(),
  );
  if (res.error || !res.data) return null;
  return (res.data as { id: string }).id;
}

export async function voegContactToe(c: Omit<Contact, 'id'>): Promise<{ ok: boolean; migratie: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, migratie: false };
  const { error } = await sb.from('leverancier_contacten').insert(c);
  return { ok: !error, migratie: Boolean(error && migratieOntbreekt(error)) };
}

export async function werkContactBij(id: string, c: Partial<Omit<Contact, 'id' | 'leverancier_id'>>): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const { error } = await sb.from('leverancier_contacten').update(c).eq('id', id);
  return !error;
}

export async function verwijderContact(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !id) return false;
  const { error } = await sb.from('leverancier_contacten').delete().eq('id', id);
  return !error;
}

/** Een link is alleen bruikbaar met http(s); zonder schema zetten we er https:// voor. */
export function veiligeUrl(ruw: string): string | null {
  const s = ruw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+-]*:/i.test(s) || /\s/.test(s) || !/^[^/]+\.[a-z]{2,}/i.test(s)) return null;
  return `https://${s}`;
}

export async function zetDocumenten(id: string, documenten: Document[]): Promise<{ ok: boolean; migratie: boolean }> {
  const sb = kmsAdmin();
  if (!sb || !id) return { ok: false, migratie: false };
  const { error } = await sb.from('leveranciers').update({ documenten }).eq('id', id);
  return { ok: !error, migratie: Boolean(error && migratieOntbreekt(error)) };
}
