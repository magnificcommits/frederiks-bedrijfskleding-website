import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { veiligGelijk } from '@/lib/kms/adminClient';
import { ruimOudeLogsOp } from '@/lib/avg/bewaartermijnen';
import { verwerkGeplandeNieuwsbrieven } from '@/lib/nieuwsbrief/verzenden';
import { verwerkDagelijkseKlantmails } from '@/lib/klantmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Ruim boven de ~50 s die de verwerking zichzelf gunt. */
export const maxDuration = 60;

/**
 * Dagelijkse cron (vercel.json, 06:00 UTC = 07:00/08:00 Nederlandse tijd):
 * verstuurt ingeplande nieuwsbrieven en hervat onderbroken verzendingen, in
 * batches van 50 tot ongeveer 50 seconden op zijn. Beveiligd met CRON_SECRET,
 * net als /api/cron/campagnes: Vercel stuurt `Authorization: Bearer <secret>`
 * mee; handmatig kan met ?secret=<secret>.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return NextResponse.json({ error: 'Cron niet geconfigureerd (zet CRON_SECRET).' }, { status: 503 });

  const auth = req.headers.get('authorization');
  const param = new URL(req.url).searchParams.get('secret');
  if (!veiligGelijk(auth ?? '', `Bearer ${secret}`) && !veiligGelijk(param ?? '', secret)) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }

  // Eerst de klantmails (afspraakherinneringen voor morgen en tevredenheidsmails);
  // dat zijn er weinig. De rest van de tijd gaat naar de nieuwsbrief.
  const begin = Date.now();
  const klantmails = await verwerkDagelijkseKlantmails().catch((e) => ({ fout: String(e) }));
  const res = await verwerkGeplandeNieuwsbrieven(Math.max(10_000, 50_000 - (Date.now() - begin)));
  // Dagelijks meteen ook de logtabellen opschonen (AVG-bewaartermijnen, lib/avg/bewaartermijnen.ts).
  const opgeschoond = await ruimOudeLogsOp().catch(() => []);
  return NextResponse.json({ ok: true, ...res, klantmails, opgeschoond });
}
