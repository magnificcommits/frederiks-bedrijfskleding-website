import { NextResponse } from 'next/server';
import { getBeschikbaarheid, vrijeDagen } from '@/lib/afspraken/beschikbaarheid';
import { getAfspraakOpToken } from '@/lib/afspraken/afspraken';
import { AFSPRAAK_SOORTEN, isSoort } from '@/lib/afspraken/soorten';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vrije tijden voor de AfspraakKiezer.
 *   ?soort=advies|showroom|pasdag   vrije dagen en tijden voor die soort
 *   ?token=...                      bij verzetten: de soort van die afspraak, eigen tijd telt niet als bezet
 * Zonder soort alleen welke soorten aan staan (en hun duur).
 */
export async function GET(req: Request) {
  if (!rateLimit(`afspraak-vrij:${clientIp(req)}`, 60, 600_000)) {
    return NextResponse.json({ error: 'Te veel verzoeken. Probeer het zo opnieuw.' }, { status: 429 });
  }
  const url = new URL(req.url);
  const inst = await getBeschikbaarheid();
  const soorten = Object.fromEntries(AFSPRAAK_SOORTEN.map((s) => [s, { actief: inst.soorten[s].actief, duurMin: inst.soorten[s].duurMin }]));

  let soort = url.searchParams.get('soort');
  let negeer: string | undefined;
  const token = url.searchParams.get('token');
  if (token) {
    const a = await getAfspraakOpToken(token);
    if (!a) return NextResponse.json({ error: 'Deze afspraak bestaat niet (meer).' }, { status: 404 });
    soort = a.soort;
    negeer = a.id;
  }
  if (!isSoort(soort)) {
    return NextResponse.json({ soorten }, { headers: { 'cache-control': 'no-store' } });
  }
  const dagen = await vrijeDagen(soort, { negeerAfspraakId: negeer });
  return NextResponse.json({ soorten, soort, dagen }, { headers: { 'cache-control': 'no-store' } });
}
