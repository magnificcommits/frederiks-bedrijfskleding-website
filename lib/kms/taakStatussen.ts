import { kmsAdmin } from '@/lib/kms/adminClient';
import { schoneKleur, STATUS_GROEPEN, type Kleur, type StatusGroep } from '@/app/dashboard/taken/statusKleur';

/**
 * Statussen (werkstappen) van taken, zelf te beheren onder Taken → Instellingen.
 *
 * taken.werkstatus (tekst) blijft de waarheid; deze tabel geeft elke naam een
 * kleur, groep en plek in de lijst. Een status in de groep 'klaar' rondt de
 * taak af (status = 'klaar').
 *
 * De 24 standaardstappen hebben een vaste `sleutel`. De automatische taken uit
 * orders en portaalbestellingen zoeken hun stap op die sleutel, zodat Jessi de
 * naam kan wijzigen zonder dat er iets stukgaat. Hernoemen werkt de bestaande
 * taken direct bij en bewaart de oude naam in `oude_namen`; code buiten deze
 * module die nog een oude naam schrijft (prospect-scan, kennismaking) wordt bij
 * de volgende synchronisatie rechtgezet door herstelHernoemdeStatussen().
 *
 * RLS staat aan zonder policies: alles via kmsAdmin(), alleen server-side.
 */

export type TaakStatus = {
  id: string;
  naam: string;
  kleur: Kleur;
  groep: StatusGroep;
  volgorde: number;
  actief: boolean;
  is_afgerond: boolean;
  sleutel: string | null;
};

/** Sleutel van een standaardnaam: "Logo's bestellen" → "logos_bestellen". */
export function sleutelVan(naam: string): string {
  return naam
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** De standaardset, gelijk aan de seed in de migratie. Ook de terugval als de tabel er (nog) niet is. */
const STANDAARD: [string, Kleur, StatusGroep][] = [
  ['Niet gestart', 'grijs', 'open'],
  ['Benaderen', 'geel', 'bezig'],
  ['Afspraak maken', 'geel', 'bezig'],
  ['Afspraak staat', 'paars', 'wacht'],
  ['Pasafspraak plannen', 'geel', 'bezig'],
  ['Passerie bestellen', 'oranje', 'bezig'],
  ['Passerie afleveren', 'geel', 'bezig'],
  ['Passerie bij klant', 'paars', 'wacht'],
  ['Offerte sturen', 'oranje', 'bezig'],
  ['Offerte gestuurd', 'paars', 'wacht'],
  ['Nog bestellen', 'oranje', 'bezig'],
  ['Al besteld nog niet geleverd', 'bruin', 'wacht'],
  ["Logo's bestellen", 'oranje', 'bezig'],
  ["Logo's ophalen", 'geel', 'bezig'],
  ["Logo's printen", 'geel', 'bezig'],
  ['Coupeuse', 'roze', 'wacht'],
  ['Opsturen naar borduurder', 'oranje', 'bezig'],
  ['Bij borduurder', 'roze', 'wacht'],
  ['Nog bedrukken', 'geel', 'bezig'],
  ['In uitvoering', 'geel', 'bezig'],
  ['Afleveren', 'geel', 'bezig'],
  ['Naar herenzaak', 'roze', 'wacht'],
  ['Factuur sturen', 'blauw', 'bezig'],
  ['Afgerond', 'groen', 'klaar'],
];

export const STANDAARD_STATUSSEN: TaakStatus[] = STANDAARD.map(([naam, kleur, groep], i) => ({
  id: `standaard-${sleutelVan(naam)}`,
  naam,
  kleur,
  groep,
  volgorde: i + 1,
  actief: true,
  is_afgerond: groep === 'klaar',
  sleutel: sleutelVan(naam),
}));

/** Sleutels die niet uit of weg mogen: de begin- en eindstap van elke taak. */
export const VASTE_SLEUTELS = ['niet_gestart', 'afgerond'];

function schoneGroep(v: unknown): StatusGroep {
  const s = String(v ?? '').trim();
  return (STATUS_GROEPEN as readonly string[]).includes(s) ? (s as StatusGroep) : 'bezig';
}

type StatusRij = {
  id: string;
  naam: string;
  kleur: string | null;
  groep: string | null;
  volgorde: number | null;
  actief: boolean | null;
  is_afgerond: boolean | null;
  sleutel: string | null;
};

function naarStatus(r: StatusRij): TaakStatus {
  const groep = schoneGroep(r.groep);
  return {
    id: r.id,
    naam: r.naam,
    kleur: schoneKleur(r.kleur),
    groep,
    volgorde: Number(r.volgorde) || 0,
    actief: r.actief !== false,
    is_afgerond: r.is_afgerond === true || groep === 'klaar',
    sleutel: r.sleutel ?? null,
  };
}

/** Alle statussen (ook uitgezette), in volgorde. Terugval op de standaardset. */
export async function listTaakStatussen(): Promise<TaakStatus[]> {
  const sb = kmsAdmin();
  if (!sb) return STANDAARD_STATUSSEN;
  const { data, error } = await sb
    .from('taak_statussen')
    .select('id, naam, kleur, groep, volgorde, actief, is_afgerond, sleutel')
    .order('volgorde')
    .order('naam');
  if (error || !data || data.length === 0) return STANDAARD_STATUSSEN;
  return (data as StatusRij[]).map(naarStatus);
}

/** Zitten we op de terugvalset (migratie nog niet gedraaid)? */
export function isTerugval(statussen: TaakStatus[]): boolean {
  return statussen.length > 0 && statussen[0].id.startsWith('standaard-');
}

/** Naam van de status waarmee een taak begint. */
export function beginStatus(statussen: TaakStatus[]): string {
  return (
    statussen.find((s) => s.sleutel === 'niet_gestart')?.naam ??
    statussen.find((s) => s.actief && s.groep === 'open')?.naam ??
    statussen.find((s) => s.actief && !s.is_afgerond)?.naam ??
    'Niet gestart'
  );
}

/** Naam van de status die "afgevinkt" betekent. */
export function afgerondStatus(statussen: TaakStatus[]): string {
  return (
    statussen.find((s) => s.sleutel === 'afgerond')?.naam ??
    statussen.find((s) => s.is_afgerond)?.naam ??
    'Afgerond'
  );
}

/** Huidige naam van een standaardstap (de automatische taken gebruiken de oorspronkelijke naam). */
export function huidigeNaam(statussen: TaakStatus[], oorspronkelijk: string): string {
  const sleutel = sleutelVan(oorspronkelijk);
  return statussen.find((s) => s.sleutel === sleutel)?.naam ?? oorspronkelijk;
}

export function isAfgerondeStatus(statussen: TaakStatus[], naam: string | null | undefined): boolean {
  const s = statussen.find((x) => x.naam === naam);
  return s ? s.is_afgerond : naam === 'Afgerond';
}

/* ------------------------------------------------------------------ */
/* Beheer                                                             */
/* ------------------------------------------------------------------ */

type Uitkomst = { ok: true; id?: string; aantal?: number } | { ok: false; fout: string };

function schoneNaam(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

async function haalStatus(id: string): Promise<TaakStatus | null> {
  const sb = kmsAdmin();
  if (!sb || !id) return null;
  const { data } = await sb
    .from('taak_statussen')
    .select('id, naam, kleur, groep, volgorde, actief, is_afgerond, sleutel')
    .eq('id', id)
    .maybeSingle();
  return data ? naarStatus(data as StatusRij) : null;
}

export async function getTaakStatus(id: string): Promise<TaakStatus | null> {
  return haalStatus(id);
}

export async function maakTaakStatus(input: { naam: string; kleur?: string; groep?: string }): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const naam = schoneNaam(input.naam);
  if (!naam) return { ok: false, fout: 'Geef de status een naam.' };
  const groep = schoneGroep(input.groep);

  const { data: laatste } = await sb
    .from('taak_statussen')
    .select('volgorde, groep')
    .order('volgorde', { ascending: false });
  const rijen = (laatste as { volgorde: number; groep: string }[]) ?? [];
  // Nieuwe status vóór de klaar-statussen, zodat Afgerond onderaan blijft.
  const eersteKlaar = [...rijen].reverse().find((r) => r.groep === 'klaar');
  const hoogste = rijen.length ? Number(rijen[0].volgorde) || 0 : 0;
  let volgorde = hoogste + 1;
  if (groep !== 'klaar' && eersteKlaar) {
    volgorde = Number(eersteKlaar.volgorde) || hoogste;
    // Klaar-statussen een plek opschuiven.
    const { data: klaarRijen } = await sb.from('taak_statussen').select('id, volgorde').gte('volgorde', volgorde);
    for (const r of (klaarRijen as { id: string; volgorde: number }[]) ?? []) {
      await sb.from('taak_statussen').update({ volgorde: (Number(r.volgorde) || 0) + 1 }).eq('id', r.id);
    }
  }

  const { data, error } = await sb
    .from('taak_statussen')
    .insert({ naam, kleur: schoneKleur(input.kleur, 'blauw'), groep, is_afgerond: groep === 'klaar', volgorde, actief: true })
    .select('id')
    .single();
  if (error) return { ok: false, fout: error.code === '23505' ? 'Die status bestaat al.' : 'Opslaan is niet gelukt.' };
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Hernoemen. Werkt alle taken met de oude naam bij (ook in archief en prullenbak)
 * en onthoudt de oude naam voor code die hem nog schrijft.
 */
export async function hernoemTaakStatus(id: string, nieuweNaam: string): Promise<Uitkomst & { oud?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const naam = schoneNaam(nieuweNaam);
  if (!naam) return { ok: false, fout: 'Een status heeft een naam nodig.' };
  const huidig = await haalStatus(id);
  if (!huidig) return { ok: false, fout: 'Status niet gevonden.' };
  if (huidig.naam === naam) return { ok: true, aantal: 0 };

  const { data: rij } = await sb.from('taak_statussen').select('oude_namen').eq('id', id).maybeSingle();
  const oude = new Set<string>(((rij as { oude_namen: string[] | null } | null)?.oude_namen ?? []).filter(Boolean));
  oude.add(huidig.naam);
  oude.delete(naam);

  const { error } = await sb.from('taak_statussen').update({ naam, oude_namen: [...oude] }).eq('id', id);
  if (error) return { ok: false, fout: error.code === '23505' ? 'Er is al een status met die naam.' : 'Opslaan is niet gelukt.' };

  // Een andere status kan deze naam vroeger gehad hebben; die hoort hem niet meer te "claimen".
  const { data: anderen } = await sb.from('taak_statussen').select('id, oude_namen').contains('oude_namen', [naam]);
  for (const a of (anderen as { id: string; oude_namen: string[] }[]) ?? []) {
    if (a.id === id) continue;
    await sb.from('taak_statussen').update({ oude_namen: a.oude_namen.filter((n) => n !== naam) }).eq('id', a.id);
  }

  const { data: bijgewerkt, error: e2 } = await sb
    .from('taken')
    .update({ werkstatus: naam })
    .eq('werkstatus', huidig.naam)
    .select('id');
  if (e2) return { ok: false, fout: 'De status is hernoemd, maar de taken zijn niet bijgewerkt. Probeer het nog eens.' };
  return { ok: true, aantal: ((bijgewerkt as { id: string }[]) ?? []).length, oud: huidig.naam };
}

export async function zetTaakStatusKleur(id: string, kleur: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const { error } = await sb.from('taak_statussen').update({ kleur: schoneKleur(kleur) }).eq('id', id);
  return error ? { ok: false, fout: 'Opslaan is niet gelukt.' } : { ok: true };
}

/**
 * Groep wijzigen. Naar of van 'klaar' verandert ook of taken met deze status
 * open of afgerond zijn; die worden meteen bijgewerkt.
 */
export async function zetTaakStatusGroep(id: string, groepIn: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const groep = schoneGroep(groepIn);
  const huidig = await haalStatus(id);
  if (!huidig) return { ok: false, fout: 'Status niet gevonden.' };
  if (huidig.groep === groep) return { ok: true };
  if (huidig.sleutel === 'afgerond' && groep !== 'klaar')
    return { ok: false, fout: 'De status voor afgeronde taken blijft in de groep Klaar.' };
  if (huidig.sleutel === 'niet_gestart' && groep === 'klaar')
    return { ok: false, fout: 'De beginstatus kan niet in de groep Klaar.' };

  const klaar = groep === 'klaar';
  const { error } = await sb.from('taak_statussen').update({ groep, is_afgerond: klaar }).eq('id', id);
  if (error) return { ok: false, fout: 'Opslaan is niet gelukt.' };
  if (klaar !== huidig.is_afgerond) {
    const nu = new Date().toISOString();
    await sb
      .from('taken')
      .update(klaar ? { status: 'klaar', afgerond_op: nu } : { status: 'open', afgerond_op: null })
      .eq('werkstatus', huidig.naam)
      .eq('status', klaar ? 'open' : 'klaar');
  }
  return { ok: true };
}

/** Eén plek omhoog (-1) of omlaag (+1). Nummert daarbij alles netjes 1..n. */
export async function verschuifTaakStatus(id: string, richting: -1 | 1): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const alle = await listTaakStatussen();
  if (isTerugval(alle)) return { ok: false, fout: 'De statussen staan nog niet in de database.' };
  const i = alle.findIndex((s) => s.id === id);
  const j = i + richting;
  if (i < 0) return { ok: false, fout: 'Status niet gevonden.' };
  if (j < 0 || j >= alle.length) return { ok: true };
  const lijst = [...alle];
  [lijst[i], lijst[j]] = [lijst[j], lijst[i]];
  for (let k = 0; k < lijst.length; k++) {
    if (lijst[k].volgorde !== k + 1) {
      const { error } = await sb.from('taak_statussen').update({ volgorde: k + 1 }).eq('id', lijst[k].id);
      if (error) return { ok: false, fout: 'Volgorde opslaan is niet gelukt.' };
    }
  }
  return { ok: true };
}

/** Aan/uit. Een uitgezette status verdwijnt uit de keuzelijsten; taken die hem hebben houden hem. */
export async function zetTaakStatusActief(id: string, actief: boolean): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const huidig = await haalStatus(id);
  if (!huidig) return { ok: false, fout: 'Status niet gevonden.' };
  if (!actief && huidig.sleutel && VASTE_SLEUTELS.includes(huidig.sleutel))
    return { ok: false, fout: 'Deze status is nodig voor elke taak en kan niet uit.' };
  const { error } = await sb.from('taak_statussen').update({ actief }).eq('id', id);
  return error ? { ok: false, fout: 'Opslaan is niet gelukt.' } : { ok: true };
}

/** Hoeveel taken (ook archief en prullenbak) hebben deze status? */
export async function telTakenMetStatus(naam: string): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { count } = await sb.from('taken').select('id', { count: 'exact', head: true }).eq('werkstatus', naam);
  return count ?? 0;
}

/** Aantal taken per statusnaam, voor de instellingenpagina. */
export async function aantallenPerStatus(): Promise<Record<string, number>> {
  const sb = kmsAdmin();
  const uit: Record<string, number> = {};
  if (!sb) return uit;
  for (let van = 0; van < 50000; van += 1000) {
    const { data, error } = await sb.from('taken').select('werkstatus').order('id').range(van, van + 999);
    if (error || !data) break;
    for (const r of data as { werkstatus: string | null }[]) {
      const k = r.werkstatus ?? '';
      uit[k] = (uit[k] ?? 0) + 1;
    }
    if (data.length < 1000) break;
  }
  return uit;
}

/**
 * Verwijderen mag alleen als geen enkele taak de status heeft en het geen
 * standaardstap is (die gebruiken de automatische taken). Anders: uitzetten.
 */
export async function verwijderTaakStatus(id: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const huidig = await haalStatus(id);
  if (!huidig) return { ok: false, fout: 'Status niet gevonden.' };
  if (huidig.sleutel) return { ok: false, fout: 'Dit is een standaardstap. Zet hem uit in plaats van verwijderen.' };
  const n = await telTakenMetStatus(huidig.naam);
  if (n > 0) return { ok: false, fout: `Nog ${n} ${n === 1 ? 'taak heeft' : 'taken hebben'} deze status. Zet hem uit in plaats van verwijderen.` };
  const { error } = await sb.from('taak_statussen').delete().eq('id', id);
  return error ? { ok: false, fout: 'Verwijderen is niet gelukt.' } : { ok: true };
}

/**
 * Taken die nog een oude statusnaam hebben (geschreven door code die de
 * hernoeming niet kent) naar de huidige naam zetten. Klein en idempotent.
 */
export async function herstelHernoemdeStatussen(): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { data, error } = await sb.from('taak_statussen').select('naam, oude_namen, is_afgerond');
  if (error || !data) return 0;
  let aantal = 0;
  for (const s of data as { naam: string; oude_namen: string[] | null; is_afgerond: boolean }[]) {
    const oude = (s.oude_namen ?? []).filter((n) => n && n !== s.naam);
    if (oude.length === 0) continue;
    const { data: rijen } = await sb.from('taken').update({ werkstatus: s.naam }).in('werkstatus', oude).select('id');
    aantal += ((rijen as { id: string }[]) ?? []).length;
  }
  return aantal;
}
