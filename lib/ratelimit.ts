import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Lichte, in-memory rate limiter + IP-helper voor het publieke formulier.
 * Best effort tegen eenvoudige bots/spam. Voor zware bescherming: Upstash/KV
 * of Cloudflare Turnstile toevoegen.
 */
type Hit = { count: number; reset: number };
const store = new Map<string, Hit>();

export function rateLimit(key: string, limit = 5, windowMs = 600_000): boolean {
  const now = Date.now();
  if (store.size > 10_000) store.clear();
  const h = store.get(key);
  if (!h || h.reset < now) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (h.count >= limit) return false;
  h.count += 1;
  return true;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'onbekend';
}

// ---------------------------------------------------------------------------
// Inlogbeveiliging: mislukte pogingen tellen per IP en per e-mailadres.
// ---------------------------------------------------------------------------

/** Maximaal aantal mislukte pogingen binnen het venster. */
export const LOGIN_MAX_POGINGEN = 5;
/** Venster: 15 minuten. */
export const LOGIN_VENSTER_MS = 15 * 60_000;

/**
 * IP-adres van de huidige request (server actions / server components).
 * Eerste waarde van x-forwarded-for, anders x-real-ip. Null als onbekend:
 * dan tellen we niet per IP, zodat niet iedereen samen geblokkeerd raakt.
 */
export async function ipUitHeaders(): Promise<string | null> {
  try {
    const h = await headers();
    const xff = (h.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const ip = xff || (h.get('x-real-ip') ?? '').trim();
    return ip || null;
  } catch {
    return null;
  }
}

/** Sleutels worden gehasht opgeslagen: geen IP-adressen of e-mailadressen in de tabel. */
function hashSleutel(sleutel: string): string {
  return createHash('sha256').update(`fb-login|${sleutel.toLowerCase()}`).digest('hex');
}

// Terugval als de tabel login_pogingen (nog) niet bestaat: per server-instantie in het geheugen.
const faalGeheugen = new Map<string, number[]>();

function geheugenAantal(hash: string, sinds: number): number {
  const lijst = (faalGeheugen.get(hash) ?? []).filter((t) => t >= sinds);
  if (lijst.length) faalGeheugen.set(hash, lijst);
  else faalGeheugen.delete(hash);
  return lijst.length;
}

function geheugenRegistreer(hash: string): void {
  if (faalGeheugen.size > 10_000) faalGeheugen.clear();
  const lijst = faalGeheugen.get(hash) ?? [];
  lijst.push(Date.now());
  faalGeheugen.set(hash, lijst);
}

/**
 * Is één van de sleutels (bv. `ip:1.2.3.4`, `email:jan@x.nl`) geblokkeerd?
 * Kijkt in de tabel login_pogingen én in het geheugen; bij twijfel (tabel ontbreekt
 * of database onbereikbaar) telt alleen het geheugen.
 */
export async function loginGeblokkeerd(
  sleutels: string[],
  max = LOGIN_MAX_POGINGEN,
  vensterMs = LOGIN_VENSTER_MS,
): Promise<boolean> {
  const hashes = sleutels.filter(Boolean).map(hashSleutel);
  if (hashes.length === 0) return false;
  const sinds = Date.now() - vensterMs;

  if (hashes.some((h) => geheugenAantal(h, sinds) >= max)) return true;

  try {
    const sb = kmsAdmin();
    if (!sb) return false;
    const { data, error } = await sb
      .from('login_pogingen')
      .select('sleutel')
      .in('sleutel', hashes)
      .gte('created_at', new Date(sinds).toISOString())
      .limit(hashes.length * (max + 1) + 50);
    if (error || !data) return false;
    const telling = new Map<string, number>();
    for (const r of data as { sleutel: string }[]) telling.set(r.sleutel, (telling.get(r.sleutel) ?? 0) + 1);
    return hashes.some((h) => (telling.get(h) ?? 0) >= max);
  } catch {
    return false;
  }
}

/** Legt een mislukte poging vast voor alle opgegeven sleutels (database + geheugen). */
export async function registreerMisluktePoging(sleutels: string[]): Promise<void> {
  const hashes = sleutels.filter(Boolean).map(hashSleutel);
  if (hashes.length === 0) return;
  hashes.forEach(geheugenRegistreer);
  try {
    const sb = kmsAdmin();
    if (!sb) return;
    const { error } = await sb.from('login_pogingen').insert(hashes.map((sleutel) => ({ sleutel })));
    if (error) return;
    // Opruimen: pogingen ouder dan een dag zijn niet meer nodig.
    await sb.from('login_pogingen').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString());
  } catch {
    // Bewust stil: het geheugen telt in elk geval mee.
  }
}
