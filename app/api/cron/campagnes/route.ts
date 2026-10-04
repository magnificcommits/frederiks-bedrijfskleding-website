import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { verwerkCampagnes } from '@/lib/kms/campagne-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Hobby-plan staat tot 60 seconden toe; de motor stopt zelf rond 50 seconden. */
export const maxDuration = 60;

/**
 * Cron-endpoint voor de campagnes (vercel.json: werkdagen 09:00 UTC, dus 10:00
 * of 11:00 Nederlandse tijd). Doet triggers, doelen en de wachtrij in één run.
 * Beveiligd met CRON_SECRET: Vercel stuurt `Authorization: Bearer <CRON_SECRET>`
 * mee. Handmatig aanroepen kan met ?secret=<CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return NextResponse.json({ error: 'Cron niet geconfigureerd (zet CRON_SECRET).' }, { status: 503 });

  const auth = req.headers.get('authorization');
  const param = new URL(req.url).searchParams.get('secret');
  if (auth !== `Bearer ${secret}` && param !== secret) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }

  const res = await verwerkCampagnes({ tijdMs: 50_000 });
  return NextResponse.json(res);
}
