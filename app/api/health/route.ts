import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env, isLeadsDbConfigured } from '@/lib/env';

/**
 * Gezondheidscheck voor een uptime-monitor (UptimeRobot, Better Stack; zie docs/testen.md).
 *
 * GET /api/health
 *  - 200 { status: 'ok' }    : site draait en de database antwoordt binnen 5 seconden.
 *  - 503 { status: 'fout' }  : database niet geconfigureerd, onbereikbaar of te traag.
 *
 * Bewust zonder details (geen foutmelding, versie of tabelnamen): de route is
 * openbaar. De reden komt in de serverlog onder "[health]". Geen cache, zodat
 * elke controle echt de database raakt. HEAD werkt ook (sommige monitors gebruiken dat).
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TIMEOUT_MS = 5000;
const HEADERS = { 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex' };

async function databaseOk(): Promise<boolean> {
  if (!isLeadsDbConfigured) {
    console.error('[health] database niet geconfigureerd');
    return false;
  }
  const sb = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false } });
  try {
    // Lichte query die echt de database raakt: alleen een telling van een kleine tabel, geen rijen terug.
    const { error } = await sb.from('instellingen').select('sleutel', { head: true, count: 'exact' }).limit(1).abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) {
      console.error(`[health] database gaf fout ${error.code ?? 'onbekend'}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[health] database onbereikbaar: ${e instanceof Error ? e.name : 'onbekend'}`);
    return false;
  }
}

export async function GET() {
  // auth: publiek (uptime-monitor); geeft alleen ok of fout terug, geen gegevens.
  const ok = await databaseOk();
  return NextResponse.json({ status: ok ? 'ok' : 'fout' }, { status: ok ? 200 : 503, headers: HEADERS });
}

export async function HEAD() {
  // auth: publiek (uptime-monitor); alleen een statuscode.
  const ok = await databaseOk();
  return new NextResponse(null, { status: ok ? 200 : 503, headers: HEADERS });
}
