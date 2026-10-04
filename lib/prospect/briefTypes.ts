/**
 * Datamodel van een geprinte kennismakingsbrief (kolom `brief_batches.ontwerp` en
 * `brief_templates.ontwerp`, jsonb).
 *
 * Waarom geen nieuwsbrief-ontwerp: een brief is één A4 op papier. Er zijn geen
 * kolommen die op een telefoon stapelen, geen webversie- of afmeldregel, en wel
 * vaste plekken die de post voorschrijft (adresvenster, afzenderregel). Maten zijn
 * daarom millimeters en punten, geen pixels. De blokken lopen van boven naar
 * beneden onder het briefhoofd; een flexibele witruimte duwt de rest naar onderen.
 *
 * Dit bestand is puur (geen server-imports): editor en printweergave gebruiken het.
 */

export const BRIEF_VERSIE = 1 as const;

export type Uitlijning = 'links' | 'midden' | 'rechts';

export const BRIEF_LETTERTYPEN = {
  huisstijl: { label: 'Huisstijl (site-letter)', stack: 'var(--font-body), Arial, sans-serif' },
  arial: { label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  georgia: { label: 'Georgia', stack: 'Georgia, Times, serif' },
  verdana: { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
} as const;
export type BriefLettertype = keyof typeof BRIEF_LETTERTYPEN;

/**
 * - venster: briefhoofd rechtsboven, afzenderregel en adres op de plek van het
 *   venster links (venster-envelop DL/C5), tekst begint op 98 mm.
 * - compact: alleen een smal briefhoofd bovenaan, geen adres. Voor brieven die je
 *   zelf afgeeft of in een envelop met etiket stopt.
 * - geen: een leeg vel, alles komt uit de blokken.
 */
export type Briefhoofd = 'venster' | 'compact' | 'geen';

export type BriefInstellingen = {
  lettertype: BriefLettertype;
  /** Basisgrootte van de tekst in punten (9 tot 12). */
  lettergrootte: number;
  tekstkleur: string;
  /** Accentkleur voor koppen-als-balk, kaders en de voetbalk. */
  accent: string;
  /** Linker- en rechtermarge in mm (15 tot 25). */
  marge: number;
  briefhoofd: Briefhoofd;
  /** Donkere balk onderaan met naam, telefoon, e-mail en KvK. */
  voetbalk: boolean;
};

type Basis = {
  id: string;
  /** Ruimte boven het blok in mm. */
  boven: number;
};

export type BetreftBlok = Basis & {
  type: 'betreft';
  /** Plaats en datum, bv. "Hengelo Gld, {{datum}}". Leeg = niet tonen. */
  plaatsDatum: string;
  /** Betreft-regel, vet. Leeg = niet tonen. */
  betreft: string;
};

export type KopBlok = Basis & {
  type: 'kop';
  tekst: string;
  /** Grootte in punten. */
  grootte: number;
  /** '' = tekstkleur. */
  kleur: string;
  uitlijning: Uitlijning;
  /** Als balk in de accentkleur met witte tekst. */
  balk: boolean;
};

export type TekstBlok = Basis & {
  type: 'tekst';
  /**
   * Platte tekst. Lege regel = nieuwe alinea, enkele regel = regelovergang,
   * **zo** = vet. Velden als {{bedrijf}} worden per prospect ingevuld.
   */
  tekst: string;
  /** Grootte in punten; null = basisgrootte. */
  grootte: number | null;
  uitlijning: Uitlijning;
};

export type LogoBlok = Basis & {
  type: 'logo';
  /** Hoogte in mm. */
  hoogte: number;
  uitlijning: Uitlijning;
};

export type AfbeeldingBlok = Basis & {
  type: 'afbeelding';
  /** https-url of pad onder /public. */
  src: string;
  alt: string;
  /** Hoogte in mm; de breedte volgt. */
  hoogte: number;
  uitlijning: Uitlijning;
  onderschrift: string;
};

export type MockupsBlok = Basis & {
  type: 'mockups';
  /** Hoeveel artikelen van de prospect (1 tot 4). */
  aantal: number;
  /** Breedte en hoogte van één foto in mm. */
  grootte: number;
  namen: boolean;
  uitlijning: Uitlijning;
};

export type QrBlok = Basis & {
  type: 'qr';
  kop: string;
  tekst: string;
  /** Zijde van de QR-code in mm (22 tot 50). */
  grootte: number;
  /** De korte link onder de tekst, voor wie niet kan scannen. */
  toonUrl: boolean;
  uitlijning: Uitlijning;
  /** 0 tot 3 kledingfoto's links van de QR-code, op één regel. */
  kledingErnaast: number;
  /** Een dun kader in de accentkleur om de QR-code met tekst. */
  kader: boolean;
};

export type HandtekeningBlok = Basis & {
  type: 'handtekening';
  groet: string;
  naam: string;
  functie: string;
  /** script = naam in handschriftletter; afbeelding = gescande handtekening; geen = alleen tekst. */
  stijl: 'script' | 'afbeelding' | 'geen';
  afbeelding: string;
};

export type VoettekstBlok = Basis & {
  type: 'voettekst';
  tekst: string;
  grootte: number;
  uitlijning: Uitlijning;
};

export type LijnBlok = Basis & {
  type: 'lijn';
  /** '' = lichte lijnkleur. */
  kleur: string;
  /** Dikte in punten. */
  dikte: number;
};

export type RuimteBlok = Basis & {
  type: 'ruimte';
  /** Vaste hoogte in mm (als vul uit staat). */
  hoogte: number;
  /** Vult de vrije ruimte: alles hieronder komt onderaan het vel. */
  vul: boolean;
};

export type BriefBlok =
  | BetreftBlok
  | KopBlok
  | TekstBlok
  | LogoBlok
  | AfbeeldingBlok
  | MockupsBlok
  | QrBlok
  | HandtekeningBlok
  | VoettekstBlok
  | LijnBlok
  | RuimteBlok;

export type BriefBlokType = BriefBlok['type'];

export type BriefOntwerp = {
  versie: typeof BRIEF_VERSIE;
  instellingen: BriefInstellingen;
  blokken: BriefBlok[];
};

export const BRIEF_BLOKTYPEN: { type: BriefBlokType; label: string; uitleg: string }[] = [
  { type: 'betreft', label: 'Datum en betreft', uitleg: 'Plaats, datum en de vetgedrukte betreft-regel.' },
  { type: 'kop', label: 'Kop', uitleg: 'Een titel, los of als balk in de accentkleur.' },
  { type: 'tekst', label: 'Tekst', uitleg: 'De brieftekst. Lege regel is een nieuwe alinea, **vet** mag.' },
  { type: 'mockups', label: 'Kleding met logo', uitleg: 'De artikelen van de prospect, met hun eigen logo erop.' },
  { type: 'qr', label: 'QR-code', uitleg: 'De persoonlijke QR-code, eventueel met kleding ernaast.' },
  { type: 'handtekening', label: 'Handtekening', uitleg: 'Groet, naam en handtekening van Jessi.' },
  { type: 'logo', label: 'Logo Frederiks', uitleg: 'Het eigen logo, los in de brief.' },
  { type: 'afbeelding', label: 'Afbeelding', uitleg: 'Een foto, bv. van de winkel of een pasdag.' },
  { type: 'voettekst', label: 'Voettekst', uitleg: 'Kleine tekst, bv. hoe iemand zich afmeldt.' },
  { type: 'lijn', label: 'Lijn', uitleg: 'Een dunne scheidingslijn.' },
  { type: 'ruimte', label: 'Witruimte', uitleg: 'Vaste ruimte, of alles eronder naar de onderkant duwen.' },
];

/** Velden die per prospect worden ingevuld. */
export const BRIEF_VELDEN: { tag: string; uitleg: string }[] = [
  { tag: '{{bedrijf}}', uitleg: 'Bedrijfsnaam' },
  { tag: '{{contactpersoon}}', uitleg: 'Leeg wordt "t.a.v. de directie"; in de aanhef "Geachte directie"' },
  { tag: '{{plaats}}', uitleg: 'Plaats van de prospect' },
  { tag: '{{branche}}', uitleg: 'Branche, in kleine letters' },
  { tag: '{{datum}}', uitleg: 'Datum van printen, bv. 4 oktober 2026' },
];

export const BRIEF_KLEUREN = {
  charcoal: '#1c1c1c',
  oranje: '#ec6726',
  tekst: '#2a2928',
  lijn: '#e4e2e0',
} as const;

/** A4 in mm en de vaste plekken van het briefhoofd. */
export const A4 = { breedte: 210, hoogte: 297 } as const;
export const VOETBALK_MM = 9;
export function inhoudBoven(briefhoofd: Briefhoofd): number {
  return briefhoofd === 'venster' ? 98 : briefhoofd === 'compact' ? 42 : 18;
}
export function inhoudOnder(voetbalk: boolean): number {
  return voetbalk ? VOETBALK_MM + 6 : 14;
}
/** Beschikbare hoogte voor de blokken, in mm. */
export function inhoudHoogte(i: Pick<BriefInstellingen, 'briefhoofd' | 'voetbalk'>): number {
  return A4.hoogte - inhoudBoven(i.briefhoofd) - inhoudOnder(i.voetbalk);
}

/* ------------------------------------------------------------------ */
/* Standaardwaarden                                                    */
/* ------------------------------------------------------------------ */

export function briefId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function standaardInstellingen(): BriefInstellingen {
  return {
    lettertype: 'huisstijl',
    lettergrootte: 10.5,
    tekstkleur: BRIEF_KLEUREN.tekst,
    accent: BRIEF_KLEUREN.charcoal,
    marge: 20,
    briefhoofd: 'venster',
    voetbalk: true,
  };
}

export function nieuwBriefBlok<T extends BriefBlokType>(type: T): Extract<BriefBlok, { type: T }>;
export function nieuwBriefBlok(type: BriefBlokType): BriefBlok {
  const id = briefId();
  switch (type) {
    case 'betreft':
      return { id, type, boven: 0, plaatsDatum: 'Hengelo Gld, {{datum}}', betreft: 'Betreft: werkkleding voor {{bedrijf}}' };
    case 'kop':
      return { id, type, boven: 4, tekst: 'Zo ziet {{bedrijf}} eruit in werkkleding', grootte: 15, kleur: '', uitlijning: 'links', balk: false };
    case 'tekst':
      return { id, type, boven: 4, tekst: 'Beste {{contactpersoon}},\n\nSchrijf hier je tekst.', grootte: null, uitlijning: 'links' };
    case 'logo':
      return { id, type, boven: 4, hoogte: 14, uitlijning: 'links' };
    case 'afbeelding':
      return { id, type, boven: 4, src: '', alt: '', hoogte: 40, uitlijning: 'midden', onderschrift: '' };
    case 'mockups':
      return { id, type, boven: 5, aantal: 3, grootte: 40, namen: true, uitlijning: 'midden' };
    case 'qr':
      return { id, type, boven: 5, kop: 'Scan mij', tekst: 'en zie jullie logo\nop de kleding', grootte: 30, toonUrl: true, uitlijning: 'rechts', kledingErnaast: 0, kader: false };
    case 'handtekening':
      return { id, type, boven: 5, groet: 'Met vriendelijke groet,', naam: 'Jessi Frederiks', functie: 'Frederiks Bedrijfskleding', stijl: 'script', afbeelding: '' };
    case 'voettekst':
      return { id, type, boven: 3, tekst: 'Liever geen post meer van ons? Bel of mail even, dan halen we je van de lijst.', grootte: 7.5, uitlijning: 'links' };
    case 'lijn':
      return { id, type, boven: 4, kleur: '', dikte: 0.75 };
    case 'ruimte':
      return { id, type, boven: 0, hoogte: 8, vul: false };
  }
}

/* ------------------------------------------------------------------ */
/* Normaliseren (data uit de database of de editor vertrouwen we niet) */
/* ------------------------------------------------------------------ */

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const hexOf = (v: unknown, terug: string) => (isHex(v) ? v : terug);
const hexOfLeeg = (v: unknown) => (isHex(v) ? v : '');
const getal = (v: unknown, min: number, max: number, terug: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : terug;
};
const tekst = (v: unknown, max = 3000) => (typeof v === 'string' ? v.slice(0, max) : '');
const uitlijning = (v: unknown, terug: Uitlijning): Uitlijning => (v === 'links' || v === 'midden' || v === 'rechts' ? v : terug);
const bool = (v: unknown, terug: boolean) => (typeof v === 'boolean' ? v : terug);
/** Alleen https-url's en paden onder /public; geen javascript:, data: of http:. */
export function veiligeBron(v: unknown): string {
  const s = tekst(v, 1000).trim();
  if (!s) return '';
  if (/^https:\/\//i.test(s)) return s;
  if (/^\/[^/]/.test(s)) return s;
  return '';
}

function normaliseerBlok(ruw: unknown): BriefBlok | null {
  if (!ruw || typeof ruw !== 'object') return null;
  const r = ruw as Record<string, unknown>;
  const type = r.type as BriefBlokType;
  if (!BRIEF_BLOKTYPEN.some((b) => b.type === type)) return null;
  const d = nieuwBriefBlok(type) as BriefBlok & Record<string, unknown>;
  const id = typeof r.id === 'string' && r.id.length <= 80 ? r.id : d.id;
  const boven = getal(r.boven, 0, 40, d.boven);
  switch (type) {
    case 'betreft':
      return { id, type, boven, plaatsDatum: tekst(r.plaatsDatum ?? d.plaatsDatum, 200), betreft: tekst(r.betreft ?? d.betreft, 200) };
    case 'kop':
      return { id, type, boven, tekst: tekst(r.tekst, 300), grootte: getal(r.grootte, 9, 32, 15), kleur: hexOfLeeg(r.kleur), uitlijning: uitlijning(r.uitlijning, 'links'), balk: bool(r.balk, false) };
    case 'tekst':
      return { id, type, boven, tekst: tekst(r.tekst, 4000), grootte: r.grootte == null || r.grootte === '' ? null : getal(r.grootte, 7, 16, 10.5), uitlijning: uitlijning(r.uitlijning, 'links') };
    case 'logo':
      return { id, type, boven, hoogte: getal(r.hoogte, 6, 40, 14), uitlijning: uitlijning(r.uitlijning, 'links') };
    case 'afbeelding':
      return { id, type, boven, src: veiligeBron(r.src), alt: tekst(r.alt, 200), hoogte: getal(r.hoogte, 10, 150, 40), uitlijning: uitlijning(r.uitlijning, 'midden'), onderschrift: tekst(r.onderschrift, 200) };
    case 'mockups':
      return { id, type, boven, aantal: Math.round(getal(r.aantal, 1, 4, 3)), grootte: getal(r.grootte, 20, 80, 40), namen: bool(r.namen, true), uitlijning: uitlijning(r.uitlijning, 'midden') };
    case 'qr':
      return {
        id, type, boven,
        kop: tekst(r.kop, 80), tekst: tekst(r.tekst, 200), grootte: getal(r.grootte, 20, 60, 30),
        toonUrl: bool(r.toonUrl, true), uitlijning: uitlijning(r.uitlijning, 'rechts'),
        kledingErnaast: Math.round(getal(r.kledingErnaast, 0, 3, 0)), kader: bool(r.kader, false),
      };
    case 'handtekening':
      return {
        id, type, boven,
        groet: tekst(r.groet, 100), naam: tekst(r.naam, 100), functie: tekst(r.functie, 100),
        stijl: r.stijl === 'afbeelding' || r.stijl === 'geen' ? r.stijl : 'script', afbeelding: veiligeBron(r.afbeelding),
      };
    case 'voettekst':
      return { id, type, boven, tekst: tekst(r.tekst, 600), grootte: getal(r.grootte, 6, 10, 7.5), uitlijning: uitlijning(r.uitlijning, 'links') };
    case 'lijn':
      return { id, type, boven, kleur: hexOfLeeg(r.kleur), dikte: getal(r.dikte, 0.25, 3, 0.75) };
    case 'ruimte':
      return { id, type, boven, hoogte: getal(r.hoogte, 1, 120, 8), vul: bool(r.vul, false) };
  }
  return null;
}

export function normaliseerBriefOntwerp(ruw: unknown): BriefOntwerp | null {
  if (!ruw || typeof ruw !== 'object') return null;
  const r = ruw as Record<string, unknown>;
  if (!Array.isArray(r.blokken)) return null;
  const s = standaardInstellingen();
  const i = (r.instellingen && typeof r.instellingen === 'object' ? r.instellingen : {}) as Record<string, unknown>;
  const instellingen: BriefInstellingen = {
    lettertype: typeof i.lettertype === 'string' && i.lettertype in BRIEF_LETTERTYPEN ? (i.lettertype as BriefLettertype) : s.lettertype,
    lettergrootte: getal(i.lettergrootte, 9, 12, s.lettergrootte),
    tekstkleur: hexOf(i.tekstkleur, s.tekstkleur),
    accent: hexOf(i.accent, s.accent),
    marge: getal(i.marge, 15, 25, s.marge),
    briefhoofd: i.briefhoofd === 'compact' || i.briefhoofd === 'geen' ? i.briefhoofd : 'venster',
    voetbalk: bool(i.voetbalk, s.voetbalk),
  };
  const gezien = new Set<string>();
  const blokken: BriefBlok[] = [];
  for (const b of r.blokken.slice(0, 40)) {
    const n = normaliseerBlok(b);
    if (!n) continue;
    if (gezien.has(n.id)) n.id = briefId();
    gezien.add(n.id);
    blokken.push(n);
  }
  return { versie: BRIEF_VERSIE, instellingen, blokken };
}

/** Kopie met nieuwe blok-id's, bv. bij het toepassen van een template. */
export function kopieerOntwerp(o: BriefOntwerp): BriefOntwerp {
  const kopie = JSON.parse(JSON.stringify(o)) as BriefOntwerp;
  for (const b of kopie.blokken) b.id = briefId();
  return kopie;
}
