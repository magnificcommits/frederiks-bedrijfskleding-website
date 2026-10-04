import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail } from '@/lib/email';
import { env, isAiConfigured, isEmailConfigured } from '@/lib/env';
import { aiTekst } from '@/lib/ai';
import { site } from '@/content/site';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import { maakTaak } from '@/lib/kms/taken';
import { PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import { LEAD_STATUSSEN } from '@/lib/kms/leadsModel';
import { getNieuwsbrief, webversieUrl } from '@/lib/nieuwsbrief/opslag';
import { renderNieuwsbrief, renderOnderwerp } from '@/lib/nieuwsbrief/render';
import {
  begintak,
  EINDE_KNOOP,
  flowUitLegacy,
  mailKnopen,
  normaliseerDoel,
  normaliseerFlow,
  normaliseerTrigger,
  vindKnoop,
  volgendeNa,
  type Flow,
  type MailKnoop,
  type TaakKnoop,
  type Trigger,
  type VoorwaardeKnoop,
  type WachtKnoop,
} from '@/lib/campagnes/flow';
import { escapeHtml, renderMail, vulMergeTags, type MergeContext } from '@/lib/campagnes/mail';
import { afgemeldeAdressen, contactSleutel, laadContacten, schoonEmail, schrijfContactenIn, type Contact } from '@/lib/kms/campagneContacten';
import { getCampagneInstellingen, type CampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { nieuwTrackingToken, voegTrackingToe } from '@/lib/kms/campagneTracking';
import { spaarActief, spaarStanden } from '@/lib/kms/campagneSparen';

/**
 * Verzendmotor voor campagnes. Draait één keer per werkdag via de Vercel-cron
 * (Hobby-plan: alleen dagelijks). Per run:
 *   1. automatische triggers: nieuwe mensen inschrijven;
 *   2. doelen controleren: wie een afspraak heeft of klant is geworden stopt;
 *   3. de wachtrij afwerken: per ingeschrevene de stappen uitvoeren tot een
 *      wachtstap of een mail.
 *
 * Veiligheid: afmeldlijst, dagelijkse verzendlimiet over alle campagnes, maximaal
 * één campagnemail per persoon per dag, en de noodrem "alles gepauzeerd".
 *
 * Eerlijkheid: zonder RESEND_API_KEY wordt er niets verstuurd én niets als
 * verzonden geteld. Ingeschrevenen blijven dan bij hun mailstap staan tot mail
 * is ingesteld.
 */

/* ------------------------------------------------------------------ */
/* Afmeldlink (ook gebruikt door de nieuwsbrief en /afmelden)           */
/* ------------------------------------------------------------------ */

export { afmeldToken, afmeldUrl } from '@/lib/kms/campagneAfmelden';
import { afmeldUrl } from '@/lib/kms/campagneAfmelden';

/* ------------------------------------------------------------------ */
/* Typen en kleine helpers                                             */
/* ------------------------------------------------------------------ */

export type CampagneRij = {
  id: string;
  naam: string;
  type: string;
  status: string;
  van_naam: string | null;
  van_email: string | null;
  created_at: string;
  flow?: unknown;
  trigger?: unknown;
  doel?: unknown;
  doelgroep?: string | null;
  omschrijving?: string | null;
  voorbeeld?: string | null;
  geactiveerd_op?: string | null;
  updated_at?: string | null;
};

type InsRij = {
  id: string;
  campagne_id: string;
  prospect_id: string | null;
  lead_id?: string | null;
  organisatie_id?: string | null;
  email?: string | null;
  naam?: string | null;
  status: string;
  huidige_stap: number;
  huidige_knoop?: string | null;
  volgende_verzending: string | null;
  created_at: string;
  gereageerd_op?: string | null;
  fouten?: number | null;
};

const UUR = 3_600_000;
const DAG = 24 * UUR;
/** Een wachttijd die binnen deze marge afloopt, telt al mee in de run van vandaag. */
const RUN_MARGE = 3 * UUR;

let nieuwModelCache: { waarde: boolean; tot: number } | null = null;

/** Is de migratie 20261004_campagnes_flow.sql gedraaid? */
export async function campagneModelV2(): Promise<boolean> {
  if (nieuwModelCache && nieuwModelCache.tot > Date.now()) return nieuwModelCache.waarde;
  const sb = kmsAdmin();
  if (!sb) return false;
  const [a, b] = await Promise.all([
    sb.from('campagne_inschrijvingen').select('huidige_knoop, lead_id').limit(1),
    sb.from('campagnes').select('flow, trigger').limit(1),
  ]);
  const waarde = !a.error && !b.error;
  nieuwModelCache = { waarde, tot: Date.now() + (waarde ? 10 * 60_000 : 30_000) };
  return waarde;
}

/** De flow van een campagne; oude campagnes zonder flow krijgen er een uit campagne_stappen. */
export async function laadFlow(c: CampagneRij): Promise<Flow> {
  const f = normaliseerFlow(c.flow);
  if (c.flow && typeof c.flow === 'object' && Array.isArray((c.flow as { stappen?: unknown }).stappen)) return f;
  const sb = kmsAdmin();
  if (!sb) return f;
  const { data } = await sb
    .from('campagne_stappen')
    .select('id, volgorde, wacht_dagen, onderwerp, body, ai_personaliseer')
    .eq('campagne_id', c.id)
    .order('volgorde', { ascending: true });
  const stappen = (data as { id: string; volgorde: number; wacht_dagen: number; onderwerp: string; body: string; ai_personaliseer: boolean }[]) ?? [];
  return stappen.length ? flowUitLegacy(stappen) : f;
}

/** Datum (YYYY-MM-DD) in Nederlandse tijd, zoveel werkdagen vanaf nu. */
export function werkdagenVanaf(nu: Date, dagen: number): string {
  const d = new Date(nu.getTime());
  let over = Math.max(0, dagen);
  while (over > 0) {
    d.setTime(d.getTime() + DAG);
    const wd = nlWeekdag(d);
    if (wd <= 5) over--;
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** 1 = maandag … 7 = zondag, in Nederlandse tijd. */
export function nlWeekdag(d: Date): number {
  const kort = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'short' }).format(d);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(kort) + 1 || 1;
}

/** Wanneer is een wachtstap voorbij? null = meteen door. */
export function wachtTot(k: WachtKnoop, nu: Date): Date | null {
  if (k.modus === 'weekdag') {
    const vandaag = nlWeekdag(nu);
    if (vandaag === k.weekdag) return null;
    const verschil = (k.weekdag - vandaag + 7) % 7;
    // De doeldag als Nederlandse kalenderdatum. Eerst UTC-uren zetten op `nu + verschil`
    // ging mis tussen 22:00/23:00 en middernacht UTC: dan is het in Nederland al de
    // volgende dag en kwam de wachtstap een dag te vroeg uit.
    const doelDag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(nu.getTime() + verschil * DAG),
    );
    // Vroeg op die dag (04:00 UTC = 05:00/06:00 in Nederland), zodat de run van die ochtend hem oppakt.
    return new Date(`${doelDag}T04:00:00Z`);
  }
  const ms = k.modus === 'uren' ? k.aantal * UUR : k.aantal * DAG;
  if (ms <= 0) return null;
  return new Date(nu.getTime() + ms);
}

/* ------------------------------------------------------------------ */
/* Opslaan met terugval naar het oude model                            */
/* ------------------------------------------------------------------ */

/** Oud model kent alleen huidige_stap (index van de mailstap). */
function legacyIndex(flow: Flow, knoopId: string | null): number {
  const mails = mailKnopen(flow);
  if (!knoopId || knoopId === EINDE_KNOOP) return mails.length;
  const id = knoopId.startsWith('w-') ? knoopId.slice(2) : knoopId;
  const i = mails.findIndex((m) => m.id === id);
  if (i >= 0) return i;
  // Een niet-mailstap: de eerstvolgende mail.
  let volgende: string | null = knoopId;
  for (let n = 0; n < 50 && volgende; n++) {
    const k = vindKnoop(flow, volgende);
    if (k?.type === 'mail') return mails.findIndex((m) => m.id === k.id);
    volgende = volgendeNa(flow, volgende);
  }
  return mails.length;
}

async function bewaarIns(v2: boolean, flow: Flow, id: string, patch: Record<string, unknown>): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  if (v2) {
    const { error } = await sb.from('campagne_inschrijvingen').update(patch).eq('id', id);
    if (!error) return;
  }
  const oud: Record<string, unknown> = {};
  for (const k of ['status', 'volgende_verzending']) if (k in patch) oud[k] = patch[k];
  if ('huidige_knoop' in patch) oud.huidige_stap = legacyIndex(flow, patch.huidige_knoop as string | null);
  if (oud.status === 'doel' || oud.status === 'gebounced') oud.status = oud.status === 'doel' ? 'klaar' : 'gestopt';
  await sb.from('campagne_inschrijvingen').update(oud).eq('id', id);
}

async function logEvent(campagneId: string, inschrijvingId: string | null, nodeId: string | null, soort: string, detail: Record<string, unknown> = {}): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  await sb.from('campagne_events').insert({ campagne_id: campagneId, inschrijving_id: inschrijvingId, node_id: nodeId, soort, detail });
}

/* ------------------------------------------------------------------ */
/* Mail opbouwen                                                       */
/* ------------------------------------------------------------------ */

type MailExtra = { reviewlink: string; spaardrempel: number; spaar?: { saldo: number; volgendNiveau: string | null } | null };

export function mergeContextVoor(c: Contact | null, extra: MailExtra): MergeContext {
  const base = env.siteUrl.replace(/\/$/, '');
  return {
    contactpersoon: c?.naam ?? null,
    bedrijfsnaam: c?.bedrijfsnaam ?? null,
    plaats: c?.plaats ?? null,
    branche: c?.branche ?? null,
    kennismakingslink: c?.token ? `${base}/k/${encodeURIComponent(c.token)}` : base,
    portaallink: `${base}/portaal`,
    reviewlink: extra.reviewlink || base,
    spaarsaldo: extra.spaar?.saldo ?? null,
    spaardrempel: extra.spaardrempel,
    volgendNiveau: extra.spaar?.volgendNiveau ?? (extra.spaardrempel ? `${extra.spaardrempel} punten` : null),
  };
}

async function aiOpening(c: Contact): Promise<string> {
  if (!isAiConfigured) return '';
  try {
    const r = await aiTekst(
      `Schrijf één korte, persoonlijke openingszin (maximaal 25 woorden) voor een zakelijke e-mail aan ${c.bedrijfsnaam || 'dit bedrijf'}${c.branche ? `, actief in ${c.branche}` : ''}${c.plaats ? ` in ${c.plaats}` : ''}, namens Jessi van Frederiks Bedrijfskleding uit Hengelo (Gld). Concreet en relevant, je-vorm, geen clichés, geen aanhef of ondertekening, geen gedachtestreepjes, alleen die ene zin.`,
    );
    return r.ok && r.tekst ? r.tekst.trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

export type GebouwdeMail = { onderwerp: string; html: string; fout?: string };

/**
 * Bouwt de mail voor één ontvanger. `token` null = geen tracking (testmail).
 */
export async function bouwMail(k: MailKnoop, ctx: MergeContext, email: string, token: string | null, metAi: Contact | null): Promise<GebouwdeMail> {
  const ctxVol: MergeContext = { ...ctx };
  if (k.ai && metAi && /\{\{\s*ai\s*\}\}/i.test(k.inhoud + k.onderwerp)) ctxVol.ai = await aiOpening(metAi);
  const afmeld = afmeldUrl(email);
  const onderwerp = vulMergeTags(k.onderwerp, ctxVol).replace(/\s+/g, ' ').trim();

  let html: string;
  if (k.stijl === 'nieuwsbrief') {
    const brief = k.nieuwsbriefId ? await getNieuwsbrief(k.nieuwsbriefId) : null;
    if (!brief) return { onderwerp, html: '', fout: 'Het gekozen nieuwsbriefontwerp bestaat niet meer.' };
    const ontvanger = { naam: ctxVol.contactpersoon ?? null, email, bedrijf: ctxVol.bedrijfsnaam ?? null };
    html = renderNieuwsbrief(brief.ontwerp, {
      onderwerp: renderOnderwerp(onderwerp, ontvanger),
      preheader: k.preheader || brief.preheader,
      modus: 'email',
      ontvanger,
      afmeldUrl: afmeld,
      webUrl: webversieUrl(brief.web_token),
      siteUrl: env.siteUrl.replace(/\/$/, ''),
    });
    // Onze extra merge-tags ({{kennismakingslink}} e.d.), ge-escaped voor HTML.
    const veilig: MergeContext = Object.fromEntries(Object.entries(ctxVol).map(([a, b]) => [a, typeof b === 'string' ? escapeHtml(b) : b]));
    html = vulMergeTags(html, veilig);
  } else {
    html = renderMail({ stijl: k.stijl, onderwerp: k.onderwerp, preheader: k.preheader, inhoud: k.inhoud, ctx: ctxVol, afmeldUrl: afmeld });
  }
  if (token) html = voegTrackingToe(html, token, afmeld);
  return { onderwerp, html };
}

function afzender(c: CampagneRij, inst: CampagneInstellingen): string {
  if (c.van_email) return `${c.van_naam || inst.afzenderNaam} <${c.van_email}>`;
  const basis = env.campagneFrom || env.resendFrom;
  // Alleen het adres overnemen en de naam van Jessi ervoor zetten: persoonlijker in de inbox.
  const adres = basis.match(/<([^>]+)>/)?.[1] ?? basis;
  return `${c.van_naam || inst.afzenderNaam} <${adres}>`;
}

/* ------------------------------------------------------------------ */
/* Voorwaarden en doelen                                               */
/* ------------------------------------------------------------------ */

const PROSPECT_GEREAGEERD = ['reageerde', 'geinteresseerd', 'gekwalificeerd', 'klant'];
const LEAD_GEREAGEERD = ['contact', 'afspraak', 'offerte', 'geaccordeerd'];

function heeftGereageerd(ins: InsRij, c: Contact | null): boolean {
  if (ins.gereageerd_op) return true;
  if (!c) return false;
  if (c.soort === 'prospect') return PROSPECT_GEREAGEERD.includes(String(c.status));
  if (c.soort === 'lead') return LEAD_GEREAGEERD.includes(String(c.status));
  return false;
}

function bevatEen(waarde: string | null, lijst: string): boolean {
  const w = String(waarde ?? '').toLowerCase();
  if (!w) return false;
  return lijst
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((s) => w.includes(s));
}

async function evalueer(k: VoorwaardeKnoop, ins: InsRij, c: Contact | null, email: string): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  switch (k.soort) {
    case 'geopend':
    case 'geklikt': {
      let q = sb.from('campagne_verzendingen').select('geopend_op, geklikt_op').eq('inschrijving_id', ins.id);
      if (k.mailId) q = q.eq('node_id', k.mailId);
      const { data, error } = await q;
      if (error) return false;
      const rijen = (data as { geopend_op: string | null; geklikt_op: string | null }[]) ?? [];
      return rijen.some((r) => (k.soort === 'geopend' ? r.geopend_op || r.geklikt_op : r.geklikt_op));
    }
    case 'gescand':
      return Boolean(c?.soort === 'prospect' && c.laatsteScanOp && new Date(c.laatsteScanOp).getTime() >= new Date(ins.created_at).getTime());
    case 'gereageerd':
      return heeftGereageerd(ins, c);
    case 'branche':
      return bevatEen(c?.branche ?? null, k.waarde);
    case 'plaats':
      return bevatEen(c?.plaats ?? null, k.waarde);
    case 'status':
      return String(c?.status ?? '').toLowerCase() === k.waarde.trim().toLowerCase();
    case 'tag': {
      if (!email) return false;
      const { data, error } = await sb.from('campagne_tags').select('id').eq('email', email).eq('tag', k.waarde.trim().toLowerCase()).limit(1);
      return !error && (data ?? []).length > 0;
    }
    default:
      return false;
  }
}

/**
 * Doelen: wie een doel haalt, stopt (status 'doel'). Zoals in ActiveCampaign en
 * HubSpot: de campagne heeft z'n werk gedaan.
 */
async function controleerDoelen(c: CampagneRij): Promise<number> {
  const sb = kmsAdmin();
  const doel = normaliseerDoel(c.doel);
  if (!sb || !doel.soorten.length) return 0;
  const { data, error } = await sb
    .from('campagne_inschrijvingen')
    .select('id, campagne_id, prospect_id, lead_id, organisatie_id, email, status, huidige_stap, huidige_knoop, volgende_verzending, created_at, gereageerd_op')
    .eq('campagne_id', c.id)
    .eq('status', 'actief')
    .limit(3000);
  if (error) return 0;
  const lijst = (data as InsRij[]) ?? [];
  if (!lijst.length) return 0;

  const contacten = await laadContacten({
    prospectIds: lijst.map((i) => i.prospect_id ?? '').filter(Boolean),
    leadIds: lijst.map((i) => i.lead_id ?? '').filter(Boolean),
    orgIds: lijst.map((i) => i.organisatie_id ?? '').filter(Boolean),
  });
  const contactVan = (i: InsRij) =>
    i.prospect_id ? contacten.get(contactSleutel('prospect', i.prospect_id)) ?? null : i.lead_id ? contacten.get(contactSleutel('lead', i.lead_id)) ?? null : i.organisatie_id ? contacten.get(contactSleutel('klant', i.organisatie_id)) ?? null : null;

  const vroegste = lijst.reduce((m, i) => (i.created_at < m ? i.created_at : m), lijst[0].created_at);
  const prospectIds = lijst.map((i) => i.prospect_id).filter((x): x is string => !!x);
  const orgIds = new Set<string>();
  for (const i of lijst) {
    const ct = contactVan(i);
    if (ct?.organisatieId) orgIds.add(ct.organisatieId);
  }

  // Afspraken (taken van soort 'afspraak') sinds de inschrijving.
  const afspraakProspect = new Map<string, string>();
  const afspraakOrg = new Map<string, string>();
  if (doel.soorten.includes('afspraak')) {
    const verzamel = (rijen: { prospect_id: string | null; organisatie_id: string | null; created_at: string }[]) => {
      for (const t of rijen) {
        if (t.prospect_id && (!afspraakProspect.get(t.prospect_id) || t.created_at > afspraakProspect.get(t.prospect_id)!)) afspraakProspect.set(t.prospect_id, t.created_at);
        if (t.organisatie_id && (!afspraakOrg.get(t.organisatie_id) || t.created_at > afspraakOrg.get(t.organisatie_id)!)) afspraakOrg.set(t.organisatie_id, t.created_at);
      }
    };
    for (let i = 0; i < prospectIds.length; i += 300) {
      const { data: t } = await sb.from('taken').select('prospect_id, organisatie_id, created_at').eq('soort', 'afspraak').gte('created_at', vroegste).in('prospect_id', prospectIds.slice(i, i + 300));
      verzamel((t as { prospect_id: string | null; organisatie_id: string | null; created_at: string }[]) ?? []);
    }
    const orgLijst = Array.from(orgIds);
    for (let i = 0; i < orgLijst.length; i += 300) {
      const { data: t } = await sb.from('taken').select('prospect_id, organisatie_id, created_at').eq('soort', 'afspraak').gte('created_at', vroegste).in('organisatie_id', orgLijst.slice(i, i + 300));
      verzamel((t as { prospect_id: string | null; organisatie_id: string | null; created_at: string }[]) ?? []);
    }
  }

  // Orders sinds de inschrijving.
  const laatsteOrder = new Map<string, string>();
  if (doel.soorten.includes('order') && orgIds.size) {
    const orgLijst = Array.from(orgIds);
    for (let i = 0; i < orgLijst.length; i += 300) {
      const { data: o } = await sb.from('orders').select('organisatie_id, besteldatum, created_at, status').in('organisatie_id', orgLijst.slice(i, i + 300)).gte('created_at', vroegste);
      for (const r of (o as { organisatie_id: string; besteldatum: string | null; created_at: string; status: string }[]) ?? []) {
        if (r.status === 'concept') continue;
        const d = r.besteldatum ?? r.created_at;
        if (!laatsteOrder.get(r.organisatie_id) || d > laatsteOrder.get(r.organisatie_id)!) laatsteOrder.set(r.organisatie_id, d);
      }
    }
  }

  let bereikt = 0;
  const nu = new Date().toISOString();
  for (const i of lijst) {
    const ct = contactVan(i);
    let gehaald: string | null = null;
    for (const s of doel.soorten) {
      if (s === 'afspraak') {
        const a = (i.prospect_id && afspraakProspect.get(i.prospect_id)) || (ct?.organisatieId && afspraakOrg.get(ct.organisatieId)) || null;
        if ((a && a >= i.created_at) || (ct?.soort === 'lead' && ct.status === 'afspraak')) gehaald = s;
      } else if (s === 'klant') {
        if ((ct?.soort === 'prospect' && ct.status === 'klant') || (ct?.soort === 'lead' && (ct.status === 'geaccordeerd' || !!ct.organisatieId))) gehaald = s;
      } else if (s === 'gereageerd') {
        if (heeftGereageerd(i, ct)) gehaald = s;
      } else if (s === 'offerte') {
        if (ct?.soort === 'lead' && (ct.status === 'offerte' || ct.status === 'geaccordeerd')) gehaald = s;
      } else if (s === 'order') {
        const o = ct?.organisatieId ? laatsteOrder.get(ct.organisatieId) : null;
        if (o && o >= i.created_at) gehaald = s;
      }
      if (gehaald) break;
    }
    if (!gehaald) continue;
    const { error: e } = await sb.from('campagne_inschrijvingen').update({ status: 'doel', doel_bereikt_op: nu, afgerond_op: nu, volgende_verzending: null }).eq('id', i.id);
    if (!e) {
      bereikt++;
      await logEvent(c.id, i.id, null, 'doel', { doel: gehaald });
    }
  }
  return bereikt;
}

/* ------------------------------------------------------------------ */
/* Automatische triggers                                               */
/* ------------------------------------------------------------------ */

const GELEVERD = ['verzonden', 'factureren', 'afgerond'];
const MAX_PER_TRIGGER = 200;

async function triggerKandidaten(c: CampagneRij, t: Trigger): Promise<Contact[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const sinds = c.geactiveerd_op || c.created_at;
  const nu = new Date();

  if (t.soort === 'lead_nieuw') {
    let q = sb.from('leads').select('id').gte('created_at', sinds).limit(MAX_PER_TRIGGER);
    if (t.bron) q = q.ilike('bron', `%${t.bron.replace(/[\\%_]/g, (x) => `\\${x}`)}%`);
    if (t.kanaal) q = q.eq('bron_kanaal', t.kanaal);
    const { data } = await q;
    const m = await laadContacten({ leadIds: ((data as { id: string }[]) ?? []).map((r) => r.id) });
    return Array.from(m.values());
  }
  if (t.soort === 'qr_scan') {
    const { data } = await sb.from('prospecten').select('id').gte('laatste_scan_op', sinds).not('status', 'in', '("afgemeld","klant")').limit(MAX_PER_TRIGGER);
    const m = await laadContacten({ prospectIds: ((data as { id: string }[]) ?? []).map((r) => r.id) });
    return Array.from(m.values());
  }
  if (t.soort === 'prospect_status') {
    if (!t.status) return [];
    const { data } = await sb.from('prospecten').select('id').eq('status', t.status).limit(MAX_PER_TRIGGER * 5);
    const m = await laadContacten({ prospectIds: ((data as { id: string }[]) ?? []).map((r) => r.id) });
    return Array.from(m.values());
  }
  if (t.soort === 'klant_nieuw') {
    const dag = sinds.slice(0, 10);
    const { data } = await sb.from('organisaties').select('id').eq('actief', true).or(`datum_klant.gte.${dag},created_at.gte.${sinds}`).limit(MAX_PER_TRIGGER);
    const m = await laadContacten({ orgIds: ((data as { id: string }[]) ?? []).map((r) => r.id) });
    return Array.from(m.values());
  }
  if (t.soort === 'klant_slapend') {
    const grens = new Date(nu.getTime() - t.maanden * 30.44 * DAG).toISOString();
    const laatste = new Map<string, string>();
    for (let van = 0; van < 20000; van += 1000) {
      const { data } = await sb.from('orders').select('organisatie_id, besteldatum, created_at, status').neq('status', 'concept').range(van, van + 999);
      const rijen = (data as { organisatie_id: string | null; besteldatum: string | null; created_at: string }[]) ?? [];
      for (const r of rijen) {
        if (!r.organisatie_id) continue;
        const d = r.besteldatum ?? r.created_at;
        if (!laatste.get(r.organisatie_id) || d > laatste.get(r.organisatie_id)!) laatste.set(r.organisatie_id, d);
      }
      if (rijen.length < 1000) break;
    }
    const slapend = Array.from(laatste.entries()).filter(([, d]) => d < grens).map(([id]) => id);
    if (!slapend.length) return [];
    const { data: act } = await sb.from('organisaties').select('id').eq('actief', true).in('id', slapend.slice(0, 1000));
    const m = await laadContacten({ orgIds: ((act as { id: string }[]) ?? []).map((r) => r.id).slice(0, MAX_PER_TRIGGER) });
    return Array.from(m.values());
  }
  if (t.soort === 'klant_jubileum') {
    const { data } = await sb.from('organisaties').select('id, datum_klant').eq('actief', true).not('datum_klant', 'is', null);
    // Ook de afgelopen 3 dagen: de cron draait niet in het weekend.
    const venster = [0, 1, 2, 3].map((n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', month: '2-digit', day: '2-digit' }).format(new Date(nu.getTime() - n * DAG)));
    const jaar = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric' }).format(nu));
    const ids = ((data as { id: string; datum_klant: string }[]) ?? [])
      .filter((o) => Number(o.datum_klant.slice(0, 4)) < jaar && venster.includes(o.datum_klant.slice(5, 10)))
      .map((o) => o.id);
    const m = await laadContacten({ orgIds: ids.slice(0, MAX_PER_TRIGGER) });
    return Array.from(m.values());
  }
  if (t.soort === 'order_geleverd') {
    const vanaf = new Date(new Date(sinds).getTime() - 30 * DAG).toISOString();
    const { data } = await sb.from('orders').select('organisatie_id').in('status', GELEVERD).gte('created_at', vanaf).limit(2000);
    const ids = Array.from(new Set(((data as { organisatie_id: string | null }[]) ?? []).map((r) => r.organisatie_id).filter((x): x is string => !!x)));
    const m = await laadContacten({ orgIds: ids.slice(0, MAX_PER_TRIGGER) });
    return Array.from(m.values());
  }
  if (t.soort === 'spaar_bijna') {
    if (!(await spaarActief())) return [];
    const standen = await spaarStanden();
    const metNiveaus = standen.some((s) => s.volgendNiveau);
    const ids = standen
      .filter((s) =>
        t.spaarModus === 'niveau' && metNiveaus
          ? !!s.volgendNiveau && s.voortgang * 100 >= t.niveauPct && s.voortgang < 1
          : s.saldo >= Math.max(0, t.drempel - t.marge) && s.saldo < t.drempel,
      )
      .map((s) => s.organisatieId);
    const m = await laadContacten({ orgIds: ids.slice(0, MAX_PER_TRIGGER) });
    return Array.from(m.values());
  }
  return [];
}

async function verwerkTrigger(c: CampagneRij): Promise<number> {
  const t = normaliseerTrigger(c.trigger);
  if (t.soort === 'handmatig') return 0;
  let kandidaten = (await triggerKandidaten(c, t)).filter((k) => /@/.test(k.email ?? ''));
  if (t.branche) kandidaten = kandidaten.filter((k) => bevatEen(k.branche, t.branche));
  if (!kandidaten.length) return 0;
  const r = await schrijfContactenIn(c.id, kandidaten.slice(0, MAX_PER_TRIGGER), { bron: 'trigger', herhaalNaDagen: t.herhalen ? t.herhaalNaDagen : null });
  return r.nieuw + r.heropend;
}

/* ------------------------------------------------------------------ */
/* Stappen uitvoeren                                                   */
/* ------------------------------------------------------------------ */

async function voerTaakUit(k: TaakKnoop, c: CampagneRij, ct: Contact | null, ctx: MergeContext, nu: Date): Promise<string | null> {
  const sb = kmsAdmin();
  const titel = vulMergeTags(k.titel, ctx).slice(0, 200);
  const regels = [vulMergeTags(k.omschrijving, ctx), '', `Uit campagne "${c.naam}".`];
  if (ct) regels.push(`${ct.bedrijfsnaam ?? ''}${ct.naam ? `, ${ct.naam}` : ''}${ct.email ? ` (${ct.email})` : ''}`.replace(/^, /, ''));
  const res = await maakTaak({
    titel,
    omschrijving: regels.join('\n').trim(),
    organisatie_id: ct?.organisatieId ?? null,
    persoon_id: k.persoonId,
    vervaldatum: werkdagenVanaf(nu, k.binnenDagen),
    prioriteit: k.prioriteit,
    soort: 'taak',
  });
  if ('fout' in res) return null;
  if (sb && ct?.soort === 'prospect') await sb.from('taken').update({ prospect_id: ct.id }).eq('id', res.id);
  return res.id;
}

export type RunResultaat = {
  ok: boolean;
  gepauzeerd: boolean;
  mailIngesteld: boolean;
  ingeschreven: number;
  doelBereikt: number;
  verwerkt: number;
  verzonden: number;
  mislukt: number;
  wachtOpMail: number;
  limietBereikt: boolean;
  meldingen: string[];
};

/**
 * Eén volledige run: triggers, doelen, wachtrij. Stopt netjes rond `tijdMs` zodat
 * de functie binnen de limiet van Vercel blijft.
 */
export async function verwerkCampagnes(opties: { tijdMs?: number } = {}): Promise<RunResultaat> {
  const start = Date.now();
  const deadline = start + (opties.tijdMs ?? 50_000);
  const res: RunResultaat = {
    ok: true,
    gepauzeerd: false,
    mailIngesteld: isEmailConfigured,
    ingeschreven: 0,
    doelBereikt: 0,
    verwerkt: 0,
    verzonden: 0,
    mislukt: 0,
    wachtOpMail: 0,
    limietBereikt: false,
    meldingen: [],
  };
  const sb = kmsAdmin();
  if (!sb) return { ...res, ok: false, meldingen: ['Database niet gekoppeld.'] };

  const inst = await getCampagneInstellingen();
  if (inst.allesGepauzeerd) return { ...res, gepauzeerd: true, meldingen: ['Alle campagnes staan op pauze.'] };
  if (!isEmailConfigured) res.meldingen.push('Mail is nog niet ingesteld (RESEND_API_KEY). Er gaat niets de deur uit; ingeschrevenen wachten bij hun mailstap.');

  const v2 = await campagneModelV2();
  const { data: campData } = await sb.from('campagnes').select('*').eq('status', 'actief');
  const campagnes = (campData as CampagneRij[]) ?? [];
  if (!campagnes.length) return res;
  const perId = new Map(campagnes.map((c) => [c.id, c]));
  const flows = new Map<string, Flow>();
  for (const c of campagnes) flows.set(c.id, await laadFlow(c));

  // 1 en 2: triggers en doelen (alleen met de nieuwe kolommen).
  if (v2) {
    for (const c of campagnes) {
      if (Date.now() > deadline - 20_000) break;
      try {
        res.ingeschreven += await verwerkTrigger(c);
      } catch (e) {
        res.meldingen.push(`Trigger van "${c.naam}" faalde: ${(e as Error).message}`);
      }
      try {
        res.doelBereikt += await controleerDoelen(c);
      } catch (e) {
        res.meldingen.push(`Doelcontrole van "${c.naam}" faalde: ${(e as Error).message}`);
      }
    }
  }

  // 3: wachtrij.
  const nu = new Date();
  const kolommen = v2
    ? 'id, campagne_id, prospect_id, lead_id, organisatie_id, email, naam, status, huidige_stap, huidige_knoop, volgende_verzending, created_at, gereageerd_op, fouten'
    : 'id, campagne_id, prospect_id, status, huidige_stap, volgende_verzending, created_at';
  const { data: insData } = await sb
    .from('campagne_inschrijvingen')
    .select(kolommen)
    .eq('status', 'actief')
    .in('campagne_id', campagnes.map((c) => c.id))
    .or(`volgende_verzending.is.null,volgende_verzending.lte.${new Date(nu.getTime() + RUN_MARGE).toISOString()}`)
    .order('volgende_verzending', { ascending: true, nullsFirst: true })
    .limit(600);
  const wachtrij = (insData as unknown as InsRij[]) ?? [];
  if (!wachtrij.length) return res;

  const contacten = await laadContacten({
    prospectIds: wachtrij.map((i) => i.prospect_id ?? '').filter(Boolean),
    leadIds: wachtrij.map((i) => i.lead_id ?? '').filter(Boolean),
    orgIds: wachtrij.map((i) => i.organisatie_id ?? '').filter(Boolean),
  });
  const contactVan = (i: InsRij) =>
    i.prospect_id ? contacten.get(contactSleutel('prospect', i.prospect_id)) ?? null : i.lead_id ? contacten.get(contactSleutel('lead', i.lead_id)) ?? null : i.organisatie_id ? contacten.get(contactSleutel('klant', i.organisatie_id)) ?? null : null;
  const afgemeld = await afgemeldeAdressen(wachtrij.map((i) => schoonEmail(contactVan(i)?.email ?? i.email ?? '')));

  // Dagteller en "max één mail per persoon per dag" over alle campagnes.
  const sinds = new Date(nu.getTime() - 20 * UUR).toISOString();
  const { count: alVerzonden } = await sb.from('campagne_verzendingen').select('id', { count: 'exact', head: true }).eq('status', 'verzonden').gte('verzonden_op', sinds);
  let dagTeller = alVerzonden ?? 0;
  const vandaagGemaild = new Set<string>();
  if (v2) {
    const { data: recent } = await sb.from('campagne_verzendingen').select('email').eq('status', 'verzonden').gte('verzonden_op', sinds).limit(5000);
    for (const r of (recent as { email: string | null }[]) ?? []) if (r.email) vandaagGemaild.add(schoonEmail(r.email));
  }

  // Spaarstanden alleen ophalen als een mail ze nodig heeft.
  let spaar: Map<string, { saldo: number; volgendNiveau: string | null }> | null = null;
  const spaarVoor = async (orgId: string | null) => {
    if (!orgId) return null;
    if (!spaar) spaar = new Map((await spaarStanden()).map((s) => [s.organisatieId, { saldo: s.saldo, volgendNiveau: s.volgendNiveau }]));
    return spaar.get(orgId) ?? null;
  };

  for (const ins of wachtrij) {
    if (Date.now() > deadline) {
      res.meldingen.push('Tijd op voor deze run; de rest volgt bij de volgende run.');
      break;
    }
    const camp = perId.get(ins.campagne_id);
    const flow = flows.get(ins.campagne_id);
    if (!camp || !flow) continue;
    res.verwerkt++;
    const trigger = normaliseerTrigger(camp.trigger);
    const ct = contactVan(ins);
    const email = schoonEmail(ct?.email ?? ins.email ?? '');

    if (!ct) {
      await bewaarIns(v2, flow, ins.id, { status: 'gestopt', volgende_verzending: null, afgerond_op: nu.toISOString() });
      await logEvent(camp.id, ins.id, null, 'gestopt', { reden: 'Contact bestaat niet meer' });
      continue;
    }
    if (afgemeld.has(email) || (ct.soort === 'prospect' && ct.status === 'afgemeld')) {
      await bewaarIns(v2, flow, ins.id, { status: 'afgemeld', volgende_verzending: null, afgerond_op: nu.toISOString() });
      await logEvent(camp.id, ins.id, null, 'afgemeld');
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await bewaarIns(v2, flow, ins.id, { status: 'gestopt', volgende_verzending: null, afgerond_op: nu.toISOString() });
      await logEvent(camp.id, ins.id, null, 'gestopt', { reden: 'Geen geldig e-mailadres' });
      continue;
    }

    const ctx = mergeContextVoor(ct, { reviewlink: inst.reviewlink, spaardrempel: trigger.drempel, spaar: null });
    let knoopId: string | null = ins.huidige_knoop ?? (ins.huidige_stap > 0 ? mailKnopen(flow)[ins.huidige_stap]?.id ?? null : flow.stappen[0]?.id ?? null);
    const begonnen = Boolean(ins.huidige_knoop) || ins.huidige_stap > 0;
    if (!begonnen && !flow.stappen.length) continue; // lege flow: wachten tot er stappen zijn

    let gemaild = false;
    let patch: Record<string, unknown> | null = null;

    for (let n = 0; n < 40; n++) {
      if (!knoopId || knoopId === EINDE_KNOOP) {
        patch = { status: 'klaar', huidige_knoop: null, volgende_verzending: null, afgerond_op: nu.toISOString() };
        await logEvent(camp.id, ins.id, null, 'klaar');
        break;
      }
      const k = vindKnoop(flow, knoopId);
      if (!k) {
        patch = { status: 'gestopt', volgende_verzending: null, afgerond_op: nu.toISOString() };
        await logEvent(camp.id, ins.id, knoopId, 'gestopt', { reden: 'De stap waar deze persoon stond is verwijderd' });
        break;
      }

      if (k.type === 'mail') {
        if (!isEmailConfigured) {
          res.wachtOpMail++;
          patch = { huidige_knoop: k.id, volgende_verzending: nu.toISOString() };
          break;
        }
        if (gemaild || vandaagGemaild.has(email)) {
          patch = { huidige_knoop: k.id, volgende_verzending: new Date(nu.getTime() + 12 * UUR).toISOString() };
          break;
        }
        if (dagTeller >= inst.dagLimiet) {
          res.limietBereikt = true;
          patch = { huidige_knoop: k.id, volgende_verzending: nu.toISOString() };
          break;
        }
        const extraCtx = /spaar|punten|niveau/i.test(k.inhoud + k.onderwerp) && ct.soort === 'klant' ? { ...ctx, ...(await spaarCtx(await spaarVoor(ct.organisatieId), trigger.drempel)) } : ctx;
        const token = v2 ? nieuwTrackingToken() : null;
        const mail = await bouwMail(k, extraCtx, email, token, ct);
        let uitkomst: { sent: boolean; error?: string };
        if (mail.fout) uitkomst = { sent: false, error: mail.fout };
        else {
          uitkomst = await sendEmail({ to: email, from: afzender(camp, inst), replyTo: camp.van_email || site.email, subject: mail.onderwerp, html: mail.html }).catch((e: Error) => ({
            sent: false,
            error: e.message,
          }));
        }
        const rij: Record<string, unknown> = {
          campagne_id: camp.id,
          inschrijving_id: ins.id,
          prospect_id: ct.soort === 'prospect' ? ct.id : null,
          stap_id: /^[0-9a-f-]{36}$/i.test(k.id) ? k.id : null,
          onderwerp: mail.onderwerp,
          status: uitkomst.sent ? 'verzonden' : 'gefaald',
          error: uitkomst.sent ? null : (uitkomst.error ?? 'Onbekende fout').slice(0, 500),
        };
        if (v2) Object.assign(rij, { node_id: k.id, email, token, lead_id: ct.soort === 'lead' ? ct.id : null, organisatie_id: ct.soort === 'klant' ? ct.id : null });
        const ins1 = await sb.from('campagne_verzendingen').insert(rij);
        if (ins1.error && kolomOntbreekt(ins1.error)) {
          for (const kk of ['node_id', 'email', 'token', 'lead_id', 'organisatie_id']) delete rij[kk];
          await sb.from('campagne_verzendingen').insert(rij);
        } else if (ins1.error && rij.stap_id) {
          // stap_id verwijst naar campagne_stappen; bij een gekopieerde flow bestaat die niet.
          rij.stap_id = null;
          await sb.from('campagne_verzendingen').insert(rij);
        }

        if (!uitkomst.sent) {
          res.mislukt++;
          const fouten = (Number(ins.fouten) || 0) + 1;
          await logEvent(camp.id, ins.id, k.id, 'mislukt', { fout: uitkomst.error ?? null });
          if (mail.fout) patch = { status: 'gestopt', huidige_knoop: k.id, volgende_verzending: null, fouten, afgerond_op: nu.toISOString() };
          else if (fouten >= 3) patch = { status: 'gebounced', huidige_knoop: k.id, volgende_verzending: null, fouten, afgerond_op: nu.toISOString() };
          else patch = { huidige_knoop: k.id, volgende_verzending: new Date(nu.getTime() + 12 * UUR).toISOString(), fouten };
          break;
        }
        res.verzonden++;
        dagTeller++;
        gemaild = true;
        vandaagGemaild.add(email);
        await logEvent(camp.id, ins.id, k.id, 'verzonden', { onderwerp: mail.onderwerp });
        if (ct.soort === 'prospect') {
          const p: Record<string, unknown> = { laatste_contact: nu.toISOString() };
          if (ct.status === 'nieuw') p.status = 'benaderd';
          await sb.from('prospecten').update(p).eq('id', ct.id);
          if (ct.status === 'nieuw') ct.status = 'benaderd';
        }
        knoopId = volgendeNa(flow, k.id);
        continue;
      }

      if (k.type === 'wacht') {
        const tot = wachtTot(k, nu);
        const volgende = volgendeNa(flow, k.id);
        if (!tot) {
          knoopId = volgende;
          continue;
        }
        patch = { huidige_knoop: volgende ?? EINDE_KNOOP, volgende_verzending: tot.toISOString() };
        await logEvent(camp.id, ins.id, k.id, 'wacht', { tot: tot.toISOString() });
        break;
      }

      if (k.type === 'voorwaarde') {
        const ja = await evalueer(k, ins, ct, email);
        await logEvent(camp.id, ins.id, k.id, 'splitsing', { uitkomst: ja ? 'ja' : 'nee' });
        knoopId = begintak(flow, k, ja);
        continue;
      }

      if (k.type === 'taak') {
        const taakId = await voerTaakUit(k, camp, ct, ctx, nu);
        await logEvent(camp.id, ins.id, k.id, taakId ? 'taak' : 'mislukt', taakId ? { taakId, titel: vulMergeTags(k.titel, ctx) } : { fout: 'Taak aanmaken mislukt' });
        knoopId = volgendeNa(flow, k.id);
        continue;
      }

      if (k.type === 'status') {
        if (ct.soort === 'prospect' && k.prospectStatus && (PROSPECT_STATUSSEN as readonly string[]).includes(k.prospectStatus)) {
          await sb.from('prospecten').update({ status: k.prospectStatus }).eq('id', ct.id);
          await logEvent(camp.id, ins.id, k.id, 'status', { van: ct.status, naar: k.prospectStatus });
          ct.status = k.prospectStatus;
        } else if (ct.soort === 'lead' && k.leadStatus && (LEAD_STATUSSEN as readonly string[]).includes(k.leadStatus)) {
          await sb.from('leads').update({ status: k.leadStatus }).eq('id', ct.id);
          await logEvent(camp.id, ins.id, k.id, 'status', { van: ct.status, naar: k.leadStatus });
          ct.status = k.leadStatus;
        }
        knoopId = volgendeNa(flow, k.id);
        continue;
      }

      if (k.type === 'tag') {
        const tag = k.tag.trim().toLowerCase();
        if (tag) {
          const r =
            k.actie === 'verwijderen'
              ? await sb.from('campagne_tags').delete().eq('email', email).eq('tag', tag)
              : await sb.from('campagne_tags').upsert({ email, tag, bron_campagne_id: camp.id }, { onConflict: 'email,tag', ignoreDuplicates: true });
          if (!r.error) await logEvent(camp.id, ins.id, k.id, 'tag', { tag, actie: k.actie });
        }
        knoopId = volgendeNa(flow, k.id);
        continue;
      }

      // einde
      patch = { status: 'klaar', huidige_knoop: k.id, volgende_verzending: null, afgerond_op: nu.toISOString() };
      await logEvent(camp.id, ins.id, k.id, 'klaar');
      break;
    }

    if (!patch) patch = { huidige_knoop: knoopId, volgende_verzending: nu.toISOString() };
    patch.laatste_actie_op = nu.toISOString();
    await bewaarIns(v2, flow, ins.id, patch);
  }

  return res;
}

async function spaarCtx(s: { saldo: number; volgendNiveau: string | null } | null, drempel: number): Promise<Partial<MergeContext>> {
  if (!s) return {};
  return { spaarsaldo: s.saldo, spaardrempel: drempel, volgendNiveau: s.volgendNiveau ?? `${drempel} punten` };
}

/** Oude naam, voor bestaande aanroepen. */
export async function verwerkCampagneWachtrij(): Promise<{ verwerkt: number; verzonden: number }> {
  const r = await verwerkCampagnes();
  return { verwerkt: r.verwerkt, verzonden: r.verzonden };
}
