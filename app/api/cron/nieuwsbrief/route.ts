import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { verwerkGeplandeNieuwsbrieven } from '@/lib/nieuwsbrief/verzenden';

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
  if (auth !== `Bearer ${secret}` && param !== secret) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }

  const res = await verwerkGeplandeNieuwsbrieven(50_000);
  return NextResponse.json({ ok: true, ...res });
}
