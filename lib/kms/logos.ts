import { kmsAdmin } from '@/lib/kms/adminClient';
import { downloadUrl } from '@/lib/kms/storage';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import { env } from '@/lib/env';

/**
 * Data-access voor de productie: logobibliotheek, decoraties per orderregel en
 * de werkbonnen (de productie-opdracht per order voor bedrukken en borduren).
 *
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side
 * gebruiken, altijd achter dashAuthed().
 *
 * Nieuwe kolommen en de tabel werkbonnen komen uit migratie
 * 20261004_productie_logos_werkbonnen. Zolang die niet gedraaid is, werkt alles
 * met de oude velden: dan ontbreken alleen kleuren, posities, extra bestanden en
 * een opgeslagen werkbonstatus.
 */

type PgFout = { code?: string; message?: string } | null | undefined;

/** Tabel bestaat (nog) niet: 42P01 in Postgres, PGRST205 in PostgREST. */
export function tabelOntbreekt(fout: PgFout): boolean {
  if (!fout) return false;
  if (fout.code === '42P01' || fout.code === 'PGRST205') return true;
  const m = String(fout.message ?? '').toLowerCase();
  return m.includes('relation') && m.includes('does not exist');
}

/* ------------------------------------------------------------------------- */
/* Typen                                                                      */
/* ------------------------------------------------------------------------- */

/** Afmetingen van een bitmap, gemeten uit de eerste bytes van het bestand. */
export type BeeldMeta = { formaat: string; breedte_px: number; hoogte_px: number; dpi: number | null };

export type ProductieSoort = 'vector' | 'bitmap' | 'borduur' | 'overig';

/** Een extra bestand naast de drie vaste kolommen (kolom logos.bestanden). */
export type ExtraBestand = {
  id: string;
  url: string;
  naam: string | null;
  soort: ProductieSoort;
  meta?: BeeldMeta | null;
  toegevoegd_op?: string | null;
};

export type LogoKleur = { naam: string | null; pantone: string | null; hex: string | null };
export type LogoPositie = { positie: string; breedte_cm: number | null; hoogte_cm: number | null };

export type Logo = {
  id: string;
  organisatie_id: string;
  naam: string;
  logo_bestand_url: string | null;
  vectorbestand_url: string | null;
  borduurbestand_url: string | null;
  /**
   * De bestandsnaam zoals Jessi hem aanleverde. De opslagnaam in de bucket is
   * gegenereerd om botsingen te voorkomen; deze kolom houdt de herkenbare naam
   * vast zodat een download weer 'Logo Garage Jansen.pdf' heet.
   */
  logo_bestand_naam: string | null;
  vectorbestand_naam: string | null;
  borduurbestand_naam: string | null;
  opmerkingen: string | null;
  created_at: string;
  /* Na migratie 20261004_productie_logos_werkbonnen; daarvoor undefined. */
  bestanden?: unknown;
  bestand_meta?: unknown;
  kleuren?: unknown;
  posities?: unknown;
  technieken?: string[] | null;
  steken?: number | null;
  bijgewerkt_op?: string | null;
};

export type LogoMetKlant = Logo & { organisatie_naam: string | null };

export type LogoVelden = {
  naam: string;
  logo_bestand_url?: string | null;
  vectorbestand_url?: string | null;
  borduurbestand_url?: string | null;
  logo_bestand_naam?: string | null;
  vectorbestand_naam?: string | null;
  borduurbestand_naam?: string | null;
  opmerkingen?: string | null;
};

/** Velden die pas na de migratie bestaan. */
export type LogoProductieVelden = {
  kleuren?: LogoKleur[];
  posities?: LogoPositie[];
  technieken?: string[];
  steken?: number | null;
  bestanden?: ExtraBestand[];
  bestand_meta?: Record<string, BeeldMeta | null> | null;
};

export const LOGO_TECHNIEKEN = ['borduren', 'bedrukken'] as const;

/** Plekken die Jessi het vaakst gebruikt; ook in de keuzelijst bij een positie. */
export const STANDAARD_POSITIES = [
  'Linker borst',
  'Rechter borst',
  'Midden borst',
  'Rug',
  'Nek',
  'Linker mouw',
  'Rechter mouw',
  'Broekspijp',
  'Pet voorkant',
];

/* ------------------------------------------------------------------------- */
/* Bestanden herkennen                                                        */
/* ------------------------------------------------------------------------- */

export type BestandSoort = 'afbeelding' | 'pdf' | 'overig';

/** Alleen wat een browser rechtstreeks als plaatje kan tonen. */
const AFBEELDING_EXTENSIES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'];
const VECTOR_EXTENSIES = ['ai', 'eps', 'svg', 'pdf', 'cdr', 'ps'];
const BORDUUR_EXTENSIES = ['dst', 'emb', 'pes', 'exp', 'jef', 'vp3', 'hus', 'xxx'];
const BITMAP_EXTENSIES = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'tif', 'tiff', 'bmp', 'avif', 'psd'];

/** Extensie uit één bron, zonder punt en in kleine letters. Leeg als er geen is. */
function extensieUit(bron: string | null | undefined): string {
  const zonderQuery = ((bron ?? '').split('?')[0] ?? '').split('#')[0] ?? '';
  const laatste = zonderQuery.split('/').pop() ?? '';
  const punt = laatste.lastIndexOf('.');
  return punt > 0 ? laatste.slice(punt + 1).toLowerCase() : '';
}

/**
 * Extensie uit de bewaarde naam, met de opslag-URL als terugval. Die terugval is
 * nodig omdat iemand een bestand best 'logo' zonder punt kan noemen: dan weet
 * alleen de opslagnaam nog dat het om een pdf gaat en blijft de preview werken.
 */
export function bestandExtensie(url: string | null, bestandsnaam?: string | null): string {
  return extensieUit(bestandsnaam?.trim()) || extensieUit(url);
}

/**
 * Waar het bestand in de lijst mee getoond kan worden. Een borduurbestand (.dst,
 * .emb) valt bewust onder 'overig': daar bestaat geen preview voor, dus dan tonen
 * we een blokje met de extensie.
 */
export function bestandSoort(url: string | null, bestandsnaam?: string | null): BestandSoort {
  const ext = bestandExtensie(url, bestandsnaam);
  if (ext === 'pdf') return 'pdf';
  if (AFBEELDING_EXTENSIES.includes(ext)) return 'afbeelding';
  return 'overig';
}

/** Wat de productie met het bestand kan: snijden/drukken (vector), alleen raster, of borduren. */
export function productieSoort(ext: string, standaard: ProductieSoort = 'overig'): ProductieSoort {
  if (BORDUUR_EXTENSIES.includes(ext)) return 'borduur';
  if (VECTOR_EXTENSIES.includes(ext)) return 'vector';
  if (BITMAP_EXTENSIES.includes(ext)) return 'bitmap';
  return standaard;
}

export const PRODUCTIE_SOORT_LABEL: Record<ProductieSoort, string> = {
  vector: 'Vector',
  bitmap: 'Bitmap',
  borduur: 'Borduurprogramma',
  overig: 'Overig',
};

export type LogoBestand = {
  /** 'logo' | 'vector' | 'borduur' voor de vaste kolommen, anders het id van een extra bestand. */
  sleutel: string;
  label: string;
  /** Voor tonen en openen in een nieuw tabblad. */
  url: string;
  /** Voor downloaden onder de originele naam. */
  downloadHref: string;
  /** Wat we onder de preview zetten; valt terug op de opslagnaam. */
  weergaveNaam: string;
  soort: BestandSoort;
  extensie: string;
  productie: ProductieSoort;
  meta: BeeldMeta | null;
  extra: boolean;
};

/** Laatste stukje van een URL als leesbare naam, voor rijen zonder bewaarde naam. */
function naamUitUrl(url: string): string {
  const zonderQuery = (url.split('?')[0] ?? '').split('#')[0] ?? '';
  const laatste = zonderQuery.split('/').pop() ?? '';
  try {
    return decodeURIComponent(laatste) || 'bestand';
  } catch {
    return laatste || 'bestand';
  }
}

function alsMeta(v: unknown): BeeldMeta | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  const b = Number(m.breedte_px);
  const h = Number(m.hoogte_px);
  if (!Number.isFinite(b) || !Number.isFinite(h) || b <= 0 || h <= 0) return null;
  const dpi = m.dpi == null ? null : Number(m.dpi);
  return { formaat: String(m.formaat ?? ''), breedte_px: b, hoogte_px: h, dpi: Number.isFinite(dpi) && dpi! > 0 ? dpi : null };
}

export function logoExtraBestanden(l: Logo): ExtraBestand[] {
  if (!Array.isArray(l.bestanden)) return [];
  const uit: ExtraBestand[] = [];
  for (const r of l.bestanden as unknown[]) {
    if (!r || typeof r !== 'object') continue;
    const b = r as Record<string, unknown>;
    const url = typeof b.url === 'string' ? b.url.trim() : '';
    if (!url) continue;
    const naam = typeof b.naam === 'string' ? b.naam : null;
    const soort = ['vector', 'bitmap', 'borduur', 'overig'].includes(String(b.soort))
      ? (b.soort as ProductieSoort)
      : productieSoort(bestandExtensie(url, naam));
    uit.push({
      id: typeof b.id === 'string' && b.id ? b.id : url,
      url,
      naam,
      soort,
      meta: alsMeta(b.meta),
      toegevoegd_op: typeof b.toegevoegd_op === 'string' ? b.toegevoegd_op : null,
    });
  }
  return uit;
}

function vasteMeta(l: Logo, sleutel: string): BeeldMeta | null {
  if (!l.bestand_meta || typeof l.bestand_meta !== 'object') return null;
  return alsMeta((l.bestand_meta as Record<string, unknown>)[sleutel]);
}

/**
 * Alle bestanden van een logo als één lijst, klaar om te tonen: eerst de drie
 * vaste kolommen, dan de extra bestanden. Alleen wat echt gevuld is komt terug.
 */
export function logoBestanden(l: Logo): LogoBestand[] {
  const bronnen: { sleutel: string; label: string; url: string | null; naam: string | null; standaard: ProductieSoort }[] = [
    { sleutel: 'logo', label: 'Logo', url: l.logo_bestand_url, naam: l.logo_bestand_naam, standaard: 'bitmap' },
    { sleutel: 'vector', label: 'Vector', url: l.vectorbestand_url, naam: l.vectorbestand_naam, standaard: 'vector' },
    { sleutel: 'borduur', label: 'Borduur', url: l.borduurbestand_url, naam: l.borduurbestand_naam, standaard: 'borduur' },
  ];

  const bestanden: LogoBestand[] = [];
  for (const bron of bronnen) {
    const url = bron.url?.trim();
    if (!url) continue;
    // Oude rijen (van voor de naam-kolommen) hebben geen bewaarde naam; die
    // vallen terug op het laatste stuk van de URL.
    const bewaardeNaam = bron.naam?.trim() || null;
    const ext = bestandExtensie(url, bewaardeNaam);
    bestanden.push({
      sleutel: bron.sleutel,
      label: bron.label,
      url,
      downloadHref: downloadUrl(url, bewaardeNaam) ?? url,
      weergaveNaam: bewaardeNaam ?? naamUitUrl(url),
      soort: bestandSoort(url, bewaardeNaam),
      extensie: ext,
      productie: bron.sleutel === 'borduur' ? 'borduur' : productieSoort(ext, bron.standaard),
      meta: vasteMeta(l, bron.sleutel),
      extra: false,
    });
  }
  for (const e of logoExtraBestanden(l)) {
    const ext = bestandExtensie(e.url, e.naam);
    bestanden.push({
      sleutel: e.id,
      label: PRODUCTIE_SOORT_LABEL[e.soort],
      url: e.url,
      downloadHref: downloadUrl(e.url, e.naam) ?? e.url,
      weergaveNaam: e.naam?.trim() || naamUitUrl(e.url),
      soort: bestandSoort(e.url, e.naam),
      extensie: ext,
      productie: e.soort,
      meta: e.meta ?? null,
      extra: true,
    });
  }
  return bestanden;
}

export function logoKleuren(l: Logo): LogoKleur[] {
  if (!Array.isArray(l.kleuren)) return [];
  return (l.kleuren as unknown[])
    .filter((k): k is Record<string, unknown> => Boolean(k) && typeof k === 'object')
    .map((k) => ({
      naam: typeof k.naam === 'string' && k.naam.trim() ? k.naam.trim() : null,
      pantone: typeof k.pantone === 'string' && k.pantone.trim() ? k.pantone.trim() : null,
      hex: typeof k.hex === 'string' && /^#[0-9a-f]{6}$/i.test(k.hex) ? k.hex.toLowerCase() : null,
    }))
    .filter((k) => k.naam || k.pantone || k.hex);
}

export function logoPosities(l: Logo): LogoPositie[] {
  if (!Array.isArray(l.posities)) return [];
  const getal = (v: unknown) => {
    const n = Number(v);
    return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
  };
  return (l.posities as unknown[])
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
    .map((p) => ({ positie: String(p.positie ?? '').trim(), breedte_cm: getal(p.breedte_cm), hoogte_cm: getal(p.hoogte_cm) }))
    .filter((p) => p.positie);
}

export function logoTechnieken(l: Logo): string[] {
  return Array.isArray(l.technieken) ? l.technieken.filter((t) => typeof t === 'string' && t) : [];
}

/* ------------------------------------------------------------------------- */
/* Resolutie en waarschuwingen                                                */
/* ------------------------------------------------------------------------- */

export type ResolutieOordeel = {
  niveau: 'goed' | 'matig' | 'laag';
  /** Effectieve dpi bij de referentiebreedte. */
  dpi: number;
  referentie_cm: number;
  /** Tot hoe breed het bestand scherp (300 dpi) gedrukt kan worden. */
  max_cm_scherp: number;
  tekst: string;
};

const cm = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

/**
 * Beoordeelt een bitmap voor drukwerk. De dpi in het bestand zelf zegt weinig
 * (een telefoon zet er 72 in, Photoshop 300); wat telt is hoeveel pixels er
 * over de werkelijke breedte op het kledingstuk komen. Daarom rekenen we met
 * de breedste standaardpositie van het logo, of anders met 10 cm (borstlogo).
 */
export function beoordeelResolutie(meta: BeeldMeta, referentieCm?: number | null): ResolutieOordeel {
  const ref = referentieCm && referentieCm > 0 ? referentieCm : 10;
  const dpi = Math.round(meta.breedte_px / (ref / 2.54));
  const maxCm = Math.round(((meta.breedte_px / 300) * 2.54) * 10) / 10;
  const niveau: ResolutieOordeel['niveau'] = dpi >= 300 ? 'goed' : dpi >= 150 ? 'matig' : 'laag';
  const kern = `${meta.breedte_px} × ${meta.hoogte_px} px, op ${cm(ref)} cm breed ${dpi} dpi.`;
  const tekst =
    niveau === 'goed'
      ? `${kern} Scherp genoeg voor drukwerk.`
      : niveau === 'matig'
        ? `${kern} Bruikbaar, maar randen worden zacht. Scherp tot ${cm(maxCm)} cm breed.`
        : `${kern} Te grof om te drukken. Scherp tot ${cm(maxCm)} cm breed; vraag een vectorbestand.`;
  return { niveau, dpi, referentie_cm: ref, max_cm_scherp: maxCm, tekst };
}

export type LogoStaat = {
  heeftVector: boolean;
  heeftBorduur: boolean;
  thumb: string | null;
  resolutie: ResolutieOordeel | null;
  technieken: string[];
  waarschuwingen: string[];
};

/** Alles wat de bibliotheek per logo wil weten, in één keer uitgerekend. */
export function logoStaat(l: Logo): LogoStaat {
  const bestanden = logoBestanden(l);
  const heeftVector = bestanden.some((b) => b.productie === 'vector');
  const heeftBorduur = bestanden.some((b) => b.productie === 'borduur');
  const plaatje = bestanden.find((b) => b.soort === 'afbeelding');
  const posities = logoPosities(l);
  const breedste = posities.reduce((m, p) => Math.max(m, p.breedte_cm ?? 0), 0) || null;
  const metMeta = bestanden.find((b) => b.productie === 'bitmap' && b.meta);
  const resolutie = metMeta?.meta ? beoordeelResolutie(metMeta.meta, breedste) : null;

  const technieken = logoTechnieken(l);
  const afgeleid = technieken.length
    ? technieken
    : [...(heeftBorduur ? ['borduren'] : []), ...(heeftVector || bestanden.some((b) => b.productie === 'bitmap') ? ['bedrukken'] : [])];

  const waarschuwingen: string[] = [];
  if (bestanden.length === 0) waarschuwingen.push('Nog geen bestand');
  else if (!heeftVector) waarschuwingen.push('Geen vectorbestand');
  if (afgeleid.includes('borduren') && !heeftBorduur) waarschuwingen.push('Geen borduurprogramma');
  if (!heeftVector && resolutie && resolutie.niveau !== 'goed') waarschuwingen.push(resolutie.niveau === 'laag' ? 'Resolutie te laag' : 'Resolutie matig');

  return { heeftVector, heeftBorduur, thumb: plaatje?.url ?? null, resolutie, technieken: afgeleid, waarschuwingen };
}

/* ------------------------------------------------------------------------- */
/* Afmetingen uit de eerste bytes (PNG, JPEG, GIF, WebP)                      */
/* ------------------------------------------------------------------------- */

/** Leest breedte, hoogte en (als die erin staat) de dpi uit de kop van een bitmap. */
export function meetBeeld(b: Uint8Array): BeeldMeta | null {
  const u16 = (i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
  const u16le = (i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
  const u32 = (i: number) => (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);
  const tekst = (i: number, n: number) => String.fromCharCode(...Array.from(b.subarray(i, i + n)));

  // PNG: IHDR staat altijd vooraan; pHYs (pixels per meter) vóór de beelddata.
  if (b.length >= 24 && b[0] === 0x89 && tekst(1, 3) === 'PNG') {
    const breedte_px = u32(16);
    const hoogte_px = u32(20);
    let dpi: number | null = null;
    let p = 8;
    while (p + 12 <= b.length) {
      const len = u32(p);
      const type = tekst(p + 4, 4);
      if (type === 'pHYs' && p + 17 <= b.length && b[p + 16] === 1) {
        const ppm = u32(p + 8);
        if (ppm > 0) dpi = Math.round(ppm * 0.0254);
      }
      if (type === 'IDAT' || type === 'IEND') break;
      p += 12 + len;
    }
    return breedte_px > 0 && hoogte_px > 0 ? { formaat: 'png', breedte_px, hoogte_px, dpi } : null;
  }

  // JPEG: JFIF-kop voor de dichtheid, SOF-marker voor de afmetingen.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let p = 2;
    let dpi: number | null = null;
    while (p + 4 <= b.length) {
      if (b[p] !== 0xff) { p++; continue; }
      const m = b[p + 1] ?? 0;
      if (m === 0xff) { p++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
      const len = u16(p + 2);
      if (m === 0xe0 && p + 16 <= b.length && tekst(p + 4, 4) === 'JFIF') {
        const eenheid = b[p + 11];
        const x = u16(p + 12);
        if (eenheid === 1 && x > 1) dpi = x;
        else if (eenheid === 2 && x > 1) dpi = Math.round(x * 2.54);
      }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        if (p + 9 > b.length) return null;
        const hoogte_px = u16(p + 5);
        const breedte_px = u16(p + 7);
        return breedte_px > 0 && hoogte_px > 0 ? { formaat: 'jpg', breedte_px, hoogte_px, dpi } : null;
      }
      if (len < 2) return null;
      p += 2 + len;
    }
    return null;
  }

  // GIF
  if (b.length >= 10 && tekst(0, 4) === 'GIF8') {
    const breedte_px = u16le(6);
    const hoogte_px = u16le(8);
    return breedte_px > 0 && hoogte_px > 0 ? { formaat: 'gif', breedte_px, hoogte_px, dpi: null } : null;
  }

  // WebP
  if (b.length >= 30 && tekst(0, 4) === 'RIFF' && tekst(8, 4) === 'WEBP') {
    const soort = tekst(12, 4);
    let breedte_px = 0;
    let hoogte_px = 0;
    if (soort === 'VP8X') {
      breedte_px = 1 + ((b[24] ?? 0) | ((b[25] ?? 0) << 8) | ((b[26] ?? 0) << 16));
      hoogte_px = 1 + ((b[27] ?? 0) | ((b[28] ?? 0) << 8) | ((b[29] ?? 0) << 16));
    } else if (soort === 'VP8 ') {
      breedte_px = u16le(26) & 0x3fff;
      hoogte_px = u16le(28) & 0x3fff;
    } else if (soort === 'VP8L') {
      const bits = ((b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24)) >>> 0;
      breedte_px = (bits & 0x3fff) + 1;
      hoogte_px = ((bits >> 14) & 0x3fff) + 1;
    }
    return breedte_px > 0 && hoogte_px > 0 ? { formaat: 'webp', breedte_px, hoogte_px, dpi: null } : null;
  }

  return null;
}

/** Meet een geüpload bestand (alleen de kop, max. 256 kB lezen). */
export async function meetBestand(file: File | null): Promise<BeeldMeta | null> {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  try {
    const kop = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
    return meetBeeld(kop);
  } catch {
    return null;
  }
}

/**
 * Meet een bestand dat al in onze eigen opslag staat (voor logo's van vóór de
 * meting). Alleen onze eigen Supabase-opslag: een geplakte URL naar een
 * willekeurige server halen we bewust niet op.
 */
export async function meetOpAfstand(url: string | null | undefined): Promise<BeeldMeta | null> {
  if (!url || !env.supabaseUrl) return null;
  try {
    const eigen = new URL(env.supabaseUrl).host;
    const doel = new URL(url);
    if (doel.protocol !== 'https:' || doel.host !== eigen || !doel.pathname.includes('/storage/v1/object/public/')) return null;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 4000);
    const res = await fetch(doel.toString(), { headers: { Range: 'bytes=0-262143' }, signal: stop.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok && res.status !== 206) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return meetBeeld(buf.subarray(0, 262144));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- */
/* Logo's lezen en schrijven                                                  */
/* ------------------------------------------------------------------------- */

export type Techniek = 'bedrukken' | 'borduren';

export type Decoratie = {
  id: string;
  orderregel_id: string;
  logo_id: string | null;
  techniek: Techniek;
  positie: string | null;
  afmeting: string | null;
  opmerkingen: string | null;
  created_at: string;
  logo: Logo | null;
};

export type DecoratieVelden = {
  logo_id?: string | null;
  techniek: Techniek;
  positie?: string | null;
  afmeting?: string | null;
  opmerkingen?: string | null;
};

export type OrganisatieKeuze = { id: string; naam: string };

export type WerkbonRegel = {
  id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  decoraties: Decoratie[];
};

export type Werkbon = {
  id: string;
  ordernummer: string | null;
  organisatie_id: string | null;
  organisatie_naam: string | null;
  organisatie_plaats: string | null;
  medewerker_naam: string | null;
  afdeling_naam: string | null;
  besteldatum: string | null;
  order_status: string | null;
  regels: WerkbonRegel[];
};

export async function listOrganisaties(): Promise<OrganisatieKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam').order('naam');
  return (data as OrganisatieKeuze[]) ?? [];
}

export async function listLogos(orgId: string): Promise<Logo[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('logos').select('*').eq('organisatie_id', orgId).order('naam');
  return (data as Logo[]) ?? [];
}

export async function getLogo(id: string): Promise<LogoMetKlant | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('logos').select('*, organisaties(naam)').eq('id', id).maybeSingle();
  if (!data) return null;
  const { organisaties, ...rest } = data as unknown as Logo & { organisaties: { naam: string | null } | null };
  return { ...rest, organisatie_naam: organisaties?.naam ?? null };
}

/** Schone zoekterm voor een ilike-filter: tekens die de filtertaal breken eruit. */
export function schoneZoekterm(q: string | null | undefined): string {
  return String(q ?? '').replace(/[%,()*\\:."']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export type LogoFilter = { org?: string; q?: string };

/** Alle logo's van alle klanten (of één klant), met de klantnaam erbij. */
export async function listAlleLogos(f: LogoFilter = {}): Promise<LogoMetKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb.from('logos').select('*, organisaties(naam)');
  if (f.org) q = q.eq('organisatie_id', f.org);
  const term = schoneZoekterm(f.q);
  if (term) {
    const { data: orgs } = await sb.from('organisaties').select('id').ilike('naam', `%${term}%`).limit(100);
    const ids = ((orgs as { id: string }[]) ?? []).map((o) => o.id);
    q = ids.length ? q.or(`naam.ilike.%${term}%,organisatie_id.in.(${ids.join(',')})`) : q.ilike('naam', `%${term}%`);
  }
  const { data } = await q.order('naam').limit(600);
  return ((data as unknown as (Logo & { organisaties: { naam: string | null } | null })[]) ?? [])
    .map(({ organisaties, ...rest }) => ({ ...rest, organisatie_naam: organisaties?.naam ?? null }))
    .sort((a, b) => (a.organisatie_naam ?? '').localeCompare(b.organisatie_naam ?? '', 'nl') || a.naam.localeCompare(b.naam, 'nl'));
}

export async function maakLogo(orgId: string, v: LogoVelden): Promise<boolean> {
  return Boolean(await maakLogoMetId(orgId, v));
}

/** Als maakLogo, maar geeft het nieuwe id terug. Productievelden vallen weg zonder migratie. */
export async function maakLogoMetId(orgId: string, v: LogoVelden, extra: LogoProductieVelden = {}): Promise<string | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const rij: Record<string, unknown> = { organisatie_id: orgId, ...v, ...extra };
  let res = await sb.from('logos').insert(rij).select('id').single();
  if (res.error && kolomOntbreekt(res.error) && Object.keys(extra).length > 0) {
    res = await sb.from('logos').insert({ organisatie_id: orgId, ...v }).select('id').single();
  }
  if (res.error || !res.data) return null;
  return (res.data as { id: string }).id;
}

export async function werkLogo(id: string, v: Partial<LogoVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').update(v).eq('id', id);
  return !error;
}

export type LogoOpslaan = { ok: boolean; migratieNodig: boolean };

/**
 * Werkt gewone en productievelden bij. Bestaan de nieuwe kolommen nog niet, dan
 * slaan we de gewone velden alsnog op en melden we dat de migratie nodig is.
 */
export async function werkLogoProductie(id: string, v: Partial<LogoVelden>, extra: LogoProductieVelden): Promise<LogoOpslaan> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, migratieNodig: false };
  const { error } = await sb.from('logos').update({ ...v, ...extra, bijgewerkt_op: new Date().toISOString() }).eq('id', id);
  if (!error) return { ok: true, migratieNodig: false };
  if (!kolomOntbreekt(error)) return { ok: false, migratieNodig: false };
  if (Object.keys(v).length === 0) return { ok: false, migratieNodig: true };
  const { error: tweede } = await sb.from('logos').update(v).eq('id', id);
  return { ok: !tweede, migratieNodig: true };
}

export async function verwijderLogo(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').delete().eq('id', id);
  return !error;
}

/* ------------------------------------------------------------------------- */
/* Waar wordt een logo gebruikt                                               */
/* ------------------------------------------------------------------------- */

export type LogoGebruikProef = { id: string; naam: string; status: string; order_id: string | null; techniek: string; created_at: string };
export type LogoGebruikOrder = { id: string; ordernummer: number | null; status: string; besteldatum: string | null; regels: { item_naam: string; aantal: number; techniek: string; positie: string | null }[] };

function urlsVan(l: Logo): string[] {
  return logoBestanden(l).map((b) => b.url);
}

function proefGebruikt(p: { logo_url: string | null; ontwerp: unknown }, urls: string[]): boolean {
  if (p.logo_url && urls.includes(p.logo_url)) return true;
  if (!p.ontwerp) return false;
  try {
    const json = JSON.stringify(p.ontwerp);
    return urls.some((u) => json.includes(u));
  } catch {
    return false;
  }
}

/** Welke drukproeven en orders dit logo gebruiken. Drukproeven kennen het logo via de URL. */
export async function logoGebruik(l: Logo): Promise<{ proeven: LogoGebruikProef[]; orders: LogoGebruikOrder[] }> {
  const sb = kmsAdmin(); if (!sb) return { proeven: [], orders: [] };
  const urls = urlsVan(l);
  const [{ data: proefData }, { data: decoData }] = await Promise.all([
    urls.length
      ? sb.from('drukproeven').select('id, naam, status, order_id, techniek, created_at, logo_url, ontwerp').eq('organisatie_id', l.organisatie_id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    sb.from('regel_decoraties').select('techniek, positie, orderregel:orderregels(order_id, item_naam, aantal)').eq('logo_id', l.id),
  ]);
  const proeven = ((proefData as (LogoGebruikProef & { logo_url: string | null; ontwerp: unknown })[]) ?? [])
    .filter((p) => proefGebruikt(p, urls))
    .map(({ id, naam, status, order_id, techniek, created_at }) => ({ id, naam, status, order_id, techniek, created_at }));

  type DecoRij = { techniek: string; positie: string | null; orderregel: { order_id: string; item_naam: string; aantal: number } | null };
  const decos = ((decoData as unknown as DecoRij[]) ?? []).filter((d) => d.orderregel);
  const orderIds = [...new Set(decos.map((d) => d.orderregel!.order_id))];
  if (orderIds.length === 0) return { proeven, orders: [] };
  const { data: orderData } = await sb.from('orders').select('id, ordernummer, status, besteldatum').in('id', orderIds.slice(0, 200));
  const orders = ((orderData as Omit<LogoGebruikOrder, 'regels'>[]) ?? [])
    .map((o) => ({
      ...o,
      regels: decos
        .filter((d) => d.orderregel!.order_id === o.id)
        .map((d) => ({ item_naam: d.orderregel!.item_naam, aantal: d.orderregel!.aantal, techniek: d.techniek, positie: d.positie })),
    }))
    .sort((a, b) => (b.ordernummer ?? 0) - (a.ordernummer ?? 0));
  return { proeven, orders };
}

/** Per logo: in hoeveel drukproeven en orders het voorkomt (voor de bibliotheek). */
export async function gebruikTelling(logos: Logo[]): Promise<Record<string, { proeven: number; orders: number }>> {
  const sb = kmsAdmin();
  const uit: Record<string, { proeven: number; orders: number }> = {};
  for (const l of logos) uit[l.id] = { proeven: 0, orders: 0 };
  if (!sb || logos.length === 0) return uit;

  const ids = logos.map((l) => l.id);
  const orgIds = [...new Set(logos.map((l) => l.organisatie_id))];
  const [decoRes, proefRes] = await Promise.all([
    sb.from('regel_decoraties').select('logo_id, orderregel:orderregels(order_id)').in('logo_id', ids.slice(0, 300)),
    sb.from('drukproeven').select('organisatie_id, logo_url, ontwerp').in('organisatie_id', orgIds.slice(0, 300)).limit(3000),
  ]);
  const ordersPerLogo = new Map<string, Set<string>>();
  for (const d of (decoRes.data as unknown as { logo_id: string; orderregel: { order_id: string } | null }[]) ?? []) {
    if (!d.orderregel) continue;
    const set = ordersPerLogo.get(d.logo_id) ?? new Set<string>();
    set.add(d.orderregel.order_id);
    ordersPerLogo.set(d.logo_id, set);
  }
  const proeven = (proefRes.data as { organisatie_id: string; logo_url: string | null; ontwerp: unknown }[]) ?? [];
  for (const l of logos) {
    const urls = urlsVan(l);
    uit[l.id] = {
      orders: ordersPerLogo.get(l.id)?.size ?? 0,
      proeven: urls.length ? proeven.filter((p) => p.organisatie_id === l.organisatie_id && proefGebruikt(p, urls)).length : 0,
    };
  }
  return uit;
}

/* ------------------------------------------------------------------------- */
/* Decoraties per orderregel                                                  */
/* ------------------------------------------------------------------------- */

const DECORATIE_SELECT = '*, logo:logos(*)';

export async function listDecoraties(orderId: string): Promise<Record<string, Decoratie[]>> {
  const sb = kmsAdmin(); if (!sb) return {};
  const { data: regels } = await sb.from('orderregels').select('id').eq('order_id', orderId);
  const ids = ((regels as { id: string }[]) ?? []).map((r) => r.id);
  if (ids.length === 0) return {};
  const { data } = await sb.from('regel_decoraties').select(DECORATIE_SELECT).in('orderregel_id', ids).order('created_at');
  const rows = (data as Decoratie[]) ?? [];
  const map: Record<string, Decoratie[]> = {};
  for (const d of rows) {
    (map[d.orderregel_id] ??= []).push(d);
  }
  return map;
}

export async function maakDecoratie(orderregelId: string, v: DecoratieVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('regel_decoraties').insert({ orderregel_id: orderregelId, ...v });
  return !error;
}

export async function verwijderDecoratie(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('regel_decoraties').delete().eq('id', id);
  return !error;
}

export async function getOrderVoorWerkbon(orderId: string): Promise<Werkbon | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data: order } = await sb
    .from('orders')
    .select('id, ordernummer, status, besteldatum, organisatie_id, organisatie:organisaties(naam, plaats), medewerker:medewerkers!orders_medewerker_id_fkey(naam), afdeling:afdelingen(naam)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;
  const o = order as unknown as {
    id: string;
    ordernummer: string | null;
    status: string | null;
    besteldatum: string | null;
    organisatie_id: string | null;
    organisatie: { naam: string | null; plaats: string | null } | null;
    medewerker: { naam: string | null } | null;
    afdeling: { naam: string | null } | null;
  };

  const { data: regelData } = await sb
    .from('orderregels')
    .select('id, item_naam, maat, kleur, aantal')
    .eq('order_id', orderId)
    .order('item_naam');
  const baseRegels = (regelData as Omit<WerkbonRegel, 'decoraties'>[]) ?? [];
  const decoratieMap = await listDecoraties(orderId);

  return {
    id: o.id,
    ordernummer: o.ordernummer,
    organisatie_id: o.organisatie_id,
    organisatie_naam: o.organisatie?.naam ?? null,
    organisatie_plaats: o.organisatie?.plaats ?? null,
    medewerker_naam: o.medewerker?.naam ?? null,
    afdeling_naam: o.afdeling?.naam ?? null,
    besteldatum: o.besteldatum,
    order_status: o.status,
    regels: baseRegels.map((r) => ({ ...r, decoraties: decoratieMap[r.id] ?? [] })),
  };
}

/* ------------------------------------------------------------------------- */
/* Werkbonnen: de productieplanning                                           */
/* ------------------------------------------------------------------------- */

export const WERKBON_STATUSSEN = ['wacht_op_drukproef', 'goedgekeurd', 'in_productie', 'klaar'] as const;
export type WerkbonStatus = (typeof WERKBON_STATUSSEN)[number];

export const WERKBON_LABEL: Record<WerkbonStatus, string> = {
  wacht_op_drukproef: 'Wacht op drukproef',
  goedgekeurd: 'Goedgekeurd',
  in_productie: 'In productie',
  klaar: 'Klaar',
};

export const WERKBON_UITLEG: Record<WerkbonStatus, string> = {
  wacht_op_drukproef: 'De klant moet de drukproef nog goedkeuren, of er is er nog geen.',
  goedgekeurd: 'Proef akkoord. Kan op de machine zodra de kleding binnen is.',
  in_productie: 'Wordt nu bedrukt of geborduurd.',
  klaar: 'Bedrukt of geborduurd, klaar om in te pakken.',
};

/** Orderstatussen waarin het bedrukken/borduren al achter de rug is. */
const NA_PRODUCTIE = ['verpakken', 'bezorgen', 'verzonden', 'factureren', 'afgerond'];
/** Orderstatussen vóór de productie (zelfde lijst als bij de drukproefgoedkeuring). */
export const VOOR_PRODUCTIE = ['concept', 'offerte_verstuurd', 'offerte_goedgekeurd', 'nog_bestellen', 'besteld', 'deellevering', 'compleet_geleverd'];
const IN_PRODUCTIE = ['bedrukken', 'borduren'];

export type WerkbonRij = {
  order_id: string;
  status: WerkbonStatus;
  deadline: string | null;
  notitie: string | null;
  gestart_op: string | null;
  klaar_op: string | null;
  bijgewerkt_op: string | null;
};

export type WerkbonKaart = {
  order_id: string;
  ordernummer: number | null;
  order_status: string;
  organisatie_id: string;
  klant_naam: string;
  besteldatum: string | null;
  status: WerkbonStatus;
  /** 'opgeslagen' als Jessi de status zelf zette, anders afgeleid uit order en proeven. */
  bron: 'opgeslagen' | 'afgeleid';
  deadline: string | null;
  notitie: string | null;
  klaar_op: string | null;
  artikelen: { naam: string; aantal: number }[];
  aantal: number;
  posities: string[];
  technieken: string[];
  logos: { id: string; naam: string }[];
  thumb: string | null;
  proeven: { totaal: number; goedgekeurd: number; open: number; afgekeurd: number };
  waarschuwingen: string[];
};

function inStukken<T>(lijst: T[], grootte = 100): T[][] {
  const uit: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) uit.push(lijst.slice(i, i + grootte));
  return uit;
}

function afgeleideStatus(orderStatus: string, proeven: WerkbonKaart['proeven']): WerkbonStatus {
  if (NA_PRODUCTIE.includes(orderStatus)) return 'klaar';
  if (proeven.goedgekeurd > 0) return 'goedgekeurd';
  if (IN_PRODUCTIE.includes(orderStatus) && proeven.totaal === 0) return 'goedgekeurd';
  return 'wacht_op_drukproef';
}

function alsWerkbonStatus(s: unknown): WerkbonStatus | null {
  return (WERKBON_STATUSSEN as readonly string[]).includes(String(s)) ? (s as WerkbonStatus) : null;
}

/**
 * Bouwt de werkbonnen. Een order hoort erbij als er decoraties op een regel
 * staan, als er een drukproef aan hangt of als de order op bedrukken/borduren
 * staat. Met `alleenOrder` alleen die ene order (voor de werkbonpagina).
 */
async function bouwWerkbonnen(alleenOrder?: string): Promise<{ kaarten: WerkbonKaart[]; tabelBestaat: boolean }> {
  const sb = kmsAdmin();
  if (!sb) return { kaarten: [], tabelBestaat: false };

  type DecoRij = {
    logo_id: string | null;
    techniek: string | null;
    positie: string | null;
    afmeting: string | null;
    orderregel: { id: string; order_id: string; item_naam: string; aantal: number } | null;
  };
  type ProefRij = { id: string; order_id: string; status: string; techniek: string; positie: string | null; logo_url: string | null; afbeelding_url: string | null };

  let decoQ = sb
    .from('regel_decoraties')
    .select('logo_id, techniek, positie, afmeting, orderregel:orderregels!inner(id, order_id, item_naam, aantal)')
    .limit(5000);
  let proefQ = sb.from('drukproeven').select('id, order_id, status, techniek, positie, logo_url, afbeelding_url').not('order_id', 'is', null).order('created_at', { ascending: false }).limit(3000);
  let prodQ = sb.from('orders').select('id').in('status', IN_PRODUCTIE).limit(1000);
  if (alleenOrder) {
    decoQ = decoQ.eq('orderregel.order_id', alleenOrder);
    proefQ = proefQ.eq('order_id', alleenOrder);
    prodQ = prodQ.eq('id', alleenOrder);
  }
  const [decoRes, proefRes, prodRes] = await Promise.all([decoQ, proefQ, prodQ]);
  const decos = ((decoRes.data as unknown as DecoRij[]) ?? []).filter((d) => d.orderregel);
  const proeven = (proefRes.data as ProefRij[]) ?? [];

  const orderIds = new Set<string>();
  decos.forEach((d) => orderIds.add(d.orderregel!.order_id));
  proeven.forEach((p) => orderIds.add(p.order_id));
  ((prodRes.data as { id: string }[]) ?? []).forEach((o) => orderIds.add(o.id));
  if (alleenOrder) orderIds.add(alleenOrder);
  const ids = [...orderIds];
  if (ids.length === 0) return { kaarten: [], tabelBestaat: true };

  type OrderRij = { id: string; ordernummer: number | null; status: string; organisatie_id: string; besteldatum: string | null; created_at: string; organisaties: { naam: string | null } | null };
  const orders: OrderRij[] = [];
  const regels: { id: string; order_id: string; item_naam: string; aantal: number }[] = [];
  const werkbonRijen = new Map<string, WerkbonRij>();
  let tabelBestaat = true;
  for (const stuk of inStukken(ids)) {
    const [o, r, w] = await Promise.all([
      sb.from('orders').select('id, ordernummer, status, organisatie_id, besteldatum, created_at, organisaties(naam)').in('id', stuk),
      sb.from('orderregels').select('id, order_id, item_naam, aantal').in('order_id', stuk),
      tabelBestaat ? sb.from('werkbonnen').select('*').in('order_id', stuk) : Promise.resolve({ data: [], error: null }),
    ]);
    orders.push(...((o.data as unknown as OrderRij[]) ?? []));
    regels.push(...((r.data as typeof regels) ?? []));
    if (w.error) {
      if (tabelOntbreekt(w.error)) tabelBestaat = false;
    } else {
      for (const rij of (w.data as WerkbonRij[]) ?? []) werkbonRijen.set(rij.order_id, rij);
    }
  }

  const logoIds = [...new Set(decos.map((d) => d.logo_id).filter((v): v is string => Boolean(v)))];
  const logoMap = new Map<string, Logo>();
  for (const stuk of inStukken(logoIds)) {
    const { data } = await sb.from('logos').select('*').in('id', stuk);
    for (const l of (data as Logo[]) ?? []) logoMap.set(l.id, l);
  }

  const nu = Date.now();
  const kaarten: WerkbonKaart[] = [];
  for (const o of orders) {
    const oDecos = decos.filter((d) => d.orderregel!.order_id === o.id);
    const oProeven = proeven.filter((p) => p.order_id === o.id);
    const oRegels = regels.filter((r) => r.order_id === o.id);
    const proefTelling = {
      totaal: oProeven.length,
      goedgekeurd: oProeven.filter((p) => p.status === 'goedgekeurd').length,
      afgekeurd: oProeven.filter((p) => p.status === 'afgekeurd').length,
      open: oProeven.filter((p) => p.status === 'concept' || p.status === 'verstuurd').length,
    };

    const rij = werkbonRijen.get(o.id);
    const opgeslagen = alsWerkbonStatus(rij?.status);
    let status: WerkbonStatus = opgeslagen ?? afgeleideStatus(o.status, proefTelling);
    // Is de order al verder (ingepakt, verzonden), dan is het werk hoe dan ook klaar.
    if (NA_PRODUCTIE.includes(o.status)) status = 'klaar';

    // Oude afgeronde orders vullen de kolom Klaar niet eindeloos: 45 dagen.
    if (status === 'klaar' && !alleenOrder) {
      const moment = Date.parse(rij?.klaar_op ?? o.besteldatum ?? o.created_at);
      if (Number.isFinite(moment) && nu - moment > 45 * 86400000) continue;
    }

    const decoRegelIds = new Set(oDecos.map((d) => d.orderregel!.id));
    const relevant = decoRegelIds.size ? oRegels.filter((r) => decoRegelIds.has(r.id)) : oRegels;
    const perNaam = new Map<string, number>();
    for (const r of relevant) perNaam.set(r.item_naam, (perNaam.get(r.item_naam) ?? 0) + (Number(r.aantal) || 0));
    const artikelen = [...perNaam.entries()].map(([naam, aantal]) => ({ naam, aantal })).sort((a, b) => b.aantal - a.aantal);

    const posities = [...new Set([...oDecos.map((d) => d.positie), ...oProeven.map((p) => p.positie)].map((p) => (p ?? '').trim()).filter((p) => p && p !== 'Zie drukproef'))];
    const technieken = [...new Set([...oDecos.map((d) => d.techniek), ...oProeven.map((p) => p.techniek)].filter((t): t is string => Boolean(t)))];
    if (technieken.length === 0 && IN_PRODUCTIE.includes(o.status)) technieken.push(o.status);

    const logos: { id: string; naam: string }[] = [];
    const waarschuwingen: string[] = [];
    let thumb: string | null = null;
    for (const d of oDecos) {
      if (!d.logo_id) {
        if (!waarschuwingen.includes('Decoratie zonder logo')) waarschuwingen.push('Decoratie zonder logo');
        continue;
      }
      const l = logoMap.get(d.logo_id);
      if (!l) continue;
      if (!logos.some((x) => x.id === l.id)) logos.push({ id: l.id, naam: l.naam });
      const st = logoStaat(l);
      thumb ??= st.thumb;
      if (d.techniek === 'borduren' && !st.heeftBorduur) {
        const w = `Geen borduurprogramma voor ${l.naam}`;
        if (!waarschuwingen.includes(w)) waarschuwingen.push(w);
      }
      if (d.techniek !== 'borduren' && !st.heeftVector) {
        const w = `Geen vectorbestand voor ${l.naam}`;
        if (!waarschuwingen.includes(w)) waarschuwingen.push(w);
      }
    }
    const goedeProef = oProeven.find((p) => p.status === 'goedgekeurd') ?? oProeven[0];
    thumb ??= goedeProef?.logo_url ?? goedeProef?.afbeelding_url ?? null;
    if (oDecos.length === 0) waarschuwingen.push('Nog geen logo of positie op de werkbon');
    if (proefTelling.afgekeurd > 0 && proefTelling.goedgekeurd === 0) waarschuwingen.push('Drukproef afgekeurd');

    kaarten.push({
      order_id: o.id,
      ordernummer: o.ordernummer,
      order_status: o.status,
      organisatie_id: o.organisatie_id,
      klant_naam: o.organisaties?.naam ?? 'Onbekende klant',
      besteldatum: o.besteldatum ?? o.created_at,
      status,
      bron: opgeslagen ? 'opgeslagen' : 'afgeleid',
      deadline: rij?.deadline ?? null,
      notitie: rij?.notitie ?? null,
      klaar_op: rij?.klaar_op ?? null,
      artikelen,
      aantal: artikelen.reduce((n, a) => n + a.aantal, 0),
      posities,
      technieken,
      logos,
      thumb,
      proeven: proefTelling,
      waarschuwingen,
    });
  }

  kaarten.sort((a, b) => {
    const da = a.deadline ? Date.parse(a.deadline) : Infinity;
    const db = b.deadline ? Date.parse(b.deadline) : Infinity;
    if (da !== db) return da - db;
    return (b.ordernummer ?? 0) - (a.ordernummer ?? 0);
  });
  return { kaarten, tabelBestaat };
}

export async function listWerkbonnen(): Promise<{ kaarten: WerkbonKaart[]; tabelBestaat: boolean }> {
  return bouwWerkbonnen();
}

export async function werkbonVoorOrder(orderId: string): Promise<{ kaart: WerkbonKaart | null; tabelBestaat: boolean }> {
  const { kaarten, tabelBestaat } = await bouwWerkbonnen(orderId);
  return { kaart: kaarten.find((k) => k.order_id === orderId) ?? null, tabelBestaat };
}

export type WerkbonPatch = { status?: WerkbonStatus; deadline?: string | null; notitie?: string | null };

/**
 * Slaat status, deadline of notitie van een werkbon op (upsert op order_id).
 * Bestaat de tabel nog niet, dan geven we dat terug in plaats van een fout.
 */
export async function zetWerkbon(orderId: string, patch: WerkbonPatch, huidigeStatus: WerkbonStatus): Promise<{ ok: boolean; tabelOntbreekt: boolean }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false, tabelOntbreekt: false };
  const rij: Record<string, unknown> = { order_id: orderId, status: patch.status ?? huidigeStatus, bijgewerkt_op: new Date().toISOString() };
  if (patch.deadline !== undefined) rij.deadline = patch.deadline;
  if (patch.notitie !== undefined) rij.notitie = patch.notitie;
  if (patch.status === 'in_productie' && huidigeStatus !== 'in_productie') rij.gestart_op = new Date().toISOString();
  if (patch.status === 'klaar' && huidigeStatus !== 'klaar') rij.klaar_op = new Date().toISOString();
  if (patch.status && patch.status !== 'klaar') rij.klaar_op = null;
  const { error } = await sb.from('werkbonnen').upsert(rij, { onConflict: 'order_id' });
  if (error) return { ok: false, tabelOntbreekt: tabelOntbreekt(error) };
  return { ok: true, tabelOntbreekt: false };
}

/**
 * Houdt de orderstatus in de pas met de werkbon: start de productie, dan gaat
 * een order die nog vóór de productie stond naar bedrukken/borduren; is het
 * werk klaar, dan gaat een order op bedrukken/borduren door naar verpakken.
 * Een order die al verder is laten we staan.
 */
export async function volgOrderstatus(orderId: string, status: WerkbonStatus, techniek: string | null): Promise<{ van: string; naar: string } | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data } = await sb.from('orders').select('status').eq('id', orderId).maybeSingle();
  const huidig = (data as { status: string } | null)?.status;
  if (!huidig) return null;
  let naar: string | null = null;
  if (status === 'in_productie' && VOOR_PRODUCTIE.includes(huidig)) naar = techniek === 'bedrukken' ? 'bedrukken' : 'borduren';
  if (status === 'klaar' && IN_PRODUCTIE.includes(huidig)) naar = 'verpakken';
  if (!naar || naar === huidig) return null;
  const { error } = await sb.from('orders').update({ status: naar }).eq('id', orderId);
  return error ? null : { van: huidig, naar };
}
