import crypto from 'crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';

/**
 * Eigen open- en kliktracking voor campagnemails. Resend-webhooks zijn er nog
 * niet (en sendEmail geeft geen bericht-id terug), dus:
 *  - elke verzonden mail krijgt een willekeurig token (campagne_verzendingen.token);
 *  - links lopen via /api/c/<token>?u=<url>&h=<handtekening> (handtekening tegen open redirects);
 *  - een onzichtbaar plaatje /api/c/<token>/o registreert het openen.
 *
 * Kanttekening die in het rapport staat: Apple Mail laadt plaatjes vooraf, dus
 * "geopend" is een indicatie. Klikken zeggen meer, al klikken virusscanners van
 * sommige bedrijven ook weleens links aan.
 */

const GEHEIM = env.cronSecret || env.supabaseServiceKey || 'frederiks-campagne-tracking';

function basis(): string {
  return env.siteUrl.replace(/\/$/, '');
}

export function nieuwTrackingToken(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function linkHandtekening(token: string, url: string): string {
  return crypto.createHmac('sha256', GEHEIM).update(`${token}|${url}`).digest('base64url').slice(0, 22);
}

export function handtekeningKlopt(token: string, url: string, h: string): boolean {
  const verwacht = linkHandtekening(token, url);
  if (!h || h.length !== verwacht.length) return false;
  return crypto.timingSafeEqual(Buffer.from(verwacht), Buffer.from(h));
}

export function trackLink(token: string, url: string): string {
  return `${basis()}/api/c/${encodeURIComponent(token)}?u=${encodeURIComponent(url)}&h=${linkHandtekening(token, url)}`;
}

export function afmeldTrackLink(token: string): string {
  return `${basis()}/api/c/${encodeURIComponent(token)}?a=1`;
}

export function pixelUrl(token: string): string {
  return `${basis()}/api/c/${encodeURIComponent(token)}/o`;
}

function ontEscape(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * Herschrijft de links in een mail naar trackinglinks en voegt de pixel toe.
 * mailto:/tel: blijven ongemoeid. De afmeldlink gaat via de eigen route, zodat
 * we weten uit welke campagne iemand zich afmeldt.
 */
export function voegTrackingToe(html: string, token: string, afmeldUrl: string): string {
  const afmeld = afmeldUrl.trim();
  let uit = html.replace(/<a\b([^>]*?)\shref="([^"]+)"([^>]*)>/gi, (heel, voor: string, hrefRuw: string, na: string) => {
    const href = ontEscape(hrefRuw);
    const isAfmeld = /data-afmelden=/i.test(voor + na) || href === afmeld || href.includes('/afmelden?');
    if (isAfmeld) return `<a${voor} href="${afmeldTrackLink(token)}"${na}>`;
    if (!/^https?:\/\//i.test(href)) return heel;
    if (href.includes('/api/c/')) return heel;
    return `<a${voor} href="${trackLink(token, href).replace(/&/g, '&amp;')}"${na}>`;
  });
  const pixel = `<img src="${pixelUrl(token)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;" />`;
  uit = /<\/body>/i.test(uit) ? uit.replace(/<\/body>/i, `${pixel}</body>`) : uit + pixel;
  return uit;
}

type VerzendingRij = {
  id: string;
  campagne_id: string | null;
  inschrijving_id: string | null;
  node_id: string | null;
  email: string | null;
  geopend_op: string | null;
  geklikt_op: string | null;
  aantal_opens: number | null;
  aantal_kliks: number | null;
};

async function zoekVerzending(token: string): Promise<VerzendingRij | null> {
  const sb = kmsAdmin();
  if (!sb || !/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const { data, error } = await sb
    .from('campagne_verzendingen')
    .select('id, campagne_id, inschrijving_id, node_id, email, geopend_op, geklikt_op, aantal_opens, aantal_kliks')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return null;
  return data as VerzendingRij;
}

async function event(v: VerzendingRij, soort: string, detail: Record<string, unknown> = {}) {
  const sb = kmsAdmin();
  if (!sb || !v.campagne_id) return;
  await sb.from('campagne_events').insert({ campagne_id: v.campagne_id, inschrijving_id: v.inschrijving_id, node_id: v.node_id, soort, detail });
}

export async function registreerOpen(token: string): Promise<void> {
  const sb = kmsAdmin();
  const v = await zoekVerzending(token);
  if (!sb || !v) return;
  const nu = new Date().toISOString();
  await sb
    .from('campagne_verzendingen')
    .update({ geopend_op: v.geopend_op ?? nu, aantal_opens: (Number(v.aantal_opens) || 0) + 1 })
    .eq('id', v.id);
  if (!v.geopend_op) await event(v, 'geopend');
}

/** Registreert een klik en geeft terug of het token bestond. */
export async function registreerKlik(token: string, url: string): Promise<boolean> {
  const sb = kmsAdmin();
  const v = await zoekVerzending(token);
  if (!sb || !v) return false;
  const nu = new Date().toISOString();
  await sb
    .from('campagne_verzendingen')
    .update({ geklikt_op: v.geklikt_op ?? nu, geopend_op: v.geopend_op ?? nu, aantal_kliks: (Number(v.aantal_kliks) || 0) + 1 })
    .eq('id', v.id);
  if (!v.geopend_op) await event(v, 'geopend', { via: 'klik' });
  await event(v, 'geklikt', { url: url.slice(0, 500) });
  return true;
}

/** Afmeldklik: geeft het e-mailadres terug zodat de route kan doorsturen naar /afmelden. */
export async function registreerAfmeldKlik(token: string): Promise<string | null> {
  const v = await zoekVerzending(token);
  if (!v || !v.email) return null;
  await event(v, 'afmeldklik');
  return v.email;
}
