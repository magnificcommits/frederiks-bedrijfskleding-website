import { kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit, huidigeActor } from '@/lib/kms/audit';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import { eisData } from '@/lib/dbFout';
import { maakTaak, getTaak, vinkTaak } from '@/lib/kms/taken';
import { maakOfferte } from '@/lib/kms/offertes';
import { regelsNaarOfferte } from '@/lib/kms/leadInname';
import { zetLeadLogosNaarKlant } from '@/lib/kms/leadLogos';
import { WEB_KANALEN, kanaalUitHerkomst, type PadStap } from '@/lib/leadHerkomst';
import {
  CONTACT_SOORTEN,
  GEWONNEN,
  VERLOREN,
  berekenScore,
  bronKanaal,
  emailSleutel,
  bedrijfSleutel,
  heeftEmail,
  isOpen,
  leadKans,
  leadWaarde,
  opvolgStand,
  statusLabel,
  urenTussen,
  vandaagNl,
  vindDubbelen,
  ACTIVITEIT_SOORTEN,
  type LeadRij,
  type LeadScore,
  type OpvolgStand,
} from '@/lib/kms/leadsModel';

/**
 * Data-access voor leads in het dashboard. Alleen server-side, altijd achter dashAuthed().
 *
 * Werkt met en zonder migratie 20261004_leads_opvolging:
 * - nieuwe kolommen ontbreken -> de update wordt herhaald zonder die kolommen;
 * - lead_activiteiten ontbreekt -> tijdlijnregels gaan naar audit_log (entiteit 'lead').
 */

type Sb = NonNullable<ReturnType<typeof kmsAdmin>>;
type PgFout = { code?: string; message?: string } | null | undefined;

/** Kolommen die pas met de migratie bestaan. */
const NIEUWE_KOLOMMEN = [
  'score', 'kans', 'verloren_reden', 'eerste_contact', 'laatste_contact',
  'eigenaar_id', 'eigenaar', 'volgende_stap', 'volgende_taak_id', 'status_gewijzigd_op',
  // 20261006_weblead_inname
  'bron_kanaal', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'referrer',
  'landingspagina', 'conversiepagina', 'paginas_bekeken', 'bezochte_paden', 'eerste_bezoek_op', 'bezoeken', 'gezien_op',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Tabel bestaat (nog) niet: 42P01 in Postgres, PGRST205 in PostgREST. */
export function tabelOntbreekt(f: PgFout): boolean {
  if (!f) return false;
  if (f.code === '42P01' || f.code === 'PGRST205') return true;
  const m = String(f.message ?? '').toLowerCase();
  return m.includes('could not find the table') || (m.includes('relation') && m.includes('does not exist'));
}

/** Update op leads; ontbreken de nieuwe kolommen, dan nogmaals met alleen de oude. */
async function updateLead(sb: Sb, id: string, patch: Record<string, unknown>): Promise<boolean> {
  if (!Object.keys(patch).length) return true;
  const eerste = await sb.from('leads').update(patch).eq('id', id);
  if (!eerste.error) return true;
  if (!kolomOntbreekt(eerste.error)) return false;
  const oud = { ...patch };
  for (const k of NIEUWE_KOLOMMEN) delete oud[k];
  if (!Object.keys(oud).length) return true; // alleen nieuwe velden: stil overslaan
  const tweede = await sb.from('leads').update(oud).eq('id', id);
  return !tweede.error;
}

/* ------------------------------------------------------------------ */
/* Lezen                                                               */
/* ------------------------------------------------------------------ */

function naarRij(r: Record<string, unknown>): LeadRij {
  const s = (k: string) => (r[k] === undefined || r[k] === null ? null : String(r[k]));
  const n = (k: string) => (r[k] === undefined || r[k] === null || r[k] === '' ? null : Number(r[k]));
  return {
    id: String(r.id),
    created_at: String(r.created_at ?? ''),
    name: String(r.name ?? ''),
    company: s('company'),
    email: s('email'),
    phone: s('phone'),
    branche: s('branche'),
    aantal: s('aantal'),
    bericht: s('bericht'),
    bron: s('bron'),
    status: String(r.status ?? 'nieuw'),
    offertewaarde: n('offertewaarde'),
    notitie: s('notitie'),
    opvolgdatum: s('opvolgdatum'),
    organisatie_id: s('organisatie_id'),
    score: n('score'),
    kans: n('kans'),
    verloren_reden: s('verloren_reden'),
    eerste_contact: s('eerste_contact'),
    laatste_contact: s('laatste_contact'),
    eigenaar_id: s('eigenaar_id'),
    eigenaar: s('eigenaar'),
    volgende_stap: s('volgende_stap'),
    volgende_taak_id: s('volgende_taak_id'),
    status_gewijzigd_op: s('status_gewijzigd_op'),
    bron_kanaal: s('bron_kanaal'),
    utm_source: s('utm_source'),
    utm_medium: s('utm_medium'),
    utm_campaign: s('utm_campaign'),
    utm_term: s('utm_term'),
    utm_content: s('utm_content'),
    gclid: s('gclid'),
    referrer: s('referrer'),
    landingspagina: s('landingspagina'),
    conversiepagina: s('conversiepagina'),
    paginas_bekeken: n('paginas_bekeken'),
    bezochte_paden: Array.isArray(r.bezochte_paden) ? (r.bezochte_paden as PadStap[]) : null,
    eerste_bezoek_op: s('eerste_bezoek_op'),
    bezoeken: n('bezoeken'),
    gezien_op: s('gezien_op'),
  };
}

export async function listLeadRijen(): Promise<LeadRij[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(2000);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(naarRij);
}

export async function getLeadRij(id: string): Promise<LeadRij | null> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) return null;
  const { data } = await sb.from('leads').select('*').eq('id', id).maybeSingle();
  return data ? naarRij(data as Record<string, unknown>) : null;
}

/** Contactmomenten per lead (eerste contact, klant reageerde) uit de tijdlijn. */
type Moment = { lead_id: string; soort: string; created_at: string };

async function listContactMomenten(sb: Sb): Promise<Moment[]> {
  const { data, error } = await sb
    .from('lead_activiteiten')
    .select('lead_id, soort, created_at')
    .in('soort', [...CONTACT_SOORTEN])
    .order('created_at', { ascending: true })
    .limit(5000);
  if (!error) return (data as Moment[]) ?? [];
  if (!tabelOntbreekt(error)) return [];
  // Terugval: de regels staan in audit_log.
  const { data: audit } = await sb
    .from('audit_log')
    .select('entiteit_id, details, created_at')
    .eq('entiteit', 'lead')
    .eq('actie', 'lead.activiteit')
    .order('created_at', { ascending: true })
    .limit(5000);
  return ((audit as { entiteit_id: string | null; details: { soort?: string } | null; created_at: string }[]) ?? [])
    .filter((a) => a.entiteit_id && CONTACT_SOORTEN.includes(String(a.details?.soort ?? '')))
    .map((a) => ({ lead_id: String(a.entiteit_id), soort: String(a.details?.soort), created_at: a.created_at }));
}

/** Een lead met alles wat de pijplijn, de lijst en de KPI's nodig hebben. */
export type LeadKaart = LeadRij & {
  scoreInfo: LeadScore;
  scoreWaarde: number;
  eersteContactOp: string | null;
  klantReageerde: boolean;
  /** Uren sinds binnenkomst zonder enig contact; null als er al contact was of de lead dicht is. */
  wachtUren: number | null;
  opvolg: OpvolgStand;
  waarde: number;
  waardeGeschat: boolean;
  kansPct: number;
  kanaal: string;
  dubbelVan: string[];
};

/** Migratie nog niet gedraaid: de tabel of een kolom bestaat niet. Dan is leeg het juiste antwoord. */
function zonderMigratie(f: PgFout): boolean {
  return Boolean(f) && (tabelOntbreekt(f) || kolomOntbreekt(f));
}

/** Per lead: aantal productregels en of er een logo is (voor de leadscore). */
export type LeadExtra = { regels: Map<string, number>; logos: Set<string> };

async function listLeadExtra(sb: Sb): Promise<LeadExtra> {
  const [r, l] = await Promise.all([
    sb.from('lead_regels').select('lead_id').limit(10000),
    sb.from('lead_logos').select('lead_id').limit(5000),
  ]);
  // Zonder migratie (tabel of kolom ontbreekt) blijft de score gewoon zonder deze punten.
  // Elke andere fout gooit: een stille lege uitkomst geeft te lage scores zonder dat iemand het ziet.
  const rData = zonderMigratie(r.error) ? [] : eisData('leads.extra.regels', r);
  const lData = zonderMigratie(l.error) ? [] : eisData('leads.extra.logos', l);
  const regels = new Map<string, number>();
  for (const x of (rData as { lead_id: string }[] | null) ?? []) regels.set(x.lead_id, (regels.get(x.lead_id) ?? 0) + 1);
  return { regels, logos: new Set(((lData as { lead_id: string }[] | null) ?? []).map((x) => x.lead_id)) };
}

/** Marketingkanaal: eerst de gestructureerde herkomst (utm, gclid, verwijzer), anders de oude bron-tekst. */
export function leadKanaal(l: LeadRij): string {
  return kanaalUitHerkomst(l) ?? bronKanaal(l.bron);
}

export function verrijkLeads(rijen: LeadRij[], momenten: Moment[], nu: Date = new Date(), extra?: LeadExtra): LeadKaart[] {
  const vandaag = vandaagNl(nu);
  const eerste = new Map<string, string>();
  const reageerde = new Set<string>();
  for (const m of momenten) {
    if (!eerste.has(m.lead_id)) eerste.set(m.lead_id, m.created_at);
    if (m.soort === 'reactie') reageerde.add(m.lead_id);
  }
  const dubbelen = vindDubbelen(rijen);
  return rijen.map((l) => {
    const eersteContactOp = l.eerste_contact ?? eerste.get(l.id) ?? null;
    // Zonder vastgelegd contact maar wel verder dan 'nieuw': dan is er contact geweest, alleen weten we niet wanneer.
    const hadContact = !!eersteContactOp || l.status !== 'nieuw';
    const scoreInfo = berekenScore(l, {
      eersteContact: eersteContactOp,
      klantReageerde: reageerde.has(l.id),
      aantalRegels: extra?.regels.get(l.id) ?? 0,
      logoAangeleverd: extra?.logos.has(l.id) ?? false,
      nu,
    });
    const { waarde, geschat } = leadWaarde(l);
    return {
      ...l,
      scoreInfo,
      scoreWaarde: scoreInfo.totaal,
      eersteContactOp,
      klantReageerde: reageerde.has(l.id),
      wachtUren: !hadContact && isOpen(l.status) ? urenTussen(l.created_at, nu) : null,
      opvolg: isOpen(l.status) ? opvolgStand(l.opvolgdatum, vandaag) : 'geen',
      waarde,
      waardeGeschat: geschat,
      kansPct: leadKans(l),
      kanaal: leadKanaal(l),
      dubbelVan: dubbelen.get(l.id) ?? [],
    };
  });
}

export async function listLeadKaarten(): Promise<LeadKaart[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const [rijen, momenten, extra] = await Promise.all([listLeadRijen(), listContactMomenten(sb), listLeadExtra(sb)]);
  return verrijkLeads(rijen, momenten, new Date(), extra);
}

/* ------------------------------------------------------------------ */
/* Tijdlijn                                                            */
/* ------------------------------------------------------------------ */

export type Activiteit = { id: string; soort: string; tekst: string | null; door: string | null; created_at: string };

export async function listActiviteiten(leadId: string): Promise<{ regels: Activiteit[]; viaAudit: boolean }> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(leadId)) return { regels: [], viaAudit: false };
  const { data, error } = await sb
    .from('lead_activiteiten')
    .select('id, soort, tekst, door, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (!error) return { regels: (data as Activiteit[]) ?? [], viaAudit: false };
  if (!tabelOntbreekt(error)) return { regels: [], viaAudit: false };
  const { data: audit } = await sb
    .from('audit_log')
    .select('id, actor, actie, details, created_at')
    .eq('entiteit', 'lead')
    .eq('entiteit_id', leadId)
    .order('created_at', { ascending: false })
    .limit(300);
  const regels = ((audit as { id: string; actor: string | null; actie: string; details: Record<string, unknown> | null; created_at: string }[]) ?? [])
    .filter((a) => a.actie === 'lead.activiteit')
    .map((a) => ({
      id: a.id,
      soort: String(a.details?.soort ?? 'notitie'),
      tekst: a.details?.tekst == null ? null : String(a.details.tekst),
      door: a.actor,
      created_at: a.created_at,
    }));
  return { regels, viaAudit: true };
}

function schoneSoort(v: unknown): string {
  const s = String(v ?? '').trim();
  return (ACTIVITEIT_SOORTEN as readonly string[]).includes(s) ? s : 'notitie';
}

/**
 * Regel op de tijdlijn zetten. Bij een contactmoment worden ook eerste_contact en
 * laatste_contact bijgewerkt, en een lead die nog op 'nieuw' stond gaat naar 'contact'.
 */
export async function logActiviteit(
  leadId: string,
  soortRuw: string,
  tekstRuw: string | null,
  opties: { doorPersoonId?: string | null; statusMeenemen?: boolean } = {},
): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(leadId)) return false;
  const soort = schoneSoort(soortRuw);
  const tekst = String(tekstRuw ?? '').trim().slice(0, 4000) || null;
  const door = await huidigeActor();
  const rij: Record<string, unknown> = { lead_id: leadId, soort, tekst, door };
  if (isUuid(opties.doorPersoonId)) rij.door_persoon_id = opties.doorPersoonId;
  let { error } = await sb.from('lead_activiteiten').insert(rij);
  if (error && kolomOntbreekt(error) && !tabelOntbreekt(error) && 'door_persoon_id' in rij) {
    delete rij.door_persoon_id;
    ({ error } = await sb.from('lead_activiteiten').insert(rij));
  }
  if (error) {
    if (!tabelOntbreekt(error)) return false;
    await logAudit('lead.activiteit', { entiteit: 'lead', entiteitId: leadId, details: { soort, tekst }, actor: door });
  }

  if (CONTACT_SOORTEN.includes(soort)) {
    const lead = await getLeadRij(leadId);
    if (lead) {
      const nu = new Date().toISOString();
      const patch: Record<string, unknown> = { laatste_contact: nu };
      if (!lead.eerste_contact) patch.eerste_contact = nu;
      if (opties.statusMeenemen !== false && lead.status === 'nieuw') {
        patch.status = 'contact';
        patch.status_gewijzigd_op = nu;
      }
      await updateLead(sb, leadId, patch);
      if (patch.status) await schrijfStatusRegel(sb, leadId, lead.status, 'contact', null, door);
    }
  }
  return true;
}

async function schrijfStatusRegel(sb: Sb, leadId: string, van: string, naar: string, reden: string | null, door: string) {
  const tekst = `${statusLabel(van)} → ${statusLabel(naar)}${reden ? `. Reden: ${reden}` : ''}`;
  const { error } = await sb.from('lead_activiteiten').insert({ lead_id: leadId, soort: 'status', tekst, door });
  if (error && tabelOntbreekt(error)) {
    await logAudit('lead.activiteit', { entiteit: 'lead', entiteitId: leadId, details: { soort: 'status', tekst }, actor: door });
  }
}

/* ------------------------------------------------------------------ */
/* Schrijven                                                           */
/* ------------------------------------------------------------------ */

export type Uitkomst = { ok: true } | { ok: false; fout: string };

/** Status zetten vanuit de pijplijn of de detailpagina. Verloren vraagt om een reden. */
export async function zetLeadStatus(id: string, status: string, reden: string | null): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const lead = await getLeadRij(id);
  if (!lead) return { ok: false, fout: 'Deze lead bestaat niet meer.' };
  if (lead.status === status) return { ok: true };
  const nu = new Date().toISOString();
  const patch: Record<string, unknown> = { status, status_gewijzigd_op: nu };
  if (status === VERLOREN) patch.verloren_reden = reden?.trim().slice(0, 300) || null;
  if (lead.status === VERLOREN && status !== VERLOREN) patch.verloren_reden = null;
  if (lead.status === 'nieuw' && status !== VERLOREN && !lead.eerste_contact) patch.eerste_contact = nu;
  // Een gesloten lead heeft geen opvolgdatum meer nodig; die zou anders als "verlopen" blijven hangen.
  if (status === GEWONNEN || status === VERLOREN) patch.opvolgdatum = null;
  const ok = await updateLead(sb, id, patch);
  if (!ok) return { ok: false, fout: 'Opslaan is niet gelukt.' };
  const door = await huidigeActor();
  await schrijfStatusRegel(sb, id, lead.status, status, status === VERLOREN ? reden : null, door);
  await logAudit('lead.status', { entiteit: 'lead', entiteitId: id, details: { van: lead.status, naar: status, reden }, actor: door });
  return { ok: true };
}

export type LeadVelden = {
  offertewaarde?: number | null;
  kans?: number | null;
  eigenaar_id?: string | null;
  verloren_reden?: string | null;
  notitie?: string | null;
  name?: string;
  company?: string | null;
  email?: string;
  phone?: string | null;
  branche?: string | null;
  aantal?: string | null;
};

export async function werkLeadBij(id: string, v: LeadVelden): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const voor = await getLeadRij(id);
  if (!voor) return { ok: false, fout: 'Deze lead bestaat niet meer.' };
  const patch: Record<string, unknown> = {};
  for (const [k, w] of Object.entries(v)) if (w !== undefined) patch[k] = w;
  if ('eigenaar_id' in patch) {
    const pid = isUuid(patch.eigenaar_id) ? patch.eigenaar_id : null;
    patch.eigenaar_id = pid;
    if (pid) {
      const { data } = await sb.from('taak_personen').select('naam').eq('id', pid).maybeSingle();
      patch.eigenaar = (data as { naam: string } | null)?.naam ?? null;
    } else patch.eigenaar = null;
  }
  const ok = await updateLead(sb, id, patch);
  if (!ok) return { ok: false, fout: 'Opslaan is niet gelukt.' };
  const wijzigingen: Record<string, { van: unknown; naar: unknown }> = {};
  for (const [k, naar] of Object.entries(patch)) {
    const van = (voor as Record<string, unknown>)[k] ?? null;
    if (String(van ?? '') !== String(naar ?? '')) wijzigingen[k] = { van, naar };
  }
  if (Object.keys(wijzigingen).length) await logAudit('lead.bijgewerkt', { entiteit: 'lead', entiteitId: id, details: { wijzigingen } });
  return { ok: true };
}

export type NieuweLeadInvoer = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  branche: string | null;
  aantal: string | null;
  bericht: string | null;
  bron: string;
  eigenaar_id: string | null;
  opvolgdatum: string | null;
};

/** Telefonische of beurs-lead invoeren. E-mail is in de tabel verplicht, dus leeg wordt ''. */
export async function maakLead(v: NieuweLeadInvoer): Promise<{ id: string } | { fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { fout: 'Database niet bereikbaar.' };
  const rij: Record<string, unknown> = {
    name: v.name,
    company: v.company,
    email: v.email ?? '',
    phone: v.phone,
    branche: v.branche,
    aantal: v.aantal,
    bericht: v.bericht,
    bron: v.bron,
    bron_kanaal: v.bron === 'Telefonisch' ? 'telefoon' : 'handmatig',
    // Zelf ingevoerd: niet als "nieuwe webaanvraag" melden.
    gezien_op: new Date().toISOString(),
    status: 'nieuw',
    opvolgdatum: v.opvolgdatum,
  };
  if (isUuid(v.eigenaar_id)) {
    rij.eigenaar_id = v.eigenaar_id;
    const { data } = await sb.from('taak_personen').select('naam').eq('id', v.eigenaar_id).maybeSingle();
    rij.eigenaar = (data as { naam: string } | null)?.naam ?? null;
  }
  let { data, error } = await sb.from('leads').insert(rij).select('id').single();
  if (error && kolomOntbreekt(error)) {
    for (const k of NIEUWE_KOLOMMEN) delete rij[k];
    ({ data, error } = await sb.from('leads').insert(rij).select('id').single());
  }
  if (error || !data) return { fout: 'Opslaan is niet gelukt.' };
  const id = (data as { id: string }).id;
  await logAudit('lead.aangemaakt', { entiteit: 'lead', entiteitId: id, details: { bron: v.bron, handmatig: true } });
  return { id };
}

/* ------------------------------------------------------------------ */
/* Volgende stap -> taak                                               */
/* ------------------------------------------------------------------ */

export async function zetVolgendeStap(
  leadId: string,
  invoer: { tekst: string; datum: string; tijd: string | null; persoonId: string | null; vorigeAfronden: boolean },
): Promise<{ ok: true; taakId: string | null } | { ok: false; fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const lead = await getLeadRij(leadId);
  if (!lead) return { ok: false, fout: 'Deze lead bestaat niet meer.' };
  const tekst = invoer.tekst.trim().slice(0, 160);
  if (!tekst) return { ok: false, fout: 'Wat is de volgende stap?' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoer.datum)) return { ok: false, fout: 'Kies een datum.' };

  // Vorige stap afvinken, als die nog openstaat.
  if (invoer.vorigeAfronden && isUuid(lead.volgende_taak_id)) {
    const vorige = await getTaak(lead.volgende_taak_id).catch(() => null);
    if (vorige && vorige.status !== 'klaar' && !vorige.verwijderd_op) await vinkTaak(vorige.id, true).catch(() => null);
  }

  const wie = lead.company ? `${lead.name}, ${lead.company}` : lead.name;
  const regels = [
    `Lead: ${wie}`,
    lead.phone ? `Telefoon: ${lead.phone}` : '',
    heeftEmail(lead.email) ? `E-mail: ${lead.email}` : '',
    `Openen: /dashboard/leads/${lead.id}`,
  ].filter(Boolean);
  const taak = await maakTaak({
    titel: `${tekst} (${lead.company || lead.name})`,
    omschrijving: regels.join('\n'),
    vervaldatum: invoer.datum,
    tijd: invoer.tijd,
    persoon_id: invoer.persoonId,
    organisatie_id: lead.organisatie_id,
    prioriteit: 'normaal',
  });
  const taakId = 'id' in taak ? taak.id : null;
  if (taakId) {
    // Koppeling naar de lead (kolom komt met de migratie; zonder migratie staat de link in de omschrijving).
    await sb.from('taken').update({ lead_id: lead.id }).eq('id', taakId);
  }

  const patch: Record<string, unknown> = { opvolgdatum: invoer.datum, volgende_stap: tekst };
  if (taakId) patch.volgende_taak_id = taakId;
  if (isUuid(invoer.persoonId) && !lead.eigenaar_id) {
    patch.eigenaar_id = invoer.persoonId;
    const { data } = await sb.from('taak_personen').select('naam').eq('id', invoer.persoonId).maybeSingle();
    patch.eigenaar = (data as { naam: string } | null)?.naam ?? null;
  }
  await updateLead(sb, lead.id, patch);
  const datumTekst = new Date(`${invoer.datum}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  const { error } = await sb.from('lead_activiteiten').insert({
    lead_id: lead.id,
    soort: 'taak',
    tekst: `${tekst}, ${datumTekst}${invoer.tijd ? ` ${invoer.tijd}` : ''}${taakId ? '' : ' (taak aanmaken lukte niet)'}`,
    door: await huidigeActor(),
  });
  if (error && tabelOntbreekt(error)) {
    await logAudit('lead.activiteit', { entiteit: 'lead', entiteitId: lead.id, details: { soort: 'taak', tekst: `${tekst}, ${datumTekst}` } });
  }
  await logAudit('lead.volgende_stap', { entiteit: 'lead', entiteitId: lead.id, details: { tekst, datum: invoer.datum, taakId } });
  if (!taakId) return { ok: false, fout: 'De datum staat bij de lead, maar de taak kon niet worden aangemaakt.' };
  return { ok: true, taakId };
}

/* ------------------------------------------------------------------ */
/* Dubbele leads samenvoegen                                           */
/* ------------------------------------------------------------------ */

/**
 * Voegt `dubbelId` samen in `hoofdId`: lege velden van de hoofdlead worden
 * aangevuld, de aanvraag van de dubbele komt op de tijdlijn, tijdlijn, taken en
 * offertes verhuizen mee, en daarna wordt de dubbele verwijderd. De volledige
 * rij van de dubbele staat in audit_log, zodat er niets echt kwijt is.
 */
export async function voegLeadsSamen(hoofdId: string, dubbelId: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  if (hoofdId === dubbelId) return { ok: false, fout: 'Kies een andere lead.' };
  const [hoofd, dubbel] = await Promise.all([getLeadRij(hoofdId), getLeadRij(dubbelId)]);
  if (!hoofd || !dubbel) return { ok: false, fout: 'Een van beide leads bestaat niet meer.' };

  const aanvullen: (keyof LeadRij)[] = [
    'company', 'phone', 'branche', 'aantal', 'offertewaarde', 'organisatie_id', 'opvolgdatum', 'eigenaar_id', 'eigenaar', 'kans',
    'bron_kanaal', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'referrer', 'landingspagina', 'eerste_bezoek_op',
  ];
  const patch: Record<string, unknown> = {};
  for (const k of aanvullen) {
    const h = hoofd[k];
    const d = dubbel[k];
    if ((h === null || h === undefined || h === '') && d !== null && d !== undefined && d !== '') patch[k] = d;
  }
  if (!heeftEmail(hoofd.email) && heeftEmail(dubbel.email)) patch.email = dubbel.email;
  if (dubbel.notitie && dubbel.notitie !== hoofd.notitie) {
    patch.notitie = [hoofd.notitie, dubbel.notitie].filter(Boolean).join('\n').slice(0, 2000);
  }
  // Eerste contact: de vroegste van beide.
  const contacten = [hoofd.eerste_contact, dubbel.eerste_contact].filter(Boolean) as string[];
  if (contacten.length) patch.eerste_contact = contacten.sort()[0];
  // Verder in de pijplijn wint (behalve verloren).
  const volgorde = ['nieuw', 'contact', 'afspraak', 'offerte', 'geaccordeerd'];
  if (volgorde.indexOf(dubbel.status) > volgorde.indexOf(hoofd.status) && hoofd.status !== VERLOREN) patch.status = dubbel.status;

  const ok = await updateLead(sb, hoofd.id, patch);
  if (!ok) return { ok: false, fout: 'Samenvoegen is niet gelukt.' };

  // Meeverhuizen. Fouten bij ontbrekende kolommen/tabellen negeren we.
  await sb.from('lead_activiteiten').update({ lead_id: hoofd.id }).eq('lead_id', dubbel.id);
  await sb.from('taken').update({ lead_id: hoofd.id }).eq('lead_id', dubbel.id);
  await sb.from('offertes').update({ lead_id: hoofd.id }).eq('lead_id', dubbel.id);
  await sb.from('lead_regels').update({ lead_id: hoofd.id }).eq('lead_id', dubbel.id);
  await sb.from('lead_logos').update({ lead_id: hoofd.id }).eq('lead_id', dubbel.id);

  const datum = new Date(dubbel.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const samenvatting = [
    `Samengevoegd met een aanvraag van ${datum} (${dubbel.bron || 'herkomst onbekend'}).`,
    dubbel.bericht ? `\n${dubbel.bericht}` : '',
  ].join('');
  const door = await huidigeActor();
  const { error } = await sb.from('lead_activiteiten').insert({ lead_id: hoofd.id, soort: 'systeem', tekst: samenvatting, door, created_at: new Date().toISOString() });
  if (error && tabelOntbreekt(error)) {
    await logAudit('lead.activiteit', { entiteit: 'lead', entiteitId: hoofd.id, details: { soort: 'systeem', tekst: samenvatting }, actor: door });
  }
  await logAudit('lead.samengevoegd', { entiteit: 'lead', entiteitId: hoofd.id, details: { verwijderd: dubbel }, actor: door });
  const { error: delFout } = await sb.from('leads').delete().eq('id', dubbel.id);
  if (delFout) return { ok: false, fout: 'Gegevens zijn overgenomen, maar de dubbele lead kon niet worden verwijderd.' };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Klant koppelen, converteren en offerte                              */
/* ------------------------------------------------------------------ */

export type KlantKandidaat = { id: string; naam: string; plaats: string | null; klantnummer: string | null; reden: string };

/** Bestaande klanten die op deze lead lijken: zelfde e-mail (klant of contactpersoon) of bijna dezelfde naam. */
export async function zoekKlantKandidaten(lead: LeadRij): Promise<KlantKandidaat[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const uit = new Map<string, KlantKandidaat>();
  const voeg = (o: { id: string; naam: string | null; plaats: string | null; klantnummer: string | null }, reden: string) => {
    const bestaand = uit.get(o.id);
    if (bestaand) { if (!bestaand.reden.includes(reden)) bestaand.reden += `, ${reden}`; return; }
    uit.set(o.id, { id: o.id, naam: o.naam ?? 'Zonder naam', plaats: o.plaats, klantnummer: o.klantnummer, reden });
  };
  const email = emailSleutel(lead.email)?.replace(/["(),]/g, '') ?? null;
  const zoekNaam = (lead.company || '').trim();
  const sleutel = bedrijfSleutel(zoekNaam);
  const domein = email ? email.split('@')[1] : null;
  const vrijeDomeinen = /^(gmail|hotmail|outlook|live|icloud|yahoo|ziggo|kpnmail|kpnplanet|home|planet|xs4all|me)\./;

  const verzoeken: PromiseLike<void>[] = [];
  if (email) {
    verzoeken.push(
      sb.from('organisaties').select('id, naam, plaats, klantnummer').or(`email_algemeen.ilike."${email}",factuur_email.ilike."${email}"`).limit(5)
        .then(({ data }) => { for (const o of (data as { id: string; naam: string; plaats: string | null; klantnummer: string | null }[]) ?? []) voeg(o, 'zelfde e-mailadres'); }),
    );
    verzoeken.push(
      sb.from('contactpersonen').select('organisatie_id, organisaties(id, naam, plaats, klantnummer)').ilike('email', email).limit(5)
        .then(({ data }) => {
          for (const c of (data as unknown as { organisaties: { id: string; naam: string; plaats: string | null; klantnummer: string | null } | null }[]) ?? []) {
            if (c.organisaties) voeg(c.organisaties, 'contactpersoon met dit e-mailadres');
          }
        }),
    );
    if (domein && !vrijeDomeinen.test(domein)) {
      verzoeken.push(
        sb.from('organisaties').select('id, naam, plaats, klantnummer').or(`email_algemeen.ilike."%@${domein}",factuur_email.ilike."%@${domein}",website.ilike."%${domein}%"`).limit(5)
          .then(({ data }) => { for (const o of (data as { id: string; naam: string; plaats: string | null; klantnummer: string | null }[]) ?? []) voeg(o, `zelfde domein (${domein})`); }),
      );
    }
  }
  if (sleutel) {
    // Op het langste woord zoeken, dan pas fijn vergelijken.
    const woord = sleutel.split(' ').sort((a, b) => b.length - a.length)[0];
    if (woord && woord.length >= 3) {
      verzoeken.push(
        sb.from('organisaties').select('id, naam, plaats, klantnummer').ilike('naam', `%${woord.replace(/[%_,()]/g, '')}%`).limit(20)
          .then(({ data }) => {
            for (const o of (data as { id: string; naam: string; plaats: string | null; klantnummer: string | null }[]) ?? []) {
              const s = bedrijfSleutel(o.naam);
              if (s && (s === sleutel || s.includes(sleutel) || sleutel.includes(s))) voeg(o, s === sleutel ? 'zelfde naam' : 'lijkt op de naam');
            }
          }),
      );
    }
  }
  await Promise.all(verzoeken);
  return [...uit.values()].slice(0, 6);
}

export async function klantNaam(orgId: string | null): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(orgId)) return null;
  const { data } = await sb.from('organisaties').select('naam').eq('id', orgId).maybeSingle();
  return (data as { naam: string } | null)?.naam ?? null;
}

/** Koppelt de lead aan een bestaande klant en zet de contactpersoon erbij als die er nog niet is. */
export async function koppelLeadAanKlant(leadId: string, orgId: string): Promise<Uitkomst> {
  const sb = kmsAdmin();
  if (!sb) return { ok: false, fout: 'Database niet bereikbaar.' };
  const lead = await getLeadRij(leadId);
  if (!lead) return { ok: false, fout: 'Deze lead bestaat niet meer.' };
  const naam = await klantNaam(orgId);
  if (!naam) return { ok: false, fout: 'Die klant bestaat niet (meer).' };
  const ok = await updateLead(sb, leadId, { organisatie_id: orgId });
  if (!ok) return { ok: false, fout: 'Koppelen is niet gelukt.' };

  const email = emailSleutel(lead.email);
  const { data: contacten } = await sb.from('contactpersonen').select('id, naam, email').eq('organisatie_id', orgId);
  const lijst = (contacten as { id: string; naam: string | null; email: string | null }[]) ?? [];
  const bestaat = lijst.some((c) => (email && (c.email ?? '').toLowerCase() === email) || (c.naam ?? '').trim().toLowerCase() === lead.name.trim().toLowerCase());
  if (!bestaat && lead.name.trim()) {
    await sb.from('contactpersonen').insert({ organisatie_id: orgId, naam: lead.name.trim(), email: email, telefoon: lead.phone, hoofdcontact: lijst.length === 0 });
  }
  const logos = await zetLeadLogosNaarKlant(leadId, orgId);
  await schrijfSysteemRegel(sb, leadId, `Gekoppeld aan bestaande klant ${naam}.${logos ? ` ${logos} logo${logos === 1 ? '' : "'s"} naar de logobibliotheek van de klant.` : ''}`);
  await logAudit('lead.klant_gekoppeld', { entiteit: 'lead', entiteitId: leadId, details: { organisatie_id: orgId, contact_toegevoegd: !bestaat } });
  return { ok: true };
}

async function schrijfSysteemRegel(sb: Sb, leadId: string, tekst: string) {
  const door = await huidigeActor();
  const { error } = await sb.from('lead_activiteiten').insert({ lead_id: leadId, soort: 'systeem', tekst, door });
  if (error && tabelOntbreekt(error)) {
    await logAudit('lead.activiteit', { entiteit: 'lead', entiteitId: leadId, details: { soort: 'systeem', tekst }, actor: door });
  }
}

/**
 * Nieuwe klant (organisatie + hoofdcontact) maken van een lead. Was de lead al
 * gekoppeld, dan dat id. Null als het niet lukt.
 */
export async function maakKlantVanLead(leadId: string): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(leadId)) return null;
  const lead = await getLeadRij(leadId);
  if (!lead) return null;
  if (lead.organisatie_id) return lead.organisatie_id;
  const rij: Record<string, unknown> = {
    naam: lead.company || lead.name,
    contactpersoon: lead.name,
    email_algemeen: heeftEmail(lead.email) ? lead.email : null,
    telefoon: lead.phone,
    branche: lead.branche,
  };
  let { data: org, error } = await sb.from('organisaties').insert(rij).select('id').single();
  if (error && kolomOntbreekt(error)) {
    delete rij.branche;
    ({ data: org, error } = await sb.from('organisaties').insert(rij).select('id').single());
  }
  const orgId = (org as { id: string } | null)?.id;
  if (!orgId) return null;
  await sb.from('contactpersonen').insert({ organisatie_id: orgId, naam: lead.name, email: heeftEmail(lead.email) ? lead.email : null, telefoon: lead.phone, hoofdcontact: true });
  await sb.from('leads').update({ organisatie_id: orgId }).eq('id', leadId);
  const logos = await zetLeadLogosNaarKlant(leadId, orgId);
  await schrijfSysteemRegel(sb, leadId, `Omgezet naar nieuwe klant ${String(rij.naam)}.${logos ? ` ${logos} logo${logos === 1 ? '' : "'s"} naar de logobibliotheek van de klant.` : ''}`);
  await logAudit('lead.geconverteerd', { entiteit: 'lead', entiteitId: leadId, details: { organisatie_id: orgId } });
  return orgId;
}

/** Concept-offerte voor de klant van deze lead. De lead moet al aan een klant hangen. */
export async function maakOfferteVoorLead(leadId: string): Promise<{ id: string } | { fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { fout: 'Database niet bereikbaar.' };
  const lead = await getLeadRij(leadId);
  if (!lead) return { fout: 'Deze lead bestaat niet meer.' };
  if (!lead.organisatie_id) return { fout: 'Koppel de lead eerst aan een klant.' };

  // Contactpersoon bij de klant zoeken: op e-mail, anders op naam.
  const { data: contacten } = await sb.from('contactpersonen').select('id, naam, email').eq('organisatie_id', lead.organisatie_id);
  const email = emailSleutel(lead.email);
  const lijst = (contacten as { id: string; naam: string | null; email: string | null }[]) ?? [];
  const contact =
    lijst.find((c) => email && (c.email ?? '').toLowerCase() === email) ??
    lijst.find((c) => (c.naam ?? '').trim().toLowerCase() === lead.name.trim().toLowerCase()) ??
    null;

  // Staat er al een concept-offerte uit de webaanvraag klaar (nog zonder klant)? Die gebruiken we.
  const { data: concepten } = await sb
    .from('offertes')
    .select('id, offertenummer, organisatie_id')
    .eq('lead_id', lead.id)
    .eq('status', 'concept')
    .order('created_at', { ascending: false })
    .limit(5);
  const bestaand = ((concepten as { id: string; offertenummer: number | null; organisatie_id: string | null }[]) ?? []).find(
    (o) => !o.organisatie_id || o.organisatie_id === lead.organisatie_id,
  );
  if (bestaand) {
    if (!bestaand.organisatie_id) {
      const patch: Record<string, unknown> = { organisatie_id: lead.organisatie_id, contactpersoon: contact?.naam ?? lead.name };
      if (contact?.id) patch.contactpersoon_id = contact.id;
      let { error } = await sb.from('offertes').update(patch).eq('id', bestaand.id);
      if (error && kolomOntbreekt(error) && 'contactpersoon_id' in patch) {
        delete patch.contactpersoon_id;
        ({ error } = await sb.from('offertes').update(patch).eq('id', bestaand.id));
      }
      if (error) return { fout: 'De concept-offerte kon niet aan de klant worden gekoppeld.' };
      await schrijfSysteemRegel(sb, lead.id, `Concept-offerte${bestaand.offertenummer ? ` ${bestaand.offertenummer}` : ''} aan de klant gekoppeld.`);
    }
    return { id: bestaand.id };
  }

  const geldig = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const id = await maakOfferte({
    organisatie_id: lead.organisatie_id,
    contactpersoon: contact?.naam ?? lead.name,
    contactpersoon_id: contact?.id ?? null,
    geldig_tot: geldig,
    notitie: lead.bericht ? `Aanvraag:\n${lead.bericht}`.slice(0, 2000) : null,
  });
  if (!id) return { fout: 'De offerte kon niet worden aangemaakt.' };
  await sb.from('offertes').update({ lead_id: lead.id }).eq('id', id);
  // Gekozen artikelen uit de webaanvraag meteen als regels, met catalogusprijzen.
  const regels = await listLeadRegels(lead.id);
  if (regels.length) await regelsNaarOfferte(sb, id, regels);
  const { data: o } = await sb.from('offertes').select('offertenummer').eq('id', id).maybeSingle();
  const nummer = (o as { offertenummer: number } | null)?.offertenummer;
  await schrijfSysteemRegel(sb, lead.id, `Concept-offerte${nummer ? ` ${nummer}` : ''} aangemaakt.`);
  await logAudit('lead.offerte', { entiteit: 'lead', entiteitId: lead.id, details: { offerte_id: id } });
  return { id };
}

export type LeadOfferte = { id: string; offertenummer: number | null; status: string; created_at: string };

export async function listOffertesVanLead(leadId: string): Promise<LeadOfferte[]> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(leadId)) return [];
  const { data } = await sb.from('offertes').select('id, offertenummer, status, created_at').eq('lead_id', leadId).order('created_at', { ascending: false });
  return (data as LeadOfferte[]) ?? [];
}

/* ------------------------------------------------------------------ */
/* Kerncijfers                                                         */
/* ------------------------------------------------------------------ */

export type LeadKpis = {
  nieuwDezeMaand: number;
  nieuwVorigeMaandTotNu: number;
  perMaand: { label: string; aantal: number }[];
  reactieUren: number | null;
  reactieUrenVorige: number | null;
  reactieGemeten: number;
  wachtNuTeLang: number;
  conversiePct: number | null;
  conversieVorigePct: number | null;
  gewonnen: number;
  verloren: number;
  openWaarde: number;
  openWaardeGeschat: number;
  gewogenWaarde: number;
  openAantal: number;
};

const MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function gemiddelde(waarden: number[]): number | null {
  return waarden.length ? waarden.reduce((t, w) => t + w, 0) / waarden.length : null;
}

export function berekenKpis(leads: LeadKaart[], nu: Date = new Date()): LeadKpis {
  const j = nu.getFullYear();
  const m = nu.getMonth();
  const maandStart = new Date(j, m, 1).getTime();
  const vorigeStart = new Date(j, m - 1, 1).getTime();
  // Zelfde aantal dagen in de vorige maand, zodat 4 oktober niet tegen heel september wordt gezet.
  const vorigeTotNu = Math.min(new Date(j, m - 1, nu.getDate(), nu.getHours(), nu.getMinutes()).getTime(), maandStart);
  const tijd = (l: LeadKaart) => new Date(l.created_at).getTime();

  const perMaand: { label: string; aantal: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const van = new Date(j, m - i, 1).getTime();
    const tot = new Date(j, m - i + 1, 1).getTime();
    const d = new Date(j, m - i, 1);
    perMaand.push({ label: MAAND_KORT[d.getMonth()], aantal: leads.filter((l) => tijd(l) >= van && tijd(l) < tot).length });
  }

  const dag = 86_400_000;
  // Reactietijd gaat over aanvragen die op ons wachten. Wie zelf belde of langskwam, telt niet mee.
  const handmatig = new Set(['Telefonisch', 'Beurs of evenement', 'Langs in de winkel']);
  const meetbaar = leads.filter((l) => !handmatig.has(l.kanaal));
  const reactie = (van: number, tot: number) =>
    gemiddelde(
      meetbaar
        .filter((l) => l.eersteContactOp && tijd(l) >= van && tijd(l) < tot)
        .map((l) => urenTussen(l.created_at, new Date(l.eersteContactOp as string))),
    );
  const nuMs = nu.getTime();
  const reactieGemeten = meetbaar.filter((l) => l.eersteContactOp && tijd(l) >= nuMs - 90 * dag).length;

  // Conversie over leads die in de periode gesloten zijn; zonder sluitdatum telt de binnenkomst.
  const sluit = (l: LeadKaart) => new Date(l.status_gewijzigd_op ?? l.created_at).getTime();
  const conversie = (van: number, tot: number) => {
    const dicht = leads.filter((l) => (l.status === GEWONNEN || l.status === VERLOREN) && sluit(l) >= van && sluit(l) < tot);
    const w = dicht.filter((l) => l.status === GEWONNEN).length;
    return { pct: dicht.length ? (w / dicht.length) * 100 : null, gewonnen: w, verloren: dicht.length - w };
  };
  const ditJaar = conversie(nuMs - 365 * dag, nuMs + dag);
  const vorigJaar = conversie(nuMs - 730 * dag, nuMs - 365 * dag);

  const open = leads.filter((l) => isOpen(l.status));
  return {
    nieuwDezeMaand: leads.filter((l) => tijd(l) >= maandStart).length,
    nieuwVorigeMaandTotNu: leads.filter((l) => tijd(l) >= vorigeStart && tijd(l) < vorigeTotNu).length,
    perMaand,
    reactieUren: reactie(nuMs - 90 * dag, nuMs + dag),
    reactieUrenVorige: reactie(nuMs - 180 * dag, nuMs - 90 * dag),
    reactieGemeten,
    wachtNuTeLang: open.filter((l) => (l.wachtUren ?? 0) >= 24).length,
    conversiePct: ditJaar.pct,
    conversieVorigePct: vorigJaar.pct,
    gewonnen: ditJaar.gewonnen,
    verloren: ditJaar.verloren,
    openWaarde: open.filter((l) => !l.waardeGeschat).reduce((t, l) => t + l.waarde, 0),
    openWaardeGeschat: open.filter((l) => l.waardeGeschat).reduce((t, l) => t + l.waarde, 0),
    gewogenWaarde: open.reduce((t, l) => t + (l.waarde * l.kansPct) / 100, 0),
    openAantal: open.length,
  };
}

export type HerkomstRij = { kanaal: string; aantal: number; gewonnen: number; verloren: number; open: number; conversiePct: number | null; waarde: number };

/** Per kanaal: aantal leads, gewonnen, conversie (gewonnen van gesloten) en gewonnen waarde. */
export function herkomstAnalyse(leads: LeadKaart[]): HerkomstRij[] {
  const per = new Map<string, HerkomstRij>();
  for (const l of leads) {
    const r = per.get(l.kanaal) ?? { kanaal: l.kanaal, aantal: 0, gewonnen: 0, verloren: 0, open: 0, conversiePct: null, waarde: 0 };
    r.aantal += 1;
    if (l.status === GEWONNEN) { r.gewonnen += 1; r.waarde += Number(l.offertewaarde) || 0; }
    else if (l.status === VERLOREN) r.verloren += 1;
    else r.open += 1;
    per.set(l.kanaal, r);
  }
  return [...per.values()]
    .map((r) => ({ ...r, conversiePct: r.gewonnen + r.verloren ? (r.gewonnen / (r.gewonnen + r.verloren)) * 100 : null }))
    .sort((a, b) => b.aantal - a.aantal || b.waarde - a.waarde);
}

/* ------------------------------------------------------------------ */
/* Migratie                                                            */
/* ------------------------------------------------------------------ */

/** Is migratie 20261004_leads_opvolging gedraaid? Bepaalt of eigenaar, kans en tijdlijn volledig werken. */
export async function migratieStand(): Promise<{ kolommen: boolean; tijdlijn: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { kolommen: false, tijdlijn: false };
  const [k, t] = await Promise.all([
    sb.from('leads').select('eigenaar_id, kans, eerste_contact').limit(1),
    sb.from('lead_activiteiten').select('id').limit(1),
  ]);
  return { kolommen: !k.error, tijdlijn: !t.error };
}

/* ------------------------------------------------------------------ */
/* Webaanvraag: regels, logo's en "nog niet gezien"                    */
/* ------------------------------------------------------------------ */

export type LeadRegel = {
  id: string;
  product_id: string | null;
  omschrijving: string;
  kleur: string | null;
  maat: string | null;
  aantal: number | null;
  opmerking: string | null;
};

/** Gekozen artikelen van een lead (offerteselectie of configurator). Leeg zonder migratie. */
export async function listLeadRegels(leadId: string): Promise<LeadRegel[]> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(leadId)) return [];
  const { data, error } = await sb
    .from('lead_regels')
    .select('id, product_id, omschrijving, kleur, maat, aantal, opmerking')
    .eq('lead_id', leadId)
    .order('positie');
  if (error) return [];
  return (data as LeadRegel[]) ?? [];
}

/** De concept-offerte die bij de webaanvraag is klaargezet (de nieuwste), of null. */
export async function conceptOfferteVanLead(leadId: string): Promise<{ id: string; offertenummer: number | null } | null> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(leadId)) return null;
  const { data } = await sb
    .from('offertes')
    .select('id, offertenummer')
    .eq('lead_id', leadId)
    .eq('status', 'concept')
    .order('created_at', { ascending: false })
    .limit(1);
  return ((data as { id: string; offertenummer: number | null }[]) ?? [])[0] ?? null;
}

/** Lead geopend: niet meer als nieuwe webaanvraag melden. */
export async function markeerLeadGezien(leadId: string): Promise<void> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(leadId)) return;
  await sb.from('leads').update({ gezien_op: new Date().toISOString() }).eq('id', leadId).is('gezien_op', null);
}

export async function markeerAlleWebleadsGezien(): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  await sb.from('leads').update({ gezien_op: new Date().toISOString() }).is('gezien_op', null).not('bron_kanaal', 'is', null);
}

export type OngezieneWeblead = { id: string; naam: string; bedrijf: string | null; bron_kanaal: string | null; created_at: string };

/** Webaanvragen die nog niemand heeft geopend, nieuwste eerst. Leeg zonder migratie. */
export async function listOngezieneWebleads(limiet = 10): Promise<{ aantal: number; leads: OngezieneWeblead[] }> {
  const sb = kmsAdmin();
  if (!sb) return { aantal: 0, leads: [] };
  const { data, count, error } = await sb
    .from('leads')
    .select('id, name, company, bron_kanaal, created_at', { count: 'exact' })
    .is('gezien_op', null)
    .in('bron_kanaal', [...WEB_KANALEN])
    .order('created_at', { ascending: false })
    .limit(limiet);
  // Leeg zonder migratie; elke andere fout gooit (anders lijkt het alsof er geen nieuwe aanvragen zijn).
  if (zonderMigratie(error)) return { aantal: 0, leads: [] };
  eisData('leads.ongezien', { data, error });
  const leads = ((data as { id: string; name: string; company: string | null; bron_kanaal: string | null; created_at: string }[]) ?? []).map((l) => ({
    id: l.id,
    naam: l.name,
    bedrijf: l.company,
    bron_kanaal: l.bron_kanaal,
    created_at: l.created_at,
  }));
  return { aantal: count ?? leads.length, leads };
}
