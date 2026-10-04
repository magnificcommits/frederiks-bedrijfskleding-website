import { Fragment, createElement, type ReactNode } from 'react';
import type { Meervoud, MvSleutel, Sleutel, Woordenboek } from './nl';

/**
 * Lichte vertaallaag voor het klantportaal (/portaal). Geen externe library:
 * woordenboeken in TS (nl.ts is de bron, en/de/pl hebben hetzelfde type, dus
 * TypeScript dwingt volledigheid af) en Intl voor datums, getallen en bedragen.
 *
 * Dit bestand is puur: geen server- of client-only imports, zodat het zowel in
 * server components als in client components gebruikt kan worden.
 */

export const TALEN = ['nl', 'en', 'de', 'pl'] as const;
export type Taal = (typeof TALEN)[number];
export const STANDAARD_TAAL: Taal = 'nl';

/** Cookie met de taalkeuze (1 jaar geldig, ook leesbaar op de loginpagina). */
export const TAAL_COOKIE = 'fb_taal';
export const TAAL_COOKIE_MAXAGE = 60 * 60 * 24 * 365;

export const LOCALE: Record<Taal, string> = {
  nl: 'nl-NL',
  en: 'en-GB',
  de: 'de-DE',
  pl: 'pl-PL',
};

/** Taalnamen in hun eigen taal, voor de taalkiezer. Geen vlaggen. */
export const TAAL_NAAM: Record<Taal, string> = {
  nl: 'Nederlands',
  en: 'English',
  de: 'Deutsch',
  pl: 'Polski',
};

export function isTaal(v: unknown): v is Taal {
  return typeof v === 'string' && (TALEN as readonly string[]).includes(v);
}

/** Eerste ondersteunde taal uit een Accept-Language-header, gesorteerd op q-waarde. */
export function taalUitAcceptLanguage(header: string | null | undefined): Taal | null {
  if (!header) return null;
  const kandidaten = header
    .split(',')
    .map((deel, i) => {
      const [tag, ...params] = deel.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const gewicht = q ? Number(q.slice(2)) : 1;
      return { taal: tag.trim().toLowerCase().split('-')[0], gewicht: Number.isFinite(gewicht) ? gewicht : 0, i };
    })
    .filter((k) => k.taal && k.gewicht > 0)
    .sort((a, b) => b.gewicht - a.gewicht || a.i - b.i);
  for (const k of kandidaten) if (isTaal(k.taal)) return k.taal;
  return null;
}

type Vars = Record<string, string | number>;

function vul(sjabloon: string, vars?: Vars): string {
  if (!vars) return sjabloon;
  return sjabloon.replace(/\{(\w+)\}/g, (heel, naam: string) => (naam in vars ? String(vars[naam]) : heel));
}

function opPad(bron: unknown, pad: string): unknown {
  let huidig: unknown = bron;
  for (const deel of pad.split('.')) {
    if (huidig == null || typeof huidig !== 'object') return undefined;
    huidig = (huidig as Record<string, unknown>)[deel];
  }
  return huidig;
}

export type StatusGroep = keyof Woordenboek['status'];

export type Vertaler = {
  taal: Taal;
  locale: string;
  /** Vaste tekst op sleutel, met {variabelen}. */
  t: (sleutel: Sleutel, vars?: Vars) => string;
  /** Meervoudsvorm op aantal (Intl.PluralRules), {n} wordt het opgemaakte aantal. */
  tn: (sleutel: MvSleutel, n: number, vars?: Vars) => string;
  /** Tekst met React-elementen als variabelen, bijv. vetgedrukt bedrag of een link. */
  rijk: (sleutel: Sleutel, vars: Record<string, ReactNode>) => ReactNode;
  /** Statuswaarde uit de database naar een leesbaar label; onbekend valt terug op de ruwe waarde. */
  status: (groep: StatusGroep, waarde: string | null | undefined) => string;
  euro: (n: number | null | undefined, decimalen?: 0 | 2) => string;
  getal: (n: number | null | undefined) => string;
  /** Datum als "4 oktober 2026" in de taal van de gebruiker; leeg bij geen of ongeldige datum. */
  datum: (d: string | Date | null | undefined) => string;
  /** Datum en tijd kort, Nederlandse tijdzone. */
  moment: (d: string | Date | null | undefined) => string;
};

function alsDatum(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const dt = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function maakVertaler(taal: Taal, woordenboek: Woordenboek): Vertaler {
  const locale = LOCALE[taal];
  const meervoud = new Intl.PluralRules(locale);
  const getalFmt = new Intl.NumberFormat(locale);
  const euro2 = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const euro0 = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  // Nederlandse tijdzone, net als moment(): de server draait in UTC.
  const datumFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
  const momentFmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  });

  const tekst = (sleutel: string): string => {
    const v = opPad(woordenboek, sleutel);
    return typeof v === 'string' ? v : sleutel;
  };
  const getal = (n: number | null | undefined) => {
    const v = Number(n ?? 0);
    return getalFmt.format(Number.isFinite(v) ? v : 0);
  };

  return {
    taal,
    locale,
    t: (sleutel, vars) => vul(tekst(sleutel), vars),
    tn: (sleutel, n, vars) => {
      const vormen = opPad(woordenboek, sleutel) as Meervoud | undefined;
      if (!vormen) return sleutel;
      const cat = meervoud.select(n) as keyof Meervoud;
      const sjabloon = vormen[cat] ?? vormen.other;
      return vul(sjabloon, { n: getal(n), ...vars });
    },
    rijk: (sleutel, vars) => {
      const delen = tekst(sleutel).split(/(\{\w+\})/g);
      return delen.map((deel, i) => {
        const m = /^\{(\w+)\}$/.exec(deel);
        const inhoud = m && m[1] in vars ? vars[m[1]] : deel;
        return createElement(Fragment, { key: i }, inhoud);
      });
    },
    status: (groep, waarde) => {
      if (!waarde) return '';
      const v = opPad(woordenboek.status[groep], waarde);
      return typeof v === 'string' ? v : waarde.replace(/_/g, ' ');
    },
    euro: (n, decimalen = 2) => {
      const v = Number(n ?? 0);
      return (decimalen === 0 ? euro0 : euro2).format(Number.isFinite(v) ? v : 0);
    },
    getal,
    datum: (d) => {
      const dt = alsDatum(d);
      return dt ? datumFmt.format(dt) : '';
    },
    moment: (d) => {
      const dt = alsDatum(d);
      return dt ? momentFmt.format(dt) : '';
    },
  };
}
