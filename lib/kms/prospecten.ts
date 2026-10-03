import { kmsAdmin } from '@/lib/kms/adminClient';
import { zoekWoorden, ilikeInKolommen } from '@/lib/kms/zoeken';

/**
 * Data-access voor de module Prospects.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export const PROSPECT_STATUSSEN = [
  'nieuw',
  'benaderd',
  'geinteresseerd',
  'reageerde',
  'gekwalificeerd',
  'klant',
  'afgemeld',
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSSEN)[number];

export type Prospect = {
  id: string;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  eigenaar: string | null;
  email: string | null;
  telefoon: string | null;
  branche: string | null;
  plaats: string | null;
  website: string | null;
  grootte: string | null;
  bron: string | null;
  status: string;
  score: number;
  notitie: string | null;
  laatste_contact: string | null;
  created_at: string;
  // Kennismakingsbrief (QR). Optioneel: oudere selecties halen ze niet op.
  token?: string;
  adres?: string | null;
  postcode?: string | null;
  logo_url?: string | null;
  huisstijl_kleur?: string | null;
  mockup_artikelen?: unknown;
  eerste_scan_op?: string | null;
  laatste_scan_op?: string | null;
  aantal_scans?: number | null;
  brief_verstuurd_op?: string | null;
  afgemeld_op?: string | null;
};

export type ProspectVelden = {
  bedrijfsnaam: string;
  contactpersoon?: string | null;
  eigenaar?: string | null;
  email?: string | null;
  telefoon?: string | null;
  branche?: string | null;
  plaats?: string | null;
  website?: string | null;
  grootte?: string | null;
  adres?: string | null;
  postcode?: string | null;
};

/** Toegestane sorteerkolommen (echte DB-kolommen op prospecten). */
const SORTEERKOLOMMEN = ['bedrijfsnaam', 'status', 'plaats', 'created_at', 'score', 'laatste_scan_op', 'aantal_scans', 'brief_verstuurd_op'] as const;

/** Eén pagina prospects met optioneel status- en zoekfilter en sortering, plus het totaal aantal rijen voor paginering. */
export async function listProspectenPaged(opts: {
  pagina: number;
  perPagina: number;
  status?: string;
  zoek?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  /** 'ja' = minstens één keer gescand, 'nee' = nog nooit gescand. */
  gescand?: string;
}): Promise<{ rijen: Prospect[]; totaal: number }> {
  const sb = kmsAdmin(); if (!sb) return { rijen: [], totaal: 0 };
  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const to = from + opts.perPagina - 1;
  const kolom = (SORTEERKOLOMMEN as readonly string[]).includes(opts.sort ?? '') ? (opts.sort as string) : 'created_at';
  const oplopend = opts.dir === 'asc' ? true : false;
  let q = sb
    .from('prospecten')
    .select('*', { count: 'exact' })
    .order(kolom, { ascending: oplopend, nullsFirst: false });
  if (opts.gescand === 'ja') q = q.gt('aantal_scans', 0);
  if (opts.gescand === 'nee') q = q.or('aantal_scans.is.null,aantal_scans.eq.0');
  if (opts.status && opts.status.trim()) q = q.eq('status', opts.status.trim());
  // Elk woord moet in bedrijfsnaam, contactpersoon, e-mail of plaats voorkomen.
  for (const w of zoekWoorden(opts.zoek)) {
    q = q.or(ilikeInKolommen(['bedrijfsnaam', 'contactpersoon', 'email', 'plaats'], w));
  }
  const { data, count } = await q.range(from, to);
  const rijen = (data as Prospect[]) ?? [];
  return { rijen, totaal: count ?? 0 };
}

/**
 * Bulk-import van prospects. Rijen zonder bedrijfsnaam worden genegeerd.
 * Alle ingevoerde rijen krijgen bron 'import'. Geeft het aantal ingevoegde rijen terug.
 */
export async function importeerProspecten(rijen: {
  bedrijfsnaam: string;
  contactpersoon?: string;
  email?: string;
  telefoon?: string;
  branche?: string;
  plaats?: string;
  website?: string;
  grootte?: string;
}[]): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;
  const schoon = rijen
    .filter((r) => r.bedrijfsnaam && r.bedrijfsnaam.trim())
    .map((r) => ({
      bedrijfsnaam: r.bedrijfsnaam.trim(),
      contactpersoon: r.contactpersoon?.trim() || null,
      email: r.email?.trim() || null,
      telefoon: r.telefoon?.trim() || null,
      branche: r.branche?.trim() || null,
      plaats: r.plaats?.trim() || null,
      website: r.website?.trim() || null,
      grootte: r.grootte?.trim() || null,
      bron: 'import',
    }));
  if (!schoon.length) return 0;
  const { data, error } = await sb.from('prospecten').insert(schoon).select('id');
  if (error || !data) return 0;
  return (data as { id: string }[]).length;
}

/** Eén prospect toevoegen. Rijen zonder bedrijfsnaam worden geweigerd. */
export async function maakProspect(v: ProspectVelden): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  if (!v.bedrijfsnaam || !v.bedrijfsnaam.trim()) return null;
  const { data, error } = await sb
    .from('prospecten')
    .insert({
      bedrijfsnaam: v.bedrijfsnaam.trim(),
      contactpersoon: v.contactpersoon?.trim() || null,
      email: v.email?.trim() || null,
      telefoon: v.telefoon?.trim() || null,
      branche: v.branche?.trim() || null,
      plaats: v.plaats?.trim() || null,
      website: v.website?.trim() || null,
      grootte: v.grootte?.trim() || null,
      bron: 'handmatig',
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function zetProspectStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('prospecten')
    .update({ status, laatste_contact: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function werkProspectNotitie(id: string, notitie: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('prospecten').update({ notitie: notitie || null }).eq('id', id);
  return !error;
}

/** Eén prospect ophalen voor de detail-/bewerkpagina. */
export async function getProspect(id: string): Promise<Prospect | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('prospecten').select('*').eq('id', id).maybeSingle();
  return (data as Prospect) ?? null;
}

/**
 * Werkt alle bewerkbare velden van een prospect bij (incl. eigenaar, status, score, notitie).
 * Lege tekstvelden worden null. Alleen meegegeven velden worden aangepast.
 */
export async function werkProspect(
  id: string,
  v: Partial<ProspectVelden & { status: string; score: number; notitie: string | null }>,
): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const tekst = (s: string | null | undefined) => (s == null ? undefined : s.trim() || null);
  const patch: Record<string, unknown> = {};
  if (v.bedrijfsnaam !== undefined && v.bedrijfsnaam.trim()) patch.bedrijfsnaam = v.bedrijfsnaam.trim();
  if (v.contactpersoon !== undefined) patch.contactpersoon = tekst(v.contactpersoon);
  if (v.eigenaar !== undefined) patch.eigenaar = tekst(v.eigenaar);
  if (v.email !== undefined) patch.email = tekst(v.email);
  if (v.telefoon !== undefined) patch.telefoon = tekst(v.telefoon);
  if (v.branche !== undefined) patch.branche = tekst(v.branche);
  if (v.plaats !== undefined) patch.plaats = tekst(v.plaats);
  if (v.website !== undefined) patch.website = tekst(v.website);
  if (v.grootte !== undefined) patch.grootte = tekst(v.grootte);
  if (v.adres !== undefined) patch.adres = tekst(v.adres);
  if (v.postcode !== undefined) patch.postcode = tekst(v.postcode)?.toUpperCase() ?? null;
  if (v.notitie !== undefined) patch.notitie = tekst(v.notitie);
  if (v.status !== undefined && v.status.trim()) patch.status = v.status.trim();
  if (v.score !== undefined && Number.isFinite(Number(v.score))) patch.score = Math.round(Number(v.score));
  if (Object.keys(patch).length === 0) return true;
  const { error } = await sb.from('prospecten').update(patch).eq('id', id);
  return !error;
}
