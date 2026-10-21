import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { veiligGelijk } from '@/lib/kms/adminClient';
import { verwerkDagelijkseKlantmails } from '@/lib/klantmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Afspraakherinneringen en tevredenheidsmails los draaien (handmatig of via een
 * eigen schema). Normaal gebeurt dit al in de dagelijkse cron /api/cron/nieuwsbrief.
 * Beveiligd met CRON_SECRET: header `Authorization: Bearer <secret>`. Niet via de URL.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return NextResponse.json({ error: 'Cron niet geconfigureerd (zet CRON_SECRET).' }, { status: 503 });
  const auth = req.headers.get('authorization') ?? '';
  if (!veiligGelijk(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }
  const rapport = await verwerkDagelijkseKlantmails();
  return NextResponse.json({ ok: true, ...rapport });
}
