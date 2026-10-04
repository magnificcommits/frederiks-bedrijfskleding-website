import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { werkBoekhoudingBij } from '@/lib/kms/boekhouding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Dagelijkse cron (vercel.json): haalt de betaalstatus op van doorgezette facturen
 * die in het KMS nog niet betaald zijn, en zet ze op Betaald als Moneybird dat zegt.
 * Staat automatisch doorzetten aan, dan worden mislukte facturen opnieuw geprobeerd.
 * Beveiligd met CRON_SECRET, net als /api/cron/campagnes en /api/cron/nieuwsbrief:
 * Vercel stuurt `Authorization: Bearer <secret>` mee; handmatig kan met ?secret=<secret>.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return NextResponse.json({ error: 'Cron niet geconfigureerd (zet CRON_SECRET).' }, { status: 503 });

  const auth = req.headers.get('authorization');
  const param = new URL(req.url).searchParams.get('secret');
  if (auth !== `Bearer ${secret}` && param !== secret) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }

  const res = await werkBoekhoudingBij(50_000);
  return NextResponse.json({ ok: true, ...res });
}
