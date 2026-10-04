import { NextResponse } from 'next/server';
import { annuleerAfspraakDoorKlant } from '@/lib/afspraken/afspraken';
import { publiekeLimiet, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Afspraak annuleren met de geheime link uit de bevestigingsmail. */
export async function POST(req: Request) {
  // auth: token (beheertoken uit de bevestigingsmail) plus databaselimiet.
  if (!(await publiekeLimiet('afspraak-annuleer', clientIp(req), 10, 600_000))) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het later opnieuw of bel ons.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const res = await annuleerAfspraakDoorKlant(String(body?.token ?? ''));
  if (!res.ok) return NextResponse.json({ error: res.fout }, { status: 422 });
  return NextResponse.json({ ok: true });
}
