import { NextResponse } from 'next/server';
import { veiligGelijk } from '@/lib/kms/adminClient';
import { verwerkTaakMeldingen } from '@/lib/kms/taakMeldingen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Meldingen voor taken: herinneringen, dagoverzicht (07:00), weekoverzicht
 * (maandag 07:00), prullenbak en archief opruimen.
 *
 * Wordt elke 10 minuten aangeroepen door Supabase (pg_cron + pg_net), niet door
 * Vercel: op het Hobby-plan zijn er maar twee Vercel-crons per dag. Zie het
 * blok onderaan supabase/migrations/20261003_taken_v2.sql.
 *
 * Beveiligd met header `x-taken-secret` = env TAKEN_CRON_SECRET. Handmatig testen:
 *   /api/cron/taken?secret=<geheim>                 normale ronde
 *   /api/cron/taken?secret=<geheim>&proef=1         niets versturen of wijzigen, alleen rapport
 *   /api/cron/taken?secret=<geheim>&forceer=dag     dagoverzicht nu (ook buiten 07:00, telt niet als "verstuurd")
 *   /api/cron/taken?secret=<geheim>&forceer=week    weekoverzicht nu
 */
async function verwerk(req: Request) {
  const geheim = (process.env.TAKEN_CRON_SECRET ?? '').trim();
  if (!geheim) return NextResponse.json({ ok: false, fout: 'Zet TAKEN_CRON_SECRET in de omgeving.' }, { status: 503 });

  const url = new URL(req.url);
  const gegeven = req.headers.get('x-taken-secret') ?? url.searchParams.get('secret') ?? '';
  if (!gegeven || !veiligGelijk(gegeven.trim(), geheim)) {
    return NextResponse.json({ ok: false, fout: 'Niet toegestaan' }, { status: 401 });
  }

  const f = url.searchParams.get('forceer');
  const forceer = f === 'dag' || f === 'week' ? f : null;
  const proef = url.searchParams.get('proef') === '1';
  try {
    const rapport = await verwerkTaakMeldingen({ forceer, proef });
    return NextResponse.json(rapport, { status: rapport.ok ? 200 : 500 });
  } catch (e) {
    console.error('[cron/taken] mislukt', e);
    return NextResponse.json({ ok: false, fout: 'Onverwachte fout bij het verwerken van de meldingen.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return verwerk(req);
}

export async function POST(req: Request) {
  return verwerk(req);
}
