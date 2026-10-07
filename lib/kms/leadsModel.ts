/**
 * Leads: pure logica zonder database of server-imports, zodat zowel de
 * serverpagina's als de client-componenten (pijplijn) het kunnen gebruiken.
 *
 * - Statussen en hun standaardkans per fase (zoals Teamleader en Pipedrive).
 * - Leadscore 0-100, opgebouwd uit "past de lead bij ons" en "timing".
 * - Herkomst opschonen tot een kanaal (de website bewaart utm/verwijzer als tekst).
 * - De aanvraagtekst van het adviesformulier en de pakketconfigurator ontleden.
 */

import { padSoort, type PadStap } from '@/lib/leadHerkomst';

/* ------------------------------------------------------------------ */
/* Statussen                                                           */
/* ------------------------------------------------------------------ */

/**
 * Sleutels blijven gelijk aan wat er al in de database staat; andere modules
 * (dashboard, analyse, meldingen) lezen 'nieuw', 'offerte', 'geaccordeerd' en
 * 'afgewezen'. 'contact' en 'afspraak' zijn er tussen gekomen.
 */
export const LEAD_STATUSSEN = ['nieuw', 'contact', 'afspraak', 'offerte', 'geaccordeerd', 'afgewezen'] as const;
export type LeadStatus = (typeof LEAD_STATUSSEN)[number];

export const OPEN_STATUSSEN: readonly string[] = ['nieuw', 'contact', 'afspraak', 'offerte'];
export const GEWONNEN = 'geaccordeerd';
export const VERLOREN = 'afgewezen';

export const STATUS_LABEL: Record<string, string> = {
  nieuw: 'Nieuw',
  contact: 'Contact gehad',
  afspraak: 'Afspraak of passen',
  offerte: 'Offerte verstuurd',
  geaccordeerd: 'Gewonnen',
  afgewezen: 'Verloren',
};

/** Kans dat een lead in deze fase klant wordt, als er geen eigen kans is ingevuld. */
export const STANDAARD_KANS: Record<string, number> = {
  nieuw: 10,
  contact: 25,
  afspraak: 50,
  offerte: 70,
  geaccordeerd: 100,
  afgewezen: 0,
};

export function statusLabel(s: string | null | undefined): string {
  return STATUS_LABEL[String(s ?? '')] ?? String(s ?? 'onbekend');
}

export function isOpen(s: string | null | undefined): boolean {
  return OPEN_STATUSSEN.includes(String(s ?? ''));
}

export function schoneStatus(v: unknown): LeadStatus | null {
  const s = String(v ?? '').trim();
  return (LEAD_STATUSSEN as readonly string[]).includes(s) ? (s as LeadStatus) : null;
}

/** Vaste lijst zodat je later kunt tellen waarom je verliest. */
export const VERLOREN_REDENEN = [
  'Te duur',
  'Gekozen voor een concurrent',
  'Geen reactie meer',
  'Uitgesteld of geen budget',
  'Past niet bij ons aanbod',
  'Dubbele of foute aanvraag',
  'Anders',
] as const;

/** Soorten regels op de tijdlijn. */
export const ACTIVITEIT_SOORTEN = ['notitie', 'telefoon', 'mail', 'whatsapp', 'afspraak', 'reactie', 'status', 'taak', 'systeem'] as const;
export type ActiviteitSoort = (typeof ACTIVITEIT_SOORTEN)[number];

export const ACTIVITEIT_LABEL: Record<string, string> = {
  notitie: 'Notitie',
  telefoon: 'Gebeld',
  mail: 'Gemaild',
  whatsapp: 'WhatsApp',
  afspraak: 'Afspraak',
  reactie: 'Klant reageerde',
  status: 'Status',
  taak: 'Volgende stap',
  systeem: 'Systeem',
};

/** Deze soorten tellen als "we hebben contact gehad" (voor reactietijd en wacht-timer). */
export const CONTACT_SOORTEN: readonly string[] = ['telefoon', 'mail', 'whatsapp', 'afspraak', 'reactie'];

/** Herkomst bij handmatige invoer. */
export const HANDMATIGE_BRONNEN = ['Telefonisch', 'Beurs of evenement', 'Langs in de winkel', 'Doorverwijzing', 'E-mail', 'Anders'] as const;

export const AANTAL_OPTIES = ['1-5', '5-10', '10-25', '25-50', '50+'] as const;

export const BRANCHE_OPTIES = [
  'Bouw & infra',
  'Installatie & techniek',
  'Industrie & logistiek',
  'Horeca & food',
  'Kantoor & retail',
  'Agrarisch & groen',
  'Zorg & salon',
  'Clubs & verenigingen',
  'Anders',
] as const;

/* ------------------------------------------------------------------ */
/* Lead-vorm                                                           */
/* ------------------------------------------------------------------ */

export type LeadRij = {
  id: string;
  created_at: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  branche: string | null;
  aantal: string | null;
  bericht: string | null;
  bron: string | null;
  status: string;
  offertewaarde: number | null;
  notitie: string | null;
  opvolgdatum: string | null;
  organisatie_id: string | null;
  // Na migratie 20261004_leads_opvolging; daarvoor undefined.
  score?: number | null;
  kans?: number | null;
  verloren_reden?: string | null;
  eerste_contact?: string | null;
  laatste_contact?: string | null;
  eigenaar_id?: string | null;
  eigenaar?: string | null;
  volgende_stap?: string | null;
  volgende_taak_id?: string | null;
  status_gewijzigd_op?: string | null;
  // Na migratie 20261006_weblead_inname; daarvoor undefined.
  bron_kanaal?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  referrer?: string | null;
  landingspagina?: string | null;
  conversiepagina?: string | null;
  paginas_bekeken?: number | null;
  bezochte_paden?: PadStap[] | null;
  eerste_bezoek_op?: string | null;
  bezoeken?: number | null;
  gezien_op?: string | null;
};

/* ------------------------------------------------------------------ */
/* Datum en tijd (Nederlandse tijdzone)                                */
/* ------------------------------------------------------------------ */

/** Vandaag als YYYY-MM-DD in Nederland, ook als de server in UTC draait. */
export function vandaagNl(nu: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(nu);
}

export function urenTussen(van: string | Date, tot: Date = new Date()): number {
  const a = typeof van === 'string' ? new Date(van).getTime() : van.getTime();
  return Math.max(0, (tot.getTime() - a) / 3_600_000);
}

/** "3 uur", "2 dagen", "5 wk". Kort genoeg voor op een kaartje. */
export function duurKort(uren: number): string {
  if (uren < 1) return `${Math.max(1, Math.round(uren * 60))} min`;
  if (uren < 48) return `${Math.round(uren)} uur`;
  const dagen = Math.round(uren / 24);
  if (dagen < 21) return `${dagen} dagen`;
  return `${Math.round(dagen / 7)} wk`;
}

export function datumKort(d: string | null | undefined): string {
  if (!d) return '';
  try {
    const iso = d.length === 10 ? `${d}T12:00:00` : d;
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' });
  } catch {
    return d;
  }
}

export function datumTijd(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  } catch {
    return d;
  }
}

export const euro = (n: number | null | undefined) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);

/* ------------------------------------------------------------------ */
/* Aantal medewerkers en waarde                                        */
/* ------------------------------------------------------------------ */

/** "5-10 medewerkers", "2 tot 10", "50+", "14" -> ongeveer het midden van de range. Null als onbekend. */
export function teamGrootte(aantal: string | null | undefined): number | null {
  const s = String(aantal ?? '').toLowerCase();
  const getallen = (s.match(/\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!getallen.length) return null;
  if (getallen.length === 1) return s.includes('+') ? Math.round(getallen[0] * 1.3) : getallen[0];
  return Math.round((getallen[0] + getallen[1]) / 2);
}

/** Wat een medewerker gemiddeld aan eerste uitrusting oplevert. Ruwe schatting voor de pijplijn. */
export const WAARDE_PER_MEDEWERKER = 175;

/** Ingevulde offertewaarde, anders een schatting uit de teamgrootte. */
export function leadWaarde(l: Pick<LeadRij, 'offertewaarde' | 'aantal'>): { waarde: number; geschat: boolean } {
  const echt = l.offertewaarde == null ? null : Number(l.offertewaarde);
  if (echt != null && Number.isFinite(echt) && echt > 0) return { waarde: echt, geschat: false };
  const team = teamGrootte(l.aantal);
  return { waarde: team ? team * WAARDE_PER_MEDEWERKER : 0, geschat: true };
}

export function leadKans(l: Pick<LeadRij, 'kans' | 'status'>): number {
  if (l.status === GEWONNEN) return 100;
  if (l.status === VERLOREN) return 0;
  const k = l.kans == null ? null : Number(l.kans);
  if (k != null && Number.isFinite(k)) return Math.max(0, Math.min(100, Math.round(k)));
  return STANDAARD_KANS[l.status] ?? 10;
}

/* ------------------------------------------------------------------ */
/* Aanvraag ontleden                                                   */
/* ------------------------------------------------------------------ */

export type AanvraagStuk = { naam: string; kleur: string | null; logo: string | null; aantal: number | null; voorkeur: string | null };

export type Aanvraag = {
  soort: 'configurator' | 'advies' | 'vrij';
  intro: string | null;
  velden: { label: string; waarde: string }[];
  stukken: AanvraagStuk[];
  lijsten: { kop: string; regels: string[] }[];
  vrijeTekst: string | null;
  passenOpLocatie: boolean | null;
  logoAangeleverd: boolean | null;
};

/**
 * Leest de tekst die de website in `bericht` zet:
 * - configurator: intro, "Sleutel: waarde"-regels, "Kledingstukken:" met "- Polo, Zwart, logo borst links, 10x";
 * - adviesformulier: intro en "Sleutel: waarde"-regels;
 * - alles anders blijft gewone tekst.
 */
export function ontleedAanvraag(bericht: string | null | undefined): Aanvraag {
  const tekst = String(bericht ?? '').replace(/\r/g, '').trim();
  const leeg: Aanvraag = { soort: 'vrij', intro: null, velden: [], stukken: [], lijsten: [], vrijeTekst: tekst || null, passenOpLocatie: null, logoAangeleverd: null };
  if (!tekst) return leeg;
  const regels = tekst.split('\n').map((r) => r.trim()).filter(Boolean);
  const eerste = regels[0]?.toLowerCase() ?? '';
  const soort: Aanvraag['soort'] = eerste.startsWith('pakket samengesteld') ? 'configurator' : eerste.startsWith('kledingadvies aangevraagd') ? 'advies' : 'vrij';
  if (soort === 'vrij') {
    return { ...leeg, passenOpLocatie: /passen op locatie gewenst:\s*ja/i.test(tekst) ? true : null };
  }

  const uit: Aanvraag = { ...leeg, soort, intro: regels[0], vrijeTekst: null };
  let lijst: { kop: string; regels: string[] } | null = null;
  const los: string[] = [];
  for (const r of regels.slice(1)) {
    if (r.startsWith('- ')) {
      const inhoud = r.slice(2).trim();
      if (lijst && lijst.kop.toLowerCase() === 'kledingstukken') {
        const stuk = ontleedStuk(inhoud);
        if (stuk) uit.stukken.push(stuk);
      } else if (lijst) {
        lijst.regels.push(inhoud);
      } else {
        los.push(inhoud);
      }
      continue;
    }
    const kop = /^([^:]{2,40}):\s*$/.exec(r);
    if (kop) {
      lijst = { kop: kop[1].trim(), regels: [] };
      if (lijst.kop.toLowerCase() !== 'kledingstukken') uit.lijsten.push(lijst);
      continue;
    }
    const veld = /^([^:]{2,40}):\s*(.+)$/.exec(r);
    if (veld) {
      lijst = null;
      const label = veld[1].trim();
      const waarde = veld[2].trim();
      uit.velden.push({ label, waarde });
      if (/passen op locatie/i.test(label)) uit.passenOpLocatie = /^ja/i.test(waarde);
      if (/^logo$/i.test(label)) uit.logoAangeleverd = /aangeleverd/i.test(waarde);
      continue;
    }
    lijst = null;
    los.push(r);
  }
  if (los.length) uit.vrijeTekst = los.join('\n');
  return uit;
}

function ontleedStuk(regel: string): AanvraagStuk | null {
  if (!regel || regel.startsWith('(')) return null;
  const [hoofd, voorkeur] = regel.split(/\s+[—-]\s+voorkeur:\s*/i);
  const delen = hoofd.split(',').map((d) => d.trim()).filter(Boolean);
  let aantal: number | null = null;
  const laatste = delen[delen.length - 1] ?? '';
  const m = /^(\d+)\s*x$/i.exec(laatste);
  if (m) {
    aantal = Number(m[1]);
    delen.pop();
  }
  const logoIdx = delen.findIndex((d) => /^logo\b/i.test(d));
  const logo = logoIdx >= 0 ? delen.splice(logoIdx, 1)[0].replace(/^logo\s*/i, '') : null;
  return { naam: delen[0] ?? regel, kleur: delen[1] ?? null, logo: logo || null, aantal, voorkeur: voorkeur?.trim() || null };
}

/* ------------------------------------------------------------------ */
/* Herkomst                                                            */
/* ------------------------------------------------------------------ */

/**
 * De website bewaart de herkomst als vrije tekst ("bron=google, medium=cpc",
 * "verwijzing: facebook.com", "direct of onbekend"). Voor de analyse brengen
 * we dat terug tot een handvol kanalen; onbekende waarden blijven zichtbaar.
 */
export function bronKanaal(bron: string | null | undefined): string {
  const s = String(bron ?? '').trim();
  const l = s.toLowerCase();
  if (!s || l === 'onbekend' || l.startsWith('direct of onbekend')) return 'Direct of onbekend';
  if (l.includes('gclid') || (l.includes('google') && /medium=(cpc|ppc|paid)/.test(l))) return 'Google Ads';
  if (l.includes('fbclid') || /facebook|instagram|meta\b|medium=social/.test(l)) return 'Social media';
  if (l.includes('linkedin')) return 'LinkedIn';
  if (l.includes('bedrijfsprofiel') || l.includes('google maps') || l.includes('maps.google')) return 'Google Bedrijfsprofiel';
  if (/medium=e-?mail|nieuwsbrief|mailchimp|campagne=/.test(l)) return 'Nieuwsbrief of mailing';
  if (/google|bing|duckduckgo|ecosia/.test(l)) return 'Zoekmachine';
  if (l.startsWith('telefo')) return 'Telefonisch';
  if (l.includes('beurs') || l.includes('evenement')) return 'Beurs of evenement';
  if (l.includes('winkel') || l.includes('binnengelopen')) return 'Langs in de winkel';
  if (l.includes('doorverwijz') || l.includes('mond-tot-mond') || l.includes('aanbevel')) return 'Doorverwijzing';
  if (l.startsWith('verwijzing:')) return 'Andere website';
  if (l.startsWith('bron=')) {
    const naam = /bron=([^,]+)/.exec(l)?.[1]?.trim() ?? '';
    return naam ? naam.charAt(0).toUpperCase() + naam.slice(1) : 'Overig';
  }
  return s.length > 32 ? `${s.slice(0, 30)}…` : s;
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

/** "06 12 34 56 78" -> "+31612345678" voor tel:-links. */
export function telLink(tel: string | null | undefined): string | null {
  const s = String(tel ?? '').replace(/[^\d+]/g, '');
  if (s.replace(/\D/g, '').length < 8) return null;
  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return `+${s.slice(2)}`;
  if (s.startsWith('0')) return `+31${s.slice(1)}`;
  return s;
}

/** WhatsApp-link, alleen voor mobiele nummers (06 of buitenlands +). */
export function whatsappLink(tel: string | null | undefined, tekst?: string): string | null {
  const t = telLink(tel);
  if (!t) return null;
  const cijfers = t.replace(/\D/g, '');
  if (cijfers.startsWith('31') && !cijfers.startsWith('316')) return null;
  return `https://wa.me/${cijfers}${tekst ? `?text=${encodeURIComponent(tekst)}` : ''}`;
}

export function heeftEmail(e: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e ?? '').trim());
}

/* ------------------------------------------------------------------ */
/* Dubbelen                                                            */
/* ------------------------------------------------------------------ */

export function emailSleutel(e: string | null | undefined): string | null {
  const s = String(e ?? '').trim().toLowerCase();
  return heeftEmail(s) ? s : null;
}

/** "Bouwbedrijf Hendriks B.V." en "bouwbedrijf hendriks" zijn hetzelfde bedrijf. */
export function bedrijfSleutel(c: string | null | undefined): string | null {
  const s = String(c ?? '')
    .toLowerCase()
    .replace(/[.,'"&()]/g, ' ')
    .replace(/\b(b\s?v|v\s?o\s?f|bv|vof|holding|nederland|nl)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length >= 3 ? s : null;
}

/** Groepeert leads met hetzelfde e-mailadres of dezelfde bedrijfsnaam. Geeft per lead-id de andere ids. */
export function vindDubbelen(leads: Pick<LeadRij, 'id' | 'email' | 'company'>[]): Map<string, string[]> {
  const ouder = new Map<string, string>();
  const vind = (x: string): string => {
    let p = ouder.get(x) ?? x;
    while (p !== (ouder.get(p) ?? p)) p = ouder.get(p) ?? p;
    ouder.set(x, p);
    return p;
  };
  const verbind = (a: string, b: string) => {
    const pa = vind(a);
    const pb = vind(b);
    if (pa !== pb) ouder.set(pa, pb);
  };
  const perSleutel = new Map<string, string>();
  for (const l of leads) {
    ouder.set(l.id, ouder.get(l.id) ?? l.id);
    for (const k of [emailSleutel(l.email) && `e:${emailSleutel(l.email)}`, bedrijfSleutel(l.company) && `b:${bedrijfSleutel(l.company)}`]) {
      if (!k) continue;
      const eerder = perSleutel.get(k);
      if (eerder) verbind(eerder, l.id);
      else perSleutel.set(k, l.id);
    }
  }
  const groepen = new Map<string, string[]>();
  for (const l of leads) {
    const g = vind(l.id);
    groepen.set(g, [...(groepen.get(g) ?? []), l.id]);
  }
  const uit = new Map<string, string[]>();
  for (const ids of groepen.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) uit.set(id, ids.filter((x) => x !== id));
  }
  return uit;
}

/* ------------------------------------------------------------------ */
/* Leadscore                                                           */
/* ------------------------------------------------------------------ */

/** Branches waar Frederiks het sterkst in is (werkkleding met logo, passen op locatie). */
const KERN_BRANCHES = /bouw|infra|industrie|techniek|installat|transport|logistiek|agri|groen|milieu|loon|hovenier|monteur/i;
const GOEDE_BRANCHES = /zorg|beauty|horeca|hospitality|kapsalon|salon|schoonmaak|facilit|retail/i;

export type ScoreDeel = { label: string; punten: number; max: number; uitleg: string };
export type LeadScore = { totaal: number; delen: ScoreDeel[] };

export type ScoreContext = {
  /** Eerste keer dat wij contact hadden (bel, mail, WhatsApp, afspraak). */
  eersteContact: string | null;
  /** De klant heeft zelf gereageerd (teruggebeld, gemaild). */
  klantReageerde: boolean;
  /** Aantal gestructureerde productregels (lead_regels). */
  aantalRegels?: number;
  /** Er is een logo geüpload (lead_logos). */
  logoAangeleverd?: boolean;
  nu?: Date;
};

/**
 * Gedrag op de site (max 15): hoeveel pagina's, welke soort pagina's en of de
 * bezoeker vaker terugkwam. Zonder gegevens (geen toestemming, telefonische
 * lead) een neutrale 3, zodat die leads niet onterecht wegzakken.
 */
export function gedragPunten(l: Pick<LeadRij, 'paginas_bekeken' | 'bezochte_paden' | 'bezoeken' | 'landingspagina' | 'conversiepagina'>): { punten: number; uitleg: string; bekend: boolean } {
  const paden = (l.bezochte_paden ?? []).map((p) => p.p);
  for (const p of [l.landingspagina, l.conversiepagina]) if (p) paden.push(p);
  const n = l.paginas_bekeken ?? null;
  const bezoeken = l.bezoeken ?? null;
  if (n == null && bezoeken == null && !(l.bezochte_paden ?? []).length) {
    return { punten: 3, uitleg: 'geen surfgedrag bekend', bekend: false };
  }
  let punten = 0;
  const waarom: string[] = [];
  if (n != null) {
    const p = n >= 8 ? 4 : n >= 4 ? 3 : n >= 2 ? 1 : 0;
    punten += p;
    waarom.push(`${n} pagina${n === 1 ? '' : "'s"} (+${p})`);
  }
  const soorten = new Set(paden.map(padSoort));
  if (soorten.has('prijs')) { punten += 3; waarom.push('offerte- of prijspagina (+3)'); }
  if (soorten.has('assortiment')) { punten += 3; waarom.push('assortiment bekeken (+3)'); }
  if (soorten.has('configurator')) { punten += 3; waarom.push('configurator of kledingadvies (+3)'); }
  if (bezoeken != null && bezoeken >= 2) {
    const p = bezoeken >= 3 ? 4 : 3;
    punten += p;
    waarom.push(`${bezoeken}e bezoek (+${p})`);
  }
  return { punten: Math.min(15, punten), uitleg: waarom.length ? waarom.join(', ') : 'kort rondgekeken', bekend: true };
}

/**
 * Leadscore 0-100, zoals HubSpot "fit" en "engagement" scheidt:
 * - Past bij ons (65): teamgrootte 25, branche 15, volledigheid 10, concreetheid 15.
 * - Gedrag op de site (15): pagina's, prijs-/assortiment-/configuratorpagina's, terugkerend bezoek.
 * - Timing (20): recentheid 10, reactie 10.
 * Bewust simpel en uitlegbaar: de detailpagina toont elk onderdeel met de punten.
 */
export function berekenScore(l: LeadRij, ctx: ScoreContext): LeadScore {
  const nu = ctx.nu ?? new Date();
  const aanvraag = ontleedAanvraag(l.bericht);
  const delen: ScoreDeel[] = [];

  const team = teamGrootte(l.aantal);
  const teamPunten = team == null ? 4 : team >= 50 ? 25 : team >= 25 ? 22 : team >= 10 ? 17 : team >= 5 ? 11 : team >= 2 ? 6 : 3;
  delen.push({ label: 'Bedrijfsgrootte', punten: teamPunten, max: 25, uitleg: team == null ? 'niet opgegeven' : `ongeveer ${team} medewerkers` });

  const branche = String(l.branche ?? '');
  const branchePunten = !branche ? 3 : KERN_BRANCHES.test(branche) ? 15 : GOEDE_BRANCHES.test(branche) ? 11 : 6;
  delen.push({ label: 'Branche', punten: branchePunten, max: 15, uitleg: branche || 'niet opgegeven' });

  let vol = 0;
  const mist: string[] = [];
  if (telLink(l.phone)) vol += 4; else mist.push('telefoon');
  if (String(l.company ?? '').trim()) vol += 3; else mist.push('bedrijf');
  if (heeftEmail(l.email)) vol += 1; else mist.push('e-mail');
  if (branche) vol += 1;
  if (team != null) vol += 1;
  delen.push({ label: 'Volledigheid', punten: vol, max: 10, uitleg: mist.length ? `mist ${mist.join(', ')}` : 'alles ingevuld' });

  let concreet = 0;
  const waarom: string[] = [];
  const stuks = Math.max(ctx.aantalRegels ?? 0, aanvraag.stukken.length);
  if (aanvraag.passenOpLocatie) { concreet += 6; waarom.push('passen op locatie (+6)'); }
  if (stuks) {
    const p = stuks >= 3 ? 6 : 4;
    concreet += p;
    waarom.push(`${stuks} artikel${stuks === 1 ? '' : 'en'} gekozen (+${p})`);
  }
  if (ctx.logoAangeleverd || aanvraag.logoAangeleverd) { concreet += 2; waarom.push('logo aangeleverd (+2)'); }
  if (aanvraag.soort === 'vrij' && !stuks && String(l.bericht ?? '').trim().length > 30) { concreet += 3; waarom.push('duidelijke vraag (+3)'); }
  concreet = Math.min(15, concreet);
  delen.push({ label: 'Concreetheid', punten: concreet, max: 15, uitleg: waarom.length ? waarom.join(', ') : 'nog vaag' });

  const gedrag = gedragPunten(l);
  delen.push({ label: 'Gedrag op de site', punten: gedrag.punten, max: 15, uitleg: gedrag.uitleg });

  const dagen = urenTussen(l.created_at, nu) / 24;
  const recent = dagen <= 2 ? 10 : dagen <= 7 ? 7 : dagen <= 14 ? 4 : dagen <= 30 ? 2 : 0;
  delen.push({ label: 'Recentheid', punten: recent, max: 10, uitleg: `${duurKort(dagen * 24)} geleden binnen` });

  let reactie = 0;
  let reactieUitleg = '';
  if (ctx.klantReageerde) { reactie = 10; reactieUitleg = 'klant reageerde zelf'; }
  else if (ctx.eersteContact) {
    const uren = urenTussen(l.created_at, new Date(ctx.eersteContact));
    reactie = uren <= 24 ? 6 : 3;
    reactieUitleg = `wij reageerden binnen ${duurKort(uren)}`;
  } else if (dagen * 24 < 24) { reactie = 5; reactieUitleg = 'nog vers, bel vandaag'; }
  else { reactie = 0; reactieUitleg = 'nog geen contact'; }
  delen.push({ label: 'Reactie', punten: reactie, max: 10, uitleg: reactieUitleg });

  const totaal = Math.max(0, Math.min(100, delen.reduce((t, d) => t + d.punten, 0)));
  return { totaal, delen };
}

export function scoreNiveau(score: number): 'hoog' | 'midden' | 'laag' {
  return score >= 65 ? 'hoog' : score >= 40 ? 'midden' : 'laag';
}

/* ------------------------------------------------------------------ */
/* Opvolging                                                           */
/* ------------------------------------------------------------------ */

export type OpvolgStand = 'verlopen' | 'vandaag' | 'gepland' | 'geen';

export function opvolgStand(opvolgdatum: string | null | undefined, vandaag: string): OpvolgStand {
  if (!opvolgdatum) return 'geen';
  const d = opvolgdatum.slice(0, 10);
  if (d < vandaag) return 'verlopen';
  if (d === vandaag) return 'vandaag';
  return 'gepland';
}

/** Na zoveel uur zonder contact wordt de wacht-timer rood (de website belooft terugbellen binnen 24 uur). */
export const WACHT_GRENS_UREN = 24;

/**
 * Wanneer moet een nieuwe webaanvraag opgevolgd zijn? Binnen werktijden (ma-vr):
 * - voor 10:00 binnen: vandaag 10:00;
 * - tussen 10:00 en 16:00: vandaag, een uur later (op het halve uur naar boven);
 * - na 16:00, in het weekend: de volgende werkdag 10:00.
 * Feestdagen telt dit niet; dan schuift Jessi de taak zelf door.
 */
export function opvolgMoment(nu: Date = new Date()): { datum: string; tijd: string } {
  const delen = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(nu);
  const deel = (t: string) => delen.find((d) => d.type === t)?.value ?? '';
  const datum = `${deel('year')}-${deel('month')}-${deel('day')}`;
  const minuten = Number(deel('hour')) * 60 + Number(deel('minute'));
  const werkdag = !['Sat', 'Sun'].includes(deel('weekday'));
  const pad = (n: number) => String(n).padStart(2, '0');
  if (werkdag && minuten < 10 * 60) return { datum, tijd: '10:00' };
  if (werkdag && minuten < 16 * 60) {
    const doel = Math.ceil((minuten + 60) / 30) * 30;
    return { datum, tijd: `${pad(Math.floor(doel / 60))}:${pad(doel % 60)}` };
  }
  // Volgende werkdag.
  const d = new Date(`${datum}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return { datum: d.toISOString().slice(0, 10), tijd: '10:00' };
}
