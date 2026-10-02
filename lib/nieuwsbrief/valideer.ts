/**
 * Ontwerp-JSON normaliseren: alles wat uit de database of de browser komt gaat
 * hier doorheen voordat het gerenderd of opgeslagen wordt. Ontbrekende velden
 * krijgen een standaardwaarde, getallen worden begrensd, kleuren gecontroleerd,
 * onbekende bloktypes vallen weg. Gooit nooit een fout.
 *
 * Puur: geen server-imports, ook bruikbaar in de editor.
 */
import { veiligeKleur } from './sanitize';
import {
  LETTERTYPEN,
  ONTWERP_VERSIE,
  SOCIAL_KANALEN,
  defaultBlok,
  defaultBlokStijl,
  defaultInstellingen,
  gelijkeVerhouding,
  nieuwId,
  type Blok,
  type BlokStijl,
  type BlokType,
  type Instellingen,
  type Kolom,
  type Lettertype,
  type Ontwerp,
  type Padding,
  type Rand,
  type Sectie,
  type SectieStijl,
  type SocialKanaal,
  type Uitlijning,
  type Verbergen,
} from './types';

type Los = Record<string, unknown>;

const isObj = (v: unknown): v is Los => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(v: unknown, def = '', max = 2000): string {
  if (typeof v !== 'string') return def;
  return v.slice(0, max);
}

function num(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function int(v: unknown, min: number, max: number, def: number): number {
  return Math.round(num(v, min, max, def));
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

/** Kleur of '' (transparant / overnemen). */
function kleurOfLeeg(v: unknown): string {
  if (v === '' || v === null || v === undefined || v === 'transparent') return '';
  return veiligeKleur(v) ?? '';
}

function kleur(v: unknown, def: string): string {
  return veiligeKleur(v) ?? def;
}

function keuze<T extends string>(v: unknown, opties: readonly T[], def: T): T {
  return opties.includes(v as T) ? (v as T) : def;
}

const UITLIJNINGEN: readonly Uitlijning[] = ['links', 'midden', 'rechts'];
const VERBERGEN: readonly Verbergen[] = ['geen', 'desktop', 'mobiel'];
const LIJNSTIJLEN = ['solid', 'dashed', 'dotted'] as const;
const BLOKTYPES: readonly BlokType[] = ['tekst', 'kop', 'afbeelding', 'knop', 'scheiding', 'ruimte', 'social', 'product', 'webversie', 'afmelden'];

function normPadding(v: unknown, def: Padding): Padding {
  if (typeof v === 'number') {
    const n = int(v, 0, 200, 0);
    return { boven: n, rechts: n, onder: n, links: n };
  }
  const o = isObj(v) ? v : {};
  return {
    boven: int(o.boven, 0, 200, def.boven),
    rechts: int(o.rechts, 0, 200, def.rechts),
    onder: int(o.onder, 0, 200, def.onder),
    links: int(o.links, 0, 200, def.links),
  };
}

function normInstellingen(v: unknown): Instellingen {
  const d = defaultInstellingen();
  const o = isObj(v) ? v : {};
  return {
    achtergrond: kleur(o.achtergrond, d.achtergrond),
    inhoudAchtergrond: kleur(o.inhoudAchtergrond, d.inhoudAchtergrond),
    breedte: int(o.breedte, 480, 800, d.breedte),
    lettertype: keuze(o.lettertype, Object.keys(LETTERTYPEN) as Lettertype[], d.lettertype),
    tekstkleur: kleur(o.tekstkleur, d.tekstkleur),
    linkkleur: kleur(o.linkkleur, d.linkkleur),
    kopkleur: kleur(o.kopkleur, d.kopkleur),
  };
}

function normBlokStijl(v: unknown, def: BlokStijl): BlokStijl {
  const o = isObj(v) ? v : {};
  return {
    padding: normPadding(o.padding, def.padding),
    achtergrond: o.achtergrond === undefined ? def.achtergrond : kleurOfLeeg(o.achtergrond),
    tekstkleur: o.tekstkleur === undefined ? def.tekstkleur : kleurOfLeeg(o.tekstkleur),
    uitlijning: keuze(o.uitlijning, UITLIJNINGEN, def.uitlijning),
    regelafstand: num(o.regelafstand, 0.8, 3, def.regelafstand),
    lettergrootte: int(o.lettergrootte, 8, 72, def.lettergrootte),
    verbergen: keuze(o.verbergen, VERBERGEN, def.verbergen),
  };
}

function normBlok(v: unknown): Blok | null {
  if (!isObj(v)) return null;
  const type = keuze<BlokType | ''>(v.type, BLOKTYPES, '');
  if (!type) return null;
  const d = defaultBlok(type);
  const id = str(v.id, '', 80) || nieuwId();
  const stijl = normBlokStijl(v.stijl, d.stijl ?? defaultBlokStijl());

  switch (d.type) {
    case 'tekst':
      return { ...d, id, stijl, html: str(v.html, '', 50_000) };
    case 'kop':
      return {
        ...d,
        id,
        stijl,
        tekst: str(v.tekst, '', 500),
        niveau: v.niveau === 1 || v.niveau === 2 || v.niveau === 3 ? v.niveau : d.niveau,
        balk: bool(v.balk, d.balk),
        letterafstand: num(v.letterafstand, 0, 1, 0),
        vet: bool(v.vet, true),
      };
    case 'afbeelding':
      return {
        ...d,
        id,
        stijl,
        src: str(v.src, '', 2000),
        alt: str(v.alt, '', 300),
        link: str(v.link, '', 2000),
        breedte: v.breedte === 'vol' || v.breedte === '100%' ? 'vol' : int(v.breedte, 20, 800, 0) || 'vol',
        radius: int(v.radius, 0, 400, 0),
      };
    case 'knop':
      return {
        ...d,
        id,
        stijl,
        tekst: str(v.tekst, d.tekst, 200),
        link: str(v.link, '', 2000),
        achtergrond: kleur(v.achtergrond, d.achtergrond),
        tekstkleur: kleur(v.tekstkleur, d.tekstkleur),
        radius: int(v.radius, 0, 60, d.radius),
        volleBreedte: bool(v.volleBreedte, false),
      };
    case 'scheiding':
      return {
        ...d,
        id,
        stijl,
        kleur: kleur(v.kleur, d.kleur),
        dikte: int(v.dikte, 1, 20, d.dikte),
        breedte: int(v.breedte, 5, 100, d.breedte),
        lijnstijl: keuze(v.lijnstijl, LIJNSTIJLEN, 'solid'),
      };
    case 'ruimte':
      return { ...d, id, stijl, hoogte: int(v.hoogte, 0, 300, d.hoogte) };
    case 'social': {
      const ruw = isObj(v.links) ? v.links : {};
      const links = {} as Record<SocialKanaal, string>;
      for (const k of SOCIAL_KANALEN) links[k] = str(ruw[k], '', 500).trim();
      return { ...d, id, stijl, links, iconKleur: kleur(v.iconKleur, d.iconKleur), grootte: int(v.grootte, 20, 56, d.grootte) };
    }
    case 'product':
      return {
        ...d,
        id,
        stijl,
        productId: typeof v.productId === 'string' && v.productId ? v.productId.slice(0, 80) : null,
        naam: str(v.naam, '', 300),
        merk: str(v.merk, '', 120),
        foto: str(v.foto, '', 2000),
        prijs: v.prijs === null || v.prijs === undefined || v.prijs === '' ? null : num(v.prijs, 0, 1_000_000, 0),
        toonPrijs: bool(v.toonPrijs, false),
        link: str(v.link, '', 2000),
        knopTekst: str(v.knopTekst, d.knopTekst, 100),
      };
    case 'webversie':
      return { ...d, id, stijl, tekst: str(v.tekst, d.tekst, 200) || d.tekst };
    case 'afmelden':
      return { ...d, id, stijl, tekst: str(v.tekst, d.tekst, 1000), linkTekst: str(v.linkTekst, d.linkTekst, 100) || d.linkTekst };
  }
}

function normRand(v: unknown): Rand | null {
  if (!isObj(v)) return null;
  const breedte = int(v.breedte, 0, 20, 0);
  if (!breedte) return null;
  return { breedte, kleur: kleur(v.kleur, '#e4e2e0'), stijl: keuze(v.stijl, LIJNSTIJLEN, 'solid') };
}

function normSectieStijl(v: unknown): SectieStijl {
  const o = isObj(v) ? v : {};
  const afb = str(o.achtergrondAfbeelding, '', 2000).trim();
  return {
    achtergrond: kleurOfLeeg(o.achtergrond),
    inhoudAchtergrond: kleurOfLeeg(o.inhoudAchtergrond),
    ...(afb ? { achtergrondAfbeelding: afb } : {}),
    rand: normRand(o.rand),
    padding: normPadding(o.padding, { boven: 0, rechts: 0, onder: 0, links: 0 }),
    radius: int(o.radius, 0, 60, 0),
  };
}

function normSectie(v: unknown): Sectie | null {
  if (!isObj(v)) return null;
  const ruweKolommen = Array.isArray(v.kolommen) ? v.kolommen.slice(0, 4) : [];
  const kolommen: Kolom[] = ruweKolommen.map((k) => {
    const o = isObj(k) ? k : {};
    const blokken = (Array.isArray(o.blokken) ? o.blokken : []).map(normBlok).filter((b): b is Blok => b !== null);
    return { id: str(o.id, '', 80) || nieuwId(), blokken };
  });
  if (kolommen.length === 0) kolommen.push({ id: nieuwId(), blokken: [] });

  let verhouding = Array.isArray(v.verhouding) ? v.verhouding.map((n) => num(n, 1, 100, 0)) : [];
  if (verhouding.length !== kolommen.length || verhouding.some((n) => n <= 0)) {
    verhouding = gelijkeVerhouding(kolommen.length);
  }

  const naam = str(v.naam, '', 80).trim();
  return {
    id: str(v.id, '', 80) || nieuwId(),
    ...(naam ? { naam } : {}),
    kolommen,
    verhouding,
    stijl: normSectieStijl(v.stijl),
    stapelenOpMobiel: bool(v.stapelenOpMobiel, true),
    verbergen: keuze(v.verbergen, VERBERGEN, 'geen'),
  };
}

/** Maak van willekeurige invoer een geldig Ontwerp. Gooit nooit. */
export function normaliseerOntwerp(v: unknown): Ontwerp {
  const o = isObj(v) ? v : {};
  const secties = (Array.isArray(o.secties) ? o.secties.slice(0, 200) : [])
    .map(normSectie)
    .filter((s): s is Sectie => s !== null);
  return { versie: ONTWERP_VERSIE, instellingen: normInstellingen(o.instellingen), secties };
}

/** Een losse sectie normaliseren (voor modules). Null als het geen sectie is. */
export function normaliseerSectie(v: unknown): Sectie | null {
  return normSectie(v);
}

/**
 * Strenge controle van de vorm voordat er iets wordt opgeslagen. Geeft een
 * Nederlandse foutmelding terug, of null als het in orde is.
 */
export function controleerOntwerpVorm(v: unknown): string | null {
  if (!isObj(v)) return 'Het ontwerp is leeg of onleesbaar.';
  if (!Array.isArray(v.secties)) return 'Het ontwerp mist de lijst met onderdelen.';
  if (v.secties.length > 200) return 'Het ontwerp heeft te veel onderdelen (maximaal 200).';
  let grootte = 0;
  try {
    grootte = JSON.stringify(v).length;
  } catch {
    return 'Het ontwerp is onleesbaar.';
  }
  if (grootte > 900_000) return 'Het ontwerp is te groot om op te slaan. Gebruik minder of kortere teksten.';
  return null;
}
