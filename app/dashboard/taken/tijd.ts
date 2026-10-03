/**
 * Datum- en tijdhulpjes voor de takenmodule. Alles in Nederlandse tijd
 * (Europe/Amsterdam), ook als de server in UTC draait. Puur: geen serverimports,
 * dus bruikbaar in de client, de server actions, de cron en de agenda-feed.
 *
 * Datums zijn 'yyyy-mm-dd', tijden 'hh:mm'.
 */

const TZ = 'Europe/Amsterdam';

export const DAGEN_KORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
export const DAGEN_LANG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
export const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const MAANDEN_LANG = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

/** Tijd die een taak zonder tijd krijgt voor herinneringen en de agenda-feed. */
export const STANDAARD_TIJD = '09:00';

export function isDatum(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isTijd(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Onderdelen van een moment in Nederlandse tijd. */
export function nlDelen(moment: Date = new Date()): { datum: string; tijd: string; weekdag: number; uur: number; minuut: number } {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const d of f.formatToParts(moment)) p[d.type] = d.value;
  const weekdagen: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const uur = Number(p.hour) % 24;
  return {
    datum: `${p.year}-${p.month}-${p.day}`,
    tijd: `${String(uur).padStart(2, '0')}:${p.minute}`,
    weekdag: weekdagen[p.weekday] ?? 0,
    uur,
    minuut: Number(p.minute),
  };
}

export function vandaagNl(): string {
  return nlDelen().datum;
}

/** Verschil tussen Nederlandse tijd en UTC in minuten op een bepaald moment (60 of 120). */
function afwijkingMin(utcMs: number): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const d of f.formatToParts(new Date(utcMs))) p[d.type] = d.value;
  const alsUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return Math.round((alsUtc - utcMs) / 60000);
}

/** 'yyyy-mm-dd' + 'hh:mm' in Nederlandse tijd → echt moment (Date). */
export function nlNaarDate(datum: string, tijd: string = '00:00'): Date {
  const [j, m, d] = datum.split('-').map(Number);
  const [u, mi] = (isTijd(tijd) ? tijd : '00:00').split(':').map(Number);
  const naief = Date.UTC(j, m - 1, d, u, mi);
  let utc = naief - afwijkingMin(naief) * 60000;
  const tweede = afwijkingMin(utc);
  if (tweede !== afwijkingMin(naief)) utc = naief - tweede * 60000;
  return new Date(utc);
}

function alsUtcDatum(datum: string): Date {
  const [j, m, d] = datum.split('-').map(Number);
  return new Date(Date.UTC(j, m - 1, d));
}

function naarIso(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function plusDagen(datum: string, n: number): string {
  const dt = alsUtcDatum(datum);
  dt.setUTCDate(dt.getUTCDate() + n);
  return naarIso(dt);
}

/** Maand erbij; 31 jan + 1 maand = 28/29 feb (geen overloop naar maart). */
export function plusMaanden(datum: string, n: number): string {
  const [j, m, d] = datum.split('-').map(Number);
  const doel = new Date(Date.UTC(j, m - 1 + n, 1));
  const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate();
  doel.setUTCDate(Math.min(d, laatste));
  return naarIso(doel);
}

export function weekdagVan(datum: string): number {
  return alsUtcDatum(datum).getUTCDay();
}

/** Maandag van de week waarin de datum valt. */
export function maandagVan(datum: string): string {
  const wd = weekdagVan(datum);
  return plusDagen(datum, wd === 0 ? -6 : 1 - wd);
}

/** Volgende maandag (Microsoft To Do: "Volgende week"). */
export function volgendeMaandag(datum: string): string {
  return plusDagen(maandagVan(datum), 7);
}

export function verschilDagen(van: string, tot: string): number {
  return Math.round((alsUtcDatum(tot).getTime() - alsUtcDatum(van).getTime()) / 86_400_000);
}

/** "di 7 okt" (jaartal erbij als het niet dit jaar is). */
export function datumKort(datum: string | null | undefined, ditJaar?: number): string {
  if (!isDatum(datum)) return '';
  const [j, m, d] = datum.split('-').map(Number);
  const jaar = ditJaar ?? Number(vandaagNl().slice(0, 4));
  return `${DAGEN_KORT[weekdagVan(datum)]} ${d} ${MAANDEN_KORT[m - 1]}${j !== jaar ? ` ${j}` : ''}`;
}

/** "dinsdag 7 oktober". */
export function datumLang(datum: string | null | undefined): string {
  if (!isDatum(datum)) return '';
  const [, m, d] = datum.split('-').map(Number);
  return `${DAGEN_LANG[weekdagVan(datum)]} ${d} ${MAANDEN_LANG[m - 1]}`;
}

/** Relatief waar dat kan: "Vandaag", "Morgen", "Gisteren", anders "di 7 okt". */
export function datumRelatief(datum: string | null | undefined, vandaag: string): string {
  if (!isDatum(datum)) return '';
  const v = verschilDagen(vandaag, datum);
  if (v === 0) return 'Vandaag';
  if (v === 1) return 'Morgen';
  if (v === -1) return 'Gisteren';
  return datumKort(datum, Number(vandaag.slice(0, 4)));
}

export function tijdKort(tijd: string | null | undefined): string {
  const t = String(tijd ?? '').slice(0, 5);
  return isTijd(t) ? t : '';
}

/** 'hh:mm' + minuten, begrensd op 23:59. */
export function plusMinuten(tijd: string, minuten: number): string {
  if (!isTijd(tijd)) return tijd;
  const [u, m] = tijd.split(':').map(Number);
  const totaal = Math.min(23 * 60 + 59, Math.max(0, u * 60 + m + minuten));
  return `${String(Math.floor(totaal / 60)).padStart(2, '0')}:${String(totaal % 60).padStart(2, '0')}`;
}

export function minutenVan(tijd: string): number {
  const [u, m] = tijd.split(':').map(Number);
  return u * 60 + m;
}

/** Tijdvak zoals "di 7 okt 10:00–11:00", of "di 7 okt" zonder tijd. */
export function tijdvak(datum: string | null, tijd: string | null, eind: string | null, vandaag?: string): string {
  const d = vandaag ? datumRelatief(datum, vandaag) : datumKort(datum);
  const t = tijdKort(tijd);
  const e = tijdKort(eind);
  const uren = t ? (e ? `${t}–${e}` : t) : '';
  return [d, uren].filter(Boolean).join(' ');
}

/**
 * Moment van de herinnering: datum + tijd (of 09:00 zonder tijd) min het aantal
 * minuten vooraf. Null zonder datum of zonder herinnering.
 */
export function berekenHerinnering(datum: string | null, tijd: string | null, minutenVooraf: number | null): Date | null {
  if (!isDatum(datum) || minutenVooraf === null || minutenVooraf === undefined || !Number.isFinite(minutenVooraf)) return null;
  const begin = nlNaarDate(datum, tijdKort(tijd) || STANDAARD_TIJD);
  return new Date(begin.getTime() - minutenVooraf * 60000);
}

/** Voor <input type="datetime-local">: 'yyyy-mm-ddThh:mm' in Nederlandse tijd. */
export function naarLokaalInvoer(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const d = nlDelen(dt);
  return `${d.datum}T${d.tijd}`;
}

export function vanLokaalInvoer(v: string): string | null {
  const [datum, tijd] = String(v ?? '').split('T');
  if (!isDatum(datum) || !isTijd(String(tijd ?? '').slice(0, 5))) return null;
  return nlNaarDate(datum, tijd.slice(0, 5)).toISOString();
}

/** "om 10:00" / "ma 6 okt 09:00" voor een herinnering. */
export function herinneringTekst(iso: string | null | undefined, vandaag: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const d = nlDelen(dt);
  return d.datum === vandaag ? `vandaag ${d.tijd}` : `${datumRelatief(d.datum, vandaag)} ${d.tijd}`;
}
