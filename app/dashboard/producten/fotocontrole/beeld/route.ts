import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { dashAuthed } from '@/lib/kms/adminClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Omweg voor de fotocontrole. Leveranciers-CDN's geven meestal geen
 * CORS-toestemming, en dan mag de browser de pixels niet lezen (geen
 * scherptemeting). Deze route haalt de foto server-side op en geeft hem terug
 * vanaf ons eigen domein.
 *
 * Alleen voor ingelogde beheerders, alleen http(s), alleen afbeeldingen tot
 * 15 MB, en nooit naar een intern adres (localhost, 10.x, 192.168.x, enz.).
 * Doorverwijzingen volgen we zelf, zodat ook het doel daarvan gecontroleerd wordt.
 */

const MAX_BYTES = 15 * 1024 * 1024;

function privéAdres(ip: string): boolean {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')) return true;
    const v4 = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    return v4 ? privéAdres(v4[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function veiligDoel(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  try {
    const adressen = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (adressen.length === 0 || adressen.some((a) => privéAdres(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

export async function GET(req: Request) {
  if (!(await dashAuthed())) return new Response('Niet toegestaan', { status: 401 });
  const ruw = new URL(req.url).searchParams.get('url') ?? '';

  let doel = await veiligDoel(ruw);
  if (!doel) return new Response('Ongeldig adres', { status: 400 });

  let antwoord: Response | null = null;
  for (let sprong = 0; sprong < 4; sprong++) {
    try {
      antwoord = await fetch(doel, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'image/*' },
        cache: 'no-store',
      });
    } catch {
      return new Response('Foto niet bereikbaar', { status: 502 });
    }
    if (antwoord.status >= 300 && antwoord.status < 400) {
      const volgende = antwoord.headers.get('location');
      doel = volgende ? await veiligDoel(new URL(volgende, doel).toString()) : null;
      if (!doel) return new Response('Ongeldige doorverwijzing', { status: 400 });
      continue;
    }
    break;
  }
  if (!antwoord || !antwoord.ok || !antwoord.body) return new Response('Foto niet gevonden', { status: 404 });

  const type = antwoord.headers.get('content-type') ?? '';
  // SVG kan script bevatten en zou dan vanaf ons domein draaien; die meten we niet.
  if (!type.startsWith('image/') || type.includes('svg')) return new Response('Geen afbeelding', { status: 415 });
  const lengte = Number(antwoord.headers.get('content-length') ?? 0);
  if (lengte > MAX_BYTES) return new Response('Foto te groot', { status: 413 });

  const buffer = await antwoord.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) return new Response('Foto te groot', { status: 413 });

  return new Response(buffer, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
