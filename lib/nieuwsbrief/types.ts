/**
 * Datamodel van een nieuwsbrief-ontwerp (kolom `nieuwsbrieven.ontwerp`, jsonb).
 *
 * Opbouw, van groot naar klein (dezelfde begrippen als in de editor):
 *
 *   Ontwerp
 *   ├─ instellingen   algemene instellingen: achtergrond, breedte, lettertype, kleuren
 *   └─ secties[]      een horizontale band ("structuur") met 1 tot 4 kolommen
 *       └─ kolommen[]
 *           └─ blokken[]  tekst, kop, afbeelding, knop, scheiding, ruimte, social,
 *                         product, webversie-link, afmeldregel
 *
 * Afspraken:
 *  - Kleuren zijn hex-strings (#1c1c1c). Een lege string betekent "transparant"
 *    (achtergrond) of "neem de algemene instelling over" (tekstkleur).
 *  - Getallen zijn pixels, tenzij anders vermeld.
 *  - Uitlijning staat voor ALLE bloktypes in `blok.stijl.uitlijning`, dus ook
 *    voor afbeelding en knop. Er is geen tweede uitlijningsveld.
 *  - Dit bestand is puur (geen server-imports): de editor gebruikt het in de
 *    browser, de verzendmotor op de server.
 */

export const ONTWERP_VERSIE = 1 as const;

export type Uitlijning = 'links' | 'midden' | 'rechts';
export type Verbergen = 'geen' | 'desktop' | 'mobiel';

export type Padding = { boven: number; rechts: number; onder: number; links: number };

/** Lettertypes die in elk mailprogramma beschikbaar zijn. */
export const LETTERTYPEN = {
  arial: { label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  helvetica: { label: 'Helvetica', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  verdana: { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  tahoma: { label: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  trebuchet: { label: 'Trebuchet', stack: "'Trebuchet MS', Arial, sans-serif" },
  georgia: { label: 'Georgia', stack: 'Georgia, Times, serif' },
} as const;
export type Lettertype = keyof typeof LETTERTYPEN;

export type Instellingen = {
  /** Kleur rondom de brief (het "bureaublad"). */
  achtergrond: string;
  /** Kleur van de brief zelf. */
  inhoudAchtergrond: string;
  /** Breedte van de brief in px. Standaard 600, toegestaan 480-800. */
  breedte: number;
  lettertype: Lettertype;
  tekstkleur: string;
  linkkleur: string;
  kopkleur: string;
};

/* ------------------------------------------------------------------ */
/* Blokken                                                             */
/* ------------------------------------------------------------------ */

export type BlokStijl = {
  padding: Padding;
  /** Achtergrond achter het blok; '' = transparant. */
  achtergrond: string;
  /** '' = algemene tekstkleur (of kopkleur bij een kop). */
  tekstkleur: string;
  uitlijning: Uitlijning;
  /** Regelafstand als factor, bv. 1.5. */
  regelafstand: number;
  /** Lettergrootte in px. */
  lettergrootte: number;
  verbergen: Verbergen;
};

type BlokBasis = { id: string; stijl: BlokStijl };

export type TekstBlok = BlokBasis & {
  type: 'tekst';
  /**
   * Opgemaakte tekst. Wordt bij het renderen altijd door de allowlist-sanitizer
   * gehaald (zie lib/nieuwsbrief/sanitize.ts): b, strong, i, em, u, a[href],
   * br, p, ul, ol, li, span[style: color/font-weight], h1-h3. Een <div> wordt
   * een <p>. Merge-tags als {{naam}} mogen er gewoon in staan.
   */
  html: string;
};

export type KopBlok = BlokBasis & {
  type: 'kop';
  /** Platte tekst, geen HTML. Merge-tags mogen. */
  tekst: string;
  niveau: 1 | 2 | 3;
  /**
   * Als balk: de kop krijgt een volle gekleurde achtergrond over de breedte van
   * de kolom (zoals de donkere balk "Tijd voor het voorjaar!"). De kleur komt
   * uit stijl.achtergrond, de tekstkleur uit stijl.tekstkleur.
   */
  balk: boolean;
  /** Extra letterafstand in em (0 = normaal). Gebruikt voor de wordmark. */
  letterafstand?: number;
  /** Vet (standaard aan). */
  vet?: boolean;
};

export type AfbeeldingBlok = BlokBasis & {
  type: 'afbeelding';
  /** Volledige https-url of pad onder /public (wordt dan absoluut gemaakt met siteUrl). */
  src: string;
  alt: string;
  /** Optioneel: klikbare link. */
  link: string;
  /** Breedte in px, of 'vol' voor de hele kolombreedte. */
  breedte: number | 'vol';
  radius: number;
};

export type KnopBlok = BlokBasis & {
  type: 'knop';
  tekst: string;
  link: string;
  /** Kleur van de knop zelf (niet van het blok eromheen). */
  achtergrond: string;
  tekstkleur: string;
  radius: number;
  volleBreedte: boolean;
};

export type ScheidingBlok = BlokBasis & {
  type: 'scheiding';
  kleur: string;
  /** Dikte in px. */
  dikte: number;
  /** Breedte in procenten van de kolom (10-100). */
  breedte: number;
  lijnstijl?: 'solid' | 'dashed' | 'dotted';
};

export type RuimteBlok = BlokBasis & {
  type: 'ruimte';
  hoogte: number;
};

export const SOCIAL_KANALEN = ['facebook', 'instagram', 'linkedin', 'whatsapp', 'email'] as const;
export type SocialKanaal = (typeof SOCIAL_KANALEN)[number];

export type SocialBlok = BlokBasis & {
  type: 'social';
  /** Lege url = icoon niet tonen. Bij email mag een gewoon adres (mailto: wordt aangevuld). */
  links: Record<SocialKanaal, string>;
  /** Kleur van de iconen (hex). */
  iconKleur: string;
  /** Grootte van een icoon in px (24-48). */
  grootte: number;
};

export type ProductBlok = BlokBasis & {
  type: 'product';
  productId: string | null;
  /** Gecachte productgegevens; worden bij het kiezen van een product ingevuld. */
  naam: string;
  merk: string;
  foto: string;
  /** Prijs per stuk excl. btw. Wordt alleen getoond als toonPrijs aan staat. */
  prijs: number | null;
  /**
   * Standaard UIT: op de website staan bewust geen prijzen (die zijn alleen
   * voor ingelogde klanten). Jessi zet hem per product aan als ze dat wil.
   */
  toonPrijs: boolean;
  /** Link naar de productpagina op de site. */
  link: string;
  /** Tekst van de link onder het product, bv. "Bekijk". Leeg = geen link-tekst. */
  knopTekst: string;
};

export type WebversieBlok = BlokBasis & {
  type: 'webversie';
  /** Tekst voor de link, bv. "Bekijk deze e-mail in je browser". */
  tekst: string;
};

export type AfmeldBlok = BlokBasis & {
  type: 'afmelden';
  /** Uitleg waarom iemand de mail krijgt. Mag leeg. */
  tekst: string;
  /** Tekst van de afmeldlink, bv. "Uitschrijven". */
  linkTekst: string;
};

export type Blok =
  | TekstBlok
  | KopBlok
  | AfbeeldingBlok
  | KnopBlok
  | ScheidingBlok
  | RuimteBlok
  | SocialBlok
  | ProductBlok
  | WebversieBlok
  | AfmeldBlok;

export type BlokType = Blok['type'];

/** Bloktypes met een Nederlandse naam en korte uitleg, voor de blokkenlijst in de editor. */
export const BLOKTYPEN: { type: BlokType; label: string; uitleg: string }[] = [
  { type: 'tekst', label: 'Tekst', uitleg: 'Een stuk tekst met vet, cursief, links en opsommingen.' },
  { type: 'kop', label: 'Kop', uitleg: 'Een titel, los of als gekleurde balk.' },
  { type: 'afbeelding', label: 'Afbeelding', uitleg: 'Een foto of plaatje, eventueel klikbaar.' },
  { type: 'knop', label: 'Knop', uitleg: 'Een opvallende knop met een link, bv. naar de webshop.' },
  { type: 'product', label: 'Product', uitleg: 'Een artikel uit het assortiment met foto en link.' },
  { type: 'scheiding', label: 'Scheidingslijn', uitleg: 'Een horizontale lijn tussen twee stukken.' },
  { type: 'ruimte', label: 'Witruimte', uitleg: 'Lege ruimte om iets meer lucht te geven.' },
  { type: 'social', label: 'Social media', uitleg: 'Iconen naar Facebook, Instagram, LinkedIn en meer.' },
  { type: 'webversie', label: 'Webversie-link', uitleg: 'Link om de mail in de browser te openen.' },
  { type: 'afmelden', label: 'Afmeldregel', uitleg: 'Verplichte regel met de link om af te melden.' },
];

/* ------------------------------------------------------------------ */
/* Secties                                                             */
/* ------------------------------------------------------------------ */

export type Rand = { breedte: number; kleur: string; stijl: 'solid' | 'dashed' | 'dotted' };

export type SectieStijl = {
  /** Achtergrond over de volle breedte van de sectie; '' = transparant. */
  achtergrond: string;
  /** Achtergrond van het inhoudsvlak binnen de padding (bv. een kader); '' = transparant. */
  inhoudAchtergrond: string;
  /** Optionele achtergrondafbeelding (url). Niet elk mailprogramma toont die. */
  achtergrondAfbeelding?: string;
  /** Rand om het inhoudsvlak. Weglaten of null = geen rand. */
  rand?: Rand | null;
  padding: Padding;
  /** Hoekafronding van het inhoudsvlak. */
  radius: number;
};

export type Kolom = { id: string; blokken: Blok[] };

export type Sectie = {
  id: string;
  /** Vrije naam, bv. "Header" (alleen zichtbaar in de editor). */
  naam?: string;
  kolommen: Kolom[];
  /** Breedteverhouding per kolom in procenten; zelfde lengte als kolommen, opgeteld 100. */
  verhouding: number[];
  stijl: SectieStijl;
  /** Kolommen onder elkaar zetten op een telefoon. */
  stapelenOpMobiel: boolean;
  verbergen: Verbergen;
};

export type Ontwerp = {
  versie: typeof ONTWERP_VERSIE;
  instellingen: Instellingen;
  secties: Sectie[];
};

/** Een opgeslagen, herbruikbare sectie (tabel nieuwsbrief_modules). */
export type Module = { id: string; naam: string; sectie: Sectie };

/** Beschikbare kolomindelingen ("structuren"). */
export const STRUCTUREN: { id: string; label: string; verhouding: number[] }[] = [
  { id: '1', label: '1 kolom', verhouding: [100] },
  { id: '2', label: '2 kolommen (gelijk)', verhouding: [50, 50] },
  { id: '2-33-67', label: '2 kolommen (smal, breed)', verhouding: [33, 67] },
  { id: '2-67-33', label: '2 kolommen (breed, smal)', verhouding: [67, 33] },
  { id: '3', label: '3 kolommen', verhouding: [33, 34, 33] },
  { id: '4', label: '4 kolommen', verhouding: [25, 25, 25, 25] },
];

/* ------------------------------------------------------------------ */
/* Huisstijl en standaardwaarden                                       */
/* ------------------------------------------------------------------ */

export const HUISSTIJL = {
  charcoal: '#1c1c1c',
  oranje: '#ec6726',
  tekst: '#52504e',
  grijs: '#adadad',
  lijn: '#e4e2e0',
  zand: '#f6f5f4',
  wit: '#ffffff',
} as const;

/** Uniek id, in browser én op de server. */
export function nieuwId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function padding(boven: number, rechts = boven, onder = boven, links = rechts): Padding {
  return { boven, rechts, onder, links };
}

export function defaultInstellingen(): Instellingen {
  return {
    achtergrond: HUISSTIJL.zand,
    inhoudAchtergrond: HUISSTIJL.wit,
    breedte: 600,
    lettertype: 'arial',
    tekstkleur: HUISSTIJL.tekst,
    linkkleur: HUISSTIJL.oranje,
    kopkleur: HUISSTIJL.charcoal,
  };
}

export function defaultBlokStijl(over: Partial<BlokStijl> = {}): BlokStijl {
  return {
    padding: padding(10, 24),
    achtergrond: '',
    tekstkleur: '',
    uitlijning: 'links',
    regelafstand: 1.6,
    lettergrootte: 15,
    verbergen: 'geen',
    ...over,
  };
}

/** Een nieuw blok van het gegeven type met verstandige standaardwaarden. */
export function defaultBlok<T extends BlokType>(type: T): Extract<Blok, { type: T }>;
export function defaultBlok(type: BlokType): Blok {
  const id = nieuwId();
  switch (type) {
    case 'tekst':
      return { id, type, html: '<p>Schrijf hier je tekst.</p>', stijl: defaultBlokStijl() };
    case 'kop':
      return {
        id,
        type,
        tekst: 'Nieuwe kop',
        niveau: 2,
        balk: false,
        stijl: defaultBlokStijl({ lettergrootte: 22, regelafstand: 1.3, padding: padding(16, 24, 8, 24) }),
      };
    case 'afbeelding':
      return {
        id,
        type,
        src: '',
        alt: '',
        link: '',
        breedte: 'vol',
        radius: 0,
        stijl: defaultBlokStijl({ padding: padding(0), uitlijning: 'midden' }),
      };
    case 'knop':
      return {
        id,
        type,
        tekst: 'Bekijk het assortiment',
        link: 'https://www.frederiksbedrijfskleding.nl/assortiment',
        achtergrond: HUISSTIJL.oranje,
        tekstkleur: HUISSTIJL.wit,
        radius: 6,
        volleBreedte: false,
        stijl: defaultBlokStijl({ uitlijning: 'midden', padding: padding(16, 24), lettergrootte: 15 }),
      };
    case 'scheiding':
      return {
        id,
        type,
        kleur: HUISSTIJL.lijn,
        dikte: 1,
        breedte: 100,
        lijnstijl: 'solid',
        stijl: defaultBlokStijl({ uitlijning: 'midden', padding: padding(12, 24) }),
      };
    case 'ruimte':
      return { id, type, hoogte: 24, stijl: defaultBlokStijl({ padding: padding(0) }) };
    case 'social':
      return {
        id,
        type,
        links: { facebook: '', instagram: '', linkedin: '', whatsapp: '', email: '' },
        iconKleur: HUISSTIJL.charcoal,
        grootte: 32,
        stijl: defaultBlokStijl({ uitlijning: 'midden', padding: padding(16, 24) }),
      };
    case 'product':
      return {
        id,
        type,
        productId: null,
        naam: '',
        merk: '',
        foto: '',
        prijs: null,
        toonPrijs: false,
        link: '',
        knopTekst: 'Bekijk',
        stijl: defaultBlokStijl({ uitlijning: 'midden', padding: padding(10), lettergrootte: 14, regelafstand: 1.4 }),
      };
    case 'webversie':
      return {
        id,
        type,
        tekst: 'Bekijk deze e-mail in je browser',
        stijl: defaultBlokStijl({ uitlijning: 'midden', lettergrootte: 11, padding: padding(10, 24), tekstkleur: '#8a8784' }),
      };
    case 'afmelden':
      return {
        id,
        type,
        tekst: 'Je ontvangt deze e-mail omdat je klant bent bij of je hebt aangemeld voor de nieuwsbrief van Frederiks Bedrijfskleding.',
        linkTekst: 'Uitschrijven',
        stijl: defaultBlokStijl({ uitlijning: 'midden', lettergrootte: 11, padding: padding(8, 24, 20, 24), tekstkleur: HUISSTIJL.grijs }),
      };
  }
}

export function defaultSectieStijl(over: Partial<SectieStijl> = {}): SectieStijl {
  return {
    achtergrond: '',
    inhoudAchtergrond: '',
    rand: null,
    padding: padding(0),
    radius: 0,
    ...over,
  };
}

/**
 * Een nieuwe, lege sectie met `kolommen` kolommen (1-4) of met een expliciete
 * verhouding uit STRUCTUREN.
 */
export function defaultSectie(kolommen: number | number[] = 1): Sectie {
  const verhouding = Array.isArray(kolommen) ? [...kolommen] : gelijkeVerhouding(kolommen);
  return {
    id: nieuwId(),
    kolommen: verhouding.map(() => ({ id: nieuwId(), blokken: [] })),
    verhouding,
    stijl: defaultSectieStijl(),
    stapelenOpMobiel: true,
    verbergen: 'geen',
  };
}

export function gelijkeVerhouding(aantal: number): number[] {
  const n = Math.min(4, Math.max(1, Math.round(aantal) || 1));
  const struct = STRUCTUREN.find((s) => s.verhouding.length === n);
  return struct ? [...struct.verhouding] : [100];
}

export function leegOntwerp(): Ontwerp {
  return { versie: ONTWERP_VERSIE, instellingen: defaultInstellingen(), secties: [] };
}

/** Diepe kopie met nieuwe id's, voor dupliceren of een module invoegen. */
export function kopieerSectie(sectie: Sectie): Sectie {
  const kopie = JSON.parse(JSON.stringify(sectie)) as Sectie;
  kopie.id = nieuwId();
  for (const k of kopie.kolommen) {
    k.id = nieuwId();
    for (const b of k.blokken) b.id = nieuwId();
  }
  return kopie;
}

export function kopieerBlok<T extends Blok>(blok: T): T {
  const kopie = JSON.parse(JSON.stringify(blok)) as T;
  kopie.id = nieuwId();
  return kopie;
}

/** De merge-tags die Jessi in teksten kan gebruiken, met uitleg voor de editor. */
export const MERGE_TAGS: { tag: string; uitleg: string; voorbeeld: string }[] = [
  { tag: '{{naam}}', uitleg: 'Volledige naam van de ontvanger', voorbeeld: 'Jan de Vries' },
  { tag: '{{voornaam}}', uitleg: 'Voornaam van de ontvanger', voorbeeld: 'Jan' },
  { tag: '{{bedrijf}}', uitleg: 'Bedrijfsnaam', voorbeeld: 'Bouwbedrijf Jansen' },
  { tag: '{{email}}', uitleg: 'E-mailadres van de ontvanger', voorbeeld: 'jan@voorbeeld.nl' },
];
