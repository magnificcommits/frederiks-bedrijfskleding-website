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
