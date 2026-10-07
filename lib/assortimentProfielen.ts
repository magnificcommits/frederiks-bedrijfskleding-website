/**
 * Welke artikelen er op een branche- of vakpagina staan.
 *
 * Regel: een artikel komt alleen op een pagina als het aantoonbaar bij dat werk
 * past. Eerst moet `wel` matchen op merk + naam, daarna mag
 * `niet` niet matchen. Er wordt NOOIT aangevuld met willekeurige artikelen: zijn
 * er te weinig passende, dan toont de pagina er minder (en onder MIN geen blok).
 * Dat ging eerder mis: de vakpagina's pakten de eerste artikelen op alfabet uit
 * een categorie, waardoor er kniebeschermers op de pagina voor koks stonden.
 *
 * De patronen zijn bewust eenvoudige alternaties (a|b|c), zodat ze in
 * JavaScript en in Postgres (~*) hetzelfde werken. scripts/check-assortiment.mjs
 * zet ze om naar SQL om per pagina de volledige kandidatenlijst te controleren.
 */

export type AssortimentProfiel = {
  /** Categorie-slugs uit CATEGORIEEN; volgorde bepaalt de afwisseling. */
  categorieen: string[];
  /** Moet matchen op "merk naam subcategorie" (hoofdletterongevoelig). */
  wel: string;
  /** Mag niet matchen. */
  niet?: string;
  /** Licht voordeel bij de volgorde. */
  voorkeur?: string;
};

/** Nooit op een branche- of vakpagina: geen kledingstuk of niet voor volwassen werk. */
export const ALTIJD_NIET = 'kinderen|zipperpuller|klittenband|sokken|boxers|caleçons|reis- werktas';

// Kantoor- en horecakleding hoort niet op een pagina voor vakmensen, en andersom.
const GEEN_KANTOOR = 'xirtrum|mi-piace|tq amsterdam|brook taverner|blazer|blouse|koksjas|tailored|cardigan';
const GEEN_VAKMAN = 'snickers|fhb|blåkläder|hydrowear|fristads|upower|emma safety|grisport|pfanner|werkbroek|werkjas|werkshort|hi-vis|high vis|veiligheids|rws|multinorm|flamestat|knie|holster|overal|parka|thermo|cargo';

const BOUW_WEL = 'allroundwork|flexiwork|fhb|blåkläder|werkbroek|werkjas|werkshort|holster|kniebeschermer|gereedschapszak|hamerhouder|hi-vis|high vis|veiligheids|rws|protecwork|softshell|winterjas|parka|bodywarmer| s3|grisport|emma safety|t-shirt|sweater|hoodie';
const BOUW_NIET = `${GEEN_KANTOOR}|flamestat|lasover|multinorm|esd|carpet|dames-t-shirt|antibacteri|regenbroek|regenoveral`;

const INSTALLATIE_WEL = 'service|knie|holster|esd|flamestat|fr ast|allroundwork|flexiwork|werkbroek|werkjas|softshell|polo|sweatshirt|hoodie|t-shirt';
const INSTALLATIE_NIET = `${GEEN_KANTOOR}|zonder knie|hi-vis|high vis|veiligheids|rws|regen|lasover|winterjas|parka|antibacteri|kniebeschermer|gereedschapszak|hamerhouder|bermuda|shorts`;

const INDUSTRIE_WEL = 'multinorm|flamestat|fr ast|lasover|overal|hi-vis|high vis|veiligheids|rws|esd|werkbroek|werkjas|winterjas|parka|softshell|polo|t-shirt|sweater';
const INDUSTRIE_NIET = `${GEEN_KANTOOR}|kniebeschermer|gereedschapszak|hamerhouder|holster|antibacteri|bermuda|shorts|dames-t-shirt`;

const HORECA_WEL = 'koksjas|xirtrum|mi-piace|blouse|overhemd basis|broek zonder zakken|waistcoat|antibacteri';
const HORECA_NIET = 'blazer|jacket|tailored|flaired|jogpants|bermuda|snickers|allroundwork|liteWork|flexiwork|hi-vis|high vis|top 3/4';

const KANTOOR_WEL = 'brook taverner|mi-piace|tq amsterdam|xirtrum|blazer|blouse|overhemd basis|cardigan';
const KANTOOR_NIET = 'koksjas|jogpants|allroundwork|snickers|liteWork|bermuda|geïsoleerd|overshirt|fleece gevoerde';

const AGRI_WEL = 'fhb|amerikaanse overall|regenjas|regenbroek|regenoveral|winterjas|parka|bodywarmer|werkbroek|zaagbroek|grisport|emma safety|softshell|hardshell|fleece';
const AGRI_NIET = `${GEEN_KANTOOR}|esd|flamestat|lasover|multinorm|rws|hi-vis|high vis|veiligheids|carpet|dames-t-shirt|fleece cargo|microfleece|jasje in polytricot`;

const ZORG_WEL = '60°c|antibacteri|polykatoen|mi-piace|damespolo';
const ZORG_NIET = 'bodywarmer|blazer|bermuda|overhemd|koksjas|hi-vis|high vis|cargo';

export const PROFIELEN: Record<string, AssortimentProfiel> = {
  // ---------- Branches (/branches/...) ----------
  'branche:bouw-en-infra': {
    categorieen: ['broeken', 'jassen', 'werkschoenen', 't-shirts-en-polos', 'bodywarmers', 'truien-en-vesten', 'accessoires'],
    wel: BOUW_WEL, niet: BOUW_NIET, voorkeur: 'holster|hi-vis|high vis|rws| s3|kniebeschermer',
  },
  'branche:installatie-en-techniek': {
    categorieen: ['broeken', 't-shirts-en-polos', 'werkschoenen', 'jassen', 'truien-en-vesten'],
    wel: INSTALLATIE_WEL, niet: INSTALLATIE_NIET, voorkeur: 'service|esd|flamestat|fr ast|knie',
  },
  'branche:industrie-en-logistiek': {
    categorieen: ['overalls', 'broeken', 't-shirts-en-polos', 'jassen', 'werkschoenen', 'bodywarmers'],
    wel: INDUSTRIE_WEL, niet: INDUSTRIE_NIET, voorkeur: 'multinorm|flamestat|fr ast|esd|hi-vis|high vis|lasover',
  },
  'branche:horeca-en-food': {
    categorieen: ['blouses-en-overhemden', 'truien-en-vesten', 't-shirts-en-polos', 'broeken', 'rokken-en-jurken'],
    wel: HORECA_WEL, niet: HORECA_NIET, voorkeur: 'koksjas|waistcoat|broek zonder zakken',
  },
  'branche:kantoor-en-retail': {
    categorieen: ['blouses-en-overhemden', 't-shirts-en-polos', 'truien-en-vesten', 'broeken', 'rokken-en-jurken', 'jassen'],
    wel: KANTOOR_WEL, niet: KANTOOR_NIET, voorkeur: 'blazer|tailored|blouse|cardigan',
  },
  'branche:agrarisch-en-groen': {
    categorieen: ['overalls', 'broeken', 'jassen', 'bodywarmers', 'werkschoenen'],
    wel: AGRI_WEL, niet: AGRI_NIET, voorkeur: 'amerikaanse overall|regen|winterjas|zaagbroek',
  },
  'branche:zorg-en-salon': {
    categorieen: ['t-shirts-en-polos', 'blouses-en-overhemden', 'broeken', 'truien-en-vesten'],
    wel: ZORG_WEL, niet: ZORG_NIET, voorkeur: '60°c|polykatoen|antibacteri',
  },
  'branche:clubs-en-verenigingen': {
    categorieen: ['t-shirts-en-polos', 'truien-en-vesten', 'jassen', 'bodywarmers'],
    wel: 'wk. designed to work|kariban|tricorp',
    niet: `${GEEN_VAKMAN}|koksjas|antibacteri|dames-t-shirt|fleecevest|polytricot|jack day|jas met afneembare|fleece bodywarmer`,
    voorkeur: 't-shirt|polo|sweater|hoodie|softshell',
  },

  // ---------- Vakgebieden (/voor/...) ----------
  'vak:bouw-en-aannemers': {
    categorieen: ['broeken', 'accessoires', 'jassen', 'werkschoenen', 't-shirts-en-polos', 'truien-en-vesten'],
    wel: BOUW_WEL, niet: `${BOUW_NIET}|hi-vis|high vis|veiligheids|rws|protecwork`, voorkeur: 'holster|kniebeschermer|gereedschapszak|hamerhouder| s3',
  },
  'vak:schilders-en-afbouw': {
    categorieen: ['broeken', 'overalls', 'accessoires', 't-shirts-en-polos', 'truien-en-vesten', 'werkschoenen'],
    wel: 'allroundwork|flexiwork|vloerleggers|bib & brace|kniebeschermer|werkbroek|t-shirt|sweatshirt| s3',
    niet: `${BOUW_NIET}|hi-vis|high vis|veiligheids|rws|protecwork|gereedschapszak|hamerhouder|winter|geïsoleerd|parka`,
    voorkeur: 'vloerleggers|bib & brace|kniebeschermer',
  },
  'vak:elektro-en-servicetechniek': {
    categorieen: ['broeken', 't-shirts-en-polos', 'werkschoenen', 'jassen', 'truien-en-vesten'],
    wel: 'service|esd|flamestat|fr ast|knie|polo|softshell',
    niet: INSTALLATIE_NIET, voorkeur: 'esd|flamestat|fr ast|service',
  },
  'vak:automotive-en-garage': {
    categorieen: ['overalls', 'broeken', 't-shirts-en-polos', 'werkschoenen', 'truien-en-vesten'],
    wel: 'service|overall|werkbroek|knie|polo|t-shirt|softshell|esd| s3',
    niet: `${GEEN_KANTOOR}|hi-vis|high vis|veiligheids|rws|regen|lasover|multinorm|flamestat|winter|parka|antibacteri|kniebeschermer|gereedschapszak|hamerhouder|bermuda|shorts|dames-t-shirt`,
    voorkeur: 'service|overall|esd',
  },
  'vak:metaal-en-industrie': {
    categorieen: ['overalls', 'broeken', 't-shirts-en-polos', 'jassen', 'werkschoenen', 'truien-en-vesten'],
    wel: 'multinorm|flamestat|fr ast|lasover|overal|esd| s3|werkbroek|werkjas|polo|t-shirt|sweater',
    niet: `${INDUSTRIE_NIET}|regen|rws|hi-vis|high vis|veiligheids`, voorkeur: 'flamestat|lasover|multinorm|fr ast',
  },
  'vak:transport-en-logistiek': {
    categorieen: ['jassen', 'bodywarmers', 't-shirts-en-polos', 'broeken', 'werkschoenen', 'truien-en-vesten'],
    wel: 'hi-vis|high vis|veiligheids|rws|softshell|winterjas|parka|bodywarmer|polo|t-shirt|sweater|werkbroek| s3|esd',
    niet: `${INDUSTRIE_NIET}|flamestat|lasover|multinorm`, voorkeur: 'hi-vis|high vis|veiligheids|rws|parka|bodywarmer',
  },
  'vak:keuken-en-bediening': {
    categorieen: ['blouses-en-overhemden', 'truien-en-vesten', 't-shirts-en-polos', 'broeken', 'rokken-en-jurken'],
    wel: HORECA_WEL, niet: HORECA_NIET, voorkeur: 'koksjas|waistcoat|broek zonder zakken',
  },
  'vak:kantoor-en-receptie': {
    categorieen: ['blouses-en-overhemden', 'truien-en-vesten', 't-shirts-en-polos', 'broeken', 'rokken-en-jurken'],
    wel: KANTOOR_WEL, niet: KANTOOR_NIET, voorkeur: 'blazer|blouse|tailored|cardigan',
  },
  'vak:winkel-en-retail': {
    categorieen: ['t-shirts-en-polos', 'truien-en-vesten', 'bodywarmers', 'blouses-en-overhemden'],
    wel: 'polo|t-shirt|sweater|cardigan|bodywarmer|blouse|jumper',
    niet: `${GEEN_VAKMAN}|koksjas|antibacteri|blazer|jacket|fleecevest|tech blouse|overshirt|geruit|polytricot`,
    voorkeur: 'performance polo|cardigan|polo',
  },
  'vak:agrarisch-en-loonwerk': {
    categorieen: ['overalls', 'jassen', 'broeken', 'bodywarmers', 'werkschoenen'],
    wel: AGRI_WEL, niet: AGRI_NIET, voorkeur: 'amerikaanse overall|regen|winterjas',
  },
  'vak:hoveniers-en-groenvoorziening': {
    categorieen: ['broeken', 'jassen', 'accessoires', 'werkschoenen', 'bodywarmers'],
    wel: `${AGRI_WEL}|kniebeschermer|allroundwork|flexiwork`,
    niet: `${AGRI_NIET}|amerikaanse overall`, voorkeur: 'zaagbroek|kniebeschermer|regen|softshell',
  },
  'vak:zorg-en-welzijn': {
    categorieen: ['t-shirts-en-polos', 'broeken', 'truien-en-vesten', 'blouses-en-overhemden'],
    wel: '60°c|antibacteri|polykatoen|damespolo', niet: `${ZORG_NIET}|mi-piace`, voorkeur: '60°c|polykatoen',
  },
  'vak:kapsalon-en-beauty': {
    categorieen: ['blouses-en-overhemden', 't-shirts-en-polos', 'truien-en-vesten', 'rokken-en-jurken'],
    wel: 'mi-piace|xirtrum blouse|xirtrum craft|cardigan|antibacterieel dames',
    niet: 'blazer|jacket|bermuda|koksjas|overhemd basis men|shirt men|herencardigan|fleece', voorkeur: 'mi-piace|blouse',
  },
};

/** Minder dan dit aantal passende artikelen: geen blok tonen. */
export const MIN_ARTIKELEN = 3;
const MAX_PER_MERK = 3;

type Artikel = {
  id: string;
  naam: string;
  merk: string | null;
  subcategorie: string | null;
  categorieSlug: string | null;
  maten: string[];
  kleuren: string[];
};

// Alleen merk en naam: de subcategorie van leveranciers is onbetrouwbaar (Hydrowear zet
// zijn gewone multistretch-broek onder "Multinorm", wat hem op de pagina voor
// vlamvertragende kleding bracht).
export const zoektekst = (p: Pick<Artikel, 'naam' | 'merk'>) => `${p.merk ?? ''} ${p.naam}`.toLowerCase();

export function past(p: Pick<Artikel, 'naam' | 'merk' | 'subcategorie' | 'categorieSlug'>, pr: AssortimentProfiel): boolean {
  if (!p.categorieSlug || !pr.categorieen.includes(p.categorieSlug)) return false;
  const t = zoektekst(p);
  if (!new RegExp(pr.wel, 'i').test(t)) return false;
  if (pr.niet && new RegExp(pr.niet, 'i').test(t)) return false;
  return !new RegExp(ALTIJD_NIET, 'i').test(t);
}

/**
 * Tot `max` passende artikelen, om en om uit de categorieën van het profiel.
 * Eén per naam (WK levert hetzelfde shirt onder vier artikelnummers).
 */
export function kiesArtikelen<T extends Artikel>(alle: T[], pr: AssortimentProfiel, max = 8): T[] {
  const voorkeur = pr.voorkeur ? new RegExp(pr.voorkeur, 'i') : null;
  const score = (p: T) =>
    (voorkeur?.test(zoektekst(p)) ? 3 : 0) - (/dames|lady|ladies|women/i.test(p.naam) ? 0.5 : 0) + Math.min(p.maten.length, 10) / 10 + Math.min(p.kleuren.length, 8) / 16;
  const namen = new Set<string>();
  const passend = alle
    .filter((p) => past(p, pr))
    .sort((a, b) => score(b) - score(a) || a.naam.localeCompare(b.naam, 'nl'))
    .filter((p) => {
      const k = `${p.merk ?? ''}|${p.naam}`.toLowerCase();
      if (namen.has(k)) return false;
      namen.add(k);
      return true;
    });
  const perCat = pr.categorieen.map((c) => passend.filter((p) => p.categorieSlug === c));
  const gekozen: T[] = [];
  // Hoogstens drie van hetzelfde merk, zodat een pagina laat zien wat er te kiezen is.
  const perMerk = new Map<string, number>();
  const magNog = (p: T) => (perMerk.get(p.merk ?? '') ?? 0) < MAX_PER_MERK;
  const wachtrij = perCat.map((l) => [...l]);
  while (gekozen.length < max && wachtrij.some((l) => l.length)) {
    for (const lijst of wachtrij) {
      if (gekozen.length >= max) break;
      const i = lijst.findIndex(magNog);
      if (i < 0) { lijst.length = 0; continue; }
      const [p] = lijst.splice(i, 1);
      gekozen.push(p);
      perMerk.set(p.merk ?? '', (perMerk.get(p.merk ?? '') ?? 0) + 1);
    }
  }
  return gekozen.length >= MIN_ARTIKELEN ? gekozen : [];
}

/**
 * Normpagina's (/normen/...): een artikel staat er alleen als het de norm in zijn
 * normeringsveld noemt, of als de naam de norm zonder twijfel aangeeft (een
 * RWS-parka is EN ISO 20471). Geen naampatroon = alleen het normeringsveld.
 * Eerder vulde de pagina aan met de rest van de categorie, waardoor er gewone
 * jassen op de pagina over vlamvertragende kleding stonden.
 */
export const NORM_NAAM: Record<string, string> = {
  'en-iso-20471': 'hi-vis|high vis|veiligheidshesje|veiligheids-t-shirt|veiligheidssweater|veiligheidsbroek|veiligheidsparka|rws|protecwork',
  'en-iso-11612': 'flamestat|multinorm|fr ast|flame ',
  'en-1149-5': 'flamestat|multinorm|fr ast',
  'en-343': 'regenjas|regenbroek|regenoveral',
  'en-iso-20345': ' s1p| s3| s5| s7',
  'en-14404': 'kniebeschermer',
};

/** Zegt de naam (niet de rommelige subcategorie) dat het artikel de norm heeft? */
export function normUitNaam(p: { merk: string | null; naam: string }, normSlug: string): boolean {
  const pat = NORM_NAAM[normSlug];
  if (!pat) return false;
  const t = `${p.merk ?? ''} ${p.naam}`.toLowerCase();
  return new RegExp(pat, 'i').test(t) && !new RegExp(ALTIJD_NIET, 'i').test(t);
}
