/**
 * Soorten afspraken en de standaardbeschikbaarheid. Puur (geen serverimports),
 * dus bruikbaar in de AfspraakKiezer, de API en het KMS.
 */

export const AFSPRAAK_SOORTEN = ['advies', 'showroom', 'pasdag'] as const;
export type AfspraakSoort = (typeof AFSPRAAK_SOORTEN)[number];

export const AFSPRAAK_STATUSSEN = ['gepland', 'geweest', 'no_show', 'geannuleerd'] as const;
export type AfspraakStatus = (typeof AFSPRAAK_STATUSSEN)[number];

export const STATUS_LABEL: Record<AfspraakStatus, string> = {
  gepland: 'Gepland',
  geweest: 'Geweest',
  no_show: 'Niet komen opdagen',
  geannuleerd: 'Geannuleerd',
};

export type SoortInfo = {
  /** Korte naam zoals in de kiezer en de agenda. */
  label: string;
  /** Duur zoals de bezoeker hem leest. */
  duurTekst: string;
  /** Eén zin over wat je kunt verwachten. */
  uitleg: string;
};

export const SOORT_INFO: Record<AfspraakSoort, SoortInfo> = {
  advies: {
    label: 'Adviesgesprek',
    duurTekst: 'bellen of video, 20 min',
    uitleg: 'Je vertelt wat je mensen doen, Jessi denkt mee over kleding, normen en budget. Daarna weet je wat een logische volgende stap is.',
  },
  showroom: {
    label: 'Showroombezoek Hengelo',
    duurTekst: '45 min',
    uitleg: 'Voelen, passen en vergelijken in de showroom in de Brouwersmolen. Neem gerust je logo mee, dan kijken we meteen naar bedrukken of borduren.',
  },
  pasdag: {
    label: 'Pasdag bij jou op locatie',
    duurTekst: 'duur in overleg',
    uitleg: 'Jessi komt met pasmaten naar je bedrijf, zodat iedereen de goede maat heeft zonder werktijd kwijt te raken. Kies een voorkeursmoment, de rest stemmen we samen af.',
  },
};

export function isSoort(v: unknown): v is AfspraakSoort {
  return typeof v === 'string' && (AFSPRAAK_SOORTEN as readonly string[]).includes(v);
}

export function isAfspraakStatus(v: unknown): v is AfspraakStatus {
  return typeof v === 'string' && (AFSPRAAK_STATUSSEN as readonly string[]).includes(v);
}

export type Tijdvak = { van: string; tot: string };

export type Beschikbaarheid = {
  /** 0 = zondag ... 6 = zaterdag. */
  werkdagen: number[];
  /** Blokken binnen een werkdag waarin geboekt kan worden, 'hh:mm'. */
  tijdvakken: Tijdvak[];
  /** Minuten vrij tussen twee afspraken (reistijd, voorbereiden). */
  bufferMin: number;
  /** Maximaal aantal online geboekte afspraken per dag. */
  maxPerDag: number;
  /** Dagen waarop niet geboekt kan worden ('yyyy-mm-dd'), bijvoorbeeld vakantie. */
  geblokkeerd: string[];
  /** Hoeveel dagen vooruit er geboekt kan worden. */
  dagenVooruit: number;
  /** Minimaal aantal uren tussen nu en het begin van een afspraak. */
  minUrenVooraf: number;
  /** Om de hoeveel minuten een starttijd wordt aangeboden. */
  stapMin: number;
  /** Per soort: aan/uit en duur in minuten. */
  soorten: Record<AfspraakSoort, { actief: boolean; duurMin: number }>;
  /** In wiens agenda de afspraken komen (taak_personen.id). Leeg = Jessi of de eerste persoon. */
  persoonId: string | null;
  /** Losse tijden die Jessi dichtzette, per dag: begintijden van blokjes van `stapMin` minuten. */
  geslotenTijden: Record<string, string[]>;
  /** Dagen die buiten de vaste werkdagen toch open zijn (bijvoorbeeld een zaterdag). */
  extraDagen: string[];
};

export const STANDAARD_BESCHIKBAARHEID: Beschikbaarheid = {
  werkdagen: [1, 2, 3, 4, 5],
  tijdvakken: [
    { van: '09:00', tot: '12:00' },
    { van: '13:00', tot: '17:00' },
  ],
  bufferMin: 15,
  maxPerDag: 4,
  geblokkeerd: [],
  dagenVooruit: 28,
  minUrenVooraf: 18,
  stapMin: 30,
  soorten: {
    advies: { actief: true, duurMin: 20 },
    showroom: { actief: true, duurMin: 45 },
    pasdag: { actief: true, duurMin: 120 },
  },
  persoonId: null,
  geslotenTijden: {},
  extraDagen: [],
};

const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function getal(v: unknown, min: number, max: number, terugval: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : terugval;
}

/** Ingelezen JSON (of formulierwaarden) netjes maken; onbekende of foute waarden vallen terug op de standaard. */
export function normaliseerBeschikbaarheid(v: unknown): Beschikbaarheid {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const s = STANDAARD_BESCHIKBAARHEID;

  const werkdagen = Array.isArray(o.werkdagen)
    ? [...new Set(o.werkdagen.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : s.werkdagen;

  const tijdvakken = Array.isArray(o.tijdvakken)
    ? (o.tijdvakken as unknown[])
        .map((t) => (typeof t === 'object' && t ? (t as Record<string, unknown>) : {}))
        .map((t) => ({ van: String(t.van ?? ''), tot: String(t.tot ?? '') }))
        .filter((t) => TIJD.test(t.van) && TIJD.test(t.tot) && t.tot > t.van)
        .sort((a, b) => a.van.localeCompare(b.van))
        .slice(0, 6)
    : s.tijdvakken;

  const geblokkeerd = Array.isArray(o.geblokkeerd)
    ? [...new Set((o.geblokkeerd as unknown[]).map((d) => String(d ?? '').trim()).filter((d) => DATUM.test(d)))].sort().slice(0, 400)
    : s.geblokkeerd;

  const ruweSoorten = (typeof o.soorten === 'object' && o.soorten ? o.soorten : {}) as Record<string, Record<string, unknown> | undefined>;
  const soorten = Object.fromEntries(
    AFSPRAAK_SOORTEN.map((k) => {
      const r = ruweSoorten[k] ?? {};
      return [
        k,
        {
          actief: typeof r.actief === 'boolean' ? r.actief : s.soorten[k].actief,
          duurMin: getal(r.duurMin, 10, 480, s.soorten[k].duurMin),
        },
      ];
    }),
  ) as Beschikbaarheid['soorten'];

  const persoonId = typeof o.persoonId === 'string' && /^[0-9a-f-]{36}$/i.test(o.persoonId) ? o.persoonId : null;

  const ruwGesloten = (typeof o.geslotenTijden === 'object' && o.geslotenTijden ? o.geslotenTijden : {}) as Record<string, unknown>;
  const geslotenTijden: Record<string, string[]> = {};
  for (const [dag, tijden] of Object.entries(ruwGesloten).sort(([a], [b]) => a.localeCompare(b)).slice(-200)) {
    if (!DATUM.test(dag) || !Array.isArray(tijden)) continue;
    const t = [...new Set(tijden.map((x) => String(x ?? '')).filter((x) => TIJD.test(x)))].sort();
    if (t.length) geslotenTijden[dag] = t;
  }
  const extraDagen = Array.isArray(o.extraDagen)
    ? [...new Set((o.extraDagen as unknown[]).map((d) => String(d ?? '').trim()).filter((d) => DATUM.test(d)))].sort().slice(-200)
    : [];

  return {
    werkdagen,
    tijdvakken: tijdvakken.length ? tijdvakken : s.tijdvakken,
    bufferMin: getal(o.bufferMin, 0, 240, s.bufferMin),
    maxPerDag: getal(o.maxPerDag, 1, 20, s.maxPerDag),
    geblokkeerd,
    dagenVooruit: getal(o.dagenVooruit, 1, 120, s.dagenVooruit),
    minUrenVooraf: getal(o.minUrenVooraf, 0, 336, s.minUrenVooraf),
    stapMin: getal(o.stapMin, 5, 120, s.stapMin),
    soorten,
    persoonId,
    geslotenTijden,
    extraDagen,
  };
}

/** Eén dag met vrije starttijden, zoals de API die aan de kiezer geeft. */
export type VrijeDag = { datum: string; tijden: string[] };
