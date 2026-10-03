import { randomBytes } from 'node:crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { schoneKleur, type Kleur } from '@/app/dashboard/taken/statusKleur';

/**
 * Personen aan wie een taak kan hangen. Vast lijstje (beheren onder Taken →
 * Instellingen) in plaats van vrij typen, zodat filteren werkt en elke persoon
 * een eigen e-mailoverzicht en agenda-feed kan krijgen.
 *
 * taken.persoon_id is de koppeling; taken.toegewezen_aan (tekst) houden we
 * gelijk met de naam, voor oude code en de prospect-scan die alleen de naam schrijft.
 *
 * RLS aan zonder policies: alles via kmsAdmin(), alleen server-side.
 */

export type TaakPersoon = {
  id: string;
  naam: string;
  email: string | null;
  kleur: Kleur;
  actief: boolean;
  dagoverzicht: boolean;
  weekoverzicht: boolean;
  ook_zonder_persoon: boolean;
  admin_email: string | null;
};

/** Met geheime agenda-sleutel; alleen voor de instellingenpagina en de cron. */
export type TaakPersoonMetToken = TaakPersoon & { agenda_token: string | null };

const KOLOMMEN = 'id, naam, email, kleur, actief, dagoverzicht, weekoverzicht, ook_zonder_persoon, admin_email';

type Rij = {
  id: string;
  naam: string;
  email: string | null;
  kleur: string | null;
  actief: boolean | null;
  dagoverzicht: boolean | null;
  weekoverzicht: boolean | null;
  ook_zonder_persoon: boolean | null;
  admin_email: string | null;
  agenda_token?: string | null;
};

function naarPersoon(r: Rij): TaakPersoon {
  return {
    id: r.id,
    naam: r.naam,
    email: r.email ?? null,
    kleur: schoneKleur(r.kleur, 'blauw'),
    actief: r.actief !== false,
    dagoverzicht: r.dagoverzicht !== false,
    weekoverzicht: r.weekoverzicht !== false,
    ook_zonder_persoon: r.ook_zonder_persoon === true,
    admin_email: r.admin_email ?? null,
  };
}

/** Alle personen, actieve eerst, dan op naam. Lege lijst als de tabel er nog niet is. */
export async function listTaakPersonen(): Promise<TaakPersoon[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('taak_personen').select(KOLOMMEN).order('created_at');
  if (error || !data) return [];
  return sortPersonen((data as Rij[]).map(naarPersoon));
}

export async function listTaakPersonenMetToken(): Promise<TaakPersoonMetToken[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('taak_personen').select(`${KOLOMMEN}, agenda_token`).order('created_at');
  if (error || !data) return [];
  return sortPersonen((data as Rij[]).map((r) => ({ ...naarPersoon(r), agenda_token: r.agenda_token ?? null })));
}

function sortPersonen<T extends TaakPersoon>(lijst: T[]): T[] {
  return [...lijst].sort((a, b) => (a.actief === b.actief ? a.naam.localeCompare(b.naam, 'nl') : a.actief ? -1 : 1));
}

export async function getTaakPersoon(id: string): Promise<TaakPersoon | null> {
  const sb = kmsAdmin();
  if (!sb || !id) return null;
  const { data } = await sb.from('taak_personen').select(KOLOMMEN).eq('id', id).maybeSingle();
  return data ? naarPersoon(data as Rij) : null;
}

/** Persoon bij een agenda-sleutel (alleen actieve personen). */
export async function persoonBijAgendaToken(token: string): Promise<TaakPersoon | null> {
  const sb = kmsAdmin();
  const schoon = String(token ?? '').trim();
  if (!sb || !/^[a-zA-Z0-9_-]{32,128}$/.test(schoon)) return null;
  const { data } = await sb.from('taak_personen').select(KOLOMMEN).eq('agenda_token', schoon).maybeSingle();
  const p = data ? naarPersoon(data as Rij) : null;
  return p && p.actief ? p : null;
}

/**
 * Standaardpersoon voor een nieuwe taak: de persoon die bij de ingelogde
 * beheerder hoort, anders de eerst aangemaakte actieve persoon (Jessi).
 */
export function standaardPersoon(personen: TaakPersoon[], adminEmail: string | null): string | null {
  const actief = personen.filter((p) => p.actief);
  if (adminEmail) {
    const e = adminEmail.toLowerCase();
    const eigen = actief.find((p) => (p.admin_email ?? '').toLowerCase() === e || (p.email ?? '').toLowerCase() === e);
    if (eigen) return eigen.id;
  }
  return actief[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Beheer                                                             */
/* ------------------------------------------------------------------ */

type Uitkomst = { ok: true; id?: string } | { ok: false; fout: string };

function schoneNaam(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function schoneEmail(v: unknown): string | null | 'fout' {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : 'fout';
}

export function nieuwAgendaToken(): string {
  return randomBytes(32).toString('hex');
}

export async function maakTaakPersoon(input: { naam: string; email?: string | null; kleur?: string }): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const naam = schoneNaam(input.naam);
  if (!naam) return { ok: false, fout: 'Vul een naam in.' };
  const email = schoneEmail(input.email);
  if (email === 'fout') return { ok: false, fout: 'Dat e-mailadres klopt niet.' };
  const rij: Record<string, unknown> = { naam, kleur: schoneKleur(input.kleur, 'blauw'), agenda_token: nieuwAgendaToken() };
  if (email) rij.email = email;
  const { data, error } = await sb.from('taak_personen').insert(rij).select('id').single();
  if (error) return { ok: false, fout: error.code === '23505' ? 'Er is al iemand met die naam.' : 'Opslaan is niet gelukt.' };
  return { ok: true, id: (data as { id: string }).id };
}

export type PersoonVelden = {
  naam?: string;
  email?: string | null;
  kleur?: string;
  actief?: boolean;
  dagoverzicht?: boolean;
  weekoverzicht?: boolean;
  ook_zonder_persoon?: boolean;
};

/** Losse velden bijwerken. Een nieuwe naam gaat ook naar taken.toegewezen_aan. */
export async function werkTaakPersoonBij(
  id: string,
  velden: PersoonVelden,
): Promise<{ ok: true; voor: Record<string, unknown>; na: Record<string, unknown> } | { ok: false; fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const huidig = await getTaakPersoon(id);
  if (!huidig) return { ok: false, fout: 'Persoon niet gevonden.' };

  const nieuw: Record<string, unknown> = {};
  if (velden.naam !== undefined) {
    const naam = schoneNaam(velden.naam);
    if (!naam) return { ok: false, fout: 'Een naam is verplicht.' };
    nieuw.naam = naam;
  }
  if (velden.email !== undefined) {
    const email = schoneEmail(velden.email);
    if (email === 'fout') return { ok: false, fout: 'Dat e-mailadres klopt niet.' };
    nieuw.email = email;
  }
  if (velden.kleur !== undefined) nieuw.kleur = schoneKleur(velden.kleur, 'blauw');
  for (const k of ['actief', 'dagoverzicht', 'weekoverzicht', 'ook_zonder_persoon'] as const) {
    if (velden[k] !== undefined) nieuw[k] = Boolean(velden[k]);
  }

  const voor: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(nieuw)) {
    const oud = (huidig as unknown as Record<string, unknown>)[k] ?? null;
    if (oud !== v) {
      voor[k] = oud;
      na[k] = v;
    }
  }
  if (Object.keys(na).length === 0) return { ok: true, voor, na };

  const { error } = await sb.from('taak_personen').update(na).eq('id', id);
  if (error) return { ok: false, fout: error.code === '23505' ? 'Er is al iemand met die naam.' : 'Opslaan is niet gelukt.' };
  if (typeof na.naam === 'string') {
    await sb.from('taken').update({ toegewezen_aan: na.naam }).eq('persoon_id', id);
  }
  return { ok: true, voor, na };
}

export async function vernieuwAgendaToken(id: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const { error } = await sb.from('taak_personen').update({ agenda_token: nieuwAgendaToken() }).eq('id', id);
  return error ? { ok: false, fout: 'Opslaan is niet gelukt.' } : { ok: true };
}

export async function telTakenVanPersoon(id: string): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { count } = await sb.from('taken').select('id', { count: 'exact', head: true }).eq('persoon_id', id);
  return count ?? 0;
}

/** Alleen als er geen taken aan hangen; anders uitzetten (dan blijft de historie kloppen). */
export async function verwijderTaakPersoon(id: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const n = await telTakenVanPersoon(id);
  if (n > 0) return { ok: false, fout: `Er ${n === 1 ? 'hangt nog 1 taak' : `hangen nog ${n} taken`} aan deze persoon. Zet hem of haar uit in plaats van verwijderen.` };
  const { error } = await sb.from('taak_personen').delete().eq('id', id);
  return error ? { ok: false, fout: 'Verwijderen is niet gelukt.' } : { ok: true };
}

/**
 * Taken die alleen een naam hebben (toegewezen_aan) maar geen persoon_id, aan de
 * juiste persoon koppelen. Komt voor bij taken uit de prospect-scan, die 'Jessi'
 * als tekst schrijft. Onbekende namen blijven ongemoeid.
 */
export async function koppelLossePersonen(): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { data, error } = await sb
    .from('taken')
    .select('id, toegewezen_aan')
    .is('persoon_id', null)
    .not('toegewezen_aan', 'is', null)
    .limit(500);
  if (error || !data || data.length === 0) return 0;
  const personen = await listTaakPersonen();
  const opNaam = new Map(personen.map((p) => [p.naam.toLowerCase(), p.id]));
  const perPersoon = new Map<string, string[]>();
  for (const t of data as { id: string; toegewezen_aan: string | null }[]) {
    const pid = opNaam.get(String(t.toegewezen_aan ?? '').trim().toLowerCase());
    if (!pid) continue;
    perPersoon.set(pid, [...(perPersoon.get(pid) ?? []), t.id]);
  }
  let aantal = 0;
  for (const [pid, ids] of perPersoon) {
    const { error: e } = await sb.from('taken').update({ persoon_id: pid }).in('id', ids);
    if (!e) aantal += ids.length;
  }
  return aantal;
}
