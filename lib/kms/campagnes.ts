import { kmsAdmin } from '@/lib/kms/adminClient';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import {
  alleKnopen,
  controleerFlow,
  DOELGROEPEN,
  EINDE_KNOOP,
  knoopTitel,
  leegFlow,
  mailKnopen,
  normaliseerDoel,
  normaliseerFlow,
  normaliseerTrigger,
  triggerOmschrijving,
  vindKnoop,
  type Doel,
  type Doelgroep,
  type Flow,
  type Knoop,
  type Trigger,
} from '@/lib/campagnes/flow';
import { vindVoorbeeld } from '@/lib/campagnes/voorbeelden';
import { campagneModelV2, laadFlow, type CampagneRij } from '@/lib/kms/campagne-engine';
import { contactSleutel, laadContacten, type Contact } from '@/lib/kms/campagneContacten';

/**
 * Data-access voor de module Campagnes (flows met triggers, doelen en
 * rapportage). Alle queries via kmsAdmin() (service role). Alleen server-side,
 * altijd achter dashAuthed().
 *
 * Werkt ook zonder de migratie 20261004_campagnes_flow.sql: dan worden flows
 * gelezen uit de oude campagne_stappen en kan opslaan in de flowbouwer niet.
 */

export const CAMPAGNE_STATUSSEN = ['concept', 'actief', 'gepauzeerd', 'afgerond'] as const;
export type CampagneStatus = (typeof CAMPAGNE_STATUSSEN)[number];
export const CAMPAGNE_TYPES = ['cold', 'nurture', 'reengage'] as const;

export const MIGRATIE_MELDING = 'Dit kan pas na de migratie 20261004_campagnes_flow.sql. Vraag Tim om die te draaien.';

export type Campagne = {
  id: string;
  naam: string;
  type: string;
  status: string;
  van_naam: string | null;
  van_email: string | null;
  created_at: string;
  omschrijving: string | null;
  doelgroep: Doelgroep;
  trigger: Trigger;
  doel: Doel;
  voorbeeld: string | null;
  geactiveerd_op: string | null;
};

function naarCampagne(r: CampagneRij): Campagne {
  const dg = (DOELGROEPEN as readonly string[]).includes(String(r.doelgroep)) ? (r.doelgroep as Doelgroep) : 'prospect';
  return {
    id: r.id,
    naam: r.naam,
    type: r.type,
    status: r.status,
    van_naam: r.van_naam,
    van_email: r.van_email,
    created_at: r.created_at,
    omschrijving: r.omschrijving ?? null,
    doelgroep: dg,
    trigger: normaliseerTrigger(r.trigger),
    doel: normaliseerDoel(r.doel),
    voorbeeld: r.voorbeeld ?? null,
    geactiveerd_op: r.geactiveerd_op ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Overzicht                                                           */
/* ------------------------------------------------------------------ */

export type CampagneKaart = Campagne & {
  triggerTekst: string;
  aantalStappen: number;
  aantalMails: number;
  totaal: number;
  actief: number;
  doelBereikt: number;
  afgemeld: number;
  verzonden: number;
  geopend: number;
  geklikt: number;
  /** Laatste 14 dagen verzonden, per dag (oud naar nieuw). */
  reeks: number[];
};

async function alleRijen<T>(maak: (van: number, tot: number) => PromiseLike<{ data: unknown; error: unknown }>, max = 20000): Promise<{ rijen: T[]; fout: unknown }> {
  const uit: T[] = [];
  for (let van = 0; van < max; van += 1000) {
    const { data, error } = await maak(van, van + 999);
    if (error) return { rijen: uit, fout: error };
    const deel = (data as T[]) ?? [];
    uit.push(...deel);
    if (deel.length < 1000) break;
  }
  return { rijen: uit, fout: null };
}

export async function listCampagnes(): Promise<CampagneKaart[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('campagnes').select('*').order('created_at', { ascending: false });
  const rijen = (data as CampagneRij[]) ?? [];
  if (!rijen.length) return [];
  const ids = rijen.map((r) => r.id);

  const { rijen: ins } = await alleRijen<{ campagne_id: string; status: string }>((a, b) => sb.from('campagne_inschrijvingen').select('campagne_id, status').in('campagne_id', ids).range(a, b));

  let verz = await alleRijen<{ campagne_id: string | null; status: string; verzonden_op: string; geopend_op?: string | null; geklikt_op?: string | null }>((a, b) =>
    sb.from('campagne_verzendingen').select('campagne_id, status, verzonden_op, geopend_op, geklikt_op').in('campagne_id', ids).range(a, b),
  );
  if (verz.fout && kolomOntbreekt(verz.fout as { code?: string })) {
    verz = await alleRijen((a, b) => sb.from('campagne_verzendingen').select('campagne_id, status, verzonden_op').in('campagne_id', ids).range(a, b));
  }

  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  const dagIndex = (iso: string) => 13 - Math.floor((vandaag.getTime() - new Date(new Date(iso).setHours(0, 0, 0, 0)).getTime()) / 86_400_000);

  const uit: CampagneKaart[] = [];
  for (const r of rijen) {
    const c = naarCampagne(r);
    const flow = await laadFlow(r);
    const mijnIns = ins.filter((i) => i.campagne_id === r.id);
    const mijnVerz = verz.rijen.filter((v) => v.campagne_id === r.id && v.status === 'verzonden');
    const reeks = new Array(14).fill(0) as number[];
    for (const v of mijnVerz) {
      const i = dagIndex(v.verzonden_op);
      if (i >= 0 && i < 14) reeks[i]++;
    }
    uit.push({
      ...c,
      triggerTekst: triggerOmschrijving(c.trigger),
      aantalStappen: alleKnopen(flow.stappen).length,
      aantalMails: mailKnopen(flow).length,
      totaal: mijnIns.length,
      actief: mijnIns.filter((i) => i.status === 'actief').length,
      doelBereikt: mijnIns.filter((i) => i.status === 'doel').length,
      afgemeld: mijnIns.filter((i) => i.status === 'afgemeld').length,
      verzonden: mijnVerz.length,
      geopend: mijnVerz.filter((v) => v.geopend_op).length,
      geklikt: mijnVerz.filter((v) => v.geklikt_op).length,
      reeks,
    });
  }
  return uit;
}

/* ------------------------------------------------------------------ */
/* Eén campagne                                                        */
/* ------------------------------------------------------------------ */

export type CampagneDetail = Campagne & {
  flow: Flow;
  /** Kan er in de flowbouwer worden opgeslagen (migratie gedraaid)? */
  v2: boolean;
  totaal: number;
  perStatus: Record<string, number>;
  /** Hoeveel actieve ingeschrevenen er op een stap staan te wachten. */
  opStap: Record<string, number>;
  /** Per mailstap: verzonden, geopend, geklikt. */
  perMail: Record<string, { verzonden: number; geopend: number; geklikt: number; mislukt: number }>;
};

export async function getCampagne(id: string): Promise<CampagneDetail | null> {
  const sb = kmsAdmin();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from('campagnes').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const rij = data as CampagneRij;
  const v2 = await campagneModelV2();
  const flow = await laadFlow(rij);

  const insKolommen = v2 ? 'status, huidige_knoop, huidige_stap' : 'status, huidige_stap';
  const { rijen: ins } = await alleRijen<{ status: string; huidige_knoop?: string | null; huidige_stap: number }>((a, b) =>
    sb.from('campagne_inschrijvingen').select(insKolommen).eq('campagne_id', id).range(a, b),
  );
  const perStatus: Record<string, number> = {};
  const opStap: Record<string, number> = {};
  const mails = mailKnopen(flow);
  for (const i of ins) {
    perStatus[i.status] = (perStatus[i.status] ?? 0) + 1;
    if (i.status !== 'actief') continue;
    const knoop = i.huidige_knoop ?? (i.huidige_stap > 0 ? mails[i.huidige_stap]?.id : flow.stappen[0]?.id);
    if (knoop) opStap[knoop] = (opStap[knoop] ?? 0) + 1;
  }

  const perMail: CampagneDetail['perMail'] = {};
  const verzKol = v2 ? 'node_id, stap_id, status, geopend_op, geklikt_op' : 'stap_id, status';
  const { rijen: verz } = await alleRijen<{ node_id?: string | null; stap_id: string | null; status: string; geopend_op?: string | null; geklikt_op?: string | null }>((a, b) =>
    sb.from('campagne_verzendingen').select(verzKol).eq('campagne_id', id).range(a, b),
  );
  for (const v of verz) {
    const k = v.node_id ?? v.stap_id;
    if (!k) continue;
    const p = (perMail[k] ??= { verzonden: 0, geopend: 0, geklikt: 0, mislukt: 0 });
    if (v.status === 'verzonden') {
      p.verzonden++;
      if (v.geopend_op) p.geopend++;
      if (v.geklikt_op) p.geklikt++;
    } else p.mislukt++;
  }

  return { ...naarCampagne(rij), flow, v2, totaal: ins.length, perStatus, opStap, perMail };
}

/* ------------------------------------------------------------------ */
/* Aanmaken, kopiëren, verwijderen                                     */
/* ------------------------------------------------------------------ */

/** Zonder migratie: alleen de hoofdlijn van een flow als platte stappen opslaan. */
async function bewaarAlsLegacy(campagneId: string, flow: Flow): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  const rijen: Record<string, unknown>[] = [];
  let wacht = 0;
  for (const k of flow.stappen) {
    if (k.type === 'wacht') wacht += k.modus === 'uren' ? Math.ceil(k.aantal / 24) : k.modus === 'dagen' ? k.aantal : 3;
    if (k.type === 'mail' && k.stijl !== 'nieuwsbrief') {
      rijen.push({ campagne_id: campagneId, volgorde: rijen.length + 1, wacht_dagen: rijen.length ? wacht : 0, onderwerp: k.onderwerp, body: k.inhoud, ai_personaliseer: k.ai });
      wacht = 0;
    }
  }
  if (rijen.length) await sb.from('campagne_stappen').insert(rijen);
}

export async function maakCampagne(v: { naam: string; voorbeeld?: string | null; doelgroep?: string | null; van_naam?: string | null; van_email?: string | null }): Promise<{ id: string } | { fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { fout: 'Database niet bereikbaar.' };
  const vb = v.voorbeeld ? vindVoorbeeld(v.voorbeeld) : null;
  const naam = (v.naam || vb?.naam || '').trim().slice(0, 120);
  if (!naam) return { fout: 'Geef de campagne een naam.' };
  const doelgroep: Doelgroep = vb ? vb.doelgroep : (DOELGROEPEN as readonly string[]).includes(String(v.doelgroep)) ? (v.doelgroep as Doelgroep) : 'prospect';
  const flow = vb ? vb.flow() : leegFlow();

  const basis: Record<string, unknown> = {
    naam,
    type: vb?.type ?? 'nurture',
    status: 'concept',
    van_naam: v.van_naam?.trim() || null,
    van_email: v.van_email?.trim() || null,
  };
  const v2 = await campagneModelV2();
  if (v2) {
    const { data, error } = await sb
      .from('campagnes')
      .insert({ ...basis, flow, trigger: vb?.trigger ?? { soort: 'handmatig' }, doel: vb?.doel ?? { soorten: [] }, doelgroep, voorbeeld: vb?.sleutel ?? null, omschrijving: vb?.korteUitleg ?? null })
      .select('id')
      .single();
    if (!error && data) return { id: (data as { id: string }).id };
  }
  const { data, error } = await sb.from('campagnes').insert(basis).select('id').single();
  if (error || !data) return { fout: 'Aanmaken is niet gelukt. Probeer het nog eens.' };
  const id = (data as { id: string }).id;
  if (vb) await bewaarAlsLegacy(id, flow);
  return { id };
}

export async function dupliceerCampagne(id: string): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data } = await sb.from('campagnes').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const r = data as CampagneRij;
  const flow = await laadFlow(r);
  const basis = { naam: `${r.naam} (kopie)`.slice(0, 120), type: r.type, status: 'concept', van_naam: r.van_naam, van_email: r.van_email };
  if (await campagneModelV2()) {
    const { data: nieuw, error } = await sb
      .from('campagnes')
      .insert({ ...basis, flow, trigger: r.trigger ?? { soort: 'handmatig' }, doel: r.doel ?? { soorten: [] }, doelgroep: r.doelgroep ?? 'prospect', omschrijving: r.omschrijving ?? null, voorbeeld: r.voorbeeld ?? null })
      .select('id')
      .single();
    if (!error && nieuw) return (nieuw as { id: string }).id;
  }
  const { data: nieuw } = await sb.from('campagnes').insert(basis).select('id').single();
  if (!nieuw) return null;
  await bewaarAlsLegacy((nieuw as { id: string }).id, flow);
  return (nieuw as { id: string }).id;
}

export async function verwijderCampagne(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  await sb.from('campagne_events').delete().eq('campagne_id', id);
  const { error } = await sb.from('campagnes').delete().eq('id', id);
  return !error;
}

/* ------------------------------------------------------------------ */
/* Bewerken                                                            */
/* ------------------------------------------------------------------ */

export async function bewaarFlow(id: string, invoer: unknown): Promise<{ ok: true; flow: Flow } | { ok: false; fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const flow = normaliseerFlow(invoer);
  if (JSON.stringify(flow).length > 400_000) return { ok: false, fout: 'De campagne is te groot om op te slaan.' };
  const { error } = await sb.from('campagnes').update({ flow, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, fout: kolomOntbreekt(error) ? MIGRATIE_MELDING : 'Opslaan is niet gelukt.' };
  return { ok: true, flow };
}

export async function bewaarCampagneInstellingen(
  id: string,
  v: { naam: string; omschrijving: string; van_naam: string; van_email: string; doelgroep: string; trigger: unknown; doel: unknown },
): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const naam = v.naam.trim().slice(0, 120);
  if (!naam) return { ok: false, fout: 'Geef de campagne een naam.' };
  const email = v.van_email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, fout: 'Het afzenderadres klopt niet.' };
  const basis = { naam, van_naam: v.van_naam.trim() || null, van_email: email || null };
  const trigger = normaliseerTrigger(v.trigger);
  const doelgroep = (DOELGROEPEN as readonly string[]).includes(v.doelgroep) ? v.doelgroep : 'prospect';
  const { error } = await sb
    .from('campagnes')
    .update({ ...basis, omschrijving: v.omschrijving.trim() || null, doelgroep, trigger, doel: normaliseerDoel(v.doel), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (!error) return { ok: true };
  if (kolomOntbreekt(error)) {
    const r = await sb.from('campagnes').update(basis).eq('id', id);
    return r.error ? { ok: false, fout: 'Opslaan is niet gelukt.' } : { ok: true, fout: `Naam en afzender opgeslagen. Trigger en doel: ${MIGRATIE_MELDING}` };
  }
  return { ok: false, fout: 'Opslaan is niet gelukt.' };
}

/**
 * Status wijzigen. Activeren kan alleen met een flow zonder fouten. Bij de eerste
 * activering zetten we geactiveerd_op: automatische triggers kijken alleen naar
 * wat daarna gebeurt (geen mail aan iedereen die ooit een QR-code scande).
 */
export async function zetCampagneStatus(id: string, status: string): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  if (!(CAMPAGNE_STATUSSEN as readonly string[]).includes(status)) return { ok: false, fout: 'Onbekende status.' };
  const { data } = await sb.from('campagnes').select('*').eq('id', id).maybeSingle();
  if (!data) return { ok: false, fout: 'Campagne niet gevonden.' };
  const r = data as CampagneRij;
  if (status === 'actief') {
    const problemen = controleerFlow(await laadFlow(r));
    if (problemen.length) return { ok: false, fout: `Nog niet klaar om te starten: ${problemen[0].tekst}` };
  }
  const patch: Record<string, unknown> = { status };
  if (status === 'actief' && !r.geactiveerd_op && (await campagneModelV2())) patch.geactiveerd_op = new Date().toISOString();
  const { error } = await sb.from('campagnes').update(patch).eq('id', id);
  return error ? { ok: false, fout: 'Status wijzigen is niet gelukt.' } : { ok: true };
}

/* ------------------------------------------------------------------ */
/* Ontvangers                                                          */
/* ------------------------------------------------------------------ */

export type OntvangerRij = {
  id: string;
  status: string;
  soort: 'prospect' | 'lead' | 'klant' | null;
  contactId: string | null;
  naam: string;
  bedrijf: string;
  email: string;
  stapTitel: string;
  stapType: Knoop['type'] | null;
  volgendeActie: string | null;
  ingeschreven: string;
  gereageerd: boolean;
  verzonden: number;
  geopend: number;
  geklikt: number;
};

export async function listOntvangers(
  campagneId: string,
  opties: { status?: string; q?: string; limiet?: number } = {},
): Promise<{ rijen: OntvangerRij[]; perStatus: Record<string, number>; meer: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { rijen: [], perStatus: {}, meer: false };
  const v2 = await campagneModelV2();
  const { data: campData } = await sb.from('campagnes').select('*').eq('id', campagneId).maybeSingle();
  if (!campData) return { rijen: [], perStatus: {}, meer: false };
  const flow = await laadFlow(campData as CampagneRij);
  const mails = mailKnopen(flow);

  const kol = v2
    ? 'id, status, prospect_id, lead_id, organisatie_id, email, naam, huidige_knoop, huidige_stap, volgende_verzending, created_at, gereageerd_op'
    : 'id, status, prospect_id, huidige_stap, volgende_verzending, created_at';
  const { rijen: alle } = await alleRijen<{
    id: string;
    status: string;
    prospect_id: string | null;
    lead_id?: string | null;
    organisatie_id?: string | null;
    email?: string | null;
    naam?: string | null;
    huidige_knoop?: string | null;
    huidige_stap: number;
    volgende_verzending: string | null;
    created_at: string;
    gereageerd_op?: string | null;
  }>((a, b) => sb.from('campagne_inschrijvingen').select(kol).eq('campagne_id', campagneId).order('created_at', { ascending: false }).range(a, b));

  const perStatus: Record<string, number> = {};
  for (const r of alle) perStatus[r.status] = (perStatus[r.status] ?? 0) + 1;

  const gefilterd = opties.status ? alle.filter((r) => r.status === opties.status) : alle;
  const contacten = await laadContacten({
    prospectIds: gefilterd.map((r) => r.prospect_id ?? '').filter(Boolean),
    leadIds: gefilterd.map((r) => r.lead_id ?? '').filter(Boolean),
    orgIds: gefilterd.map((r) => r.organisatie_id ?? '').filter(Boolean),
  });

  const verzPer = new Map<string, { verzonden: number; geopend: number; geklikt: number }>();
  const { rijen: verz } = await alleRijen<{ inschrijving_id: string | null; status: string; geopend_op?: string | null; geklikt_op?: string | null }>((a, b) =>
    sb.from('campagne_verzendingen').select(v2 ? 'inschrijving_id, status, geopend_op, geklikt_op' : 'inschrijving_id, status').eq('campagne_id', campagneId).range(a, b),
  );
  for (const v of verz) {
    if (!v.inschrijving_id || v.status !== 'verzonden') continue;
    const p = verzPer.get(v.inschrijving_id) ?? { verzonden: 0, geopend: 0, geklikt: 0 };
    p.verzonden++;
    if (v.geopend_op) p.geopend++;
    if (v.geklikt_op) p.geklikt++;
    verzPer.set(v.inschrijving_id, p);
  }

  const q = (opties.q ?? '').trim().toLowerCase();
  let rijen: OntvangerRij[] = gefilterd.map((r) => {
    const soort: OntvangerRij['soort'] = r.prospect_id ? 'prospect' : r.lead_id ? 'lead' : r.organisatie_id ? 'klant' : null;
    const contactId = r.prospect_id ?? r.lead_id ?? r.organisatie_id ?? null;
    const ct: Contact | null = soort && contactId ? contacten.get(contactSleutel(soort, contactId)) ?? null : null;
    const knoopId = r.huidige_knoop ?? (r.huidige_stap > 0 ? mails[r.huidige_stap]?.id : r.status === 'actief' ? flow.stappen[0]?.id : null);
    const k = vindKnoop(flow, knoopId ?? null);
    const opEinde = knoopId === EINDE_KNOOP;
    const p = verzPer.get(r.id) ?? { verzonden: 0, geopend: 0, geklikt: 0 };
    return {
      id: r.id,
      status: r.status,
      soort,
      contactId,
      naam: ct?.naam ?? r.naam ?? '',
      bedrijf: ct?.bedrijfsnaam ?? '',
      email: ct?.email ?? r.email ?? '',
      stapTitel: r.status === 'actief' ? (k ? knoopTitel(k, flow) : opEinde ? 'Laatste wachtstap, daarna klaar' : 'Begin') : '',
      stapType: r.status === 'actief' ? k?.type ?? null : null,
      volgendeActie: r.status === 'actief' ? r.volgende_verzending : null,
      ingeschreven: r.created_at,
      gereageerd: Boolean(r.gereageerd_op),
      ...p,
    };
  });
  if (q) rijen = rijen.filter((r) => `${r.naam} ${r.bedrijf} ${r.email}`.toLowerCase().includes(q));
  const limiet = opties.limiet ?? 300;
  return { rijen: rijen.slice(0, limiet), perStatus, meer: rijen.length > limiet };
}

export async function stopInschrijving(id: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const { data } = await sb.from('campagne_inschrijvingen').select('campagne_id').eq('id', id).maybeSingle();
  const { error } = await sb.from('campagne_inschrijvingen').update({ status: 'gestopt', volgende_verzending: null }).eq('id', id);
  if (!error && data) await sb.from('campagne_events').insert({ campagne_id: (data as { campagne_id: string }).campagne_id, inschrijving_id: id, soort: 'gestopt', detail: { reden: 'Handmatig gestopt' } });
  return !error;
}

/** Zoals "mark as replied" in Lemlist: telt voor de splitsing "heeft gereageerd" en het doel. */
export async function markeerGereageerd(id: string): Promise<{ ok: boolean; fout?: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false };
  const { data } = await sb.from('campagne_inschrijvingen').select('campagne_id').eq('id', id).maybeSingle();
  const { error } = await sb.from('campagne_inschrijvingen').update({ gereageerd_op: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, fout: kolomOntbreekt(error) ? MIGRATIE_MELDING : 'Opslaan mislukt.' };
  if (data) await sb.from('campagne_events').insert({ campagne_id: (data as { campagne_id: string }).campagne_id, inschrijving_id: id, soort: 'gereageerd' });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tijdlijn per ontvanger                                              */
/* ------------------------------------------------------------------ */

export type TijdlijnRegel = { tijd: string; soort: string; titel: string; detail: string | null };

const EVENT_LABEL: Record<string, string> = {
  ingeschreven: 'Ingeschreven',
  verzonden: 'Mail verstuurd',
  mislukt: 'Versturen mislukt',
  geopend: 'Mail geopend',
  geklikt: 'Op een link geklikt',
  afmeldklik: 'Op afmelden geklikt',
  afgemeld: 'Afgemeld',
  wacht: 'Wacht',
  splitsing: 'Splitsing',
  taak: 'Taak aangemaakt',
  status: 'Status gewijzigd',
  tag: 'Tag',
  doel: 'Doel bereikt',
  klaar: 'Campagne doorlopen',
  gestopt: 'Gestopt',
  gereageerd: 'Gemarkeerd als gereageerd',
};

export async function getTijdlijn(insId: string): Promise<{
  campagneId: string;
  campagneNaam: string;
  status: string;
  contact: Contact | null;
  email: string;
  ingeschreven: string;
  stapTitel: string;
  volgendeActie: string | null;
  regels: TijdlijnRegel[];
} | null> {
  const sb = kmsAdmin();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(insId)) return null;
  const v2 = await campagneModelV2();
  const { data } = await sb.from('campagne_inschrijvingen').select('*').eq('id', insId).maybeSingle();
  if (!data) return null;
  const ins = data as Record<string, unknown> & { campagne_id: string; status: string; created_at: string; volgende_verzending: string | null; huidige_stap: number };
  const { data: campData } = await sb.from('campagnes').select('*').eq('id', ins.campagne_id).maybeSingle();
  if (!campData) return null;
  const camp = campData as CampagneRij;
  const flow = await laadFlow(camp);
  const contacten = await laadContacten({
    prospectIds: ins.prospect_id ? [String(ins.prospect_id)] : [],
    leadIds: ins.lead_id ? [String(ins.lead_id)] : [],
    orgIds: ins.organisatie_id ? [String(ins.organisatie_id)] : [],
  });
  const contact = Array.from(contacten.values())[0] ?? null;

  const regels: TijdlijnRegel[] = [];
  const titelVoor = (nodeId: string | null) => {
    const k = vindKnoop(flow, nodeId);
    return k ? knoopTitel(k, flow) : null;
  };
  if (v2) {
    const { data: ev } = await sb.from('campagne_events').select('soort, node_id, detail, created_at').eq('inschrijving_id', insId).order('created_at', { ascending: true }).limit(500);
    for (const e of (ev as { soort: string; node_id: string | null; detail: Record<string, unknown> | null; created_at: string }[]) ?? []) {
      const d = e.detail ?? {};
      let detail: string | null = null;
      if (e.soort === 'verzonden') detail = String(d.onderwerp ?? titelVoor(e.node_id) ?? '');
      else if (e.soort === 'mislukt') detail = String(d.fout ?? '');
      else if (e.soort === 'geklikt') detail = String(d.url ?? '');
      else if (e.soort === 'wacht') detail = d.tot ? `tot ${new Date(String(d.tot)).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : null;
      else if (e.soort === 'splitsing') detail = `${titelVoor(e.node_id) ?? 'Splitsing'} ${d.uitkomst === 'ja' ? 'Ja' : 'Nee'}`;
      else if (e.soort === 'taak') detail = String(d.titel ?? '');
      else if (e.soort === 'status') detail = `${d.van ?? '?'} naar ${d.naar ?? '?'}`;
      else if (e.soort === 'tag') detail = `${d.actie === 'verwijderen' ? 'weggehaald' : 'toegevoegd'}: ${d.tag ?? ''}`;
      else if (e.soort === 'doel') detail = String(d.doel ?? '');
      else if (e.soort === 'gestopt') detail = String(d.reden ?? '');
      else if (e.soort === 'ingeschreven') detail = d.bron === 'trigger' ? `automatisch${d.opnieuw ? ', opnieuw' : ''}` : 'handmatig';
      regels.push({ tijd: e.created_at, soort: e.soort, titel: EVENT_LABEL[e.soort] ?? e.soort, detail });
    }
  } else {
    regels.push({ tijd: ins.created_at, soort: 'ingeschreven', titel: 'Ingeschreven', detail: null });
    const { data: vz } = await sb.from('campagne_verzendingen').select('onderwerp, status, error, verzonden_op').eq('inschrijving_id', insId).order('verzonden_op');
    for (const v of (vz as { onderwerp: string | null; status: string; error: string | null; verzonden_op: string }[]) ?? []) {
      regels.push({ tijd: v.verzonden_op, soort: v.status === 'verzonden' ? 'verzonden' : 'mislukt', titel: v.status === 'verzonden' ? 'Mail verstuurd' : 'Versturen mislukt', detail: v.status === 'verzonden' ? v.onderwerp : v.error });
    }
  }

  const mails = mailKnopen(flow);
  const knoopId = (ins.huidige_knoop as string | null) ?? (ins.huidige_stap > 0 ? mails[ins.huidige_stap]?.id : flow.stappen[0]?.id) ?? null;
  return {
    campagneId: camp.id,
    campagneNaam: camp.naam,
    status: ins.status,
    contact,
    email: contact?.email ?? String(ins.email ?? ''),
    ingeschreven: ins.created_at,
    stapTitel: ins.status === 'actief' ? titelVoor(knoopId) ?? (knoopId === EINDE_KNOOP ? 'Laatste wachtstap, daarna klaar' : 'Begin') : '',
    volgendeActie: ins.status === 'actief' ? ins.volgende_verzending : null,
    regels,
  };
}

/* ------------------------------------------------------------------ */
/* Rapport                                                             */
/* ------------------------------------------------------------------ */

export type CampagneRapport = {
  verzonden: number;
  mislukt: number;
  geopend: number;
  geklikt: number;
  afgemeld: number;
  afmeldkliks: number;
  gebounced: number;
  doelBereikt: number;
  totaal: number;
  /** Laatste 30 dagen, oud naar nieuw. */
  perDag: { dag: string; verzonden: number; geklikt: number }[];
  /** Splitsingen: hoeveel ja en nee. */
  splitsingen: Record<string, { ja: number; nee: number }>;
  takenAangemaakt: number;
  doelPerSoort: Record<string, number>;
};

export async function getRapport(campagneId: string): Promise<CampagneRapport> {
  const sb = kmsAdmin();
  const leeg: CampagneRapport = { verzonden: 0, mislukt: 0, geopend: 0, geklikt: 0, afgemeld: 0, afmeldkliks: 0, gebounced: 0, doelBereikt: 0, totaal: 0, perDag: [], splitsingen: {}, takenAangemaakt: 0, doelPerSoort: {} };
  if (!sb) return leeg;
  const v2 = await campagneModelV2();

  const { rijen: verz } = await alleRijen<{ status: string; verzonden_op: string; geopend_op?: string | null; geklikt_op?: string | null }>((a, b) =>
    sb.from('campagne_verzendingen').select(v2 ? 'status, verzonden_op, geopend_op, geklikt_op' : 'status, verzonden_op').eq('campagne_id', campagneId).range(a, b),
  );
  const { rijen: ins } = await alleRijen<{ status: string }>((a, b) => sb.from('campagne_inschrijvingen').select('status').eq('campagne_id', campagneId).range(a, b));

  const r: CampagneRapport = { ...leeg, totaal: ins.length };
  const dagen: { dag: string; verzonden: number; geklikt: number }[] = [];
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' });
  const nu = Date.now();
  for (let i = 29; i >= 0; i--) dagen.push({ dag: fmt.format(new Date(nu - i * 86_400_000)), verzonden: 0, geklikt: 0 });
  const perDagIndex = new Map(dagen.map((d, i) => [d.dag, i]));

  for (const v of verz) {
    if (v.status !== 'verzonden') {
      r.mislukt++;
      continue;
    }
    r.verzonden++;
    if (v.geopend_op) r.geopend++;
    if (v.geklikt_op) r.geklikt++;
    const i = perDagIndex.get(fmt.format(new Date(v.verzonden_op)));
    if (i !== undefined) {
      dagen[i].verzonden++;
      if (v.geklikt_op) dagen[i].geklikt++;
    }
  }
  for (const i of ins) {
    if (i.status === 'afgemeld') r.afgemeld++;
    if (i.status === 'gebounced') r.gebounced++;
    if (i.status === 'doel') r.doelBereikt++;
  }
  r.perDag = dagen;

  if (v2) {
    const { rijen: ev } = await alleRijen<{ soort: string; node_id: string | null; detail: Record<string, unknown> | null }>((a, b) =>
      sb.from('campagne_events').select('soort, node_id, detail').eq('campagne_id', campagneId).in('soort', ['splitsing', 'taak', 'afmeldklik', 'doel']).range(a, b),
    );
    for (const e of ev) {
      if (e.soort === 'afmeldklik') r.afmeldkliks++;
      if (e.soort === 'taak') r.takenAangemaakt++;
      if (e.soort === 'doel') {
        const s = String(e.detail?.doel ?? 'onbekend');
        r.doelPerSoort[s] = (r.doelPerSoort[s] ?? 0) + 1;
      }
      if (e.soort === 'splitsing' && e.node_id) {
        const p = (r.splitsingen[e.node_id] ??= { ja: 0, nee: 0 });
        if (e.detail?.uitkomst === 'ja') p.ja++;
        else p.nee++;
      }
    }
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Kerncijfers voor het overzicht                                      */
/* ------------------------------------------------------------------ */

export async function verzondenVandaag(): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const sinds = new Date(Date.now() - 20 * 3_600_000).toISOString();
  const { count } = await sb.from('campagne_verzendingen').select('id', { count: 'exact', head: true }).eq('status', 'verzonden').gte('verzonden_op', sinds);
  return count ?? 0;
}

/** Wacht er iemand bij een mailstap omdat mail nog niet is ingesteld? */
export async function aantalWachtendOpMail(): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { count } = await sb
    .from('campagne_inschrijvingen')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'actief')
    .lte('volgende_verzending', new Date().toISOString());
  return count ?? 0;
}

export { knoopTitel };
