import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import {
  BELONING_SOORTEN,
  REGEL_SOORTEN,
  STANDAARD_NIVEAUS,
  parseGetal,
  type BeloningSoort,
  type RegelSoort,
  type SpaarBeloning,
  type SpaarInstellingen,
  type SpaarInstellingenUitgebreid,
  type SpaarNiveau,
  type SpaarRegel,
} from '@/lib/kms/sparenTypes';

/**
 * Basisdata van het spaarprogramma: instellingen, regels, niveaus en beloningen.
 * Alles via kmsAdmin() (service role). Alleen server-side gebruiken; in het
 * dashboard achter dashAuthed(), in het portaal gefilterd op de eigen organisatie.
 *
 * Zolang migratie 20261004_sparen_loyaliteit.sql niet gedraaid is, bestaan de
 * nieuwe tabellen niet. Lezen valt dan terug op de oude instellingen (één
 * basisregel, standaardniveaus); schrijven geeft een nette melding.
 */

type PgFout = { code?: string; message?: string } | null | undefined;

/** Tabel of kolom bestaat (nog) niet: 42P01, 42703, PGRST204, PGRST205. */
export function ontbreekt(fout: PgFout): boolean {
  if (!fout) return false;
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(fout.code ?? ''))) return true;
  const m = String(fout.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('could not find') || m.includes('schema cache');
}

export const MIGRATIE_MELDING =
  'Dit werkt pas na de migratie 20261004_sparen_loyaliteit.sql. Tot die tijd spaart iedereen alleen punten per euro.';

/** Of de loyaliteitstabellen er zijn. Eén keer per request bepaald. */
export const loyaliteitActief = cache(async (): Promise<boolean> => {
  const sb = kmsAdmin();
  if (!sb) return false;
  const [a, b] = await Promise.all([
    sb.from('spaar_mutaties').select('id').limit(1),
    sb.from('spaar_inwisselingen').select('status').limit(1),
  ]);
  return !ontbreekt(a.error) && !ontbreekt(b.error);
});

/** Haalt in blokken van 1000 op tot alles binnen is (PostgREST geeft er standaard max 1000). */
export async function haalAlles<T>(
  pagina: (van: number, tot: number) => PromiseLike<{ data: unknown; error: unknown }>,
  stap = 1000,
): Promise<T[]> {
  const uit: T[] = [];
  for (let i = 0; i < 200; i++) {
    const van = i * stap;
    const { data, error } = await pagina(van, van + stap - 1);
    if (error) break;
    const rijen = (data as T[]) ?? [];
    uit.push(...rijen);
    if (rijen.length < stap) break;
  }
  return uit;
}

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

const SLEUTELS = [
  'spaar_actief',
  'spaar_punten_per_euro',
  'spaar_euro_per_punt',
  'spaar_vervaltermijn_maanden',
  'spaar_niveau_basis',
  'spaar_portaal_aanvragen',
  'spaar_melding_email',
  'spaar_voorwaarden',
];

async function leesInstellingen(sb: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await sb.from('instellingen').select('sleutel, waarde').in('sleutel', SLEUTELS);
  const map: Record<string, string> = {};
  ((data as unknown as { sleutel: string; waarde: string | null }[]) ?? []).forEach((r) => {
    map[r.sleutel] = r.waarde ?? '';
  });
  return map;
}

export async function getSpaarInstellingenUitgebreid(): Promise<SpaarInstellingenUitgebreid> {
  const sb = kmsAdmin();
  const leeg: SpaarInstellingenUitgebreid = {
    actief: false,
    puntenPerEuro: 1,
    euroPerPunt: 0.01,
    vervalMaanden: 0,
    niveauBasis: 'omzet',
    portaalAanvragen: true,
    meldingEmail: env.notifyEmail,
    voorwaarden: '',
  };
  if (!sb) return leeg;
  const map = await leesInstellingen(sb);
  return {
    actief: map['spaar_actief'] === 'true',
    puntenPerEuro: parseGetal(map['spaar_punten_per_euro'], 1),
    euroPerPunt: parseGetal(map['spaar_euro_per_punt'], 0.01),
    vervalMaanden: Math.max(0, Math.floor(parseGetal(map['spaar_vervaltermijn_maanden'], 0))),
    niveauBasis: map['spaar_niveau_basis'] === 'punten' ? 'punten' : 'omzet',
    portaalAanvragen: map['spaar_portaal_aanvragen'] !== 'false',
    meldingEmail: (map['spaar_melding_email'] ?? '').trim() || env.notifyEmail,
    voorwaarden: map['spaar_voorwaarden'] ?? '',
  };
}

export async function getSpaarInstellingenBasis(): Promise<SpaarInstellingen> {
  const v = await getSpaarInstellingenUitgebreid();
  return { actief: v.actief, puntenPerEuro: v.puntenPerEuro, euroPerPunt: v.euroPerPunt };
}

/** Schrijft een deel van de instellingen. Waarden altijd als tekst. */
export async function zetInstellingen(waarden: Record<string, string>): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const rijen = Object.entries(waarden)
    .filter(([k]) => SLEUTELS.includes(k))
    .map(([sleutel, waarde]) => ({ sleutel, waarde }));
  if (rijen.length === 0) return true;
  const { error } = await sb.from('instellingen').upsert(rijen, { onConflict: 'sleutel' });
  return !error;
}

// ---------------------------------------------------------------------------
// Regels
// ---------------------------------------------------------------------------

type RegelRij = {
  id: string;
  naam: string;
  soort: string;
  actief: boolean;
  punten: number | null;
  factor: number | null;
  drempel_euro: number | null;
  maanden: number | null;
  start_datum: string | null;
  eind_datum: string | null;
  geldig_vanaf: string | null;
  omschrijving: string | null;
  systeem: boolean | null;
  sortering: number | null;
};

function naarRegel(r: RegelRij): SpaarRegel {
  return {
    id: r.id,
    naam: r.naam,
    soort: (REGEL_SOORTEN as readonly string[]).includes(r.soort) ? (r.soort as RegelSoort) : 'review',
    actief: Boolean(r.actief),
    punten: Math.round(Number(r.punten) || 0),
    factor: Number(r.factor) || 0,
    drempelEuro: r.drempel_euro == null ? null : Number(r.drempel_euro),
    maanden: r.maanden == null ? null : Number(r.maanden),
    startDatum: r.start_datum,
    eindDatum: r.eind_datum,
    geldigVanaf: r.geldig_vanaf,
    omschrijving: r.omschrijving,
    systeem: Boolean(r.systeem),
    sortering: Number(r.sortering) || 0,
  };
}

/** Regel die de oude instelling nabootst als de tabel er nog niet is. */
function basisRegelUitInstelling(puntenPerEuro: number): SpaarRegel {
  return {
    id: 'basis',
    naam: 'Punten per bestede euro',
    soort: 'per_euro',
    actief: true,
    punten: 0,
    factor: puntenPerEuro,
    drempelEuro: null,
    maanden: null,
    startDatum: null,
    eindDatum: null,
    geldigVanaf: null,
    omschrijving: 'Op elke bestelling spaar je punten over het orderbedrag.',
    systeem: true,
    sortering: 0,
  };
}

export async function listRegels(): Promise<{ regels: SpaarRegel[]; tabel: boolean }> {
  const sb = kmsAdmin();
  const inst = await getSpaarInstellingenBasis();
  if (!sb) return { regels: [basisRegelUitInstelling(inst.puntenPerEuro)], tabel: false };
  const { data, error } = await sb.from('spaar_regels').select('*').order('sortering').order('created_at');
  if (error) return { regels: [basisRegelUitInstelling(inst.puntenPerEuro)], tabel: false };
  return { regels: ((data as RegelRij[]) ?? []).map(naarRegel), tabel: true };
}

export type RegelInvoer = {
  naam: string;
  soort: RegelSoort;
  actief: boolean;
  punten: number;
  factor: number;
  drempelEuro: number | null;
  maanden: number | null;
  startDatum: string | null;
  eindDatum: string | null;
  geldigVanaf: string | null;
  omschrijving: string | null;
};

function regelRij(v: RegelInvoer): Record<string, unknown> {
  return {
    naam: v.naam.trim().slice(0, 120),
    soort: v.soort,
    actief: v.actief,
    punten: Math.round(v.punten) || 0,
    factor: Number.isFinite(v.factor) ? v.factor : 1,
    drempel_euro: v.drempelEuro,
    maanden: v.maanden,
    start_datum: v.startDatum,
    eind_datum: v.eindDatum,
    geldig_vanaf: v.geldigVanaf,
    omschrijving: v.omschrijving?.trim() || null,
    bijgewerkt_op: new Date().toISOString(),
  };
}

export async function maakRegel(v: RegelInvoer): Promise<{ ok: boolean; fout?: string; id?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { data, error } = await sb.from('spaar_regels').insert({ ...regelRij(v), sortering: 100 }).select('id').single();
  if (error) return { ok: false, fout: ontbreekt(error) ? MIGRATIE_MELDING : error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function werkRegelBij(id: string, v: RegelInvoer): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { data: oud } = await sb.from('spaar_regels').select('systeem, soort').eq('id', id).maybeSingle();
  const rij = regelRij(v);
  // De systeemregel blijft een per-euro-regel.
  if ((oud as { systeem?: boolean } | null)?.systeem) rij.soort = 'per_euro';
  const { error } = await sb.from('spaar_regels').update(rij).eq('id', id);
  if (error) return { ok: false, fout: ontbreekt(error) ? MIGRATIE_MELDING : error.message };
  // Systeemregel en oude instelling gelijk houden; de instellingenpagina leest die nog.
  if ((oud as { systeem?: boolean } | null)?.systeem) {
    await zetInstellingen({ spaar_punten_per_euro: String(v.factor) });
  }
  return { ok: true };
}

export async function zetRegelActief(id: string, actief: boolean): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const { error } = await sb.from('spaar_regels').update({ actief, bijgewerkt_op: new Date().toISOString() }).eq('id', id);
  return !error;
}

export async function verwijderRegel(id: string): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { data } = await sb.from('spaar_regels').select('systeem').eq('id', id).maybeSingle();
  if ((data as { systeem?: boolean } | null)?.systeem) return { ok: false, fout: 'De basisregel kun je uitzetten, maar niet verwijderen.' };
  const { error } = await sb.from('spaar_regels').delete().eq('id', id);
  return error ? { ok: false, fout: error.message } : { ok: true };
}

/** Houdt de systeemregel gelijk aan de instelling (aangeroepen vanuit zetSpaarInstellingen). */
export async function synchroniseerBasisRegel(puntenPerEuro: number): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  await sb
    .from('spaar_regels')
    .update({ factor: puntenPerEuro, bijgewerkt_op: new Date().toISOString() })
    .eq('systeem', true)
    .eq('soort', 'per_euro');
}

// ---------------------------------------------------------------------------
// Niveaus
// ---------------------------------------------------------------------------

type NiveauRij = {
  id: string;
  naam: string;
  drempel: number | null;
  kleur: string | null;
  korting_pct: number | null;
  punten_factor: number | null;
  gratis_logo: boolean | null;
  gratis_passen: boolean | null;
  voorrang: boolean | null;
  extra_voordelen: string | null;
  sortering: number | null;
};

function naarNiveau(r: NiveauRij): SpaarNiveau {
  return {
    id: r.id,
    naam: r.naam,
    drempel: Number(r.drempel) || 0,
    kleur: r.kleur,
    kortingPct: Number(r.korting_pct) || 0,
    puntenFactor: Number(r.punten_factor) || 1,
    gratisLogo: Boolean(r.gratis_logo),
    gratisPassen: Boolean(r.gratis_passen),
    voorrang: Boolean(r.voorrang),
    extraVoordelen: r.extra_voordelen,
    sortering: Number(r.sortering) || 0,
  };
}

export async function listNiveaus(): Promise<{ niveaus: SpaarNiveau[]; tabel: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { niveaus: STANDAARD_NIVEAUS, tabel: false };
  const { data, error } = await sb.from('spaar_niveaus').select('*').order('drempel').order('sortering');
  if (error) return { niveaus: STANDAARD_NIVEAUS, tabel: false };
  return { niveaus: ((data as NiveauRij[]) ?? []).map(naarNiveau), tabel: true };
}

export type NiveauInvoer = Omit<SpaarNiveau, 'id' | 'sortering'>;

function niveauRij(v: NiveauInvoer): Record<string, unknown> {
  return {
    naam: v.naam.trim().slice(0, 60),
    drempel: Math.max(0, v.drempel),
    kleur: v.kleur?.trim() || null,
    korting_pct: Math.min(100, Math.max(0, v.kortingPct)),
    punten_factor: Math.min(10, Math.max(1, v.puntenFactor)),
    gratis_logo: v.gratisLogo,
    gratis_passen: v.gratisPassen,
    voorrang: v.voorrang,
    extra_voordelen: v.extraVoordelen?.trim() || null,
  };
}

export async function slaNiveauOp(id: string | null, v: NiveauInvoer): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { error } = id
    ? await sb.from('spaar_niveaus').update(niveauRij(v)).eq('id', id)
    : await sb.from('spaar_niveaus').insert(niveauRij(v));
  if (error) return { ok: false, fout: ontbreekt(error) ? MIGRATIE_MELDING : error.message };
  return { ok: true };
}

export async function verwijderNiveau(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const { error } = await sb.from('spaar_niveaus').delete().eq('id', id);
  return !error;
}

// ---------------------------------------------------------------------------
// Beloningen
// ---------------------------------------------------------------------------

type BeloningRij = {
  id: string;
  naam: string;
  soort: string;
  omschrijving: string | null;
  punten_prijs: number | null;
  waarde_euro: number | null;
  min_niveau_id: string | null;
  actief: boolean | null;
  in_portaal: boolean | null;
  voorraad: number | null;
  sortering: number | null;
};

function naarBeloning(r: BeloningRij): SpaarBeloning {
  return {
    id: r.id,
    naam: r.naam,
    soort: (BELONING_SOORTEN as readonly string[]).includes(r.soort) ? (r.soort as BeloningSoort) : 'anders',
    omschrijving: r.omschrijving,
    puntenPrijs: Math.round(Number(r.punten_prijs) || 0),
    waardeEuro: Number(r.waarde_euro) || 0,
    minNiveauId: r.min_niveau_id,
    actief: Boolean(r.actief),
    inPortaal: r.in_portaal !== false,
    voorraad: r.voorraad == null ? null : Number(r.voorraad),
    sortering: Number(r.sortering) || 0,
  };
}

export async function listBeloningen(): Promise<{ beloningen: SpaarBeloning[]; tabel: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { beloningen: [], tabel: false };
  const { data, error } = await sb.from('spaar_beloningen').select('*').order('sortering').order('punten_prijs');
  if (error) return { beloningen: [], tabel: false };
  return { beloningen: ((data as BeloningRij[]) ?? []).map(naarBeloning), tabel: true };
}

export async function getBeloning(id: string): Promise<SpaarBeloning | null> {
  const sb = kmsAdmin();
  if (!sb || !id) return null;
  const { data, error } = await sb.from('spaar_beloningen').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return naarBeloning(data as BeloningRij);
}

export type BeloningInvoer = Omit<SpaarBeloning, 'id' | 'sortering'>;

function beloningRij(v: BeloningInvoer): Record<string, unknown> {
  return {
    naam: v.naam.trim().slice(0, 120),
    soort: v.soort,
    omschrijving: v.omschrijving?.trim() || null,
    punten_prijs: Math.max(1, Math.round(v.puntenPrijs)),
    waarde_euro: Math.max(0, v.waardeEuro),
    min_niveau_id: v.minNiveauId || null,
    actief: v.actief,
    in_portaal: v.inPortaal,
    voorraad: v.voorraad,
  };
}

export async function slaBeloningOp(id: string | null, v: BeloningInvoer): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet gekoppeld.' };
  const { error } = id
    ? await sb.from('spaar_beloningen').update(beloningRij(v)).eq('id', id)
    : await sb.from('spaar_beloningen').insert({ ...beloningRij(v), sortering: 100 });
  if (error) return { ok: false, fout: ontbreekt(error) ? MIGRATIE_MELDING : error.message };
  return { ok: true };
}

export async function verwijderBeloning(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const { error } = await sb.from('spaar_beloningen').delete().eq('id', id);
  return !error;
}

/** Organisaties voor keuzelijsten, op naam. */
export async function listKlantKeuzes(): Promise<{ id: string; naam: string }[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const rijen = await haalAlles<{ id: string; naam: string | null }>((van, tot) =>
    sb.from('organisaties').select('id, naam').order('naam').order('id').range(van, tot),
  );
  return rijen.map((r) => ({ id: r.id, naam: r.naam ?? '' }));
}

/** Aantal inwisselingen dat op Jessi wacht. 0 als de migratie nog niet gedraaid is. */
export async function telOpenAanvragen(): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { count, error } = await sb
    .from('spaar_inwisselingen')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'aangevraagd');
  return error ? 0 : count ?? 0;
}
