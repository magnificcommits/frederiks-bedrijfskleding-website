import { NextResponse } from 'next/server';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prijsindicatie voor één artikel, alleen voor ingelogde klanten.
 *
 * De productpagina zelf is statisch en prijsloos, zodat hij goed indexeert en
 * concurrenten niets te zien krijgen. Deze route vult de prijs pas aan als er
 * een geldige portaalsessie is — vandaar dat de pagina hem client-side ophaalt.
 *
 * Bewust een bandbreedte en geen exacte prijs: de definitieve prijs hangt af van
 * de staffel, de maat en de bedrukking. Die rekensom staat in het portaal en in
 * de offerte, niet hier.
 */
export async function GET(req: Request) {
  const id = (new URL(req.url).searchParams.get('id') ?? '').trim();
  if (!id) return NextResponse.json({ toegang: false }, { status: 400 });

  const sb = await getServerSupabase();
  const gebruiker = sb ? (await sb.auth.getUser()).data.user : null;
  if (!gebruiker) return NextResponse.json({ toegang: false }, { status: 401 });

  const admin = kmsAdmin();
  if (!admin) return NextResponse.json({ toegang: false }, { status: 503 });

  const { data } = await admin
    .from('product_varianten')
    .select('verkoopprijs, meerprijs')
    .eq('product_id', id);
  const prijzen = ((data as { verkoopprijs: number | null; meerprijs: number | null }[]) ?? [])
    .map((v) => Number(v.verkoopprijs ?? 0) + Number(v.meerprijs ?? 0))
    .filter((n) => n > 0);
  if (prijzen.length === 0) return NextResponse.json({ toegang: true, van: null, tot: null });

  return NextResponse.json({
    toegang: true,
    van: Math.min(...prijzen),
    tot: Math.max(...prijzen),
  });
}
