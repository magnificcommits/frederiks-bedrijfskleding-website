/**
 * Het flowmodel van een campagne: een verticale reeks stappen, met splitsingen
 * die twee takken hebben (ja/nee). Na een splitsing komen beide takken weer
 * samen, tenzij een tak met een eindstap stopt. Zo werkt het ook in
 * ActiveCampaign en HubSpot, en het blijft op één scherm te overzien.
 *
 * PUUR: geen server-imports. De flowbouwer (client) en de verzendmotor
 * (server) gebruiken dezelfde functies.
 */

/* ------------------------------------------------------------------ */
/* Stappen                                                             */
/* ------------------------------------------------------------------ */

export type MailStijl = 'persoonlijk' | 'huisstijl' | 'nieuwsbrief';

export type MailKnoop = {
  id: string;
  type: 'mail';
  onderwerp: string;
  preheader: string;
  /** Tekst met lichte opmaak: **vet**, _cursief_, [tekst](url), [knop: tekst](url), "- " voor opsommingen. */
  inhoud: string;
  stijl: MailStijl;
  /** Bij stijl 'nieuwsbrief': id van een ontwerp uit de nieuwsbrief-editor. */
  nieuwsbriefId: string | null;
  /** {{ai}} vervangen door een AI-openingszin per ontvanger. */
  ai: boolean;
};

export type WachtModus = 'dagen' | 'uren' | 'weekdag';
export type WachtKnoop = {
  id: string;
  type: 'wacht';
  modus: WachtModus;
  aantal: number;
  /** 1 = maandag … 7 = zondag (modus 'weekdag'). */
  weekdag: number;
};

export const CONDITIE_SOORTEN = ['geopend', 'geklikt', 'gescand', 'gereageerd', 'branche', 'plaats', 'status', 'tag'] as const;
export type ConditieSoort = (typeof CONDITIE_SOORTEN)[number];

export type VoorwaardeKnoop = {
  id: string;
  type: 'voorwaarde';
  soort: ConditieSoort;
  /** Bij geopend/geklikt: welke mailstap. null = een willekeurige mail uit deze campagne. */
  mailId: string | null;
  /** Bij branche/plaats/status/tag: de waarde (branche en plaats mogen meerdere, komma-gescheiden). */
  waarde: string;
  ja: Knoop[];
  nee: Knoop[];
};

export type TaakKnoop = {
  id: string;
  type: 'taak';
  titel: string;
  omschrijving: string;
  persoonId: string | null;
  /** Deadline: zoveel werkdagen na het moment dat de stap wordt uitgevoerd. */
  binnenDagen: number;
  prioriteit: 'laag' | 'normaal' | 'hoog';
};

export type StatusKnoop = {
  id: string;
  type: 'status';
  /** Nieuwe status als de ontvanger een prospect is. Leeg = niet wijzigen. */
  prospectStatus: string;
  /** Nieuwe status als de ontvanger een lead is. Leeg = niet wijzigen. */
  leadStatus: string;
};

export type TagKnoop = { id: string; type: 'tag'; tag: string; actie: 'toevoegen' | 'verwijderen' };
export type EindeKnoop = { id: string; type: 'einde' };

export type Knoop = MailKnoop | WachtKnoop | VoorwaardeKnoop | TaakKnoop | StatusKnoop | TagKnoop | EindeKnoop;
export type KnoopType = Knoop['type'];

export type Flow = { versie: 1; stappen: Knoop[] };

export const KNOOP_TYPEN: { type: KnoopType; label: string; uitleg: string }[] = [
  { type: 'mail', label: 'Mail sturen', uitleg: 'Een persoonlijke mail of een nieuwsbriefontwerp.' },
  { type: 'wacht', label: 'Wachten', uitleg: 'Dagen, uren of tot een bepaalde weekdag.' },
  { type: 'voorwaarde', label: 'Splitsen', uitleg: 'Ja of nee: geopend, geklikt, gescand, branche …' },
  { type: 'taak', label: 'Taak voor Jessi', uitleg: 'Bellen, langsgaan of offerte maken.' },
  { type: 'status', label: 'Status wijzigen', uitleg: 'Zet de prospect of lead op een andere status.' },
  { type: 'tag', label: 'Tag', uitleg: 'Label toevoegen of weghalen, om later op te splitsen.' },
  { type: 'einde', label: 'Einde', uitleg: 'Hier stopt de campagne voor deze persoon.' },
];

export const WEEKDAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

export const CONDITIE_LABEL: Record<ConditieSoort, string> = {
  geopend: 'Mail geopend',
  geklikt: 'Op een link geklikt',
  gescand: 'QR-code gescand',
  gereageerd: 'Heeft gereageerd',
  branche: 'Branche is',
  plaats: 'Plaats is',
  status: 'Status is',
  tag: 'Heeft tag',
};

export function nieuwId(): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `k${Date.now().toString(36).slice(-5)}${r}`;
}

export function nieuweKnoop(type: KnoopType): Knoop {
  const id = nieuwId();
  switch (type) {
    case 'mail':
      return { id, type, onderwerp: '', preheader: '', inhoud: 'Hoi {{voornaam}},\n\n\n\nGroet,\nJessi', stijl: 'persoonlijk', nieuwsbriefId: null, ai: false };
    case 'wacht':
      return { id, type, modus: 'dagen', aantal: 3, weekdag: 2 };
    case 'voorwaarde':
      return { id, type, soort: 'geopend', mailId: null, waarde: '', ja: [], nee: [] };
    case 'taak':
      return { id, type, titel: 'Bel {{bedrijfsnaam}}', omschrijving: '', persoonId: null, binnenDagen: 1, prioriteit: 'normaal' };
    case 'status':
      return { id, type, prospectStatus: '', leadStatus: '' };
    case 'tag':
      return { id, type, tag: '', actie: 'toevoegen' };
    default:
      return { id, type: 'einde' };
  }
}

/* ------------------------------------------------------------------ */
/* Normaliseren (alles wat uit de database of het formulier komt)      */
/* ------------------------------------------------------------------ */

const tekst = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const getal = (v: unknown, min: number, max: number, val: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : val;
};

function normaliseerKnoop(v: unknown, diepte: number): Knoop | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = tekst(o.id, 40) || nieuwId();
  switch (o.type) {
    case 'mail':
      return {
        id,
        type: 'mail',
        onderwerp: tekst(o.onderwerp, 200),
        preheader: tekst(o.preheader, 200),
        inhoud: tekst(o.inhoud, 20000),
        stijl: o.stijl === 'huisstijl' || o.stijl === 'nieuwsbrief' ? o.stijl : 'persoonlijk',
        nieuwsbriefId: typeof o.nieuwsbriefId === 'string' && o.nieuwsbriefId ? o.nieuwsbriefId : null,
        ai: o.ai === true,
      };
    case 'wacht':
      return {
        id,
        type: 'wacht',
        modus: o.modus === 'uren' || o.modus === 'weekdag' ? o.modus : 'dagen',
        aantal: getal(o.aantal, 0, 365, 1),
        weekdag: getal(o.weekdag, 1, 7, 1),
      };
    case 'voorwaarde': {
      const soort = (CONDITIE_SOORTEN as readonly string[]).includes(String(o.soort)) ? (o.soort as ConditieSoort) : 'geopend';
      const tak = (t: unknown) => (diepte > 6 || !Array.isArray(t) ? [] : t.map((k) => normaliseerKnoop(k, diepte + 1)).filter((k): k is Knoop => !!k));
      return { id, type: 'voorwaarde', soort, mailId: typeof o.mailId === 'string' && o.mailId ? o.mailId : null, waarde: tekst(o.waarde, 300), ja: tak(o.ja), nee: tak(o.nee) };
    }
    case 'taak':
      return {
        id,
        type: 'taak',
        titel: tekst(o.titel, 200),
        omschrijving: tekst(o.omschrijving, 2000),
        persoonId: typeof o.persoonId === 'string' && o.persoonId ? o.persoonId : null,
        binnenDagen: getal(o.binnenDagen, 0, 60, 1),
        prioriteit: o.prioriteit === 'laag' || o.prioriteit === 'hoog' ? o.prioriteit : 'normaal',
      };
    case 'status':
      return { id, type: 'status', prospectStatus: tekst(o.prospectStatus, 40), leadStatus: tekst(o.leadStatus, 40) };
    case 'tag':
      return { id, type: 'tag', tag: tekst(o.tag, 60).trim(), actie: o.actie === 'verwijderen' ? 'verwijderen' : 'toevoegen' };
    case 'einde':
      return { id, type: 'einde' };
    default:
      return null;
  }
}

export function normaliseerFlow(v: unknown): Flow {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const stappen = Array.isArray(o.stappen) ? o.stappen.map((k) => normaliseerKnoop(k, 0)).filter((k): k is Knoop => !!k) : [];
  // Dubbele ids (bv. na kopiëren) maken de motor onbetrouwbaar: maak ze uniek.
  const gezien = new Set<string>();
  const uniek = (lijst: Knoop[]): Knoop[] =>
    lijst.map((k) => {
      const id = gezien.has(k.id) ? nieuwId() : k.id;
      gezien.add(id);
      return k.type === 'voorwaarde' ? { ...k, id, ja: uniek(k.ja), nee: uniek(k.nee) } : { ...k, id };
    });
  return { versie: 1, stappen: uniek(stappen) };
}

/**
 * Markering voor "na de laatste stap". Nodig als een flow eindigt met een
 * wachtstap: dan moet de motor na het wachten afronden, niet opnieuw beginnen.
 */
export const EINDE_KNOOP = '__einde';

export function leegFlow(): Flow {
  return { versie: 1, stappen: [] };
}

/**
 * Oude campagnes hadden een platte lijst stappen (wachttijd in dagen + mail).
 * Die zetten we om naar een flow. De mailknoop krijgt het id van de oude stap,
 * zodat lopende inschrijvingen (huidige_stap = index) terug te vinden zijn.
 */
export function flowUitLegacy(stappen: { id: string; volgorde: number; wacht_dagen: number; onderwerp: string; body: string; ai_personaliseer: boolean }[]): Flow {
  const lijst: Knoop[] = [];
  [...stappen]
    .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0))
    .forEach((s, i) => {
      if (i > 0 && (Number(s.wacht_dagen) || 0) > 0) lijst.push({ id: `w-${s.id}`, type: 'wacht', modus: 'dagen', aantal: Number(s.wacht_dagen), weekdag: 1 });
      lijst.push({
        id: s.id,
        type: 'mail',
        onderwerp: s.onderwerp ?? '',
        preheader: '',
        inhoud: s.body ?? '',
        stijl: 'persoonlijk',
        nieuwsbriefId: null,
        ai: Boolean(s.ai_personaliseer),
      });
    });
  return { versie: 1, stappen: lijst };
}

/* ------------------------------------------------------------------ */
/* Navigeren door de boom                                              */
/* ------------------------------------------------------------------ */

type PadStuk = { lijst: Knoop[]; index: number };

function zoekPad(lijst: Knoop[], id: string, pad: PadStuk[] = []): PadStuk[] | null {
  for (let i = 0; i < lijst.length; i++) {
    const k = lijst[i];
    const hier = [...pad, { lijst, index: i }];
    if (k.id === id) return hier;
    if (k.type === 'voorwaarde') {
      const ja = zoekPad(k.ja, id, hier);
      if (ja) return ja;
      const nee = zoekPad(k.nee, id, hier);
      if (nee) return nee;
    }
  }
  return null;
}

export function vindKnoop(flow: Flow, id: string | null | undefined): Knoop | null {
  if (!id) return null;
  const pad = zoekPad(flow.stappen, id);
  if (!pad) return null;
  const laatste = pad[pad.length - 1];
  return laatste.lijst[laatste.index];
}

/**
 * De stap die na `id` komt. Aan het eind van een tak gaat het verder met de stap
 * na de splitsing (de takken komen weer samen). null = einde van de flow.
 */
export function volgendeNa(flow: Flow, id: string): string | null {
  const pad = zoekPad(flow.stappen, id);
  if (!pad) return null;
  for (let d = pad.length - 1; d >= 0; d--) {
    const { lijst, index } = pad[d];
    if (index + 1 < lijst.length) return lijst[index + 1].id;
  }
  return null;
}

/** Eerste stap van een tak; is de tak leeg, dan de stap na de splitsing. */
export function begintak(flow: Flow, splitsing: VoorwaardeKnoop, ja: boolean): string | null {
  const tak = ja ? splitsing.ja : splitsing.nee;
  return tak.length ? tak[0].id : volgendeNa(flow, splitsing.id);
}

export function alleKnopen(lijst: Knoop[]): Knoop[] {
  const uit: Knoop[] = [];
  for (const k of lijst) {
    uit.push(k);
    if (k.type === 'voorwaarde') uit.push(...alleKnopen(k.ja), ...alleKnopen(k.nee));
  }
  return uit;
}

export function mailKnopen(flow: Flow): MailKnoop[] {
  return alleKnopen(flow.stappen).filter((k): k is MailKnoop => k.type === 'mail');
}

/* ------------------------------------------------------------------ */
/* Bewerken (onveranderlijk, voor de flowbouwer)                        */
/* ------------------------------------------------------------------ */

/** Plek om iets in te voegen: in de hoofdlijn (ouderId null) of in een tak van een splitsing. */
export type Plek = { ouderId: string | null; tak: 'ja' | 'nee' | null; index: number };

export function voegIn(lijst: Knoop[], plek: Plek, knoop: Knoop): Knoop[] {
  if (plek.ouderId === null) {
    const kopie = [...lijst];
    kopie.splice(Math.max(0, Math.min(plek.index, kopie.length)), 0, knoop);
    return kopie;
  }
  return lijst.map((k) => {
    if (k.type !== 'voorwaarde') return k;
    if (k.id === plek.ouderId && plek.tak) {
      const tak = [...k[plek.tak]];
      tak.splice(Math.max(0, Math.min(plek.index, tak.length)), 0, knoop);
      return { ...k, [plek.tak]: tak };
    }
    return { ...k, ja: voegIn(k.ja, plek, knoop), nee: voegIn(k.nee, plek, knoop) };
  });
}

export function verwijderKnoop(lijst: Knoop[], id: string): Knoop[] {
  return lijst
    .filter((k) => k.id !== id)
    .map((k) => (k.type === 'voorwaarde' ? { ...k, ja: verwijderKnoop(k.ja, id), nee: verwijderKnoop(k.nee, id) } : k));
}

export function werkKnoopBij(lijst: Knoop[], id: string, patch: Partial<Knoop>): Knoop[] {
  return lijst.map((k) => {
    if (k.id === id) return { ...k, ...patch, id: k.id, type: k.type } as Knoop;
    if (k.type === 'voorwaarde') return { ...k, ja: werkKnoopBij(k.ja, id, patch), nee: werkKnoopBij(k.nee, id, patch) };
    return k;
  });
}

/** Verplaats een stap één plek omhoog of omlaag binnen zijn eigen lijst. */
export function verschuifKnoop(lijst: Knoop[], id: string, richting: -1 | 1): Knoop[] {
  const i = lijst.findIndex((k) => k.id === id);
  if (i >= 0) {
    const j = i + richting;
    if (j < 0 || j >= lijst.length) return lijst;
    const kopie = [...lijst];
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    return kopie;
  }
  return lijst.map((k) => (k.type === 'voorwaarde' ? { ...k, ja: verschuifKnoop(k.ja, id, richting), nee: verschuifKnoop(k.nee, id, richting) } : k));
}

/** Kopie met nieuwe ids (ook in de takken). */
export function kloonKnoop(k: Knoop): Knoop {
  if (k.type === 'voorwaarde') return { ...k, id: nieuwId(), ja: k.ja.map(kloonKnoop), nee: k.nee.map(kloonKnoop) };
  return { ...k, id: nieuwId() };
}

/* ------------------------------------------------------------------ */
/* Omschrijvingen                                                      */
/* ------------------------------------------------------------------ */

export function wachtOmschrijving(k: WachtKnoop): string {
  if (k.modus === 'weekdag') return `Wacht tot ${WEEKDAGEN[(k.weekdag - 1 + 7) % 7]}`;
  if (k.modus === 'uren') return `Wacht ${k.aantal} ${k.aantal === 1 ? 'uur' : 'uur'}`;
  return `Wacht ${k.aantal} ${k.aantal === 1 ? 'dag' : 'dagen'}`;
}

export function voorwaardeOmschrijving(k: VoorwaardeKnoop, flow?: Flow): string {
  const label = CONDITIE_LABEL[k.soort];
  if (k.soort === 'geopend' || k.soort === 'geklikt') {
    if (!k.mailId || !flow) return `${label} (een mail uit deze campagne)?`;
    const m = vindKnoop(flow, k.mailId);
    const onderwerp = m && m.type === 'mail' ? m.onderwerp || 'naamloze mail' : 'verwijderde mail';
    return `${label}: "${onderwerp}"?`;
  }
  if (k.soort === 'gescand') return 'QR-code gescand sinds de inschrijving?';
  if (k.soort === 'gereageerd') return 'Heeft gereageerd?';
  return `${label} ${k.waarde || '…'}?`;
}

export function knoopTitel(k: Knoop, flow?: Flow): string {
  switch (k.type) {
    case 'mail':
      return k.onderwerp || 'Mail zonder onderwerp';
    case 'wacht':
      return wachtOmschrijving(k);
    case 'voorwaarde':
      return voorwaardeOmschrijving(k, flow);
    case 'taak':
      return k.titel || 'Taak';
    case 'status':
      return [k.prospectStatus && `prospect: ${k.prospectStatus}`, k.leadStatus && `lead: ${k.leadStatus}`].filter(Boolean).join(', ') || 'Status wijzigen';
    case 'tag':
      return `${k.actie === 'verwijderen' ? 'Tag weghalen' : 'Tag toevoegen'}: ${k.tag || '…'}`;
    default:
      return 'Einde campagne';
  }
}

/** Problemen die verzenden in de weg zitten. Leeg = in orde. */
export function controleerFlow(flow: Flow): { id: string | null; tekst: string }[] {
  const uit: { id: string | null; tekst: string }[] = [];
  const alle = alleKnopen(flow.stappen);
  if (!alle.some((k) => k.type === 'mail')) uit.push({ id: null, tekst: 'De campagne heeft nog geen mail.' });
  for (const k of alle) {
    if (k.type === 'mail') {
      if (!k.onderwerp.trim()) uit.push({ id: k.id, tekst: 'Een mail heeft nog geen onderwerp.' });
      if (k.stijl === 'nieuwsbrief' && !k.nieuwsbriefId) uit.push({ id: k.id, tekst: `"${k.onderwerp || 'Mail'}": kies een nieuwsbriefontwerp.` });
      if (k.stijl !== 'nieuwsbrief' && !k.inhoud.trim()) uit.push({ id: k.id, tekst: `"${k.onderwerp || 'Mail'}" is nog leeg.` });
    }
    if (k.type === 'voorwaarde' && ['branche', 'plaats', 'status', 'tag'].includes(k.soort) && !k.waarde.trim()) {
      uit.push({ id: k.id, tekst: 'Een splitsing mist de waarde om op te controleren.' });
    }
    if (k.type === 'voorwaarde' && k.mailId && !alle.some((m) => m.id === k.mailId)) {
      uit.push({ id: k.id, tekst: 'Een splitsing verwijst naar een mail die niet meer bestaat.' });
    }
    if (k.type === 'tag' && !k.tag.trim()) uit.push({ id: k.id, tekst: 'Een tagstap heeft nog geen tag.' });
    if (k.type === 'taak' && !k.titel.trim()) uit.push({ id: k.id, tekst: 'Een taak heeft nog geen titel.' });
  }
  return uit;
}

/* ------------------------------------------------------------------ */
/* Triggers, doelgroep en doel                                         */
/* ------------------------------------------------------------------ */

export const DOELGROEPEN = ['prospect', 'lead', 'klant'] as const;
export type Doelgroep = (typeof DOELGROEPEN)[number];
export const DOELGROEP_LABEL: Record<Doelgroep, string> = { prospect: 'Prospects', lead: 'Leads', klant: 'Klanten' };

export const TRIGGER_SOORTEN = [
  'handmatig',
  'lead_nieuw',
  'qr_scan',
  'prospect_status',
  'klant_nieuw',
  'klant_slapend',
  'klant_jubileum',
  'order_geleverd',
  'spaar_bijna',
] as const;
export type TriggerSoort = (typeof TRIGGER_SOORTEN)[number];

export const TRIGGER_INFO: Record<TriggerSoort, { label: string; uitleg: string; doelgroep: Doelgroep | null }> = {
  handmatig: { label: 'Handmatig inschrijven', uitleg: 'Je kiest zelf wie erin gaat, met filters.', doelgroep: null },
  lead_nieuw: { label: 'Nieuwe lead binnen', uitleg: 'Iedere nieuwe aanvraag, eventueel alleen van één bron.', doelgroep: 'lead' },
  qr_scan: { label: 'QR-code gescand', uitleg: 'Een prospect scant de code op de brief of het kaartje.', doelgroep: 'prospect' },
  prospect_status: { label: 'Prospect krijgt status', uitleg: 'Bijvoorbeeld iedereen die op "geinteresseerd" staat.', doelgroep: 'prospect' },
  klant_nieuw: { label: 'Nieuwe klant', uitleg: 'Een organisatie die net klant is geworden.', doelgroep: 'klant' },
  klant_slapend: { label: 'Klant bestelt niet meer', uitleg: 'Geen order sinds een aantal maanden.', doelgroep: 'klant' },
  klant_jubileum: { label: 'Klantjubileum', uitleg: 'Op de dag dat iemand een jaar (of langer) klant is.', doelgroep: 'klant' },
  order_geleverd: { label: 'Order geleverd', uitleg: 'Een order staat op verzonden, factureren of afgerond.', doelgroep: 'klant' },
  spaar_bijna: { label: 'Bijna volgend spaarniveau', uitleg: 'Klant zit vlak onder het volgende spaarniveau of een puntengrens.', doelgroep: 'klant' },
};

export type Trigger = {
  soort: TriggerSoort;
  /** Voor lead_nieuw: alleen leads waarvan de bron dit bevat. Leeg = alle. */
  bron: string;
  /** Voor prospect_status. */
  status: string;
  /** Voor klant_slapend. */
  maanden: number;
  /** Voor spaar_bijna: 'niveau' = dicht bij het volgende spaarniveau, 'punten' = saldo net onder een puntengrens. */
  spaarModus: 'niveau' | 'punten';
  /** Modus niveau: vanaf hoeveel procent op weg naar het volgende niveau. */
  niveauPct: number;
  /** Modus punten: de grens en hoe ver eronder iemand mag zitten. */
  drempel: number;
  marge: number;
  /** Optioneel extra filter op branche (komma-gescheiden). */
  branche: string;
  /** Mag iemand er later nog een keer in? */
  herhalen: boolean;
  herhaalNaDagen: number;
};

export function standaardTrigger(soort: TriggerSoort = 'handmatig'): Trigger {
  return { soort, bron: '', status: '', maanden: 6, spaarModus: 'niveau', niveauPct: 80, drempel: 1000, marge: 150, branche: '', herhalen: soort === 'klant_jubileum' || soort === 'order_geleverd', herhaalNaDagen: soort === 'klant_jubileum' ? 300 : 60 };
}

export function normaliseerTrigger(v: unknown): Trigger {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const soort = (TRIGGER_SOORTEN as readonly string[]).includes(String(o.soort)) ? (o.soort as TriggerSoort) : 'handmatig';
  const basis = standaardTrigger(soort);
  return {
    soort,
    bron: tekst(o.bron, 100).trim(),
    status: tekst(o.status, 40).trim(),
    maanden: getal(o.maanden, 1, 36, basis.maanden),
    spaarModus: o.spaarModus === 'punten' ? 'punten' : 'niveau',
    niveauPct: getal(o.niveauPct, 50, 99, basis.niveauPct),
    drempel: getal(o.drempel, 1, 1_000_000, basis.drempel),
    marge: getal(o.marge, 1, 1_000_000, basis.marge),
    branche: tekst(o.branche, 200).trim(),
    herhalen: typeof o.herhalen === 'boolean' ? o.herhalen : basis.herhalen,
    herhaalNaDagen: getal(o.herhaalNaDagen, 1, 3650, basis.herhaalNaDagen),
  };
}

export function triggerOmschrijving(t: Trigger): string {
  switch (t.soort) {
    case 'lead_nieuw':
      return t.bron ? `Nieuwe lead via "${t.bron}"` : 'Iedere nieuwe lead';
    case 'prospect_status':
      return `Prospect met status "${t.status || '…'}"`;
    case 'klant_slapend':
      return `Klant zonder order sinds ${t.maanden} maanden`;
    case 'spaar_bijna':
      return t.spaarModus === 'niveau'
        ? `Minstens ${t.niveauPct}% op weg naar het volgende spaarniveau`
        : `Spaarsaldo tussen ${Math.max(0, t.drempel - t.marge)} en ${t.drempel} punten`;
    default:
      return TRIGGER_INFO[t.soort].label;
  }
}

export const DOEL_SOORTEN = ['afspraak', 'klant', 'gereageerd', 'offerte', 'order'] as const;
export type DoelSoort = (typeof DOEL_SOORTEN)[number];
export const DOEL_LABEL: Record<DoelSoort, string> = {
  afspraak: 'Er is een afspraak gemaakt',
  klant: 'Is klant geworden',
  gereageerd: 'Heeft gereageerd',
  offerte: 'Lead staat op offerte of akkoord',
  order: 'Klant heeft besteld',
};

export type Doel = { soorten: DoelSoort[] };

export function normaliseerDoel(v: unknown): Doel {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const soorten = Array.isArray(o.soorten) ? o.soorten.filter((s): s is DoelSoort => (DOEL_SOORTEN as readonly string[]).includes(String(s))) : [];
  return { soorten: Array.from(new Set(soorten)) };
}

/* ------------------------------------------------------------------ */
/* Statussen                                                           */
/* ------------------------------------------------------------------ */

export const INSCHRIJVING_STATUS_LABEL: Record<string, string> = {
  actief: 'In de flow',
  klaar: 'Doorlopen',
  doel: 'Doel bereikt',
  afgemeld: 'Afgemeld',
  gestopt: 'Gestopt',
  gebounced: 'Adres werkt niet',
};

export const CAMPAGNE_STATUS_LABEL: Record<string, string> = {
  concept: 'Concept',
  actief: 'Actief',
  gepauzeerd: 'Gepauzeerd',
  afgerond: 'Afgerond',
};
