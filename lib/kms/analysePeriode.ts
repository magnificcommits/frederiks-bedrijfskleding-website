/**
 * Periodes voor Analyse en Rapportages. Puur (geen serverimports), dus bruikbaar
 * in server components, de export-route en client components.
 *
 * Alle datums zijn 'yyyy-mm-dd' in Nederlandse tijd; `tot` is inclusief.
 * Een periode staat volledig in de URL: ?periode=kwartaal&vgl=jaar, of
 * ?periode=eigen&van=2026-01-01&tot=2026-03-31. Zo kun je een weergave delen
 * of vanaf de startpagina linken.
 */

export const PERIODE_KEUZES = [
  'maand',
  'vorige-maand',
  'kwartaal',
  'vorig-kwartaal',
  'jaar',
  'vorig-jaar',
  '12m',
  'eigen',
] as const;
export type PeriodeKeuze = (typeof PERIODE_KEUZES)[number];

export const PERIODE_LABEL: Record<PeriodeKeuze, string> = {
  maand: 'Deze maand',
  'vorige-maand': 'Vorige maand',
  kwartaal: 'Dit kwartaal',
  'vorig-kwartaal': 'Vorig kwartaal',
  jaar: 'Dit jaar',
  'vorig-jaar': 'Vorig jaar',
  '12m': '12 maanden',
  eigen: 'Eigen bereik',
};

export const VERGELIJK_KEUZES = ['vorige', 'jaar', 'geen'] as const;
export type VergelijkKeuze = (typeof VERGELIJK_KEUZES)[number];
export const VERGELIJK_LABEL: Record<VergelijkKeuze, string> = {
  vorige: 'Vorige periode',
  jaar: 'Vorig jaar',
  geen: 'Geen vergelijking',
};

export type Bereik = { van: string; tot: string; label: string };

export type Periode = Bereik & {
  keuze: PeriodeKeuze;
  /** Aantal dagen, inclusief begin en eind. */
  dagen: number;
  vergelijk: VergelijkKeuze;
  /** De vergelijkingsperiode, of null bij 'geen'. */
  vgl: Bereik | null;
  /** Peildatum: vandaag. Periodes lopen nooit verder dan vandaag. */
  vandaag: string;
};

export type PeriodeParams = { periode?: string; van?: string; tot?: string; vgl?: string };

const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MAANDEN_LANG = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

/* ------------------------------------------------------------------ */
/* Datumrekenen op 'yyyy-mm-dd' (UTC, zonder tijdzone-gedoe)            */
/* ------------------------------------------------------------------ */

export function isDatum(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function plusDagen(d: string, n: number): string {
  return iso(ms(d) + n * 86_400_000);
}

export function dagenTussen(a: string, b: string): number {
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

function laatsteDag(jaar: number, maand0: number): number {
  return new Date(Date.UTC(jaar, maand0 + 1, 0)).getUTCDate();
}

function maak(jaar: number, maand0: number, dag: number): string {
  const d = new Date(Date.UTC(jaar, maand0, 1));
  const j = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return `${j}-${String(m + 1).padStart(2, '0')}-${String(Math.min(dag, laatsteDag(j, m))).padStart(2, '0')}`;
}

function delen(d: string): [number, number, number] {
  return [Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))];
}

/** Zelfde datum een aantal maanden eerder/later; 31 maart min een maand wordt 28/29 februari. */
export function plusMaanden(d: string, n: number): string {
  const [j, m, dag] = delen(d);
  return maak(j, m + n, dag);
}

/** 'yyyy-mm' van elke maand die het bereik raakt. */
export function maandKeysTussen(van: string, tot: string): string[] {
  const keys: string[] = [];
  let [j, m] = delen(van);
  const [jt, mt] = delen(tot);
  while (j < jt || (j === jt && m <= mt)) {
    keys.push(`${j}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m > 11) { m = 0; j += 1; }
  }
  return keys;
}

/** Twaalf maandkeys, eindigend op de maand van `tot`. */
export function twaalfMaandenTot(tot: string): string[] {
  return maandKeysTussen(plusMaanden(`${tot.slice(0, 7)}-01`, -11), tot);
}

export function maandLabel(key: string, metJaar = false): string {
  const m = Number(key.slice(5, 7)) - 1;
  return metJaar ? `${MAANDEN_KORT[m]} ${key.slice(2, 4)}` : MAANDEN_KORT[m];
}

export function maandLabelLang(key: string): string {
  return `${MAANDEN_LANG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/** '3 okt 2026' */
export function datumKort(d: string | null | undefined): string {
  if (!d) return '-';
  const [j, m, dag] = delen(d.slice(0, 10));
  return `${dag} ${MAANDEN_KORT[m]} ${j}`;
}

/** Leesbaar bereik: 'okt 2026', '1–4 okt 2026', 'Q3 2026', '2025', '3 mrt – 12 jun 2026'. */
export function bereikLabel(van: string, tot: string): string {
  const [jv, mv, dv] = delen(van);
  const [jt, mt, dt] = delen(tot);
  const heleMaandStart = dv === 1;
  const heleMaandEind = dt === laatsteDag(jt, mt);
  if (jv === jt && mv === 0 && dv === 1 && mt === 11 && dt === 31) return String(jv);
  if (jv === jt && heleMaandStart && heleMaandEind && mv % 3 === 0 && mt === mv + 2) return `Q${mv / 3 + 1} ${jv}`;
  if (jv === jt && mv === mt) {
    if (heleMaandStart && heleMaandEind) return `${MAANDEN_LANG[mv]} ${jv}`;
    return dv === dt ? `${dv} ${MAANDEN_KORT[mv]} ${jv}` : `${dv}–${dt} ${MAANDEN_KORT[mv]} ${jv}`;
  }
  if (jv === jt) return `${dv} ${MAANDEN_KORT[mv]} – ${dt} ${MAANDEN_KORT[mt]} ${jv}`;
  return `${dv} ${MAANDEN_KORT[mv]} ${jv} – ${dt} ${MAANDEN_KORT[mt]} ${jt}`;
}

/* ------------------------------------------------------------------ */
/* Periode uit de URL                                                   */
/* ------------------------------------------------------------------ */

function nlVandaag(): string {
  const p: Record<string, string> = {};
  for (const d of new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())) p[d.type] = d.value;
  return `${p.year}-${p.month}-${p.day}`;
}

function bereikVoor(keuze: PeriodeKeuze, vandaag: string, van?: string, tot?: string): { van: string; tot: string } {
  const [j, m] = delen(vandaag);
  const kwartaalStart = m - (m % 3);
  switch (keuze) {
    case 'maand':
      return { van: maak(j, m, 1), tot: vandaag };
    case 'vorige-maand':
      return { van: maak(j, m - 1, 1), tot: maak(j, m - 1, 31) };
    case 'kwartaal':
      return { van: maak(j, kwartaalStart, 1), tot: vandaag };
    case 'vorig-kwartaal':
      return { van: maak(j, kwartaalStart - 3, 1), tot: maak(j, kwartaalStart - 1, 31) };
    case 'jaar':
      return { van: `${j}-01-01`, tot: vandaag };
    case 'vorig-jaar':
      return { van: `${j - 1}-01-01`, tot: `${j - 1}-12-31` };
    case '12m':
      return { van: maak(j, m - 11, 1), tot: vandaag };
    case 'eigen': {
      let a = isDatum(van) ? van : maak(j, m, 1);
      let b = isDatum(tot) ? tot : vandaag;
      if (a > b) [a, b] = [b, a];
      if (b > vandaag) b = vandaag;
      if (a > b) a = b;
      // Meer dan vijf jaar is niet zinvol en maakt de queries zwaar.
      if (dagenTussen(a, b) > 366 * 5) a = plusDagen(b, -366 * 5);
      return { van: a, tot: b };
    }
  }
}

/**
 * De vorige periode, zo eerlijk mogelijk vergeleken:
 * - lopende maand/kwartaal/jaar: dezelfde dagen van de vorige maand/kwartaal/jaar;
 * - hele maand/kwartaal/jaar: de hele vorige;
 * - eigen bereik: even lang, direct ervoor.
 */
function vorigeVoor(keuze: PeriodeKeuze, van: string, tot: string): { van: string; tot: string } {
  const lengte = dagenTussen(van, tot);
  switch (keuze) {
    case 'maand': {
      const v = plusMaanden(van, -1);
      const eind = maak(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, 31);
      const t = plusDagen(v, lengte);
      return { van: v, tot: t > eind ? eind : t };
    }
    case 'vorige-maand':
      return { van: plusMaanden(van, -1), tot: maak(Number(van.slice(0, 4)), Number(van.slice(5, 7)) - 2, 31) };
    case 'kwartaal': {
      const v = plusMaanden(van, -3);
      const eind = plusDagen(van, -1);
      const t = plusDagen(v, lengte);
      return { van: v, tot: t > eind ? eind : t };
    }
    case 'vorig-kwartaal':
      return { van: plusMaanden(van, -3), tot: plusDagen(van, -1) };
    case 'jaar':
      return { van: plusMaanden(van, -12), tot: plusMaanden(tot, -12) };
    case 'vorig-jaar':
      return { van: plusMaanden(van, -12), tot: plusMaanden(tot, -12) };
    case '12m':
      // De lopende maand is nog niet af: vergelijk met dezelfde dagen een jaar eerder.
      return { van: plusMaanden(van, -12), tot: plusMaanden(tot, -12) };
    case 'eigen':
      return { van: plusDagen(van, -(lengte + 1)), tot: plusDagen(van, -1) };
  }
}

export function leesPeriode(sp: PeriodeParams, standaard: PeriodeKeuze = 'maand', vandaagOverride?: string): Periode {
  const vandaag = vandaagOverride ?? nlVandaag();
  const keuze: PeriodeKeuze = (PERIODE_KEUZES as readonly string[]).includes(sp.periode ?? '')
    ? (sp.periode as PeriodeKeuze)
    : isDatum(sp.van) || isDatum(sp.tot)
      ? 'eigen'
      : standaard;
  const vergelijk: VergelijkKeuze = (VERGELIJK_KEUZES as readonly string[]).includes(sp.vgl ?? '')
    ? (sp.vgl as VergelijkKeuze)
    : 'vorige';

  const { van, tot } = bereikVoor(keuze, vandaag, sp.van, sp.tot);
  let vgl: Bereik | null = null;
  if (vergelijk === 'vorige') {
    const b = vorigeVoor(keuze, van, tot);
    vgl = { ...b, label: bereikLabel(b.van, b.tot) };
  } else if (vergelijk === 'jaar') {
    const b = { van: plusMaanden(van, -12), tot: plusMaanden(tot, -12) };
    vgl = { ...b, label: bereikLabel(b.van, b.tot) };
  }

  return {
    keuze,
    van,
    tot,
    label: bereikLabel(van, tot),
    dagen: dagenTussen(van, tot) + 1,
    vergelijk,
    vgl,
    vandaag,
  };
}

/**
 * Queryparameters die deze periode vastleggen, zonder standaardwaarden.
 * Met `expliciet` staat de periode er altijd in, ook 'maand': nodig waar de
 * standaard per pagina verschilt (het btw-rapport opent op vorig kwartaal).
 */
export function periodeParams(p: Pick<Periode, 'keuze' | 'van' | 'tot' | 'vergelijk'>, expliciet = false): Record<string, string> {
  const uit: Record<string, string> = {};
  if (p.keuze === 'eigen') {
    uit.periode = 'eigen';
    uit.van = p.van;
    uit.tot = p.tot;
  } else if (p.keuze !== 'maand' || expliciet) {
    uit.periode = p.keuze;
  }
  if (p.vergelijk !== 'vorige') uit.vgl = p.vergelijk;
  return uit;
}

/** URL met de periode plus extra parameters; lege waarden vallen weg. */
export function urlMet(pad: string, ...delen: Record<string, string | undefined | null>[]): string {
  const p = new URLSearchParams();
  for (const d of delen) for (const [k, v] of Object.entries(d)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${pad}?${qs}` : pad;
}

/** Valt een datum (of timestamp, al omgezet naar NL-datum) binnen het bereik? */
export function binnen(d: string | null | undefined, b: { van: string; tot: string } | null): boolean {
  return !!d && !!b && d >= b.van && d <= b.tot;
}

/**
 * Filterparameters van de lijsten (orders, facturen, offertes: FilterBalk):
 * ?datum_van=&datum_tot=&klant=. Zo opent een klik in een grafiek precies de
 * rijen waar het getal uit komt.
 */
export function lijstFilter(b: { van: string; tot: string } | null, extra: Record<string, string | null | undefined> = {}): Record<string, string> {
  const uit: Record<string, string> = {};
  if (b) {
    uit.datum_van = b.van;
    uit.datum_tot = b.tot;
  }
  for (const [k, v] of Object.entries(extra)) if (v) uit[k] = v;
  return uit;
}
