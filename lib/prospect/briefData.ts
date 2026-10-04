import QRCode from 'qrcode';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { mockupsVoorProspecten } from './dashboard';
import { korteUrl, PROSPECT_VELDEN, type ProspectRij } from './prospect';
import { normaliseerBriefOntwerp, type BriefOntwerp } from './briefTypes';
import type { BriefPersoon } from './briefRender';
import { effectieveStatus, funnelNiveau, isOntvangerStatus, type FunnelBewijs, type OntvangerStatus } from './briefStatus';

/**
 * Data-access voor verzendingen (brief_batches), ontvangers (brief_ontvangers) en
 * eigen templates (brief_templates). Alleen server-side, achter dashAuthed().
 *
 * Zolang de migratie 20261004_brief_batches.sql niet gedraaid is bestaan de
 * tabellen niet. Dan geven de lijsten leeg terug met `actief: false` en valt de
 * pagina terug op de oude flow.
 */

type PgFout = { code?: string; message?: string } | null | undefined;

/** Tabel of kolom bestaat (nog) niet. */
export function tabelOntbreekt(f: PgFout): boolean {
  if (!f) return false;
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(f.code))) return true;
  const m = String(f.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('could not find') || m.includes('schema cache');
}

export type BriefBatch = {
  id: string;
  naam: string;
  ontwerp: BriefOntwerp | null;
  template_id: string | null;
  status: string;
  geprint_op: string | null;
  verstuurd_op: string | null;
  notitie: string | null;
  created_at: string;
};

export type BriefOntvanger = {
  id: string;
  batch_id: string;
  prospect_id: string;
  status: string;
  geprint_op: string | null;
  verstuurd_op: string | null;
  eerste_scan_op: string | null;
  laatste_scan_op: string | null;
  aantal_scans: number;
  gereageerd_op: string | null;
  klant_op: string | null;
  notitie: string | null;
  created_at: string;
};

export type EigenTemplate = { id: string; naam: string; omschrijving: string | null; ontwerp: BriefOntwerp; updated_at: string | null };

const BATCH_VELDEN = 'id, naam, ontwerp, template_id, status, geprint_op, verstuurd_op, notitie, created_at';
const ONTVANGER_VELDEN = 'id, batch_id, prospect_id, status, geprint_op, verstuurd_op, eerste_scan_op, laatste_scan_op, aantal_scans, gereageerd_op, klant_op, notitie, created_at';

function batchUit(r: Record<string, unknown>): BriefBatch {
  return { ...(r as unknown as BriefBatch), ontwerp: normaliseerBriefOntwerp(r.ontwerp) };
}

/** Stukken van 150 id's, zodat de url van een .in()-filter niet te lang wordt. */
function stukken<T>(lijst: T[], n = 150): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += n) uit.push(lijst.slice(i, i + n));
  return uit;
}

export async function listBatches(): Promise<{ actief: boolean; batches: BriefBatch[] }> {
  const sb = kmsAdmin();
  if (!sb) return { actief: false, batches: [] };
  const { data, error } = await sb.from('brief_batches').select(BATCH_VELDEN).order('created_at', { ascending: false }).limit(200);
  if (error) return { actief: !tabelOntbreekt(error), batches: [] };
  return { actief: true, batches: ((data as Record<string, unknown>[] | null) ?? []).map(batchUit) };
}

export async function getBatch(id: string): Promise<{ actief: boolean; batch: BriefBatch | null }> {
  const sb = kmsAdmin();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return { actief: Boolean(sb), batch: null };
  const { data, error } = await sb.from('brief_batches').select(BATCH_VELDEN).eq('id', id).maybeSingle();
  if (error) return { actief: !tabelOntbreekt(error), batch: null };
  return { actief: true, batch: data ? batchUit(data as Record<string, unknown>) : null };
}

export async function listOntvangers(opts: { batchIds?: string[]; prospectIds?: string[] }): Promise<BriefOntvanger[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const uit: BriefOntvanger[] = [];
  const kolom = opts.batchIds ? 'batch_id' : 'prospect_id';
  const ids = opts.batchIds ?? opts.prospectIds;
  if (ids && ids.length === 0) return [];
  const groepen = ids ? stukken(ids) : [null];
  for (const groep of groepen) {
    for (let van = 0; van < 20_000; van += 1000) {
      let q = sb.from('brief_ontvangers').select(ONTVANGER_VELDEN).order('created_at').range(van, van + 999);
      if (groep) q = q.in(kolom, groep);
      const { data, error } = await q;
      if (error || !data) break;
      uit.push(...(data as BriefOntvanger[]));
      if (data.length < 1000) break;
    }
  }
  return uit;
}

export async function listEigenTemplates(): Promise<{ actief: boolean; templates: EigenTemplate[] }> {
  const sb = kmsAdmin();
  if (!sb) return { actief: false, templates: [] };
  const { data, error } = await sb.from('brief_templates').select('id, naam, omschrijving, ontwerp, updated_at').order('naam').limit(100);
  if (error) return { actief: !tabelOntbreekt(error), templates: [] };
  const templates = ((data as Record<string, unknown>[] | null) ?? [])
    .map((r) => ({ ...(r as unknown as EigenTemplate), ontwerp: normaliseerBriefOntwerp(r.ontwerp) }))
    .filter((t): t is EigenTemplate => Boolean(t.ontwerp));
  return { actief: true, templates };
}

export async function prospectenOpIds(ids: string[]): Promise<ProspectRij[]> {
  const sb = kmsAdmin();
  if (!sb || ids.length === 0) return [];
  const uit: ProspectRij[] = [];
  for (const groep of stukken([...new Set(ids)])) {
    const { data } = await sb.from('prospecten').select(PROSPECT_VELDEN).in('id', groep);
    uit.push(...((data as ProspectRij[] | null) ?? []));
  }
  return uit;
}

export type BezoekRij = { prospect_id: string; soort: string; pad: string | null; created_at: string };

export async function bezoekenVoor(prospectIds: string[]): Promise<BezoekRij[]> {
  const sb = kmsAdmin();
  if (!sb || prospectIds.length === 0) return [];
  const uit: BezoekRij[] = [];
  for (const groep of stukken([...new Set(prospectIds)])) {
    const { data } = await sb
      .from('prospect_bezoeken')
      .select('prospect_id, soort, pad, created_at')
      .in('prospect_id', groep)
      .order('created_at', { ascending: true })
      .limit(5000);
    uit.push(...((data as BezoekRij[] | null) ?? []));
  }
  return uit;
}

export type TaakInfo = { id: string; open: boolean; vervaldatum: string | null; werkstatus: string | null };

/** De ene prospecttaak per prospect (bron 'prospect'), als die er is en niet weggegooid. */
export async function takenVoor(prospectIds: string[]): Promise<Map<string, TaakInfo>> {
  const sb = kmsAdmin();
  const uit = new Map<string, TaakInfo>();
  if (!sb || prospectIds.length === 0) return uit;
  for (const groep of stukken([...new Set(prospectIds)])) {
    const haal = (velden: string) => sb.from('taken').select(velden).eq('bron', 'prospect').in('prospect_id', groep);
    let res = await haal('id, prospect_id, status, vervaldatum, werkstatus, verwijderd_op');
    if (res.error && tabelOntbreekt(res.error)) res = await haal('id, prospect_id, status, vervaldatum, werkstatus');
    type Rij = { id: string; prospect_id: string; status: string; vervaldatum: string | null; werkstatus: string | null; verwijderd_op?: string | null };
    for (const t of (res.data as unknown as Rij[] | null) ?? []) {
      if (t.verwijderd_op) continue;
      uit.set(t.prospect_id, { id: t.id, open: t.status !== 'klaar', vervaldatum: t.vervaldatum, werkstatus: t.werkstatus });
    }
  }
  return uit;
}

/* ------------------------------------------------------------------ */
/* Ontvangers verrijken: scans toewijzen, effectieve status, funnel     */
/* ------------------------------------------------------------------ */

export type PaginaBezoek = { soort: string; pad: string | null; op: string };

export type VerrijkteOntvanger = {
  ontvanger: BriefOntvanger;
  prospect: ProspectRij | null;
  status: OntvangerStatus;
  qrScans: number;
  eersteScan: string | null;
  laatsteScan: string | null;
  portaalBezoeken: number;
  aanvragen: number;
  /** Alle bezoeken die bij deze brief horen (na versturen), oudste eerst. */
  bezoeken: PaginaBezoek[];
  niveau: number;
};

/** Vanaf wanneer een bezoek bij deze brief hoort. */
function vanaf(o: BriefOntvanger): number {
  if (o.verstuurd_op) return Date.parse(`${o.verstuurd_op}T00:00:00Z`) - 2 * 3600_000;
  if (o.geprint_op) return Date.parse(`${o.geprint_op}T00:00:00Z`) - 2 * 3600_000;
  return Date.parse(o.created_at);
}

export const isPortaal = (b: { soort: string; pad: string | null }) => b.soort === 'portaal' || /\/portaal(\/|$|\?)/.test(b.pad ?? '');

/**
 * Koppelt bezoeken aan ontvangers. Staat een prospect in meer verzendingen, dan
 * hoort een bezoek bij de laatste brief die vóór dat bezoek verstuurd was. Daarom
 * kijken we naar alle ontvangers van dezelfde prospects, niet alleen deze batch.
 */
export async function verrijkOntvangers(ontvangers: BriefOntvanger[]): Promise<VerrijkteOntvanger[]> {
  if (ontvangers.length === 0) return [];
  const prospectIds = [...new Set(ontvangers.map((o) => o.prospect_id))];
  const [alleVanProspects, prospecten, bezoeken] = await Promise.all([
    listOntvangers({ prospectIds }),
    prospectenOpIds(prospectIds),
    bezoekenVoor(prospectIds),
  ]);
  const perProspect = new Map(prospecten.map((p) => [p.id, p]));
  const briefPerProspect = new Map<string, BriefOntvanger[]>();
  for (const o of alleVanProspects.length ? alleVanProspects : ontvangers) {
    const l = briefPerProspect.get(o.prospect_id) ?? [];
    l.push(o);
    briefPerProspect.set(o.prospect_id, l);
  }
  for (const l of briefPerProspect.values()) l.sort((a, b) => vanaf(a) - vanaf(b));

  const bezoekenPerOntvanger = new Map<string, PaginaBezoek[]>();
  for (const b of bezoeken) {
    const t = Date.parse(b.created_at);
    const kandidaten = briefPerProspect.get(b.prospect_id) ?? [];
    let doel: BriefOntvanger | null = null;
    for (const o of kandidaten) if (vanaf(o) <= t) doel = o;
    if (!doel) continue;
    const l = bezoekenPerOntvanger.get(doel.id) ?? [];
    l.push({ soort: b.soort, pad: b.pad, op: b.created_at });
    bezoekenPerOntvanger.set(doel.id, l);
  }

  return ontvangers.map((o) => {
    const p = perProspect.get(o.prospect_id) ?? null;
    const bz = bezoekenPerOntvanger.get(o.id) ?? [];
    const qr = bz.filter((b) => b.soort === 'qr');
    const portaal = bz.filter(isPortaal).length;
    const aanvragen = bz.filter((b) => b.soort === 'aanvraag').length;
    const status = effectieveStatus(o.status, qr.length);
    const bewijs: FunnelBewijs = { status, prospectStatus: p?.status ?? '', qrScans: qr.length, portaalBezoeken: portaal, aanvragen };
    return {
      ontvanger: o,
      prospect: p,
      status,
      qrScans: qr.length,
      eersteScan: qr[0]?.op ?? null,
      laatsteScan: qr[qr.length - 1]?.op ?? null,
      portaalBezoeken: portaal,
      aanvragen,
      bezoeken: bz,
      niveau: funnelNiveau(bewijs),
    };
  });
}

/**
 * Zet de scan-gegevens en de status 'gescand' ook echt in brief_ontvangers, zodat
 * filters en exports ze zien. Best effort en alleen voor rijen die veranderen.
 */
export async function bewaarScans(rijen: VerrijkteOntvanger[]): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  const werk = rijen.filter((r) => {
    const o = r.ontvanger;
    return (
      (r.status !== o.status && isOntvangerStatus(r.status)) ||
      (o.aantal_scans ?? 0) !== r.qrScans ||
      (r.eersteScan && !o.eerste_scan_op)
    );
  });
  for (const r of werk.slice(0, 100)) {
    try {
      await sb
        .from('brief_ontvangers')
        .update({
          status: r.status,
          aantal_scans: r.qrScans,
          eerste_scan_op: r.ontvanger.eerste_scan_op ?? r.eersteScan,
          laatste_scan_op: r.laatsteScan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.ontvanger.id);
    } catch {
      // volgende keer opnieuw
    }
  }
}

/* ------------------------------------------------------------------ */
/* Briefdata voor de A4-weergave                                       */
/* ------------------------------------------------------------------ */

export async function qrDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1c1c1c', light: '#ffffff' } });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function briefPersonen(prospecten: ProspectRij[], opties: { mockups?: boolean } = {}): Promise<BriefPersoon[]> {
  if (prospecten.length === 0) return [];
  const [mockups, qrs] = await Promise.all([
    opties.mockups === false ? Promise.resolve(new Map()) : mockupsVoorProspecten(prospecten),
    Promise.all(prospecten.map((p) => qrDataUrl(korteUrl(p.token)))),
  ]);
  return prospecten.map((p, i) => ({
    id: p.id,
    bedrijfsnaam: p.bedrijfsnaam,
    contactpersoon: p.contactpersoon,
    plaats: p.plaats,
    branche: p.branche,
    adres: p.adres,
    postcode: p.postcode,
    logoUrl: p.logo_url,
    korteUrl: korteUrl(p.token),
    qr: qrs[i],
    mockups: (mockups.get(p.id) ?? []).slice(0, 4),
  }));
}

/* ------------------------------------------------------------------ */
/* Voor de prospectlijst en de prospectpagina                          */
/* ------------------------------------------------------------------ */

export type ProspectBrief = { ontvangerId: string; batchId: string; batchNaam: string; status: string; verstuurd_op: string | null; created_at: string };

/** Alle brieven per prospect, nieuwste eerst. Leeg zonder migratie. */
export async function brievenVanProspecten(prospectIds: string[]): Promise<Map<string, ProspectBrief[]>> {
  const uit = new Map<string, ProspectBrief[]>();
  const sb = kmsAdmin();
  if (!sb || prospectIds.length === 0) return uit;
  const ontvangers = await listOntvangers({ prospectIds });
  if (ontvangers.length === 0) return uit;
  const batchIds = [...new Set(ontvangers.map((o) => o.batch_id))];
  const namen = new Map<string, string>();
  for (const groep of stukken(batchIds)) {
    const { data } = await sb.from('brief_batches').select('id, naam').in('id', groep);
    for (const b of (data as { id: string; naam: string }[] | null) ?? []) namen.set(b.id, b.naam);
  }
  for (const o of ontvangers) {
    const l = uit.get(o.prospect_id) ?? [];
    l.push({ ontvangerId: o.id, batchId: o.batch_id, batchNaam: namen.get(o.batch_id) ?? 'Verzending', status: o.status, verstuurd_op: o.verstuurd_op, created_at: o.created_at });
    uit.set(o.prospect_id, l);
  }
  for (const l of uit.values()) l.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return uit;
}

