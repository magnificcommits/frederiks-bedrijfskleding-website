/**
 * Gedeelde hulpjes voor de FilterBalk (components/dashboard/FilterBalk.tsx) en
 * voor de serverpagina's die de filters uit de URL lezen. Geen database, geen
 * React: alleen typen en pure functies, zodat client en server hetzelfde
 * rekenen (bijvoorbeeld wat "deze maand" is).
 *
 * URL-afspraken per filtersoort:
 * - select:  `?param=waarde`
 * - multi:   `?param=a,b` (komma-gescheiden)
 * - datum:   `?param=maand` (een preset) of `?param_van=2026-01-01&param_tot=2026-03-31`
 * - bedrag:  `?param_min=100&param_max=500`
 * - aanuit:  `?param=1`
 * - zoek:    `?param=<id>` (keuze uit een typeahead)
 */

/** Eén keuze in een select, multi of zoekfilter. */
export type FilterOptie = {
  waarde: string;
  label: string;
  /** Kleine tweede regel, bijv. de plaats of de klant. */
  sub?: string | null;
  /** Aantal treffers, als tellertje achter de optie. */
  aantal?: number | null;
};

/** Context voor een zoekactie: de huidige URL-parameters, zodat hij kan inperken. */
export type FilterContext = Record<string, string>;

/** Server action achter een typeaheadfilter. Moet zelf dashAuthed() controleren. */
export type FilterZoekActie = (term: string, context: FilterContext) => Promise<FilterOptie[]>;

type Basis = {
  /** Naam in de URL. Bij datum en bedrag de stam: `_van`/`_tot` en `_min`/`_max` komen erachter. */
  param: string;
  label: string;
  /** Altijd zichtbaar in de balk. Zonder deze vlag staat het filter onder "Meer filters". */
  hoofd?: boolean;
};

export type FilterDef =
  | (Basis & { soort: 'select'; opties: FilterOptie[]; leegLabel?: string })
  | (Basis & {
      soort: 'multi';
      opties: FilterOptie[];
      /** 'chips': een rij aan/uit-chips onder de balk (handig bij weinig opties). Standaard een uitklaplijst. */
      weergave?: 'lijst' | 'chips';
    })
  | (Basis & { soort: 'datum' })
  | (Basis & { soort: 'bedrag' })
  | (Basis & { soort: 'aanuit'; /** Tekst op de chip als het filter aan staat. */ chipLabel?: string })
  | (Basis & {
      soort: 'zoek';
      zoek: FilterZoekActie;
      /** Label van de huidige keuze; de server zoekt dat op, want in de URL staat alleen een id. */
      huidigLabel?: string | null;
      placeholder?: string;
      /** Hint onder het veld zolang er niets getypt is, bijv. "Typ minstens 2 letters". */
      hint?: string;
    });

/* ------------------------------------------------------------------ */
/* Datumpresets                                                        */
/* ------------------------------------------------------------------ */

export const DATUM_PRESETS = [
  { waarde: 'week', label: 'Deze week' },
  { waarde: 'maand', label: 'Deze maand' },
  { waarde: 'vorigemaand', label: 'Vorige maand' },
  { waarde: 'kwartaal', label: 'Dit kwartaal' },
  { waarde: 'jaar', label: 'Dit jaar' },
  { waarde: '30d', label: 'Laatste 30 dagen' },
  { waarde: '90d', label: 'Laatste 90 dagen' },
] as const;

export type DatumPreset = (typeof DATUM_PRESETS)[number]['waarde'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Vandaag in Nederland als { j, m, d } (maand 1-12). De server draait in UTC. */
function vandaagNL(): { j: number; m: number; d: number } {
  const delen = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
    .split('-')
    .map(Number);
  return { j: delen[0], m: delen[1], d: delen[2] };
}

function iso(j: number, m: number, d: number): string {
  // Date.UTC rekent overlopende dagen en maanden zelf door (0 = laatste dag vorige maand).
  const dt = new Date(Date.UTC(j, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

/** Datum als ISO-string, `dagen` verschoven ten opzichte van vandaag (NL). */
export function vandaagPlus(dagen = 0): string {
  const { j, m, d } = vandaagNL();
  return iso(j, m, d + dagen);
}

/** Begin en eind (beide inclusief) van een preset. */
export function presetBereik(preset: string): { van: string; tot: string } | null {
  const { j, m, d } = vandaagNL();
  switch (preset) {
    case 'week': {
      // Maandag als eerste dag van de week.
      const wd = new Date(Date.UTC(j, m - 1, d)).getUTCDay();
      const terug = (wd + 6) % 7;
      return { van: iso(j, m, d - terug), tot: iso(j, m, d - terug + 6) };
    }
    case 'maand':
      return { van: iso(j, m, 1), tot: iso(j, m + 1, 0) };
    case 'vorigemaand':
      return { van: iso(j, m - 1, 1), tot: iso(j, m, 0) };
    case 'kwartaal': {
      const start = Math.floor((m - 1) / 3) * 3 + 1;
      return { van: iso(j, start, 1), tot: iso(j, start + 3, 0) };
    }
    case 'jaar':
      return { van: iso(j, 1, 1), tot: iso(j, 12, 31) };
    case '30d':
      return { van: iso(j, m, d - 29), tot: iso(j, m, d) };
    case '90d':
      return { van: iso(j, m, d - 89), tot: iso(j, m, d) };
    default:
      return null;
  }
}

export type Periode = {
  /** Inclusief, ISO-datum. */
  van: string | null;
  /** Inclusief, ISO-datum. */
  tot: string | null;
  /** De dag na `tot`, handig voor `lt` op een timestamp-kolom. */
  totExclusief: string | null;
};

type Params = Record<string, string | string[] | undefined>;

/** Eén waarde uit searchParams, getrimd. Arrays (?a=1&a=2) worden de eerste. */
export function param(sp: Params, sleutel: string): string {
  const v = sp[sleutel];
  return (Array.isArray(v) ? v[0] ?? '' : v ?? '').trim();
}

/** Komma-gescheiden lijst uit de URL. */
export function lijstParam(sp: Params, sleutel: string): string[] {
  return param(sp, sleutel)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Getal uit de URL (komma als decimaalteken mag), of null. */
export function getalParam(sp: Params, sleutel: string): number | null {
  const ruw = param(sp, sleutel).replace(',', '.');
  if (!ruw) return null;
  const n = Number(ruw);
  return Number.isFinite(n) ? n : null;
}

/** Periode uit `?param=<preset>` of `?param_van=&param_tot=`. Leeg = geen filter. */
export function periodeParam(sp: Params, stam: string): Periode {
  const preset = param(sp, stam);
  const bereik = preset ? presetBereik(preset) : null;
  let van = bereik?.van ?? param(sp, `${stam}_van`);
  let tot = bereik?.tot ?? param(sp, `${stam}_tot`);
  if (!ISO.test(van)) van = '';
  if (!ISO.test(tot)) tot = '';
  if (van && tot && van > tot) [van, tot] = [tot, van];
  const totExclusief = tot ? (() => {
    const [j, m, d] = tot.split('-').map(Number);
    return iso(j, m, d + 1);
  })() : null;
  return { van: van || null, tot: tot || null, totExclusief };
}

/** Bedragbereik uit `?param_min=&param_max=`. */
export function bedragParam(sp: Params, stam: string): { min: number | null; max: number | null } {
  return { min: getalParam(sp, `${stam}_min`), max: getalParam(sp, `${stam}_max`) };
}

/** Alle URL-sleutels die bij een filterdefinitie horen. */
export function sleutelsVan(def: Pick<FilterDef, 'soort' | 'param'>): string[] {
  if (def.soort === 'datum') return [def.param, `${def.param}_van`, `${def.param}_tot`];
  if (def.soort === 'bedrag') return [`${def.param}_min`, `${def.param}_max`];
  return [def.param];
}

/**
 * URL van de lijst met alle huidige parameters, plus wijzigingen. Een lege
 * waarde of null wist de parameter. Meldingen (?ok=, ?fout=) gaan er altijd af;
 * de pagina alleen als je hem zelf meegeeft.
 */
export function lijstUrl(basis: string, sp: Params, wijzig: Record<string, string | number | null | undefined> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (MELDINGEN.includes(k)) continue;
    const w = Array.isArray(v) ? v[0] : v;
    if (w) p.set(k, w);
  }
  p.delete('pagina');
  for (const [k, v] of Object.entries(wijzig)) {
    if (v === null || v === undefined || v === '' || (k === 'pagina' && Number(v) <= 1)) p.delete(k);
    else p.set(k, String(v));
  }
  const qs = p.toString();
  return qs ? `${basis}?${qs}` : basis;
}

/** Parameters die een melding na een actie dragen; die horen niet in een bewaarde weergave of link. */
export const MELDINGEN = ['ok', 'fout', 'melding', 'gemaild', 'mailfout', 'aantal', 'gelukt', 'mislukt', 'over', 'rest'];

/** Alle parameters als platte Record, zonder meldingen en paginering. Voor StatusChips' `bewaar`. */
export function bewaarParams(sp: Params, zonder: string[] = []): Record<string, string | undefined> {
  const uit: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (MELDINGEN.includes(k) || k === 'pagina' || zonder.includes(k)) continue;
    const w = Array.isArray(v) ? v[0] : v;
    if (w) uit[k] = w;
  }
  return uit;
}

/** Een UUID? Voor filters waar een id in de URL staat. */
export function isUuid(s: string | null | undefined): s is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s ?? ''));
}

/** Een id die gegarandeerd niets vindt, voor `in('id', [])`-situaties. */
export const GEEN_ID = '00000000-0000-0000-0000-000000000000';
