import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { verwerkCampagneWachtrij } from '@/lib/kms/campagne-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron-endpoint dat de campagne-wachtrij verwerkt. Beveiligd met CRON_SECRET:
 * Vercel-cronjobs sturen automatisch `Authorization: Bearer <CRON_SECRET>` mee als
 * die env is gezet. Handmatig aanroepen kan met ?secret=<CRON_SECRET>.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return NextResponse.json({ error: 'Cron niet geconfigureerd (zet CRON_SECRET).' }, { status: 503 });

  const auth = req.headers.get('authorization');
  const param = new URL(req.url).searchParams.get('secret');
  if (auth !== `Bearer ${secret}` && param !== secret) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }

  const res = await verwerkCampagneWachtrij();
  return NextResponse.json({ ok: true, ...res });
}
