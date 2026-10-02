import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import type { LookupFunction } from 'node:net';
import { uploadMediaMetNaam } from '@/lib/kms/storage';

/**
 * Logo van de website van een prospect halen, server-side en voorzichtig:
 *  - alleen http/https op poort 80/443, geen inlog-urls;
 *  - elk adres waarmee we verbinden wordt gecontroleerd (ook na redirects en
 *    bij DNS-rebinding, want de controle zit in de lookup van de verbinding zelf):
 *    geen localhost, privé-netwerken, link-local of cloud-metadata;
 *  - homepage maximaal 2 MB en 8 seconden, logo maximaal 2 MB;
 *  - SVG met scripts of event-handlers weigeren we.
 */

const MAX_HTML = 2 * 1024 * 1024;
const MAX_LOGO = 2 * 1024 * 1024;
export const MAX_UPLOAD = 4 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;
// Gewone browser-identificatie: veel hostingfirewalls (Wordfence, Cloudflare) weigeren
// onbekende bots met een 403, ook voor een simpele homepage-opvraag.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------ */
/* Netwerkveiligheid                                                   */
/* ------------------------------------------------------------------ */

function ipv4NaarGetal(ip: string): number {
  return ip.split('.').reduce((acc, deel) => (acc << 8) + Number(deel), 0) >>> 0;
}

function inBlok(ip: string, basis: string, bits: number): boolean {
  const masker = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4NaarGetal(ip) & masker) === (ipv4NaarGetal(basis) & masker);
}

const PRIVE_V4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

/** True voor elk adres dat niet op het open internet hoort. */
export function isPriveIp(ip: string): boolean {
  const soort = net.isIP(ip);
  if (soort === 4) return PRIVE_V4.some(([b, n]) => inBlok(ip, b, n));
  if (soort !== 6) return true;
  const v6 = ip.toLowerCase().split('%')[0];
  if (v6 === '::' || v6 === '::1') return true;
  // IPv4 ingebed in IPv6 (::ffff:10.0.0.1, 64:ff9b::7f00:1 enz.).
  const v4 = v6.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) return isPriveIp(v4[1]);
  if (v6.startsWith('::ffff:') || v6.startsWith('64:ff9b:')) return true;
  const eerste = parseInt(v6.split(':')[0] || '0', 16);
  if ((eerste & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((eerste & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((eerste & 0xff00) === 0xff00) return true; // multicast
  if (v6.startsWith('2001:db8') || v6.startsWith('100::')) return true;
  return false;
}

/** DNS-lookup die verbindingen met privé-adressen weigert. Werkt voor `all` en enkelvoudig. */
const veiligeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, adressen) => {
    if (err) return (callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(err, '', 0);
    const lijst = adressen as dns.LookupAddress[];
    if (!lijst.length || lijst.some((a) => isPriveIp(a.address))) {
      const fout = Object.assign(new Error('Adres niet toegestaan'), { code: 'EBLOCKED' }) as NodeJS.ErrnoException;
      return (callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(fout, '', 0);
    }
    if ((options as dns.LookupOptions).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, lijst);
    }
    return (callback as (e: null, a: string, f: number) => void)(null, lijst[0].address, lijst[0].family);
  });
};

export function controleerUrl(ruw: string): URL {
  let u: URL;
  try {
    u = new URL(ruw);
  } catch {
    throw new Error('Ongeldige url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Alleen http en https');
  if (u.username || u.password) throw new Error('Url met inloggegevens');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Poort niet toegestaan');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Host niet toegestaan');
  }
  // IP-letterlijk: net.connect slaat de lookup dan over, dus hier zelf controleren.
  if (net.isIP(host) && isPriveIp(host)) throw new Error('Adres niet toegestaan');
  return u;
}

type Antwoord = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; url: string };

function haalEenKeer(u: URL, maxBytes: number, deadline: number, accept: string): Promise<Antwoord> {
  return new Promise((resolve, reject) => {
    const rest = deadline - Date.now();
    if (rest <= 0) return reject(new Error('Tijd op'));
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      u,
      {
        method: 'GET',
        lookup: veiligeLookup,
        headers: { 'User-Agent': UA, Accept: accept, 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Language': 'nl,en;q=0.5' },
        timeout: rest,
      },
      (res) => {
        const lengte = Number(res.headers['content-length'] ?? 0);
        if (lengte > maxBytes) {
          res.destroy();
          return reject(new Error('Bestand te groot'));
        }
        const delen: Buffer[] = [];
        let totaal = 0;
        res.on('data', (c: Buffer) => {
          totaal += c.length;
          if (totaal > maxBytes) {
            res.destroy();
            reject(new Error('Bestand te groot'));
            return;
          }
          delen.push(c);
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(delen), url: u.toString() }));
        res.on('error', reject);
      },
    );
    const klok = setTimeout(() => req.destroy(new Error('Tijd op')), rest);
    req.on('close', () => clearTimeout(klok));
    req.on('timeout', () => req.destroy(new Error('Tijd op')));
    req.on('error', reject);
    req.end();
  });
}

function pakUit(a: Antwoord, maxBytes: number): Buffer {
  const enc = String(a.headers['content-encoding'] ?? '').toLowerCase();
  const opties = { maxOutputLength: maxBytes * 4 };
  try {
    if (enc.includes('gzip')) return zlib.gunzipSync(a.body, opties);
    if (enc.includes('deflate')) return zlib.inflateSync(a.body, opties);
    if (enc.includes('br')) return zlib.brotliDecompressSync(a.body, opties);
  } catch {
    throw new Error('Kon het antwoord niet uitpakken');
  }
  return a.body;
}

/** GET met redirects, waarbij elke tussenstap opnieuw gecontroleerd wordt. */
async function veiligOphalen(ruw: string, maxBytes: number, deadline: number, accept: string): Promise<Antwoord> {
  let u = controleerUrl(ruw);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const a = await haalEenKeer(u, maxBytes, deadline, accept);
    if (a.status >= 300 && a.status < 400 && a.headers.location) {
      u = controleerUrl(new URL(String(a.headers.location), u).toString());
      continue;
    }
    if (a.status < 200 || a.status >= 300) throw new Error(`Website gaf status ${a.status}`);
    return { ...a, body: pakUit(a, maxBytes), url: u.toString() };
  }
  throw new Error('Te veel doorverwijzingen');
}

/* ------------------------------------------------------------------ */
/* Afbeelding herkennen en controleren                                 */
/* ------------------------------------------------------------------ */

export type LogoType = { ext: 'png' | 'jpg' | 'webp' | 'svg'; mime: string };

/** Bepaalt het type aan de inhoud, niet aan de naam of de header. */
export function herkenAfbeelding(buf: Buffer): LogoType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  const kop = buf.subarray(0, 2048).toString('utf8').replace(/^﻿/, '').trimStart().toLowerCase();
  if ((kop.startsWith('<svg') || kop.startsWith('<?xml') || kop.startsWith('<!--') || kop.startsWith('<!doctype svg')) && buf.toString('utf8').toLowerCase().includes('<svg')) {
    return { ext: 'svg', mime: 'image/svg+xml' };
  }
  return null;
}

/** SVG met actieve inhoud weigeren; een logo heeft dat nooit nodig. */
export function isVeiligeSvg(buf: Buffer): boolean {
  const t = buf.toString('utf8');
  return !/<script|\son[a-z]+\s*=|javascript:|<foreignobject|<iframe|<embed|<object|<!entity/i.test(t);
}

/** Breedte van een PNG uit de IHDR-chunk; null als onbekend. */
function pngBreedte(buf: Buffer): number | null {
  if (buf.length < 24) return null;
  return buf.readUInt32BE(16);
}

/* ------------------------------------------------------------------ */
/* Kandidaten uit de HTML                                              */
/* ------------------------------------------------------------------ */

export type Kandidaat = { url: string; score: number; bron: string };

function attributen(tag: string): Record<string, string> {
  const uit: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) uit[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? '').trim();
  return uit;
}

function ontsnap(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&#47;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const NIET_ONS = /partner|client|klant|cert|keurmerk|vca|sponsor|award|iso-?\d|payment|ideal|paypal|whatsapp|facebook|instagram|linkedin|twitter|youtube|tiktok|google|review|kiwa|bovag|trustpilot|kvk|thuiswinkel|placeholder|loading|spinner|flag|vlag/i;

export function vindKandidaten(html: string, paginaUrl: string): Kandidaat[] {
  const kop = html.slice(0, 600_000);
  let basis = paginaUrl;
  const baseTag = kop.match(/<base\s[^>]*>/i);
  if (baseTag) {
    const href = attributen(baseTag[0]).href;
    if (href) try { basis = new URL(ontsnap(href), paginaUrl).toString(); } catch { /* negeren */ }
  }
  const maak = (ruw: string | undefined): string | null => {
    if (!ruw) return null;
    const v = ontsnap(ruw).trim().split(/\s+/)[0];
    if (!v || v.startsWith('data:') || v.startsWith('blob:') || v.startsWith('javascript:')) return null;
    try {
      const u = new URL(v, basis);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
    } catch {
      return null;
    }
  };

  const lijst = new Map<string, Kandidaat>();
  const voeg = (url: string | null, score: number, bron: string) => {
    if (!url) return;
    if (/\.ico(\?|$)/i.test(url)) return;
    const oud = lijst.get(url);
    if (!oud || oud.score < score) lijst.set(url, { url, score, bron });
  };

  // 1. JSON-LD: "logo": "https://..." of "logo": {"url": "..."}
  for (const m of kop.matchAll(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"(?:url|contentUrl)"\s*:\s*"([^"]+)")/gi)) {
    voeg(maak((m[1] ?? m[2])?.replace(/\\\//g, '/')), 95, 'gestructureerde data');
  }

  // 2. <img> met "logo" in src, alt, class of id. Eerdere logo's (header) wegen zwaarder.
  let volgorde = 0;
  for (const m of kop.matchAll(/<img\b[^>]*>/gi)) {
    const a = attributen(m[0]);
    const src = a.src || a['data-src'] || a['data-lazy-src'] || (a.srcset || a['data-srcset'] || '').split(',')[0];
    const tekst = `${a.class ?? ''} ${a.id ?? ''} ${a.alt ?? ''} ${src ?? ''}`.toLowerCase();
    if (!tekst.includes('logo')) continue;
    let score = 80 - Math.min(volgorde * 4, 30);
    volgorde++;
    if (NIET_ONS.test(tekst)) score -= 45;
    if (/\.svg(\?|$)/i.test(src ?? '')) score += 8;
    if (/logo/i.test(src ?? '')) score += 5;
    voeg(maak(src), score, 'afbeelding met "logo"');
  }

  // 3. <link rel=...icon...> en apple-touch-icon.
  for (const m of kop.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributen(m[0]);
    const rel = (a.rel ?? '').toLowerCase();
    if (!rel.includes('icon') || rel.includes('mask-icon')) continue;
    const grootte = Number((a.sizes ?? '').split(/x/i)[0]) || 0;
    let score = rel.includes('apple-touch-icon') ? 55 : 30;
    if ((a.type ?? '').includes('svg') || /\.svg(\?|$)/i.test(a.href ?? '')) score += 12;
    if (grootte >= 96) score += 8;
    if (grootte > 0 && grootte < 64) score -= 15;
    voeg(maak(a.href), score, rel.includes('apple') ? 'apple-touch-icon' : 'site-icoon');
  }

  // 4. og:image: vaak een sfeerfoto, alleen hoog als er "logo" in de naam staat.
  for (const m of kop.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributen(m[0]);
    const naam = (a.property || a.name || '').toLowerCase();
    if (naam !== 'og:image' && naam !== 'og:logo' && naam !== 'twitter:image') continue;
    const url = maak(a.content);
    voeg(url, naam === 'og:logo' || /logo/i.test(url ?? '') ? 70 : 22, naam);
  }

  return [...lijst.values()].sort((x, y) => y.score - x.score).slice(0, 8);
}

/* ------------------------------------------------------------------ */
/* Ophalen en opslaan                                                  */
/* ------------------------------------------------------------------ */

export function websiteNaarUrl(website: string): string {
  const t = website.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

type LogoBestand = { body: Buffer; type: NonNullable<ReturnType<typeof herkenAfbeelding>> };

/** Downloadt één afbeelding (veilig) en controleert of het een bruikbaar logo is. */
async function downloadLogo(bron: string, deadline: number): Promise<LogoBestand> {
  const a = await veiligOphalen(bron, MAX_LOGO, deadline, 'image/svg+xml,image/png,image/webp,image/jpeg,image/*;q=0.8');
  const type = herkenAfbeelding(a.body);
  if (!type) throw new Error('Geen png, jpg, webp of svg');
  if (type.ext === 'svg' && !isVeiligeSvg(a.body)) throw new Error('SVG met scripts geweigerd');
  if (type.ext === 'png') {
    const b = pngBreedte(a.body);
    if (b != null && b < 48) throw new Error('Afbeelding te klein');
  }
  if (a.body.length < 200) throw new Error('Afbeelding te klein');
  return { body: a.body, type };
}

async function bewaarLogo(l: LogoBestand): Promise<string> {
  const bestand = new File([new Uint8Array(l.body)], `logo.${l.type.ext}`, { type: l.type.mime });
  const upload = await uploadMediaMetNaam(bestand, 'prospects');
  if (!upload) throw new Error('Opslaan in de mediabibliotheek mislukte');
  return upload.url;
}

/** Downloadt één afbeelding (veilig) en slaat hem op in media/prospects. */
export async function slaLogoOpVanUrl(bron: string, deadline = Date.now() + TIMEOUT_MS): Promise<string> {
  return bewaarLogo(await downloadLogo(bron, deadline));
}

/** Websitepictogram via Google, als de site zelf niets bruikbaars geeft of ons weigert. */
function faviconUrl(website: string): string | null {
  try {
    const host = new URL(websiteNaarUrl(website)).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`;
  } catch {
    return null;
  }
}

export type LogoResultaat =
  | { ok: true; url: string; bron: string; kandidaten: Kandidaat[] }
  | { ok: false; fout: string; kandidaten: Kandidaat[] };

/**
 * Zoekt het logo op de homepage en slaat de beste kandidaat op die echt een
 * bruikbare afbeelding is. `budgetMs` begrenst de totale tijd (voor de bulkactie).
 */
export async function zoekLogo(website: string, budgetMs = 2 * TIMEOUT_MS, metFavicon = true): Promise<LogoResultaat> {
  const start = Date.now();
  const eindTotaal = start + budgetMs;
  const favicon = faviconUrl(website);

  // Laatste redmiddel: het websitepictogram. Jessi ziet het eerst als voorbeeld en
  // kiest zelf of het bruikbaar is.
  async function viaFavicon(reden: string, kandidaten: Kandidaat[]): Promise<LogoResultaat> {
    if (metFavicon && favicon && eindTotaal - Date.now() > 1500) {
      try {
        const url = await slaLogoOpVanUrl(favicon, Math.min(Date.now() + 5000, eindTotaal));
        return { ok: true, url, bron: favicon, kandidaten };
      } catch {
        /* valt door naar de foutmelding */
      }
    }
    return { ok: false, fout: reden, kandidaten };
  }

  let pagina: Antwoord;
  try {
    pagina = await veiligOphalen(websiteNaarUrl(website), MAX_HTML, Math.min(start + TIMEOUT_MS, eindTotaal), 'text/html,application/xhtml+xml');
  } catch (e) {
    return viaFavicon(`Website niet bereikbaar: ${(e as Error).message}. Alleen het websitepictogram geprobeerd.`, []);
  }
  const kandidaten = vindKandidaten(pagina.body.toString('utf8'), pagina.url);
  if (!kandidaten.length) return viaFavicon('Geen logo gevonden op de homepage.', kandidaten);

  // De beste vier tegelijk downloaden (scheelt seconden), dan de hoogst gerangschikte
  // die bruikbaar is opslaan. Zo komt er maar één bestand in de mediabibliotheek.
  const over = eindTotaal - Date.now();
  if (over < 1000) return { ok: false, fout: 'Geen tijd meer om afbeeldingen op te halen.', kandidaten };
  const deadline = Date.now() + Math.min(TIMEOUT_MS, over);
  const pogingen = await Promise.allSettled(kandidaten.slice(0, 4).map((k) => downloadLogo(k.url, deadline)));
  let laatsteFout = '';
  for (let i = 0; i < pogingen.length; i++) {
    const r = pogingen[i];
    if (r.status === 'rejected') {
      laatsteFout = (r.reason as Error)?.message ?? '';
      continue;
    }
    try {
      const url = await bewaarLogo(r.value);
      return { ok: true, url, bron: kandidaten[i].url, kandidaten };
    } catch (e) {
      laatsteFout = (e as Error).message;
    }
  }
  return viaFavicon(`Gevonden afbeeldingen waren niet bruikbaar${laatsteFout ? ` (${laatsteFout})` : ''}.`, kandidaten);
}

/** Controle voor een handmatig geupload logo. Geeft een foutmelding of null. */
export async function controleerUpload(bestand: File): Promise<{ fout: string } | { type: LogoType }> {
  if (!bestand || bestand.size === 0) return { fout: 'Kies eerst een bestand.' };
  if (bestand.size > MAX_UPLOAD) return { fout: 'Het bestand is groter dan 4 MB.' };
  const buf = Buffer.from(await bestand.arrayBuffer());
  const type = herkenAfbeelding(buf);
  if (!type) return { fout: 'Alleen png, jpg, webp of svg.' };
  if (type.ext === 'svg' && !isVeiligeSvg(buf)) return { fout: 'Deze SVG bevat scripts en wordt geweigerd. Exporteer hem opnieuw of gebruik een png.' };
  return { type };
}
