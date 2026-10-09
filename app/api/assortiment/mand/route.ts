import { NextResponse } from 'next/server';
import { mandGegevens } from '@/lib/kms/catalogus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Kleuren, maten en kleurfoto's voor de artikelen in het offertemandje.
 * Openbaar: het zijn dezelfde gegevens als op de productpagina's.
 */
export async function GET(req: Request) {
  // auth: publiek (alleen publieke catalogusvelden).
  const ids = (new URL(req.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID.test(s))
    .slice(0, 100);
  const gegevens = await mandGegevens([...new Set(ids)]);
  return NextResponse.json({ gegevens }, { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=3600' } });
}
