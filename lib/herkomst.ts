import { MAX_PADEN, herkomstTekst, schoonPad, schoneReferrer, type Herkomst } from '@/lib/leadHerkomst';

/**
 * Waar komt een bezoeker vandaan? Twee lagen:
 *
 * 1. Sessie (sessionStorage, altijd): landingspagina, verwijzer (alleen de
 *    hostnaam) en de utm-tags van de eerste pagina. Geen cookie, weg zodra het
 *    tabblad dichtgaat. Zonder toestemming blijft het hierbij.
 * 2. Na toestemming voor statistieken (ConsentBanner, 'fb-consent' = granted):
 *    - een first-party cookie `fb_herkomst` (90 dagen) met de eerste herkomst
 *      (utm, gclid, verwijzer, landingspagina, tijd) en het aantal bezoeken;
 *    - per sessie de bekeken paden (max. 30, zonder querystring) en het aantal pagina's.
 *
 * Geen IP, geen user-agent, geen fingerprint. Alles gaat mee met een
 * leadaanvraag via leesHerkomstVoorLead().
 */

const COOKIE = 'fb_herkomst';
const COOKIE_DAGEN = 90;
const SESSIE = 'fb-sessie';

type Utm = { s?: string; m?: string; c?: string; t?: string; ct?: string };
type EersteBezoek = Utm & { g?: string; r?: string; l?: string; ts: number; v: number };
type Sessie = Utm & {
  l: string | null;
  r: string | null;
  ts: number;
  /** gclid alleen met toestemming; zonder alleen "kwam via een advertentie". */
  g?: string;
  ads?: boolean;
  /** Bekeken paden [pad, seconden sinds start]; alleen met toestemming. */
  p?: [string, number][];
  n?: number;
  /** Is dit bezoek al meegeteld in het cookie? */
  geteld?: boolean;
};

const kort = (v: string | null, max = 160) => (v ? v.trim().slice(0, max) || undefined : undefined);

export function heeftStatistiekToestemming(): boolean {
  try {
    return window.localStorage.getItem('fb-consent') === 'granted';
  } catch {
    return false;
  }
}

function toestemmingGeweigerd(): boolean {
  try {
    return window.localStorage.getItem('fb-consent') === 'denied';
  } catch {
    return false;
  }
}

function leesSessie(): Sessie | null {
  try {
    const ruw = window.sessionStorage.getItem(SESSIE);
    return ruw ? (JSON.parse(ruw) as Sessie) : null;
  } catch {
    return null;
  }
}

function schrijfSessie(s: Sessie) {
  try {
    window.sessionStorage.setItem(SESSIE, JSON.stringify(s));
  } catch {
    /* privémodus: dan alleen wat op deze pagina zichtbaar is */
  }
}

function leesCookie(): EersteBezoek | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)fb_herkomst=([^;]*)/);
    if (!m) return null;
    const o = JSON.parse(decodeURIComponent(m[1])) as EersteBezoek;
    return typeof o?.ts === 'number' ? o : null;
  } catch {
    return null;
  }
}

function schrijfCookie(e: EersteBezoek) {
  try {
    const veilig = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(e))}; Max-Age=${COOKIE_DAGEN * 86400}; Path=/; SameSite=Lax${veilig}`;
  } catch {
    /* cookies geblokkeerd */
  }
}

function wisCookie() {
  try {
    document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    /* */
  }
}

function externeReferrer(): string | null {
  const host = schoneReferrer(document.referrer);
  if (!host) return null;
  const eigen = window.location.hostname.replace(/^www\./, '');
  return host === eigen || host.endsWith(`.${eigen}`) ? null : host;
}

function utmUitUrl(): Utm & { gclid?: string } {
  const q = new URLSearchParams(window.location.search);
  return {
    s: kort(q.get('utm_source'), 120),
    m: kort(q.get('utm_medium'), 120),
    c: kort(q.get('utm_campaign')),
    t: kort(q.get('utm_term')),
    ct: kort(q.get('utm_content')),
    gclid: kort(q.get('gclid'), 200),
  };
}

/**
 * Aanroepen bij elke paginaweergave op de publieke site (HerkomstTracker).
 * Veilig om vaak aan te roepen; faalt stil.
 */
export function registreerPaginabezoek(padRuw: string): void {
  if (typeof window === 'undefined') return;
  try {
    const pad = schoonPad(padRuw) ?? '/';
    const toestemming = heeftStatistiekToestemming();
    const nu = Date.now();
    let sessie = leesSessie();
    const url = utmUitUrl();

    if (!sessie) {
      const { gclid, ...utm } = url;
      sessie = { ...utm, l: pad, r: externeReferrer(), ts: nu };
      if (gclid) sessie.ads = true;
      if (gclid && toestemming) sessie.g = gclid;
    } else if (!sessie.s && url.s) {
      // Eerst direct binnen, later via een campagnelink: de campagne telt.
      const { gclid, ...utm } = url;
      Object.assign(sessie, utm);
      if (gclid) sessie.ads = true;
      if (gclid && toestemming) sessie.g = gclid;
    }

    if (toestemming) {
      const paden = sessie.p ?? [];
      const laatste = paden[paden.length - 1]?.[0];
      if (laatste !== pad && paden.length < MAX_PADEN) paden.push([pad, Math.max(0, Math.round((nu - sessie.ts) / 1000))]);
      sessie.p = paden;
      sessie.n = (sessie.n ?? 0) + (laatste === pad ? 0 : 1);
      if (!sessie.g && url.gclid) sessie.g = url.gclid;

      const eerste = leesCookie();
      if (!eerste) {
        schrijfCookie({ s: sessie.s, m: sessie.m, c: sessie.c, t: sessie.t, ct: sessie.ct, g: sessie.g, r: sessie.r ?? undefined, l: sessie.l ?? undefined, ts: sessie.ts, v: 1 });
      } else {
        // Het cookie houdt de EERSTE herkomst; alleen het aantal bezoeken loopt op.
        if (!sessie.geteld) eerste.v = (eerste.v ?? 1) + 1;
        schrijfCookie(eerste);
      }
      sessie.geteld = true;
    } else {
      // Zonder toestemming alleen landingspagina, verwijzer en campagnetags.
      delete sessie.p;
      delete sessie.n;
      delete sessie.g;
      delete sessie.geteld;
      if (toestemmingGeweigerd()) wisCookie();
    }
    schrijfSessie(sessie);
  } catch {
    /* tracking mag de site nooit breken */
  }
}

/** Alles wat we over de herkomst weten, klaar om mee te sturen met een aanvraag. */
export function leesHerkomstVoorLead(): Partial<Herkomst> {
  if (typeof window === 'undefined') return {};
  try {
    const toestemming = heeftStatistiekToestemming();
    const sessie = leesSessie();
    const eerste = toestemming ? leesCookie() : null;
    const url = utmUitUrl();
    // First-touch wint, dan de sessie, dan de huidige URL.
    const bron = eerste?.s || eerste?.c ? eerste : sessie?.s || sessie?.c ? sessie : null;
    return {
      utm_source: bron?.s ?? url.s ?? null,
      utm_medium: bron?.m ?? url.m ?? null,
      utm_campaign: bron?.c ?? url.c ?? null,
      utm_term: bron?.t ?? url.t ?? null,
      utm_content: bron?.ct ?? url.ct ?? null,
      gclid: toestemming ? eerste?.g ?? sessie?.g ?? url.gclid ?? null : null,
      referrer: eerste?.r ?? sessie?.r ?? externeReferrer(),
      landingspagina: eerste?.l ?? sessie?.l ?? schoonPad(window.location.pathname),
      conversiepagina: schoonPad(window.location.pathname),
      paginas_bekeken: toestemming ? sessie?.n ?? null : null,
      bezochte_paden: toestemming && sessie?.p ? sessie.p.map(([p, s]) => ({ p, s })) : null,
      eerste_bezoek_op: eerste ? new Date(eerste.ts).toISOString() : sessie ? new Date(sessie.ts).toISOString() : null,
      bezoeken: eerste?.v ?? null,
    };
  } catch {
    return {};
  }
}

/**
 * Korte tekst voor de oude bron-kolom en de leadmail ("bron=google, medium=cpc").
 * Kwam de bezoeker via een advertentie zonder toestemming, dan staat er "Google Ads" zonder het id.
 */
export function getHerkomst(): string {
  if (typeof window === 'undefined') return '';
  try {
    const h = leesHerkomstVoorLead();
    const sessie = leesSessie();
    const extra: string[] = [];
    if (!h.gclid && (sessie?.ads || new URLSearchParams(window.location.search).get('gclid'))) extra.push('Google Ads (gclid)');
    if (new URLSearchParams(window.location.search).get('fbclid')) extra.push('Meta (fbclid)');
    const basis = herkomstTekst(h);
    return [basis === 'direct of onbekend' && extra.length ? '' : basis, ...extra].filter(Boolean).join(', ');
  } catch {
    return 'onbekend';
  }
}
