import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de module Campagnes. Een campagne is een reeks e-mailstappen
 * (volgorde + wachttijd) waar prospecten op ingeschreven worden. De verzending zelf
 * gebeurt elders (cron/worker); hier beheer je de campagnes, stappen en inschrijvingen.
 *
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side
 * gebruiken, altijd achter dashAuthed().
 */

export const CAMPAGNE_TYPES = ['cold', 'nurture', 'reengage'] as const;
export type CampagneType = (typeof CAMPAGNE_TYPES)[number];

export const CAMPAGNE_STATUSSEN = ['concept', 'actief', 'gepauzeerd', 'afgerond'] as const;
export type CampagneStatus = (typeof CAMPAGNE_STATUSSEN)[number];

export type Campagne = {
  id: string;
  naam: string;
  type: string;
  status: string;
  van_naam: string | null;
  van_email: string | null;
  created_at: string;
};

export type CampagneStap = {
  id: string;
  campagne_id: string;
  volgorde: number;
  wacht_dagen: number;
  onderwerp: string;
  body: string;
  created_at: string;
};

export type CampagneMetTelling = Campagne & {
  aantalInschrijvingen: number;
  aantalVerzonden: number;
};

export type CampagneDetail = Campagne & {
  stappen: CampagneStap[];
  aantalInschrijvingen: number;
  aantalVerzonden: number;
  aantalActief: number;
};

export type StapVelden = {
  volgorde?: number;
  wacht_dagen?: number;
  onderwerp: string;
  body: string;
};

/**
 * Alle campagnes (nieuwste eerst) met per campagne het aantal inschrijvingen en het aantal
 * verzonden mails. Geen N+1: we halen alle inschrijvingen en alle verzendingen in twee extra
 * queries op en groeperen in geheugen op campagne_id.
 */
export async function listCampagnes(): Promise<CampagneMetTelling[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb
    .from('campagnes')
    .select('*')
    .order('created_at', { ascending: false });
  const campagnes = (data as Campagne[]) ?? [];
  if (campagnes.length === 0) return [];

  const ids = campagnes.map((c) => c.id);

  const inschrijvingPer = new Map<string, number>();
  const { data: insData } = await sb
    .from('campagne_inschrijvingen')
    .select('campagne_id')
    .in('campagne_id', ids);
  for (const r of (insData as { campagne_id: string }[]) ?? []) {
    inschrijvingPer.set(r.campagne_id, (inschrijvingPer.get(r.campagne_id) ?? 0) + 1);
  }

  const verzondenPer = new Map<string, number>();
  const { data: verzData } = await sb
    .from('campagne_verzendingen')
    .select('campagne_id')
    .in('campagne_id', ids);
  for (const r of (verzData as { campagne_id: string }[]) ?? []) {
    verzondenPer.set(r.campagne_id, (verzondenPer.get(r.campagne_id) ?? 0) + 1);
  }

  return campagnes.map((c) => ({
    ...c,
    aantalInschrijvingen: inschrijvingPer.get(c.id) ?? 0,
    aantalVerzonden: verzondenPer.get(c.id) ?? 0,
  }));
}

/**
 * Eén campagne met haar stappen (op volgorde), plus tellingen: totaal aantal inschrijvingen,
 * aantal actieve inschrijvingen en aantal verzonden mails.
 */
export async function getCampagne(id: string): Promise<CampagneDetail | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb
    .from('campagnes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const campagne = data as Campagne;

  const { data: stapData } = await sb
    .from('campagne_stappen')
    .select('*')
    .eq('campagne_id', id)
    .order('volgorde', { ascending: true });
  const stappen = ((stapData as CampagneStap[]) ?? []).slice().sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));

  const { data: insData } = await sb
    .from('campagne_inschrijvingen')
    .select('status')
    .eq('campagne_id', id);
  const inschrijvingen = (insData as { status: string }[]) ?? [];
  const aantalInschrijvingen = inschrijvingen.length;
  const aantalActief = inschrijvingen.filter((r) => r.status === 'actief').length;

  const { count: verzondenCount } = await sb
    .from('campagne_verzendingen')
    .select('id', { count: 'exact', head: true })
    .eq('campagne_id', id);

  return {
    ...campagne,
    stappen,
    aantalInschrijvingen,
    aantalVerzonden: verzondenCount ?? 0,
    aantalActief,
  };
}

export async function maakCampagne(v: {
  naam: string;
  type?: string;
  van_naam?: string | null;
  van_email?: string | null;
}): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const type = v.type && (CAMPAGNE_TYPES as readonly string[]).includes(v.type) ? v.type : 'cold';
  const { data, error } = await sb
    .from('campagnes')
    .insert({
      naam: v.naam.trim(),
      type,
      status: 'concept',
      van_naam: v.van_naam?.trim() || null,
      van_email: v.van_email?.trim() || null,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function zetCampagneStatus(id: string, status: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('campagnes').update({ status }).eq('id', id);
  return !error;
}

export async function voegStapToe(campagneId: string, v: StapVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('campagne_stappen').insert({
    campagne_id: campagneId,
    volgorde: Number.isFinite(Number(v.volgorde)) ? Math.round(Number(v.volgorde)) : 1,
    wacht_dagen: Number.isFinite(Number(v.wacht_dagen)) ? Math.round(Number(v.wacht_dagen)) : 0,
    onderwerp: v.onderwerp.trim(),
    body: v.body,
  });
  return !error;
}

export async function werkStap(stapId: string, v: StapVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const patch: Record<string, unknown> = {
    onderwerp: v.onderwerp.trim(),
    body: v.body,
  };
  if (v.volgorde !== undefined) patch.volgorde = Number.isFinite(Number(v.volgorde)) ? Math.round(Number(v.volgorde)) : 1;
  if (v.wacht_dagen !== undefined) patch.wacht_dagen = Number.isFinite(Number(v.wacht_dagen)) ? Math.round(Number(v.wacht_dagen)) : 0;
  const { error } = await sb.from('campagne_stappen').update(patch).eq('id', stapId);
  return !error;
}

export async function verwijderStap(stapId: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('campagne_stappen').delete().eq('id', stapId);
  return !error;
}

/**
 * Schrijft prospecten in op een campagne. Selecteert prospecten met de gegeven status (of alle
 * als de status leeg is) die een e-mail hebben en niet de status 'afgemeld' of 'klant' hebben.
 * Prospecten waarvan de e-mail op de afmeldlijst (public.afmeldingen) staat worden overgeslagen.
 * Voor elke nieuwe prospect een inschrijving met status 'actief', huidige_stap 0 en
 * volgende_verzending = nu. Dubbele inschrijvingen (unieke combinatie campagne_id + prospect_id)
 * worden netjes genegeerd. Geeft het aantal nieuw ingeschrevenen terug.
 */
export async function schrijfProspectenIn(campagneId: string, prospectStatus?: string): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;

  let q = sb
    .from('prospecten')
    .select('id, email, status')
    .not('email', 'is', null)
    .not('status', 'in', '("afgemeld","klant")');
  if (prospectStatus && prospectStatus.trim()) q = q.eq('status', prospectStatus.trim());
  const { data: prospectData } = await q;
  const prospecten = ((prospectData as { id: string; email: string | null; status: string }[]) ?? [])
    .filter((p) => p.email && p.email.trim());
  if (prospecten.length === 0) return 0;

  // E-mails op de afmeldlijst overslaan.
  const emails = Array.from(new Set(prospecten.map((p) => (p.email as string).toLowerCase().trim())));
  const afgemeld = new Set<string>();
  const { data: afmeldData } = await sb
    .from('afmeldingen')
    .select('email')
    .in('email', emails);
  for (const r of (afmeldData as { email: string }[]) ?? []) {
    afgemeld.add((r.email ?? '').toLowerCase().trim());
  }

  const teInschrijven = prospecten.filter((p) => !afgemeld.has((p.email as string).toLowerCase().trim()));
  if (teInschrijven.length === 0) return 0;

  const nu = new Date().toISOString();
  const rijen = teInschrijven.map((p) => ({
    campagne_id: campagneId,
    prospect_id: p.id,
    status: 'actief',
    huidige_stap: 0,
    volgende_verzending: nu,
  }));

  // Upsert met ignoreDuplicates negeert al bestaande inschrijvingen (unieke combinatie).
  const { data: insData, error } = await sb
    .from('campagne_inschrijvingen')
    .upsert(rijen, { onConflict: 'campagne_id,prospect_id', ignoreDuplicates: true })
    .select('id');
  if (error) return 0;
  return ((insData as { id: string }[]) ?? []).length;
}
