/**
 * Vaste lijsten voor maten en kleuren, plus de helpers die ruwe waarden naar
 * die lijst vertalen.
 *
 * Dit bestand heeft geen server-afhankelijkheden: het werkt in de browser, in
 * een server action en in een importscript. De lijsten zelf staan in de
 * database (tabellen `variant_kleuren`, `variant_maten` en hun aliassen) en
 * worden geladen met `laadVariantLijsten()` uit `lib/kms/varianten.ts`. Is de
 * migratie nog niet gedraaid, dan valt alles terug op de standaardlijst
 * hieronder. Diezelfde lijst zit als startvulling in de migratie.
 *
 * Gebruik:
 *   const lijst = await laadVariantLijsten();          // server
 *   normaliseerKleur('9504 - Navy\\Black', lijst)      // { naam: 'Marine/zwart', zeker: false, nieuw: true, ... }
 *   normaliseerMaat('XXL', lijst)                      // { naam: '2XL', zeker: true, ... }
 *   kleurNaam(ruw, lijst) / maatNaam(ruw, lijst)       // korte vorm: altijd een tekst terug
 */

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export const KLEURGROEPEN = [
  { id: 'zwart', naam: 'Zwart', hex: '#1b1b1b' },
  { id: 'wit', naam: 'Wit', hex: '#ffffff' },
  { id: 'grijs', naam: 'Grijs', hex: '#8c8f93' },
  { id: 'blauw', naam: 'Blauw', hex: '#2b59c3' },
  { id: 'rood', naam: 'Rood', hex: '#c8102e' },
  { id: 'groen', naam: 'Groen', hex: '#2e7d32' },
  { id: 'geel', naam: 'Geel', hex: '#ffd200' },
  { id: 'oranje', naam: 'Oranje', hex: '#f07d00' },
  { id: 'bruin', naam: 'Bruin', hex: '#6b4a2b' },
  { id: 'beige', naam: 'Beige', hex: '#d6c7a1' },
  { id: 'roze', naam: 'Roze', hex: '#e58fb0' },
  { id: 'paars', naam: 'Paars', hex: '#6a3d8f' },
  { id: 'zilver', naam: 'Zilver', hex: '#b9bdc1' },
  { id: 'meerkleurig', naam: 'Meerkleurig', hex: '#999999' },
] as const;

export type KleurGroep = (typeof KLEURGROEPEN)[number]['id'];

export type StandaardKleur = {
  id?: string;
  naam: string;
  hex: string;
  /** Tweede kleur bij een tweekleurig artikel (Marine/zwart). */
  hex2?: string | null;
  groep: KleurGroep;
  volgorde: number;
  aliassen: string[];
  actief?: boolean;
};

export type StandaardMaat = { id?: string; maat: string; volgorde: number; aliassen: string[] };

export type MaatReeks = { id?: string; naam: string; volgorde: number; maten: StandaardMaat[] };

export type VariantEigenschap = { id?: string; soort: 'lengte' | 'pasvorm'; waarde: string; volgorde: number };

export type VariantLijsten = {
  kleuren: StandaardKleur[];
  reeksen: MaatReeks[];
  eigenschappen: VariantEigenschap[];
  /** 'database' als de vaste lijst uit Supabase komt, 'standaard' als de migratie nog ontbreekt. */
  bron: 'database' | 'standaard';
};

// ---------------------------------------------------------------------------
// Standaardlijst (ook de startvulling van de migratie)
// ---------------------------------------------------------------------------

type K = [naam: string, hex: string, groep: KleurGroep, aliassen: string[]];

/**
 * Enkelvoudige kleuren. Tweekleurige artikelen (Navy\Black) worden opgebouwd uit
 * twee van deze kleuren: de opschoontool stelt dan "Marine/zwart" voor.
 * Aliassen zijn al genormaliseerd (kleine letters, zonder leverancierscode).
 */
const KLEUREN_RUW: K[] = [
  ['Zwart', '#1b1b1b', 'zwart', ['black', 'blk', 'schwarz', 'noir']],
  ['Wit', '#ffffff', 'wit', ['white', 'blanc']],
  ['Gebroken wit', '#f2eee3', 'wit', ['bone white', 'off white', 'offwhite', 'ecru']],
  ['Lichtgrijs', '#c9cbcd', 'grijs', ['light grey', 'light gray', 'ash grey', 'snow grey', 'licht grijs']],
  ['IJsgrijs', '#d5d9dc', 'grijs', ['ice grey', 'ice gray']],
  ['Grijs', '#8c8f93', 'grijs', ['grey', 'gray', 'mid grey', 'convoy grey', 'stone grey', 'full grey']],
  ['Grijs gemêleerd', '#a3a3a3', 'grijs', ['grey melange', 'greymel', 'grey mel', 'light grey melange', 'heather grey', 'grijs melange']],
  ['Staalgrijs', '#5d6870', 'grijs', ['steel grey', 'steelgrey', 'steel gray']],
  ['Donker staalgrijs', '#46505a', 'grijs', ['dk steel grey', 'dark steel grey']],
  ['Donkergrijs', '#4b4e53', 'grijs', ['dark grey', 'darkgrey', 'dark gray', 'dk grey', 'donker grijs', 'slate grey', 'storm grey']],
  ['Oxford grijs', '#5a5f66', 'grijs', ['oxford grey', 'oxford gray']],
  ['Antraciet', '#36393d', 'grijs', ['anthracite', 'anthracite grey', 'charcoal', 'antracite']],
  ['Zilver', '#b9bdc1', 'zilver', ['silver']],
  ['Marine', '#1f2a44', 'blauw', ['navy', 'marineblauw', 'marine blauw', 'navy blue', 'navy plain']],
  ['Donker marine', '#141b2d', 'blauw', ['dark navy', 'donker marineblauw', 'donkermarine']],
  ['Marine gemêleerd', '#2f3a55', 'blauw', ['navy melange', 'dark navy melange', 'dark blue melange']],
  ['Donkerblauw', '#1f3566', 'blauw', ['dark blue', 'donker blauw']],
  ['Blauw', '#2b59c3', 'blauw', ['blue']],
  ['Koningsblauw', '#2a4fb0', 'blauw', ['royal blue', 'royalblue', 'royal', 'kobaltblauw', 'cobalt']],
  ['Licht koningsblauw', '#4f7fd6', 'blauw', ['light royal blue']],
  ['Korenblauw', '#4a6fb5', 'blauw', ['cornflower blue', 'cornflower']],
  ['Helderblauw', '#1e63c6', 'blauw', ['true blue']],
  ['Diepblauw', '#1d3f8a', 'blauw', ['deep blue']],
  ['Grijsblauw', '#5f7a96', 'blauw', ['stone blue']],
  ['Lichtblauw', '#8db9e2', 'blauw', ['sky blue', 'light blue', 'licht blauw', 'ice blue']],
  ['Oceaanblauw', '#1b6f8f', 'blauw', ['ocean', 'ocean blue']],
  ['Petrol', '#1d5c6b', 'blauw', ['teal blue', 'teal']],
  ['Turquoise', '#00a0be', 'blauw', ['tropical blue', 'turquoise blue', 'turkoois']],
  ['Denim', '#3d5a80', 'blauw', ['denimblue', 'denim blue', 'blue rinse', 'jeans']],
  ['Indigo', '#2f3a6b', 'blauw', []],
  ['Rood', '#c8102e', 'rood', ['red', 'chili red', 'signal red', 'red melange']],
  ['Bordeaux', '#6d1a2a', 'rood', ['wine', 'burgundy', 'maroon', 'wijnrood']],
  ['Groen', '#2e7d32', 'groen', ['green', 'kelly green', 'emerald green']],
  ['Bosgroen', '#2c4a2e', 'groen', ['forest green']],
  ['Donkergroen', '#1f3d2b', 'groen', ['dark green', 'bottle green', 'bottle grn', 'donker groen', 'flessengroen']],
  ['Kakigroen', '#5b5b3a', 'groen', ['khaki green', 'khakigroen']],
  ['Donker kakigroen', '#45452b', 'groen', ['dk khakigreen', 'dk khaki green', 'dark khaki green']],
  ['Olijfgroen', '#5a5a32', 'groen', ['olijf', 'olive', 'olive green']],
  ['Limoen', '#a4c639', 'groen', ['lime', 'apple green', 'limegroen']],
  ['Kaki', '#8b7d5b', 'beige', ['khaki', 'dark khaki', 'khaki beige']],
  ['Beige', '#d6c7a1', 'beige', []],
  ['Zand', '#c9b48a', 'beige', ['sand', 'light sand']],
  ['Camel', '#b38b59', 'bruin', []],
  ['Taupe', '#8b7d70', 'bruin', []],
  ['Bruin', '#6b4a2b', 'bruin', ['brown', 'chocolate']],
  ['Lichtbruin', '#9a6b3f', 'bruin', ['light brown']],
  ['Oranje', '#f07d00', 'oranje', ['orange', 'warm orange']],
  ['Fluor oranje', '#ff5f15', 'oranje', ['fluororange', 'fluor orange', 'fluorescent orange', 'fluorescent orange melange', 'hi viz orange', 'hi-viz orange', 'hi-vis orange', 'hi vis orange', 'high visibility orange', 'fluo oranje', 'neon orange', 'fluor oranje']],
  ['Geel', '#ffd200', 'geel', ['yellow']],
  ['Fluor geel', '#e2ef00', 'geel', ['fluorescent yellow', 'fluorescent yellow melange', 'fluor yellow', 'hi viz yellow', 'hi-viz yellow', 'hi-vis geel', 'hi-vis yellow', 'hi vis yellow', 'high visibility yellow', 'neon yellow', 'fluo geel']],
  ['Roze', '#e58fb0', 'roze', ['pink']],
  ['Paars', '#6a3d8f', 'paars', ['purple']],
  ['Meerkleurig', '#999999', 'meerkleurig', ['multicolour', 'multicolor', 'multi']],
];

export const STANDAARD_KLEUREN: StandaardKleur[] = KLEUREN_RUW.map(([naam, hex, groep, aliassen], i) => ({
  naam,
  hex,
  hex2: null,
  groep,
  volgorde: (i + 1) * 10,
  aliassen,
}));

const reeks = (van: number, tot: number, stap = 1) => {
  const uit: string[] = [];
  for (let n = van; n <= tot; n += stap) uit.push(String(n));
  return uit;
};

const MATEN_RUW: { naam: string; maten: (string | [string, string[]])[] }[] = [
  {
    naam: 'Confectie',
    maten: [
      ['XXS', ['2xs']], 'XS', 'S', 'M', 'L', 'XL',
      ['2XL', ['xxl']], ['3XL', ['xxxl']], ['4XL', ['xxxxl']], ['5XL', ['xxxxxl']],
      ['6XL', ['xxxxxxl']], '7XL', '8XL',
    ],
  },
  {
    naam: 'Combimaten',
    maten: [
      'XS/S', 'S/M', 'M/L', 'L/XL', ['XL/2XL', ['xl/xxl']], ['2XL/3XL', ['xxl/3xl', 'xxl/xxxl']],
      ['3XL/4XL', ['xxxl/4xl']], '4XL/5XL',
    ],
  },
  { naam: 'Broekmaten', maten: reeks(34, 72, 2) },
  { naam: 'Korte maten (buikmaten)', maten: reeks(23, 35) },
  { naam: 'Lange maten', maten: reeks(84, 128, 2) },
  { naam: 'Schoenmaten', maten: reeks(35, 50) },
  { naam: 'One size', maten: [['One size', ['onesize', 'one size', 'one-size', 'os', 'uni', 'universeel']]] },
];

export const STANDAARD_REEKSEN: MaatReeks[] = MATEN_RUW.map((r, ri) => ({
  naam: r.naam,
  volgorde: (ri + 1) * 10,
  maten: r.maten.map((m, mi) => {
    const [maat, aliassen] = typeof m === 'string' ? [m, []] : m;
    return { maat, volgorde: (mi + 1) * 10, aliassen };
  }),
}));

export const STANDAARD_EIGENSCHAPPEN: VariantEigenschap[] = [
  { soort: 'lengte', waarde: 'Kort', volgorde: 10 },
  { soort: 'lengte', waarde: 'Normaal', volgorde: 20 },
  { soort: 'lengte', waarde: 'Lang', volgorde: 30 },
  { soort: 'lengte', waarde: 'Extra lang', volgorde: 40 },
  { soort: 'pasvorm', waarde: 'Regular fit', volgorde: 10 },
  { soort: 'pasvorm', waarde: 'Slim fit', volgorde: 20 },
  { soort: 'pasvorm', waarde: 'Loose fit', volgorde: 30 },
  { soort: 'pasvorm', waarde: 'Dames', volgorde: 40 },
];

export const STANDAARD_LIJSTEN: VariantLijsten = {
  kleuren: STANDAARD_KLEUREN,
  reeksen: STANDAARD_REEKSEN,
  eigenschappen: STANDAARD_EIGENSCHAPPEN,
  bron: 'standaard',
};

// ---------------------------------------------------------------------------
// Sleutels
// ---------------------------------------------------------------------------

/**
 * Maakt van een ruwe kleur een vergelijkbare sleutel:
 *  - leverancierscodes eraf: "0404 - Black\Black", "Marine/Zwart 1620", "Deep Blue\Navy - 5395", "(1)";
 *  - alle scheidingstekens (\ / " - ") worden "/";
 *  - aan elkaar geschreven tweekleuren splitsen: "BlackGrey" wordt "black/grey";
 *  - kleine letters, accenten weg, enkele spaties.
 */
export function kleurSleutel(ruw: string | null | undefined): string {
  let s = String(ruw ?? '').trim();
  if (!s) return '';
  s = s.replace(/\(\d+\)/g, ' ');
  s = s.replace(/^\s*\d{3,4}\s*-\s*/, ''); // 0404 - Black
  s = s.replace(/\s*-\s*\d{3,4}\s*$/, ''); // Deep Blue\Navy - 5395
  s = s.replace(/\s+\d{2,4}\s*$/, ''); // Marine/Zwart 1620, Zwart 20
  s = s.replace(/([a-z])([A-Z])/g, '$1/$2'); // BlackGrey, WhiteDarkgrey
  s = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  s = s.replace(/\s*[\\/|+]\s*/g, '/').replace(/\s+-\s+/g, '/').replace(/\s*&\s*/g, '/');
  s = s.replace(/\s+/g, ' ').replace(/\/+/g, '/').replace(/^\/|\/$/g, '').trim();
  return s;
}

/** Sleutel voor een maat: hoofdletters, geen dubbele spaties, NL-maat uit "56 NL (50 FR)". */
export function maatSleutel(ruw: string | null | undefined): string {
  let s = String(ruw ?? '').trim();
  if (!s) return '';
  const nl = /^(\d+)\s*NL\s*\(.*\)$/i.exec(s);
  if (nl) s = nl[1];
  s = s.replace(/\s*\((?:\d+\/\d+\s*)?ans\)\s*$/i, ''); // "10/12 jaar (10/12 ans)"
  s = s.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').toLowerCase();
  return s;
}

// ---------------------------------------------------------------------------
// Indexen (per lijst één keer opgebouwd)
// ---------------------------------------------------------------------------

type KleurIndex = { opSleutel: Map<string, StandaardKleur>; enkel: Map<string, StandaardKleur> };
type MaatIndex = { opSleutel: Map<string, { maat: string; reeks: string; volgorde: number; reeksVolgorde: number }> };

const kleurIndexCache = new WeakMap<VariantLijsten, KleurIndex>();
const maatIndexCache = new WeakMap<VariantLijsten, MaatIndex>();

function kleurIndex(lijst: VariantLijsten): KleurIndex {
  const bestaand = kleurIndexCache.get(lijst);
  if (bestaand) return bestaand;
  const opSleutel = new Map<string, StandaardKleur>();
  const enkel = new Map<string, StandaardKleur>();
  const actief = lijst.kleuren.filter((k) => k.actief !== false);
  // Eerst namen, dan aliassen: een naam wint altijd van een alias.
  for (const k of actief) opSleutel.set(kleurSleutel(k.naam), k);
  for (const k of actief) {
    for (const a of k.aliassen) {
      const s = kleurSleutel(a);
      if (s && !opSleutel.has(s)) opSleutel.set(s, k);
    }
  }
  for (const [s, k] of opSleutel) if (!kleurSleutel(k.naam).includes('/')) enkel.set(s, k);
  const idx = { opSleutel, enkel };
  kleurIndexCache.set(lijst, idx);
  return idx;
}

function maatIndex(lijst: VariantLijsten): MaatIndex {
  const bestaand = maatIndexCache.get(lijst);
  if (bestaand) return bestaand;
  const opSleutel: MaatIndex['opSleutel'] = new Map();
  const reeksen = [...lijst.reeksen].sort((a, b) => a.volgorde - b.volgorde);
  for (const r of reeksen) {
    for (const m of r.maten) {
      const s = maatSleutel(m.maat);
      if (s && !opSleutel.has(s)) opSleutel.set(s, { maat: m.maat, reeks: r.naam, volgorde: m.volgorde, reeksVolgorde: r.volgorde });
    }
  }
  for (const r of reeksen) {
    for (const m of r.maten) {
      for (const a of m.aliassen) {
        const s = maatSleutel(a);
        if (s && !opSleutel.has(s)) opSleutel.set(s, { maat: m.maat, reeks: r.naam, volgorde: m.volgorde, reeksVolgorde: r.volgorde });
      }
    }
  }
  const idx = { opSleutel };
  maatIndexCache.set(lijst, idx);
  return idx;
}

// ---------------------------------------------------------------------------
// Normaliseren
// ---------------------------------------------------------------------------

export type KleurUitkomst = {
  /** De standaardnaam, of het voorstel als `nieuw` waar is. Null als er niets past. */
  naam: string | null;
  /** True: de waarde staat al zo in de vaste lijst, of als alias. */
  zeker: boolean;
  /** True: voorstel voor een nieuwe tweekleur die nog niet in de lijst staat. */
  nieuw: boolean;
  /** De standaardkleur als die al bestaat. */
  kleur: StandaardKleur | null;
  /** Bij een nieuw voorstel: de onderdelen waaruit het is opgebouwd. */
  delen: StandaardKleur[];
  /** De ruwe waarde was al precies de standaardnaam. */
  alStandaard: boolean;
};

const GEEN_KLEUR: KleurUitkomst = { naam: null, zeker: false, nieuw: false, kleur: null, delen: [], alStandaard: false };

/**
 * Vertaalt een ruwe kleur naar de vaste lijst.
 *
 * 1. Staat de sleutel als naam of alias in de lijst: zeker.
 * 2. Anders opsplitsen op "/" en elk deel opzoeken. "0404 - Black\Black" wordt
 *    zo "Zwart", "9504 - Navy\Black" wordt "Marine/zwart". Bestaat die
 *    tweekleur al in de lijst, dan is het zeker; anders een voorstel (`nieuw`).
 * 3. Past een deel nergens op, dan null: handmatig koppelen.
 */
export function normaliseerKleur(ruw: string | null | undefined, lijst: VariantLijsten = STANDAARD_LIJSTEN): KleurUitkomst {
  const sleutel = kleurSleutel(ruw);
  if (!sleutel) return GEEN_KLEUR;
  const idx = kleurIndex(lijst);
  const direct = idx.opSleutel.get(sleutel);
  if (direct) {
    return { naam: direct.naam, zeker: true, nieuw: false, kleur: direct, delen: [], alStandaard: String(ruw).trim() === direct.naam };
  }
  const stukken = sleutel.split('/').map((d) => d.trim()).filter(Boolean);
  if (stukken.length < 2) return GEEN_KLEUR;
  const delen: StandaardKleur[] = [];
  for (let i = 0; i < stukken.length; i++) {
    let k = idx.enkel.get(stukken[i]);
    // "Dk KhakiGreen" is door de sleutel in tweeën geknipt; dan het volgende deel erbij proberen.
    if (!k && i + 1 < stukken.length) {
      k = idx.enkel.get(`${stukken[i]} ${stukken[i + 1]}`) ?? idx.enkel.get(`${stukken[i]}${stukken[i + 1]}`);
      if (k) i++;
    }
    if (!k) return GEEN_KLEUR;
    if (delen[delen.length - 1]?.naam !== k.naam) delen.push(k);
  }
  if (delen.length === 1) {
    return { naam: delen[0].naam, zeker: true, nieuw: false, kleur: delen[0], delen: [], alStandaard: false };
  }
  const naam = combinatieNaam(delen);
  const bestaand = idx.opSleutel.get(kleurSleutel(naam));
  if (bestaand) return { naam: bestaand.naam, zeker: true, nieuw: false, kleur: bestaand, delen, alStandaard: false };
  return { naam, zeker: false, nieuw: true, kleur: null, delen, alStandaard: false };
}

/** "Marine" + "Zwart" wordt "Marine/zwart". */
export function combinatieNaam(delen: Pick<StandaardKleur, 'naam'>[]): string {
  return delen.map((d, i) => (i === 0 ? d.naam : d.naam.charAt(0).toLowerCase() + d.naam.slice(1))).join('/');
}

export type MaatUitkomst = {
  naam: string | null;
  zeker: boolean;
  reeks: string | null;
  alStandaard: boolean;
};

/**
 * Vertaalt een ruwe maat naar de vaste lijst: "XXL" wordt "2XL", "OneSize" wordt
 * "One size", "56 NL (50 FR)" wordt "56". Past de maat niet, dan `naam: null`.
 * Let op: dezelfde tekst kan in twee reeksen staan (44 als broek- en schoenmaat);
 * de waarde is dan gelijk, alleen de reeks verschilt.
 */
export function normaliseerMaat(ruw: string | null | undefined, lijst: VariantLijsten = STANDAARD_LIJSTEN): MaatUitkomst {
  const sleutel = maatSleutel(ruw);
  if (!sleutel) return { naam: null, zeker: false, reeks: null, alStandaard: false };
  const hit = maatIndex(lijst).opSleutel.get(sleutel);
  if (!hit) return { naam: null, zeker: false, reeks: null, alStandaard: false };
  return { naam: hit.maat, zeker: true, reeks: hit.reeks, alStandaard: String(ruw).trim() === hit.maat };
}

/** Korte vorm voor imports: de standaardnaam als die zeker is, anders de opgeschoonde ruwe waarde. */
export function kleurNaam(ruw: string | null | undefined, lijst: VariantLijsten = STANDAARD_LIJSTEN): string | null {
  const t = String(ruw ?? '').trim();
  if (!t) return null;
  const u = normaliseerKleur(t, lijst);
  return u.zeker && u.naam ? u.naam : t;
}

export function maatNaam(ruw: string | null | undefined, lijst: VariantLijsten = STANDAARD_LIJSTEN): string | null {
  const t = String(ruw ?? '').trim();
  if (!t) return null;
  const u = normaliseerMaat(t, lijst);
  return u.zeker && u.naam ? u.naam : t;
}

/** Sorteert maten volgens de vaste lijst (reeks, dan volgorde); onbekende maten numeriek of alfabetisch achteraan. */
export function sorteerMaten(maten: string[], lijst: VariantLijsten = STANDAARD_LIJSTEN): string[] {
  const idx = maatIndex(lijst).opSleutel;
  const plek = (m: string) => {
    const h = idx.get(maatSleutel(m));
    return h ? h.reeksVolgorde * 10000 + h.volgorde : null;
  };
  return [...maten].sort((a, b) => {
    const pa = plek(a);
    const pb = plek(b);
    if (pa != null && pb != null) return pa - pb;
    if (pa != null) return -1;
    if (pb != null) return 1;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, 'nl');
  });
}

/** Alle schrijfwijzen van een standaardkleur (naam plus aliassen), voor zoeken in ruwe variantdata. */
export function kleurZoektermen(naam: string, lijst: VariantLijsten = STANDAARD_LIJSTEN): string[] {
  const k = kleurIndex(lijst).opSleutel.get(kleurSleutel(naam));
  if (!k) return [naam.toLowerCase()];
  return [...new Set([k.naam.toLowerCase(), ...k.aliassen.map((a) => a.toLowerCase())])];
}

/** Zoekt een standaardkleur op naam of alias. */
export function vindKleur(naam: string, lijst: VariantLijsten = STANDAARD_LIJSTEN): StandaardKleur | null {
  return kleurIndex(lijst).opSleutel.get(kleurSleutel(naam)) ?? null;
}

/** Platte lijst van alle standaardmaten, met de reeks erbij, in sorteervolgorde. */
export function alleMaten(lijst: VariantLijsten = STANDAARD_LIJSTEN): { maat: string; reeks: string }[] {
  const uit: { maat: string; reeks: string }[] = [];
  for (const r of [...lijst.reeksen].sort((a, b) => a.volgorde - b.volgorde)) {
    for (const m of [...r.maten].sort((a, b) => a.volgorde - b.volgorde)) uit.push({ maat: m.maat, reeks: r.naam });
  }
  return uit;
}
