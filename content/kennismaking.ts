import type { LogoPositie } from '@/lib/prospect/types';
import { site } from '@/content/site';

/**
 * Instellingen voor de kennismakingsbrief en de persoonlijke landingspagina
 * (/k/<token> en /kennismaking/<token>). Alles wat Jessi of Tim wil bijsturen
 * zonder code te lezen staat hier: welke kleding we per branche laten zien,
 * waar het logo op de foto komt, de standaard brieftekst en de rekenhulp.
 */

/* ------------------------------------------------------------------ */
/* Branches                                                            */
/* ------------------------------------------------------------------ */

export type BrancheGroep =
  | 'installatie'
  | 'bouw'
  | 'dakdekker'
  | 'schilder'
  | 'metaal'
  | 'hovenier'
  | 'transport'
  | 'auto'
  | 'horeca'
  | 'zorg'
  | 'schoonmaak'
  | 'algemeen';

/** Leesbare naam per groep, voor filters in het dashboard. */
export const BRANCHE_LABELS: Record<BrancheGroep, string> = {
  installatie: 'Installatie',
  bouw: 'Bouw',
  dakdekker: 'Dakdekker',
  schilder: 'Schilder',
  metaal: 'Metaal en industrie',
  hovenier: 'Hovenier en infra',
  transport: 'Transport',
  auto: 'Auto',
  horeca: 'Horeca',
  zorg: 'Zorg en beauty',
  schoonmaak: 'Schoonmaak',
  algemeen: 'Overig',
};

/**
 * De prospectlijst heeft 23 schrijfwijzen voor zo'n 12 branches ("Zorg/Beauty",
 * "Zorg & beauty", ...). Volgorde telt: de eerste groep met een treffer wint,
 * dus "dakdekker" staat voor "bouw" en "metaal" voor "installatie".
 */
const BRANCHE_TREFWOORDEN: [BrancheGroep, string[]][] = [
  ['dakdekker', ['dak']],
  ['schilder', ['schilder', 'afwerk', 'stukadoor', 'spuit']],
  ['schoonmaak', ['schoonmaak', 'glazenwas', 'cleaning', 'facilit', 'reiniging']],
  ['horeca', ['horeca', 'restaurant', 'cafe', 'café', 'hotel', 'catering', 'eetcafe', 'lunchroom', 'bakker', 'slager', 'snack']],
  ['zorg', ['zorg', 'beauty', 'kapper', 'kapsalon', 'schoonheid', 'salon', 'fysio', 'tandarts', 'praktijk', 'pedicure', 'nagel', 'thuiszorg', 'verpleeg']],
  ['metaal', ['metaal', 'industrie', 'las', 'machine', 'productie', 'constructie', 'staal', 'fabriek']],
  ['hovenier', ['hovenier', 'groen', 'infra', 'tuin', 'grondwerk', 'wegenbouw', 'agrar', 'loonbedrijf']],
  ['transport', ['transport', 'logistiek', 'koerier', 'vervoer', 'expeditie', 'verhuis']],
  ['auto', ['auto', 'garage', 'carrosserie', 'banden', 'mobiliteit', 'fiets', 'tweewieler', 'trucks']],
  ['installatie', ['installat', 'elektr', 'loodgiet', 'sanitair', 'klimaat', 'cv', 'warmtepomp', 'zonnepan', 'solar', 'techniek']],
  ['bouw', ['bouw', 'aannem', 'timmer', 'metsel', 'tegel', 'vloer', 'kozijn', 'renovatie', 'klus']],
];

/** Normaliseert een vrije branchenaam uit de prospectlijst naar een vaste groep. */
export function brancheGroep(branche: string | null | undefined): BrancheGroep {
  const b = (branche ?? '').toLowerCase().trim();
  if (!b) return 'algemeen';
  for (const [groep, woorden] of BRANCHE_TREFWOORDEN) {
    if (woorden.some((w) => b.includes(w))) return groep;
  }
  return 'algemeen';
}

/* ------------------------------------------------------------------ */
/* Logoplek op de foto                                                 */
/* ------------------------------------------------------------------ */

export type LogoPlek = 'borst-links' | 'borst-midden' | 'dij' | 'koksbuis';

/**
 * Midden van het logo in procenten van de foto. "Links" is links voor de
 * drager, dus rechts op de foto. De waarden zijn gemiddelden over de
 * leveranciersfoto's (vrijstaand, recht van voren); Jessi kan per prospect
 * altijd een ander artikel kiezen als een foto afwijkt.
 */
export const LOGO_POSITIES: Record<LogoPlek, LogoPositie> = {
  'borst-links': { x: 62, y: 32, breedte: 14 },
  'borst-midden': { x: 50, y: 24, breedte: 20 },
  koksbuis: { x: 63, y: 30, breedte: 13 },
  dij: { x: 64, y: 36, breedte: 11 },
};

/** Logoplek op basis van categorie en naam van het artikel. */
export function logoPlekVoor(categorie: string | null, naam: string): LogoPlek {
  const n = naam.toLowerCase();
  if (/schort|sloof|apron/.test(n)) return 'borst-midden';
  if (/koksbuis|koks|chef/.test(n)) return 'koksbuis';
  if (categorie === 'Broeken' || categorie === 'Korte broeken' || /broek|trouser|pants|short/.test(n)) return 'dij';
  return 'borst-links';
}

export const logoPositieVoor = (categorie: string | null, naam: string): LogoPositie =>
  LOGO_POSITIES[logoPlekVoor(categorie, naam)];

/* ------------------------------------------------------------------ */
/* Welke kleding per branche                                           */
/* ------------------------------------------------------------------ */

export type ArtikelPlek = {
  /** Wat het is, voor Jessi (dashboard) en de rekenhulp. */
  soort: string;
  /** Categorieen uit de producttabel. Leeg = alle categorieen. */
  categorieen: string[];
  /** Trefwoorden in naam of subcategorie. Een treffer telt zwaar mee. */
  trefwoorden: string[];
  /** Zonder trefwoordtreffer deze plek overslaan en de terugval gebruiken. */
  trefwoordVerplicht?: boolean;
  /** Vervangende plek als er niets bruikbaars is (bv. geen koksbuis met foto). */
  terugval?: ArtikelPlek;
};

const POLO: ArtikelPlek = { soort: 'Polo', categorieen: ["T-shirts & polo's"], trefwoorden: ['polo'] };
const TSHIRT: ArtikelPlek = { soort: 'T-shirt', categorieen: ["T-shirts & polo's"], trefwoorden: ['t-shirt', 'tshirt', 'shirt'] };
const SWEATER: ArtikelPlek = { soort: 'Sweater', categorieen: ['Truien & vesten'], trefwoorden: ['sweater', 'hoodie', 'trui'] };
const VEST: ArtikelPlek = { soort: 'Vest', categorieen: ['Truien & vesten'], trefwoorden: ['vest', 'cardigan', 'fleece'] };
const SOFTSHELL: ArtikelPlek = { soort: 'Jas', categorieen: ['Jassen'], trefwoorden: ['softshell', 'jas', 'jack'] };
const WERKBROEK: ArtikelPlek = { soort: 'Werkbroek', categorieen: ['Broeken'], trefwoorden: ['werkbroek', 'broek', 'trouser'] };
const BLOUSE: ArtikelPlek = { soort: 'Blouse', categorieen: ['Blouses, overhemden & blazers'], trefwoorden: ['blouse', 'overhemd', 'shirt'] };
const KOKSBUIS: ArtikelPlek = { soort: 'Koksbuis', categorieen: [], trefwoorden: ['koksbuis', 'koks', 'chef'], trefwoordVerplicht: true, terugval: BLOUSE };
const SCHORT: ArtikelPlek = { soort: 'Schort', categorieen: [], trefwoorden: ['schort', 'sloof', 'apron'], trefwoordVerplicht: true, terugval: TSHIRT };
const TUNIEK: ArtikelPlek = { soort: 'Tuniek', categorieen: [], trefwoorden: ['tuniek', 'tunic', 'kasack'], trefwoordVerplicht: true, terugval: TSHIRT };

const VAKMAN = [SOFTSHELL, POLO, SWEATER, WERKBROEK];

/** Vier artikelen per branchegroep, in de volgorde waarin ze op de pagina staan. */
export const ARTIKELEN_PER_BRANCHE: Record<BrancheGroep, ArtikelPlek[]> = {
  installatie: VAKMAN,
  bouw: VAKMAN,
  dakdekker: VAKMAN,
  schilder: VAKMAN,
  metaal: VAKMAN,
  hovenier: VAKMAN,
  transport: [SOFTSHELL, POLO, TSHIRT, WERKBROEK],
  auto: VAKMAN,
  horeca: [KOKSBUIS, SCHORT, POLO, BLOUSE],
  zorg: [TUNIEK, POLO, TSHIRT, VEST],
  schoonmaak: [POLO, SOFTSHELL, WERKBROEK, SWEATER],
  algemeen: [POLO, SOFTSHELL, SWEATER, WERKBROEK],
};

/**
 * Kleurvoorkeur voor de foto: donker en neutraal, zodat een logo of bedrijfsnaam
 * er goed op staat. Eerder in de lijst = liever.
 */
export const VOORKEUR_KLEUREN = [
  'zwart', 'black', 'antraciet', 'anthracite', 'charcoal', 'graphite', 'grafiet',
  'marine', 'navy', 'donkerblauw', 'dark blue', 'donkergrijs', 'dark grey', 'dark gray',
];

/** Kleuren waar een logo slecht op valt of die niet passen bij een eerste indruk. */
export const VERMIJD_KLEUREN = ['fluor', 'hi-vis', 'hivis', 'geel', 'yellow', 'oranje', 'orange', 'wit', 'white', 'roze', 'pink'];

/** Lagere rang = betere kleur voor een mockup. */
export function kleurRang(kleur: string | null | undefined): number {
  const k = (kleur ?? '').toLowerCase();
  if (!k) return 50;
  if (VERMIJD_KLEUREN.some((w) => k.includes(w))) return 80;
  const i = VOORKEUR_KLEUREN.findIndex((w) => k.includes(w));
  return i === -1 ? 40 : i;
}

/** Leveranciercodes uit een kleurnaam halen: "9504 - navy\black" wordt "navy / black". */
export function toonKleur(kleur: string | null | undefined): string {
  const v = (kleur ?? '').trim();
  if (!v) return '';
  return v.replace(/^\s*\d+\s*-\s*/, '').replace(/\s+\d{3,}\s*$/, '').replace(/\\/g, ' / ').trim();
}

/* ------------------------------------------------------------------ */
/* Rekenhulp "Wat kost dat voor jullie team?"                          */
/* ------------------------------------------------------------------ */

/** Standaard aantal stuks per medewerker, op categorie. Bezoeker kan het aanpassen. */
export function standaardAantalPerPersoon(categorie: string | null, naam: string): number {
  const n = naam.toLowerCase();
  if (categorie === "T-shirts & polo's" || /polo|shirt|blouse|tuniek|koksbuis/.test(n)) return 2;
  return 1;
}

export const TEAM_MIN = 5;
export const TEAM_MAX = 100;
export const TEAM_STANDAARD = 10;

/* ------------------------------------------------------------------ */
/* Teksten                                                              */
/* ------------------------------------------------------------------ */

/**
 * Foto van Jessi voor de landingspagina, pad onder /public. Leeg laten zolang er
 * geen goede foto is; dan tonen we haar initialen in een cirkel.
 */
export const JESSI_FOTO: string | null = null;

/** Persoonlijke tekst bovenaan de landingspagina. {{bedrijf}} en {{plaats}} worden ingevuld. */
export const LANDING_INTRO = [
  'Ik ben Jessi Frederiks. Vanuit de Brouwersmolen in Hengelo kleed ik bedrijven in de Achterhoek, van de installateur om de hoek tot het restaurant in het dorp.',
  'Voor {{bedrijf}} heb ik alvast een paar artikelen uitgezocht en jullie logo erop gezet. Gewoon om te laten zien hoe het eruit kan zien. Bevalt het? Dan kom ik met een tas vol pasmodellen bij jullie langs. Dat kost niks en niemand hoeft ervoor naar de winkel.',
];

/** Standaard brieftekst. Merge-velden: {{bedrijf}} {{contactpersoon}} {{plaats}} {{branche}}. */
export const STANDAARD_BRIEFTEKST = `Beste {{contactpersoon}},

Mijn naam is Jessi Frederiks. Vanuit Hengelo lever ik werkkleding aan bedrijven in de Achterhoek, met het logo erop geborduurd of bedrukt in eigen huis.

Ik heb alvast gekeken hoe het team van {{bedrijf}} erbij kan lopen. Scan de QR-code hieronder met je telefoon. Dan zie je jullie eigen logo op een paar artikelen die ik voor jullie heb uitgezocht, met een eerlijke prijsindicatie erbij.

Spreekt het je aan? Dan kom ik graag langs voor een gratis pasdag in {{plaats}}. Iedereen past op de zaak, ik noteer de maten en jullie hoeven nergens heen.

Bellen mag ook gewoon: ${site.phone}.`;

/** Fallback als er geen contactpersoon bekend is. */
export const CONTACT_FALLBACK = 't.a.v. de directie';

/**
 * Vult de merge-velden in. Voor de aanhef ("Beste {{contactpersoon}},") werkt de
 * fallback anders: "Beste t.a.v. de directie" leest raar, dus daar wordt het
 * "Geachte directie,".
 */
export function vulBriefIn(
  tekst: string,
  v: { bedrijf: string; contactpersoon: string | null; plaats: string | null; branche: string | null },
): string {
  const contact = v.contactpersoon?.trim() || '';
  let uit = tekst;
  if (!contact) uit = uit.replace(/^(\s*)(Beste|Hallo|Dag)\s+\{\{contactpersoon\}\},?/im, '$1Geachte directie,');
  return uit
    .replace(/\{\{\s*bedrijf\s*\}\}/gi, v.bedrijf)
    .replace(/\{\{\s*contactpersoon\s*\}\}/gi, contact || CONTACT_FALLBACK)
    .replace(/\{\{\s*plaats\s*\}\}/gi, v.plaats?.trim() || 'jullie bedrijf')
    .replace(/\{\{\s*branche\s*\}\}/gi, v.branche?.trim().toLowerCase() || 'jullie vak');
}

/** Ontvanger van de scan- en pasdagmeldingen. */
export function meldAdres(standaard: string): string {
  return process.env.PROSPECT_NOTIFY_EMAIL?.trim() || standaard;
}
