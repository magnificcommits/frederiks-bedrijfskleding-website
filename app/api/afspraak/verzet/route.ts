import { NextResponse } from 'next/server';
import { verzetAfspraak } from '@/lib/afspraken/afspraken';
import { publiekeLimiet, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Afspraak verzetten met de geheime link uit de bevestigingsmail. */
export async function POST(req: Request) {
  // auth: token (beheertoken uit de bevestigingsmail) plus databaselimiet.
  if (!(await publiekeLimiet('afspraak-verzet', clientIp(req), 10, 600_000))) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het later opnieuw of bel ons.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { token?: unknown; datum?: unknown; tijd?: unknown } | null;
  const res = await verzetAfspraak(String(body?.token ?? ''), String(body?.datum ?? ''), String(body?.tijd ?? ''));
  if (!res.ok) return NextResponse.json({ error: res.fout, bezet: res.bezet ?? false }, { status: res.bezet ? 409 : 422 });
  return NextResponse.json({ ok: true, start: res.start, eind: res.eind });
}
